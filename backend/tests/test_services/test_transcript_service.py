"""
Tests for transcript_service - isolated unit tests for transcript Firestore operations

Tests all 4 public functions:
- create_transcript_entry
- get_transcript_entries
- get_latest_transcript_entry
- delete_transcript_entries
"""

import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime

from services import transcript_service
from models.transcript import TranscriptEntry


@pytest.fixture
def mock_db():
    """Mock Firestore database"""
    return MagicMock()


class TestCreateTranscriptEntry:
    """Test create_transcript_entry()"""

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    @patch("services.transcript_service.uuid.uuid4")
    async def test_creates_entry_with_correct_data(self, mock_uuid, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db
        mock_uuid.return_value = "test-entry-id"

        entry = await transcript_service.create_transcript_entry(
            room_code="TEST",
            text="And the winner is...",
            source="manual",
        )

        assert entry.entry_id == "test-entry-id"
        assert entry.room_code == "TEST"
        assert entry.text == "And the winner is..."
        assert entry.source == "manual"
        assert isinstance(entry.timestamp, datetime)

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    @patch("services.transcript_service.uuid.uuid4")
    async def test_writes_to_correct_firestore_path(self, mock_uuid, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db
        mock_uuid.return_value = "entry-123"

        await transcript_service.create_transcript_entry(
            room_code="ROOM1",
            text="Test",
        )

        mock_db.collection.assert_called_with("transcripts")
        mock_db.collection().document.assert_called_with("ROOM1")
        mock_db.collection().document().collection.assert_called_with("entries")
        mock_db.collection().document().collection().document.assert_called_with("entry-123")

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    @patch("services.transcript_service.uuid.uuid4")
    async def test_calls_set_with_entry_dict(self, mock_uuid, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db
        mock_uuid.return_value = "entry-123"

        entry = await transcript_service.create_transcript_entry(
            room_code="ROOM1",
            text="Test text",
            source="webhook",
        )

        entry_ref = mock_db.collection().document().collection().document()
        entry_ref.set.assert_called_once()
        written_data = entry_ref.set.call_args[0][0]
        assert written_data["text"] == "Test text"
        assert written_data["source"] == "webhook"
        assert written_data["entryId"] == "entry-123"

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    @patch("services.transcript_service.uuid.uuid4")
    async def test_defaults_source_to_manual(self, mock_uuid, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db
        mock_uuid.return_value = "id"

        entry = await transcript_service.create_transcript_entry(
            room_code="TEST",
            text="No source specified",
        )

        assert entry.source == "manual"


class TestGetTranscriptEntries:
    """Test get_transcript_entries()"""

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_returns_entries_from_firestore(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        doc1 = MagicMock()
        doc1.to_dict.return_value = {
            "entryId": "e1",
            "roomCode": "TEST",
            "text": "First entry",
            "timestamp": datetime(2026, 1, 1, 12, 0),
            "source": "manual",
        }
        doc2 = MagicMock()
        doc2.to_dict.return_value = {
            "entryId": "e2",
            "roomCode": "TEST",
            "text": "Second entry",
            "timestamp": datetime(2026, 1, 1, 11, 0),
            "source": "webhook",
        }

        mock_query = mock_db.collection().document().collection().order_by().limit()
        mock_query.stream.return_value = [doc1, doc2]

        entries = await transcript_service.get_transcript_entries("TEST")

        assert len(entries) == 2
        assert entries[0].text == "First entry"
        assert entries[1].text == "Second entry"

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_returns_empty_list_when_no_entries(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        mock_query = mock_db.collection().document().collection().order_by().limit()
        mock_query.stream.return_value = []

        entries = await transcript_service.get_transcript_entries("EMPTY")

        assert entries == []

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_respects_limit_parameter(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        mock_query_chain = mock_db.collection().document().collection().order_by()
        mock_query_chain.limit.return_value.stream.return_value = []

        await transcript_service.get_transcript_entries("TEST", limit=5)

        mock_query_chain.limit.assert_called_with(5)

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_default_limit_is_100(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        mock_query_chain = mock_db.collection().document().collection().order_by()
        mock_query_chain.limit.return_value.stream.return_value = []

        await transcript_service.get_transcript_entries("TEST")

        mock_query_chain.limit.assert_called_with(100)


class TestGetLatestTranscriptEntry:
    """Test get_latest_transcript_entry()"""

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_transcript_entries")
    async def test_returns_first_entry(self, mock_get_entries):
        entry = TranscriptEntry(
            entry_id="latest",
            room_code="TEST",
            text="Latest entry",
            timestamp=datetime.utcnow(),
            source="manual",
        )
        mock_get_entries.return_value = [entry]

        result = await transcript_service.get_latest_transcript_entry("TEST")

        assert result is entry
        mock_get_entries.assert_called_with("TEST", limit=1)

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_transcript_entries")
    async def test_returns_none_when_no_entries(self, mock_get_entries):
        mock_get_entries.return_value = []

        result = await transcript_service.get_latest_transcript_entry("TEST")

        assert result is None


class TestDeleteTranscriptEntries:
    """Test delete_transcript_entries()"""

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_deletes_all_entries_and_parent_doc(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        # Mock subcollection docs
        doc1 = MagicMock()
        doc2 = MagicMock()
        entries_ref = mock_db.collection().document().collection()
        entries_ref.stream.return_value = [doc1, doc2]

        batch = MagicMock()
        mock_db.batch.return_value = batch

        await transcript_service.delete_transcript_entries("TEST")

        # Should batch delete each entry
        batch.delete.assert_any_call(doc1.reference)
        batch.delete.assert_any_call(doc2.reference)
        assert batch.delete.call_count == 2
        batch.commit.assert_called_once()

        # Should also delete parent document
        mock_db.collection().document().delete.assert_called()

    @pytest.mark.asyncio
    @patch("services.transcript_service.get_db")
    async def test_handles_empty_collection(self, mock_get_db, mock_db):
        mock_get_db.return_value = mock_db

        entries_ref = mock_db.collection().document().collection()
        entries_ref.stream.return_value = []

        batch = MagicMock()
        mock_db.batch.return_value = batch

        await transcript_service.delete_transcript_entries("EMPTY")

        # Should still commit (empty batch) and delete parent
        batch.commit.assert_called_once()
        batch.delete.assert_not_called()
