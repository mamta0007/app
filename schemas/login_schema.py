from pydantic import BaseModel, ConfigDict,EmailStr

class Login(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(from_attributes=True)
    
class User_create(BaseModel):
    name: str
    email: EmailStr
    password: str
    

    model_config = ConfigDict(from_attributes=True)