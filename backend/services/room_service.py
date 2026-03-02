"""Room service - Firestore operations for rooms

IMPERATIVE SHELL: This module performs I/O operations
- Delegates business logic to game_logic.py
- Handles Firestore reads/writes
- No business logic in this layer
"""

import random
from datetime import datetime, timedelta
from typing import Optional, List
from google.cloud import firestore

from models.room import Room, MatchDetails
from models.user import User
from models.room_user import RoomUser
import game_logic
from firebase_config import get_db


# Room code generation alphabet (excluding confusing characters)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


async def generate_room_code() -> str:
    """Generate unique 4-char room code (legacy)"""
    db = get_db()
    max_attempts = 10

    for _ in range(max_attempts):
        code = ''.join(random.choices(ALPHABET, k=4))
        room_ref = db.collection("rooms").document(code)
        room_doc = room_ref.get()

        if not room_doc.exists:
            return code

        room_data = room_doc.to_dict()
        expires_at = room_data.get("expiresAt")
        if expires_at and expires_at < datetime.utcnow():
            await delete_room(code)
            return code

    raise RuntimeError("Failed to generate unique room code after 10 attempts")


async def generate_room_code_v2() -> str:
    """Generate unique 6-char room code with checksum

    Format: XXXXXY where Y = checksum (sum of first 5 char indices mod 30)
    """
    db = get_db()
    max_attempts = 10

    for _ in range(max_attempts):
        code = game_logic.generate_room_code_v2()
        room_ref = db.collection("rooms").document(code)
        room_doc = room_ref.get()

        if not room_doc.exists:
            return code

    raise RuntimeError("Failed to generate unique room code after 10 attempts")


async def create_room(event_template: str, event_name: Optional[str], host_id: str) -> Room:
    """Create a new event room (legacy 4-char code, 24h expiry)"""
    db = get_db()
    code = await generate_room_code()

    room = Room(
        code=code,
        event_template=event_template,
        event_name=event_name,
        status="waiting",
        host_id=host_id,
        automation_enabled=True,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=24),
        room_type="event",
    )

    room_ref = db.collection("rooms").document(code)
    room_ref.set(room.to_dict())
    return room


async def create_tournament_room(
    event_template: str,
    event_name: Optional[str],
    host_id: str,
) -> Room:
    """Create a new tournament room (6-char code, no expiry)"""
    db = get_db()
    code = await generate_room_code_v2()

    room = Room(
        code=code,
        event_template=event_template,
        event_name=event_name,
        status="waiting",
        host_id=host_id,
        automation_enabled=False,
        created_at=datetime.utcnow(),
        expires_at=None,
        room_type="tournament",
        participants=[host_id],
        version=1,
    )

    room_ref = db.collection("rooms").document(code)
    room_ref.set(room.to_dict())
    return room


async def create_match_room(
    parent_room_code: str,
    host_id: str,
    team1: str,
    team2: str,
    match_date_time: str,
    venue: Optional[str] = None,
) -> Room:
    """Create a match room linked to a tournament"""
    db = get_db()

    # Validate parent tournament exists and is a tournament
    parent_room = await get_room(parent_room_code)
    if not parent_room:
        raise ValueError(f"Parent tournament not found: {parent_room_code}")
    if not parent_room.is_tournament():
        raise ValueError(f"Parent room is not a tournament: {parent_room_code}")

    code = await generate_room_code_v2()

    match_details = MatchDetails(
        team1=team1,
        team2=team2,
        match_date_time=match_date_time,
        venue=venue,
    )

    room = Room(
        code=code,
        event_template=parent_room.event_template,
        event_name=f"{team1} vs {team2}",
        status="active",
        host_id=host_id,
        automation_enabled=False,
        created_at=datetime.utcnow(),
        expires_at=None,
        room_type="match",
        parent_room_code=parent_room_code,
        participants=[host_id],
        match_details=match_details,
        version=1,
    )

    room_ref = db.collection("rooms").document(code)
    room_ref.set(room.to_dict())
    return room


