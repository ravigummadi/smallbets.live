"""Automation service - Bet automation logic orchestration

IMPERATIVE SHELL: Orchestrates transcript parsing and bet actions
- Delegates parsing to transcript_parser.py (pure functions)
- Performs I/O via other services
"""

from typing import Optional, Dict, Any
import transcript_parser
from services import bet_service, room_service


async def process_transcript_for_automation(
    room_code: str,
    transcript_text: str,
    automation_enabled: bool
) -> Dict[str, Any]:
    """Process transcript entry and resolve bets automatically

    Imperative Shell - orchestrates I/O and delegates logic

    NOTE: This only RESOLVES bets based on winner announcements.
    Bet opening is done manually by the admin.

    Args:
        room_code: Room code
        transcript_text: New transcript text (e.g., "And the Grammy goes to Beyoncé!")
        automation_enabled: Whether automation is enabled for room

    Returns:
        Dictionary with:
        - action_taken: Action performed ("resolve_bet" or "ignored")
        - confidence: Confidence score (0.0 - 1.0)
        - details: Additional information (reason, winner, bet_id)
    """
    result = {
        "action_taken": "ignored",
        "confidence": 0.0,
        "details": {}
    }

    # If automation disabled, skip processing
    if not automation_enabled:
        result["details"]["reason"] = "Automation disabled for room"
        return result

    # Get all bets in room (I/O)
    all_bets = await bet_service.get_bets_in_room(room_code)

    # Find open and locked bets (only these can be resolved)
    open_bets = [b for b in all_bets if b.status.value == "open"]
    locked_bets = [b for b in all_bets if b.status.value == "locked"]

    # Check open/locked bets for resolution
    for bet in open_bets + locked_bets:
        # Get resolve patterns from bet (now stored from template!)
        resolve_patterns = bet.resolve_patterns if bet.resolve_patterns else [
            "and the winner is",
            "grammy goes to",
            "oscar goes to"
        ]

        # Extract winner (pure - delegates to transcript_parser)
        winner, winner_confidence, is_resolution = transcript_parser.extract_winner_with_patterns(
            transcript_text,
            bet.options,
            resolve_patterns,
            threshold=0.85
        )

        if is_resolution and winner:
            # Resolve the bet (I/O)
            await bet_service.resolve_bet(bet.bet_id, winner)

            # Return immediately with first action (frontend expects single action)
            result["action_taken"] = "resolve_bet"
            result["confidence"] = winner_confidence
            result["details"] = {
                "bet_id": bet.bet_id,
                "winner": winner,
            }
            return result

    # No action taken
    result["details"]["reason"] = "Transcript did not trigger any bet actions"
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
