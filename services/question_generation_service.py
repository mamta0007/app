from models.resume import Resume
from models.jd import Jd
from models.question import Question
from utils.llm import llm
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate

def run_interview_question(db):
   
    template =  """
You are an expert technical interviewer.

STRICT RULES:
- Output ONLY valid JSON
- Do NOT use ``` or markdown
- Use double quotes ONLY
- Add commas correctly between all elements
- Ensure JSON is parseable by Python json.loads()

OUTPUT FORMAT:
{{
  "technical_questions": ["1. ...", "2. ..."],
  "scenario_questions": ["1. ..."],
  "HR_questions": ["1. ..."],
  "project_based_questions": ["1. ..."]
}}

Resume:
{resume_text}

Job Description:
{jd_text}
"""

    resume = db.query(Resume).order_by(Resume.id.desc()).first()
    jd = db.query(Jd).order_by(Jd.id.desc()).first()
    
    prompt=PromptTemplate(template=template,input_variables=["resume_text","jd_text"])
    formatted_prompt=prompt.format(resume_text=resume.content,jd_text=jd.content)
    result=llm.invoke(formatted_prompt)
    response=result.content
    response=parse_llm_json(response)
    
    question=Question(generated_question=response)
    db.add(question)
    db.commit()
    return response