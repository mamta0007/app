from fastapi.middleware.cors import CORSMiddleware
from routers.analysis_router import router as analysis_router
from routers.resume_router import router as resume_router
from routers.jd_router import router as jd_router
from routers.generate_roadmap_router import router as generate_roadmap_router
from routers.question_generation_router import router as question_generation_router
from routers.report_router import router as report_router
from routers.interview_router import router as interview_router
from routers.register_router import router as register_router
from routers.login_router import router as login_router
from fastapi import FastAPI
from db.database import Base, engine
from routers.logout_router import router as logout_router
from routers.refresh_router import router as refresh_router
from routers.activtation_router import router as activation_router
from routers.forgot_password_router import router as forgot_password_router
from routers.reset_password_router import router as reset_password_router
from routers.dashboard_router import router as get_dashboard_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(register_router)
app.include_router(activation_router)
app.include_router(login_router)
app.include_router(forgot_password_router)
app.include_router(reset_password_router)
app.include_router(refresh_router)
app.include_router(get_dashboard_router)
app.include_router(resume_router)
app.include_router(jd_router)
app.include_router(analysis_router)
app.include_router(question_generation_router)
app.include_router(generate_roadmap_router)
app.include_router(interview_router)
app.include_router(report_router)
app.include_router(logout_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


