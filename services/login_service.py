from fastapi import HTTPException,status

from utils.jwt import create_access_token, create_refresh_token
from utils.password import verify_password

from models.user import User
from models.token import Token



def login_user(login, db):
    
    # Step 1: Find user
    user = db.query(User).filter(
        User.email == login.email
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found"
        )
    
     # Step 2: Check email verification
    if not user.status:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email first."
        )
    
    #step 2:verify password
    if not verify_password(login.password,user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid password"
        )
        
    #create jwt
    access_token=create_access_token({"sub":str(user.id)})
    refresh_token=create_refresh_token({"sub":str(user.id)})
    
    token=Token(
        token=refresh_token,
        user_id=user.id)
    
    db.add(token)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
        
    }