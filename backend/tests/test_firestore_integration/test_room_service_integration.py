"""
Integration tests for room_service with Firestore Emulator

Tests verify real Firestore behavior:
- Room creation and retrieval
- Room queries
- Room updates
- Batch operations

Tests marked with @pytest.mark.integration for selective execution.
Requires Firebase Emulator to be running.
"""

import pytest
from services import room_service
from models.room import Room


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_and_get_room(clean_firestore):
    """Test creating and retrieving a room"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    assert room.code is not None
    assert len(room.code) == 4
    assert room.event_template == "grammys-2026"
    assert room.host_id == "test-host-id"

    # Retrieve room
    retrieved = await room_service.get_room(room.code)

    assert retrieved is not None
    assert retrieved.code == room.code
    assert retrieved.event_template == room.event_template
    assert retrieved.host_id == room.host_id


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_room(clean_firestore):
    """Test updating a room"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Update room status
    await room_service.set_room_status(room.code, "active")

    # Retrieve updated room
    updated = await room_service.get_room(room.code)

    assert updated.status == "active"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_room_participants(clean_firestore):
    """Test getting room participants"""
    # Create room
    room = await room_service.create_room(
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="test-host-id",
    )

    # Create users in room
    from services import user_service
    await user_service.create_user(room.code, "User1", is_admin=False)
    await user_service.create_user(room.code, "User2", is_admin=False)

    # Get participants
    participants = await room_service.get_room_participants(room.code)

    assert len(participants) == 2
    assert participants[0].nickname in ["User1", "User2"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_room_not_found(clean_firestore):
    """Test getting non-existent room returns None"""
    room = await room_service.get_room("ZZZZ")
    assert room is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_room_code_uniqueness(clean_firestore):
    """Test that generated room codes are unique"""
    codes = set()

    # Create multiple rooms
    for i in range(10):
        room = await room_service.create_room(
            event_template="grammys-2026",
            event_name=f"Event {i}",
            host_id=f"host-{i}",
        )
        codes.add(room.code)

    # All codes should be unique
    assert len(codes) == 10
