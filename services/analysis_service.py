from models.analysis import Analysis
from models.resume import Resume
from models.jd import Jd
from utils.llm import llm
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate

def run_analysis(current_user,db):
    
    
    resume = (
    db.query(Resume)
    .filter(Resume.user_id == current_user.id)
    .order_by(Resume.id.desc())
    .first()
)

    jd = (
    db.query(Jd)
    .filter(Jd.user_id == current_user.id)
    .order_by(Jd.id.desc())
    .first()
)
    if not resume:
        return {"message": "Resume not found"}

    if not jd:
        return {"message": "Job Description not found"}

    
       
    template = """You are an ATS and Technical Recruiter.

Your task is to compare the Resume and Job Description and return a deterministic result.

Resume:
{resume_text}

Job Description:
{jd_text}

Rules:
- Use ONLY information explicitly present in the Resume and Job Description.
- Never infer, assume, or hallucinate any skill, experience, education, certification, or responsibility.
- Extract ONLY technical/hard skills.
- Convert all skills to lowercase.
- Normalize equivalent names (e.g. react=react.js, nodejs=node.js, postgres=postgresql, rest api=restful api).
- Do NOT match different technologies (e.g. react≠next.js, sql≠ms sql server, docker≠kubernetes).
- Remove duplicates.
- Sort every skill list alphabetically before returning.
- Always calculate matching_skills as the intersection of candidate_skills and required_skills.
- Always calculate missing_skills as required_skills − matching_skills.
- strengths must equal matching_skills.
- weaknesses must equal missing_skills.
- Base all scores only on explicit evidence in the resume.
- If information is missing, use empty arrays, false, 0, or an empty string. Never guess.
- Return the same output for identical inputs.
- Return ONLY valid JSON.
- Do NOT include markdown, code fences, explanations, reasoning, or <think> tags.

JSON Schema:
{{
  "overall_match_percentage": 0,
  "match_level": "",
  "summary": "",
  "category_scores": {{
    "technical_skills": 0,
    "work_experience": 0,
    "education": 0,
    "responsibilities": 0,
    "preferred_skills": 0,
    "ats_keywords": 0
  }},
  "candidate_skills": [],
  "required_skills": [],
  "matching_skills": [],
  "missing_skills": [],
  "strengths": [],
  "weaknesses": [],
  "missing_requirements": [],
  "matched_experience": [],
  "education_analysis": {{
    "required_degree_met": false,
    "certification_match": ""
  }},
  "recommendation": {{
    "should_shortlist": false,
    "reason": ""
  }},
  "improvement_suggestions": []
}}
"""
    prompt=PromptTemplate(template=template,input_variables=["resume_text","jd_text"])

    formatted_prompt=prompt.format(resume_text=resume.content,jd_text=jd.content)

    result = llm.invoke(formatted_prompt)
   
    result = result.content.strip()
    

    if not result:
        return {
        "error": "LLM returned empty response"
    }
    
   
    data = parse_llm_json(result)
    
    required_skills = data.get("required_skills", [])
    matching_skills = data.get("matching_skills", [])
    missing_skills = data.get("missing_skills", [])
    candidate_skills = data.get("candidate_skills", [])
    strengths = data.get("strengths", [])
    weaknesses = data.get("weaknesses", [])
    
        
    match_score = round(
    (len(matching_skills) / len(required_skills)) * 100,
    2
) if required_skills else 0
    
    data["match_score"]=match_score
    
    analysis=Analysis(user_id=current_user.id,matching_skills=matching_skills,missing_skills=missing_skills,required_skills=required_skills,
                      strengths=strengths,weaknesses=weaknesses,candidate_skills=candidate_skills,match_score=match_score)
    
    
        
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
        
    return data