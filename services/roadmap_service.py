from sqlalchemy.orm import Session
from models.analysis import Analysis
from models.roadmap import RoadMap
from utils.llm import llm
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate


def generate_road_map(db:Session):
    
    template="""You are a career coach and technical mentor.

Create a structured learning roadmap based ONLY on the given missing skills.

STRICT RULES:
- Use ONLY the provided missing_skills
- Do NOT add extra skills
- Keep plan practical and beginner-friendly
- Divide learning into weeks
- Each week should focus on 1 skill/topic
- Keep output strictly in valid JSON
- No explanation, no markdown, no text outside JSON

INPUT:
missing_skills:
{missing_skills}

OUTPUT FORMAT:
{{
  "missing_skills": [],
  "learning_plan": {{
    "week_1": "",
    "week_2": "",
    "week_3": "",
    "week_4": ""
  }}
}}
"""

    analysis = db.query(Analysis).order_by(Analysis.id.desc()).first()
    missing_skills = analysis.missing_skills
    
    prompt=PromptTemplate(template=template,input_variables=["missing_skills"])
    formatted_prompt=prompt.format(missing_skills=missing_skills)
    result=llm.invoke(formatted_prompt)
    response=result.content
    response=parse_llm_json(response)
    roadmap=RoadMap(missing_skills=missing_skills,learning_plan=response["learning_plan"])
    db.add(roadmap)
    db.commit()
    return response
