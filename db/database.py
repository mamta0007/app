from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base,sessionmaker
from dotenv import load_dotenv
import os
load_dotenv()

url=os.getenv("url")
engine=create_engine(url)

Base=declarative_base()

sessionlocal=sessionmaker(bind=engine)


