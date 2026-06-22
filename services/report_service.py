from models.analysis import Analysis
from models.resume import Resume
from models.jd import Jd
from models.question import Question
from models.roadmap import RoadMap
from utils.llm import llm
from utils.json_parser import parse_llm_json

import json

def run_report(db):
    resume = db.query(Resume).order_by(Resume.id.desc()).first()
    jd = db.query(Jd).order_by(Jd.id.desc()).first()
    analysis = db.query(Analysis).order_by(Analysis.id.desc()).first()
    roadmap = db.query(RoadMap).order_by(RoadMap.id.desc()).first()
    questions = db.query(Question).all()
        
        
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
    
    result = llm.invoke(prompt)
    response = result.content
    response=parse_llm_json(response)
    
        
    report = {
        "resume_summary": response["resume_summary"],
        "jd_summary": response["jd_summary"],
        "match_score": analysis.match_score,
        "skill_gap": analysis.missing_skills,
        "learning_plan":roadmap.learning_plan,
        "questions": [q.generated_question for q in questions],
        "tips": response["tips"]
    }
    
    with open ("data.json", "w") as f:
        json.dump(report,f,indent=4)

    return "created"
    
    
   
        






