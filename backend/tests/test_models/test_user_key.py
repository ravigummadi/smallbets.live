"""
Tests for User model user_key field and to_dict(include_key) behavior

Tests verify:
- user_key field is optional and defaults to None
- to_dict() excludes userKey by default (security)
- to_dict(include_key=True) includes userKey
- from_dict() reads userKey from data
- from_dict() handles missing userKey gracefully
- Roundtrip serialization preserves user_key
"""

import pytest
from datetime import datetime
from models.user import User


@pytest.mark.unit
def test_user_key_defaults_to_none():
    """User key should default to None when not provided"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
    )
    assert user.user_key is None


@pytest.mark.unit
def test_user_key_can_be_set():
    """User key can be set at construction"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key="xY7kM9zQ",
    )
    assert user.user_key == "xY7kM9zQ"


@pytest.mark.unit
def test_to_dict_excludes_key_by_default():
    """to_dict() should NOT include userKey by default (security)"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key="xY7kM9zQ",
    )
    data = user.to_dict()
    assert "userKey" not in data
    assert data["userId"] == "test-user"
    assert data["nickname"] == "Alice"


@pytest.mark.unit
def test_to_dict_includes_key_when_requested():
    """to_dict(include_key=True) should include userKey"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key="xY7kM9zQ",
    )
    data = user.to_dict(include_key=True)
    assert data["userKey"] == "xY7kM9zQ"
    assert data["userId"] == "test-user"


@pytest.mark.unit
def test_to_dict_include_key_with_none_key():
    """to_dict(include_key=True) should not include userKey if it's None"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
    )
    data = user.to_dict(include_key=True)
    assert "userKey" not in data


@pytest.mark.unit
def test_from_dict_reads_user_key():
    """from_dict() should read userKey from data"""
    data = {
        "userId": "test-user",
        "roomCode": "AAAA",
        "nickname": "Alice",
        "points": 1000,
        "isAdmin": False,
        "joinedAt": datetime.utcnow(),
        "userKey": "xY7kM9zQ",
    }
    user = User.from_dict(data)
    assert user.user_key == "xY7kM9zQ"


@pytest.mark.unit
def test_from_dict_handles_missing_user_key():
    """from_dict() should handle missing userKey (existing users)"""
    data = {
        "userId": "test-user",
        "roomCode": "AAAA",
        "nickname": "Alice",
        "points": 1000,
        "isAdmin": False,
        "joinedAt": datetime.utcnow(),
    }
    user = User.from_dict(data)
    assert user.user_key is None


@pytest.mark.unit
def test_roundtrip_with_key():
    """to_dict(include_key=True) → from_dict() should preserve user_key"""
    original = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        points=850,
        is_admin=True,
        user_key="xY7kM9zQ",
    )
    data = original.to_dict(include_key=True)
    restored = User.from_dict(data)

    assert restored.user_id == original.user_id
    assert restored.room_code == original.room_code
    assert restored.nickname == original.nickname
    assert restored.points == original.points
    assert restored.is_admin == original.is_admin
    assert restored.user_key == original.user_key


@pytest.mark.unit
def test_roundtrip_without_key_loses_key():
    """to_dict() (default) → from_dict() should NOT preserve user_key (by design)"""
    original = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key="xY7kM9zQ",
    )
    data = original.to_dict()  # default: exclude key
    restored = User.from_dict(data)

    assert restored.user_key is None  # Key was not in the serialized data
