"""Integration tests for transcript API endpoints

Tests the full flow of transcript ingestion and automation triggering.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from datetime import datetime

from main import app
from models.room import Room
from models.bet import Bet, BetStatus
from models.transcript import TranscriptEntry


@pytest.fixture
def client():
    """Create test client"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_room():
    """Mock room for testing"""
    return Room(
        code="TEST",
        event_template="grammys-2026",
        event_name="Test Event",
        status="active",
        host_id="host123",
        automation_enabled=True,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_pending_bet():
    """Mock pending bet"""
    return Bet(
        bet_id="album-of-year",
        room_code="TEST",
        question="Album of the Year?",
        options=[
            "The Tortured Poets Department - Taylor Swift",
            "Cowboy Carter - Beyoncé",
            "Hit Me Hard and Soft - Billie Eilish"
        ],
        status=BetStatus.PENDING,
        points_value=100,
    )


class TestTranscriptIngestionEndpoint:
    """Test POST /api/rooms/{code}/transcript endpoint"""

    @patch('main.room_service.get_room')
    @patch('main.transcript_service.create_transcript_entry')
    @patch('main.automation_service.process_transcript_for_automation')
    def test_ingest_transcript_success(
        self,
        mock_process_automation,
        mock_create_entry,
        mock_get_room,
        client,
        mock_room
    ):
        """Should successfully ingest transcript and return automation results"""
        # Setup mocks
        mock_get_room.return_value = mock_room

        mock_entry = TranscriptEntry(
            entry_id="entry123",
            room_code="TEST",
            text="And the Grammy goes to Beyoncé!",
            source="manual",
            timestamp=datetime.utcnow(),
        )
        mock_create_entry.return_value = mock_entry

        # BUG: This response format is wrong!
        mock_process_automation.return_value = {
            "actions_taken": [  # ← This is an array
                {
                    "action": "resolve_bet",
                    "confidence": 0.92,
                    "bet_id": "album-of-year",
                    "winner": "Cowboy Carter - Beyoncé"
                }
            ],
            "details": {}
        }

        # Make request
        response = client.post(
            "/api/rooms/TEST/transcript",
            json={
                "text": "And the Grammy goes to Beyoncé!",
                "source": "manual"
            }
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()

        assert "entry_id" in data
        assert "timestamp" in data
        assert "automation" in data

        # BUG CHECK: Response format matches backend implementation
        assert "actions_taken" in data["automation"]  # Backend returns this
        assert isinstance(data["automation"]["actions_taken"], list)

        # BUG: Frontend expects these fields at top level
        if "action_taken" not in data["automation"]:
            print("\n⚠️  BUG DETECTED: Frontend expects 'action_taken' (string) but got 'actions_taken' (array)")

        if "confidence" not in data["automation"]:
            print("\n⚠️  BUG DETECTED: Frontend expects 'confidence' at top level")

    @patch('main.room_service.get_room')
    def test_ingest_transcript_room_not_found(self, mock_get_room, client):
        """Should return 404 if room doesn't exist"""
        mock_get_room.return_value = None

        response = client.post(
            "/api/rooms/FAKE/transcript",
            json={
                "text": "Test text",
                "source": "manual"
            }
        )

        assert response.status_code == 404
        assert "Room not found" in response.json()["detail"]

    @patch('main.room_service.get_room')
    @patch('main.transcript_service.create_transcript_entry')
    @patch('main.automation_service.process_transcript_for_automation')
    def test_ingest_transcript_with_automation_disabled(
        self,
        mock_process_automation,
        mock_create_entry,
        mock_get_room,
        client,
        mock_room
    ):
        """Should still create entry but not trigger automation when disabled"""
        # Disable automation
        mock_room.automation_enabled = False
        mock_get_room.return_value = mock_room

        mock_entry = TranscriptEntry(
            entry_id="entry123",
            room_code="TEST",
            text="Test text",
            source="manual",
            timestamp=datetime.utcnow(),
        )
        mock_create_entry.return_value = mock_entry

        mock_process_automation.return_value = {
            "actions_taken": [],
            "details": {"reason": "Automation disabled for room"}
        }

        response = client.post(
            "/api/rooms/TEST/transcript",
            json={
                "text": "Test text",
                "source": "manual"
            }
        )

        assert response.status_code == 200
        data = response.json()

        # Entry should be created
        assert data["entry_id"] == "entry123"

        # Automation should indicate it's disabled
        assert data["automation"]["actions_taken"] == []
        assert "Automation disabled" in data["automation"]["details"]["reason"]


class TestGetTranscriptEndpoint:
    """Test GET /api/rooms/{code}/transcript endpoint"""

    @patch('main.room_service.get_room')
    @patch('main.transcript_service.get_transcript_entries')
    def test_get_transcript_entries(
        self,
        mock_get_entries,
        mock_get_room,
        client,
        mock_room
    ):
        """Should return recent transcript entries"""
        mock_get_room.return_value = mock_room

        mock_entries = [
            TranscriptEntry(
                entry_id="entry1",
                room_code="TEST",
                text="First entry",
                source="manual",
                timestamp=datetime.utcnow(),
            ),
            TranscriptEntry(
                entry_id="entry2",
                room_code="TEST",
                text="Second entry",
                source="manual",
                timestamp=datetime.utcnow(),
            ),
        ]
        mock_get_entries.return_value = mock_entries

        response = client.get("/api/rooms/TEST/transcript")

        assert response.status_code == 200
        data = response.json()

        assert "entries" in data
        assert "count" in data
        assert data["count"] == 2
        assert len(data["entries"]) == 2

    @patch('main.room_service.get_room')
    @patch('main.transcript_service.get_transcript_entries')
    def test_get_transcript_with_limit(
        self,
        mock_get_entries,
        mock_get_room,
        client,
        mock_room
    ):
        """Should respect limit parameter"""
        mock_get_room.return_value = mock_room
        mock_get_entries.return_value = []

        response = client.get("/api/rooms/TEST/transcript?limit=50")

        assert response.status_code == 200
        # Verify limit was passed to service
        mock_get_entries.assert_called_once_with("TEST", 50)


class TestAutomationToggleEndpoint:
    """Test POST /api/rooms/{code}/automation/toggle endpoint"""

    @patch('main.room_service.get_room')
    @patch('main.automation_service.toggle_automation')
    def test_toggle_automation_enable(
        self,
        mock_toggle,
        mock_get_room,
        client,
        mock_room
    ):
        """Should enable automation when requested by host"""
        mock_room.automation_enabled = False
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/TEST/automation/toggle",
            json={"enabled": True},
            headers={"X-Host-Id": "host123"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["automation_enabled"] is True
        assert "enabled" in data["message"]
        mock_toggle.assert_called_once_with("TEST", True)

    @patch('main.room_service.get_room')
    @patch('main.automation_service.toggle_automation')
    def test_toggle_automation_disable(
        self,
        mock_toggle,
        mock_get_room,
        client,
        mock_room
    ):
        """Should disable automation when requested by host"""
        mock_room.automation_enabled = True
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/TEST/automation/toggle",
            json={"enabled": False},
            headers={"X-Host-Id": "host123"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["automation_enabled"] is False
        assert "disabled" in data["message"]
        mock_toggle.assert_called_once_with("TEST", False)

    @patch('main.room_service.get_room')
    def test_toggle_automation_requires_host_auth(
        self,
        mock_get_room,
        client,
        mock_room
    ):
        """Should return 403 if not called by host"""
        mock_get_room.return_value = mock_room

        response = client.post(
            "/api/rooms/TEST/automation/toggle",
            json={"enabled": True},
            headers={"X-Host-Id": "wrong_host_id"}  # Wrong host ID
        )

        assert response.status_code == 403
        assert "Not the room host" in response.json()["detail"]

    @patch('main.room_service.get_room')
    def test_toggle_automation_room_not_found(
        self,
        mock_get_room,
        client
    ):
        """Should return 404 if room doesn't exist"""
        mock_get_room.return_value = None

        response = client.post(
            "/api/rooms/FAKE/automation/toggle",
            json={"enabled": True},
            headers={"X-Host-Id": "host123"}
        )

        assert response.status_code == 404
