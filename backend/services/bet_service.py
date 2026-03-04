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
from models.room_user import RoomUser
import game_logic
from firebase_config import get_db
from services import user_service, room_service


async def create_bet(
    room_code: str,
    question: str,
    options: List[str],
    points_value: int,
    resolve_patterns: Optional[List[str]] = None,
    bet_type: str = "in-game",
    created_from: str = "custom",
    template_id: Optional[str] = None,
    timer_duration: int = 60,
) -> Bet:
    """Create a new bet"""
    db = get_db()
    bet_id = str(uuid.uuid4())

    bet = Bet(
        bet_id=bet_id,
        room_code=room_code,
        question=question,
        options=options,
        status=BetStatus.OPEN,
        points_value=points_value,
        resolve_patterns=resolve_patterns,
        bet_type=bet_type,
        created_from=created_from,
        template_id=template_id,
        timer_duration=timer_duration,
    )

    bet_ref = db.collection("bets").document(bet_id)
    bet_ref.set(bet.to_dict())
    return bet


async def get_bet(bet_id: str) -> Optional[Bet]:
    """Get bet by ID"""
    db = get_db()
    bet_ref = db.collection("bets").document(bet_id)
    bet_doc = bet_ref.get()

    if not bet_doc.exists:
        return None

    bet = Bet.from_dict(bet_doc.to_dict())
    return bet


async def get_bets_in_room(room_code: str) -> List[Bet]:
    """Get all bets in a room"""
    db = get_db()
    bets_ref = db.collection("bets").where("roomCode", "==", room_code)
    bets_docs = bets_ref.stream()
    bets = [Bet.from_dict(doc.to_dict()) for doc in bets_docs]
    return bets


async def update_bet(bet: Bet) -> None:
    """Update bet in Firestore"""
    db = get_db()
    bet_ref = db.collection("bets").document(bet.bet_id)
    bet_ref.set(bet.to_dict())


async def lock_bet(bet_id: str) -> Bet:
    """Lock a bet (close betting)"""
    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    locked_bet = bet.lock_bet()
    await update_bet(locked_bet)
    return locked_bet


async def resolve_bet(bet_id: str, winning_option: str) -> None:
    """Resolve a bet and distribute points

    Uses RoomUser for point updates if they exist, falls back to legacy User collection.
    """
    db = get_db()

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    # Resolve bet with 10s undo window
    resolved_bet = bet.resolve_bet(winning_option)

    # Get all user bets for this bet
    user_bets = await get_user_bets_for_bet(bet_id)

    # Get all users who bet
    user_ids = [ub.user_id for ub in user_bets]
    users = await user_service.get_users_by_ids(user_ids)

    # Calculate scores (pure - delegates to game_logic)
    scores = game_logic.calculate_scores(user_bets, users, winning_option, bet.points_value)

    # Update user points and user bets in batch
    batch = db.batch()

    for user_id, points_won in scores.items():
        user = users[user_id]
        new_points = user.points + points_won

        user_ref = db.collection("users").document(user_id)
        batch.update(user_ref, {"points": new_points})

        # Also update roomUsers if exists
        room_user_doc_id = f"{bet.room_code}_{user_id}"
        room_user_ref = db.collection("roomUsers").document(room_user_doc_id)
        room_user_doc = room_user_ref.get()
        if room_user_doc.exists:
            ru_data = room_user_doc.to_dict()
            ru_new_points = ru_data["points"] + points_won
            batch.update(room_user_ref, {"points": ru_new_points})

        # Update user bet with points won
        user_bet = next(ub for ub in user_bets if ub.user_id == user_id)
        updated_user_bet = user_bet.with_points_won(points_won)

        user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
        batch.set(user_bet_ref, updated_user_bet.to_dict())

    # Update bet status
    bet_ref = db.collection("bets").document(bet_id)
    batch.set(bet_ref, resolved_bet.to_dict())

    batch.commit()


async def undo_resolve_bet(bet_id: str) -> Bet:
    """Undo a bet resolution (within 10s window)

    Reverts bet to locked status and reverses point changes.
    """
    db = get_db()

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    if not bet.can_undo():
        raise ValueError("Cannot undo: undo window has expired or bet is not resolved")

    # Get user bets to reverse point changes
    user_bets = await get_user_bets_for_bet(bet_id)

    batch = db.batch()

    for ub in user_bets:
        if ub.points_won is not None:
            # Reverse the points: subtract what was won during resolution.
            # The original bet cost (deducted at placement) stays deducted.
            user = await user_service.get_user(ub.user_id)
            if user:
                new_points = user.points - ub.points_won
                user_ref = db.collection("users").document(ub.user_id)
                batch.update(user_ref, {"points": new_points})

                # Also update roomUsers if exists
                room_user_doc_id = f"{bet.room_code}_{ub.user_id}"
                room_user_ref = db.collection("roomUsers").document(room_user_doc_id)
                room_user_doc = room_user_ref.get()
                if room_user_doc.exists:
                    ru_data = room_user_doc.to_dict()
                    ru_new_points = ru_data["points"] - ub.points_won
                    batch.update(room_user_ref, {"points": ru_new_points})

            # Reset user bet points_won
            updated_ub = ub.with_points_won(None)
            ub_ref = db.collection("userBets").document(f"{bet_id}_{ub.user_id}")
            batch.set(ub_ref, updated_ub.to_dict())

    # Revert bet to locked
    undone_bet = bet.undo_resolve()
    bet_ref = db.collection("bets").document(bet_id)
    batch.set(bet_ref, undone_bet.to_dict())

    batch.commit()
    return undone_bet


