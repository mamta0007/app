from sqlalchemy import JSON,Integer,String,Column,Float,ForeignKey,DateTime
from db.database import Base
from datetime import datetime



class Analysis(Base):
    __tablename__="analysis"
    id=Column(Integer,primary_key=True,index=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    candidate_skills=Column(JSON)
    matching_skills=Column(JSON)
    missing_skills=Column(JSON)
    required_skills=Column(JSON)
    strengths=Column(JSON)
    weaknesses=Column(JSON)
    match_score=Column(Float)
    jd_id = Column(Integer, ForeignKey("jd.id"))
    resume_id = Column(Integer, ForeignKey("resume.id"))
    created_at = Column(DateTime,  default=datetime.utcnow)