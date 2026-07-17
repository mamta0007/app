from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.logout_service import logout_user, logout_by_refresh_token
from schemas.logout_schema import LogoutRequest


router = APIRouter()


@router.post("/logout")
def logout(
    logout_request: LogoutRequest,
    db: Session = Depends(get_db),
):
    """Logout by refresh token. This endpoint deletes the refresh token from DB.

    It does not require a valid access token; clients should send the
    `refresh_token` in the request body.
    """
    return logout_by_refresh_token(logout_request.refresh_token, db)