from pydantic import BaseModel,ConfigDict
from typing import Optional 



class InterviewBase(BaseModel):
    type:str
    answer:str
    
    
class InterviewResponse(BaseModel):
    type: str
    question: str
   

    model_config = ConfigDict(from_attributes=True)
    
class AnswerResponse(BaseModel):
    score: int
    feedback: str
    next_question: str