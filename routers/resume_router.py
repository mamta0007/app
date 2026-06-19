from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from db.session import get_db
from models.resume import Resume 
from schemas.resume_schema import ResumeResponse
import io
import pypdf

router=APIRouter()
#upload resume
@router.post("/upload",response_model=ResumeResponse)
async def upload(file:UploadFile=File(...),db:Session=Depends(get_db)):
    content=await file.read()
    reader=pypdf.PdfReader(io.BytesIO(content)) 
    text=""
    for page in reader.pages:
        text+=page.extract_text()
        
   
    resume=Resume(file_name=file.filename,content=text)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return {"message":"pdf uploaded successfully"}