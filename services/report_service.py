from fastapi import HTTPException
from models.analysis import Analysis
from models.resume import Resume
from models.jd import Jd
from models.question import Question
from models.roadmap import RoadMap
from utils.llm import llm
from utils.json_parser import parse_llm_json
from fastapi.responses import   FileResponse


import json

def run_report(current_user, db):
    resume = (
    db.query(Resume)
    .filter(Resume.user_id == current_user.id)
    .order_by(Resume.id.desc())
    .first()
)
    if not resume:
        raise HTTPException(404, "Resume not found")
    jd = (
    db.query(Jd)
    .filter(Jd.user_id == current_user.id)
    .order_by(Jd.id.desc())
    .first()
)
    if not jd:
        raise HTTPException(404, "JD not found")
    
    analysis = (
    db.query(Analysis)
    .filter(Analysis.user_id == current_user.id)
    .order_by(Analysis.id.desc())
    .first()
)
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    
    roadmap = (
    db.query(RoadMap)
    .filter(RoadMap.user_id == current_user.id)
    .order_by(RoadMap.id.desc())
    .first()
)
    if not roadmap:
        raise HTTPException(404, "Roadmap not found")
    
    questions = (
    db.query(Question)
    .filter(Question.user_id == current_user.id)
    .all()
)
    if not questions:
        raise HTTPException(404, "Questions not found")
        
    template = """
Summarize and generate preparation tips.

Resume:
{resume_text}

JD:
{jd_text}

STRICT:
- Return ONLY valid JSON
- No explanation
- No markdown
Give JSON:
{{
  "resume_summary": "",
  "jd_summary": "",
  "tips": ""
}}
"""
    prompt = template.format(
    resume_text=resume.content,
        jd_text=jd.content
    )
    # LLM Response
    result = llm.invoke(prompt)
    
    try:
        response = parse_llm_json(result.content)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to parse AI response."
        )
        
    # Final Report
    report = {
        "resume_summary": response.get("resume_summary", ""),
        "jd_summary": response.get("jd_summary", ""),
        "match_score": analysis.match_score,
        "skill_gap": analysis.missing_skills,
        "learning_plan": roadmap.learning_plan,
        "questions": [
            q.generated_question
            for q in questions
        ],
        "tips": response.get("tips", "")
    }
    
    filename = f"report_{current_user.id}.json"
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=4, ensure_ascii=False)
        
    return FileResponse(
        path=filename,
        media_type="application/json",
        filename=filename
    )
    
   
        






