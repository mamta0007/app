from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from models.jd import Jd
from db.session import get_db

router=APIRouter()


@router.post("/jd")
async def job_description(job_description:UploadFile=File(...),db:Session=Depends(get_db)):
    content=await job_description.read()
    jd_text=content.decode("utf-8")
    
    #add into table
    
    jd=Jd(text=jd_text)
        
    db.add(jd)
    db.commit()
    db.refresh(jd)

    return "done"