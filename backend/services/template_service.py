"""Template service - Load event templates and create bets

IMPERATIVE SHELL: Handles file I/O and bet creation
"""

import json
import os
from typing import Optional, List
from pathlib import Path

from models.event_template import EventTemplate
from models.bet import Bet
from services import bet_service


def load_template(template_id: str) -> Optional[EventTemplate]:
    """Load event template from JSON file

    Imperative Shell - performs file I/O

    Args:
        template_id: Template ID (e.g., "grammys-2026")

    Returns:
        EventTemplate object or None if not found
    """
    # Get templates directory (relative to backend/)
    backend_dir = Path(__file__).parent.parent
    templates_dir = backend_dir.parent / "templates"
    template_path = templates_dir / f"{template_id}.json"

    if not template_path.exists():
        return None

    # Read template file (I/O)
    with open(template_path, 'r') as f:
        data = json.load(f)

    # Deserialize (pure)
    return EventTemplate.from_dict(data)


async def create_bets_from_template(room_code: str, template_id: str) -> List[Bet]:
    """Load template and create all bets for a room

    Imperative Shell - orchestrates I/O operations

    Args:
        room_code: Room code
        template_id: Template ID

    Returns:
        List of created Bet objects

    Raises:
        ValueError: If template not found
    """
    # Load template (I/O)
    template = load_template(template_id)

    if not template:
        raise ValueError(f"Template not found: {template_id}")

    # Create all bets from template
    created_bets = []

    for bet_config in template.bets:
        # Extract resolve patterns if present (for automation)
        trigger_config = bet_config.get("triggerConfig", {})
        resolve_patterns = trigger_config.get("resolve")

        # Create bet (I/O)
        bet = await bet_service.create_bet(
            room_code=room_code,
            question=bet_config["question"],
            options=bet_config["options"],
            points_value=bet_config.get("pointsValue", 100),
            resolve_patterns=resolve_patterns,
        )

        created_bets.append(bet)

    return created_bets
