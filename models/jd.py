from sqlalchemy import Text,JSON,Integer,String,Column
from db.database import Base


class Jd(Base):
    __tablename__="jd"
    id=Column(Integer,primary_key=True,index=True)
    text=Column(Text)