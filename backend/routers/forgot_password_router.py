from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.session import get_db
from services.forgot_password_service import for_forgot_password
from schemas.forgot_schema import ForgotPasswordRequest
router=APIRouter()

@router.post("/forgot-password")
def forgot_password(email:ForgotPasswordRequest,db:Session=Depends(get_db)):
    return for_forgot_password(email, db)