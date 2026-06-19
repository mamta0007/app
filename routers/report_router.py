from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.report_service import run_report

router=APIRouter()



@router.post("/report")
def report(db:Session=Depends(get_db)):
    return run_report(db)
  