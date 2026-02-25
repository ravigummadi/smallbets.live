"""Bet model - represents a betting question"""

from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field


class BetStatus(str, Enum):
    """Bet status enum"""
    PENDING = "pending"  # Created but not yet opened
    OPEN = "open"  # Users can place bets
    LOCKED = "locked"  # Betting closed, waiting for resolution
    RESOLVED = "resolved"  # Winner determined, points distributed


class Bet(BaseModel):
    """Bet model for a betting question

    Follows FCIS pattern: pure data model with no I/O
    """

    bet_id: str = Field(..., description="Unique bet identifier")
    room_code: str = Field(..., min_length=4, max_length=4)
    question: str = Field(..., min_length=1, description="Betting question")
    options: list[str] = Field(..., min_items=2, description="Betting options")
    status: BetStatus = Field(default=BetStatus.PENDING)
    opened_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    winning_option: Optional[str] = None
    points_value: int = Field(..., ge=10, le=1000, description="Points required to place this bet")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage

        Pure function - no I/O operations
        """
        return {
            "betId": self.bet_id,
            "roomCode": self.room_code,
            "question": self.question,
            "options": self.options,
            "status": self.status.value,
            "openedAt": self.opened_at,
            "lockedAt": self.locked_at,
            "resolvedAt": self.resolved_at,
            "winningOption": self.winning_option,
            "pointsValue": self.points_value,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Bet":
        """Deserialize from Firestore

        Pure function - no I/O operations
        """
        return cls(
            bet_id=data["betId"],
            room_code=data["roomCode"],
            question=data["question"],
            options=data["options"],
            status=BetStatus(data["status"]),
            opened_at=data.get("openedAt"),
            locked_at=data.get("lockedAt"),
            resolved_at=data.get("resolvedAt"),
            winning_option=data.get("winningOption"),
            points_value=data.get("pointsValue", 100),  # Default for backwards compatibility
        )

    def can_accept_bets(self) -> bool:
        """Check if bet is accepting user bets

        Pure function
        """
        return self.status == BetStatus.OPEN

    def is_resolved(self) -> bool:
        """Check if bet has been resolved

        Pure function
        """
        return self.status == BetStatus.RESOLVED

    def open_bet(self) -> "Bet":
        """Return new Bet instance with opened status

        Pure function - immutable update
        """
        return self.model_copy(update={
            "status": BetStatus.OPEN,
            "opened_at": datetime.utcnow(),
        })

    def lock_bet(self) -> "Bet":
        """Return new Bet instance with locked status

        Pure function - immutable update
        """
        return self.model_copy(update={
            "status": BetStatus.LOCKED,
            "locked_at": datetime.utcnow(),
        })

    def resolve_bet(self, winning_option: str) -> "Bet":
        """Return new Bet instance with resolved status

        Pure function - immutable update
        """
        if winning_option not in self.options:
            raise ValueError(f"Invalid winning option: {winning_option}")

        return self.model_copy(update={
            "status": BetStatus.RESOLVED,
            "resolved_at": datetime.utcnow(),
            "winning_option": winning_option,
        })
