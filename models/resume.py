from sqlalchemy import Text,JSON,Integer,String,Column
from db.database import Base


class Resume(Base):
    __tablename__="resume"
    id=Column(Integer,primary_key=True,index=True)
    file_name=Column(String)
    content=Column(Text)