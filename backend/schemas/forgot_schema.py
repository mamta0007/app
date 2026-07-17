from pydantic import BaseModel,EmailStr, ConfigDict

class ForgotPasswordRequest(BaseModel):    
    email: EmailStr