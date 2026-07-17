from pydantic import BaseModel, ConfigDict
from typing import List, Dict

class RoadmapBase(BaseModel):
    missing_skills: List[str]
    learning_plan: Dict[str, str]
