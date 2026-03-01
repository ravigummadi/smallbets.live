"""Room model - represents a betting session"""

from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field


class MatchDetails(BaseModel):
    """Match details for match rooms"""

    team1: str = Field(..., min_length=1, description="First team name")
    team2: str = Field(..., min_length=1, description="Second team name")
    match_date_time: str = Field(..., description="ISO 8601 datetime with timezone")
    venue: Optional[str] = Field(default=None, description="Match venue")

    def to_dict(self) -> dict:
        result = {
            "team1": self.team1,
            "team2": self.team2,
            "matchDateTime": self.match_date_time,
        }
        if self.venue is not None:
            result["venue"] = self.venue
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "MatchDetails":
        return cls(
            team1=data["team1"],
            team2=data["team2"],
            match_date_time=data["matchDateTime"],
            venue=data.get("venue"),
        )


class Room(BaseModel):
    """Room model for a betting session

    Follows FCIS pattern: pure data model with no I/O

    Room types:
    - "event": Legacy single-event room (24h auto-expiry)
    - "tournament": Multi-match tournament room (manual close, no expiry)
    - "match": Match room linked to a tournament (manual close, no expiry)
    """

    code: str = Field(..., min_length=4, max_length=6, description="4-6 character room code")
    event_template: str = Field(..., description="Event template ID (grammys-2026, ipl-2026, etc.)")
    event_name: Optional[str] = Field(default=None, description="Custom event name")
    status: str = Field(default="waiting", description="Room status: waiting|active|finished")
    host_id: str = Field(..., description="User ID of room host")
    automation_enabled: bool = Field(default=True, description="Whether automation is enabled")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default_factory=lambda: datetime.utcnow() + timedelta(hours=24))

    # Tournament fields
    room_type: str = Field(default="event", description="Room type: event|tournament|match")
    parent_room_code: Optional[str] = Field(default=None, description="Parent tournament room code (match rooms only)")
    participants: List[str] = Field(default_factory=list, description="User IDs of participants")
    match_details: Optional[MatchDetails] = Field(default=None, description="Match details (match rooms only)")
    current_bet_id: Optional[str] = Field(default=None, description="Currently active bet ID")
    version: int = Field(default=1, description="Optimistic locking version")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage"""
        result = {
            "code": self.code,
            "eventTemplate": self.event_template,
            "eventName": self.event_name,
            "status": self.status,
            "hostId": self.host_id,
            "automationEnabled": self.automation_enabled,
            "createdAt": self.created_at,
            "expiresAt": self.expires_at,
            "roomType": self.room_type,
            "parentRoomCode": self.parent_room_code,
            "participants": self.participants,
            "matchDetails": self.match_details.to_dict() if self.match_details else None,
            "currentBetId": self.current_bet_id,
            "version": self.version,
        }
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "Room":
        """Deserialize from Firestore"""
        match_details = None
        if data.get("matchDetails"):
            match_details = MatchDetails.from_dict(data["matchDetails"])

        return cls(
            code=data["code"],
            event_template=data["eventTemplate"],
            event_name=data.get("eventName"),
            status=data["status"],
            host_id=data["hostId"],
            automation_enabled=data.get("automationEnabled", True),
            created_at=data["createdAt"],
            expires_at=data.get("expiresAt"),
            room_type=data.get("roomType", "event"),
            parent_room_code=data.get("parentRoomCode"),
            participants=data.get("participants", []),
            match_details=match_details,
            current_bet_id=data.get("currentBetId"),
            version=data.get("version", 1),
        )

    def is_expired(self) -> bool:
        """Check if room has expired

        Tournament and match rooms never expire (expires_at is None).
        Event rooms expire after 24h.
        """
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def can_accept_bets(self) -> bool:
        """Check if room can accept new bets"""
        return self.status == "active" and not self.is_expired()

    def is_tournament(self) -> bool:
        """Check if this is a tournament room"""
        return self.room_type == "tournament"

    def is_match(self) -> bool:
        """Check if this is a match room"""
        return self.room_type == "match"
