from sqlalchemy import Text,JSON,Integer,String,Column
from db.database import Base


class Question(Base):
    __tablename__="question"
    id=Column(Integer,primary_key=True,index=True)
    generated_question=Column(JSON)

  