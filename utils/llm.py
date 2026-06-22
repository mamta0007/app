from langchain_groq import ChatGroq
from dotenv import load_dotenv
load_dotenv()
import os

llm=ChatGroq(model="llama-3.3-70b-versatile",
             max_tokens=800,
             api_key=os.getenv("GROQ_API_KEY"))
