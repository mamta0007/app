from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from models.analysis import Analysis
from db.session import get_db
import os
from fastapi.responses import FileResponse
from models.report import Report
from models.user import User
from utils.auth import get_current_user
router=APIRouter()


@router.get("/download-report/{analysis_id}")
def download_report(analysis_id: int,current_user:User=Depends(get_current_user), db: Session = Depends(get_db)):
    report = (
        db.query(Report)
        .join(Analysis, Report.analysis_id == Analysis.id)
        .filter(
            Report.analysis_id == analysis_id,
            Analysis.user_id == current_user.id
        )
        .first()
    )

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=report.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=report.file_name
    )