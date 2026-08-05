import asyncio
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models.alert import Alert
from app.models.ticket import Ticket
from app.models.asset import Asset
from app.models.device import Telemetry
from app.services import system_info
from app.core.websocket import manager

scheduler = AsyncIOScheduler()

async def check_system_metrics_and_alerts():
    db: Session = SessionLocal()
    try:
        # Collect live stats for local host fallback/monitoring
        cpu = system_info.get_cpu_info()
        ram = system_info.get_ram_info()
        disks = system_info.get_disk_info()
        defender = system_info.get_defender_status()
        firewall = system_info.get_firewall_status()
        internet = system_info.check_internet_status()
        
        # 1. Update or create local-host asset
        import socket
        import platform
        asset = db.query(Asset).filter(Asset.uuid == "local-host").first()
        if not asset:
            import random
            asset = Asset(
                uuid="local-host",
                asset_tag=f"HDX-{str(random.randint(100000, 999999))}",
                hostname=socket.gethostname(),
                operating_system=platform.system(),
                type="Workstation"
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
        
        asset.cpu_usage = cpu["usage_percent"]
        asset.ram_usage = ram["percent"]
        asset.disk_usage = disks[0]["percent"] if disks else 0.0
        asset.health_score = calculate_health_score(cpu, ram, disks, defender, firewall, internet)
        asset.status = "Online"
        asset.last_seen = datetime.utcnow()
        db.commit()

        # 2. Save local telemetry point
        telemetry = Telemetry(
            asset_id=asset.id,
            cpu_usage=cpu["usage_percent"],
            ram_usage=ram["percent"],
            disk_usage=disks[0]["percent"] if disks else 0.0,
            disk_free_gb=(disks[0]["free_gb"] if disks else 0.0),
            created_at=datetime.utcnow()
        )
        db.add(telemetry)
        db.commit()

        # 3. CPU Alert
        await process_threshold_alert(
            db=db,
            category="CPU",
            is_triggered=(cpu["usage_percent"] > 90.0),
            message=f"High CPU Usage detected: {cpu['usage_percent']}%",
            severity="Critical",
            asset_id=asset.id
        )

        # 4. RAM Alert
        await process_threshold_alert(
            db=db,
            category="RAM",
            is_triggered=(ram["percent"] > 90.0),
            message=f"High Memory Usage detected: {ram['percent']}% ({ram['used_gb']}/{ram['total_gb']} GB)",
            severity="Critical",
            asset_id=asset.id
        )

        # 5. Disk Alert
        for disk in disks:
            device_name = disk["device"]
            await process_threshold_alert(
                db=db,
                category=f"Disk ({device_name})",
                is_triggered=(disk["percent"] > 95.0),
                message=f"Low Disk Space on {device_name}: {disk['percent']}% used",
                severity="Critical",
                asset_id=asset.id
            )

        # Count metrics for stats
        open_tickets = db.query(Ticket).filter(Ticket.status != "Resolved").count()
        resolved_tickets = db.query(Ticket).filter(Ticket.status == "Resolved").count()
        active_alerts = db.query(Alert).filter(Alert.resolved == False).count()

        # Broadcast packet
        payload = {
            "type": "metrics_update",
            "timestamp": datetime.now().isoformat(),
            "device_id": asset.id,
            "uuid": "local-host",
            "hostname": asset.hostname,
            "data": {
                "cpu": cpu,
                "ram": ram,
                "disks": disks,
                "network_sent_mbs": 0.0,
                "network_recv_mbs": 0.0,
                "defender_status": defender,
                "firewall_status": firewall,
                "internet_status": internet,
                "services_running_count": len([s for s in system_info.get_windows_services() if s["status"] == "running"]),
                "open_tickets_count": open_tickets,
                "resolved_tickets_count": resolved_tickets,
                "critical_alerts_count": active_alerts,
                "health_score": asset.health_score
            }
        }
        await manager.broadcast(payload)

    except Exception as e:
        print(f"Error in background scheduler job: {e}")
    finally:
        db.close()

async def check_device_heartbeats():
    db: Session = SessionLocal()
    try:
        # If device last seen was more than 45 seconds ago, mark offline and alert
        offline_limit = datetime.utcnow() - timedelta(seconds=45)
        stale_assets = db.query(Asset).filter(
            Asset.last_seen < offline_limit,
            Asset.status == "Online"
        ).all()

        for dev in stale_assets:
            dev.status = "Offline"
            db.commit()

            # Trigger Connection alert
            await process_threshold_alert(
                db=db,
                category="Connection",
                is_triggered=True,
                message=f"Endpoint connection lost: {dev.hostname} is offline",
                severity="Critical",
                asset_id=dev.id
            )
    except Exception as e:
        print(f"Error checking device heartbeats: {e}")
    finally:
        db.close()

async def process_threshold_alert(db: Session, category: str, is_triggered: bool, message: str, severity: str, asset_id: Optional[int] = None):
    # Find existing unresolved alert
    alert = db.query(Alert).filter(
        Alert.category == category,
        Alert.resolved == False,
        Alert.asset_id == asset_id
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
                    "device_id": asset_id, # broadcast compatible key
                    "category": new_alert.category,
                    "severity": new_alert.severity,
                    "message": new_alert.message,
                    "resolved": False,
                    "created_at": new_alert.created_at.isoformat()
                }
            })
    else:
        if alert:
            # Resolve existing alert
            alert.resolved = True
            alert.resolved_at = datetime.utcnow()
            db.commit()
            
            # Broadcast resolved alert
            await manager.broadcast({
                "type": "alert_resolved",
                "alert_id": alert.id,
                "device_id": asset_id,
                "category": category
            })

def calculate_health_score(cpu, ram, disks, defender, firewall, internet) -> int:
    score = 100
    if cpu["usage_percent"] > 90.0:
        score -= 20
    elif cpu["usage_percent"] > 75.0:
        score -= 10
        
    if ram["percent"] > 90.0:
        score -= 20
    elif ram["percent"] > 75.0:
        score -= 10

    for disk in disks:
        if disk["percent"] > 95.0:
            score -= 15
        elif disk["percent"] > 85.0:
            score -= 5

    if defender == "Disabled":
        score -= 20
    if firewall == "Disabled":
        score -= 15
    if not internet:
        score -= 10

    return max(0, score)

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_device_heartbeats, 'interval', seconds=10, id="heartbeat_checker")
        scheduler.start()

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
