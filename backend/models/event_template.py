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


class MatchTemplate(BaseModel):
    """Template for a scheduled match within a tournament"""

    title: str = Field(..., description="Match title (e.g., IPL 2026 Match 1)")
    team1: str = Field(..., description="First team name")
    team2: str = Field(..., description="Second team name")
    match_date: str = Field(..., description="Match date (YYYY-MM-DD)")
    venue: Optional[str] = Field(default=None, description="Match venue")
    match_bets: list[dict] = Field(default_factory=list, description="Per-match bet templates")

    def to_dict(self) -> dict:
        result = {
            "title": self.title,
            "team1": self.team1,
            "team2": self.team2,
            "matchDate": self.match_date,
            "matchBets": self.match_bets,
        }
        if self.venue is not None:
            result["venue"] = self.venue
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "MatchTemplate":
        return cls(
            title=data["title"],
            team1=data["team1"],
            team2=data["team2"],
            match_date=data["matchDate"],
            venue=data.get("venue"),
            match_bets=data.get("matchBets", []),
        )


class EventTemplate(BaseModel):
    """EventTemplate model for pre-configured events

    Follows FCIS pattern: pure data model with no I/O
    """

    template_id: str = Field(..., description="Unique template identifier (grammys-2026, oscars-2026, etc.)")
    name: str = Field(..., description="Display name of event")
    bets: list[dict] = Field(default_factory=list, description="List of bet configurations")
    trigger_config: Optional[TriggerConfig] = None
    matches: list[MatchTemplate] = Field(default_factory=list, description="Scheduled matches for tournament templates")

    def to_dict(self) -> dict:
        """Serialize for Firestore/JSON storage

        Pure function - no I/O operations
        """
        result = {
            "templateId": self.template_id,
            "name": self.name,
            "bets": self.bets,
            "triggerConfig": self.trigger_config.to_dict() if self.trigger_config else None,
        }
        if self.matches:
            result["matches"] = [m.to_dict() for m in self.matches]
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "EventTemplate":
        """Deserialize from Firestore/JSON

        Pure function - no I/O operations
        """
        trigger_config = None
        if data.get("triggerConfig"):
            trigger_config = TriggerConfig.from_dict(data["triggerConfig"])

        matches = []
        if data.get("matches"):
            matches = [MatchTemplate.from_dict(m) for m in data["matches"]]

        return cls(
            template_id=data["templateId"],
            name=data["name"],
            bets=data.get("bets", []),
            trigger_config=trigger_config,
            matches=matches,
        )
