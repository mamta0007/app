from models.resume import Resume
from models.analysis import Analysis
from models.jd import Jd
from models.roadmap import RoadMap


def get_dashboard(current_user,db):

    resume = (
    db.query(Resume)
    .filter(Resume.user_id == current_user.id)
    .order_by(Resume.id.desc())
    .first()
)
    
    jd=db.query(Jd).filter(Jd.user_id==current_user.id).order_by(Jd.id.desc()).first()
    
    analysis=db.query(Analysis).filter(Analysis.user_id==current_user.id).order_by(Analysis.id.desc()).first()
    
    roadmap=db.query(RoadMap).filter(RoadMap.user_id==current_user.id).order_by(RoadMap.id.desc()).first()
    
    return {
        "profile":{
            "name":current_user.name,
            "email":current_user.email},
            
            "resume": {
            "id": resume.id,
            "file_name": resume.file_name,
        } if resume else None,
        "jd": {
            "id": jd.id,
            "file_name": jd.file_name,
        } if jd else None,
        "analysis": {
            "match_score": analysis.match_score,
            "missing_skills": analysis.missing_skills,
        } if analysis else None,

        "roadmap": {
            "missing_skills": roadmap.missing_skills,
            "learning_plan": roadmap.learning_plan,
        } if roadmap else None,
    }