from sqlalchemy import Column, DateTime, Integer, String, Boolean
from db.database import Base    

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    status = Column(Boolean, default=False)  
    activation_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    
    reset_token = Column(String, nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)