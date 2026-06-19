from sqlalchemy import Text,JSON,Integer,String,Column
from db.database import Base


class Interview(Base):
    __tablename__="interview"
    id=Column(Integer,primary_key=True,index=True)
    type=Column(String)
    question=Column(Text)
    answer=Column(Text)
    score=Column(Integer)
    feedback=Column(Text)
    