"""
Tests for Room API endpoints

Tests verify endpoint contracts and error handling with mocked services.
No Firestore operations - all services are mocked.

Endpoints tested:
- POST /api/rooms (create room)
- GET /api/rooms/{code} (get room)
- POST /api/rooms/{code}/join (join room)
- GET /api/rooms/{code}/participants (get participants)
- GET /api/rooms/{code}/leaderboard (get leaderboard)
- POST /api/rooms/{code}/start (start room)
- POST /api/rooms/{code}/finish (finish room)
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from datetime import datetime
from main import app
from models.room import Room
from models.user import User


@pytest.fixture
def client():
    """Test client fixture"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_room_success():
    """Test successful room creation"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="host-user-id",
        status="waiting",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_host = User(
        user_id="host-user-id",
        room_code="AAAA",
        nickname="Host",
        points=1000,
        is_admin=True,
    )

    with patch("services.room_service.create_room", return_value=mock_room) as mock_create_room, \
         patch("services.user_service.create_user", return_value=mock_host) as mock_create_user, \
         patch("services.room_service.update_room", return_value=None) as mock_update_room, \
         patch("services.template_service.create_bets_from_template", return_value=[]) as mock_create_bets:

        response = client.post(
            "/api/rooms",
            json={
                "event_template": "grammys-2026",
                "event_name": "Grammy Awards 2026",
                "host_nickname": "Host",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["room_code"] == "AAAA"
        assert data["host_id"] == "host-user-id"
        assert data["user_id"] == "host-user-id"

        # Verify calls
        mock_create_room.assert_called_once()
        mock_create_user.assert_called_once()
        mock_update_room.assert_called_once()
        mock_create_bets.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_room_custom_template():
    """Test room creation with custom template (no bets created)"""
    mock_room = Room(
        code="AAAA",
        event_template="custom",
        event_name=None,
        host_id="host-user-id",
        status="waiting",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_host = User(
        user_id="host-user-id",
        room_code="AAAA",
        nickname="Host",
        points=1000,
        is_admin=True,
    )

    with patch("services.room_service.create_room", return_value=mock_room), \
         patch("services.user_service.create_user", return_value=mock_host), \
         patch("services.room_service.update_room"), \
         patch("services.template_service.create_bets_from_template") as mock_create_bets:

        response = client.post(
            "/api/rooms",
            json={
                "event_template": "custom",
                "host_nickname": "Host",
            },
        )

        assert response.status_code == 200
        # Should not call create_bets_from_template for custom template
        mock_create_bets.assert_not_called()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_success():
    """Test getting room details"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="host-user-id",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room", return_value=mock_room):
        response = client.get("/api/rooms/AAAA")

        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "AAAA"
        assert data["status"] == "active"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_room_not_found():
    """Test getting non-existent room"""
    with patch("services.room_service.get_room", return_value=None):
        response = client.get("/api/rooms/ZZZZ")

        assert response.status_code == 404
        assert "Room not found" in response.json()["detail"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_join_room_success():
    """Test joining a room"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        event_name="Grammy Awards 2026",
        host_id="host-user-id",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_user = User(
        user_id="new-user-id",
        room_code="AAAA",
        nickname="Guest",
        points=1000,
        is_admin=False,
    )

    with patch("services.room_service.get_room", return_value=mock_room), \
         patch("services.user_service.create_user", return_value=mock_user):

        response = client.post(
            "/api/rooms/AAAA/join",
            json={"nickname": "Guest"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "new-user-id"
        assert "room" in data
        assert "user" in data


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_participants():
    """Test getting room participants"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_participants = [
        User(user_id="user1", room_code="AAAA", nickname="User1", points=1000),
        User(user_id="user2", room_code="AAAA", nickname="User2", points=1100),
    ]

    with patch("services.room_service.get_room", return_value=mock_room), \
         patch("services.room_service.get_room_participants", return_value=mock_participants):

        response = client.get("/api/rooms/AAAA/participants")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert len(data["participants"]) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_leaderboard():
    """Test getting room leaderboard"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_leaderboard = [
        {"userId": "user1", "nickname": "User1", "points": 1200, "rank": 1},
        {"userId": "user2", "nickname": "User2", "points": 1000, "rank": 2},
    ]

    with patch("services.room_service.get_room", return_value=mock_room), \
         patch("services.user_service.calculate_and_get_leaderboard", return_value=mock_leaderboard):

        response = client.get("/api/rooms/AAAA/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        assert len(data["leaderboard"]) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_start_room():
    """Test starting a room (host only)"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="waiting",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room", return_value=mock_room), \
         patch("services.room_service.set_room_status") as mock_set_status:

        response = client.post(
            "/api/rooms/AAAA/start",
            headers={"X-Host-Id": "host-user-id"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "active"
        mock_set_status.assert_called_once_with("AAAA", "active")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_finish_room():
    """Test finishing a room (host only)"""
    mock_room = Room(
        code="AAAA",
        event_template="grammys-2026",
        host_id="host-user-id",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )

    mock_leaderboard = [
        {"userId": "user1", "nickname": "User1", "points": 1200, "rank": 1},
    ]

    with patch("services.room_service.get_room", return_value=mock_room), \
         patch("services.room_service.set_room_status") as mock_set_status, \
         patch("services.user_service.calculate_and_get_leaderboard", return_value=mock_leaderboard):

        response = client.post(
            "/api/rooms/AAAA/finish",
            headers={"X-Host-Id": "host-user-id"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "finished"
        assert "leaderboard" in data
        mock_set_status.assert_called_once_with("AAAA", "finished")
