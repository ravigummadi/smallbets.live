"""
Tests for UserBet model

Tests verify:
- is_winner() logic
- with_points_won() (immutable)
- Pydantic validation
- Serialization/deserialization
"""

import pytest
from datetime import datetime
from pydantic import ValidationError
from models.user_bet import UserBet


@pytest.mark.unit
def test_user_bet_creation_valid():
    """Test creating a valid user bet"""
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )

    assert user_bet.user_id == "user1"
    assert user_bet.bet_id == "bet1"
    assert user_bet.room_code == "AAAA"
    assert user_bet.selected_option == "Option A"
    assert user_bet.points_won is None


@pytest.mark.unit
def test_user_bet_room_code_validation():
    """Test room code validation (must be 4 chars)"""
    # Valid
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )
    assert user_bet.room_code == "AAAA"

    # Invalid: too short
    with pytest.raises(ValidationError):
        UserBet(
            user_id="user1",
            bet_id="bet1",
            room_code="AAA",
            selected_option="Option A",
        )

    # Invalid: too long
    with pytest.raises(ValidationError):
        UserBet(
            user_id="user1",
            bet_id="bet1",
            room_code="AAAAA",
            selected_option="Option A",
        )


@pytest.mark.unit
def test_user_bet_is_winner():
    """Test is_winner() method"""
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )

    # Winner
    assert user_bet.is_winner("Option A") is True

    # Loser
    assert user_bet.is_winner("Option B") is False
    assert user_bet.is_winner("Option C") is False


@pytest.mark.unit
def test_user_bet_is_winner_case_sensitive():
    """Test is_winner() is case sensitive"""
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )

    # Case sensitive match
    assert user_bet.is_winner("Option A") is True
    assert user_bet.is_winner("option a") is False
    assert user_bet.is_winner("OPTION A") is False


@pytest.mark.unit
def test_user_bet_with_points_won():
    """Test with_points_won() method (immutable)"""
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )

    # Set points won
    updated_bet = user_bet.with_points_won(500)

    # Original unchanged
    assert user_bet.points_won is None
    # New instance updated
    assert updated_bet.points_won == 500
    # Different instance
    assert id(user_bet) != id(updated_bet)


@pytest.mark.unit
def test_user_bet_with_points_won_zero():
    """Test with_points_won() with zero points (loser)"""
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
    )

    # Loser gets 0 points
    updated_bet = user_bet.with_points_won(0)

    assert updated_bet.points_won == 0


@pytest.mark.unit
def test_user_bet_to_dict():
    """Test to_dict() serialization"""
    now = datetime.utcnow()
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
        placed_at=now,
        points_won=500,
    )

    data = user_bet.to_dict()

    assert data["userId"] == "user1"
    assert data["betId"] == "bet1"
    assert data["roomCode"] == "AAAA"
    assert data["selectedOption"] == "Option A"
    assert data["placedAt"] == now
    assert data["pointsWon"] == 500


@pytest.mark.unit
def test_user_bet_to_dict_no_points_won():
    """Test to_dict() with no points_won (before resolution)"""
    now = datetime.utcnow()
    user_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
        placed_at=now,
    )

    data = user_bet.to_dict()

    assert data["pointsWon"] is None


@pytest.mark.unit
def test_user_bet_from_dict():
    """Test from_dict() deserialization"""
    now = datetime.utcnow()
    data = {
        "userId": "user1",
        "betId": "bet1",
        "roomCode": "AAAA",
        "selectedOption": "Option A",
        "placedAt": now,
        "pointsWon": 500,
    }

    user_bet = UserBet.from_dict(data)

    assert user_bet.user_id == "user1"
    assert user_bet.bet_id == "bet1"
    assert user_bet.room_code == "AAAA"
    assert user_bet.selected_option == "Option A"
    assert user_bet.placed_at == now
    assert user_bet.points_won == 500


@pytest.mark.unit
def test_user_bet_from_dict_no_points_won():
    """Test from_dict() with missing points_won"""
    now = datetime.utcnow()
    data = {
        "userId": "user1",
        "betId": "bet1",
        "roomCode": "AAAA",
        "selectedOption": "Option A",
        "placedAt": now,
    }

    user_bet = UserBet.from_dict(data)

    assert user_bet.points_won is None


@pytest.mark.unit
def test_user_bet_roundtrip_serialization():
    """Test to_dict() and from_dict() roundtrip"""
    original = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="Option A",
        points_won=250,
    )

    # Serialize and deserialize
    data = original.to_dict()
    restored = UserBet.from_dict(data)

    assert restored.user_id == original.user_id
    assert restored.bet_id == original.bet_id
    assert restored.room_code == original.room_code
    assert restored.selected_option == original.selected_option
    assert restored.points_won == original.points_won
