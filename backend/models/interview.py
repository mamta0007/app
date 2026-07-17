from sqlalchemy import ForeignKey, Text,JSON,Integer,String,Column
from db.database import Base


class Interview(Base):
    __tablename__="interview"
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    id=Column(Integer,primary_key=True,index=True)
    type=Column(String)
    question=Column(Text)
    answer=Column(Text)
    score=Column(Integer)
    feedback=Column(Text)
    