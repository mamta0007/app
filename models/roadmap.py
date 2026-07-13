from sqlalchemy import ForeignKey, Text,JSON,Integer,String,Column
from db.database import Base


class RoadMap(Base):
    __tablename__="roadmap"
    id=Column(Integer,primary_key=True,index=True)
    missing_skills=Column(JSON)
    learning_plan=Column(JSON)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)