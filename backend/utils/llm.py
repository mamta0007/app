from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv
load_dotenv()
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    max_tokens=800,
      seed=42,
      top_p=0.1,
    api_key=os.getenv("GROQ_API_KEY")
)