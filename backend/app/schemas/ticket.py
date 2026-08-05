from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.user import UserResponse

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    ticket_id: int
    user_id: int
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class AttachmentResponse(BaseModel):
    id: int
    ticket_id: int
    file_name: str
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True

class TicketHistoryResponse(BaseModel):
    id: int
    ticket_id: int
    user_id: int
    action: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    message: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    message_type: str
    created_at: datetime
    sender: UserResponse

    class Config:
        from_attributes = True

class TicketBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = "General"
    priority: str = "Medium"  # Low, Medium, High, Critical
    status: str = "Open"      # Open, Assigned, In Progress, Resolved, Closed
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None

    # Automated RMM specifications attached to incident ticket
    device_hostname: Optional[str] = None
    device_serial: Optional[str] = None
    device_mac: Optional[str] = None
    device_ip: Optional[str] = None
    device_os: Optional[str] = None
    device_cpu: Optional[str] = None
    device_ram: Optional[str] = None
    device_disk: Optional[str] = None
    device_user: Optional[str] = None
    device_uptime: Optional[str] = None
    device_agent_version: Optional[str] = "1.0.0"
    device_location: Optional[str] = "HQ"
    device_internet_status: Optional[str] = "Connected"

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None

class TicketResponse(TicketBase):
    id: int
    created_by_id: int
    created_at: datetime
    assigned_to: Optional[UserResponse] = None
    created_by: Optional[UserResponse] = None
    comments: List[CommentResponse] = []
    attachments: List[AttachmentResponse] = []
    history: List[TicketHistoryResponse] = []
    messages: List[TicketMessageResponse] = []

    class Config:
        from_attributes = True
