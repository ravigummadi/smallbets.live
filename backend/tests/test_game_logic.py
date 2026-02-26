"""
Pure function tests for game_logic.py

Tests verify all pure functions with NO mocks needed:
- calculate_scores() - various winner/loser scenarios
- validate_bet_eligibility() - all validation rules
- calculate_pot_total() and distribute_pot()
- calculate_leaderboard() - sorting, tie-breaking
- validate_room_code() - confusing characters, length, format
- validate_nickname() - empty, too long, whitespace-only

All functions are deterministic (same inputs → same outputs).

Tests marked with @pytest.mark.unit for selective execution.
"""

import pytest
from datetime import datetime, timedelta
from game_logic import (
    calculate_scores,
    validate_bet_eligibility,
    calculate_pot_total,
    distribute_pot,
    calculate_leaderboard,
    validate_room_code,
    validate_nickname,
    INITIAL_POINTS,
)
from models.user import User
from models.bet import Bet, BetStatus
from models.user_bet import UserBet


# ============================================================================
# calculate_scores() Tests
# ============================================================================


@pytest.mark.unit
def test_calculate_scores_normal_case():
    """Test normal case: 5 users, 3 winners, 2 losers"""
    user_bets = [
        UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u3", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u4", bet_id="b1", room_code="AAAA", selected_option="B"),
        UserBet(user_id="u5", bet_id="b1", room_code="AAAA", selected_option="B"),
    ]

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=1000),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=1000),
        "u3": User(user_id="u3", room_code="AAAA", nickname="U3", points=1000),
        "u4": User(user_id="u4", room_code="AAAA", nickname="U4", points=1000),
        "u5": User(user_id="u5", room_code="AAAA", nickname="U5", points=1000),
    }

    scores = calculate_scores(user_bets, users, "A", 100)

    # Pot = 5 * 100 = 500
    # 3 winners split 500 = 166 each (integer division)
    # 2 losers get 0
    assert scores["u1"] == 166
    assert scores["u2"] == 166
    assert scores["u3"] == 166
    assert scores["u4"] == 0
    assert scores["u5"] == 0


@pytest.mark.unit
def test_calculate_scores_all_pick_same_option():
    """Test edge case: everyone picks the same option (should refund)"""
    user_bets = [
        UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u3", bet_id="b1", room_code="AAAA", selected_option="A"),
    ]

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=1000),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=1000),
        "u3": User(user_id="u3", room_code="AAAA", nickname="U3", points=1000),
    }

    scores = calculate_scores(user_bets, users, "A", 100)

    # Everyone picked correctly, no losers → refund everyone
    assert scores["u1"] == 100
    assert scores["u2"] == 100
    assert scores["u3"] == 100


@pytest.mark.unit
def test_calculate_scores_no_winners():
    """Test edge case: no one picked the winning option (should refund)"""
    user_bets = [
        UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u3", bet_id="b1", room_code="AAAA", selected_option="B"),
    ]

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=1000),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=1000),
        "u3": User(user_id="u3", room_code="AAAA", nickname="U3", points=1000),
    }

    # Winning option is C (no one picked it)
    scores = calculate_scores(user_bets, users, "C", 100)

    # No winners → refund everyone
    assert scores["u1"] == 100
    assert scores["u2"] == 100
    assert scores["u3"] == 100


@pytest.mark.unit
def test_calculate_scores_single_winner():
    """Test case: only 1 winner takes entire pot"""
    user_bets = [
        UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="b1", room_code="AAAA", selected_option="B"),
        UserBet(user_id="u3", bet_id="b1", room_code="AAAA", selected_option="B"),
        UserBet(user_id="u4", bet_id="b1", room_code="AAAA", selected_option="B"),
    ]

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=1000),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=1000),
        "u3": User(user_id="u3", room_code="AAAA", nickname="U3", points=1000),
        "u4": User(user_id="u4", room_code="AAAA", nickname="U4", points=1000),
    }

    scores = calculate_scores(user_bets, users, "A", 100)

    # Pot = 4 * 100 = 400
    # 1 winner takes all
    assert scores["u1"] == 400
    assert scores["u2"] == 0
    assert scores["u3"] == 0
    assert scores["u4"] == 0


@pytest.mark.unit
def test_calculate_scores_empty_user_bets():
    """Test edge case: no user bets"""
    scores = calculate_scores([], {}, "A", 100)
    assert scores == {}


@pytest.mark.unit
def test_calculate_scores_different_bet_costs():
    """Test with different bet costs (points_value)"""
    user_bets = [
        UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A"),
        UserBet(user_id="u2", bet_id="b1", room_code="AAAA", selected_option="B"),
    ]

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="U1", points=1000),
        "u2": User(user_id="u2", room_code="AAAA", nickname="U2", points=1000),
    }

    # Bet cost is 250 points
    scores = calculate_scores(user_bets, users, "A", 250)

    # Pot = 2 * 250 = 500, winner takes all
    assert scores["u1"] == 500
    assert scores["u2"] == 0


