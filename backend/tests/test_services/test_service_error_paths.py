"""
Tests for service layer error paths

Covers exception scenarios, invalid inputs, and failure modes
across bet_service, room_service, and user_service.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from models.room import Room
from models.user import User
from models.bet import Bet, BetStatus


# ============================================================================
# Bet Service Error Paths
# ============================================================================

class TestBetServiceErrors:
    """Test error paths in bet_service"""

    @pytest.mark.asyncio
    @patch("services.bet_service.get_db")
    async def test_create_bet_with_empty_options_raises(self, mock_get_db):
        from services import bet_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        with pytest.raises((ValueError, Exception)):
            await bet_service.create_bet(
                room_code="TEST",
                question="Q?",
                options=[],  # Empty options
                points_value=100,
            )

    @pytest.mark.asyncio
    @patch("services.bet_service.get_db")
    async def test_lock_nonexistent_bet_raises(self, mock_get_db):
        from services import bet_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().document().get().exists = False

        with pytest.raises(Exception):
            await bet_service.lock_bet("TEST", "nonexistent-bet")

    @pytest.mark.asyncio
    @patch("services.bet_service.get_db")
    async def test_resolve_bet_with_invalid_option(self, mock_get_db):
        from services import bet_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # Mock bet doc
        bet_doc = MagicMock()
        bet_doc.exists = True
        bet_doc.to_dict.return_value = {
            "betId": "bet-1",
            "roomCode": "TEST",
            "question": "Q?",
            "options": ["A", "B"],
            "status": "locked",
            "pointsValue": 100,
            "betType": "in-game",
            "createdFrom": "custom",
            "timerDuration": 60,
            "version": 1,
        }
        mock_db.collection().document().get.return_value = bet_doc

        with pytest.raises((ValueError, Exception)):
            await bet_service.resolve_bet(
                room_code="TEST",
                bet_id="bet-1",
                winning_option="INVALID_OPTION",
            )

    @pytest.mark.asyncio
    @patch("services.bet_service.get_db")
    async def test_place_bet_on_nonexistent_bet(self, mock_get_db):
        from services import bet_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().document().get().exists = False

        with pytest.raises(Exception):
            await bet_service.place_user_bet(
                room_code="TEST",
                bet_id="nonexistent",
                user_id="user-1",
                selected_option="A",
            )


# ============================================================================
# Room Service Error Paths
# ============================================================================

class TestRoomServiceErrors:
    """Test error paths in room_service"""

    @pytest.mark.asyncio
    @patch("services.room_service.get_db")
    async def test_get_nonexistent_room_returns_none(self, mock_get_db):
        from services import room_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().document().get().exists = False

        result = await room_service.get_room("NOPE")
        assert result is None

    @pytest.mark.asyncio
    @patch("services.room_service.get_db")
    async def test_get_child_rooms_of_nonexistent_parent(self, mock_get_db):
        from services import room_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().where().stream.return_value = []

        result = await room_service.get_child_rooms("NOPARENT")
        assert result == []

    @pytest.mark.asyncio
    @patch("services.room_service.get_db")
    async def test_set_room_status_on_nonexistent_room(self, mock_get_db):
        from services import room_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # Should not raise but call update on Firestore
        await room_service.set_room_status("NOPE", "finished")
        mock_db.collection().document().update.assert_called()


# ============================================================================
# User Service Error Paths
# ============================================================================

class TestUserServiceErrors:
    """Test error paths in user_service"""

    @pytest.mark.asyncio
    @patch("services.user_service.get_db")
    async def test_get_nonexistent_user_returns_none(self, mock_get_db):
        from services import user_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().document().get().exists = False

        result = await user_service.get_user("nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    @patch("services.user_service.get_db")
    async def test_find_user_by_nickname_not_found(self, mock_get_db):
        from services import user_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().where().where().limit().stream.return_value = []

        result = await user_service.find_user_by_nickname("TEST", "Nobody")
        assert result is None

    @pytest.mark.asyncio
    @patch("services.user_service.get_db")
    async def test_get_users_in_empty_room(self, mock_get_db):
        from services import user_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().where().stream.return_value = []

        result = await user_service.get_users_in_room("EMPTY")
        assert result == []

    @pytest.mark.asyncio
    @patch("services.user_service.get_db")
    async def test_get_user_by_key_not_found(self, mock_get_db):
        from services import user_service

        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_db.collection().where().where().limit().stream.return_value = []

        result = await user_service.get_user_by_key("TEST", "XXXXXXXX")
        assert result is None

    @pytest.mark.asyncio
    @patch("services.user_service.get_db")
    async def test_get_users_by_ids_empty_list(self, mock_get_db):
        from services import user_service

        result = await user_service.get_users_by_ids([])
        # Returns empty dict (keyed by user_id) for empty input
        assert result == {} or result == []
