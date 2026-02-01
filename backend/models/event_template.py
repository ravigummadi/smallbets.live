"""EventTemplate model - represents a pre-configured event with bets"""

from typing import Optional
from pydantic import BaseModel, Field


class TriggerConfig(BaseModel):
    """Configuration for automated bet triggering

    Follows FCIS pattern: pure data model with no I/O
    """

    open_patterns: list[str] = Field(default_factory=list, description="Regex patterns to trigger bet opening")
    resolve_patterns: list[str] = Field(default_factory=list, description="Regex patterns to trigger bet resolution")

    def to_dict(self) -> dict:
        """Serialize for Firestore/JSON storage

        Pure function - no I/O operations
        """
        return {
            "open": self.open_patterns,
            "resolve": self.resolve_patterns,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TriggerConfig":
        """Deserialize from Firestore/JSON

        Pure function - no I/O operations
        """
        return cls(
            open_patterns=data.get("open", []),
            resolve_patterns=data.get("resolve", []),
        )


class EventTemplate(BaseModel):
    """EventTemplate model for pre-configured events

    Follows FCIS pattern: pure data model with no I/O
    """

    template_id: str = Field(..., description="Unique template identifier (grammys-2026, oscars-2026, etc.)")
    name: str = Field(..., description="Display name of event")
    bets: list[dict] = Field(default_factory=list, description="List of bet configurations")
    trigger_config: Optional[TriggerConfig] = None

    def to_dict(self) -> dict:
        """Serialize for Firestore/JSON storage

        Pure function - no I/O operations
        """
        return {
            "templateId": self.template_id,
            "name": self.name,
            "bets": self.bets,
            "triggerConfig": self.trigger_config.to_dict() if self.trigger_config else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "EventTemplate":
        """Deserialize from Firestore/JSON

        Pure function - no I/O operations
        """
        trigger_config = None
        if data.get("triggerConfig"):
            trigger_config = TriggerConfig.from_dict(data["triggerConfig"])

        return cls(
            template_id=data["templateId"],
            name=data["name"],
            bets=data.get("bets", []),
            trigger_config=trigger_config,
        )
