from pydantic import BaseModel
from datetime import datetime

class HistoryResponse(BaseModel):
    analysis_id: int
    resume_file: str | None
    jd_file: str | None
    report_name: str | None
    created_at: datetime
    report_id: int | None