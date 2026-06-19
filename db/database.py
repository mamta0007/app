from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base,sessionmaker


url="postgresql://postgres:Mango@localhost:5432/chatdata"
engine=create_engine(url)

Base=declarative_base()

sessionlocal=sessionmaker(bind=engine)


