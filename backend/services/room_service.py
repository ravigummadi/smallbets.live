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

from models.room import Room
from models.user import User
import game_logic
from firebase_config import get_db


# Room code generation alphabet (excluding confusing characters)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


async def generate_room_code() -> str:
    """Generate unique room code

    Imperative Shell - performs database reads to check uniqueness

    Returns:
        4-character room code
    """
    db = get_db()
    max_attempts = 10

    for _ in range(max_attempts):
        # Generate random 4-character code
        code = ''.join(random.choices(ALPHABET, k=4))

        # Check if code exists in Firestore
        room_ref = db.collection("rooms").document(code)
        room_doc = room_ref.get()

        if not room_doc.exists:
            return code

        # If code exists but is expired, recycle it
        room_data = room_doc.to_dict()
        expires_at = room_data.get("expiresAt")
        if expires_at and expires_at < datetime.utcnow():
            # Delete expired room and reuse code
            await delete_room(code)
            return code

    # Fallback - should be extremely rare
    raise RuntimeError("Failed to generate unique room code after 10 attempts")


async def create_room(event_template: str, event_name: Optional[str], host_id: str) -> Room:
    """Create a new room

    Imperative Shell - performs Firestore write

    Args:
        event_template: Event template ID
        event_name: Custom event name (for custom events)
        host_id: User ID of room host

    Returns:
        Created Room object
    """
    db = get_db()

    # Generate unique code
    code = await generate_room_code()

    # Create room object (pure)
    room = Room(
        code=code,
        event_template=event_template,
        event_name=event_name,
        status="waiting",
        host_id=host_id,
        automation_enabled=True,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )

    # Write to Firestore (I/O)
    room_ref = db.collection("rooms").document(code)
    room_ref.set(room.to_dict())

    return room


async def get_room(code: str) -> Optional[Room]:
    """Get room by code

    Imperative Shell - performs Firestore read

    Args:
        code: Room code

    Returns:
        Room object or None if not found
    """
    db = get_db()

    # Read from Firestore (I/O)
    room_ref = db.collection("rooms").document(code)
    room_doc = room_ref.get()

    if not room_doc.exists:
        return None

    # Deserialize (pure)
    room = Room.from_dict(room_doc.to_dict())
    return room


async def update_room(room: Room) -> None:
    """Update room in Firestore

    Imperative Shell - performs Firestore write

    Args:
        room: Room object to update
    """
    db = get_db()

    # Write to Firestore (I/O)
    room_ref = db.collection("rooms").document(room.code)
    room_ref.set(room.to_dict())


async def delete_room(code: str) -> None:
    """Delete room and all associated data

    Imperative Shell - performs Firestore deletes

    Args:
        code: Room code
    """
    db = get_db()
    batch = db.batch()

    # Delete room document
    room_ref = db.collection("rooms").document(code)
    batch.delete(room_ref)

    # Delete all users in room
    users_ref = db.collection("users").where("roomCode", "==", code)
    for doc in users_ref.stream():
        batch.delete(doc.reference)

    # Delete all bets in room
    bets_ref = db.collection("bets").where("roomCode", "==", code)
    for doc in bets_ref.stream():
        batch.delete(doc.reference)

    # Delete all user bets in room
    user_bets_ref = db.collection("userBets").where("roomCode", "==", code)
    for doc in user_bets_ref.stream():
        batch.delete(doc.reference)

    # Commit batch
    batch.commit()


async def get_room_participants(room_code: str) -> List[User]:
    """Get all participants in a room

    Imperative Shell - performs Firestore read

    Args:
        room_code: Room code

    Returns:
        List of User objects
    """
    db = get_db()

    # Query Firestore (I/O)
    users_ref = db.collection("users").where("roomCode", "==", room_code)
    users_docs = users_ref.stream()

    # Deserialize (pure)
    users = [User.from_dict(doc.to_dict()) for doc in users_docs]
    return users


async def set_room_status(room_code: str, status: str) -> None:
    """Update room status

    Imperative Shell - performs Firestore update

    Args:
        room_code: Room code
        status: New status (waiting|active|finished)
    """
    db = get_db()

    # Update Firestore (I/O)
    room_ref = db.collection("rooms").document(room_code)
    room_ref.update({"status": status})


