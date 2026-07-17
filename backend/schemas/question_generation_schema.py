from pydantic import BaseModel, ConfigDict
from typing import List

class QuestionBank(BaseModel):
    technical_questions: List[str]
    scenario_questions: List[str]
    HR_questions: List[str]
    project_based_questions: List[str]

    model_config = ConfigDict(from_attributes=True)
