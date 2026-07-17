from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from services.interview_service import question_answer,generat_question
from schemas.interview_schema import InterviewResponse,AnswerResponse
from utils.auth import get_current_user
from schemas.interview_schema import InterviewBase,AnswerBase

router=APIRouter()

#for question
@router.post("/question",response_model=InterviewResponse)
def question(type: InterviewBase,db:Session=Depends(get_db),current_user: User = Depends(get_current_user) ):
    return generat_question(current_user,type,db)

    

#for answer and next question
@router.post("/question_answer",response_model=AnswerResponse)
def answer(answer: AnswerBase, db:Session=Depends(get_db), current_user: User = Depends(get_current_user)):
    return question_answer(current_user, answer, db)