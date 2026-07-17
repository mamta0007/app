from models.jd import Jd

async def upload_jd(file,current_user,db):
    content=await file.read()
    jd_text=content.decode("utf-8")
    
    #add into table
    
    jd=Jd(file_name=file.filename,content=jd_text,user_id=current_user.id)
        
    db.add(jd)
    db.commit()
    db.refresh(jd)

    return {"message":"uploaded successfully"}