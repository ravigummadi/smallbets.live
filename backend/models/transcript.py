"""TranscriptEntry model - represents a transcript text entry"""

from datetime import datetime
from pydantic import BaseModel, Field


class TranscriptEntry(BaseModel):
    """TranscriptEntry model for automation transcript ingestion

    Follows FCIS pattern: pure data model with no I/O
    """

    entry_id: str = Field(..., description="Unique entry identifier")
    room_code: str = Field(..., min_length=4, max_length=4)
    text: str = Field(..., min_length=1, description="Raw transcript text")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="manual", description="Source of transcript (youtube|manual|webhook)")

    def to_dict(self) -> dict:
        """Serialize for Firestore storage

        Pure function - no I/O operations
        """
        return {
            "entryId": self.entry_id,
            "roomCode": self.room_code,
            "text": self.text,
            "timestamp": self.timestamp,
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TranscriptEntry":
        """Deserialize from Firestore

        Pure function - no I/O operations
        """
        return cls(
            entry_id=data["entryId"],
            room_code=data["roomCode"],
            text=data["text"],
            timestamp=data["timestamp"],
            source=data.get("source", "manual"),
        )
