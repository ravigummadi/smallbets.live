"""FastAPI application - HTTP API for SmallBets.live

IMPERATIVE SHELL: This module handles HTTP requests/responses
- Delegates business logic to services and game_logic
- No business logic in endpoints
"""

import html
import logging
import os
import re
import time
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Header, Depends, Request
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


# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

# Initialize FastAPI app
app = FastAPI(
    title="SmallBets.live API",
    description="Real-time micro-betting platform API",
    version="0.3.0",
)

# CORS middleware - restrict to known origins in production
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://smallbets.live,https://www.smallbets.live",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


logger = logging.getLogger(__name__)


def sanitize_input(text: str, max_length: int = 200) -> str:
    """Sanitize user input to prevent XSS.

    Escapes HTML entities and strips leading/trailing whitespace.
    """
    return html.escape(text.strip()[:max_length])


# ============================================================================
# Rate Limiting (in-memory, MVP)
# ============================================================================

class RateLimiter:
    """Simple in-memory rate limiter per IP.

    MVP approach - adequate for single-instance deployment.
    For production, use Redis or Cloud Armor.
    """

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old entries
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if t > window_start
        ]

        if len(self._requests[client_ip]) >= self.max_requests:
            return False

        self._requests[client_ip].append(now)
        return True


# Rate limiter for session restoration endpoint
session_restore_limiter = RateLimiter(max_requests=10, window_seconds=60)

# Regex for validating userKey format
USER_KEY_PATTERN = re.compile(r"^[23456789A-HJ-NP-Za-hj-np-z]{8}$")


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
    user_key: Optional[str] = None


class CreateTournamentRequest(BaseModel):
    event_template: str
    event_name: Optional[str] = None
    host_nickname: str


class CreateMatchRoomRequest(BaseModel):
    team1: str
    team2: str
    match_date_time: str
    venue: Optional[str] = None
    title: Optional[str] = None


class CreateMatchRoomResponse(BaseModel):
    room_code: str
    match_room_code: str
    parent_room_code: str


class JoinRoomRequest(BaseModel):
    nickname: str
    parent_user_id: Optional[str] = None


class JoinRoomResponse(BaseModel):
    user_id: str
    host_id: Optional[str] = None
    user_key: Optional[str] = None
    room: dict
    user: dict


class PlaceBetRequest(BaseModel):
    bet_id: str
    selected_option: str


class LockBetRequest(BaseModel):
    bet_id: str


class ResolveBetRequest(BaseModel):
    winning_option: str


class TranscriptRequest(BaseModel):
    text: str
    source: str = "manual"


class ToggleAutomationRequest(BaseModel):
    enabled: bool


class CreateBetRequest(BaseModel):
    question: str
    options: List[str]
    pointsValue: int = 100
    betType: str = "in-game"
    createdFrom: str = "custom"
    templateId: Optional[str] = None
    timerDuration: int = 60
    status: str = "open"  # "open" (default) or "pending" for bet queue


class EditBetRequest(BaseModel):
    question: Optional[str] = None
    options: Optional[List[str]] = None
    pointsValue: Optional[int] = None


class CoHostRequest(BaseModel):
    user_id: str


# ============================================================================
# Dependency Injection
# ============================================================================

async def get_room_or_404(code: str) -> Room:
    """Dependency: Get room or raise 404"""
    room = await room_service.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room not found: {code}")
    return room


async def get_user_or_404(user_id: str) -> User:
    """Dependency: Get user or raise 404"""
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
    return user


async def require_host(
    code: str,
    x_host_id: Annotated[str, Header(alias="X-Host-Id")],
) -> Room:
    """Dependency: Verify user is room host or co-host"""
    room = await get_room_or_404(code)

    if room.host_id != x_host_id and x_host_id not in room.co_host_ids:
        raise HTTPException(status_code=403, detail="Not the room host")

    return room


async def require_primary_host(
    code: str,
    x_host_id: Annotated[str, Header(alias="X-Host-Id")],
) -> Room:
    """Dependency: Verify user is the primary room host (not co-host)"""
    room = await get_room_or_404(code)

    if room.host_id != x_host_id:
        raise HTTPException(status_code=403, detail="Only the primary host can manage co-hosts")

    return room


