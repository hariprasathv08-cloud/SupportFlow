from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class PermissionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_custom: bool
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    username: Optional[str] = None
    avatar: Optional[str] = None
    department: Optional[str] = "IT Support"
    job_title: Optional[str] = "IT Analyst"
    phone: Optional[str] = None
    manager: Optional[str] = None
    is_active: Optional[bool] = True
    status: Optional[str] = "Active"

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "Viewer"
    role_id: Optional[int] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    manager: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    role_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    role: str
    mfa_enabled: bool
    last_login: Optional[datetime] = None
    last_active: Optional[datetime] = None
    created_at: datetime
    role_detail: Optional[RoleResponse] = None
    custom_permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    refresh_token: Optional[str] = None

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: int
    action: str
    user_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
