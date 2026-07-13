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
    .order_by(Resume.created_at.desc())
    .first()
)

    jd = (
        db.query(Jd)
        .filter(Jd.user_id == current_user.id)
        .order_by(Jd.created_at.desc())
        .first()
    )
    if not resume:
        return {"message": "Resume not found"}

    if not jd:
        return {"message": "Job Description not found"}

    
       
    template = """
You are an ATS system and technical recruiter.

Analyze the resume text and job description text.

STRICT RULES:
- Use ONLY information explicitly present in the given text.
- Do NOT hallucinate skills.
- Do NOT assume that a skill exists because it is related to another skill.
- Extract ONLY technical/hard skills.
- Return ONLY valid JSON.
- Do NOT add markdown or explanations.

SKILL NORMALIZATION RULES:
- Convert all skills to lowercase.
- Remove duplicate skills.
- Normalize common naming variations.
- Consider the following as the same skill:
    python3 = python
    python 3.x = python
    postgres = postgresql
    postgresql database = postgresql
    node.js = nodejs
    node js = nodejs
    react.js = react
    reactjs = react
    javascript = js
    typescript = ts

IMPORTANT MATCHING RULES:
- Before marking a skill as missing, check whether the resume contains the same technology with a different naming format.
- Do NOT mark a skill missing if it is only a naming difference.
- Do NOT consider frameworks, libraries, or tools as equivalent unless they are clearly the same technology.
- Do NOT infer parent-child relationships.

Examples:
Correct:
Resume: "PostgreSQL"
JD: "Postgres"
Result:
matching_skills: ["postgresql"]

Incorrect:
Resume: "FastAPI"
JD: "Backend API Development"
Do NOT mark as matching unless "Backend API Development" is explicitly present.

TASKS:

1. candidate_skills:
Extract only technical skills from the resume.

2. required_skills:
Extract only technical skills from the job description.

3. matching_skills:
Return only skills that exist in both candidate_skills and required_skills after normalization.

4. missing_skills:
Return only required skills that are not present in candidate_skills after normalization.

5. strengths:
Generate short recruiter insights only from matching_skills.
Do not add any extra assumptions.

6. weaknesses:
Generate short gap statements only from missing_skills.
Do not mention skills that are not in missing_skills.


INPUT:

Resume:
{resume_text}

Job Description:
{jd_text}


OUTPUT FORMAT:

{{
    "candidate_skills": [],
    "required_skills": [],
    "matching_skills": [],
    "missing_skills": [],
    "strengths": [],
    "weaknesses": []
}}
"""
    prompt=PromptTemplate(template=template,input_variables=["resume_text","jd_text"])

    formatted_prompt=prompt.format(resume_text=resume.content,jd_text=jd.content)
    result=llm.invoke(formatted_prompt)
    result=result.content
    
    try:
        data = parse_llm_json(result)
    except Exception:
        return {
        "error": "LLM returned invalid JSON",
        "raw_response": result
    }
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