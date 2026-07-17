from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.analysis_service import run_analysis
from schemas.analysis_schema import AnalysisResponse
from utils.auth import get_current_user
from models.user import User


router=APIRouter()



#analysis skills
@router.post("/analysis",response_model=AnalysisResponse)
def analysis_test(current_user: User = Depends(get_current_user)
                  ,db:Session=Depends(get_db)):
    return run_analysis(current_user, db)
       
    
    
    