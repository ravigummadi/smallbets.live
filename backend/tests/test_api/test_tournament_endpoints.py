"""
Tests for Tournament API endpoints

Tests verify endpoint contracts and error handling with mocked services.

Endpoints tested:
- POST /api/tournaments (create tournament)
- POST /api/rooms/{code}/matches (create match room)
- GET /api/rooms/{code}/matches (get match rooms)
- GET /api/rooms/{code}/tournament-stats (get tournament stats)
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from main import app
from models.room import Room, MatchDetails
from models.user import User
from models.bet import Bet, BetStatus


@pytest.fixture
def client():
    """Test client fixture"""
    with TestClient(app) as test_client:
        yield test_client


def make_tournament_room(**overrides) -> Room:
    """Helper to create a tournament room"""
    defaults = dict(
        code="ABCDEF",
        event_template="ipl-2026",
        event_name="IPL 2026",
        host_id="host-123",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
        expires_at=None,
        room_type="tournament",
    )
    defaults.update(overrides)
    return Room(**defaults)


def make_match_room(**overrides) -> Room:
    """Helper to create a match room"""
    defaults = dict(
        code="GHIJKL",
        event_template="ipl-2026",
        event_name="MI vs CSK",
        host_id="host-123",
        status="active",
        automation_enabled=True,
        created_at=datetime.utcnow(),
        expires_at=None,
        room_type="match",
        parent_room_code="ABCDEF",
        match_details=MatchDetails(
            team1="Mumbai Indians",
            team2="Chennai Super Kings",
            match_date_time="2026-04-01T19:30:00+05:30",
            venue="Wankhede Stadium",
            title="IPL Match 1",
        ),
    )
    defaults.update(overrides)
    return Room(**defaults)


def make_user(**overrides) -> User:
    """Helper to create a user"""
    defaults = dict(
        user_id="host-123",
        room_code="ABCDEF",
        nickname="Host",
        points=1000,
        is_admin=True,
        user_key="ABCD1234",
    )
    defaults.update(overrides)
    return User(**defaults)


class TestCreateTournament:
    """Test POST /api/tournaments endpoint"""

    @patch("services.room_service.create_tournament_room")
    @patch("services.user_service.create_user")
    @patch("services.room_service.update_room")
    @patch("services.room_service.create_room_user")
    @patch("services.template_service.create_bets_from_template")
    def test_create_tournament_success(
        self, mock_template, mock_room_user, mock_update, mock_create_user,
        mock_create_room, client,
    ):
        mock_room = make_tournament_room()
        mock_host = make_user()

        mock_create_room.return_value = mock_room
        mock_create_user.return_value = mock_host
        mock_update.return_value = None
        mock_room_user.return_value = None
        mock_template.return_value = []

        response = client.post("/api/tournaments", json={
            "event_template": "ipl-2026",
            "event_name": "IPL 2026",
            "host_nickname": "HostUser",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["room_code"] == "ABCDEF"
        assert data["host_id"] == "host-123"
        assert data["user_id"] == "host-123"
        assert data["user_key"] == "ABCD1234"

    @patch("services.room_service.create_tournament_room")
    @patch("services.user_service.create_user")
    @patch("services.room_service.update_room")
    @patch("services.room_service.create_room_user")
    def test_create_tournament_custom_template_skips_bets(
        self, mock_room_user, mock_update, mock_create_user,
        mock_create_room, client,
    ):
        mock_create_room.return_value = make_tournament_room()
        mock_create_user.return_value = make_user()
        mock_update.return_value = None
        mock_room_user.return_value = None

        response = client.post("/api/tournaments", json={
            "event_template": "custom",
            "host_nickname": "Host",
        })

        assert response.status_code == 200

    @patch("services.room_service.create_tournament_room")
    def test_create_tournament_validation_error(self, mock_create_room, client):
        mock_create_room.side_effect = ValueError("Invalid template")

        response = client.post("/api/tournaments", json={
            "event_template": "invalid",
            "host_nickname": "Host",
        })

        assert response.status_code == 400
        assert "Invalid template" in response.json()["detail"]

    @patch("services.room_service.create_tournament_room")
    def test_create_tournament_server_error(self, mock_create_room, client):
        mock_create_room.side_effect = RuntimeError("DB down")

        response = client.post("/api/tournaments", json={
            "event_template": "ipl-2026",
            "host_nickname": "Host",
        })

        assert response.status_code == 500
        assert "Failed to create tournament" in response.json()["detail"]

    def test_create_tournament_missing_fields(self, client):
        response = client.post("/api/tournaments", json={})
        assert response.status_code == 422  # Pydantic validation error


class TestCreateMatchRoom:
    """Test POST /api/rooms/{code}/matches endpoint"""

    @patch("main.room_service.get_room")
    @patch("services.room_service.create_match_room")
    def test_create_match_room_success(self, mock_create_match, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room()
        mock_create_match.return_value = make_match_room()

        response = client.post(
            "/api/rooms/ABCDEF/matches",
            json={
                "team1": "Mumbai Indians",
                "team2": "Chennai Super Kings",
                "match_date_time": "2026-04-01T19:30:00+05:30",
                "venue": "Wankhede Stadium",
                "title": "IPL Match 1",
            },
            headers={"X-Host-Id": "host-123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["room_code"] == "GHIJKL"
        assert data["parent_room_code"] == "ABCDEF"

    @patch("main.room_service.get_room")
    def test_create_match_room_from_non_tournament(self, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room(room_type="event")

        response = client.post(
            "/api/rooms/ABCDEF/matches",
            json={
                "team1": "A",
                "team2": "B",
                "match_date_time": "2026-04-01T19:30:00+05:30",
            },
            headers={"X-Host-Id": "host-123"},
        )

        assert response.status_code == 400
        assert "tournament" in response.json()["detail"].lower()

    @patch("main.room_service.get_room")
    def test_create_match_room_not_host(self, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room()

        response = client.post(
            "/api/rooms/ABCDEF/matches",
            json={
                "team1": "A",
                "team2": "B",
                "match_date_time": "2026-04-01T19:30:00+05:30",
            },
            headers={"X-Host-Id": "wrong-user"},
        )

        assert response.status_code == 403

    @patch("main.room_service.get_room")
    def test_create_match_room_not_found(self, mock_get_room, client):
        mock_get_room.return_value = None

        response = client.post(
            "/api/rooms/NOPE/matches",
            json={
                "team1": "A",
                "team2": "B",
                "match_date_time": "2026-04-01T19:30:00+05:30",
            },
            headers={"X-Host-Id": "host-123"},
        )

        assert response.status_code == 404

    @patch("main.room_service.get_room")
    @patch("services.room_service.create_match_room")
    def test_create_match_room_service_error(self, mock_create, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room()
        mock_create.side_effect = ValueError("Max matches reached")

        response = client.post(
            "/api/rooms/ABCDEF/matches",
            json={
                "team1": "A",
                "team2": "B",
                "match_date_time": "2026-04-01T19:30:00+05:30",
            },
            headers={"X-Host-Id": "host-123"},
        )

        assert response.status_code == 400
        assert "Max matches" in response.json()["detail"]


class TestGetMatchRooms:
    """Test GET /api/rooms/{code}/matches endpoint"""

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    def test_get_match_rooms_success(self, mock_get_children, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room()
        match1 = make_match_room(code="MATCH1")
        match2 = make_match_room(code="MATCH2")
        mock_get_children.return_value = [match1, match2]

        response = client.get("/api/rooms/ABCDEF/matches")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert len(data["matches"]) == 2

    @patch("main.room_service.get_room")
    def test_get_match_rooms_not_tournament(self, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room(room_type="event")

        response = client.get("/api/rooms/ABCDEF/matches")

        assert response.status_code == 400
        assert "Not a tournament" in response.json()["detail"]

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    def test_get_match_rooms_empty(self, mock_get_children, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room()
        mock_get_children.return_value = []

        response = client.get("/api/rooms/ABCDEF/matches")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["matches"] == []


class TestGetTournamentStats:
    """Test GET /api/rooms/{code}/tournament-stats endpoint"""

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    @patch("main.bet_service.get_bets_in_room")
    @patch("main.room_service.get_room_users")
    @patch("main.bet_service.get_user_bets_for_bets")
    def test_tournament_stats_success(
        self, mock_user_bets, mock_room_users, mock_get_bets,
        mock_get_children, mock_get_room, client,
    ):
        mock_get_room.return_value = make_tournament_room()

        match_room = make_match_room(code="MATCH1")
        mock_get_children.return_value = [match_room]

        resolved_bet = Bet(
            bet_id="bet-1",
            room_code="MATCH1",
            question="Who wins?",
            options=["MI", "CSK"],
            status=BetStatus.RESOLVED,
            points_value=100,
            winning_option="MI",
        )
        mock_get_bets.return_value = [resolved_bet]

        # Create a mock RoomUser
        room_user = MagicMock()
        room_user.user_id = "user-1"
        room_user.nickname = "Player1"
        room_user.points = 1100
        mock_room_users.return_value = [room_user]

        # Mock user bets
        user_bet = MagicMock()
        user_bet.user_id = "user-1"
        user_bet.points_won = 200
        mock_user_bets.return_value = [user_bet]

        response = client.get("/api/rooms/ABCDEF/tournament-stats")

        assert response.status_code == 200
        data = response.json()
        assert len(data["matches"]) == 1
        assert data["matches"][0]["roomCode"] == "MATCH1"
        assert data["matches"][0]["totalBets"] == 1
        assert data["matches"][0]["participants"] == 1
        assert "user-1" in data["userStats"]
        assert data["userStats"]["user-1"]["totalBetsPlaced"] == 1
        assert data["userStats"]["user-1"]["totalBetsWon"] == 1

    @patch("main.room_service.get_room")
    def test_tournament_stats_not_tournament(self, mock_get_room, client):
        mock_get_room.return_value = make_tournament_room(room_type="event")

        response = client.get("/api/rooms/ABCDEF/tournament-stats")

        assert response.status_code == 400
        assert "Not a tournament" in response.json()["detail"]

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    @patch("main.bet_service.get_bets_in_room")
    @patch("main.room_service.get_room_users")
    @patch("main.bet_service.get_user_bets_for_bets")
    def test_tournament_stats_no_matches(
        self, mock_user_bets, mock_room_users, mock_get_bets,
        mock_get_children, mock_get_room, client,
    ):
        mock_get_room.return_value = make_tournament_room()
        mock_get_children.return_value = []

        response = client.get("/api/rooms/ABCDEF/tournament-stats")

        assert response.status_code == 200
        data = response.json()
        assert data["matches"] == []
        assert data["userStats"] == {}

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    @patch("main.bet_service.get_bets_in_room")
    @patch("main.room_service.get_room_users")
    @patch("main.bet_service.get_user_bets_for_bets")
    def test_tournament_stats_multiple_matches_aggregation(
        self, mock_user_bets, mock_room_users, mock_get_bets,
        mock_get_children, mock_get_room, client,
    ):
        mock_get_room.return_value = make_tournament_room()

        match1 = make_match_room(code="MATCH1", event_name="Match 1")
        match2 = make_match_room(code="MATCH2", event_name="Match 2")
        mock_get_children.return_value = [match1, match2]

        # Both matches have resolved bets
        resolved_bet = Bet(
            bet_id="bet-1",
            room_code="MATCH1",
            question="Q?",
            options=["A", "B"],
            status=BetStatus.RESOLVED,
            points_value=100,
        )
        mock_get_bets.return_value = [resolved_bet]

        room_user = MagicMock()
        room_user.user_id = "user-1"
        room_user.nickname = "Player1"
        room_user.points = 1100
        mock_room_users.return_value = [room_user]

        user_bet = MagicMock()
        user_bet.user_id = "user-1"
        user_bet.points_won = 100
        mock_user_bets.return_value = [user_bet]

        response = client.get("/api/rooms/ABCDEF/tournament-stats")

        assert response.status_code == 200
        data = response.json()
        assert len(data["matches"]) == 2
        # User should have stats aggregated from both matches
        assert data["userStats"]["user-1"]["totalBetsPlaced"] == 2
        assert data["userStats"]["user-1"]["totalBetsWon"] == 2

    @patch("main.room_service.get_room")
    @patch("main.room_service.get_child_rooms")
    @patch("main.bet_service.get_bets_in_room")
    @patch("main.room_service.get_room_users")
    @patch("main.bet_service.get_user_bets_for_bets")
    def test_tournament_stats_lost_bets_not_counted_as_won(
        self, mock_user_bets, mock_room_users, mock_get_bets,
        mock_get_children, mock_get_room, client,
    ):
        mock_get_room.return_value = make_tournament_room()
        mock_get_children.return_value = [make_match_room()]

        resolved_bet = Bet(
            bet_id="bet-1",
            room_code="GHIJKL",
            question="Q?",
            options=["A", "B"],
            status=BetStatus.RESOLVED,
            points_value=100,
        )
        mock_get_bets.return_value = [resolved_bet]

        room_user = MagicMock()
        room_user.user_id = "user-1"
        room_user.nickname = "Player1"
        room_user.points = 900
        mock_room_users.return_value = [room_user]

        # User placed bet but lost (points_won = 0)
        user_bet = MagicMock()
        user_bet.user_id = "user-1"
        user_bet.points_won = 0
        mock_user_bets.return_value = [user_bet]

        response = client.get("/api/rooms/ABCDEF/tournament-stats")

        assert response.status_code == 200
        data = response.json()
        assert data["userStats"]["user-1"]["totalBetsPlaced"] == 1
        assert data["userStats"]["user-1"]["totalBetsWon"] == 0
