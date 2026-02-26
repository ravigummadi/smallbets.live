"""
Tests for User model

Tests verify:
- can_afford_bet() method
- Point validation
- add_points() and subtract_points() (immutable)
- Pydantic validation
- Serialization/deserialization
"""

import pytest
from datetime import datetime
from pydantic import ValidationError
from models.user import User


@pytest.mark.unit
def test_user_creation_valid():
    """Test creating a valid user"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=1000,
        is_admin=False,
    )

    assert user.user_id == "test-user"
    assert user.room_code == "AAAA"
    assert user.nickname == "TestUser"
    assert user.points == 1000
    assert user.is_admin is False


@pytest.mark.unit
def test_user_default_values():
    """Test default values for user"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
    )

    # Should default to 1000 points
    assert user.points == 1000
    # Should default to False for is_admin
    assert user.is_admin is False
    # Should have joined_at set
    assert user.joined_at is not None


@pytest.mark.unit
def test_user_room_code_validation():
    """Test room code validation (must be 4 chars)"""
    # Valid
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
    )
    assert user.room_code == "AAAA"

    # Invalid: too short
    with pytest.raises(ValidationError):
        User(
            user_id="test-user",
            room_code="AAA",
            nickname="TestUser",
        )

    # Invalid: too long
    with pytest.raises(ValidationError):
        User(
            user_id="test-user",
            room_code="AAAAA",
            nickname="TestUser",
        )


@pytest.mark.unit
def test_user_nickname_validation():
    """Test nickname validation (1-20 chars)"""
    # Valid: 1 char
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="A",
    )
    assert user.nickname == "A"

    # Valid: 20 chars
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="A" * 20,
    )
    assert len(user.nickname) == 20

    # Invalid: empty
    with pytest.raises(ValidationError):
        User(
            user_id="test-user",
            room_code="AAAA",
            nickname="",
        )

    # Invalid: too long
    with pytest.raises(ValidationError):
        User(
            user_id="test-user",
            room_code="AAAA",
            nickname="A" * 21,
        )


@pytest.mark.unit
def test_user_can_afford_bet():
    """Test can_afford_bet() method"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=500,
    )

    # Can afford
    assert user.can_afford_bet(100) is True
    assert user.can_afford_bet(500) is True

    # Cannot afford
    assert user.can_afford_bet(600) is False
    assert user.can_afford_bet(1000) is False


@pytest.mark.unit
def test_user_can_afford_bet_edge_cases():
    """Test can_afford_bet() edge cases"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=0,
    )

    # Zero points
    assert user.can_afford_bet(0) is True
    assert user.can_afford_bet(1) is False


@pytest.mark.unit
def test_user_add_points():
    """Test add_points() method (immutable)"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=1000,
    )

    # Add points
    updated_user = user.add_points(500)

    # Original unchanged
    assert user.points == 1000
    # New instance updated
    assert updated_user.points == 1500
    # Different instance
    assert id(user) != id(updated_user)


@pytest.mark.unit
def test_user_subtract_points():
    """Test subtract_points() method (immutable)"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=1000,
    )

    # Subtract points
    updated_user = user.subtract_points(300)

    # Original unchanged
    assert user.points == 1000
    # New instance updated
    assert updated_user.points == 700
    # Different instance
    assert id(user) != id(updated_user)


@pytest.mark.unit
def test_user_subtract_points_minimum_zero():
    """Test subtract_points() enforces minimum of 0"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=100,
    )

    # Subtracting more than available should clamp to 0
    updated_user = user.subtract_points(200)

    assert updated_user.points == 0


@pytest.mark.unit
def test_user_to_dict():
    """Test to_dict() serialization"""
    now = datetime.utcnow()
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=1234,
        is_admin=True,
        joined_at=now,
    )

    data = user.to_dict()

    assert data["userId"] == "test-user"
    assert data["roomCode"] == "AAAA"
    assert data["nickname"] == "TestUser"
    assert data["points"] == 1234
    assert data["isAdmin"] is True
    assert data["joinedAt"] == now


@pytest.mark.unit
def test_user_from_dict():
    """Test from_dict() deserialization"""
    now = datetime.utcnow()
    data = {
        "userId": "test-user",
        "roomCode": "AAAA",
        "nickname": "TestUser",
        "points": 1234,
        "isAdmin": True,
        "joinedAt": now,
    }

    user = User.from_dict(data)

    assert user.user_id == "test-user"
    assert user.room_code == "AAAA"
    assert user.nickname == "TestUser"
    assert user.points == 1234
    assert user.is_admin is True
    assert user.joined_at == now


@pytest.mark.unit
def test_user_from_dict_defaults():
    """Test from_dict() with missing optional fields"""
    data = {
        "userId": "test-user",
        "roomCode": "AAAA",
        "nickname": "TestUser",
        "points": 1000,
        "joinedAt": datetime.utcnow(),
    }

    user = User.from_dict(data)

    # Should default to False for isAdmin
    assert user.is_admin is False


@pytest.mark.unit
def test_user_roundtrip_serialization():
    """Test to_dict() and from_dict() roundtrip"""
    original = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="TestUser",
        points=1500,
        is_admin=True,
    )

    # Serialize and deserialize
    data = original.to_dict()
    restored = User.from_dict(data)

    assert restored.user_id == original.user_id
    assert restored.room_code == original.room_code
    assert restored.nickname == original.nickname
    assert restored.points == original.points
    assert restored.is_admin == original.is_admin
