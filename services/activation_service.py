from fastapi import HTTPException
from requests import Session
from models.user import User
from datetime import datetime


def activate_user_account(token: str, db: Session):
    user = db.query(User).filter(User.activation_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if datetime.utcnow() > user.token_expires_at:
        raise HTTPException(status_code=400, detail="Token expired")

    user.status = True
    user.activation_token = None
    user.token_expires_at = None


    db.commit()

    return {"message": "Account activated successfully"}