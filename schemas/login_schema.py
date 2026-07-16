from pydantic import BaseModel, ConfigDict,EmailStr,field_validator,model_validator

class Login(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(from_attributes=True)
    
class User_create(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str

    model_config = ConfigDict(from_attributes=True)
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value
    
    @model_validator(mode="after")
    def validate_confirm_password(self):
        if self.password != self.confirm_password:
            raise ValueError("Password and Confirm Password do not match")
        return self