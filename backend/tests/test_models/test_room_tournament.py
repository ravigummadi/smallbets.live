"""Tests for Room model tournament fields"""

import pytest
from datetime import datetime, timedelta
from models.room import Room, MatchDetails


@pytest.mark.unit
def test_tournament_room_creation():
    """Test creating a tournament room"""
    room = Room(
        code="ABCDE2",
        event_template="ipl-2026",
        event_name="IPL 2026",
        status="waiting",
        host_id="host-1",
        room_type="tournament",
        expires_at=None,
    )
    assert room.room_type == "tournament"
    assert room.is_tournament() is True
    assert room.is_match() is False
    assert room.expires_at is None


@pytest.mark.unit
def test_match_room_creation():
    """Test creating a match room"""
    match_details = MatchDetails(
        team1="RCB",
        team2="MI",
        match_date_time="2026-03-15T14:00:00Z",
        venue="Chinnaswamy",
    )
    room = Room(
        code="FGHJ32",
        event_template="ipl-2026",
        event_name="RCB vs MI",
        status="active",
        host_id="host-1",
        room_type="match",
        parent_room_code="ABCDE2",
        match_details=match_details,
        expires_at=None,
    )
    assert room.room_type == "match"
    assert room.is_match() is True
    assert room.is_tournament() is False
    assert room.parent_room_code == "ABCDE2"
    assert room.match_details.team1 == "RCB"
    assert room.match_details.team2 == "MI"


@pytest.mark.unit
def test_tournament_room_never_expires():
    """Test tournament rooms never expire"""
    room = Room(
        code="ABCDE2",
        event_template="ipl-2026",
        host_id="host-1",
        room_type="tournament",
        expires_at=None,
    )
    assert room.is_expired() is False


@pytest.mark.unit
def test_event_room_backward_compatible():
    """Test legacy event rooms still work"""
    room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-1",
    )
    # Defaults
    assert room.room_type == "event"
    assert room.parent_room_code is None
    assert room.is_tournament() is False
    assert room.is_match() is False
    assert room.expires_at is not None


@pytest.mark.unit
def test_room_6char_code():
    """Test 6-character room code is valid"""
    room = Room(
        code="ABCDE2",
        event_template="ipl-2026",
        host_id="host-1",
        room_type="tournament",
        expires_at=None,
    )
    assert room.code == "ABCDE2"


@pytest.mark.unit
def test_room_to_dict_tournament_fields():
    """Test serialization includes tournament fields"""
    match_details = MatchDetails(
        team1="RCB",
        team2="MI",
        match_date_time="2026-03-15T14:00:00Z",
    )
    room = Room(
        code="FGHJ32",
        event_template="ipl-2026",
        event_name="RCB vs MI",
        status="active",
        host_id="host-1",
        room_type="match",
        parent_room_code="ABCDE2",
        match_details=match_details,
        participants=["host-1", "user-2"],
        version=2,
        expires_at=None,
    )
    data = room.to_dict()
    assert data["roomType"] == "match"
    assert data["parentRoomCode"] == "ABCDE2"
    assert data["matchDetails"]["team1"] == "RCB"
    assert data["matchDetails"]["team2"] == "MI"
    assert data["participants"] == ["host-1", "user-2"]
    assert data["version"] == 2


@pytest.mark.unit
def test_room_from_dict_tournament_fields():
    """Test deserialization handles tournament fields"""
    now = datetime.utcnow()
    data = {
        "code": "FGHJ32",
        "eventTemplate": "ipl-2026",
        "eventName": "RCB vs MI",
        "status": "active",
        "hostId": "host-1",
        "createdAt": now,
        "expiresAt": None,
        "roomType": "match",
        "parentRoomCode": "ABCDE2",
        "matchDetails": {
            "team1": "RCB",
            "team2": "MI",
            "matchDateTime": "2026-03-15T14:00:00Z",
        },
        "participants": ["host-1"],
        "version": 3,
    }
    room = Room.from_dict(data)
    assert room.room_type == "match"
    assert room.parent_room_code == "ABCDE2"
    assert room.match_details is not None
    assert room.match_details.team1 == "RCB"
    assert room.version == 3


@pytest.mark.unit
def test_room_from_dict_legacy_no_tournament_fields():
    """Test deserialization of legacy data without tournament fields"""
    now = datetime.utcnow()
    data = {
        "code": "AAAA",
        "eventTemplate": "grammys-2026",
        "status": "waiting",
        "hostId": "host-1",
        "createdAt": now,
        "expiresAt": now + timedelta(hours=24),
    }
    room = Room.from_dict(data)
    # Should default to event room
    assert room.room_type == "event"
    assert room.parent_room_code is None
    assert room.match_details is None
    assert room.participants == []
    assert room.version == 1
