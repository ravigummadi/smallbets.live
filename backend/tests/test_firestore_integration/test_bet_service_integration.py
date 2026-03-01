"""
Integration tests for bet_service with Firestore Emulator

Tests verify:
- Bet lifecycle with real Firestore
- Bet creation, opening, locking, resolving
- User bet placement
- Point distribution

Tests marked with @pytest.mark.integration for selective execution.
"""

import pytest
from services import bet_service, user_service, room_service
from models.bet import BetStatus


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_and_get_bet(clean_firestore):
    """Test creating and retrieving a bet"""
    # Create room first
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Create bet
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Who will win Best Picture?",
        options=["Movie A", "Movie B", "Movie C"],
        points_value=100,
    )

    assert bet.bet_id is not None
    assert bet.status == BetStatus.OPEN
    assert bet.room_code == room.code

    # Retrieve bet
    retrieved = await bet_service.get_bet(bet.bet_id)

    assert retrieved is not None
    assert retrieved.bet_id == bet.bet_id
    assert retrieved.question == bet.question


@pytest.mark.integration
@pytest.mark.asyncio
async def test_bet_lifecycle(clean_firestore):
    """Test full bet lifecycle: OPEN → LOCKED → RESOLVED"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Create bet (starts as OPEN)
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Test Question?",
        options=["Option A", "Option B"],
        points_value=100,
    )

    assert bet.status == BetStatus.OPEN

    # Lock bet
    bet = await bet_service.lock_bet(bet.bet_id)
    assert bet.status == BetStatus.LOCKED

    # Resolve bet
    await bet_service.resolve_bet(bet.bet_id, "Option A")

    # Verify resolved
    resolved = await bet_service.get_bet(bet.bet_id)
    assert resolved.status == BetStatus.RESOLVED
    assert resolved.winning_option == "Option A"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_place_user_bet(clean_firestore):
    """Test placing a user bet"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Create user
    user = await user_service.create_user(room.code, "TestUser", is_admin=False)

    # Create bet (starts as OPEN)
    bet = await bet_service.create_bet(
        room_code=room.code,
        question="Test Question?",
        options=["Option A", "Option B"],
        points_value=100,
    )

    # Place user bet
    user_bet = await bet_service.place_user_bet(
        user_id=user.user_id,
        bet_id=bet.bet_id,
        selected_option="Option A",
    )

    assert user_bet.user_id == user.user_id
    assert user_bet.bet_id == bet.bet_id
    assert user_bet.selected_option == "Option A"

    # Verify user points deducted
    updated_user = await user_service.get_user(user.user_id)
    assert updated_user.points == 900  # 1000 - 100


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_bets_in_room(clean_firestore):
    """Test getting all bets in a room"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Create multiple bets
    bet1 = await bet_service.create_bet(
        room_code=room.code,
        question="Question 1?",
        options=["A", "B"],
        points_value=100,
    )

    bet2 = await bet_service.create_bet(
        room_code=room.code,
        question="Question 2?",
        options=["A", "B"],
        points_value=150,
    )

    # Get all bets
    bets = await bet_service.get_bets_in_room(room.code)

    assert len(bets) == 2
    bet_ids = [b.bet_id for b in bets]
    assert bet1.bet_id in bet_ids
    assert bet2.bet_id in bet_ids
