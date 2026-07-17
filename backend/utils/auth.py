from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from db.session import get_db
from models.user import User
from fastapi import Request
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    
    try:    
        token=request.headers.get("Authorization")
       

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="token not found"
            )
        token=token.split(" ")[1]
        
        data=jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id=data.get("sub")

        user = db.query(User).filter(User.id == user_id).first()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        return user

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )