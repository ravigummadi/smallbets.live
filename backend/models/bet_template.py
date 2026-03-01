"""BetTemplate model - reusable bet templates for quick creation"""

from typing import List
from pydantic import BaseModel, Field


class BetTemplate(BaseModel):
    """BetTemplate model for reusable bet templates

    Follows FCIS pattern: pure data model with no I/O
    """

    template_id: str = Field(..., description="Unique template ID (e.g., toss-winner)")
    category: str = Field(..., description="Category: cricket-pre|cricket-live|cricket-tournament")
    name: str = Field(..., description="Display name")
    question_template: str = Field(..., description="Question with placeholders (e.g., 'Who wins the toss?')")
    options_template: List[str] = Field(..., description="Options with placeholders (e.g., ['Team 1', 'Team 2'])")
    default_timer: int = Field(default=60, description="Default timer in seconds")
    default_points: int = Field(default=100, description="Default points value")

    def to_dict(self) -> dict:
        """Serialize for storage"""
        return {
            "templateId": self.template_id,
            "category": self.category,
            "name": self.name,
            "questionTemplate": self.question_template,
            "optionsTemplate": self.options_template,
            "defaultTimer": self.default_timer,
            "defaultPoints": self.default_points,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BetTemplate":
        """Deserialize from storage"""
        return cls(
            template_id=data["templateId"],
            category=data["category"],
            name=data["name"],
            question_template=data["questionTemplate"],
            options_template=data["optionsTemplate"],
            default_timer=data.get("defaultTimer", 60),
            default_points=data.get("defaultPoints", 100),
        )

    def create_question(self, team1: str = "", team2: str = "") -> str:
        """Replace placeholders in question template"""
        q = self.question_template
        q = q.replace("{team1}", team1)
        q = q.replace("{team2}", team2)
        return q

    def create_options(self, team1: str = "", team2: str = "") -> List[str]:
        """Replace placeholders in options template"""
        result = []
        for opt in self.options_template:
            opt = opt.replace("{team1}", team1)
            opt = opt.replace("{team2}", team2)
            result.append(opt)
        return result
