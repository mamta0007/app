from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from services.report_service import run_report
from utils.auth import get_current_user


router=APIRouter()



@router.post("/report")
def report(current_user: User = Depends(get_current_user), db:Session=Depends(get_db)):
    return run_report(current_user, db)
  