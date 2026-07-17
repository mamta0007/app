from jose import jwt
from datetime import datetime,timedelta
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")       
ALGORITHM = "HS256"


def create_access_token(data: dict):
    pay_load = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=5)
    pay_load.update({"exp": expire})
    encoded_jwt = jwt.encode(pay_load, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):

    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=1)

    payload.update(
        {
            "exp": expire
        }
    )

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
    
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("Token has expired")
    except jwt.JWTError:
        raise Exception("Invalid token")  
