from fastapi import APIRouter,UploadFile,Depends,File
from sqlalchemy.orm import Session
from db.session import get_db
from models.resume import Resume 
from schemas.resume_schema import ResumeResponse
from groq import Groq
from pdf2image import convert_from_bytes
import base64
import io
import pypdf

router=APIRouter()

client=Groq()
#upload resume
@router.post("/upload",response_model=ResumeResponse)
async def upload(file:UploadFile=File(...),db:Session=Depends(get_db)):
    content=await file.read()
    
    if file.content_type=="application/pdf":
        reader = pypdf.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted
   
    else:
        content_type=file.content_type
        image_b64=base64.b64encode(content).decode("utf-8")
        response=client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role":"user",
             "content":[
                { "type":"text",
                 "text":"Extract resume details in JSON format."},
                {"type":"image_url",
                 "image_url":{"url": f"data:{content_type};base64,{image_b64}"}}
                 
             ]}
        ])
        text= response.choices[0].message.content
    
  
    resume=Resume(file_name=file.filename,content=text)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return {"message":"pdf uploaded successfully" }