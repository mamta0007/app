from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from services.question_generation_service import run_question
from schemas.question_generation_schema import QuestionBank
from utils.auth import get_current_user


router=APIRouter()



#question generation 
@router.post("/question generation",response_model=QuestionBank)
def question(current_user: User = Depends(get_current_user), db:Session=Depends(get_db)):
   return run_question(current_user, db)
 