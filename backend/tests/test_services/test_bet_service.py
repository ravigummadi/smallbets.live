"""
Tests for bet_service with mocked Firestore

Tests verify business logic orchestration without real Firestore.

Tests marked with @pytest.mark.unit for selective execution.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services import bet_service
from models.bet import Bet, BetStatus
from models.user import User
from models.user_bet import UserBet


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_bet():
    """Test bet creation"""
    mock_db = MagicMock()
    mock_collection = MagicMock()
    mock_doc_ref = MagicMock()

    mock_db.collection.return_value = mock_collection
    mock_collection.document.return_value = mock_doc_ref

    with patch("services.bet_service.get_db", return_value=mock_db):
        bet = await bet_service.create_bet(
            room_code="AAAA",
            question="Test Question?",
            options=["Option A", "Option B"],
            points_value=100,
        )

        assert bet.room_code == "AAAA"
        assert bet.question == "Test Question?"
        assert bet.status == BetStatus.PENDING
        assert bet.points_value == 100

        # Verify Firestore write
        mock_doc_ref.set.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_open_bet():
    """Test opening a bet"""
    pending_bet = Bet(
        bet_id="test-bet",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.PENDING,
        points_value=100,
    )

    with patch("services.bet_service.get_bet", return_value=pending_bet), \
         patch("services.bet_service.update_bet") as mock_update:

        opened_bet = await bet_service.open_bet("test-bet")

        assert opened_bet.status == BetStatus.OPEN
        assert opened_bet.opened_at is not None
        mock_update.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_open_bet_not_found():
    """Test opening non-existent bet raises error"""
    with patch("services.bet_service.get_bet", return_value=None):
        with pytest.raises(ValueError, match="Bet not found"):
            await bet_service.open_bet("non-existent")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_lock_bet():
    """Test locking a bet"""
    open_bet = Bet(
        bet_id="test-bet",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    with patch("services.bet_service.get_bet", return_value=open_bet), \
         patch("services.bet_service.update_bet") as mock_update:

        locked_bet = await bet_service.lock_bet("test-bet")

        assert locked_bet.status == BetStatus.LOCKED
        assert locked_bet.locked_at is not None
        mock_update.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_place_user_bet_insufficient_points():
    """Test placing bet with insufficient points"""
    user = User(
        user_id="user1",
        room_code="AAAA",
        nickname="User1",
        points=50,  # Not enough!
    )

    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    with patch("services.user_service.get_user", return_value=user), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bet", return_value=None):

        with pytest.raises(ValueError, match="Insufficient points"):
            await bet_service.place_user_bet(
                user_id="user1",
                bet_id="bet1",
                selected_option="A",
            )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_place_user_bet_already_bet():
    """Test placing bet when already placed"""
    user = User(
        user_id="user1",
        room_code="AAAA",
        nickname="User1",
        points=1000,
    )

    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    existing_bet = UserBet(
        user_id="user1",
        bet_id="bet1",
        room_code="AAAA",
        selected_option="A",
    )

    with patch("services.user_service.get_user", return_value=user), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bet", return_value=existing_bet):

        with pytest.raises(ValueError, match="already placed a bet"):
            await bet_service.place_user_bet(
                user_id="user1",
                bet_id="bet1",
                selected_option="B",
            )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_place_user_bet_invalid_option():
    """Test placing bet with invalid option"""
    user = User(
        user_id="user1",
        room_code="AAAA",
        nickname="User1",
        points=1000,
    )

    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    with patch("services.user_service.get_user", return_value=user), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bet", return_value=None):

        with pytest.raises(ValueError, match="Invalid option"):
            await bet_service.place_user_bet(
                user_id="user1",
                bet_id="bet1",
                selected_option="C",  # Invalid!
            )
