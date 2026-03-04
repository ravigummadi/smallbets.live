"""User service - Firestore operations for users

IMPERATIVE SHELL: This module performs I/O operations
"""

import logging
import random
import string
import uuid
from datetime import datetime
from typing import Optional, List, Dict
from google.cloud import firestore

from models.user import User
import game_logic
from firebase_config import get_db


logger = logging.getLogger(__name__)

# Base32-crockford alphabet (excludes ambiguous chars: 0, O, I, L, 1)
USER_KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
USER_KEY_LENGTH = 8
MAX_KEY_RETRIES = 5


def generate_user_key() -> str:
    """Generate an 8-character unique user key using base32-crockford alphabet.

    Pure function - no I/O operations.
    ~1.1 trillion possible keys.

    Returns:
        8-character random string
    """
    return "".join(random.choices(USER_KEY_ALPHABET, k=USER_KEY_LENGTH))


async def create_user(room_code: str, nickname: str, is_admin: bool = False) -> User:
    """Create a new user with a unique user_key

    Imperative Shell - performs Firestore write

    Args:
        room_code: Room code user is joining
        nickname: User's display name
        is_admin: Whether user is room admin

    Returns:
        Created User object

    Raises:
        ValueError: If nickname validation fails or key generation fails
    """
    # Validate nickname (pure)
    is_valid, error = game_logic.validate_nickname(nickname)
    if not is_valid:
        raise ValueError(error)

    db = get_db()

    # Generate unique user ID
    user_id = str(uuid.uuid4())

    # Generate unique user key with collision retry
    user_key = None
    for attempt in range(MAX_KEY_RETRIES):
        candidate_key = generate_user_key()
        # Check for collision within this room
        existing = await get_user_by_key(room_code, candidate_key)
        if existing is None:
            user_key = candidate_key
            break
        logger.warning(
            "USERKEY_COLLISION: room=%s attempt=%d key=%s",
            room_code, attempt + 1, candidate_key,
        )

    if user_key is None:
        raise ValueError("Failed to generate unique user key after retries")

    # Create user object (pure)
    user = User(
        user_id=user_id,
        room_code=room_code,
        nickname=nickname,
        points=game_logic.INITIAL_POINTS,
        is_admin=is_admin,
        joined_at=datetime.utcnow(),
        user_key=user_key,
    )

    # Write to Firestore with key included (I/O)
    user_ref = db.collection("users").document(user_id)
    user_ref.set(user.to_dict(include_key=True))

    return user


async def get_user(user_id: str) -> Optional[User]:
    """Get user by ID

    Imperative Shell - performs Firestore read

    Args:
        user_id: User ID

    Returns:
        User object or None if not found
    """
    db = get_db()

    # Read from Firestore (I/O)
    user_ref = db.collection("users").document(user_id)
    user_doc = user_ref.get()

    if not user_doc.exists:
        return None

    # Deserialize (pure)
    user = User.from_dict(user_doc.to_dict())
    return user


async def get_users_in_room(room_code: str) -> List[User]:
    """Get all users in a room

    Imperative Shell - performs Firestore query

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


async def find_user_by_nickname(room_code: str, nickname: str) -> Optional[User]:
    """Find a user in a room by nickname

    Imperative Shell - performs Firestore query

    Args:
        room_code: Room code
        nickname: Nickname to search for

    Returns:
        User object or None if not found
    """
    db = get_db()

    users_ref = (
        db.collection("users")
        .where("roomCode", "==", room_code)
        .where("nickname", "==", nickname)
    )
    docs = list(users_ref.stream())

    if docs:
        return User.from_dict(docs[0].to_dict())
    return None


async def update_user_points(user_id: str, points: int) -> None:
    """Update user's point balance

    Imperative Shell - performs Firestore update

    Args:
        user_id: User ID
        points: New point balance
    """
    db = get_db()

    # Update Firestore (I/O)
    user_ref = db.collection("users").document(user_id)
    user_ref.update({"points": points})


async def update_user(user: User) -> None:
    """Update user in Firestore

    Imperative Shell - performs Firestore write.
    Uses include_key=True to preserve userKey on full writes.

    Args:
        user: User object to update
    """
    db = get_db()

    # Write to Firestore with key included (I/O)
    user_ref = db.collection("users").document(user.user_id)
    user_ref.set(user.to_dict(include_key=True))


async def get_users_by_ids(user_ids: List[str]) -> Dict[str, User]:
    """Get multiple users by IDs

    Imperative Shell - performs Firestore batch read

    Args:
        user_ids: List of user IDs

    Returns:
        Dictionary mapping user_id to User object
    """
    if not user_ids:
        return {}

    db = get_db()
    users_dict = {}

    # Batch read from Firestore (I/O)
    for user_id in user_ids:
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()

        if user_doc.exists:
            user = User.from_dict(user_doc.to_dict())
            users_dict[user_id] = user

    return users_dict


async def get_user_by_key(room_code: str, user_key: str) -> Optional[User]:
    """Look up a user by their unique userKey within a room

    Imperative Shell - performs Firestore query using composite index

    Args:
        room_code: Room code
        user_key: 8-character unique user key

    Returns:
        User object or None if not found
    """
    db = get_db()

    users_ref = (
        db.collection("users")
        .where("roomCode", "==", room_code)
        .where("userKey", "==", user_key)
    )
    docs = list(users_ref.stream())

    if docs:
        return User.from_dict(docs[0].to_dict())
    return None


async def ensure_user_has_key(user: User) -> User:
    """Ensure a user has a userKey, backfilling if needed

    Imperative Shell - may perform Firestore write for backfill

    Args:
        user: User object to check/backfill

    Returns:
        User with userKey (original or backfilled)
    """
    if user.user_key is not None:
        return user

    db = get_db()

    # Generate unique key with collision retry
    user_key = None
    for attempt in range(MAX_KEY_RETRIES):
        candidate_key = generate_user_key()
        existing = await get_user_by_key(user.room_code, candidate_key)
        if existing is None:
            user_key = candidate_key
            break
        logger.warning(
            "USERKEY_COLLISION_BACKFILL: room=%s user=%s attempt=%d key=%s",
            user.room_code, user.user_id, attempt + 1, candidate_key,
        )

    if user_key is None:
        logger.error(
            "KEY_GENERATION_FAILED: room=%s user=%s",
            user.room_code, user.user_id,
        )
        raise ValueError("Failed to generate unique user key after retries")

    # Update user with new key using field-level update to avoid overwriting
    user_ref = db.collection("users").document(user.user_id)
    user_ref.update({"userKey": user_key})

    # Return updated user object
    return user.model_copy(update={"user_key": user_key})


async def calculate_and_get_leaderboard(room_code: str) -> List[Dict]:
    """Calculate leaderboard for a room

    Imperative Shell - performs Firestore read, delegates calculation to game_logic

    Args:
        room_code: Room code

    Returns:
        Sorted leaderboard data
    """
    # Get all users in room (I/O)
    users = await get_users_in_room(room_code)

    # Build users dict for game_logic (pure conversion)
    users_dict = {user.user_id: user for user in users}

    # Calculate leaderboard (pure - delegates to game_logic)
    leaderboard = game_logic.calculate_leaderboard(users_dict)

    return leaderboard
