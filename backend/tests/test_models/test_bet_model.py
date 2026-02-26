"""
Tests for Bet model

Tests verify:
- State transitions
- can_accept_bets() method
- is_resolved() method
- Pydantic validation
- Serialization/deserialization
"""

import pytest
from datetime import datetime
from pydantic import ValidationError
from models.bet import Bet, BetStatus


@pytest.mark.unit
def test_bet_creation_valid():
    """Test creating a valid bet"""
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Test question?",
        options=["Option 1", "Option 2"],
        points_value=100,
    )

    assert bet.bet_id == "test-id"
    assert bet.room_code == "AAAA"
    assert bet.status == BetStatus.PENDING
    assert bet.points_value == 100


@pytest.mark.unit
def test_bet_room_code_validation():
    """Test room code validation (must be 4 chars)"""
    # Valid 4-char room code
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=100,
    )
    assert bet.room_code == "AAAA"

    # Invalid: too short
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAA",  # Only 3 chars
            question="Q?",
            options=["A", "B"],
            points_value=100,
        )

    # Invalid: too long
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAAAA",  # 5 chars
            question="Q?",
            options=["A", "B"],
            points_value=100,
        )


@pytest.mark.unit
def test_bet_question_validation():
    """Test question validation (must not be empty)"""
    # Valid question
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=100,
    )
    assert bet.question == "Q?"

    # Invalid: empty question
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAAA",
            question="",  # Empty
            options=["A", "B"],
            points_value=100,
        )


@pytest.mark.unit
def test_bet_options_validation():
    """Test options validation (must have at least 2)"""
    # Valid: 2 options
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=100,
    )
    assert len(bet.options) == 2

    # Valid: 3+ options
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B", "C", "D"],
        points_value=100,
    )
    assert len(bet.options) == 4

    # Invalid: only 1 option
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAAA",
            question="Q?",
            options=["A"],  # Only 1
            points_value=100,
        )


@pytest.mark.unit
def test_bet_points_value_validation():
    """Test points_value validation (must be between 10 and 1000)"""
    # Valid: 100 points
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=100,
    )
    assert bet.points_value == 100

    # Valid: minimum (10)
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=10,
    )
    assert bet.points_value == 10

    # Valid: maximum (1000)
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        points_value=1000,
    )
    assert bet.points_value == 1000

    # Invalid: too low
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAAA",
            question="Q?",
            options=["A", "B"],
            points_value=5,  # Less than 10
        )

    # Invalid: too high
    with pytest.raises(ValidationError):
        Bet(
            bet_id="test-id",
            room_code="AAAA",
            question="Q?",
            options=["A", "B"],
            points_value=1500,  # More than 1000
        )


@pytest.mark.unit
def test_bet_can_accept_bets():
    """Test can_accept_bets() method"""
    # PENDING: cannot accept bets
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.PENDING,
        points_value=100,
    )
    assert bet.can_accept_bets() is False

    # OPEN: can accept bets
    bet = bet.open_bet()
    assert bet.can_accept_bets() is True

    # LOCKED: cannot accept bets
    bet = bet.lock_bet()
    assert bet.can_accept_bets() is False

    # RESOLVED: cannot accept bets
    bet = bet.resolve_bet("A")
    assert bet.can_accept_bets() is False


@pytest.mark.unit
def test_bet_is_resolved():
    """Test is_resolved() method"""
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.PENDING,
        points_value=100,
    )

    # Not resolved in PENDING, OPEN, or LOCKED states
    assert bet.is_resolved() is False

    bet = bet.open_bet()
    assert bet.is_resolved() is False

    bet = bet.lock_bet()
    assert bet.is_resolved() is False

    # Resolved after resolution
    bet = bet.resolve_bet("A")
    assert bet.is_resolved() is True


@pytest.mark.unit
def test_bet_to_dict():
    """Test to_dict() serialization"""
    now = datetime.utcnow()
    bet = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        opened_at=now,
        locked_at=now,
        resolved_at=now,
        winning_option="A",
        points_value=100,
    )

    data = bet.to_dict()

    assert data["betId"] == "test-id"
    assert data["roomCode"] == "AAAA"
    assert data["question"] == "Q?"
    assert data["options"] == ["A", "B"]
    assert data["status"] == "resolved"
    assert data["openedAt"] == now
    assert data["lockedAt"] == now
    assert data["resolvedAt"] == now
    assert data["winningOption"] == "A"
    assert data["pointsValue"] == 100


@pytest.mark.unit
def test_bet_from_dict():
    """Test from_dict() deserialization"""
    now = datetime.utcnow()
    data = {
        "betId": "test-id",
        "roomCode": "AAAA",
        "question": "Q?",
        "options": ["A", "B"],
        "status": "resolved",
        "openedAt": now,
        "lockedAt": now,
        "resolvedAt": now,
        "winningOption": "A",
        "pointsValue": 100,
    }

    bet = Bet.from_dict(data)

    assert bet.bet_id == "test-id"
    assert bet.room_code == "AAAA"
    assert bet.question == "Q?"
    assert bet.options == ["A", "B"]
    assert bet.status == BetStatus.RESOLVED
    assert bet.opened_at == now
    assert bet.locked_at == now
    assert bet.resolved_at == now
    assert bet.winning_option == "A"
    assert bet.points_value == 100


@pytest.mark.unit
def test_bet_from_dict_backwards_compatibility():
    """Test from_dict() with missing pointsValue (backwards compatibility)"""
    data = {
        "betId": "test-id",
        "roomCode": "AAAA",
        "question": "Q?",
        "options": ["A", "B"],
        "status": "pending",
    }

    bet = Bet.from_dict(data)

    # Should default to 100
    assert bet.points_value == 100


@pytest.mark.unit
def test_bet_roundtrip_serialization():
    """Test to_dict() and from_dict() roundtrip"""
    original = Bet(
        bet_id="test-id",
        room_code="AAAA",
        question="Q?",
        options=["A", "B", "C"],
        status=BetStatus.OPEN,
        opened_at=datetime.utcnow(),
        points_value=150,
    )

    # Serialize and deserialize
    data = original.to_dict()
    restored = Bet.from_dict(data)

    assert restored.bet_id == original.bet_id
    assert restored.room_code == original.room_code
    assert restored.question == original.question
    assert restored.options == original.options
    assert restored.status == original.status
    assert restored.points_value == original.points_value
