from sqlalchemy.orm import Session
from models.analysis import Analysis
from models.resume import Resume
from models.jd import Jd
from utils.llm import llm
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate



def run_analysis(db:Session):
    
    
    resume = db.query(Resume).order_by(Resume.id.desc()).first()
    jd = db.query(Jd).order_by(Jd.id.desc()).first()

    
       
    template="""You are an ATS system and technical recruiter.

    Analyze resume text and job description text.
    ---
    STRICT RULES:
    - Use ONLY information explicitly present in the text
    - Do NOT hallucinate or assume skills
    - Output ONLY valid JSON (no markdown, no explanation)
    - Extract ONLY technical/hard skills
    - Do NOT perform matching or scoring logic
    - Do NOT calculate percentages

    ---

    IMPORTANT NORMALIZATION RULES:
    - Convert all skills to lowercase internally
    - Remove duplicates
    - Treat synonyms as same (e.g., node.js = nodejs, postgres = postgresql)

    ---

    INPUT:

    Resume:
    {resume_text}

    Job Description:
    {jd_text}

    ---

    TASKS:

    1. candidate_skills:
    Extract ONLY technical skills from resume

    2. required_skills:
    Extract ONLY technical skills from job description

    3. matching_skills:
    ONLY list skills that clearly appear in BOTH lists (exact match or synonym match)

    4. missing_skills:
    Skills in required_skills not present in candidate_skills

    5. strengths:
    Short recruiter-style insights ONLY from matching skills

    6. weaknesses:
    Short gap statements ONLY from missing skills

    OUTPUT FORMAT:
    {{
    "candidate_skills": [],
    "required_skills": [],
    "matching_skills": [],
    "missing_skills": [],
    "strengths": [],
    "weaknesses": []
    }}"""

    prompt=PromptTemplate(template=template,input_variables=["resume_text","jd_text"])

    formatted_prompt=prompt.format(resume_text=resume.file,jd_text=jd.text)
    result=llm.invoke(formatted_prompt)
    result=result.content
    
    data = parse_llm_json(result)
    required_skills=data["required_skills"]
    matching_skills=data["matching_skills"]
    missing_skills=data["missing_skills"]
    candidate_skills=data["candidate_skills"]
    strengths=data["strengths"]
    weaknesses=data["weaknesses"]
    
        
        
    match_score = (len(matching_skills) / len(required_skills)) * 100
    data["match_score"]=match_score
    
    analysis=Analysis(matching_skills=matching_skills,missing_skills=missing_skills,required_skills=required_skills,
                      strengths=strengths,weaknesses=weaknesses,candidate_skills=candidate_skills,match_score=match_score)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    
    return data