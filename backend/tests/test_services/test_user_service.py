"""
Tests for user_service - user key generation, collision handling, and lookup

Tests verify:
- generate_user_key() format and character set
- create_user() generates user_key on creation
- create_user() handles collision retries
- ensure_user_has_key() backfills missing keys
- ensure_user_has_key() is idempotent for users with keys
- get_user_by_key() returns user or None
"""

import re
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from services.user_service import (
    generate_user_key,
    create_user,
    ensure_user_has_key,
    get_user_by_key,
    USER_KEY_ALPHABET,
    USER_KEY_LENGTH,
)
from models.user import User


# ============================================================================
# generate_user_key() tests
# ============================================================================

@pytest.mark.unit
def test_generate_user_key_length():
    """Key should be exactly 8 characters"""
    key = generate_user_key()
    assert len(key) == USER_KEY_LENGTH


@pytest.mark.unit
def test_generate_user_key_characters():
    """Key should only use base32-crockford alphabet characters"""
    for _ in range(100):
        key = generate_user_key()
        for char in key:
            assert char in USER_KEY_ALPHABET, f"Invalid character: {char}"


@pytest.mark.unit
def test_generate_user_key_no_ambiguous_chars():
    """Key should not contain ambiguous characters: 0, O, I, L, 1"""
    ambiguous = set("0OIL1")
    for _ in range(100):
        key = generate_user_key()
        for char in key:
            assert char not in ambiguous, f"Ambiguous character found: {char}"


@pytest.mark.unit
def test_generate_user_key_uniqueness():
    """Generated keys should be reasonably unique"""
    keys = set(generate_user_key() for _ in range(1000))
    # With ~1.1 trillion possible keys, 1000 should all be unique
    assert len(keys) == 1000


@pytest.mark.unit
def test_generate_user_key_regex_pattern():
    """Key should match the validation regex pattern"""
    pattern = re.compile(r"^[23456789A-HJ-NP-Za-hj-np-z]{8}$")
    for _ in range(100):
        key = generate_user_key()
        assert pattern.match(key), f"Key doesn't match pattern: {key}"


# ============================================================================
# create_user() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_user_generates_key():
    """create_user() should generate a user_key"""
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    # Mock get_user_by_key to return None (no collision)
    with patch("services.user_service.get_db", return_value=mock_db), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock, return_value=None):

        user = await create_user(
            room_code="AAAA",
            nickname="Alice",
            is_admin=False,
        )

        assert user.user_key is not None
        assert len(user.user_key) == 8

        # Verify Firestore write included the key
        mock_doc_ref.set.assert_called_once()
        written_data = mock_doc_ref.set.call_args[0][0]
        assert "userKey" in written_data


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_user_retries_on_collision():
    """create_user() should retry key generation on collision"""
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    # First call returns existing user (collision), second returns None (success)
    existing_user = User(
        user_id="other-user",
        room_code="AAAA",
        nickname="Bob",
        user_key="existing1",
    )

    with patch("services.user_service.get_db", return_value=mock_db), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock,
               side_effect=[existing_user, None]):

        user = await create_user(
            room_code="AAAA",
            nickname="Alice",
        )

        assert user.user_key is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_user_fails_after_max_retries():
    """create_user() should raise ValueError after exhausting retries"""
    mock_db = MagicMock()

    # Always return existing user (permanent collision)
    existing_user = User(
        user_id="other-user",
        room_code="AAAA",
        nickname="Bob",
        user_key="existing1",
    )

    with patch("services.user_service.get_db", return_value=mock_db), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock,
               return_value=existing_user):

        with pytest.raises(ValueError, match="Failed to generate unique user key"):
            await create_user(
                room_code="AAAA",
                nickname="Alice",
            )


# ============================================================================
# ensure_user_has_key() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_ensure_user_has_key_returns_existing():
    """ensure_user_has_key() should return unchanged user if key exists"""
    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key="xY7kM9zQ",
    )
    result = await ensure_user_has_key(user)
    assert result.user_key == "xY7kM9zQ"
    assert result.user_id == "test-user"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ensure_user_has_key_backfills():
    """ensure_user_has_key() should generate and persist key for users without one"""
    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key=None,
    )

    with patch("services.user_service.get_db", return_value=mock_db), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock, return_value=None):

        result = await ensure_user_has_key(user)

        assert result.user_key is not None
        assert len(result.user_key) == 8
        # Should have updated Firestore
        mock_doc_ref.update.assert_called_once()
        update_data = mock_doc_ref.update.call_args[0][0]
        assert "userKey" in update_data


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ensure_user_has_key_fails_after_retries():
    """ensure_user_has_key() should raise ValueError after exhausting retries"""
    mock_db = MagicMock()

    existing_user = User(
        user_id="other-user",
        room_code="AAAA",
        nickname="Bob",
        user_key="existing1",
    )

    user = User(
        user_id="test-user",
        room_code="AAAA",
        nickname="Alice",
        user_key=None,
    )

    with patch("services.user_service.get_db", return_value=mock_db), \
         patch("services.user_service.get_user_by_key", new_callable=AsyncMock,
               return_value=existing_user):

        with pytest.raises(ValueError, match="Failed to generate unique user key"):
            await ensure_user_has_key(user)


# ============================================================================
# get_user_by_key() tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_user_by_key_found():
    """get_user_by_key() should return user when found"""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = {
        "userId": "test-user",
        "roomCode": "AAAA",
        "nickname": "Alice",
        "points": 850,
        "isAdmin": False,
        "joinedAt": datetime.utcnow(),
        "userKey": "xY7kM9zQ",
    }

    mock_query = MagicMock()
    mock_query.where.return_value = mock_query
    mock_query.stream.return_value = [mock_doc]
    mock_db.collection.return_value.where.return_value = mock_query

    with patch("services.user_service.get_db", return_value=mock_db):
        result = await get_user_by_key("AAAA", "xY7kM9zQ")

        assert result is not None
        assert result.user_id == "test-user"
        assert result.nickname == "Alice"
        assert result.user_key == "xY7kM9zQ"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_user_by_key_not_found():
    """get_user_by_key() should return None when not found"""
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.where.return_value = mock_query
    mock_query.stream.return_value = []
    mock_db.collection.return_value.where.return_value = mock_query

    with patch("services.user_service.get_db", return_value=mock_db):
        result = await get_user_by_key("AAAA", "nonexist")

        assert result is None
