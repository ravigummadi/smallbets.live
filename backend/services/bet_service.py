"""Bet service - Firestore operations for bets

IMPERATIVE SHELL: This module performs I/O operations
- Delegates business logic to game_logic.py
"""

import uuid
from datetime import datetime
from typing import Optional, List
from google.cloud import firestore

from models.bet import Bet, BetStatus
from models.user_bet import UserBet
from models.user import User
import game_logic
from firebase_config import get_db
from services import user_service


async def create_bet(
    room_code: str,
    question: str,
    options: List[str],
    points_value: int,
    resolve_patterns: Optional[List[str]] = None,
) -> Bet:
    """Create a new bet

    Imperative Shell - performs Firestore write

    Args:
        room_code: Room code
        question: Betting question
        options: List of betting options
        points_value: Points required to place this bet
        resolve_patterns: Patterns that indicate winner announcement (for automation)

    Returns:
        Created Bet object
    """
    db = get_db()

    # Generate unique bet ID
    bet_id = str(uuid.uuid4())

    # Create bet object (pure)
    bet = Bet(
        bet_id=bet_id,
        room_code=room_code,
        question=question,
        options=options,
        status=BetStatus.OPEN,
        points_value=points_value,
        resolve_patterns=resolve_patterns,
    )

    # Write to Firestore (I/O)
    bet_ref = db.collection("bets").document(bet_id)
    bet_ref.set(bet.to_dict())

    return bet


async def get_bet(bet_id: str) -> Optional[Bet]:
    """Get bet by ID

    Imperative Shell - performs Firestore read

    Args:
        bet_id: Bet ID

    Returns:
        Bet object or None if not found
    """
    db = get_db()

    # Read from Firestore (I/O)
    bet_ref = db.collection("bets").document(bet_id)
    bet_doc = bet_ref.get()

    if not bet_doc.exists:
        return None

    # Deserialize (pure)
    bet = Bet.from_dict(bet_doc.to_dict())
    return bet


async def get_bets_in_room(room_code: str) -> List[Bet]:
    """Get all bets in a room

    Imperative Shell - performs Firestore query

    Args:
        room_code: Room code

    Returns:
        List of Bet objects
    """
    db = get_db()

    # Query Firestore (I/O)
    bets_ref = db.collection("bets").where("roomCode", "==", room_code)
    bets_docs = bets_ref.stream()

    # Deserialize (pure)
    bets = [Bet.from_dict(doc.to_dict()) for doc in bets_docs]
    return bets


async def update_bet(bet: Bet) -> None:
    """Update bet in Firestore

    Imperative Shell - performs Firestore write

    Args:
        bet: Bet object to update
    """
    db = get_db()

    # Write to Firestore (I/O)
    bet_ref = db.collection("bets").document(bet.bet_id)
    bet_ref.set(bet.to_dict())


async def lock_bet(bet_id: str) -> Bet:
    """Lock a bet (close betting)

    Imperative Shell - performs Firestore read/write

    Args:
        bet_id: Bet ID

    Returns:
        Updated Bet object
    """
    # Get bet (I/O)
    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    # Lock bet (pure - immutable update)
    locked_bet = bet.lock_bet()

    # Save to Firestore (I/O)
    await update_bet(locked_bet)

    return locked_bet


