"""Data models for SmallBets.live

All models follow FCIS pattern:
- Pure Pydantic models with no I/O
- to_dict() and from_dict() methods for Firestore serialization
- Validation logic only, no database operations
"""

from .room import Room
from .user import User
from .bet import Bet, BetStatus
from .user_bet import UserBet
from .transcript import TranscriptEntry
from .event_template import EventTemplate, TriggerConfig

__all__ = [
    "Room",
    "User",
    "Bet",
    "BetStatus",
    "UserBet",
    "TranscriptEntry",
    "EventTemplate",
    "TriggerConfig",
]
