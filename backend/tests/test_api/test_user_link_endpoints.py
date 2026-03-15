"""
Tests for user link API endpoints

Tests verify:
- GET /api/rooms/{code}/participants-with-links
  - 403 if not room host
  - 200 returns participants with userKey
  - Backfills missing keys
- GET /api/rooms/{code}/users/{user_key}
  - 400 for invalid format
  - 404 for not found room
  - 404 for not found user
  - 429 for rate limit
  - 200 returns user data without userKey
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from main import app, session_restore_limiter
from models.room import Room
from models.user import User


@pytest.fixture
def client():
    """Test client fixture"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_room():
    return Room(
        code="AAAA",
        event_template="custom",
        event_name="Test Event",
        host_id="host-user-id",
        status="active",
        automation_enabled=False,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_users():
    return [
        User(
            user_id="host-user-id",
            room_code="AAAA",
            nickname="Host",
            points=1000,
            is_admin=True,
            user_key="hK3mN8pQ",
        ),
        User(
            user_id="user-2",
            room_code="AAAA",
            nickname="Alice",
            points=850,
            is_admin=False,
            user_key="xY7kM9zQ",
        ),
    ]


# ============================================================================
# GET /api/rooms/{code}/participants-with-links
# ============================================================================

@pytest.mark.unit
def test_participants_with_links_requires_host(client, mock_room):
    """Should return 403 if caller is not the room host"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room):
        response = client.get(
            "/api/rooms/AAAA/participants-with-links",
            headers={"X-Host-Id": "wrong-user-id"},
        )
        assert response.status_code == 403


@pytest.mark.unit
def test_participants_with_links_missing_header(client, mock_room):
    """Should return 422 if X-Host-Id header is missing"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room):
        response = client.get("/api/rooms/AAAA/participants-with-links")
        assert response.status_code == 422


@pytest.mark.unit
def test_participants_with_links_success(client, mock_room, mock_users):
    """Should return participants with userKey included"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_users_in_room", new_callable=AsyncMock, return_value=mock_users), \
         patch("services.user_service.ensure_user_has_key", new_callable=AsyncMock,
               side_effect=lambda u: u):

        response = client.get(
            "/api/rooms/AAAA/participants-with-links",
            headers={"X-Host-Id": "host-user-id"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 2

        # All participants should have userKey
        for p in data["participants"]:
            assert "userKey" in p
            assert "userId" in p
            assert "nickname" in p


@pytest.mark.unit
def test_participants_with_links_backfills(client, mock_room):
    """Should backfill missing keys for existing users"""
    user_without_key = User(
        user_id="user-no-key",
        room_code="AAAA",
        nickname="Bob",
        points=1000,
        is_admin=False,
        user_key=None,
    )
    user_with_key = user_without_key.model_copy(update={"user_key": "newKey12"})

    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_users_in_room", new_callable=AsyncMock,
               return_value=[user_without_key]), \
         patch("services.user_service.ensure_user_has_key", new_callable=AsyncMock,
               return_value=user_with_key):

        response = client.get(
            "/api/rooms/AAAA/participants-with-links",
            headers={"X-Host-Id": "host-user-id"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["userKey"] == "newKey12"


@pytest.mark.unit
def test_participants_with_links_skips_failed_backfill(client, mock_room):
    """Should skip participants where key generation fails"""
    user_without_key = User(
        user_id="user-no-key",
        room_code="AAAA",
        nickname="Bob",
        points=1000,
        is_admin=False,
        user_key=None,
    )

    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_users_in_room", new_callable=AsyncMock,
               return_value=[user_without_key]), \
         patch("services.user_service.ensure_user_has_key", new_callable=AsyncMock,
               side_effect=ValueError("Failed to generate")):

        response = client.get(
            "/api/rooms/AAAA/participants-with-links",
            headers={"X-Host-Id": "host-user-id"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 0  # Skipped failed user


# ============================================================================
# GET /api/rooms/{code}/users/{user_key}
# ============================================================================

@pytest.mark.unit
def test_get_user_by_key_invalid_format(client, mock_room):
    """Should return 400 for invalid userKey format"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room):
        # Too short
        response = client.get("/api/rooms/AAAA/users/abc")
        assert response.status_code == 400

        # Contains invalid chars (O, 0, I, L, 1)
        response = client.get("/api/rooms/AAAA/users/OOOO0000")
        assert response.status_code == 400

        # Too long
        response = client.get("/api/rooms/AAAA/users/xY7kM9zQx")
        assert response.status_code == 400


@pytest.mark.unit
def test_get_user_by_key_room_not_found(client):
    """Should return 404 when room doesn't exist"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=None):
        response = client.get("/api/rooms/XXXX/users/xY7kM9zQ")
        assert response.status_code == 404


@pytest.mark.unit
def test_get_user_by_key_user_not_found(client, mock_room):
    """Should return 404 when user with key doesn't exist"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock, return_value=None):
        response = client.get("/api/rooms/AAAA/users/xY7kM9zQ")
        assert response.status_code == 404


@pytest.mark.unit
def test_get_user_by_key_success(client, mock_room):
    """Should return user data without userKey"""
    found_user = User(
        user_id="user-123",
        room_code="AAAA",
        nickname="Alice",
        points=850,
        is_admin=False,
        user_key="xY7kM9zQ",
    )

    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock, return_value=found_user):
        response = client.get("/api/rooms/AAAA/users/xY7kM9zQ")
        assert response.status_code == 200
        data = response.json()
        assert data["userId"] == "user-123"
        assert data["nickname"] == "Alice"
        assert data["points"] == 850
        assert data["roomCode"] == "AAAA"
        # userKey should NOT be in response
        assert "userKey" not in data


@pytest.mark.unit
def test_get_user_by_key_rate_limited(client, mock_room):
    """Should return 429 after exceeding rate limit"""
    # Reset the rate limiter
    session_restore_limiter._requests.clear()

    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock, return_value=None):

        # Make 60 requests (all should pass, last ones may be 404)
        for i in range(60):
            client.get("/api/rooms/AAAA/users/xY7kM9zQ")

        # 61st request should be rate limited
        response = client.get("/api/rooms/AAAA/users/xY7kM9zQ")
        assert response.status_code == 429

    # Clean up
    session_restore_limiter._requests.clear()


@pytest.mark.unit
def test_get_user_by_key_failed_precondition(client, mock_room):
    """Should return 503 when Firestore index is not ready"""
    with patch("services.room_service.get_room", new_callable=AsyncMock, return_value=mock_room), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock,
               side_effect=Exception("FAILED_PRECONDITION: index not ready")):
        response = client.get("/api/rooms/AAAA/users/xY7kM9zQ")
        assert response.status_code == 503
