from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from utils.auth import get_current_user
from models.user import User
from services.dashboard_service import get_dashboard

router=APIRouter()

@router.get("/dashboard")
def dashboard(current_user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    return get_dashboard(current_user,db)

    