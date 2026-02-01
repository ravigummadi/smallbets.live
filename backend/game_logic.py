"""Game logic - Functional Core for SmallBets.live

CRITICAL: This module is PURE FUNCTIONAL CORE
- All functions must be deterministic (same inputs → same outputs)
- NO I/O operations (no Firestore, no HTTP, no file operations)
- NO side effects (no mutations of external state)
- Easy to test without mocks

All betting calculations, scoring rules, and game state transitions live here.
"""

from typing import Dict, List, Optional
from models.bet import Bet, BetStatus
from models.user import User
from models.user_bet import UserBet


# Constants
INITIAL_POINTS = 1000
BET_COST = 100
MIN_POINTS_TO_BET = 100


def calculate_scores(
    user_bets: List[UserBet],
    users: Dict[str, User],
    winning_option: str,
    bet_cost: int = BET_COST,
) -> Dict[str, int]:
    """Calculate point changes for all users after bet resolution

    Pure function - deterministic based on inputs only

    Args:
        user_bets: List of all bets placed for this bet
        users: Map of user_id to User objects
        winning_option: The winning option
        bet_cost: Points cost per bet (default 100)

    Returns:
        Dictionary mapping user_id to points_won
        - Winners: split pot evenly
        - Losers: 0 points
        - Non-participants: 0 points (not in result map)

    Examples:
        >>> # 5 users, 3 pick correctly, 2 pick wrong
        >>> # Pot = 500 (5 * 100), winners split 500 / 3 = 166 each
        >>> calculate_scores(user_bets, users, "Oppenheimer", 100)
        {"user1": 166, "user2": 166, "user3": 166, "user4": 0, "user5": 0}
    """
    if not user_bets:
        return {}

    # Separate winners from losers
    winners = [ub for ub in user_bets if ub.is_winner(winning_option)]
    losers = [ub for ub in user_bets if not ub.is_winner(winning_option)]

    # Calculate pot
    total_pot = len(user_bets) * bet_cost

    # Edge case: Everyone picked the same option
    if not losers or not winners:
        # Refund everyone (no point changes)
        return {ub.user_id: bet_cost for ub in user_bets}

    # Split pot evenly among winners
    points_per_winner = total_pot // len(winners)

    # Build result map
    result = {}
    for winner in winners:
        result[winner.user_id] = points_per_winner

    for loser in losers:
        result[loser.user_id] = 0

    return result


def validate_bet_eligibility(
    user: User,
    bet: Bet,
    existing_user_bet: Optional[UserBet],
    bet_cost: int = BET_COST,
) -> tuple[bool, Optional[str]]:
    """Validate if user can place a bet

    Pure function - deterministic based on inputs only

    Args:
        user: User attempting to bet
        bet: Bet being placed on
        existing_user_bet: User's existing bet (if any)
        bet_cost: Points cost per bet

    Returns:
        (is_valid, error_message)
        - (True, None) if valid
        - (False, "error message") if invalid

    Validation rules:
        1. Bet must be in OPEN status
        2. User must have enough points
        3. User cannot have already bet on this bet
    """
    # Rule 1: Bet must be open
    if not bet.can_accept_bets():
        return False, f"Bet is not open (status: {bet.status.value})"

    # Rule 2: User must have enough points
    if not user.can_afford_bet(bet_cost):
        return False, f"Insufficient points (have: {user.points}, need: {bet_cost})"

    # Rule 3: User cannot have already bet
    if existing_user_bet is not None:
        return False, "You have already placed a bet on this question"

    return True, None


def calculate_pot_total(num_participants: int, bet_cost: int = BET_COST) -> int:
    """Calculate total pot for a bet

    Pure function

    Args:
        num_participants: Number of users who placed bets
        bet_cost: Points cost per bet

    Returns:
        Total pot size
    """
    return num_participants * bet_cost


def distribute_pot(
    winners: List[str],
    pot_total: int,
) -> Dict[str, int]:
    """Distribute pot evenly among winners

    Pure function

    Args:
        winners: List of winning user IDs
        pot_total: Total pot to distribute

    Returns:
        Dictionary mapping user_id to points_won
    """
    if not winners:
        return {}

    points_per_winner = pot_total // len(winners)

    return {user_id: points_per_winner for user_id in winners}


def calculate_leaderboard(users: Dict[str, User]) -> List[Dict[str, any]]:
    """Calculate leaderboard sorted by points

    Pure function

    Args:
        users: Dictionary of user_id to User objects

    Returns:
        Sorted list of user data for leaderboard display
        Format: [{"userId": "...", "nickname": "...", "points": 1234, "rank": 1}, ...]

    Sort order:
        1. Points (descending)
        2. Join time (ascending) - earlier join wins ties
    """
    # Convert to list and sort
    user_list = list(users.values())

    # Sort by points (desc), then by joined_at (asc)
    sorted_users = sorted(
        user_list,
        key=lambda u: (-u.points, u.joined_at),
    )

    # Build leaderboard with ranks
    leaderboard = []
    for rank, user in enumerate(sorted_users, start=1):
        leaderboard.append({
            "userId": user.user_id,
            "nickname": user.nickname,
            "points": user.points,
            "rank": rank,
            "isAdmin": user.is_admin,
        })

    return leaderboard


def validate_room_code(code: str) -> tuple[bool, Optional[str]]:
    """Validate room code format

    Pure function

    Args:
        code: Room code to validate

    Returns:
        (is_valid, error_message)
    """
    if len(code) != 4:
        return False, "Room code must be exactly 4 characters"

    if not code.isalnum():
        return False, "Room code must contain only letters and numbers"

    if not code.isupper():
        return False, "Room code must be uppercase"

    # Check for confusing characters (O/0, I/1/L)
    confusing_chars = set("OI1L")
    if any(char in confusing_chars for char in code):
        return False, "Room code cannot contain O, I, 1, or L (confusing characters)"

    return True, None


def validate_nickname(nickname: str) -> tuple[bool, Optional[str]]:
    """Validate user nickname

    Pure function

    Args:
        nickname: Nickname to validate

    Returns:
        (is_valid, error_message)
    """
    if not nickname or not nickname.strip():
        return False, "Nickname cannot be empty"

    if len(nickname) > 20:
        return False, "Nickname must be 20 characters or less"

    if len(nickname) < 1:
        return False, "Nickname must be at least 1 character"

    return True, None
