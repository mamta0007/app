from models.token import Token
from fastapi import HTTPException


def logout_user(refresh_token, db, current_user):
    db_token = db.query(Token).filter(
        Token.token == refresh_token,
        Token.user_id == current_user.id
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=404,
            detail="Refresh token not found"
        )

    db.delete(db_token)
    db.commit()

    return {
        "message": "Logged out successfully"
    }


def logout_by_refresh_token(refresh_token, db):
    """Logout when only refresh token is provided (no access token required).

    This looks up the token record by its value and deletes it.
    """
    db_token = db.query(Token).filter(
        Token.token == refresh_token
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=404,
            detail="Refresh token not found"
        )

    db.delete(db_token)
    db.commit()

    return {"message": "Logged out successfully"}