async def get_room(code: str) -> Optional[Room]:
    """Get room by code"""
    db = get_db()
    room_ref = db.collection("rooms").document(code)
    room_doc = room_ref.get()

    if not room_doc.exists:
        return None

    room = Room.from_dict(room_doc.to_dict())
    return room


async def update_room(room: Room) -> None:
    """Update room in Firestore"""
    db = get_db()
    room_ref = db.collection("rooms").document(room.code)
    room_ref.set(room.to_dict())


async def delete_room(code: str) -> None:
    """Delete room and all associated data"""
    db = get_db()
    batch = db.batch()

    room_ref = db.collection("rooms").document(code)
    batch.delete(room_ref)

    users_ref = db.collection("users").where("roomCode", "==", code)
    for doc in users_ref.stream():
        batch.delete(doc.reference)

    bets_ref = db.collection("bets").where("roomCode", "==", code)
    for doc in bets_ref.stream():
        batch.delete(doc.reference)

    user_bets_ref = db.collection("userBets").where("roomCode", "==", code)
    for doc in user_bets_ref.stream():
        batch.delete(doc.reference)

    room_users_ref = db.collection("roomUsers").where("roomCode", "==", code)
    for doc in room_users_ref.stream():
        batch.delete(doc.reference)

    batch.commit()


async def get_room_participants(room_code: str) -> List[User]:
    """Get all participants in a room (legacy users collection)"""
    db = get_db()
    users_ref = db.collection("users").where("roomCode", "==", room_code)
    users_docs = users_ref.stream()
    users = [User.from_dict(doc.to_dict()) for doc in users_docs]
    return users


async def get_room_users(room_code: str) -> List[RoomUser]:
    """Get all room users for a room (new roomUsers collection)"""
    db = get_db()
    room_users_ref = db.collection("roomUsers").where("roomCode", "==", room_code)
    docs = room_users_ref.stream()
    return [RoomUser.from_dict(doc.to_dict()) for doc in docs]


async def get_room_user(room_code: str, user_id: str) -> Optional[RoomUser]:
    """Get a specific room user"""
    db = get_db()
    doc_id = f"{room_code}_{user_id}"
    doc_ref = db.collection("roomUsers").document(doc_id)
    doc = doc_ref.get()
    if not doc.exists:
        return None
    return RoomUser.from_dict(doc.to_dict())


async def create_room_user(
    room_code: str,
    user_id: str,
    nickname: str,
    is_host: bool = False,
) -> RoomUser:
    """Create a RoomUser record for per-room scoring"""
    db = get_db()
    doc_id = f"{room_code}_{user_id}"

    room_user = RoomUser(
        id=doc_id,
        room_code=room_code,
        user_id=user_id,
        nickname=nickname,
        points=game_logic.INITIAL_POINTS,
        joined_at=datetime.utcnow(),
        is_host=is_host,
    )

    doc_ref = db.collection("roomUsers").document(doc_id)
    doc_ref.set(room_user.to_dict())
    return room_user


async def add_participant(room_code: str, user_id: str) -> None:
    """Add a user to the room's participants array"""
    db = get_db()
    room_ref = db.collection("rooms").document(room_code)
    room_ref.update({
        "participants": firestore.ArrayUnion([user_id])
    })


async def get_child_rooms(parent_room_code: str) -> List[Room]:
    """Get all match rooms linked to a tournament"""
    db = get_db()
    rooms_ref = db.collection("rooms").where("parentRoomCode", "==", parent_room_code)
    docs = rooms_ref.stream()
    return [Room.from_dict(doc.to_dict()) for doc in docs]


async def set_room_status(room_code: str, status: str) -> None:
    """Update room status"""
    db = get_db()
    room_ref = db.collection("rooms").document(room_code)
    room_ref.update({"status": status})
