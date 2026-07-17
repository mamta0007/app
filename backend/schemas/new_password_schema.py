from pydantic import BaseModel,field_validator,model_validator

class New_password(BaseModel):
    password:str
    confirm_password:str
    
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
   

