"""Data models for SmallBets.live

All models follow FCIS pattern:
- Pure Pydantic models with no I/O
- to_dict() and from_dict() methods for Firestore serialization
- Validation logic only, no database operations
"""

from .room import Room, MatchDetails
from .user import User
from .bet import Bet, BetStatus
from .user_bet import UserBet
from .room_user import RoomUser
from .bet_template import BetTemplate
from .transcript import TranscriptEntry
from .event_template import EventTemplate, TriggerConfig

__all__ = [
    "Room",
    "MatchDetails",
    "User",
    "Bet",
    "BetStatus",
    "UserBet",
    "RoomUser",
    "BetTemplate",
    "TranscriptEntry",
    "EventTemplate",
    "TriggerConfig",
]
