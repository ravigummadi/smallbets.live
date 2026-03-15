"""
Tests for bet_service with mocked Firestore

Tests verify business logic orchestration without real Firestore.

Tests marked with @pytest.mark.unit for selective execution.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from google.cloud import firestore
from google.cloud.firestore_v1.transforms import Increment as FirestoreIncrement
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
        assert bet.status == BetStatus.OPEN
        assert bet.points_value == 100

        # Verify Firestore write
        mock_doc_ref.set.assert_called_once()


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
async def test_place_user_bet_change_existing():
    """Test changing an existing bet while still open (no extra point deduction)"""
    user = User(
        user_id="user1",
        room_code="AAAA",
        nickname="User1",
        points=900,  # already deducted 100 for original bet
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

    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    with patch("services.user_service.get_user", return_value=user), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bet", return_value=existing_bet), \
         patch("services.bet_service.get_db", return_value=mock_db):

        result = await bet_service.place_user_bet(
            user_id="user1",
            bet_id="bet1",
            selected_option="B",
        )

        assert result.selected_option == "B"
        # Should NOT create a batch (no point deduction)
        mock_db.batch.assert_not_called()


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


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resolve_bet_does_not_double_deduct_points():
    """Resolve bet should not subtract bet cost again (already deducted at placement)."""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.LOCKED,
        points_value=100,
    )

    user_bets = [
        UserBet(user_id="u1", bet_id="bet1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="bet1", room_code="AAAA", selected_option="B"),
    ]

    # Users already paid 100 points at placement (1000 -> 900)
    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=900),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=900),
    }

    mock_db = MagicMock()
    mock_transaction = MagicMock()
    mock_db.transaction.return_value = mock_transaction

    # Set up collection mocks: roomUsers docs should not exist (legacy room)
    mock_room_user_doc = MagicMock()
    mock_room_user_doc.exists = False

    mock_room_user_ref = MagicMock()
    mock_room_user_ref.get.return_value = mock_room_user_doc

    mock_room_users_col = MagicMock()
    mock_room_users_col.document.return_value = mock_room_user_ref

    mock_other_col = MagicMock()
    mock_other_col.document.return_value = MagicMock()

    def collection_side_effect(name):
        if name == "roomUsers":
            return mock_room_users_col
        return mock_other_col

    mock_db.collection.side_effect = collection_side_effect

    def passthrough_transactional(func):
        def wrapper(transaction, *args, **kwargs):
            return func(transaction, *args, **kwargs)
        return wrapper

    with patch("services.bet_service.get_db", return_value=mock_db), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bets_for_bet", return_value=user_bets), \
         patch("services.user_service.get_users_by_ids", return_value=users), \
         patch("google.cloud.firestore.transactional", passthrough_transactional):

        await bet_service.resolve_bet("bet1", "A")

    # Expect winner to get pot (200) added to already-deducted balance
    # Loser should remain at 900 (no extra deduction)
    updated_points = sorted(call.args[1]["points"] for call in mock_transaction.update.call_args_list)
    assert updated_points == [900, 1100]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_open_bet_no_votes():
    """Test deleting an open bet with no user bets"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_col = MagicMock()
    mock_doc_ref = MagicMock()
    mock_col.document.return_value = mock_doc_ref
    mock_db.collection.return_value = mock_col

    with patch("services.bet_service.get_db", return_value=mock_db), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bets_for_bet", return_value=[]):

        await bet_service.delete_bet("bet1")

    # Bet document should be deleted
    mock_batch.delete.assert_called_once()
    mock_batch.commit.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_open_bet_refunds_points():
    """Test deleting an open bet refunds points atomically using Increment"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    user_bets = [
        UserBet(user_id="u1", bet_id="bet1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="bet1", room_code="AAAA", selected_option="B"),
    ]

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    mock_room_user_doc = MagicMock()
    mock_room_user_doc.exists = False
    mock_room_user_ref = MagicMock()
    mock_room_user_ref.get.return_value = mock_room_user_doc
    mock_room_users_col = MagicMock()
    mock_room_users_col.document.return_value = mock_room_user_ref

    mock_other_col = MagicMock()
    mock_other_col.document.return_value = MagicMock()

    def collection_side_effect(name):
        if name == "roomUsers":
            return mock_room_users_col
        return mock_other_col

    mock_db.collection.side_effect = collection_side_effect

    with patch("services.bet_service.get_db", return_value=mock_db), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bets_for_bet", return_value=user_bets):

        await bet_service.delete_bet("bet1")

    # Points should be refunded atomically via Increment (no get_user calls)
    update_calls = mock_batch.update.call_args_list
    point_updates = [c.args[1]["points"] for c in update_calls if "points" in c.args[1]]
    # Each user should get Increment(100) - verify all are Increment sentinels
    assert len(point_updates) == 2
    for inc in point_updates:
        assert isinstance(inc, FirestoreIncrement)

    # User bet docs + bet doc should be deleted (3 deletes total)
    assert mock_batch.delete.call_count == 3
    mock_batch.commit.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_locked_bet_fails():
    """Test that locked bets cannot be deleted"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.LOCKED,
        points_value=100,
    )

    with patch("services.bet_service.get_bet", return_value=bet):
        with pytest.raises(ValueError, match="Only open bets can be deleted"):
            await bet_service.delete_bet("bet1")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_resolved_bet_fails():
    """Test that resolved bets cannot be deleted"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        points_value=100,
    )

    with patch("services.bet_service.get_bet", return_value=bet):
        with pytest.raises(ValueError, match="Only open bets can be deleted"):
            await bet_service.delete_bet("bet1")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_nonexistent_bet_fails():
    """Test deleting a bet that doesn't exist"""
    with patch("services.bet_service.get_bet", return_value=None):
        with pytest.raises(ValueError, match="Bet not found"):
            await bet_service.delete_bet("nonexistent")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_edit_open_bet_updates_question():
    """Test editing an open bet's question resets votes and refunds points atomically"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Old question?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
        version=1,
    )

    user_bets = [
        UserBet(user_id="u1", bet_id="bet1", room_code="AAAA", selected_option="A"),
    ]

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    mock_room_user_doc = MagicMock()
    mock_room_user_doc.exists = False
    mock_room_user_ref = MagicMock()
    mock_room_user_ref.get.return_value = mock_room_user_doc
    mock_room_users_col = MagicMock()
    mock_room_users_col.document.return_value = mock_room_user_ref

    mock_other_col = MagicMock()
    mock_other_col.document.return_value = MagicMock()

    def collection_side_effect(name):
        if name == "roomUsers":
            return mock_room_users_col
        return mock_other_col

    mock_db.collection.side_effect = collection_side_effect

    with patch("services.bet_service.get_db", return_value=mock_db), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bets_for_bet", return_value=user_bets):

        updated = await bet_service.edit_bet("bet1", question="New question?")

    assert updated.question == "New question?"
    assert updated.options == ["A", "B"]  # Unchanged
    assert updated.version == 2

    # User refunded atomically via Increment(100)
    update_calls = [c for c in mock_batch.update.call_args_list if "points" in c.args[1]]
    assert len(update_calls) == 1
    assert isinstance(update_calls[0].args[1]["points"], FirestoreIncrement)

    # User bet deleted + bet updated
    mock_batch.delete.assert_called_once()
    mock_batch.commit.assert_called_once()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_edit_open_bet_updates_options():
    """Test editing an open bet's options"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
        version=1,
    )

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_col = MagicMock()
    mock_col.document.return_value = MagicMock()
    mock_db.collection.return_value = mock_col

    with patch("services.bet_service.get_db", return_value=mock_db), \
         patch("services.bet_service.get_bet", return_value=bet), \
         patch("services.bet_service.get_user_bets_for_bet", return_value=[]):

        updated = await bet_service.edit_bet("bet1", options=["X", "Y", "Z"])

    assert updated.options == ["X", "Y", "Z"]
    assert updated.question == "Test?"  # Unchanged
    assert updated.version == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_edit_locked_bet_fails():
    """Test that locked bets cannot be edited"""
    bet = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Test?",
        options=["A", "B"],
        status=BetStatus.LOCKED,
        points_value=100,
    )

    with patch("services.bet_service.get_bet", return_value=bet):
        with pytest.raises(ValueError, match="Only open bets can be edited"):
            await bet_service.edit_bet("bet1", question="New?")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_edit_nonexistent_bet_fails():
    """Test editing a bet that doesn't exist"""
    with patch("services.bet_service.get_bet", return_value=None):
        with pytest.raises(ValueError, match="Bet not found"):
            await bet_service.edit_bet("nonexistent", question="New?")
