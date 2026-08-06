from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.schemas.asset import AssetResponse

class TelemetryPayload(BaseModel):
    device_uuid: str
    uuid: Optional[str] = None
    hostname: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    operating_system: str
    os: Optional[str] = None
    kernel: Optional[str] = None
    username: Optional[str] = None
    current_user: Optional[str] = None
    uptime: float
    cpu_usage: float
    ram_usage: float
    disk_usage: float
    disk_free_gb: Optional[float] = None
    cpu_temp: Optional[float] = None
    
    # Auto-Discovered Hardware Specs
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    motherboard_serial: Optional[str] = None
    bios_version: Optional[str] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    storage: Optional[str] = None
    domain: Optional[str] = None
    type: Optional[str] = "Workstation"

    processes: Optional[List[Dict[str, Any]]] = None
    services: Optional[List[Dict[str, Any]]] = None
    software: Optional[List[Dict[str, Any]]] = None
    network_interfaces: Optional[List[Dict[str, Any]]] = None
    docker_containers: Optional[List[Dict[str, Any]]] = None

class TelemetryResponse(BaseModel):
    id: int
    asset_id: int
    cpu_usage: float
    ram_usage: float
    disk_usage: float
    disk_free_gb: Optional[float]
    cpu_temp: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True

# Alias DeviceResponse to AssetResponse for seamless backend query handling
DeviceResponse = AssetResponse
