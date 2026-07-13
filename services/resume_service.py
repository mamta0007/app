import pypdf
import io
import base64
from models.resume import Resume
from groq import Groq
client=Groq()

async def upload_resume(file,db,current_user):
    content=await file.read()
    
    if file.content_type=="application/pdf":
        reader = pypdf.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted
   
    else:
        
        image_b64=base64.b64encode(content).decode("utf-8")
        response=client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role":"user",
             "content":[
                { "type":"text",
                 "text":"Extract resume details in JSON format."},
                {"type":"image_url",
                 "image_url":{"url": f"data:{file.content_type};base64,{image_b64}"}}
                 
             ]}
        ])
        text= response.choices[0].message.content
    
  
    resume=Resume(file_name=file.filename,content=text,user_id=current_user.id)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return {"message":"pdf uploaded successfully" }

