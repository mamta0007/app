from sqlalchemy import ForeignKey, Text,JSON,Integer,String,Column,DateTime
from db.database import Base
from datetime import datetime




class Jd(Base):
    __tablename__="jd"
    id=Column(Integer,primary_key=True,index=True)
    file_name=Column(String)
    content=Column(Text)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    created_at=Column(DateTime , default=datetime.utcnow)