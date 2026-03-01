"""Tests for Bet model undo functionality"""

import pytest
from datetime import datetime, timedelta
from models.bet import Bet, BetStatus


@pytest.mark.unit
def test_bet_resolve_sets_undo_window():
    """Test resolving a bet sets 10s undo window"""
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )
    locked = bet.lock_bet()
    resolved = locked.resolve_bet("A")

    assert resolved.status == BetStatus.RESOLVED
    assert resolved.winning_option == "A"
    assert resolved.can_undo_until is not None
    # Undo window should be ~10 seconds from now
    delta = resolved.can_undo_until - resolved.resolved_at
    assert 9 <= delta.total_seconds() <= 11


@pytest.mark.unit
def test_bet_can_undo_within_window():
    """Test can_undo returns True within 10s window"""
    now = datetime.utcnow()
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        points_value=100,
        winning_option="A",
        resolved_at=now,
        can_undo_until=now + timedelta(seconds=10),
    )
    assert bet.can_undo() is True


@pytest.mark.unit
def test_bet_can_undo_expired_window():
    """Test can_undo returns False after window expires"""
    now = datetime.utcnow()
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        points_value=100,
        winning_option="A",
        resolved_at=now - timedelta(seconds=15),
        can_undo_until=now - timedelta(seconds=5),
    )
    assert bet.can_undo() is False


@pytest.mark.unit
def test_bet_can_undo_not_resolved():
    """Test can_undo returns False for non-resolved bets"""
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.OPEN,
        points_value=100,
    )
    assert bet.can_undo() is False


@pytest.mark.unit
def test_bet_undo_resolve_reverts_to_locked():
    """Test undo_resolve reverts bet to locked status"""
    now = datetime.utcnow()
    resolved_bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        points_value=100,
        winning_option="A",
        resolved_at=now,
        can_undo_until=now + timedelta(seconds=10),
    )

    undone = resolved_bet.undo_resolve()
    assert undone.status == BetStatus.LOCKED
    assert undone.winning_option is None
    assert undone.resolved_at is None
    assert undone.can_undo_until is None


@pytest.mark.unit
def test_bet_undo_resolve_expired_raises():
    """Test undo_resolve raises error after window expires"""
    now = datetime.utcnow()
    expired_bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.RESOLVED,
        points_value=100,
        winning_option="A",
        resolved_at=now - timedelta(seconds=15),
        can_undo_until=now - timedelta(seconds=5),
    )

    with pytest.raises(ValueError, match="undo window has expired"):
        expired_bet.undo_resolve()


@pytest.mark.unit
def test_bet_tournament_fields():
    """Test bet with tournament-specific fields"""
    bet = Bet(
        bet_id="b1",
        room_code="ABCDE2",
        question="IPL Winner?",
        options=["MI", "CSK"],
        status=BetStatus.OPEN,
        points_value=100,
        bet_type="tournament",
        created_from="template",
        template_id="ipl-2026",
        timer_duration=120,
    )
    assert bet.bet_type == "tournament"
    assert bet.created_from == "template"
    assert bet.template_id == "ipl-2026"
    assert bet.timer_duration == 120

    data = bet.to_dict()
    assert data["betType"] == "tournament"
    assert data["createdFrom"] == "template"
    assert data["templateId"] == "ipl-2026"
    assert data["timerDuration"] == 120

    restored = Bet.from_dict(data)
    assert restored.bet_type == "tournament"
    assert restored.template_id == "ipl-2026"


@pytest.mark.unit
def test_bet_resolve_invalid_option_raises():
    """Test resolve with invalid option raises"""
    bet = Bet(
        bet_id="b1",
        room_code="AAAA",
        question="Who wins?",
        options=["A", "B"],
        status=BetStatus.LOCKED,
        points_value=100,
    )
    with pytest.raises(ValueError, match="Invalid winning option"):
        bet.resolve_bet("C")
