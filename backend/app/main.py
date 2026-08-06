import asyncio
import json
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.core import scheduler
from app.core.websocket import manager
from app.core.security import get_password_hash
from app.models import User, Role, Permission, Asset, Ticket, Alert, AuditLog, Notification, TicketMessage, UserPreferences

# API Routers
from app.api import auth, system, network, diagnostics, software, tickets, assets, reports, alerts, users, endpoints, notifications, preferences

# Initialize database tables
Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    try:
        # 1. Seed Roles & Permissions
        if db.query(Role).count() == 0:
            print("Seeding default security permissions...")
            perms_dict = {
                "view_dashboard": "View metrics dashboard widgets",
                "edit_dashboard": "Modify dashboard metrics charts",
                "manage_assets": "Create and modify physical assets",
                "delete_assets": "Decommission hardware assets",
                "view_tickets": "Read corporate SupportFlow tickets",
                "assign_tickets": "Assign incidents to administrators",
                "resolve_tickets": "Close resolved incidents",
                "manage_users": "Create and manage operational users",
                "view_reports": "Access metrics reporting engine",
                "generate_reports": "Compile PDF and Excel audits",
                "remote_control": "Trigger remote command execution on agents",
                "restart_device": "Power cycle active endpoints",
                "shutdown_device": "Power off active endpoints",
                "manage_alerts": "Acknowledge and configure alerts",
                "manage_policies": "Set device registry enforcement rules",
                "create_roles": "Configure custom security roles",
                "delete_roles": "Decommission security roles"
            }
            
            perms_models = {}
            for name, desc in perms_dict.items():
                p = Permission(name=name, description=desc)
                db.add(p)
                perms_models[name] = p
            db.commit()

            print("Seeding enterprise role templates...")
            roles_defs = {
                "Super Administrator": list(perms_dict.keys()),
                "Administrator": list(perms_dict.keys()),
                "Viewer": ["view_dashboard", "view_tickets"]
            }

            for role_name, p_names in roles_defs.items():
                role_perms = [perms_models[pn] for pn in p_names if pn in perms_models]
                r = Role(name=role_name, description=f"Default role for {role_name}", permissions=role_perms)
                db.add(r)
            db.commit()

        # Database cleanup: Purge Technician role and reassign associations
        tech_roles = db.query(Role).filter(Role.name.in_([
            "IT Manager", "Network Engineer", "System Administrator", 
            "SupportFlow Technician", "Security Analyst", "Asset Manager", "Auditor", "Technician"
        ])).all()
        
        tech_role_ids = [r.id for r in tech_roles]
        if tech_role_ids:
            print("Cleaning up custom/legacy technician roles and reassigning tickets...")
            # Reassign any tickets assigned to legacy technician users to None (unassigned)
            tickets_assigned = db.query(Ticket).filter(Ticket.assigned_to_id.in_(
                db.query(User.id).filter(User.role_id.in_(tech_role_ids))
            )).all()
            for tk in tickets_assigned:
                tk.assigned_to_id = None
            
            # Delete mock user 'tech@supportflow.com'
            tech_user = db.query(User).filter(User.email == "tech@supportflow.com").first()
            if tech_user:
                db.delete(tech_user)
            
            # Reassign other custom staff users to Administrator role
            admin_role_obj = db.query(Role).filter(Role.name == "Administrator").first()
            other_users = db.query(User).filter(User.role_id.in_(tech_role_ids)).all()
            for u in other_users:
                if admin_role_obj:
                    u.role_id = admin_role_obj.id
                else:
                    db.delete(u)
            
            # Delete legacy role items
            for r in tech_roles:
                db.delete(r)
            db.commit()

    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise IT Support and Real-time Infrastructure Monitoring Suite",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public Health Check
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# WebSocket Real-time Telemetry Gateway
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    db: Session = SessionLocal()
    user = None
    try:
        token = token or websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001)
            return
        
        from jose import jwt
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            email: str = payload.get("sub")
            if email is None:
                await websocket.close(code=4002)
                return
            user = db.query(User).filter(User.email == email).first()
            if not user or not user.is_active:
                await websocket.close(code=4003)
                return
        except Exception:
            await websocket.close(code=4004)
            return

        await manager.connect(websocket, user.id)
        
        await websocket.send_json({
            "type": "online_users_list",
            "users": list(manager.online_users)
        })
        
        while True:
            data = await websocket.receive_text()
            try:
                packet = json.loads(data)
                packet_type = packet.get("type")
                if packet_type == "typing":
                    ticket_id = packet.get("ticket_id")
                    typing_status = packet.get("typing")
                    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                    if ticket:
                        message = {
                            "type": "typing",
                            "ticket_id": ticket_id,
                            "user_id": user.id,
                            "user_name": user.full_name,
                            "typing": typing_status
                        }
                        participant_ids = manager.get_ticket_participant_ids(ticket, db)
                        for p_id in participant_ids:
                            if p_id != user.id:
                                await manager.send_to_user(p_id, message)
                elif packet_type == "read":
                    ticket_id = packet.get("ticket_id")
                    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                    if ticket:
                        unread_messages = db.query(TicketMessage).filter(
                            TicketMessage.ticket_id == ticket_id,
                            TicketMessage.sender_id != user.id,
                            TicketMessage.is_read == False
                        ).all()
                        now = datetime.utcnow()
                        for msg in unread_messages:
                            msg.is_read = True
                            msg.read_at = now
                        db.commit()
                        
                        message = {
                            "type": "messages_read",
                            "ticket_id": ticket_id,
                            "reader_id": user.id,
                            "read_at": now.isoformat()
                        }
                        await manager.send_to_ticket_participants(ticket, message, db)
            except Exception as e:
                print(f"Error handling WS client packet: {e}")
    except WebSocketDisconnect:
        if user:
            await manager.disconnect(websocket, user.id)
    except Exception as e:
        print(f"WebSocket session error: {e}")
        if user:
            await manager.disconnect(websocket, user.id)
    finally:
        db.close()

