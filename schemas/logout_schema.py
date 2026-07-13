from pydantic import BaseModel, ConfigDict

class LogoutRequest(BaseModel):
    refresh_token: str

    model_config = ConfigDict(from_attributes=True)