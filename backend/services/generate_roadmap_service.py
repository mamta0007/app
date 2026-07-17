from models.analysis import Analysis
from models.roadmap import RoadMap
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate
from utils.llm import llm

def generate_road_map(current_user, db):

  template="""You are a technical mentor.

Create a learning roadmap using ONLY the provided missing_skills.

Rules:
1. Use every skill in missing_skills exactly once.
2. Do NOT add, remove, rename, merge, split, or infer skills.
3. Assign exactly one skill to each week.
4. Start from week_1 and continue sequentially (week_2, week_3, ... ) until all skills are assigned.
5. Do NOT leave any week empty.
6. If there are N skills, generate exactly N weeks.
7. Return ONLY valid JSON.
8. No markdown. No explanation.

Input:
missing_skills:
{missing_skills}

Output:
{{
  "missing_skills": [],
  "learning_plan": {{}}
}}
"""


  analysis = (
  db.query(Analysis)
  .filter(Analysis.user_id == current_user.id)
    .order_by(Analysis.id.desc())
    .first()
) 
  missing_skills = ", ".join(analysis.missing_skills)
    
    
  prompt=PromptTemplate(template=template,input_variables=["missing_skills"])
  formatted_prompt=prompt.format(missing_skills=missing_skills)
  result=llm.invoke(formatted_prompt)
  response=parse_llm_json(result.content)
    
  roadmap=RoadMap(missing_skills=missing_skills,learning_plan=response["learning_plan"], user_id=current_user.id,analysis_id=analysis.id,)
  db.add(roadmap)
  db.commit()
  return response