from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    category: str
    ticket_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
