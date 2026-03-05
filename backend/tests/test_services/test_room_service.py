"""
Tests for room_service with mocked Firestore

Tests verify room creation, code generation, match room linking,
cascading deletes, and participant management.

Tests marked with @pytest.mark.unit for selective execution.
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

from services import room_service
from models.room import Room


# ============================================================================
# generate_room_code() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_generate_room_code_returns_4_chars():
    """Legacy room code should be 4 characters"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        code = await room_service.generate_room_code()

    assert len(code) == 4
    # Only valid characters
    valid = set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")
    for ch in code:
        assert ch in valid, f"Invalid character in room code: {ch}"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_generate_room_code_retries_on_collision():
    """Should retry when room code already exists"""
    mock_db = MagicMock()
    existing_doc = MagicMock()
    existing_doc.exists = True
    existing_doc.to_dict.return_value = {"expiresAt": None}

    free_doc = MagicMock()
    free_doc.exists = False

    mock_db.collection.return_value.document.return_value.get.side_effect = [
        existing_doc, free_doc
    ]

    with patch("services.room_service.get_db", return_value=mock_db):
        code = await room_service.generate_room_code()

    assert len(code) == 4


@pytest.mark.unit
@pytest.mark.asyncio
async def test_generate_room_code_fails_after_max_attempts():
    """Should raise RuntimeError after exhausting retries"""
    mock_db = MagicMock()
    existing_doc = MagicMock()
    existing_doc.exists = True
    existing_doc.to_dict.return_value = {"expiresAt": None}

    mock_db.collection.return_value.document.return_value.get.return_value = existing_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        with pytest.raises(RuntimeError, match="Failed to generate unique room code"):
            await room_service.generate_room_code()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_generate_room_code_v2_returns_6_chars():
    """V2 room code should be 6 characters with checksum"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        code = await room_service.generate_room_code_v2()

    assert len(code) == 6


# ============================================================================
# create_room() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_room_event():
    """Create an event room with 4-char code"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room = await room_service.create_room(
            event_template="custom",
            event_name="Test Event",
            host_id="host-123",
        )

    assert room.event_template == "custom"
    assert room.event_name == "Test Event"
    assert room.host_id == "host-123"
    assert room.status == "waiting"
    assert room.room_type == "event"
    assert room.expires_at is not None
    assert len(room.code) == 4

    # Verify Firestore write
    mock_db.collection.return_value.document.return_value.set.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_tournament_room():
    """Create a tournament room with 6-char code"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room = await room_service.create_tournament_room(
            event_template="ipl-2026",
            event_name="IPL 2026",
            host_id="host-123",
        )

    assert room.room_type == "tournament"
    assert room.expires_at is None
    assert room.participants == ["host-123"]
    assert room.version == 1
    assert len(room.code) == 6


# ============================================================================
# create_match_room() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_match_room():
    """Create a match room linked to a tournament"""
    tournament = Room(
        code="TOURNY",
        event_template="ipl-2026",
        event_name="IPL 2026",
        status="active",
        host_id="host-123",
        room_type="tournament",
        created_at=datetime.utcnow(),
    )

    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db), \
         patch("services.room_service.get_room", return_value=tournament):

        room = await room_service.create_match_room(
            parent_room_code="TOURNY",
            host_id="host-123",
            team1="RCB",
            team2="MI",
            match_date_time="2026-03-28T19:30:00Z",
            venue="Chinnaswamy Stadium",
            title="Match 1 - RCB vs MI",
        )

    assert room.room_type == "match"
    assert room.parent_room_code == "TOURNY"
    assert room.match_details is not None
    assert room.match_details.team1 == "RCB"
    assert room.match_details.team2 == "MI"
    assert room.event_name == "Match 1 - RCB vs MI"
    assert room.status == "active"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_match_room_without_title():
    """Match room without explicit title uses 'team1 vs team2'"""
    tournament = Room(
        code="TOURNY",
        event_template="ipl-2026",
        event_name="IPL 2026",
        status="active",
        host_id="host-123",
        room_type="tournament",
        created_at=datetime.utcnow(),
    )

    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db), \
         patch("services.room_service.get_room", return_value=tournament):

        room = await room_service.create_match_room(
            parent_room_code="TOURNY",
            host_id="host-123",
            team1="CSK",
            team2="DC",
            match_date_time="2026-03-28T19:30:00Z",
        )

    assert room.event_name == "CSK vs DC"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_match_room_invalid_parent():
    """Should fail if parent room doesn't exist"""
    with patch("services.room_service.get_room", return_value=None):
        with pytest.raises(ValueError, match="Parent tournament not found"):
            await room_service.create_match_room(
                parent_room_code="NONEXIST",
                host_id="host-123",
                team1="A",
                team2="B",
                match_date_time="2026-03-28T19:30:00Z",
            )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_match_room_non_tournament_parent():
    """Should fail if parent is not a tournament"""
    event_room = Room(
        code="EVENT1",
        event_template="custom",
        status="active",
        host_id="host-123",
        room_type="event",
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room", return_value=event_room):
        with pytest.raises(ValueError, match="Parent room is not a tournament"):
            await room_service.create_match_room(
                parent_room_code="EVENT1",
                host_id="host-123",
                team1="A",
                team2="B",
                match_date_time="2026-03-28T19:30:00Z",
            )


# ============================================================================
# get_room() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_found():
    """Should return room when it exists"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "code": "TEST",
        "eventTemplate": "custom",
        "eventName": "Test",
        "status": "active",
        "hostId": "host-123",
        "roomType": "event",
        "createdAt": datetime.utcnow(),
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room = await room_service.get_room("TEST")

    assert room is not None
    assert room.code == "TEST"
    assert room.status == "active"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_not_found():
    """Should return None when room doesn't exist"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room = await room_service.get_room("NOPE")

    assert room is None


# ============================================================================
# delete_room() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_room_cascades():
    """Should delete room and all associated collections"""
    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    # Mock stream results for each collection
    mock_user_doc = MagicMock()
    mock_bet_doc = MagicMock()
    mock_user_bet_doc = MagicMock()
    mock_room_user_doc = MagicMock()

    def collection_side_effect(name):
        col = MagicMock()
        if name == "rooms":
            col.document.return_value = MagicMock()
            return col
        elif name == "users":
            col.where.return_value.stream.return_value = [mock_user_doc]
        elif name == "bets":
            col.where.return_value.stream.return_value = [mock_bet_doc]
        elif name == "userBets":
            col.where.return_value.stream.return_value = [mock_user_bet_doc]
        elif name == "roomUsers":
            col.where.return_value.stream.return_value = [mock_room_user_doc]
        return col

    mock_db.collection.side_effect = collection_side_effect

    with patch("services.room_service.get_db", return_value=mock_db):
        await room_service.delete_room("TEST")

    # 1 room + 1 user + 1 bet + 1 user_bet + 1 room_user = 5 deletes
    assert mock_batch.delete.call_count == 5
    mock_batch.commit.assert_called_once()


# ============================================================================
# Room user operations tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_room_user():
    """Should create RoomUser with correct doc ID"""
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    with patch("services.room_service.get_db", return_value=mock_db):
        room_user = await room_service.create_room_user(
            room_code="TEST",
            user_id="user-123",
            nickname="Alice",
            is_host=True,
        )

    assert room_user.id == "TEST_user-123"
    assert room_user.room_code == "TEST"
    assert room_user.user_id == "user-123"
    assert room_user.nickname == "Alice"
    assert room_user.is_host is True
    assert room_user.points == 1000  # INITIAL_POINTS

    mock_doc_ref.set.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_user_found():
    """Should return RoomUser when it exists"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "id": "TEST_user-123",
        "roomCode": "TEST",
        "userId": "user-123",
        "nickname": "Alice",
        "points": 900,
        "joinedAt": datetime.utcnow(),
        "isHost": False,
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room_user = await room_service.get_room_user("TEST", "user-123")

    assert room_user is not None
    assert room_user.nickname == "Alice"

    # Verify correct doc ID was used
    mock_db.collection.return_value.document.assert_called_with("TEST_user-123")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_user_not_found():
    """Should return None when RoomUser doesn't exist"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with patch("services.room_service.get_db", return_value=mock_db):
        room_user = await room_service.get_room_user("TEST", "nonexist")

    assert room_user is None


# ============================================================================
# add_participant() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_add_participant():
    """Should add user to room's participants array"""
    mock_db = MagicMock()
    mock_room_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_room_ref

    with patch("services.room_service.get_db", return_value=mock_db):
        await room_service.add_participant("TEST", "user-123")

    mock_room_ref.update.assert_called_once()
    update_data = mock_room_ref.update.call_args[0][0]
    assert "participants" in update_data


# ============================================================================
# get_child_rooms() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_child_rooms():
    """Should return match rooms linked to a tournament"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = {
        "code": "MATCH1",
        "eventTemplate": "ipl-2026",
        "eventName": "RCB vs MI",
        "status": "active",
        "hostId": "host-123",
        "roomType": "match",
        "parentRoomCode": "TOURNY",
        "createdAt": datetime.utcnow(),
    }
    mock_db.collection.return_value.where.return_value.stream.return_value = [mock_doc]

    with patch("services.room_service.get_db", return_value=mock_db):
        rooms = await room_service.get_child_rooms("TOURNY")

    assert len(rooms) == 1
    assert rooms[0].code == "MATCH1"
    assert rooms[0].parent_room_code == "TOURNY"


# ============================================================================
# set_room_status() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_set_room_status():
    """Should update room status in Firestore"""
    mock_db = MagicMock()
    mock_room_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_room_ref

    with patch("services.room_service.get_db", return_value=mock_db):
        await room_service.set_room_status("TEST", "active")

    mock_room_ref.update.assert_called_once_with({"status": "active"})
