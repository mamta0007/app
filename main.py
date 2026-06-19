from routers.analysis_router import router as analysis_router
from routers.resume_router import router as resume_router
from routers.jd_router import router as jd_router
from routers.generate_roadmap_router import router as generate_roadmap_router
from routers.question_generation_router import router as question_generation_router
from routers.report_router import router as report_router
from routers.interview_router import router as interview_router
from fastapi import FastAPI
from db.database import Base, engine

# import all models
from models.resume import Resume
from models.jd import Jd
from models.analysis import Analysis
from models.interview import Interview
from models.roadmap import RoadMap

app = FastAPI()


Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(resume_router)
app.include_router(jd_router)
app.include_router(analysis_router)
app.include_router(question_generation_router)
app.include_router(generate_roadmap_router)
app.include_router(interview_router)
app.include_router(report_router)