# ============================================================================
# validate_bet_eligibility() Tests
# ============================================================================


@pytest.mark.unit
def test_validate_bet_eligibility_valid():
    """Test valid bet eligibility"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=1000)
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    is_valid, error = validate_bet_eligibility(user, bet, None, 100)

    assert is_valid is True
    assert error is None


@pytest.mark.unit
def test_validate_bet_eligibility_bet_not_open():
    """Test bet not in OPEN status"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=1000)
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.PENDING,  # Not open!
        points_value=100,
    )

    is_valid, error = validate_bet_eligibility(user, bet, None, 100)

    assert is_valid is False
    assert "not open" in error.lower()


@pytest.mark.unit
def test_validate_bet_eligibility_insufficient_points():
    """Test user doesn't have enough points"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=50)  # Not enough!
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )

    is_valid, error = validate_bet_eligibility(user, bet, None, 100)

    assert is_valid is False
    assert "insufficient points" in error.lower()


@pytest.mark.unit
def test_validate_bet_eligibility_already_bet():
    """Test user has already placed a bet"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=1000)
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )
    existing_bet = UserBet(user_id="u1", bet_id="b1", room_code="AAAA", selected_option="A")

    is_valid, error = validate_bet_eligibility(user, bet, existing_bet, 100)

    assert is_valid is False
    assert "already placed a bet" in error.lower()


