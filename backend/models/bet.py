"""Bet model - represents a betting question"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
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
    room_code: str = Field(..., min_length=4, max_length=6)
    question: str = Field(..., min_length=1, description="Betting question")
    options: list[str] = Field(..., min_items=2, description="Betting options")
    status: BetStatus = Field(default=BetStatus.PENDING)
    opened_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    winning_option: Optional[str] = None
    points_value: int = Field(..., ge=10, le=1000, description="Points required to place this bet")

    # Automation: Winner resolution patterns (from event templates)
    resolve_patterns: Optional[List[str]] = Field(
        default=None,
        description="Patterns that indicate winner announcement"
    )

    # Tournament fields
    bet_type: str = Field(default="in-game", description="Bet type: pre-match|in-game|tournament")
    created_from: str = Field(default="custom", description="Source: template|custom")
    template_id: Optional[str] = Field(default=None, description="Source template ID if created from template")
    timer_duration: int = Field(default=0, description="Timer duration in seconds (0 = no auto-lock)")
    can_undo_until: Optional[datetime] = Field(default=None, description="Undo window expiry (10s after resolution)")
    version: int = Field(default=1, description="Optimistic locking version")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage"""
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
            "resolvePatterns": self.resolve_patterns,
            "betType": self.bet_type,
            "createdFrom": self.created_from,
            "templateId": self.template_id,
            "timerDuration": self.timer_duration,
            "canUndoUntil": self.can_undo_until,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Bet":
        """Deserialize from Firestore"""
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
            points_value=data.get("pointsValue", 100),
            resolve_patterns=data.get("resolvePatterns"),
            bet_type=data.get("betType", "in-game"),
            created_from=data.get("createdFrom", "custom"),
            template_id=data.get("templateId"),
            timer_duration=data.get("timerDuration", 0),
            can_undo_until=data.get("canUndoUntil"),
            version=data.get("version", 1),
        )

    def can_accept_bets(self) -> bool:
        """Check if bet is accepting user bets"""
        return self.status == BetStatus.OPEN

    def is_resolved(self) -> bool:
        """Check if bet has been resolved"""
        return self.status == BetStatus.RESOLVED

    def can_undo(self) -> bool:
        """Check if bet resolution can be undone (within 10s window)"""
        if self.status != BetStatus.RESOLVED or self.can_undo_until is None:
            return False
        now = datetime.now(timezone.utc)
        deadline = self.can_undo_until
        # Ensure both sides are tz-aware for comparison
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return now < deadline

    def open_bet(self) -> "Bet":
        """Return new Bet instance with opened status"""
        return self.model_copy(update={
            "status": BetStatus.OPEN,
            "opened_at": datetime.utcnow(),
        })

    def lock_bet(self) -> "Bet":
        """Return new Bet instance with locked status"""
        return self.model_copy(update={
            "status": BetStatus.LOCKED,
            "locked_at": datetime.utcnow(),
        })

    def resolve_bet(self, winning_option: str) -> "Bet":
        """Return new Bet instance with resolved status and 10s undo window"""
        if winning_option not in self.options:
            raise ValueError(f"Invalid winning option: {winning_option}")

        now = datetime.now(timezone.utc)
        return self.model_copy(update={
            "status": BetStatus.RESOLVED,
            "resolved_at": now,
            "winning_option": winning_option,
            "can_undo_until": now + timedelta(seconds=10),
        })

    def unlock_bet(self) -> "Bet":
        """Return new Bet instance with reopened status (locked -> open)"""
        return self.model_copy(update={
            "status": BetStatus.OPEN,
            "locked_at": None,
        })

    def undo_resolve(self) -> "Bet":
        """Return new Bet instance with resolution undone (back to locked)"""
        if not self.can_undo():
            raise ValueError("Cannot undo: undo window has expired or bet is not resolved")

        return self.model_copy(update={
            "status": BetStatus.LOCKED,
            "resolved_at": None,
            "winning_option": None,
            "can_undo_until": None,
        })
