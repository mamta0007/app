from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User
from models.token import Token

from utils.jwt import verify_token, create_access_token, create_refresh_token

def refresh_access_token(refresh_token, db):

    # 1. Database me refresh token check karo
    db_token = db.query(Token).filter(
        Token.token == refresh_token
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token"
        )
        
    #jwt verify kro
    payload = verify_token(refresh_token)

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
     # 3. User check karo
    user = db.query(User).filter(
        User.id == int(user_id)
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # 4. Purana refresh token delete karo
    db.delete(db_token)
    db.commit()

    # 5. Naya access token banao
    access_token = create_access_token(
        {
            "sub": str(user.id)
        }
    )

    # 6. Naya refresh token banao
    new_refresh_token = create_refresh_token(
        {
            "sub": str(user.id)
        }
    )

    # 7. Naya refresh token DB me save karo
    db.add(
        Token(
            user_id=user.id,
            token=new_refresh_token
        )
    )

    db.commit()

    # 8. Response
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }
