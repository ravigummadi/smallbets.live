"""
Tests for Room model

Tests verify:
- Status validation
- Field constraints
- is_expired() method
- can_accept_bets() method
- Pydantic validation
- Serialization/deserialization
"""

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError
from models.room import Room


@pytest.mark.unit
def test_room_creation_valid():
    """Test creating a valid room"""
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        status="waiting",
        host_id="host-user-id",
        automation_enabled=True,
    )

    assert room.code == "AAAA"
    assert room.event_template == "grammys-2026"
    assert room.event_name == "Grammy Awards 2026"
    assert room.status == "waiting"
    assert room.host_id == "host-user-id"
    assert room.automation_enabled is True


@pytest.mark.unit
def test_room_default_values():
    """Test default values for room"""
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
    )

    # Should default to "waiting"
    assert room.status == "waiting"
    # Should default to True
    assert room.automation_enabled is True
    # Should have created_at set
    assert room.created_at is not None
    # Should have expires_at set (24 hours from now)
    assert room.expires_at is not None


@pytest.mark.unit
def test_room_code_validation():
    """Test room code validation (must be exactly 4 chars)"""
    # Valid
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
    )
    assert room.code == "AAAA"

    # Invalid: too short
    with pytest.raises(ValidationError):
        Room(
            code="AAA",
            event_template="grammys-2026",
            host_id="host-user-id",
        )

    # Invalid: too long
    with pytest.raises(ValidationError):
        Room(
            code="AAAAA",
            event_template="grammys-2026",
            host_id="host-user-id",
        )


@pytest.mark.unit
def test_room_status_values():
    """Test valid room status values"""
    # Waiting
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="waiting",
    )
    assert room.status == "waiting"

    # Active
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
    )
    assert room.status == "active"

    # Finished
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="finished",
    )
    assert room.status == "finished"


@pytest.mark.unit
def test_room_is_expired():
    """Test is_expired() method"""
    now = datetime.utcnow()

    # Not expired (expires in future)
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        expires_at=now + timedelta(hours=1),
    )
    assert room.is_expired() is False

    # Expired (expires in past)
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        expires_at=now - timedelta(hours=1),
    )
    assert room.is_expired() is True


@pytest.mark.unit
def test_room_can_accept_bets():
    """Test can_accept_bets() method"""
    now = datetime.utcnow()

    # Active and not expired -> can accept bets
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
        expires_at=now + timedelta(hours=1),
    )
    assert room.can_accept_bets() is True

    # Waiting status -> cannot accept bets
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="waiting",
        expires_at=now + timedelta(hours=1),
    )
    assert room.can_accept_bets() is False

    # Finished status -> cannot accept bets
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="finished",
        expires_at=now + timedelta(hours=1),
    )
    assert room.can_accept_bets() is False

    # Active but expired -> cannot accept bets
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
        expires_at=now - timedelta(hours=1),
    )
    assert room.can_accept_bets() is False


@pytest.mark.unit
def test_room_to_dict():
    """Test to_dict() serialization"""
    now = datetime.utcnow()
    expires = now + timedelta(hours=24)

    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        status="active",
        host_id="host-user-id",
        automation_enabled=True,
        created_at=now,
        expires_at=expires,
    )

    data = room.to_dict()

    assert data["code"] == "AAAA"
    assert data["eventTemplate"] == "grammys-2026"
    assert data["eventName"] == "Grammy Awards 2026"
    assert data["status"] == "active"
    assert data["hostId"] == "host-user-id"
    assert data["automationEnabled"] is True
    assert data["createdAt"] == now
    assert data["expiresAt"] == expires


@pytest.mark.unit
def test_room_from_dict():
    """Test from_dict() deserialization"""
    now = datetime.utcnow()
    expires = now + timedelta(hours=24)

    data = {
        "code": "AAAA",
        "eventTemplate": "grammys-2026",
        "eventName": "Grammy Awards 2026",
        "status": "active",
        "hostId": "host-user-id",
        "automationEnabled": True,
        "createdAt": now,
        "expiresAt": expires,
    }

    room = Room.from_dict(data)

    assert room.code == "AAAA"
    assert room.event_template == "grammys-2026"
    assert room.event_name == "Grammy Awards 2026"
    assert room.status == "active"
    assert room.host_id == "host-user-id"
    assert room.automation_enabled is True
    assert room.created_at == now
    assert room.expires_at == expires


@pytest.mark.unit
def test_room_from_dict_defaults():
    """Test from_dict() with missing optional fields"""
    now = datetime.utcnow()
    expires = now + timedelta(hours=24)

    data = {
        "code": "AAAA",
        "eventTemplate": "grammys-2026",
        "status": "waiting",
        "hostId": "host-user-id",
        "createdAt": now,
        "expiresAt": expires,
    }

    room = Room.from_dict(data)

    # Should default to True for automationEnabled
    assert room.automation_enabled is True
    # eventName should be None
    assert room.event_name is None


@pytest.mark.unit
def test_room_roundtrip_serialization():
    """Test to_dict() and from_dict() roundtrip"""
    original = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        status="active",
        host_id="host-user-id",
        automation_enabled=False,
    )

    # Serialize and deserialize
    data = original.to_dict()
    restored = Room.from_dict(data)

    assert restored.code == original.code
    assert restored.event_template == original.event_template
    assert restored.event_name == original.event_name
    assert restored.status == original.status
    assert restored.host_id == original.host_id
    assert restored.automation_enabled == original.automation_enabled


@pytest.mark.unit
def test_room_expires_at_default():
    """Test expires_at default is 24 hours from now"""
    before = datetime.utcnow()
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
    )
    after = datetime.utcnow()

    # expires_at should be approximately 24 hours from now
    expected_min = before + timedelta(hours=24)
    expected_max = after + timedelta(hours=24)

    assert expected_min <= room.expires_at <= expected_max