@pytest.mark.unit
def test_validate_bet_eligibility_locked_bet():
    """Test bet in LOCKED status"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=1000)
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.LOCKED,
        points_value=100,
    )

    is_valid, error = validate_bet_eligibility(user, bet, None, 100)

    assert is_valid is False
    assert "not open" in error.lower()


@pytest.mark.unit
def test_validate_bet_eligibility_resolved_bet():
    """Test bet in RESOLVED status"""
    user = User(user_id="u1", room_code="AAAA", nickname="U1", points=1000)
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Q?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        winning_option="A",
        points_value=100,
    )

    is_valid, error = validate_bet_eligibility(user, bet, None, 100)

    assert is_valid is False


# ============================================================================
# calculate_pot_total() and distribute_pot() Tests
# ============================================================================


@pytest.mark.unit
def test_calculate_pot_total():
    """Test pot calculation"""
    assert calculate_pot_total(5, 100) == 500
    assert calculate_pot_total(10, 50) == 500
    assert calculate_pot_total(1, 1000) == 1000
    assert calculate_pot_total(0, 100) == 0


@pytest.mark.unit
def test_distribute_pot_single_winner():
    """Test pot distribution with single winner"""
    result = distribute_pot(["u1"], 500)
    assert result == {"u1": 500}


@pytest.mark.unit
def test_distribute_pot_multiple_winners():
    """Test pot distribution with multiple winners"""
    result = distribute_pot(["u1", "u2", "u3"], 600)
    # 600 / 3 = 200 each
    assert result == {"u1": 200, "u2": 200, "u3": 200}


@pytest.mark.unit
def test_distribute_pot_no_winners():
    """Test pot distribution with no winners"""
    result = distribute_pot([], 500)
    assert result == {}


@pytest.mark.unit
def test_distribute_pot_integer_division():
    """Test pot distribution uses integer division (no fractional points)"""
    result = distribute_pot(["u1", "u2", "u3"], 500)
    # 500 / 3 = 166.66... → 166 each (integer division)
    assert result == {"u1": 166, "u2": 166, "u3": 166}


# ============================================================================
# calculate_leaderboard() Tests
# ============================================================================


@pytest.mark.unit
def test_calculate_leaderboard_sorted_by_points():
    """Test leaderboard sorted by points (descending)"""
    now = datetime.utcnow()
    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="Alice", points=1200, joined_at=now),
        "u2": User(user_id="u2", room_code="AAAA", nickname="Bob", points=1500, joined_at=now),
        "u3": User(user_id="u3", room_code="AAAA", nickname="Charlie", points=800, joined_at=now),
    }

    leaderboard = calculate_leaderboard(users)

    assert len(leaderboard) == 3
    assert leaderboard[0]["nickname"] == "Bob"  # 1500 points
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[1]["nickname"] == "Alice"  # 1200 points
    assert leaderboard[1]["rank"] == 2
    assert leaderboard[2]["nickname"] == "Charlie"  # 800 points
    assert leaderboard[2]["rank"] == 3


@pytest.mark.unit
def test_calculate_leaderboard_tie_breaking_by_join_time():
    """Test leaderboard tie-breaking by join time (earlier wins)"""
    now = datetime.utcnow()
    earlier = now - timedelta(minutes=5)
    later = now + timedelta(minutes=5)

    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="Alice", points=1000, joined_at=later),
        "u2": User(user_id="u2", room_code="AAAA", nickname="Bob", points=1000, joined_at=earlier),
        "u3": User(user_id="u3", room_code="AAAA", nickname="Charlie", points=1000, joined_at=now),
    }

    leaderboard = calculate_leaderboard(users)

    # All have 1000 points, so sort by join time (earlier first)
    assert leaderboard[0]["nickname"] == "Bob"  # Earliest
    assert leaderboard[1]["nickname"] == "Charlie"  # Middle
    assert leaderboard[2]["nickname"] == "Alice"  # Latest


@pytest.mark.unit
def test_calculate_leaderboard_includes_is_admin():
    """Test leaderboard includes isAdmin field"""
    now = datetime.utcnow()
    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="Host", points=1000, is_admin=True, joined_at=now),
        "u2": User(user_id="u2", room_code="AAAA", nickname="Guest", points=900, is_admin=False, joined_at=now),
    }

    leaderboard = calculate_leaderboard(users)

    assert leaderboard[0]["isAdmin"] is True
    assert leaderboard[1]["isAdmin"] is False


@pytest.mark.unit
def test_calculate_leaderboard_empty():
    """Test leaderboard with no users"""
    leaderboard = calculate_leaderboard({})
    assert leaderboard == []


@pytest.mark.unit
def test_calculate_leaderboard_single_user():
    """Test leaderboard with single user"""
    now = datetime.utcnow()
    users = {
        "u1": User(user_id="u1", room_code="AAAA", nickname="Solo", points=1000, joined_at=now),
    }

    leaderboard = calculate_leaderboard(users)

    assert len(leaderboard) == 1
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["nickname"] == "Solo"


# ============================================================================
# validate_room_code() Tests
# ============================================================================


@pytest.mark.unit
def test_validate_room_code_valid():
    """Test valid room codes"""
    is_valid, error = validate_room_code("AAAA")
    assert is_valid is True
    assert error is None

    is_valid, error = validate_room_code("ZZZZ")
    assert is_valid is True

    is_valid, error = validate_room_code("A2B3")
    assert is_valid is True


@pytest.mark.unit
def test_validate_room_code_wrong_length():
    """Test room code wrong length"""
    is_valid, error = validate_room_code("AAA")  # Too short
    assert is_valid is False
    assert "4 characters" in error

    is_valid, error = validate_room_code("AAAAA")  # Too long
    assert is_valid is False
    assert "4 characters" in error


@pytest.mark.unit
def test_validate_room_code_not_alphanumeric():
    """Test room code with non-alphanumeric characters"""
    is_valid, error = validate_room_code("AA-A")
    assert is_valid is False
    assert "letters and numbers" in error

    is_valid, error = validate_room_code("AA A")  # Space
    assert is_valid is False


@pytest.mark.unit
def test_validate_room_code_not_uppercase():
    """Test room code not uppercase"""
    is_valid, error = validate_room_code("aaaa")
    assert is_valid is False
    assert "uppercase" in error

    is_valid, error = validate_room_code("AaAa")
    assert is_valid is False


@pytest.mark.unit
def test_validate_room_code_confusing_characters():
    """Test room code with confusing characters (O, I, 1, L)"""
    is_valid, error = validate_room_code("OOOO")  # O (letter O)
    assert is_valid is False
    assert "confusing" in error.lower()

    is_valid, error = validate_room_code("IIII")  # I (letter I)
    assert is_valid is False

    is_valid, error = validate_room_code("1111")  # 1 (digit one)
    assert is_valid is False

    is_valid, error = validate_room_code("LLLL")  # L (letter L)
    assert is_valid is False


# ============================================================================
# validate_nickname() Tests
# ============================================================================


@pytest.mark.unit
def test_validate_nickname_valid():
    """Test valid nicknames"""
    is_valid, error = validate_nickname("Alice")
    assert is_valid is True
    assert error is None

    is_valid, error = validate_nickname("Bob123")
    assert is_valid is True

    is_valid, error = validate_nickname("X")  # 1 char is ok
    assert is_valid is True


@pytest.mark.unit
def test_validate_nickname_empty():
    """Test empty nickname"""
    is_valid, error = validate_nickname("")
    assert is_valid is False
    assert "empty" in error.lower()


@pytest.mark.unit
def test_validate_nickname_whitespace_only():
    """Test whitespace-only nickname"""
    is_valid, error = validate_nickname("   ")
    assert is_valid is False
    assert "empty" in error.lower()

    is_valid, error = validate_nickname("\t\n")
    assert is_valid is False


@pytest.mark.unit
def test_validate_nickname_too_long():
    """Test nickname too long"""
    is_valid, error = validate_nickname("A" * 21)  # 21 chars
    assert is_valid is False
    assert "20 characters" in error

    is_valid, error = validate_nickname("A" * 20)  # Exactly 20 is ok
    assert is_valid is True


@pytest.mark.unit
def test_validate_nickname_none():
    """Test None nickname"""
    is_valid, error = validate_nickname(None)
    assert is_valid is False
