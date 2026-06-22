from models.interview import Interview
from models.resume import Resume
from models.jd import Jd
from utils.llm import llm
from utils.json_parser import parse_llm_json
from langchain_core.prompts import PromptTemplate


def generat_question(type,db):
   
    template="""
You are an expert technical interviewer.

Interview type: {type}

STRICT RULES:
- Ask ONLY one question
- Do NOT add explanation
- Do NOT use markdown or formatting
- Keep question clear and professional
- Base the question ONLY on given resume and job description
- Prefer skills that appear in BOTH resume and job description
- If no overlap, ask from job description requirements

Interview Logic:
- Technical → coding / concepts
- HR → behavioral / situational
- Mixed → combination of both

Resume:
{resume_text}

Job Description:
{jd_text}

Output:
Return ONLY the question as plain text.
"""

    resume = db.query(Resume).order_by(Resume.id.desc()).first()
    jd = db.query(Jd).order_by(Jd.id.desc()).first()
    
    prompt=PromptTemplate(template=template,input_variables=["type","resume_text","jd_text"])
    formatted_prompt=prompt.format(type=type,resume_text=resume.content,jd_text=jd.content)
    result=llm.invoke(formatted_prompt)
    response=result.content
    
    interview=Interview(type=type,question=response)
    db.add(interview) 
    db.commit()
    return {
    "type": type,
    "question": response   # 🔥 NOT "response"
}
    



def question_answer(answer, db):
    interview=db.query(Interview).order_by(Interview.id.desc()).first()
    if not interview :
        return "error"
    
    template="""You are an expert interviewer.

Question: {question}
Answer: {answer}

Evaluate based on:
- correctness
- clarity
- depth

Return JSON:

{{
  "score": "0-10",
  "feedback": "short improvement suggestion"
}}"""
    prompt=PromptTemplate(template=template,input_variables=["question","answer"])
   
    formatted_prompt=prompt.format(question=interview.question,answer=answer)
    result=llm.invoke(formatted_prompt)
    response=result.content
    
    response=parse_llm_json(response)
    score=response["score"]
    feedback=response["feedback"]
    
    interview.answer=answer
    interview.score=score
    interview.feedback=feedback
    db.commit()
    
    
    template2= """
You are an interviewer.

previous data:{data}
Generate next question:

Rules:
- If answer weak → easier follow-up
- If strong → deeper question
- Keep context

Return only question.
"""


    prompt2=PromptTemplate(template=template2,input_variables=["data"])
    formatted_prompt2=prompt2.format(data= {
    "question": interview.question,
    "answer": interview.answer,
    "score": interview.score,
    "feedback": interview.feedback
})
    result2=llm.invoke(formatted_prompt2)
    response2=result2.content
    if response2:
        new_interview=Interview(question=response2,type=interview.type)
        db.add(new_interview)
        db.commit()
        
    return {
    "score": score,
    "feedback": feedback,
    "next_question": response2
}