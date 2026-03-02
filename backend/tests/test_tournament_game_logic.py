"""Tests for tournament-related game logic functions

Tests verify:
- Room code v2 generation and validation (6-char with checksum)
- Tournament leaderboard aggregation
- Bet count validation
- validate_room_code backward compatibility with 4-char codes
"""

import pytest
from datetime import datetime, timedelta
from game_logic import (
    generate_room_code_v2,
    validate_room_code_v2,
    validate_room_code,
    calculate_room_user_leaderboard,
    aggregate_tournament_leaderboard,
    validate_bet_count,
    ROOM_CODE_ALPHABET,
    MAX_BETS_PER_MATCH,
    MAX_BETS_PER_TOURNAMENT,
)
from models.room_user import RoomUser


# ============================================================================
# Room Code v2 (6-char) Tests
# ============================================================================


@pytest.mark.unit
def test_generate_room_code_v2_length():
    """Test generated code is 6 characters"""
    code = generate_room_code_v2()
    assert len(code) == 6


@pytest.mark.unit
def test_generate_room_code_v2_valid_characters():
    """Test generated code uses only valid alphabet"""
    for _ in range(20):
        code = generate_room_code_v2()
        for char in code:
            assert char in ROOM_CODE_ALPHABET, f"Invalid character: {char}"


@pytest.mark.unit
def test_generate_room_code_v2_checksum_valid():
    """Test generated code passes checksum validation"""
    for _ in range(20):
        code = generate_room_code_v2()
        is_valid, error = validate_room_code_v2(code)
        assert is_valid, f"Code {code} failed validation: {error}"


@pytest.mark.unit
def test_validate_room_code_v2_valid():
    """Test validation of known valid codes"""
    # Generate and validate
    code = generate_room_code_v2()
    is_valid, error = validate_room_code_v2(code)
    assert is_valid is True
    assert error is None


@pytest.mark.unit
def test_validate_room_code_v2_wrong_length():
    """Test validation rejects wrong length"""
    is_valid, error = validate_room_code_v2("ABC")
    assert is_valid is False
    assert "6 characters" in error


@pytest.mark.unit
def test_validate_room_code_v2_invalid_checksum():
    """Test validation rejects invalid checksum"""
    code = generate_room_code_v2()
    # Corrupt the checksum (last char)
    alphabet = ROOM_CODE_ALPHABET
    corrupted_char = alphabet[(alphabet.index(code[5]) + 1) % len(alphabet)]
    corrupted = code[:5] + corrupted_char
    is_valid, error = validate_room_code_v2(corrupted)
    assert is_valid is False
    assert "checksum" in error.lower()


@pytest.mark.unit
def test_validate_room_code_v2_lowercase():
    """Test validation rejects lowercase"""
    is_valid, error = validate_room_code_v2("abcdef")
    assert is_valid is False


@pytest.mark.unit
def test_validate_room_code_v2_invalid_chars():
    """Test validation rejects confusing characters"""
    is_valid, error = validate_room_code_v2("OIIIII")
    assert is_valid is False
    assert "invalid character" in error.lower()


# ============================================================================
# validate_room_code backward compatibility
# ============================================================================


@pytest.mark.unit
def test_validate_room_code_4char_still_works():
    """Test 4-char codes still validate"""
    is_valid, error = validate_room_code("AAAA")
    assert is_valid is True


@pytest.mark.unit
def test_validate_room_code_6char_delegates():
    """Test 6-char codes delegate to v2 validation"""
    code = generate_room_code_v2()
    is_valid, error = validate_room_code(code)
    assert is_valid is True


@pytest.mark.unit
def test_validate_room_code_5char_invalid():
    """Test 5-char codes are rejected"""
    is_valid, error = validate_room_code("ABCDE")
    assert is_valid is False
    assert "4 or 6" in error


# ============================================================================
# Room User Leaderboard Tests
# ============================================================================


@pytest.mark.unit
def test_calculate_room_user_leaderboard_sorted():
    """Test leaderboard sorts by points descending"""
    now = datetime.utcnow()
    room_users = [
        RoomUser(id="R_u1", room_code="RCODE2", user_id="u1", nickname="Alice", points=1200, joined_at=now),
        RoomUser(id="R_u2", room_code="RCODE2", user_id="u2", nickname="Bob", points=1500, joined_at=now),
        RoomUser(id="R_u3", room_code="RCODE2", user_id="u3", nickname="Charlie", points=800, joined_at=now),
    ]

    leaderboard = calculate_room_user_leaderboard(room_users)

    assert len(leaderboard) == 3
    assert leaderboard[0]["nickname"] == "Bob"
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[1]["nickname"] == "Alice"
    assert leaderboard[1]["rank"] == 2
    assert leaderboard[2]["nickname"] == "Charlie"
    assert leaderboard[2]["rank"] == 3


@pytest.mark.unit
def test_calculate_room_user_leaderboard_empty():
    """Test empty leaderboard"""
    leaderboard = calculate_room_user_leaderboard([])
    assert leaderboard == []