async def place_user_bet(
    user_id: str,
    bet_id: str,
    selected_option: str,
) -> UserBet:
    """Place a user's bet"""
    db = get_db()

    user = await user_service.get_user(user_id)
    if not user:
        raise ValueError(f"User not found: {user_id}")

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    existing_bet = await get_user_bet(user_id, bet_id)

    # Validate eligibility
    is_valid, error = game_logic.validate_bet_eligibility(
        user, bet, existing_bet, bet.points_value
    )
    if not is_valid:
        raise ValueError(error)

    if selected_option not in bet.options:
        raise ValueError(f"Invalid option: {selected_option}")

    user_bet = UserBet(
        user_id=user_id,
        bet_id=bet_id,
        room_code=bet.room_code,
        selected_option=selected_option,
        placed_at=datetime.utcnow(),
    )

    updated_user = user.subtract_points(bet.points_value)

    batch = db.batch()

    user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
    batch.set(user_bet_ref, user_bet.to_dict())

    user_ref = db.collection("users").document(user_id)
    batch.set(user_ref, updated_user.to_dict())

    # Also update roomUsers if exists
    room_user_doc_id = f"{bet.room_code}_{user_id}"
    room_user_ref = db.collection("roomUsers").document(room_user_doc_id)
    room_user_doc = room_user_ref.get()
    if room_user_doc.exists:
        ru = RoomUser.from_dict(room_user_doc.to_dict())
        updated_ru = ru.subtract_points(bet.points_value)
        batch.set(room_user_ref, updated_ru.to_dict())

    batch.commit()
    return user_bet


async def get_user_bet(user_id: str, bet_id: str) -> Optional[UserBet]:
    """Get user's bet for a specific bet"""
    db = get_db()
    user_bet_ref = db.collection("userBets").document(f"{bet_id}_{user_id}")
    user_bet_doc = user_bet_ref.get()

    if not user_bet_doc.exists:
        return None

    user_bet = UserBet.from_dict(user_bet_doc.to_dict())
    return user_bet


async def get_user_bets_for_bet(bet_id: str) -> List[UserBet]:
    """Get all user bets for a specific bet"""
    db = get_db()
    user_bets_ref = db.collection("userBets").where("betId", "==", bet_id)
    user_bets_docs = user_bets_ref.stream()
    user_bets = [UserBet.from_dict(doc.to_dict()) for doc in user_bets_docs]
    return user_bets


async def delete_bet(bet_id: str) -> None:
    """Delete an open bet, refunding points to all users who placed bets.

    Only OPEN bets can be deleted. Closed/resolved bets cannot be deleted.
    """
    db = get_db()

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    if bet.status != BetStatus.OPEN:
        raise ValueError("Only open bets can be deleted")

    user_bets = await get_user_bets_for_bet(bet_id)

    batch = db.batch()

    # Refund points to each user who placed a bet
    for ub in user_bets:
        user = await user_service.get_user(ub.user_id)
        if user:
            new_points = user.points + bet.points_value
            user_ref = db.collection("users").document(ub.user_id)
            batch.update(user_ref, {"points": new_points})

            # Also update roomUsers if exists
            room_user_doc_id = f"{bet.room_code}_{ub.user_id}"
            room_user_ref = db.collection("roomUsers").document(room_user_doc_id)
            room_user_doc = room_user_ref.get()
            if room_user_doc.exists:
                ru_data = room_user_doc.to_dict()
                ru_new_points = ru_data["points"] + bet.points_value
                batch.update(room_user_ref, {"points": ru_new_points})

        # Delete the user bet document
        ub_ref = db.collection("userBets").document(f"{bet_id}_{ub.user_id}")
        batch.delete(ub_ref)

    # Delete the bet document
    bet_ref = db.collection("bets").document(bet_id)
    batch.delete(bet_ref)

    batch.commit()


async def edit_bet(
    bet_id: str,
    question: Optional[str] = None,
    options: Optional[List[str]] = None,
    points_value: Optional[int] = None,
) -> Bet:
    """Edit an open bet. Resets all votes and refunds points to users.

    Only OPEN bets can be edited. Any edit resets all existing user bets
    and refunds their points.
    """
    db = get_db()

    bet = await get_bet(bet_id)
    if not bet:
        raise ValueError(f"Bet not found: {bet_id}")

    if bet.status != BetStatus.OPEN:
        raise ValueError("Only open bets can be edited")

    # Get existing user bets to refund
    user_bets = await get_user_bets_for_bet(bet_id)

    batch = db.batch()

    # Refund points and delete user bets
    for ub in user_bets:
        user = await user_service.get_user(ub.user_id)
        if user:
            new_points = user.points + bet.points_value
            user_ref = db.collection("users").document(ub.user_id)
            batch.update(user_ref, {"points": new_points})

            # Also update roomUsers if exists
            room_user_doc_id = f"{bet.room_code}_{ub.user_id}"
            room_user_ref = db.collection("roomUsers").document(room_user_doc_id)
            room_user_doc = room_user_ref.get()
            if room_user_doc.exists:
                ru_data = room_user_doc.to_dict()
                ru_new_points = ru_data["points"] + bet.points_value
                batch.update(room_user_ref, {"points": ru_new_points})

        # Delete the user bet document
        ub_ref = db.collection("userBets").document(f"{bet_id}_{ub.user_id}")
        batch.delete(ub_ref)

    # Apply edits to the bet
    updates = {}
    if question is not None:
        updates["question"] = question
    if options is not None:
        updates["options"] = options
    if points_value is not None:
        updates["points_value"] = points_value
    # Bump version
    updates["version"] = bet.version + 1

    updated_bet = bet.model_copy(update=updates)

    bet_ref = db.collection("bets").document(bet_id)
    batch.set(bet_ref, updated_bet.to_dict())

    batch.commit()
    return updated_bet
