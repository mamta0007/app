from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from services.reset_password_service import enter_new_password
from db.session import get_db
from schemas.new_password_schema import New_password

router = APIRouter()

@router.post("/reset-password")
def reset_password(data: New_password,token:str, db: Session = Depends(get_db)):
    return enter_new_password(db,token, data.password)