# Event triggers
@app.on_event("startup")
async def startup_event():
    # Execute database column upgrades if missing
    db = SessionLocal()
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("ticket_messages")]
        
        if "is_read" not in columns:
            print("Upgrading database: adding is_read to ticket_messages...")
            db.execute(text("ALTER TABLE ticket_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE NOT NULL"))
        if "read_at" not in columns:
            print("Upgrading database: adding read_at to ticket_messages...")
            db.execute(text("ALTER TABLE ticket_messages ADD COLUMN read_at TIMESTAMP"))
        if "message_type" not in columns:
            print("Upgrading database: adding message_type to ticket_messages...")
            db.execute(text("ALTER TABLE ticket_messages ADD COLUMN message_type VARCHAR DEFAULT 'text' NOT NULL"))
        db.commit()
    except Exception as e:
        print(f"Error running database upgrades: {e}")
    finally:
        db.close()

    seed_database()
    scheduler.start_scheduler()
    print("SupportFlow backend server successfully initialized and monitoring scheduler running.")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown_scheduler()
    print("SupportFlow scheduler shutdown complete.")

# Include Endpoint Controllers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(system.router, prefix=f"{settings.API_V1_STR}/system", tags=["System Diagnostics"])
app.include_router(network.router, prefix=f"{settings.API_V1_STR}/network", tags=["Network Utilities"])
app.include_router(diagnostics.router, prefix=f"{settings.API_V1_STR}/diagnostics", tags=["One-Click Checkups"])
app.include_router(software.router, prefix=f"{settings.API_V1_STR}/software", tags=["Installed Software"])
app.include_router(tickets.router, prefix=f"{settings.API_V1_STR}/tickets", tags=["SupportFlow System"])
app.include_router(assets.router, prefix=f"{settings.API_V1_STR}/assets", tags=["Infrastructure Inventory"])

# Double-mounting Reports to support both /api/reports and /api/v1/reports
app.include_router(reports.router, prefix="/api/reports", tags=["Reports Exporters"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reports Exporters"])

# Double-mounting Preferences to support both /api/user/preferences and /api/v1/user/preferences
app.include_router(preferences.router, prefix="/api/user", tags=["User Preferences"])
app.include_router(preferences.router, prefix=f"{settings.API_V1_STR}/user", tags=["User Preferences"])

app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["System Alert Logs"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users Management"])
app.include_router(endpoints.router, prefix=f"{settings.API_V1_STR}/agents", tags=["Remote Agents Monitoring"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["Notifications"])
