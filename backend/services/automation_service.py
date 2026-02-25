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
    automation_enabled: bool
) -> Dict[str, any]:
    """Process transcript entry and execute automation actions

    Imperative Shell - orchestrates I/O and delegates logic

    Args:
        room_code: Room code
        transcript_text: New transcript text
        automation_enabled: Whether automation is enabled for room

    Returns:
        Dictionary with:
        - actions_taken: List of actions performed
        - details: additional information
    """
    result = {
        "actions_taken": [],
        "details": {}
    }

    # If automation disabled, skip processing
    if not automation_enabled:
        result["details"]["reason"] = "Automation disabled for room"
        return result

    # Get all bets in room (I/O)
    all_bets = await bet_service.get_bets_in_room(room_code)

    # Find pending and open bets
    pending_bets = [b for b in all_bets if b.status.value == "pending"]
    open_bets = [b for b in all_bets if b.status.value == "open"]
    locked_bets = [b for b in all_bets if b.status.value == "locked"]

    # Check pending bets for opening
    for bet in pending_bets:
        # Get trigger config from bet (would come from event template in production)
        open_patterns = getattr(bet, 'open_patterns', [
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
            await bet_service.open_bet(bet.bet_id)

            result["actions_taken"].append({
                "action": "open_bet",
                "confidence": open_confidence,
                "bet_id": bet.bet_id,
                "question": bet.question,
            })

    # Check open/locked bets for resolution
    for bet in open_bets + locked_bets:
        # Get resolve patterns from bet
        resolve_patterns = getattr(bet, 'resolve_patterns', [
            "and the winner is",
            "grammy goes to",
            "oscar goes to"
        ])

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

            result["actions_taken"].append({
                "action": "resolve_bet",
                "confidence": winner_confidence,
                "bet_id": bet.bet_id,
                "winner": winner,
            })

    if not result["actions_taken"]:
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