async def resolve_bet(bet_id: str, winning_option: str) -> None:
    """Resolve a bet and distribute points

    Imperative Shell - orchestrates I/O operations, delegates logic to game_logic

    Args:
        bet_id: Bet ID
        winning_option: The winning option

    Raises:
        ValueError: If bet not found or invalid winning option
    """
    db = get_db()

    # Get bet (I/O)
    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    # Resolve bet (pure - immutable update)
    resolved_bet = bet.resolve_bet(winning_option)

    # Get all user bets for this bet (I/O)
    user_bets = await get_user_bets_for_bet(bet_id)

    # Get all users who bet (I/O)
    user_ids = [ub.user_id for ub in user_bets]
    users = await user_service.get_users_by_ids(user_ids)

    # Calculate scores (pure - delegates to game_logic)
    scores = game_logic.calculate_scores(user_bets, users, winning_option, bet.points_value)

    # Update user points and user bets in batch (I/O)
    batch = db.batch()

    for user_id, points_won in scores.items():
        # Update user points
        user = users[user_id]
        # Points were already deducted at bet placement; only add winnings/refund here.
        new_points = user.points + points_won

        user_ref = db.collection("users").document(user_id)
        batch.update(user_ref, {"points": new_points})

        # Update user bet with points won
        user_bet = next(ub for ub in user_bets if ub.user_id == user_id)
        updated_user_bet = user_bet.with_points_won(points_won)

        user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
        batch.set(user_bet_ref, updated_user_bet.to_dict())

    # Update bet status
    bet_ref = db.collection("bets").document(bet_id)
    batch.set(bet_ref, resolved_bet.to_dict())

    # Commit batch
    batch.commit()


async def place_user_bet(
    user_id: str,
    bet_id: str,
    selected_option: str,
) -> UserBet:
    """Place a user's bet

    Imperative Shell - orchestrates I/O and validation

    Args:
        user_id: User ID
        bet_id: Bet ID
        selected_option: User's selected option

    Returns:
        Created UserBet object

    Raises:
        ValueError: If validation fails
    """
    db = get_db()

    # Get user and bet (I/O)
    user = await user_service.get_user(user_id)
    if not user:
        raise ValueError(f"User not found: {user_id}")

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    # Check if user already bet (I/O)
    existing_bet = await get_user_bet(user_id, bet_id)

    # Validate eligibility (pure - delegates to game_logic)
    is_valid, error = game_logic.validate_bet_eligibility(
        user, bet, existing_bet, bet.points_value
    )
    if not is_valid:
        raise ValueError(error)

    # Validate selected option
    if selected_option not in bet.options:
        raise ValueError(f"Invalid option: {selected_option}")

    # Create user bet (pure)
    user_bet = UserBet(
        user_id=user_id,
        bet_id=bet_id,
        room_code=bet.room_code,
        selected_option=selected_option,
        placed_at=datetime.utcnow(),
    )

    # Deduct points from user (pure - immutable update)
    updated_user = user.subtract_points(bet.points_value)

    # Save to Firestore in batch (I/O)
    batch = db.batch()

    # Save user bet
    user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
    batch.set(user_bet_ref, user_bet.to_dict())

    # Update user points
    user_ref = db.collection("users").document(user_id)
    batch.set(user_ref, updated_user.to_dict())

    batch.commit()

    return user_bet


async def get_user_bet(user_id: str, bet_id: str) -> Optional[UserBet]:
    """Get user's bet for a specific bet

    Imperative Shell - performs Firestore read

    Args:
        user_id: User ID
        bet_id: Bet ID

    Returns:
        UserBet object or None if not found
    """
    db = get_db()

    # Read from Firestore (I/O)
    user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
    user_bet_doc = user_bet_ref.get()

    if not user_bet_doc.exists:
        return None

    # Deserialize (pure)
    user_bet = UserBet.from_dict(user_bet_doc.to_dict())
    return user_bet


async def get_user_bets_for_bet(bet_id: str) -> List[UserBet]:
    """Get all user bets for a specific bet

    Imperative Shell - performs Firestore query

    Args:
        bet_id: Bet ID

    Returns:
        List of UserBet objects
    """
    db = get_db()

    # Query Firestore (I/O)
    user_bets_ref = db.collection("userBets").where("betId", "==", bet_id)
    user_bets_docs = user_bets_ref.stream()

    # Deserialize (pure)
    user_bets = [UserBet.from_dict(doc.to_dict()) for doc in user_bets_docs]
    return user_bets
