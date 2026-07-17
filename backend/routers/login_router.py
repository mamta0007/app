from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.login_service import login_user
from schemas.login_schema import Login  

router=APIRouter()

@router.post("/login")
def login(login:Login, db:Session=Depends(get_db)):
    return login_user(login, db)