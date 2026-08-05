from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ReportTaskResponse(BaseModel):
    id: int
    task_id: str
    user_id: int
    report_type: str
    formats: str
    delivery: str
    emails: Optional[str] = None
    date_range: str
    status: str
    progress: int
    error_message: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
