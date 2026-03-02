"""RoomUser model - represents a user's membership in a specific room

Enables per-room scoring, leaderboard queries, and cross-room aggregation.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class RoomUser(BaseModel):
    """RoomUser model for per-room user data

    Follows FCIS pattern: pure data model with no I/O
    Collection: roomUsers, Doc ID: {roomCode}_{userId}
    """

    id: str = Field(..., description="{roomCode}_{userId}")
    room_code: str = Field(..., min_length=4, max_length=6)
    user_id: str = Field(..., description="Firebase Auth UID")
    nickname: str = Field(..., min_length=1, max_length=20, description="Display name")
    points: int = Field(default=1000, description="Points in this room (starts at 1000)")
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_host: bool = Field(default=False, description="Derived server-side from room.hostId == userId")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage"""
        return {
            "id": self.id,
            "roomCode": self.room_code,
            "userId": self.user_id,
            "nickname": self.nickname,
            "points": self.points,
            "joinedAt": self.joined_at,
            "isHost": self.is_host,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RoomUser":
        """Deserialize from Firestore"""
        return cls(
            id=data["id"],
            room_code=data["roomCode"],
            user_id=data["userId"],
            nickname=data["nickname"],
            points=data["points"],
            is_host=data.get("isHost", False),
            joined_at=data["joinedAt"],
        )

    def can_afford_bet(self, bet_cost: int) -> bool:
        """Check if user has enough points for a bet"""
        return self.points >= bet_cost

    def add_points(self, amount: int) -> "RoomUser":
        """Return new RoomUser instance with points added"""
        return self.model_copy(update={"points": self.points + amount})

    def subtract_points(self, amount: int) -> "RoomUser":
        """Return new RoomUser instance with points subtracted"""
        return self.model_copy(update={"points": max(0, self.points - amount)})
