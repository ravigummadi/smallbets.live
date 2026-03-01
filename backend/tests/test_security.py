"""
Security and authorization tests for SmallBets.live

HIGHEST PRIORITY: These tests verify cross-room authorization vulnerabilities
and unauthorized actions are properly rejected.

Tests marked with @pytest.mark.security for selective execution.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from main import app
from models.room import Room
from models.user import User
from models.bet import Bet, BetStatus
from models.user_bet import UserBet
from datetime import datetime


@pytest.fixture
def client():
    """Test client fixture"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_room_a():
    """Room A fixture"""
    return Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-room-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_room_b():
    """Room B fixture"""
    return Room(
        code="BBBB",
        event_template="test-event",
        host_id="host-room-b",
        event_name="Event B",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_user_room_a():
    """User in Room A"""
    return User(
        user_id="user-room-a",
        room_code="AAAA",
        nickname="UserA",
        points=1000,
        is_admin=False,
    )


@pytest.fixture
def mock_bet_room_a():
    """Bet in Room A"""
    return Bet(
        bet_id="bet-room-a",
        room_code="AAAA",
        question="Test Question A?",
        options=["Option 1", "Option 2"],
        status=BetStatus.OPEN,
        points_value=100,
    )


@pytest.fixture
def mock_bet_room_b():
    """Bet in Room B"""
    return Bet(
        bet_id="bet-room-b",
        room_code="BBBB",
        question="Test Question B?",
        options=["Option 1", "Option 2"],
        status=BetStatus.OPEN,
        points_value=100,
    )


# ============================================================================
# Cross-Room Authorization Tests
# ============================================================================


@pytest.mark.security
@pytest.mark.asyncio
async def test_host_cannot_lock_bet_in_different_room(
    client, mock_room_a, mock_room_b, mock_bet_room_b
):
    """Test that host from room A cannot lock bets in room B"""
    with patch("services.room_service.get_room") as mock_get_room, \
         patch("services.bet_service.lock_bet") as mock_lock_bet, \
         patch("services.bet_service.get_bet") as mock_get_bet:

        mock_get_room.return_value = mock_room_b
        mock_get_bet.return_value = mock_bet_room_b
        mock_lock_bet.return_value = mock_bet_room_b

        response = client.post(
            "/api/rooms/BBBB/bets/lock",
            json={"bet_id": "bet-room-b"},
            headers={"X-Host-Id": "host-room-a"},  # Wrong host!
        )

        assert response.status_code == 403
        assert "Not the room host" in response.json()["detail"]


@pytest.mark.security
@pytest.mark.asyncio
async def test_host_cannot_resolve_bet_in_different_room(
    client, mock_room_a, mock_room_b, mock_bet_room_b
):
    """Test that host from room A cannot resolve bets in room B"""
    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room_b

        response = client.post(
            "/api/rooms/BBBB/bets/bet-room-b/resolve",
            json={"winning_option": "Option 1"},
            headers={"X-Host-Id": "host-room-a"},  # Wrong host!
        )

        assert response.status_code == 403
        assert "Not the room host" in response.json()["detail"]


@pytest.mark.security
@pytest.mark.asyncio
async def test_user_cannot_place_bet_on_different_room(
    client, mock_room_a, mock_room_b, mock_bet_room_b, mock_user_room_a
):
    """Test that user from room A cannot place bets on room B's bets"""
    with patch("services.room_service.get_room") as mock_get_room, \
         patch("services.bet_service.place_user_bet") as mock_place_bet, \
         patch("services.bet_service.get_bet") as mock_get_bet, \
         patch("services.user_service.get_user") as mock_get_user:

        mock_get_room.return_value = mock_room_b
        mock_get_bet.return_value = mock_bet_room_b
        mock_get_user.return_value = mock_user_room_a

        # User validates room membership, so the error should come from
        # room_code mismatch validation in service layer
        mock_place_bet.side_effect = ValueError("User not in bet's room")

        response = client.post(
            "/api/rooms/BBBB/bets/place",
            json={"bet_id": "bet-room-b", "selected_option": "Option 1"},
            headers={"X-User-Id": "user-room-a"},
        )

        # Should reject with 400 Bad Request
        assert response.status_code == 400
        assert "User not in bet's room" in response.json()["detail"]


@pytest.mark.security
@pytest.mark.asyncio
async def test_bet_operations_verify_bet_belongs_to_room(client):
    """Test that bet operations verify bet.room_code == room.code"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    # Bet that claims to be in room AAAA but actually in BBBB
    mock_bet_wrong_room = Bet(
        bet_id="bet-id",
        room_code="BBBB",  # Wrong room!
        question="Test Question?",
        options=["Option 1", "Option 2"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    with patch("services.room_service.get_room") as mock_get_room, \
         patch("services.bet_service.get_bet") as mock_get_bet:

        mock_get_room.return_value = mock_room
        mock_get_bet.return_value = mock_bet_wrong_room

        response = client.get("/api/rooms/AAAA/bets/bet-id")

        # Should reject with 400
        assert response.status_code == 400
        assert "does not belong to this room" in response.json()["detail"]


# ============================================================================
# Unauthorized Action Tests
# ============================================================================


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_lock_bet(client):
    """Test that non-host users cannot lock bets"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/bets/lock",
            json={"bet_id": "bet-id"},
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_resolve_bet(client):
    """Test that non-host users cannot resolve bets"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/bets/bet-id/resolve",
            json={"winning_option": "Option 1"},
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_create_bet(client):
    """Test that non-host users cannot create bets"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/bets",
            json={
                "question": "Test Question?",
                "options": ["Option 1", "Option 2"],
                "pointsValue": 100,
            },
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_start_room(client):
    """Test that non-host users cannot start the room"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="waiting",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/start",
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_finish_room(client):
    """Test that non-host users cannot finish the room"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/finish",
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


@pytest.mark.security
@pytest.mark.asyncio
async def test_non_host_cannot_toggle_automation(client):
    """Test that non-host users cannot toggle automation"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/automation/toggle",
            json={"enabled": True},
            headers={"X-Host-Id": "not-the-host"},
        )

        assert response.status_code == 403


# ============================================================================
# Missing or Invalid Header Tests
# ============================================================================


@pytest.mark.security
@pytest.mark.asyncio
async def test_bet_operations_require_host_header(client):
    """Test that bet operations require X-Host-Id header"""
    response = client.post(
        "/api/rooms/AAAA/bets/lock",
        json={"bet_id": "bet-id"},
        # No X-Host-Id header
    )

    # FastAPI returns 422 for missing required headers
    assert response.status_code == 422


@pytest.mark.security
@pytest.mark.asyncio
async def test_place_bet_requires_user_header(client):
    """Test that placing bets requires X-User-Id header"""
    mock_room = Room(
        code="AAAA",
        event_template="test-event",
        host_id="host-a",
        event_name="Event A",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )

    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/AAAA/bets/place",
            json={"bet_id": "bet-id", "selected_option": "Option 1"},
            # No X-User-Id header
        )

        # FastAPI returns 422 for missing required headers
        assert response.status_code == 422


@pytest.mark.security
@pytest.mark.asyncio
async def test_invalid_room_code_returns_404(client):
    """Test that invalid room codes return 404"""
    with patch("services.room_service.get_room") as mock_get_room:
        mock_get_room.return_value = None

        response = client.get("/api/rooms/ZZZZ")

        assert response.status_code == 404
        assert "Room not found" in response.json()["detail"]
