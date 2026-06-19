from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from db.session import get_db
from models.resume import Resume 
import io
import pypdf

router=APIRouter()
#upload resume
@router.post("/upload")
async def upload(file:UploadFile=File(...),db:Session=Depends(get_db)):
    content=await file.read()
    reader=pypdf.PdfReader(io.BytesIO(content)) 
    text=""
    for page in reader.pages:
        text+=page.extract_text()
        
   
    resume=Resume(file=text)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return "done"