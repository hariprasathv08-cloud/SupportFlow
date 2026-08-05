from fastapi import APIRouter, Depends, HTTPException, status
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

async def process_device_alert(db: Session, asset_id: int, category: str, is_triggered: bool, message: str, severity: str):
    # Find existing unresolved alert for this specific asset
    alert = db.query(Alert).filter(
        Alert.asset_id == asset_id,
        Alert.category == category,
        Alert.resolved == False
    ).first()

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
            await manager.broadcast({
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
            await manager.broadcast({
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

@router.post("/telemetry", response_model=TelemetryResponse)
async def post_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    # 1. Fetch or create Asset
    asset = db.query(Asset).filter(Asset.uuid == payload.uuid).first()
    if not asset:
        # Check by serial_number fallback to prevent duplicate physical node creation
        if payload.serial_number:
            asset = db.query(Asset).filter(Asset.serial_number == payload.serial_number).first()
            
        if not asset:
            asset_tag_str = f"HDX-{payload.uuid[:8].upper()}" if payload.uuid else f"HDX-{str(random.randint(100000, 999999))}"
            asset = Asset(
                uuid=payload.uuid,
                asset_tag=asset_tag_str,
                hostname=payload.hostname,
                operating_system=payload.os,
                type=payload.type or "Workstation"
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)

    # 2. Update Asset properties
    asset.hostname = payload.hostname
    asset.ip_address = payload.ip_address
    asset.mac_address = payload.mac_address
    asset.operating_system = payload.os
    asset.os_version = payload.kernel
    asset.current_user = payload.current_user
    asset.uptime = payload.uptime
    asset.status = "Online"
    asset.last_seen = datetime.utcnow()
    
    # Automatically map asset to User if unassigned
    if not asset.assigned_user_id and payload.current_user:
        from app.models.user import User
        linked_user = db.query(User).filter(
            (User.username == payload.current_user) | 
            (User.email.like(f"{payload.current_user}@%"))
        ).first()
        if linked_user:
            asset.assigned_user_id = linked_user.id
    
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

    # 3. Create Telemetry History Point
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

    # 4. Trigger Alerts Engine checks
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
    if payload.cpu_temp:
        await process_device_alert(
            db, asset.id, "Temperature", 
            payload.cpu_temp > 85.0, 
            f"Device {asset.hostname} CPU temperature high: {payload.cpu_temp}C", 
            "Warning"
        )

    # 5. Broadcast to connected browser clients
    open_tickets = db.query(Ticket).filter(Ticket.status != "Resolved").count()
    resolved_tickets = db.query(Ticket).filter(Ticket.status == "Resolved").count()
    active_alerts = db.query(Alert).filter(Alert.resolved == False).count()

    await manager.broadcast({
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
            "open_tickets_count": open_tickets,
            "resolved_tickets_count": resolved_tickets,
            "critical_alerts_count": active_alerts,
            "health_score": asset.health_score
        }
    })

    return telemetry

@router.get("/devices", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    if current_user.role == "Viewer":
        return db.query(Asset).filter(Asset.assigned_user_id == current_user.id).all()
    return db.query(Asset).order_by(Asset.last_seen.desc()).all()

@router.get("/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = db.query(Asset).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Device not found")
    if current_user.role == "Viewer" and asset.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this device details")
    return asset

@router.get("/devices/{device_id}/telemetry-history", response_model=List[TelemetryResponse])
def get_telemetry_history(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = db.query(Asset).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Device not found")
    if current_user.role == "Viewer" and asset.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this device telemetry")
    return db.query(Telemetry).filter(Telemetry.asset_id == device_id).order_by(Telemetry.created_at.desc()).limit(30).all()[::-1]

@router.get("/devices/{device_id}/latest-telemetry")
def get_latest_telemetry(device_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    asset = db.query(Asset).filter(Asset.id == device_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Device not found")
    if current_user.role == "Viewer" and asset.assigned_user_id != current_user.id:
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
