"""Tests for automation_service.py - Integration tests

Tests that expose bugs in automation service:
1. Trigger config not being loaded from templates
2. API response format mismatch (actions_taken vs action_taken)
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime

from services import automation_service
from models.bet import Bet, BetStatus


class TestProcessTranscriptForAutomation:
    """Test transcript processing and automation triggers"""

    @pytest.mark.asyncio
    async def test_automation_disabled_returns_no_action(self):
        """When automation is disabled, should return reason and no actions"""
        result = await automation_service.process_transcript_for_automation(
            room_code="TEST",
            transcript_text="And the Grammy goes to Beyoncé!",
            automation_enabled=False
        )

        # Check NEW format (after fix)
        assert result["action_taken"] == "ignored"
        assert result["confidence"] == 0.0
        assert result["details"]["reason"] == "Automation disabled for room"

    # REMOVED: Bet opening functionality removed
    # Bets are now opened manually by admin, transcription only resolves them

    @pytest.mark.asyncio
    @patch('services.automation_service.bet_service.get_bets_in_room')
    @patch('services.automation_service.bet_service.resolve_bet')
    async def test_resolves_open_bet_when_winner_announced(self, mock_resolve_bet, mock_get_bets):
        """Should resolve open bet when winner is announced"""
        open_bet = Bet(
            bet_id="album-of-year",
            room_code="TEST",
            question="Album of the Year?",
            options=["Taylor Swift", "Beyoncé", "Billie Eilish"],
            status=BetStatus.OPEN,
            points_value=100,
            opened_at=datetime.utcnow(),
            resolve_patterns=[
                "grammy goes to",
                "and the winner is"
            ]
        )

        mock_get_bets.return_value = [open_bet]
        mock_resolve_bet.return_value = None

        result = await automation_service.process_transcript_for_automation(
            room_code="TEST",
            transcript_text="And the Grammy goes to... Beyoncé!",
            automation_enabled=True
        )

        # Check NEW format (after fix)
        assert result["action_taken"] == "resolve_bet"
        assert result["confidence"] > 0.8
        assert result["details"]["winner"] == "Beyoncé"
        assert result["details"]["bet_id"] == "album-of-year"
        mock_resolve_bet.assert_called_once_with("album-of-year", "Beyoncé")

    @pytest.mark.asyncio
    @patch('services.automation_service.bet_service.get_bets_in_room')
    async def test_returns_ignore_when_no_match(self, mock_get_bets):
        """Should return 'ignored' when transcript doesn't match any patterns"""
        pending_bet = Bet(
            bet_id="album-of-year",
            room_code="TEST",
            question="Album of the Year?",
            options=["Taylor Swift", "Beyoncé", "Billie Eilish"],
            status=BetStatus.PENDING,
            points_value=100,
        )

        mock_get_bets.return_value = [pending_bet]

        result = await automation_service.process_transcript_for_automation(
            room_code="TEST",
            transcript_text="Thank you all for joining us tonight!",
            automation_enabled=True
        )

        # Check NEW format (after fix)
        assert result["action_taken"] == "ignored"
        assert result["confidence"] == 0.0
        assert "reason" in result["details"]


class TestAPIResponseFormat:
    """Test API response format matches frontend expectations

    FIXED: Backend now returns action_taken (string) and confidence at top level
    """

    @pytest.mark.asyncio
    @patch('services.automation_service.bet_service.get_bets_in_room')
    async def test_response_format_matches_frontend_expectations(self, mock_get_bets):
        """Frontend expects action_taken (singular string), not actions_taken (array)

        FIXED: API now returns the correct format!
        Backend: { "action_taken": "ignored", "confidence": 0.0, "details": {} }
        Frontend expects: { "action_taken": "open_bet", "confidence": 0.85, "details": {} }

        See LiveFeedPanel.tsx:146 - lastResult.automation.action_taken
        """
        mock_get_bets.return_value = []

        result = await automation_service.process_transcript_for_automation(
            room_code="TEST",
            transcript_text="Some text",
            automation_enabled=True
        )

        # Check NEW format (after fix) - what frontend expects
        assert "action_taken" in result
        assert isinstance(result["action_taken"], str)
        assert result["action_taken"] == "ignored"

        # Frontend expects confidence at top level
        assert "confidence" in result
        assert isinstance(result["confidence"], (int, float))
        assert result["confidence"] == 0.0

        # Details should exist
        assert "details" in result
        assert isinstance(result["details"], dict)


class TestTriggerConfigLoading:
    """Test that trigger configs from templates are properly loaded

    FIXED: Bet model now supports open_patterns and resolve_patterns!
    """

    def test_bet_model_supports_trigger_config(self):
        """Bet model should have resolve_patterns field for automation

        FIXED: Bet model now has resolve_patterns (open_patterns removed - not needed)!
        """
        bet = Bet(
            bet_id="test",
            room_code="TEST",
            question="Test?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=100,
            resolve_patterns=["winner is", "and the grammy goes to"]
        )

        # Verify pattern field exists and is set correctly
        assert bet.resolve_patterns == ["winner is", "and the grammy goes to"]

        # Also test with None (should be allowed)
        bet_no_patterns = Bet(
            bet_id="test2",
            room_code="TEST",
            question="Test?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=100,
        )

        assert bet_no_patterns.resolve_patterns is None

    def test_bet_serialization_includes_trigger_config(self):
        """Bet.to_dict() should include resolve_patterns

        FIXED: Serialization now includes resolvePatterns!
        """
        bet = Bet(
            bet_id="test",
            room_code="TEST",
            question="Test?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=100,
            resolve_patterns=["winner is", "grammy goes to"]
        )

        bet_dict = bet.to_dict()

        # Verify resolvePatterns is included
        assert "resolvePatterns" in bet_dict
        assert bet_dict["resolvePatterns"] == ["winner is", "grammy goes to"]

        # Test with None patterns
        bet_no_patterns = Bet(
            bet_id="test2",
            room_code="TEST",
            question="Test?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=100,
        )

        bet_dict_no_patterns = bet_no_patterns.to_dict()
        assert "resolvePatterns" in bet_dict_no_patterns
        assert bet_dict_no_patterns["resolvePatterns"] is None


class TestTypeAnnotations:
    """Test for type annotation bugs"""

    def test_return_type_annotation_is_valid(self):
        """Check if return type annotation uses correct 'Any' instead of 'any'

        BUG: automation_service.py:17 has 'Dict[str, any]' (lowercase)
        Should be 'Dict[str, Any]' (capitalized)
        """
        import inspect
        from typing import get_type_hints

        try:
            # Try to get type hints - will fail if annotations are invalid
            hints = get_type_hints(automation_service.process_transcript_for_automation)
            # If we get here, annotations are valid
            return_type = hints.get('return')
            assert return_type is not None
        except NameError as e:
            if "'any' is not defined" in str(e):
                pytest.fail(
                    f"BUG CONFIRMED: Invalid type annotation 'any' (should be 'Any'). "
                    f"Error: {e}"
                )
            raise
