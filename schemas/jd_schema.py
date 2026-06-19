from pydantic import BaseModel,ConfigDict

class JdResponse(BaseModel):
    message:str
    
    model_config=ConfigDict(from_attributes=True)