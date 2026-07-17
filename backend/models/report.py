from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from db.database import Base

class Report(Base):
    __tablename__ = "report"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)

    created_at = Column(DateTime,default=datetime.utcnow)