"""UserBet model - represents a user's bet placement"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserBet(BaseModel):
    """UserBet model for tracking individual bet placements

    Follows FCIS pattern: pure data model with no I/O
    """

    user_id: str = Field(..., description="User who placed the bet")
    bet_id: str = Field(..., description="Bet being placed on")
    room_code: str = Field(..., min_length=4, max_length=4)
    selected_option: str = Field(..., description="User's selected option")
    placed_at: datetime = Field(default_factory=datetime.utcnow)
    points_won: Optional[int] = Field(default=None, description="Points won (null until resolved)")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage

        Pure function - no I/O operations
        """
        return {
            "userId": self.user_id,
            "betId": self.bet_id,
            "roomCode": self.room_code,
            "selectedOption": self.selected_option,
            "placedAt": self.placed_at,
            "pointsWon": self.points_won,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "UserBet":
        """Deserialize from Firestore

        Pure function - no I/O operations
        """
        return cls(
            user_id=data["userId"],
            bet_id=data["betId"],
            room_code=data["roomCode"],
            selected_option=data["selectedOption"],
            placed_at=data["placedAt"],
            points_won=data.get("pointsWon"),
        )

    def is_winner(self, winning_option: str) -> bool:
        """Check if this bet won

        Pure function
        """
        return self.selected_option == winning_option

    def with_points_won(self, points: int) -> "UserBet":
        """Return new UserBet instance with points_won set

        Pure function - immutable update
        """
        return self.model_copy(update={"points_won": points})
