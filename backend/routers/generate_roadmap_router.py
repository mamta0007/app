from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from models.user import User
from services.generate_roadmap_service import generate_road_map
from schemas.generate_roadmap_schema import RoadmapBase
from utils.auth import get_current_user

router=APIRouter()


@router.post("/generate_road_map",response_model=RoadmapBase)
def road_map(current_user: User = Depends(get_current_user),db:Session=Depends(get_db)):
    return generate_road_map(current_user, db)
    
    
   