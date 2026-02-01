"""Room model - represents a betting session"""

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field


class Room(BaseModel):
    """Room model for a betting session

    Follows FCIS pattern: pure data model with no I/O
    """

    code: str = Field(..., min_length=4, max_length=4, description="4-character room code")
    event_template: str = Field(..., description="Event template ID (grammys-2026, oscars-2026, etc.)")
    status: str = Field(default="waiting", description="Room status: waiting|active|finished")
    current_bet_id: Optional[str] = Field(default=None, description="Currently active bet ID")
    host_id: str = Field(..., description="User ID of room host (for X-Host-Id auth)")
    automation_enabled: bool = Field(default=True, description="Whether automation is enabled")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(hours=24))

    def to_dict(self) -> dict:
        """Serialize for Firestore storage

        Pure function - no I/O operations
        """
        return {
            "code": self.code,
            "eventTemplate": self.event_template,
            "status": self.status,
            "currentBetId": self.current_bet_id,
            "hostId": self.host_id,
            "automationEnabled": self.automation_enabled,
            "createdAt": self.created_at,
            "expiresAt": self.expires_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Room":
        """Deserialize from Firestore

        Pure function - no I/O operations
        """
        return cls(
            code=data["code"],
            event_template=data["eventTemplate"],
            status=data["status"],
            current_bet_id=data.get("currentBetId"),
            host_id=data["hostId"],
            automation_enabled=data.get("automationEnabled", True),
            created_at=data["createdAt"],
            expires_at=data["expiresAt"],
        )

    def is_expired(self) -> bool:
        """Check if room has expired

        Pure function - deterministic based on current time
        """
        return datetime.utcnow() > self.expires_at

    def can_accept_bets(self) -> bool:
        """Check if room can accept new bets

        Pure function
        """
        return self.status == "active" and not self.is_expired()
