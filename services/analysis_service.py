from models.analysis import Analysis
from models.resume import Resume
from models.jd import Jd
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv
load_dotenv()


def run_analysis(current_user,db):
    
    llm = ChatGroq(
      model="qwen/qwen3-32b",
      temperature=0,
      reasoning_effort="none",
      max_tokens=800,
      api_key=os.getenv("GROQ_API_KEY")
  )
    
    
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

    
       
    template = """
You are an ATS and Technical Recruiter evaluating a candidate's resume against a job description.

============================================================
STEP 1 — EXTRACT REQUIRED SKILLS FROM THE JD
============================================================
- Combine skills from EVERY section of the job description that names a
  technology, tool, language, framework, database, platform, protocol, or
  concept — including sections titled "Required Skills", "Preferred
  Skills", "Nice to Have", "Responsibilities", and "About the Role".
- Do NOT limit extraction to only the section literally labeled
  "Required Skills". A skill mentioned in "Preferred Skills" or in a
  responsibilities paragraph is still something the JD is asking for.
- Include conceptual/fundamental topics as skills too (e.g. "data
  structures & algorithms", "dbms", "operating systems", "oop") if the
  JD names them explicitly.

============================================================
STEP 2 — EXTRACT CANDIDATE SKILLS FROM THE RESUME
============================================================
- Scan the ENTIRE resume text — the declared "Skills" section AND every
  project description, internship bullet, certification, and academic
  description.
- A skill counts as present if it appears explicitly as text ANYWHERE in
  the resume, not only inside a dedicated skills list. Example: if a
  project bullet says "Designed and developed backend REST APIs using
  FastAPI", then both "rest apis" and "fastapi" count as present skills,
  even though they may not appear in the "Skills:" section.
- Never infer, guess, summarize, or use external/world knowledge to
  assume a skill the text does not state.

============================================================
STEP 3 — NORMALIZE
============================================================
- Convert all skill names to lowercase.
- Remove duplicates.
- Apply ONLY these equivalents (do not invent additional ones):
  js=javascript
  react.js=react
  node.js=node
  python3=python
  postgresql=postgres
  postgres sql=postgres
  aws=amazon web services
  gcp=google cloud platform
  k8s=kubernetes
  ci cd=ci/cd
  cicd=ci/cd
  rest api=rest apis
  restful api=rest apis
  restful apis=rest apis
- Do NOT treat related-but-different technologies as equivalent
  (e.g. mysql does not satisfy a requirement for postgres; react does
  not satisfy a requirement for angular).

============================================================
STEP 4 — COMPARE
============================================================
- matching_skills: skills present in BOTH the normalized required_skills
  list AND the normalized candidate_skills list.
- missing_skills: skills present in required_skills but NOT found
  anywhere in the resume.
- If the JD lists alternatives with "or" (e.g. "Node.js, Python, or
  Java"), treat the requirement as satisfied if the candidate has ANY
  one of the listed alternatives — do not list the other alternatives
  as missing_skills in that case.

============================================================
STEP 5 — QUALITATIVE STRENGTHS AND WEAKNESSES
============================================================
- strengths: 2-3 short sentences describing WHY the matching skills are
  credible for this role, grounded in specific resume evidence (a named
  project, internship, or context). Do not just restate skill names as
  a list.
- weaknesses: 2-3 short sentences describing the candidate's gap
  relative to the JD — for example, experience level vs. what the JD
  expects, absence of an entire category (cloud, databases, testing),
  or lack of production/scale exposure. weaknesses must NOT be a
  restatement or subset of missing_skills — they must add qualitative
  reasoning a hiring manager would care about, not just skill names.
- Base strengths and weaknesses only on what the resume and JD text
  actually say. Do not invent claims not supported by the text.

============================================================
OUTPUT
============================================================
Do not include a match score — it will be calculated separately from
the arrays you return, so any score you might compute would be ignored.

Return ONLY valid JSON. No markdown, no explanation, no extra keys.

{{
  "candidate_skills": [],
  "required_skills": [],
  "matching_skills": [],
  "missing_skills": [],
  "strengths": [],
  "weaknesses": []
}}

Resume:
{resume_text}

Job Description:
{jd_text}
"""
    prompt=PromptTemplate(template=template,input_variables=["resume_text","jd_text"])

    formatted_prompt=prompt.format(resume_text=resume.content,jd_text=jd.content)

    result = llm.invoke(formatted_prompt)
   
    result = result.content
    
   
    data = parse_llm_json(result)
    
    required_skills = data.get("required_skills", [])
    matching_skills = data.get("matching_skills", [])
    missing_skills = data.get("missing_skills", [])
    candidate_skills = data.get("candidate_skills", [])
    strengths = data.get("strengths", [])
    weaknesses = data.get("weaknesses", [])
    
        
    total = len(matching_skills) + len(missing_skills)
    match_score = round(100 * len(matching_skills) / total, 2) if total else 0
    
    data["match_score"]=match_score
    
    analysis=Analysis(user_id=current_user.id,resume_id=resume.id,
    jd_id=jd.id,matching_skills=matching_skills,missing_skills=missing_skills,required_skills=required_skills,
                      strengths=strengths,weaknesses=weaknesses,candidate_skills=candidate_skills,match_score=match_score)
    
    
        
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
        
    return data