@pytest.mark.unit
def test_calculate_room_user_leaderboard_tie_breaking():
    """Test tie-breaking by join time"""
    earlier = datetime.utcnow() - timedelta(minutes=5)
    later = datetime.utcnow()

    room_users = [
        RoomUser(id="R_u1", room_code="RCODE2", user_id="u1", nickname="Alice", points=1000, joined_at=later),
        RoomUser(id="R_u2", room_code="RCODE2", user_id="u2", nickname="Bob", points=1000, joined_at=earlier),
    ]

    leaderboard = calculate_room_user_leaderboard(room_users)
    assert leaderboard[0]["nickname"] == "Bob"  # Joined earlier


# ============================================================================
# Tournament Aggregation Tests
# ============================================================================


@pytest.mark.unit
def test_aggregate_tournament_leaderboard_basic():
    """Test basic aggregation across tournament + match room"""
    now = datetime.utcnow()

    tournament_users = [
        RoomUser(id="T_u1", room_code="TCODE2", user_id="u1", nickname="Alice", points=900, joined_at=now, is_host=True),
        RoomUser(id="T_u2", room_code="TCODE2", user_id="u2", nickname="Bob", points=1000, joined_at=now),
    ]

    match_room_users = {
        "MATCH2": [
            RoomUser(id="M_u1", room_code="MATCH2", user_id="u1", nickname="Alice", points=1200, joined_at=now),
            RoomUser(id="M_u2", room_code="MATCH2", user_id="u2", nickname="Bob", points=800, joined_at=now),
        ]
    }

    leaderboard = aggregate_tournament_leaderboard(tournament_users, match_room_users)

    assert len(leaderboard) == 2
    # Alice: 900 (tournament) + 1200 (match) = 2100
    # Bob: 1000 (tournament) + 800 (match) = 1800
    alice = next(e for e in leaderboard if e["nickname"] == "Alice")
    bob = next(e for e in leaderboard if e["nickname"] == "Bob")
    assert alice["points"] == 2100
    assert bob["points"] == 1800
    assert alice["rank"] == 1
    assert bob["rank"] == 2


@pytest.mark.unit
def test_aggregate_tournament_leaderboard_multiple_matches():
    """Test aggregation across tournament + multiple match rooms"""
    now = datetime.utcnow()

    tournament_users = [
        RoomUser(id="T_u1", room_code="TCODE2", user_id="u1", nickname="Alice", points=900, joined_at=now, is_host=True),
        RoomUser(id="T_u2", room_code="TCODE2", user_id="u2", nickname="Bob", points=1000, joined_at=now),
    ]

    match_room_users = {
        "MATCH1": [
            RoomUser(id="M1_u1", room_code="MATCH1", user_id="u1", nickname="Alice", points=1200, joined_at=now),
            RoomUser(id="M1_u2", room_code="MATCH1", user_id="u2", nickname="Bob", points=800, joined_at=now),
        ],
        "MATCH2": [
            RoomUser(id="M2_u1", room_code="MATCH2", user_id="u1", nickname="Alice", points=1100, joined_at=now),
            RoomUser(id="M2_u2", room_code="MATCH2", user_id="u2", nickname="Bob", points=1300, joined_at=now),
        ]
    }

    leaderboard = aggregate_tournament_leaderboard(tournament_users, match_room_users)

    # Alice: 900 + 1200 + 1100 = 3200
    # Bob: 1000 + 800 + 1300 = 3100
    alice = next(e for e in leaderboard if e["nickname"] == "Alice")
    bob = next(e for e in leaderboard if e["nickname"] == "Bob")
    assert alice["points"] == 3200
    assert bob["points"] == 3100


@pytest.mark.unit
def test_aggregate_tournament_leaderboard_no_matches():
    """Test aggregation with no match rooms (tournament only)"""
    now = datetime.utcnow()

    tournament_users = [
        RoomUser(id="T_u1", room_code="TCODE2", user_id="u1", nickname="Alice", points=900, joined_at=now),
    ]

    leaderboard = aggregate_tournament_leaderboard(tournament_users, {})
    assert len(leaderboard) == 1
    assert leaderboard[0]["points"] == 900


# ============================================================================
# Bet Count Validation Tests
# ============================================================================


@pytest.mark.unit
def test_validate_bet_count_match_under_limit():
    """Test match room under bet limit"""
    is_valid, error = validate_bet_count(10, "match")
    assert is_valid is True
    assert error is None


@pytest.mark.unit
def test_validate_bet_count_match_at_limit():
    """Test match room at bet limit"""
    is_valid, error = validate_bet_count(MAX_BETS_PER_MATCH, "match")
    assert is_valid is False
    assert str(MAX_BETS_PER_MATCH) in error


@pytest.mark.unit
def test_validate_bet_count_tournament_under_limit():
    """Test tournament under bet limit"""
    is_valid, error = validate_bet_count(5, "tournament")
    assert is_valid is True


@pytest.mark.unit
def test_validate_bet_count_tournament_at_limit():
    """Test tournament at bet limit"""
    is_valid, error = validate_bet_count(MAX_BETS_PER_TOURNAMENT, "tournament")
    assert is_valid is False


@pytest.mark.unit
def test_validate_bet_count_event_no_limit():
    """Test event rooms have no limit"""
    is_valid, error = validate_bet_count(1000, "event")
    assert is_valid is True
