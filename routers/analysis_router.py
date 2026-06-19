from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.analysis_service import run_analysis
from schemas.analysis_schema import AnalysisResponse

router=APIRouter()



#analysis skills
@router.post("/analysis",response_model=AnalysisResponse)
def analysis_test(db:Session=Depends(get_db)):
    return run_analysis(db)
       
    