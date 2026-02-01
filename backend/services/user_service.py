"""User service - Firestore operations for users

IMPERATIVE SHELL: This module performs I/O operations
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict
from google.cloud import firestore

from models.user import User
import game_logic
from firebase_config import get_db


async def create_user(room_code: str, nickname: str, is_admin: bool = False) -> User:
    """Create a new user

    Imperative Shell - performs Firestore write

    Args:
        room_code: Room code user is joining
        nickname: User's display name
        is_admin: Whether user is room admin

    Returns:
        Created User object

    Raises:
        ValueError: If nickname validation fails
    """
    # Validate nickname (pure)
    is_valid, error = game_logic.validate_nickname(nickname)
    if not is_valid:
        raise ValueError(error)

    db = get_db()

    # Generate unique user ID
    user_id = str(uuid.uuid4())

    # Create user object (pure)
    user = User(
        user_id=user_id,
        room_code=room_code,
        nickname=nickname,
        points=game_logic.INITIAL_POINTS,
        is_admin=is_admin,
        joined_at=datetime.utcnow(),
    )

    # Write to Firestore (I/O)
    user_ref = db.collection("users").document(user_id)
    user_ref.set(user.to_dict())

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

    Imperative Shell - performs Firestore write

    Args:
        user: User object to update
    """
    db = get_db()

    # Write to Firestore (I/O)
    user_ref = db.collection("users").document(user.user_id)
    user_ref.set(user.to_dict())


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
