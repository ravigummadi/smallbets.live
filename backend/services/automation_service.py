"""Automation service - Bet automation logic orchestration

IMPERATIVE SHELL: Orchestrates transcript parsing and bet actions
- Delegates parsing to transcript_parser.py (pure functions)
- Performs I/O via other services
"""

from typing import Optional, Dict
import transcript_parser
from services import bet_service, room_service


async def process_transcript_for_automation(
    room_code: str,
    transcript_text: str,
    current_bet_id: Optional[str],
    automation_enabled: bool
) -> Dict[str, any]:
    """Process transcript entry and execute automation actions

    Imperative Shell - orchestrates I/O and delegates logic

    Args:
        room_code: Room code
        transcript_text: New transcript text
        current_bet_id: Currently active bet ID (if any)
        automation_enabled: Whether automation is enabled for room

    Returns:
        Dictionary with:
        - action_taken: "open_bet" | "resolve_bet" | "ignored" | "disabled"
        - confidence: confidence score
        - details: additional information
    """
    result = {
        "action_taken": "disabled",
        "confidence": 0.0,
        "details": {}
    }

    # If automation disabled, skip processing
    if not automation_enabled:
        result["details"]["reason"] = "Automation disabled for room"
        return result

    # Get current bet if exists (I/O)
    current_bet = None
    if current_bet_id:
        current_bet = await bet_service.get_bet(current_bet_id)

    # If no current bet, check for next pending bet to open
    if not current_bet or current_bet.status.value in ["resolved", "locked"]:
        # Get all bets in room (I/O)
        all_bets = await bet_service.get_bets_in_room(room_code)

        # Find first pending bet
        pending_bets = [b for b in all_bets if b.status.value == "pending"]

        if not pending_bets:
            result["action_taken"] = "ignored"
            result["details"]["reason"] = "No pending bets available"
            return result

        next_bet = pending_bets[0]

        # Check if transcript triggers bet opening (pure - delegates to transcript_parser)
        # Get trigger config from bet (would come from event template in production)
        open_patterns = getattr(next_bet, 'open_patterns', [
            "and the nominees are",
            "next category",
            "envelope please"
        ])

        should_open, open_confidence = transcript_parser.should_open_bet(
            transcript_text,
            open_patterns,
            threshold=0.7
        )

        if should_open:
            # Open the bet (I/O)
            await bet_service.open_bet(next_bet.bet_id)
            await room_service.set_current_bet(room_code, next_bet.bet_id)

            result["action_taken"] = "open_bet"
            result["confidence"] = open_confidence
            result["details"] = {
                "bet_id": next_bet.bet_id,
                "question": next_bet.question,
                "trigger_type": "open"
            }
            return result

        result["action_taken"] = "ignored"
        result["details"]["reason"] = "Transcript did not trigger bet opening"
        result["details"]["open_confidence"] = open_confidence
        return result

    # Current bet exists and is open - check for resolution
    if current_bet.status.value == "open":
        # Get resolve patterns from bet
        resolve_patterns = getattr(current_bet, 'resolve_patterns', [
            "and the winner is",
            "grammy goes to",
            "oscar goes to"
        ])

        # Extract winner (pure - delegates to transcript_parser)
        winner, winner_confidence, is_resolution = transcript_parser.extract_winner_with_patterns(
            transcript_text,
            current_bet.options,
            resolve_patterns,
            threshold=0.85
        )

        if is_resolution and winner:
            # Resolve the bet (I/O)
            await bet_service.resolve_bet(current_bet.bet_id, winner)
            await room_service.set_current_bet(room_code, None)

            result["action_taken"] = "resolve_bet"
            result["confidence"] = winner_confidence
            result["details"] = {
                "bet_id": current_bet.bet_id,
                "winner": winner,
                "trigger_type": "resolve"
            }
            return result

        result["action_taken"] = "ignored"
        result["details"]["reason"] = "Transcript did not trigger bet resolution"
        result["details"]["winner_confidence"] = winner_confidence
        result["details"]["is_resolution"] = is_resolution
        return result

    # Bet is in another state (locked, etc.)
    result["action_taken"] = "ignored"
    result["details"]["reason"] = f"Current bet is in {current_bet.status.value} state"
    return result


async def toggle_automation(room_code: str, enabled: bool) -> None:
    """Toggle automation for a room

    Imperative Shell - performs Firestore update

    Args:
        room_code: Room code
        enabled: Whether to enable or disable automation
    """
    # Get room (I/O)
    room = await room_service.get_room(room_code)
    if not room:
        raise ValueError(f"Room not found: {room_code}")

    # Update automation status (pure - immutable update)
    updated_room = room.model_copy(update={"automation_enabled": enabled})

    # Save to Firestore (I/O)
    await room_service.update_room(updated_room)
