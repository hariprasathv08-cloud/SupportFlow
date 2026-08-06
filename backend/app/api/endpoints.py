from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import random

from app.database import get_db
from app.models.asset import Asset
from app.models.device import Telemetry
from app.models.alert import Alert
from app.models.ticket import Ticket
from app.schemas.device import TelemetryPayload, DeviceResponse, TelemetryResponse
from app.core.websocket import manager
from app.core.dependencies import get_current_active_user

router = APIRouter()

def is_admin(user) -> bool:
    return user.role in ["Admin", "Super Administrator", "Administrator"]

async def process_device_alert(db: Session, asset_id: int, category: str, is_triggered: bool, message: str, severity: str):
    # Find existing unresolved alert for this specific asset
    alert = db.query(Alert).filter(
        Alert.asset_id == asset_id,
        Alert.category == category,
        Alert.resolved == False
    ).first()

    # Get asset to know the assigned user
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    assigned_user_id = asset.assigned_user_id if asset else None

    # Helper function to send alert to allowed users
    async def send_alert_to_allowed(msg_packet: dict):
        from app.models.user import User
        active_users = db.query(User).filter(User.is_active == True).all()
        for u in active_users:
            if is_admin(u) or u.id == assigned_user_id:
                await manager.send_to_user(u.id, msg_packet)

    if is_triggered:
        if not alert:
            new_alert = Alert(
                asset_id=asset_id,
                category=category,
                severity=severity,
                message=message,
                resolved=False
            )
            db.add(new_alert)
            db.commit()
            db.refresh(new_alert)

            # Broadcast new alert
            await send_alert_to_allowed({
                "type": "new_alert",
                "alert": {
                    "id": new_alert.id,
                    "asset_id": asset_id,
                    "category": new_alert.category,
                    "severity": new_alert.severity,
                    "message": new_alert.message,
                    "resolved": False,
                    "created_at": new_alert.created_at.isoformat()
                }
            })
    else:
        if alert:
            alert.resolved = True
            alert.resolved_at = datetime.utcnow()
            db.commit()

            # Broadcast resolved alert
            await send_alert_to_allowed({
                "type": "alert_resolved",
                "alert_id": alert.id,
                "asset_id": asset_id,
                "category": category
            })

def calculate_device_health(payload: TelemetryPayload) -> int:
    score = 100
    if payload.cpu_usage > 90.0:
        score -= 20
    elif payload.cpu_usage > 75.0:
        score -= 10

    if payload.ram_usage > 90.0:
        score -= 20
    elif payload.ram_usage > 75.0:
        score -= 10

    if payload.disk_usage > 95.0:
        score -= 15
    elif payload.disk_usage > 85.0:
        score -= 5

    if payload.cpu_temp and payload.cpu_temp > 85.0:
        score -= 15

    # Check firewall/defender status
    services_list = payload.services or []
    defender_off = False
    firewall_off = False
    
    for svc in services_list:
        name = svc.get("name", "").lower()
        status_str = svc.get("status", "").lower()
        if "windefend" in name and status_str != "running":
            defender_off = True
        if "mpssvc" in name and status_str != "running":
            firewall_off = True

    if defender_off:
        score -= 20
    if firewall_off:
        score -= 15

    return max(0, score)

from app.models.organization import Organization
from app.core.scopes import get_scoped_assets
from pydantic import BaseModel
import uuid

class EnrollmentRequest(BaseModel):
    device_uuid: str
    hostname: str
    operating_system: str
    enrollment_key: str

