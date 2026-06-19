from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.interview_service import question_answer,generat_question



router=APIRouter()

#for question
@router.post("/question")
def question(type:str,db:Session=Depends(get_db)):
    return generat_question(type,db)

    

#for answer and next question
@router.post("/question_answer")
def answer(answer:str, db:Session=Depends(get_db)):
    return question_answer(answer,db)