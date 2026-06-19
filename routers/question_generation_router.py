from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.question_generation_service import run_interview_question



router=APIRouter()



#question generation 
@router.post("/question generation")
def interview_question(db:Session=Depends(get_db)):
   return run_interview_question(db)
 