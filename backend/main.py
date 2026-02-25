"""FastAPI application - HTTP API for SmallBets.live

IMPERATIVE SHELL: This module handles HTTP requests/responses
- Delegates business logic to services and game_logic
- No business logic in endpoints
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Annotated
import uvicorn

from firebase_config import initialize_firebase
from services import room_service, user_service, bet_service, transcript_service, automation_service, template_service
from models.room import Room
from models.user import User
from models.bet import Bet
import game_logic


# Initialize FastAPI app
app = FastAPI(
    title="SmallBets.live API",
    description="Real-time micro-betting platform API",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize Firebase on startup
@app.on_event("startup")
async def startup_event():
    """Initialize Firebase Admin SDK on app startup"""
    initialize_firebase()


# ============================================================================
# Request/Response Models
# ============================================================================

class CreateRoomRequest(BaseModel):
    event_template: str
    event_name: Optional[str] = None
    host_nickname: str


class CreateRoomResponse(BaseModel):
    room_code: str
    host_id: str
    user_id: str


class JoinRoomRequest(BaseModel):
    nickname: str


class JoinRoomResponse(BaseModel):
    user_id: str
    room: dict
    user: dict


class PlaceBetRequest(BaseModel):
    bet_id: str
    selected_option: str


class OpenBetRequest(BaseModel):
    bet_id: str


class LockBetRequest(BaseModel):
    bet_id: str


class ResolveBetRequest(BaseModel):
    winning_option: str


class TranscriptRequest(BaseModel):
    text: str
    source: str = "manual"


class ToggleAutomationRequest(BaseModel):
    enabled: bool


# ============================================================================
# Dependency Injection
# ============================================================================

async def get_room_or_404(code: str) -> Room:
    """Dependency: Get room or raise 404

    Args:
        code: Room code from path parameter

    Returns:
        Room object

    Raises:
        HTTPException: 404 if room not found
    """
    room = await room_service.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room not found: {code}")
    return room


async def get_user_or_404(user_id: str) -> User:
    """Dependency: Get user or raise 404

    Args:
        user_id: User ID from path parameter or header

    Returns:
        User object

    Raises:
        HTTPException: 404 if user not found
    """
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    return user


async def require_host(
    code: str,
    x_host_id: Annotated[str, Header(alias="X-Host-Id")],
) -> Room:
    """Dependency: Verify user is room host

    Args:
        code: Room code from path parameter
        x_host_id: Host ID from X-Host-Id header

    Returns:
        Room object

    Raises:
        HTTPException: 403 if not room host, 404 if room not found
    """
    room = await get_room_or_404(code)

    if room.host_id != x_host_id:
        raise HTTPException(status_code=403, detail="Not the room host")

    return room


# Type aliases for cleaner signatures
RoomDep = Annotated[Room, Depends(get_room_or_404)]
UserDep = Annotated[User, Depends(get_user_or_404)]
HostRoomDep = Annotated[Room, Depends(require_host)]


# ============================================================================
# Room Endpoints
# ============================================================================

@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest):
    """Create a new room

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Create room (I/O - delegates to service)
        room = await room_service.create_room(
            event_template=request.event_template,
            event_name=request.event_name,
            host_id="",  # Will be set after creating host user
        )

        # Create host user (I/O - delegates to service)
        host_user = await user_service.create_user(
            room_code=room.code,
            nickname=request.host_nickname,
            is_admin=True,
        )

        # Update room with host_id (I/O)
        room = room.model_copy(update={"host_id": host_user.user_id})
        await room_service.update_room(room)

        # Load event template and create bets (I/O)
        # Skip for "custom" template (host will create bets manually)
        if request.event_template != "custom":
            try:
                await template_service.create_bets_from_template(
                    room_code=room.code,
                    template_id=request.event_template,
                )
            except ValueError as e:
                # Template not found - log but don't fail room creation
                print(f"Warning: Could not load template {request.event_template}: {e}")

        return CreateRoomResponse(
            room_code=room.code,
            host_id=host_user.user_id,
            user_id=host_user.user_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create room: {str(e)}")


@app.get("/api/rooms/{code}")
async def get_room(room: RoomDep):
    """Get room details

    Imperative Shell - handles HTTP, uses dependency injection
    """
    return room.to_dict()


@app.post("/api/rooms/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, request: JoinRoomRequest, room: RoomDep):
    """Join a room

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Create user (I/O - delegates to service)
        user = await user_service.create_user(
            room_code=code,
            nickname=request.nickname,
            is_admin=False,
        )

        return JoinRoomResponse(
            user_id=user.user_id,
            room=room.to_dict(),
            user=user.to_dict(),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to join room: {str(e)}")


@app.get("/api/rooms/{code}/participants")
async def get_participants(code: str, room: RoomDep):
    """Get all participants in a room

    Imperative Shell - handles HTTP, delegates to services
    """
    # Get participants (I/O - delegates to service)
    users = await room_service.get_room_participants(code)

    return {
        "participants": [user.to_dict() for user in users],
        "count": len(users),
    }


@app.get("/api/rooms/{code}/leaderboard")
async def get_leaderboard(code: str, room: RoomDep):
    """Get room leaderboard

    Imperative Shell - handles HTTP, delegates to services
    """
    # Calculate leaderboard (I/O + pure calculation via service)
    leaderboard = await user_service.calculate_and_get_leaderboard(code)

    return {"leaderboard": leaderboard}


@app.post("/api/rooms/{code}/start")
async def start_room(code: str, room: HostRoomDep):
    """Start the event (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    # Update room status (I/O)
    await room_service.set_room_status(code, "active")

    return {"status": "active"}


@app.post("/api/rooms/{code}/finish")
async def finish_room(code: str, room: HostRoomDep):
    """Finish the event (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    # Update room status (I/O)
    await room_service.set_room_status(code, "finished")

    # Get final leaderboard
    leaderboard = await user_service.calculate_and_get_leaderboard(code)

    return {
        "status": "finished",
        "leaderboard": leaderboard,
    }


# ============================================================================
# Bet Endpoints
# ============================================================================

@app.post("/api/rooms/{code}/bets")
async def create_bet(code: str, room: HostRoomDep, request: dict):
    """Create a new bet (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Create bet (I/O - delegates to service)
        bet = await bet_service.create_bet(
            room_code=code,
            question=request["question"],
            options=request["options"],
            points_value=request.get("pointsValue", 100),
        )

        return bet.to_dict()

    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/open")
async def open_bet(code: str, room: HostRoomDep, request: OpenBetRequest):
    """Open a bet for betting (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Open bet (I/O - delegates to service)
        bet = await bet_service.open_bet(request.bet_id)

        return bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/lock")
async def lock_bet(code: str, room: HostRoomDep, request: LockBetRequest):
    """Lock a bet (close betting) (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Lock bet (I/O - delegates to service)
        bet = await bet_service.lock_bet(request.bet_id)

        return bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lock bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/{bet_id}/resolve")
async def resolve_bet(
    code: str,
    bet_id: str,
    room: HostRoomDep,
    request: ResolveBetRequest,
):
    """Resolve a bet (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Resolve bet and distribute points (I/O - delegates to service)
        await bet_service.resolve_bet(bet_id, request.winning_option)

        # Get updated leaderboard
        leaderboard = await user_service.calculate_and_get_leaderboard(code)

        return {
            "status": "resolved",
            "leaderboard": leaderboard,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/place")
async def place_bet(
    code: str,
    room: RoomDep,
    request: PlaceBetRequest,
    x_user_id: Annotated[str, Header(alias="X-User-Id")],
):
    """Place a bet

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Place bet (I/O + validation - delegates to service)
        user_bet = await bet_service.place_user_bet(
            user_id=x_user_id,
            bet_id=request.bet_id,
            selected_option=request.selected_option,
        )

        return user_bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to place bet: {str(e)}")


@app.get("/api/rooms/{code}/bets")
async def get_bets(code: str, room: RoomDep):
    """Get all bets in a room

    Imperative Shell - handles HTTP, delegates to services
    """
    # Get bets (I/O - delegates to service)
    bets = await bet_service.get_bets_in_room(code)

    return {
        "bets": [bet.to_dict() for bet in bets],
        "count": len(bets),
    }


@app.get("/api/rooms/{code}/bets/{bet_id}")
async def get_bet(code: str, bet_id: str, room: RoomDep):
    """Get bet details

    Imperative Shell - handles HTTP, delegates to services
    """
    # Get bet (I/O - delegates to service)
    bet = await bet_service.get_bet(bet_id)

    if not bet:
        raise HTTPException(status_code=404, detail=f"Bet not found: {bet_id}")

    if bet.room_code != code:
        raise HTTPException(status_code=400, detail="Bet does not belong to this room")

    return bet.to_dict()


# ============================================================================
# Transcript & Automation Endpoints
# ============================================================================

@app.post("/api/rooms/{code}/transcript")
async def ingest_transcript(
    code: str,
    room: RoomDep,
    request: TranscriptRequest,
):
    """Ingest transcript entry and trigger automation

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Create transcript entry (I/O - delegates to service)
        entry = await transcript_service.create_transcript_entry(
            room_code=code,
            text=request.text,
            source=request.source,
        )

        # Process for automation (I/O + pure logic via service)
        automation_result = await automation_service.process_transcript_for_automation(
            room_code=code,
            transcript_text=request.text,
            automation_enabled=room.automation_enabled,
        )

        return {
            "entry_id": entry.entry_id,
            "timestamp": entry.timestamp.isoformat(),
            "automation": automation_result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest transcript: {str(e)}")


@app.get("/api/rooms/{code}/transcript")
async def get_transcript(code: str, room: RoomDep, limit: int = 100):
    """Get recent transcript entries

    Imperative Shell - handles HTTP, delegates to services
    """
    # Get entries (I/O - delegates to service)
    entries = await transcript_service.get_transcript_entries(code, limit)

    return {
        "entries": [entry.to_dict() for entry in entries],
        "count": len(entries),
    }


@app.post("/api/rooms/{code}/automation/toggle")
async def toggle_automation(
    code: str,
    room: HostRoomDep,
    request: ToggleAutomationRequest,
):
    """Toggle automation on/off (admin only)

    Imperative Shell - handles HTTP, delegates to services
    """
    try:
        # Toggle automation (I/O - delegates to service)
        await automation_service.toggle_automation(code, request.enabled)

        return {
            "automation_enabled": request.enabled,
            "message": f"Automation {'enabled' if request.enabled else 'disabled'}",
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle automation: {str(e)}")


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "smallbets-api"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "SmallBets.live API",
        "version": "0.1.0",
        "docs": "/docs",
    }


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
