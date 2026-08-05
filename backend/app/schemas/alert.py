from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AlertResponse(BaseModel):
    id: int
    category: str
    severity: str
    message: str
    resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AlertResolve(BaseModel):
    resolved: bool = True
