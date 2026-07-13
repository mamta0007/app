from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from services.activation_service import activate_user_account


router = APIRouter()

@router.get("/activate")
def activate_account(token: str, db: Session = Depends(get_db)):
    return activate_user_account(token, db)