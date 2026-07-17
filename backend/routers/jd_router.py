from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from models.jd import Jd
from db.session import get_db
from models.user import User
from utils.auth import get_current_user
from services.jd_service import upload_jd

router=APIRouter()


@router.post("/jd")
async def job_description(file:UploadFile=File(...),current_user: User = Depends(get_current_user),db:Session=Depends(get_db)):
    return await upload_jd(file,current_user,db)