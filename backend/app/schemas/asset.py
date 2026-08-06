from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AssetBase(BaseModel):
    uuid: str
    asset_tag: str
    asset_name: Optional[str] = None
    hostname: Optional[str] = None
    operating_system: Optional[str] = None
    os_version: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    motherboard_serial: Optional[str] = None
    bios_version: Optional[str] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    storage: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    current_user: Optional[str] = None
    domain: Optional[str] = None
    type: Optional[str] = "Workstation"
    department: Optional[str] = "IT Support"
    location: Optional[str] = "HQ"
    warranty: Optional[str] = "Active - 3 Years"
    purchase_date: Optional[datetime] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    approval_status: Optional[str] = "Pending"
    api_token: Optional[str] = None

class AssetCreate(BaseModel):
    uuid: Optional[str] = None
    asset_name: Optional[str] = None
    hostname: str
    operating_system: str
    type: str # Laptop, Desktop, Server, Virtual Machine, Router, Firewall, Printer
    serial_number: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    warranty: Optional[str] = None
    purchase_date: Optional[datetime] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    approval_status: Optional[str] = "Pending"

class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    type: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    warranty: Optional[str] = None
    purchase_date: Optional[datetime] = None
    status: Optional[str] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    approval_status: Optional[str] = None
    assigned_user_id: Optional[int] = None

class AssetResponse(AssetBase):
    id: int
    status: str
    health_score: int
    cpu_usage: float
    ram_usage: float
    disk_usage: float
    uptime: float
    last_seen: datetime
    created_at: datetime

    class Config:
        from_attributes = True
