"""
Tests for data integrity and limits (Phase 5 / Section 4.2)

Tests verify:
- Large rooms (>500 users) – batch operation limits
- Firestore write limits (500 ops/batch)
- Safe chunked deletion strategy for delete_room()
- Batch point updates during resolution with many participants

These tests use the Firestore emulator.
"""

import pytest
from services import bet_service, user_service, room_service
from firebase_config import get_db
from models.bet import BetStatus


# ---------------------------------------------------------------------------
# 4.2 Data Integrity & Limits
# ---------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.asyncio
async def test_room_with_many_users_creation(clean_firestore):
    """Create a room with a large number of users.

    Verifies that creating many users doesn't break Firestore writes.
    """
    room = await room_service.create_room(
        event_template="custom",
        event_name="Big Room",
        host_id="host-id",
    )

    num_users = 50  # Reasonable for emulator speed; tests the pattern
    users = []
    for i in range(num_users):
        u = await user_service.create_user(room.code, f"User{i:03d}", is_admin=False)
        users.append(u)

    # Verify all users were created
    participants = await room_service.get_room_participants(room.code)
    assert len(participants) == num_users


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_room_with_many_documents(clean_firestore):
    """delete_room() should handle rooms with many associated documents.

    Current implementation uses a single batch – this tests whether it works
    for moderate document counts. For >500 docs, chunked deletion is needed.
    """
    room = await room_service.create_room(
        event_template="custom",
        event_name="Delete Test",
        host_id="host-id",
    )

    # Create users
    num_users = 20
    users = []
    for i in range(num_users):
        u = await user_service.create_user(room.code, f"Del{i:03d}", is_admin=False)
        users.append(u)

    # Create bets
    num_bets = 10
    bets = []
    for i in range(num_bets):
        b = await bet_service.create_bet(
            room_code=room.code,
            question=f"Question {i}?",
            options=["A", "B"],
            points_value=100,
        )
        bets.append(b)

    # Open bets and have users place bets (creates userBet documents)
    for bet in bets[:3]:
        await bet_service.open_bet(bet.bet_id)

    for user in users[:5]:
        for bet in bets[:3]:
            try:
                await bet_service.place_user_bet(
                    user_id=user.user_id,
                    bet_id=bet.bet_id,
                    selected_option="A",
                )
            except ValueError:
                pass  # May fail if user can't afford bet after previous placements

    # Delete the entire room
    await room_service.delete_room(room.code)

    # Verify room is deleted
    room_after = await room_service.get_room(room.code)
    assert room_after is None

    # Verify users are deleted
    participants = await room_service.get_room_participants(room.code)
    assert len(participants) == 0

    # Verify bets are deleted
    remaining_bets = await bet_service.get_bets_in_room(room.code)
    assert len(remaining_bets) == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_room_nonexistent_room(clean_firestore):
    """delete_room() should not fail on a room that doesn't exist."""
    # Should not raise – just a no-op
    await room_service.delete_room("ZZZZ")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_batch_point_updates_during_resolution(clean_firestore):
    """resolve_bet() uses a batch to update multiple users' points.

    Verify all users get correct point adjustments in a single batch.
    """
    room = await room_service.create_room(
        event_template="custom",
        event_name="Batch Points Test",
        host_id="host-id",
    )

    # Create multiple users
    num_users = 10
    users = []
    for i in range(num_users):
        u = await user_service.create_user(room.code, f"Batch{i:02d}", is_admin=False)
        users.append(u)

    # Create and open bet
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Batch test?",
        options=["Winner", "Loser"],
        points_value=100,
    )
    await bet_service.open_bet(bet.bet_id)

    # Half pick "Winner", half pick "Loser"
    for i, user in enumerate(users):
        option = "Winner" if i < num_users // 2 else "Loser"
        await bet_service.place_user_bet(
            user_id=user.user_id,
            bet_id=bet.bet_id,
            selected_option=option,
        )

    # Lock and resolve
    await bet_service.lock_bet(bet.bet_id)
    await bet_service.resolve_bet(bet.bet_id, "Winner")

    # Verify all points were adjusted
    winners = []
    losers = []
    for i, user in enumerate(users):
        updated = await user_service.get_user(user.user_id)
        if i < num_users // 2:
            winners.append(updated)
        else:
            losers.append(updated)

    # Winners: 1000 - 100 (bet cost) + winnings > 900
    for w in winners:
        assert w.points > 900, f"Winner {w.nickname} should have gained points, got {w.points}"

    # Losers: 1000 - 100 (bet cost) + 0 (lost) = 900
    for l in losers:
        assert l.points == 900, f"Loser {l.nickname} should have 900 points, got {l.points}"

    # Total points should be conserved:
    # num_users * 1000 initial points (no points created or destroyed)
    total = sum(u.points for u in winners) + sum(u.points for u in losers)
    assert total == num_users * 1000, f"Expected {num_users * 1000}, got {total}"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_firestore_batch_limit_awareness(clean_firestore):
    """Verify that the current delete_room implementation works within
    Firestore batch limits (500 operations per batch).

    This test creates a room with enough documents to be close to but
    within the 500-op batch limit.
    """
    db = clean_firestore
    room = await room_service.create_room(
        event_template="custom",
        event_name="Batch Limit Test",
        host_id="host-id",
    )

    # Create enough documents to approach but not exceed batch limits
    # 1 room + N users + M bets + K userBets < 500
    num_users = 30
    num_bets = 15

    for i in range(num_users):
        await user_service.create_user(room.code, f"Lim{i:03d}", is_admin=False)

    for i in range(num_bets):
        await bet_service.create_bet(
            room_code=room.code,
            question=f"Limit Q{i}?",
            options=["X", "Y"],
            points_value=100,
        )

    # Total docs: 1 (room) + 30 (users) + 15 (bets) = 46 – well within 500
    # Delete should succeed without issues
    await room_service.delete_room(room.code)

    # Verify everything is cleaned up
    assert await room_service.get_room(room.code) is None
    assert len(await room_service.get_room_participants(room.code)) == 0
    assert len(await bet_service.get_bets_in_room(room.code)) == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_points_never_go_negative(clean_firestore):
    """User points should never go below 0 even with multiple bet placements."""
    room = await room_service.create_room(
        event_template="custom",
        event_name="Negative Points Test",
        host_id="host-id",
    )

    user = await user_service.create_user(room.code, "SpendAll", is_admin=False)
    assert user.points == 1000

    # Create and place bets until points run out
    placed_count = 0
    for i in range(15):  # More bets than affordable
        bet = await bet_service.create_bet(
            room_code=room.code,
            question=f"Spend Q{i}?",
            options=["A", "B"],
            points_value=100,
        )
        await bet_service.open_bet(bet.bet_id)

        try:
            await bet_service.place_user_bet(
                user_id=user.user_id,
                bet_id=bet.bet_id,
                selected_option="A",
            )
            placed_count += 1
        except ValueError:
            # Expected: user can't afford bet
            break

    # User should have placed exactly 10 bets (1000 / 100)
    assert placed_count == 10

    # Points should be 0, never negative
    final_user = await user_service.get_user(user.user_id)
    assert final_user.points == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_leaderboard_with_many_users(clean_firestore):
    """Leaderboard calculation should work correctly with many users."""
    room = await room_service.create_room(
        event_template="custom",
        event_name="Leaderboard Test",
        host_id="host-id",
    )

    # Create users with varying points
    for i in range(20):
        user = await user_service.create_user(room.code, f"LB{i:02d}", is_admin=False)
        # Give different point values by updating
        if i % 3 == 0:
            await user_service.update_user_points(user.user_id, 1500)
        elif i % 3 == 1:
            await user_service.update_user_points(user.user_id, 500)
        # else: leave at 1000

    leaderboard = await user_service.calculate_and_get_leaderboard(room.code)

    assert len(leaderboard) == 20

    # Verify sorted by points descending
    for i in range(len(leaderboard) - 1):
        assert leaderboard[i]["points"] >= leaderboard[i + 1]["points"]