# Type aliases for cleaner signatures
RoomDep = Annotated[Room, Depends(get_room_or_404)]
UserDep = Annotated[User, Depends(get_user_or_404)]
HostRoomDep = Annotated[Room, Depends(require_host)]
PrimaryHostRoomDep = Annotated[Room, Depends(require_primary_host)]


# ============================================================================
# Room Endpoints
# ============================================================================

@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest):
    """Create a new room"""
    try:
        nickname = sanitize_input(request.host_nickname, 20)
        event_name = sanitize_input(request.event_name, 100) if request.event_name else None

        room = await room_service.create_room(
            event_template=request.event_template,
            event_name=event_name,
            host_id="",
        )

        host_user = await user_service.create_user(
            room_code=room.code,
            nickname=nickname,
            is_admin=True,
        )

        room = room.model_copy(update={"host_id": host_user.user_id})
        await room_service.update_room(room)

        if request.event_template != "custom":
            try:
                await template_service.create_bets_from_template(
                    room_code=room.code,
                    template_id=request.event_template,
                )
            except ValueError as e:
                print(f"Warning: Could not load template {request.event_template}: {e}")

        return CreateRoomResponse(
            room_code=room.code,
            host_id=host_user.user_id,
            user_id=host_user.user_id,
            user_key=host_user.user_key,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create room: {str(e)}")


@app.post("/api/tournaments", response_model=CreateRoomResponse)
async def create_tournament(request: CreateTournamentRequest):
    """Create a new tournament room (6-char code, no expiry)"""
    try:
        room = await room_service.create_tournament_room(
            event_template=request.event_template,
            event_name=request.event_name,
            host_id="",
        )

        host_user = await user_service.create_user(
            room_code=room.code,
            nickname=request.host_nickname,
            is_admin=True,
        )

        room = room.model_copy(update={
            "host_id": host_user.user_id,
            "participants": [host_user.user_id],
        })
        await room_service.update_room(room)

        # Create RoomUser for host
        await room_service.create_room_user(
            room_code=room.code,
            user_id=host_user.user_id,
            nickname=request.host_nickname,
            is_host=True,
        )

        # Load tournament template bets
        if request.event_template != "custom":
            try:
                await template_service.create_bets_from_template(
                    room_code=room.code,
                    template_id=request.event_template,
                    bet_type="tournament",
                    timer_duration=120,
                )
            except ValueError as e:
                print(f"Warning: Could not load template {request.event_template}: {e}")

        return CreateRoomResponse(
            room_code=room.code,
            host_id=host_user.user_id,
            user_id=host_user.user_id,
            user_key=host_user.user_key,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tournament: {str(e)}")


@app.post("/api/rooms/{code}/matches", response_model=CreateMatchRoomResponse)
async def create_match_room(code: str, room: HostRoomDep, request: CreateMatchRoomRequest):
    """Create a match room linked to a tournament"""
    try:
        if not room.is_tournament():
            raise HTTPException(status_code=400, detail="Can only create match rooms from tournament rooms")

        match_room = await room_service.create_match_room(
            parent_room_code=code,
            host_id=room.host_id,
            team1=request.team1,
            team2=request.team2,
            match_date_time=request.match_date_time,
            venue=request.venue,
            title=request.title,
        )

        # Note: Don't pre-create RoomUser for host here.
        # The host will join via join_room with parent_user_id,
        # which will create their RoomUser and set them as admin.

        return CreateMatchRoomResponse(
            room_code=match_room.code,
            match_room_code=match_room.code,
            parent_room_code=code,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create match room: {str(e)}")


@app.get("/api/rooms/{code}")
async def get_room(room: RoomDep):
    """Get room details"""
    return room.to_dict()


@app.post("/api/rooms/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, request: JoinRoomRequest, room: RoomDep):
    """Join a room

    For tournament/match rooms, pass parent_user_id to preserve identity.
    If the parent_user_id is the host of the parent tournament, the joining
    user will be set as admin in this room.
    """
    try:
        nickname = sanitize_input(request.nickname, 20)

        # Determine if this user should be admin based on parent room context
        is_admin = False
        if request.parent_user_id and room.room_type in ("tournament", "match"):
            # Check if user was host in parent tournament
            parent_code = room.parent_room_code if room.room_type == "match" else None
            if parent_code:
                parent_room = await room_service.get_room(parent_code)
                if parent_room and parent_room.host_id == request.parent_user_id:
                    is_admin = True
            # Also check if user is host of this room directly (tournament join)
            if room.host_id == request.parent_user_id:
                is_admin = True

        # Check if a user with this nickname already exists in the room
        # to prevent duplicate participants on re-join
        existing_user = await user_service.find_user_by_nickname(code, nickname)
        if existing_user:
            # Return existing user — update admin status if needed
            if is_admin and not existing_user.is_admin:
                existing_user = existing_user.model_copy(update={"is_admin": True})
                await user_service.update_user(existing_user)

            # Backfill user_key if missing
            existing_user = await user_service.ensure_user_has_key(existing_user)

            # Update room host_id if this returning user is the host
            if is_admin and room.host_id != existing_user.user_id:
                updated_room = room.model_copy(update={"host_id": existing_user.user_id})
                await room_service.update_room(updated_room)
                room = updated_room

            host_id = existing_user.user_id if existing_user.is_admin else None

            return JoinRoomResponse(
                user_id=existing_user.user_id,
                host_id=host_id,
                user_key=existing_user.user_key,
                room=room.to_dict(),
                user=existing_user.to_dict(),
            )

        user = await user_service.create_user(
            room_code=code,
            nickname=nickname,
            is_admin=is_admin,
        )

        # For tournament/match rooms, also create RoomUser and add to participants
        if room.room_type in ("tournament", "match"):
            await room_service.create_room_user(
                room_code=code,
                user_id=user.user_id,
                nickname=nickname,
                is_host=is_admin,
            )
            await room_service.add_participant(code, user.user_id)

            # If this user is the host, update the room's host_id to the new user id
            if is_admin:
                updated_room = room.model_copy(update={"host_id": user.user_id})
                await room_service.update_room(updated_room)
                room = updated_room

        host_id = user.user_id if is_admin else None

        return JoinRoomResponse(
            user_id=user.user_id,
            host_id=host_id,
            user_key=user.user_key,
            room=room.to_dict(),
            user=user.to_dict(),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to join room: {str(e)}")


@app.get("/api/rooms/{code}/participants")
async def get_participants(code: str, room: RoomDep):
    """Get all participants in a room"""
    users = await room_service.get_room_participants(code)

    return {
        "participants": [user.to_dict() for user in users],
        "count": len(users),
    }


# ============================================================================
# User Link Endpoints
# ============================================================================

@app.get("/api/rooms/{code}/participants-with-links")
async def get_participants_with_links(
    code: str,
    room: HostRoomDep,
):
    """Get all participants with their unique session links (host-only)

    Returns participants with userKey included for link construction.
    Backfills missing keys on demand for existing users.
    """
    try:
        users = await user_service.get_users_in_room(code)

        participants = []
        for user in users:
            try:
                user_with_key = await user_service.ensure_user_has_key(user)
                participant_data = user_with_key.to_dict(include_key=True)
                participants.append(participant_data)
            except ValueError:
                logger.error(
                    "KEY_GENERATION_FAILED: room=%s user=%s",
                    code, user.user_id,
                )
                # Continue without this participant per spec
                continue

        return {"participants": participants}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get participants with links: {str(e)}",
        )


@app.get("/api/rooms/{code}/users/{user_key}")
async def get_user_by_key(
    code: str,
    user_key: str,
    request: Request,
):
    """Look up user by userKey for session restoration (public, no auth)

    Security controls:
    - Input validation via regex
    - Rate limiting: 10 req/min per IP
    - Structured logging for abuse monitoring
    """
    # Rate limiting
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    if not session_restore_limiter.is_allowed(client_ip):
        logger.warning("RATE_LIMITED: ip=%s room=%s", client_ip, code)
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

    # Input validation
    if not USER_KEY_PATTERN.match(user_key):
        raise HTTPException(status_code=400, detail="Invalid user key format")

    # Verify room exists
    room = await room_service.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room not found: {code}")

    try:
        user = await user_service.get_user_by_key(code, user_key)
    except Exception as e:
        error_str = str(e)
        if "FAILED_PRECONDITION" in error_str:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable (index building)",
            )
        raise HTTPException(status_code=500, detail=f"Lookup failed: {error_str}")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info("SESSION_RESTORE: room=%s user=%s", code, user.user_id)

    # Return user data WITHOUT userKey (security)
    return {
        "userId": user.user_id,
        "nickname": user.nickname,
        "points": user.points,
        "isAdmin": user.is_admin,
        "roomCode": user.room_code,
    }


@app.get("/api/rooms/{code}/leaderboard")
async def get_leaderboard(code: str, room: RoomDep):
    """Get room leaderboard"""
    if room.is_tournament():
        leaderboard = await get_tournament_aggregated_leaderboard(code)
        return {"leaderboard": leaderboard}

    room_users = await room_service.get_room_users(code)
    if room_users:
        leaderboard = game_logic.calculate_room_user_leaderboard(room_users)
        return {"leaderboard": leaderboard}

    leaderboard = await user_service.calculate_and_get_leaderboard(code)
    return {"leaderboard": leaderboard}


@app.get("/api/rooms/{code}/matches")
async def get_match_rooms(code: str, room: RoomDep):
    """Get all match rooms for a tournament"""
    if not room.is_tournament():
        raise HTTPException(status_code=400, detail="Not a tournament room")

    child_rooms = await room_service.get_child_rooms(code)
    return {
        "matches": [r.to_dict() for r in child_rooms],
        "count": len(child_rooms),
    }


@app.post("/api/rooms/{code}/start")
async def start_room(code: str, room: HostRoomDep):
    """Start the event (admin only)"""
    await room_service.set_room_status(code, "active")
    return {"status": "active"}


@app.post("/api/rooms/{code}/finish")
async def finish_room(code: str, room: HostRoomDep):
    """Finish the event (admin only)"""
    await room_service.set_room_status(code, "finished")
    leaderboard = await user_service.calculate_and_get_leaderboard(code)

    return {
        "status": "finished",
        "leaderboard": leaderboard,
    }


# ============================================================================
# Co-Host Endpoints
# ============================================================================

@app.post("/api/rooms/{code}/co-host")
async def add_co_host(code: str, room: PrimaryHostRoomDep, request: CoHostRequest):
    """Promote a participant to co-host (primary host only)"""
    user_id = request.user_id

    if user_id == room.host_id:
        raise HTTPException(status_code=400, detail="User is already the primary host")

    if user_id in room.co_host_ids:
        raise HTTPException(status_code=400, detail="User is already a co-host")

    # Verify user exists in this room
    user = await user_service.get_user(user_id)
    if not user or user.room_code != code:
        raise HTTPException(status_code=404, detail="User not found in this room")

    updated_co_hosts = room.co_host_ids + [user_id]
    updated_room = room.model_copy(update={"co_host_ids": updated_co_hosts})
    await room_service.update_room(updated_room)

    logger.info("CO_HOST_ADDED: room=%s user=%s", code, user_id)
    return {"status": "added", "userId": user_id, "coHostIds": updated_co_hosts}


@app.delete("/api/rooms/{code}/co-host/{user_id}")
async def remove_co_host(code: str, user_id: str, room: PrimaryHostRoomDep):
    """Remove a co-host (primary host only)"""
    if user_id not in room.co_host_ids:
        raise HTTPException(status_code=404, detail="User is not a co-host")

    updated_co_hosts = [uid for uid in room.co_host_ids if uid != user_id]
    updated_room = room.model_copy(update={"co_host_ids": updated_co_hosts})
    await room_service.update_room(updated_room)

    logger.info("CO_HOST_REMOVED: room=%s user=%s", code, user_id)
    return {"status": "removed", "userId": user_id, "coHostIds": updated_co_hosts}


# ============================================================================
# Bet Endpoints
# ============================================================================

@app.post("/api/rooms/{code}/bets")
async def create_bet(code: str, room: HostRoomDep, request: CreateBetRequest):
    """Create a new bet (admin only)

    Pass status="pending" to create in the bet queue without opening immediately.
    """
    try:
        existing_bets = await bet_service.get_bets_in_room(code)
        is_valid, error = game_logic.validate_bet_count(len(existing_bets), room.room_type)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)

        # Sanitize user inputs
        question = sanitize_input(request.question, 200)
        options = [sanitize_input(opt, 100) for opt in request.options]

        initial_status = request.status if request.status in ("open", "pending") else "open"

        bet = await bet_service.create_bet(
            room_code=code,
            question=question,
            options=options,
            points_value=request.pointsValue,
            bet_type=request.betType,
            created_from=request.createdFrom,
            template_id=request.templateId,
            timer_duration=request.timerDuration,
            initial_status=initial_status,
        )

        logger.info("BET_CREATED: room=%s bet=%s status=%s", code, bet.bet_id, initial_status)
        return bet.to_dict()

    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
    except Exception as e:
        logger.error("BET_CREATE_FAILED: room=%s error=%s", code, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/{bet_id}/open")
async def open_bet(code: str, bet_id: str, room: HostRoomDep):
    """Open a pending bet (move from queue to active) (admin only)"""
    try:
        # Verify bet belongs to this room before opening
        bet_check = await bet_service.get_bet(bet_id)
        if not bet_check or bet_check.room_code != code:
            raise HTTPException(status_code=404, detail="Bet not found in this room")

        bet = await bet_service.open_bet(bet_id)
        logger.info("BET_OPENED: room=%s bet=%s", code, bet_id)
        return bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("BET_OPEN_FAILED: room=%s bet=%s error=%s", code, bet_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to open bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/lock")
async def lock_bet(code: str, room: HostRoomDep, request: LockBetRequest):
    """Lock a bet (close betting) (admin only)"""
    try:
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
    """Resolve a bet (admin only)"""
    try:
        await bet_service.resolve_bet(bet_id, request.winning_option)
        leaderboard = await user_service.calculate_and_get_leaderboard(code)

        return {
            "status": "resolved",
            "leaderboard": leaderboard,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/{bet_id}/undo")
async def undo_resolve_bet(
    code: str,
    bet_id: str,
    room: HostRoomDep,
):
    """Undo a bet resolution within 10-second window (admin only)"""
    try:
        undone_bet = await bet_service.undo_resolve_bet(bet_id)
        return undone_bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to undo bet resolution: {str(e)}")


@app.delete("/api/rooms/{code}/bets/{bet_id}")
async def delete_bet(
    code: str,
    bet_id: str,
    room: HostRoomDep,
):
    """Delete an open bet, refunding all placed bets (admin only)"""
    try:
        await bet_service.delete_bet(bet_id)
        return {"status": "deleted", "betId": bet_id}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete bet: {str(e)}")


@app.put("/api/rooms/{code}/bets/{bet_id}")
async def edit_bet(
    code: str,
    bet_id: str,
    room: HostRoomDep,
    request: EditBetRequest,
):
    """Edit an open bet, resetting all votes and refunding points (admin only)"""
    try:
        updated_bet = await bet_service.edit_bet(
            bet_id=bet_id,
            question=request.question,
            options=request.options,
            points_value=request.pointsValue,
        )
        return updated_bet.to_dict()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to edit bet: {str(e)}")


@app.post("/api/rooms/{code}/bets/place")
async def place_bet(
    code: str,
    room: RoomDep,
    request: PlaceBetRequest,
    x_user_id: Annotated[str, Header(alias="X-User-Id")],
):
    """Place a bet"""
    try:
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
    """Get all bets in a room"""
    bets = await bet_service.get_bets_in_room(code)

    return {
        "bets": [bet.to_dict() for bet in bets],
        "count": len(bets),
    }


@app.get("/api/rooms/{code}/bets/{bet_id}")
async def get_bet(code: str, bet_id: str, room: RoomDep):
    """Get bet details"""
    bet = await bet_service.get_bet(bet_id)

    if not bet:
        raise HTTPException(status_code=404, detail=f"Bet not found: {bet_id}")

    if bet.room_code != code:
        raise HTTPException(status_code=400, detail="Bet does not belong to this room")

    return bet.to_dict()


# ============================================================================
# Tournament Aggregation
# ============================================================================

async def get_tournament_aggregated_leaderboard(tournament_code: str) -> list:
    """Aggregate leaderboard across tournament + all match rooms"""
    tournament_room_users = await room_service.get_room_users(tournament_code)
    child_rooms = await room_service.get_child_rooms(tournament_code)

    match_room_users_by_room = {}
    for child_room in child_rooms:
        match_users = await room_service.get_room_users(child_room.code)
        match_room_users_by_room[child_room.code] = match_users

    return game_logic.aggregate_tournament_leaderboard(
        tournament_room_users,
        match_room_users_by_room,
    )


@app.get("/api/rooms/{code}/tournament-stats")
async def get_tournament_stats(code: str, room: RoomDep):
    """Get detailed tournament stats with per-match breakdown"""
    if not room.is_tournament():
        raise HTTPException(status_code=400, detail="Not a tournament room")

    child_rooms = await room_service.get_child_rooms(code)

    # Aggregate per-user stats across all matches
    user_stats: dict = {}
    match_summaries = []

    for match_room in child_rooms:
        match_bets = await bet_service.get_bets_in_room(match_room.code)
        match_users = await room_service.get_room_users(match_room.code)

        resolved_bets = [b for b in match_bets if b.status.value == "resolved"]
        total_bets = len(resolved_bets)

        match_summaries.append({
            "roomCode": match_room.code,
            "title": match_room.event_name or "Match",
            "status": match_room.status,
            "teams": {
                "team1": match_room.match_details.team1 if match_room.match_details else None,
                "team2": match_room.match_details.team2 if match_room.match_details else None,
            },
            "totalBets": total_bets,
            "participants": len(match_users),
        })

        # Collect per-user per-match points for breakdown
        for mu in match_users:
            if mu.user_id not in user_stats:
                user_stats[mu.user_id] = {
                    "nickname": mu.nickname,
                    "matchBreakdown": {},
                    "totalBetsPlaced": 0,
                    "totalBetsWon": 0,
                }
            user_stats[mu.user_id]["matchBreakdown"][match_room.code] = mu.points

        # Count bets won/placed per user (batched query)
        resolved_bet_ids = [b.bet_id for b in resolved_bets]
        all_user_bets = await bet_service.get_user_bets_for_bets(resolved_bet_ids)
        for ub in all_user_bets:
            if ub.user_id in user_stats:
                user_stats[ub.user_id]["totalBetsPlaced"] += 1
                if ub.points_won is not None and ub.points_won > 0:
                    user_stats[ub.user_id]["totalBetsWon"] += 1

    return {
        "matches": match_summaries,
        "userStats": user_stats,
    }


# ============================================================================
# Transcript & Automation Endpoints
# ============================================================================

@app.post("/api/rooms/{code}/transcript")
async def ingest_transcript(
    code: str,
    room: RoomDep,
    request: TranscriptRequest,
):
    """Ingest transcript entry and trigger automation"""
    try:
        entry = await transcript_service.create_transcript_entry(
            room_code=code,
            text=request.text,
            source=request.source,
        )

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
    """Get recent transcript entries"""
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
    """Toggle automation on/off (admin only)"""
    try:
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
    """Health check endpoint with Firebase connectivity test"""
    try:
        from firebase_config import get_db
        db = get_db()
        # Quick read to verify Firestore is reachable
        db.collection("rooms").limit(1).get()
        return {"status": "healthy", "service": "smallbets-api", "firestore": "connected"}
    except Exception as e:
        logger.error("HEALTH_CHECK_FAILED: firestore error=%s", str(e))
        return {"status": "degraded", "service": "smallbets-api", "firestore": "error"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "SmallBets.live API",
        "version": "0.2.0",
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
