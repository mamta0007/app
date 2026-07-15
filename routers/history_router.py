from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from services.history_service import user_history
from db.session import get_db
from utils.auth import get_current_user
from models.user import User
from schemas.history_schema import HistoryResponse
from typing import List

router=APIRouter()

@router.get("/history",response_model=List[HistoryResponse])
def user_history_api(current_user:User=Depends(get_current_user),db:Session=Depends(get_db)):
   
    return user_history(current_user,db)