@router.post("/enroll")
def enroll_agent(payload: EnrollmentRequest, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.enrollment_key == payload.enrollment_key).first()
    if not org:
        raise HTTPException(status_code=400, detail="Invalid enrollment key")
        
    asset = db.query(Asset).filter(Asset.uuid == payload.device_uuid).first()
    if not asset:
        asset_tag_str = f"HDX-{payload.device_uuid[:8].upper()}"
        token = "tok_" + uuid.uuid4().hex
        asset = Asset(
            uuid=payload.device_uuid,
            asset_tag=asset_tag_str,
            hostname=payload.hostname,
            operating_system=payload.operating_system,
            organization_id=org.id,
            approval_status="Pending",
            api_token=token
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
    else:
        if not asset.api_token:
            asset.api_token = "tok_" + uuid.uuid4().hex
            db.commit()
            
    return {
        "status": asset.approval_status,
        "api_token": asset.api_token,
        "message": "Device registration received. Awaiting admin approval."
    }

@router.get("/pending")
def list_pending_agents(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    role_name = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    if role_name not in ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage agent approvals")
        
    query = db.query(Asset).filter(Asset.approval_status == "Pending")
    if role_name != "SUPER_ADMIN":
        query = query.filter(Asset.organization_id == current_user.organization_id)
    return query.all()

@router.post("/{device_id}/approve")
def approve_agent(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    role_name = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    if role_name not in ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage agent approvals")
        
    asset = db.query(Asset).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if role_name != "SUPER_ADMIN" and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Device belongs to another organization")
        
    asset.approval_status = "Approved"
    db.commit()
    return {"status": "Approved", "message": f"Device {asset.hostname} successfully approved for monitoring"}

@router.post("/{device_id}/reject")
def reject_agent(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    role_name = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    if role_name not in ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage agent approvals")
        
    asset = db.query(Asset).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if role_name != "SUPER_ADMIN" and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Device belongs to another organization")
        
    asset.approval_status = "Rejected"
    db.commit()
    return {"status": "Rejected", "message": f"Device {asset.hostname} successfully rejected"}

@router.post("/telemetry", response_model=TelemetryResponse)
async def post_telemetry(
    payload: TelemetryPayload, 
    db: Session = Depends(get_db),
    x_device_token: str = Header(None, alias="X-Device-Token")
):
    token_val = x_device_token
    if not token_val:
        # Fallback to check if payload.device_uuid matches an approved device (for backward compatibility if needed)
        # But we require secure tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device API token required")
        
    asset = db.query(Asset).filter(Asset.api_token == token_val).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device token")
        
    if asset.approval_status != "Approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Device monitoring is not approved"
        )

    # Update Asset properties
    asset.hostname = payload.hostname
    asset.ip_address = payload.ip_address
    asset.mac_address = payload.mac_address
    asset.operating_system = payload.operating_system or payload.os
    asset.os_version = payload.kernel
    asset.current_user = payload.username or payload.current_user
    asset.uptime = payload.uptime
    asset.status = "Online"
    asset.last_seen = datetime.utcnow()
    
    # Automatically map asset to User if unassigned
    username_val = payload.username or payload.current_user
    if not asset.assigned_user_id and username_val:
        from app.models.user import User
        linked_user = db.query(User).filter(
            (User.username == username_val) | 
            (User.email.like(f"{username_val}@%"))
        ).first()
        if linked_user:
            asset.assigned_user_id = linked_user.id
            if linked_user.department_id:
                asset.department_id = linked_user.department_id
    
    # Auto-Discovered Hardware specs mapping
    if payload.manufacturer:
        asset.manufacturer = payload.manufacturer
    if payload.model:
        asset.model = payload.model
    if payload.serial_number:
        asset.serial_number = payload.serial_number
    if payload.motherboard_serial:
        asset.motherboard_serial = payload.motherboard_serial
    if payload.bios_version:
        asset.bios_version = payload.bios_version
    if payload.cpu:
        asset.cpu = payload.cpu
    if payload.ram:
        asset.ram = payload.ram
    if payload.storage:
        asset.storage = payload.storage
    if payload.domain:
        asset.domain = payload.domain
    if payload.type:
        asset.type = payload.type

    # Usage snapshots
    asset.cpu_usage = payload.cpu_usage
    asset.ram_usage = payload.ram_usage
    asset.disk_usage = payload.disk_usage
    asset.health_score = calculate_device_health(payload)
    db.commit()

    # Create Telemetry History Point
    telemetry = Telemetry(
        asset_id=asset.id,
        cpu_usage=payload.cpu_usage,
        ram_usage=payload.ram_usage,
        disk_usage=payload.disk_usage,
        disk_free_gb=payload.disk_free_gb,
        cpu_temp=payload.cpu_temp,
        processes=payload.processes,
        services=payload.services,
        software=payload.software,
        network_interfaces=payload.network_interfaces,
        docker_containers=payload.docker_containers
    )
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)

    # Synchronize Software table
    if isinstance(payload.software, list):
        from app.models.software import Software
        db.query(Software).filter(Software.asset_id == asset.id).delete()
        for sw in payload.software:
            if isinstance(sw, dict) and sw.get("name"):
                db_sw = Software(
                    asset_id=asset.id,
                    organization_id=asset.organization_id,
                    name=sw.get("name"),
                    version=sw.get("version"),
                    publisher=sw.get("publisher"),
                    install_date=sw.get("install_date")
                )
                db.add(db_sw)
        db.commit()

    # Process alert engine updates
    await process_device_alert(
        db, asset.id, "CPU", 
        payload.cpu_usage > 90.0, 
        f"Device {asset.hostname} reports CPU spike: {payload.cpu_usage}%", 
        "Critical"
    )
    await process_device_alert(
        db, asset.id, "RAM", 
        payload.ram_usage > 90.0, 
        f"Device {asset.hostname} reports RAM exhaustion: {payload.ram_usage}%", 
        "Critical"
    )
    await process_device_alert(
        db, asset.id, "Disk", 
        payload.disk_usage > 95.0, 
        f"Device {asset.hostname} reports Disk full: {payload.disk_usage}%", 
        "Critical"
    )

    # Broadcast to connected browser clients
    msg = {
        "type": "metrics_update",
        "timestamp": datetime.now().isoformat(),
        "device_id": asset.id,
        "uuid": asset.uuid,
        "hostname": asset.hostname,
        "data": {
            "cpu": {"usage_percent": payload.cpu_usage},
            "ram": {"percent": payload.ram_usage},
            "disks": [{"device": "/", "percent": payload.disk_usage}],
            "network_sent_mbs": 0.0,
            "network_recv_mbs": 0.0,
            "defender_status": "Enabled",
            "firewall_status": "Enabled",
            "internet_status": True,
            "services_running_count": len([s for s in (payload.services or []) if s.get("status", "") == "running"]),
            "health_score": asset.health_score
        }
    }

    from app.models.user import User
    from app.models.user import Role
    active_users = db.query(User).filter(User.is_active == True).all()
    for u in active_users:
        u_role = u.role.name if hasattr(u.role, "name") else str(u.role)
        # SUPER_ADMIN gets everything globally.
        # ORGANIZATION_ADMIN, IT_ADMIN, HR_ADMIN get all devices within their organization.
        # Viewer/EMPLOYEE only get updates for their explicitly assigned device.
        if u_role == "SUPER_ADMIN":
            await manager.send_to_user(u.id, msg)
        elif u.organization_id == asset.organization_id:
            if u_role in ["ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN"]:
                await manager.send_to_user(u.id, msg)
            elif asset.assigned_user_id == u.id:
                await manager.send_to_user(u.id, msg)

    return telemetry

@router.get("/devices", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return get_scoped_assets(db, current_user).order_by(Asset.last_seen.desc()).all()

@router.get("/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to access this device details")
    return asset

@router.get("/devices/{device_id}/telemetry-history", response_model=List[TelemetryResponse])
def get_telemetry_history(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to access this device telemetry")
    return db.query(Telemetry).filter(Telemetry.asset_id == device_id).order_by(Telemetry.created_at.desc()).limit(30).all()[::-1]

@router.get("/devices/{device_id}/latest-telemetry")
def get_latest_telemetry(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to access this device telemetry")
    tel = db.query(Telemetry).filter(Telemetry.asset_id == device_id).order_by(Telemetry.created_at.desc()).first()
    if not tel:
        raise HTTPException(status_code=404, detail="No telemetry points recorded")
    return {
        "processes": tel.processes,
        "services": tel.services,
        "software": tel.software,
        "network_interfaces": tel.network_interfaces,
        "docker_containers": tel.docker_containers
    }
