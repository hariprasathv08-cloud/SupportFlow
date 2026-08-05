from pydantic import BaseModel
from typing import Optional

class UserPreferencesBase(BaseModel):
    theme: str = "system"
    language: str = "en"
    timezone: str = "UTC"
    sidebar_state: str = "expanded"
    density: str = "normal"
    notification_preferences: str = "all"

class UserPreferencesUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    sidebar_state: Optional[str] = None
    density: Optional[str] = None
    notification_preferences: Optional[str] = None

class UserPreferencesResponse(UserPreferencesBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
