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
You are an ATS and Technical Recruiter comparing a resume against a job description.

RULES:

1. Internally identify required skills by pulling from EVERY JD section
   (Required, Preferred, Responsibilities, etc.), including named
   conceptual topics (e.g. "dbms", "oop"). Treat each named
   technology/concept as its OWN item — never collapse multiple named
   items into one broad category (e.g. "CNN", "Transformer",
   "fine-tuning" stay separate, not merged into "ai/ml"). Don't skip
   minor-seeming named tools. Do not output this list — use it only to
   build matching_skills and missing_skills below.

2. Internally identify candidate skills by scanning the ENTIRE resume —
   skills list, projects, internships, certifications. Counts only if
   stated as text. Do not output this list either.

3. CRITICAL — no inference: a skill goes in matching_skills ONLY if you
   can point to an exact phrase in the resume that states it. Adjacent
   tools are not evidence for each other — e.g. having "Docker" or
   "Git" does NOT prove "CI/CD"; CI/CD only counts if the resume says
   "CI/CD", "continuous integration/deployment", or names a CI/CD tool
   (Jenkins, GitHub Actions, GitLab CI). Same standard for every skill:
   don't infer one skill's presence from a different, merely related
   one. If you can't point to real text proving it, it belongs in
   missing_skills instead.

4. Normalize (lowercase, dedupe). Apply ONLY these equivalents:
   js=javascript, react.js=react, node.js=node, python3=python,
   postgresql=postgres, aws=amazon web services,
   gcp=google cloud platform, k8s=kubernetes, cicd=ci/cd,
   rest api(s)/restful api(s)=rest apis,
   llm(s)/large language model(s)=llms,
   genai/gen ai=generative ai, ml=machine learning, ai=artificial intelligence,
   rag=retrieval-augmented generation, cv=computer vision
   Never merge different concepts (mysql ≠ postgres, ml ≠ llms).

5. JD alternatives ("Node.js, Python, or Java") are satisfied by ANY
   one match — don't list the rest as missing.

6. strengths/weaknesses: 2-3 sentences each, grounded in specific
   resume evidence, not a restated skill list. weaknesses must add
   real reasoning (experience level, missing category, no prod
   exposure) — never just a copy of missing_skills.

7. No match score (computed separately, ignored if you include one).

Return ONLY valid JSON, no markdown, no extra keys beyond these:
{{
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
    
    
    matching_skills = data.get("matching_skills", [])
    missing_skills = data.get("missing_skills", [])
    strengths = data.get("strengths", [])
    weaknesses = data.get("weaknesses", [])
    
        
    total = len(matching_skills) + len(missing_skills)
    match_score = round(100 * len(matching_skills) / total, 2) if total else 0
    
    data["match_score"]=match_score
    
    analysis=Analysis(user_id=current_user.id,resume_id=resume.id,
    jd_id=jd.id,matching_skills=matching_skills,missing_skills=missing_skills,
                      strengths=strengths,weaknesses=weaknesses,match_score=match_score)
    
    
        
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
        
    return data