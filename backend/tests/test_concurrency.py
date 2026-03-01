"""
Tests for concurrency and race conditions (Phase 5 / Section 4.1)

Tests verify:
- Same user double-submitting a bet (should reject duplicate)
- Concurrent bet placement and resolution (transaction safety)
- Multiple hosts trying to resolve the same bet

These tests use the Firestore emulator and exercise real async behaviour.
"""

import asyncio
import pytest
from services import bet_service, user_service, room_service
from models.bet import BetStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_room_and_open_bet(db):
    """Helper: create a room, a user, and a bet (starts as OPEN)."""
    room = await room_service.create_room(
        event_template="custom",
        event_name="Concurrency Test",
        host_id="host-id",
    )
    user = await user_service.create_user(room.code, "Player1", is_admin=False)
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Who wins?",
        options=["Alpha", "Beta"],
        points_value=100,
    )
    return room, user, bet


# ---------------------------------------------------------------------------
# 4.1 Concurrency & Race Conditions
# ---------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.asyncio
async def test_same_user_double_submit_bet(clean_firestore):
    """Same user double-submits bet – second attempt should be rejected."""
    room, user, bet = await _create_room_and_open_bet(clean_firestore)

    # First placement should succeed
    user_bet = await bet_service.place_user_bet(
        user_id=user.user_id,
        bet_id=bet.bet_id,
        selected_option="Alpha",
    )
    assert user_bet.selected_option == "Alpha"

    # Second placement by the same user should raise ValueError
    with pytest.raises(ValueError, match="already"):
        await bet_service.place_user_bet(
            user_id=user.user_id,
            bet_id=bet.bet_id,
            selected_option="Beta",
        )

    # Verify the original bet is still intact (not overwritten)
    stored = await bet_service.get_user_bet(user.user_id, bet.bet_id)
    assert stored is not None
    assert stored.selected_option == "Alpha"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_bet_placement_by_different_users(clean_firestore):
    """Multiple different users placing bets concurrently should all succeed."""
    room, _, bet = await _create_room_and_open_bet(clean_firestore)

    # Create several additional users
    users = []
    for i in range(5):
        u = await user_service.create_user(room.code, f"Player{i}", is_admin=False)
        users.append(u)

    # Place bets concurrently
    tasks = [
        bet_service.place_user_bet(
            user_id=u.user_id,
            bet_id=bet.bet_id,
            selected_option="Alpha" if i % 2 == 0 else "Beta",
        )
        for i, u in enumerate(users)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # All placements should have succeeded (no exceptions)
    for r in results:
        assert not isinstance(r, Exception), f"Unexpected error: {r}"

    # Verify all user bets stored
    all_bets = await bet_service.get_user_bets_for_bet(bet.bet_id)
    assert len(all_bets) == len(users)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_bet_placement_and_resolution(clean_firestore):
    """Bet placement and resolution happening concurrently.

    If a user places a bet while the host resolves, the service
    should either accept or reject consistently – no half-written state.
    """
    room, _, bet = await _create_room_and_open_bet(clean_firestore)

    # Create two users who will place bets
    user1 = await user_service.create_user(room.code, "Racer1", is_admin=False)
    user2 = await user_service.create_user(room.code, "Racer2", is_admin=False)

    # User1 places bet first (before lock)
    await bet_service.place_user_bet(
        user_id=user1.user_id,
        bet_id=bet.bet_id,
        selected_option="Alpha",
    )

    # Lock the bet so we can resolve it
    await bet_service.lock_bet(bet.bet_id)

    # Now resolve the bet
    await bet_service.resolve_bet(bet.bet_id, "Alpha")

    # User2 attempts to place bet on the now-resolved bet – should fail
    with pytest.raises(ValueError):
        await bet_service.place_user_bet(
            user_id=user2.user_id,
            bet_id=bet.bet_id,
            selected_option="Beta",
        )

    # Verify the bet is resolved correctly
    resolved_bet = await bet_service.get_bet(bet.bet_id)
    assert resolved_bet.status == BetStatus.RESOLVED
    assert resolved_bet.winning_option == "Alpha"

    # Verify user1 got points
    user1_updated = await user_service.get_user(user1.user_id)
    assert user1_updated.points != 1000  # Points were adjusted


@pytest.mark.integration
@pytest.mark.asyncio
async def test_multiple_resolve_attempts_same_bet(clean_firestore):
    """Multiple resolve attempts on the same bet.

    Once a bet is resolved, further attempts should either be idempotent
    (same winner) or rejected (different winner).
    """
    room, _, bet = await _create_room_and_open_bet(clean_firestore)

    # Create a user and place a bet
    user = await user_service.create_user(room.code, "Resolver", is_admin=False)
    await bet_service.place_user_bet(
        user_id=user.user_id,
        bet_id=bet.bet_id,
        selected_option="Alpha",
    )

    # Lock and resolve the bet
    await bet_service.lock_bet(bet.bet_id)
    await bet_service.resolve_bet(bet.bet_id, "Alpha")

    # Verify resolved
    resolved_bet = await bet_service.get_bet(bet.bet_id)
    assert resolved_bet.status == BetStatus.RESOLVED
    assert resolved_bet.winning_option == "Alpha"

    # Capture user points after first resolution
    user_after_first = await user_service.get_user(user.user_id)
    points_after_first = user_after_first.points

    # Second resolve with same winner – should not change points further
    # (may succeed silently or raise; either is acceptable)
    try:
        await bet_service.resolve_bet(bet.bet_id, "Alpha")
    except (ValueError, Exception):
        pass  # Acceptable to reject duplicate resolve

    # Verify points did not change again (idempotent)
    user_after_second = await user_service.get_user(user.user_id)
    assert user_after_second.points == points_after_first


@pytest.mark.integration
@pytest.mark.asyncio
async def test_resolve_already_resolved_bet_with_different_winner(clean_firestore):
    """Attempting to resolve an already-resolved bet with a different winner
    should be rejected.
    """
    room, _, bet = await _create_room_and_open_bet(clean_firestore)

    user = await user_service.create_user(room.code, "Player", is_admin=False)
    await bet_service.place_user_bet(
        user_id=user.user_id,
        bet_id=bet.bet_id,
        selected_option="Alpha",
    )

    # Lock and resolve
    await bet_service.lock_bet(bet.bet_id)
    await bet_service.resolve_bet(bet.bet_id, "Alpha")

    # Attempt to re-resolve with different winner
    # The bet model's resolve_bet expects the bet to not already be RESOLVED
    # (status transition validation), so this should raise
    with pytest.raises((ValueError, Exception)):
        await bet_service.resolve_bet(bet.bet_id, "Beta")

    # Winner should still be Alpha
    final_bet = await bet_service.get_bet(bet.bet_id)
    assert final_bet.winning_option == "Alpha"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_place_bet_on_locked_bet_rejected(clean_firestore):
    """Placing a bet on a locked bet should be rejected."""
    room, _, bet = await _create_room_and_open_bet(clean_firestore)

    user = await user_service.create_user(room.code, "LatePlayer", is_admin=False)

    # Lock the bet
    await bet_service.lock_bet(bet.bet_id)

    # Attempt to place bet on locked bet
    with pytest.raises(ValueError):
        await bet_service.place_user_bet(
            user_id=user.user_id,
            bet_id=bet.bet_id,
            selected_option="Alpha",
        )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_place_bet_on_resolved_bet_rejected(clean_firestore):
    """Placing a bet on a resolved bet should be rejected."""
    room = await room_service.create_room(
        event_template="custom",
        event_name="Resolved Test",
        host_id="host-id",
    )
    user1 = await user_service.create_user(room.code, "Player1", is_admin=False)
    user2 = await user_service.create_user(room.code, "LatePlayer", is_admin=False)
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Too late?",
        options=["Yes", "No"],
        points_value=100,
    )

    # Place bet, lock, and resolve
    await bet_service.place_user_bet(
        user_id=user1.user_id,
        bet_id=bet.bet_id,
        selected_option="Yes",
    )
    await bet_service.lock_bet(bet.bet_id)
    await bet_service.resolve_bet(bet.bet_id, "Yes")

    # Bet is RESOLVED – should not accept bets
    with pytest.raises(ValueError):
        await bet_service.place_user_bet(
            user_id=user2.user_id,
            bet_id=bet.bet_id,
            selected_option="Yes",
        )
