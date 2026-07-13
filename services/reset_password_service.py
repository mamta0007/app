from fastapi import HTTPException, status
from models.user import User
from datetime import datetime
from utils.password import hash_password


def enter_new_password(db, token, new_password):
    user = db.query(User).filter(User.reset_token == token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid  token"
        )
    if user.reset_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token has expired"
        )   
        
    new_hashed_password = hash_password(new_password)
    
    user.password = new_hashed_password
    
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    
    return {"message": "Password reset successful."}

    