from datetime import datetime, timedelta
from fastapi import HTTPException
from services.send_activation_email_service import send_activation_email
from utils.password import hash_password
from models.user import User  
import secrets
from .resend_activation_email_service import resend_activation

def register_user(user_data,db):
    
    existing_user = db.query(User).filter(
    User.email == user_data.email
).first()
    

    if existing_user and existing_user.status:
        raise HTTPException(409, "Email already exists and is active")
    if existing_user and not existing_user.status:
        existing_user.name=user_data.name
        existing_user.password = hash_password(user_data.password)
        return resend_activation(existing_user, db)
    

    hashed_password=hash_password(user_data.password)
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    user=User(name=user_data.name,email=user_data.email,password=hashed_password,status=False,
    activation_token=token,token_expires_at=expires_at)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return send_activation_email(user.email, user.activation_token)

