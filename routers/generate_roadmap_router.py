from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from db.session import get_db
from services.generate_roadmap_service import generate_road_map
from schemas.generate_roadmap_schema import RoadmapBase

router=APIRouter()


@router.post("/generate_road_map",response_model=RoadmapBase)
def road_map(db:Session=Depends(get_db)):
    return generate_road_map(db)
    
    
   