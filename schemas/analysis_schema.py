from pydantic import BaseModel, ConfigDict
from typing import List

class AnalysisResponse(BaseModel):
    candidate_skills: List[str]
    required_skills: List[str]
    matching_skills: List[str]
    missing_skills: List[str]
    strengths: List[str]
    weaknesses: List[str]
    match_score: float

    model_config = ConfigDict(from_attributes=True)
