from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.analysis_service import run_analysis

router=APIRouter()



#analysis skills
@router.post("/analysis")
def analysis_test(db:Session=Depends(get_db)):
    return run_analysis(db)
       
    