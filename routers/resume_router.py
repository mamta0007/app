from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from utils.auth import get_current_user
from services.resume_service import upload_resume
router=APIRouter()


#upload resume
@router.post("/resume")
async def upload(file:UploadFile=File(...),current_user: User = Depends(get_current_user),  db:Session=Depends(get_db)):
    return await upload_resume(file,db,current_user)
    