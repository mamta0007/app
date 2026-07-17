from models.resume import Resume
from models.jd import Jd
from models.analysis import Analysis
from models.report import Report

def user_history(current_user,db):
    all_analysis = (
        db.query(Analysis)
        .filter(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .all()
    )

    history = []

    for analysis in all_analysis:

        resume = db.query(Resume).filter(
            Resume.id == analysis.resume_id
        ).first()

        jd = db.query(Jd).filter(
            Jd.id == analysis.jd_id
        ).first()
        
        report = (
            db.query(Report)
            .filter(Report.analysis_id == analysis.id)
            .first()
        )


        history.append({
            "analysis_id": analysis.id,
            "resume_file": resume.file_name if resume else None,
            "jd_file": jd.file_name if jd else None,
            "report_id": report.id if report else None,
            "report_name": report.file_name if report else None,
            "created_at": analysis.created_at
        })

    return history