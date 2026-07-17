from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from services.refresh_service import refresh_access_token
from db.session import get_db
from schemas.refresh_token_schema import RefreshRequest


router = APIRouter()

@router.post("/refresh")
def refresh_tokens(
    request: RefreshRequest,
    db: Session = Depends(get_db)
):
    return refresh_access_token(
        request.refresh_token,
        db
    )