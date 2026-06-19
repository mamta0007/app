from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from models.jd import Jd
from db.session import get_db
from schemas.jd_schema import JdResponse
router=APIRouter()


@router.post("/jd",response_model=JdResponse)
async def job_description(job_description:UploadFile=File(...),db:Session=Depends(get_db)):
    content=await job_description.read()
    jd_text=content.decode("utf-8")
    
    #add into table
    
    jd=Jd(file_name=job_description.filename,content=jd_text)
        
    db.add(jd)
    db.commit()
    db.refresh(jd)

    return {"message":"uploaded successfully"}