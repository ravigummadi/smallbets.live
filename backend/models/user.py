"""User model - represents a session participant"""

from datetime import datetime
from pydantic import BaseModel, Field


class User(BaseModel):
    """User model for session participant

    Follows FCIS pattern: pure data model with no I/O
    """

    user_id: str = Field(..., description="Auto-generated user ID")
    room_code: str = Field(..., min_length=4, max_length=4)
    nickname: str = Field(..., min_length=1, max_length=20, description="Display name")
    points: int = Field(default=1000, description="Current point balance")
    is_admin: bool = Field(default=False, description="Whether user is room admin")
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Serialize for Firestore storage

        Pure function - no I/O operations
        """
        return {
            "userId": self.user_id,
            "roomCode": self.room_code,
            "nickname": self.nickname,
            "points": self.points,
            "isAdmin": self.is_admin,
            "joinedAt": self.joined_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        """Deserialize from Firestore

        Pure function - no I/O operations
        """
        return cls(
            user_id=data["userId"],
            room_code=data["roomCode"],
            nickname=data["nickname"],
            points=data["points"],
            is_admin=data.get("isAdmin", False),
            joined_at=data["joinedAt"],
        )

    def can_afford_bet(self, bet_cost: int) -> bool:
        """Check if user has enough points for a bet

        Pure function
        """
        return self.points >= bet_cost

    def add_points(self, amount: int) -> "User":
        """Return new User instance with points added

        Pure function - immutable update
        """
        return self.model_copy(update={"points": self.points + amount})

    def subtract_points(self, amount: int) -> "User":
        """Return new User instance with points subtracted

        Pure function - immutable update
        """
        return self.model_copy(update={"points": max(0, self.points - amount)})
