import random
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.register_service import register_user
from schemas.login_schema import User_create

router=APIRouter()

@router.post("/register")
def register(user:User_create, db:Session=Depends(get_db)):
    return register_user(user,db)
