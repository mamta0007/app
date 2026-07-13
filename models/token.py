from sqlalchemy import TEXT,JSON,Integer,String,Column,Float,ForeignKey
from db.database import Base

class Token(Base):
    __tablename__="tokens"
    id=Column(Integer,primary_key=True,index=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    
    token=Column(String(255),nullable=False)
    