"""Tests for RoomUser model"""

import pytest
from datetime import datetime
from pydantic import ValidationError
from models.room_user import RoomUser


@pytest.mark.unit
def test_room_user_creation():
    """Test creating a valid RoomUser"""
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=1000,
        is_host=False,
    )
    assert ru.room_code == "ABCDE2"
    assert ru.user_id == "user1"
    assert ru.nickname == "Alice"
    assert ru.points == 1000
    assert ru.is_host is False


@pytest.mark.unit
def test_room_user_default_points():
    """Test RoomUser defaults to 1000 points"""
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
    )
    assert ru.points == 1000


@pytest.mark.unit
def test_room_user_to_dict():
    """Test RoomUser serialization"""
    now = datetime.utcnow()
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=900,
        is_host=True,
        joined_at=now,
    )
    data = ru.to_dict()
    assert data["id"] == "ABCDE2_user1"
    assert data["roomCode"] == "ABCDE2"
    assert data["userId"] == "user1"
    assert data["nickname"] == "Alice"
    assert data["points"] == 900
    assert data["isHost"] is True
    assert data["joinedAt"] == now


@pytest.mark.unit
def test_room_user_from_dict():
    """Test RoomUser deserialization"""
    now = datetime.utcnow()
    data = {
        "id": "ABCDE2_user1",
        "roomCode": "ABCDE2",
        "userId": "user1",
        "nickname": "Alice",
        "points": 800,
        "isHost": False,
        "joinedAt": now,
    }
    ru = RoomUser.from_dict(data)
    assert ru.id == "ABCDE2_user1"
    assert ru.room_code == "ABCDE2"
    assert ru.points == 800


@pytest.mark.unit
def test_room_user_can_afford_bet():
    """Test can_afford_bet method"""
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=100,
    )
    assert ru.can_afford_bet(100) is True
    assert ru.can_afford_bet(101) is False
    assert ru.can_afford_bet(50) is True


@pytest.mark.unit
def test_room_user_add_points():
    """Test add_points returns new instance"""
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=1000,
    )
    updated = ru.add_points(200)
    assert updated.points == 1200
    assert ru.points == 1000  # Original unchanged


@pytest.mark.unit
def test_room_user_subtract_points():
    """Test subtract_points returns new instance, floors at 0"""
    ru = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=100,
    )
    updated = ru.subtract_points(50)
    assert updated.points == 50

    updated2 = ru.subtract_points(200)
    assert updated2.points == 0  # Floors at 0


@pytest.mark.unit
def test_room_user_roundtrip():
    """Test to_dict/from_dict roundtrip"""
    original = RoomUser(
        id="ABCDE2_user1",
        room_code="ABCDE2",
        user_id="user1",
        nickname="Alice",
        points=750,
        is_host=True,
    )
    data = original.to_dict()
    restored = RoomUser.from_dict(data)
    assert restored.id == original.id
    assert restored.room_code == original.room_code
    assert restored.user_id == original.user_id
    assert restored.points == original.points
    assert restored.is_host == original.is_host
