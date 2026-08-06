import asyncio
import os
import json
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.core import scheduler
from app.core.websocket import manager
from app.core.security import get_password_hash
from app.models import User, Role, Permission, Asset, Ticket, Alert, AuditLog, Notification, TicketMessage, UserPreferences, Organization, Department, SessionLog

# API Routers
from app.api import auth, system, network, diagnostics, software, tickets, assets, reports, alerts, users, endpoints, notifications, preferences

# Initialize database tables
Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    try:
        # Run DB inspect-based migrations
        table_alters = {
            "users": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL"),
                ("department_id", "INTEGER REFERENCES departments(id) ON DELETE SET NULL"),
                ("password_hash", "VARCHAR"),
                ("role", "VARCHAR DEFAULT 'EMPLOYEE'"),
                ("device_uuid", "VARCHAR"),
                ("email_verified", "BOOLEAN DEFAULT FALSE"),
                ("updated_at", "TIMESTAMP"),
                ("failed_login_attempts", "INTEGER DEFAULT 0"),
                ("lockout_until", "TIMESTAMP"),
                ("force_password_change", "BOOLEAN DEFAULT FALSE")
            ],
            "assets": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL"),
                ("department_id", "INTEGER REFERENCES departments(id) ON DELETE SET NULL"),
                ("approval_status", "VARCHAR DEFAULT 'Pending'"),
                ("api_token", "VARCHAR UNIQUE")
            ],
            "tickets": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL"),
                ("department_id", "INTEGER REFERENCES departments(id) ON DELETE SET NULL")
            ],
            "alerts": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL")
            ],
            "software": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL")
            ],
            "software_history": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL")
            ],
            "audit_logs": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL")
            ],
            "report_tasks": [
                ("organization_id", "INTEGER REFERENCES organizations(id) ON DELETE SET NULL")
            ]
        }
        
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        for table_name, alters in table_alters.items():
            if not inspector.has_table(table_name):
                continue
            existing_cols = [c["name"] for c in inspector.get_columns(table_name)]
            for col_name, col_type in alters:
                if col_name not in existing_cols:
                    try:
                        db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                        db.commit()
                        print(f"[MIGRATION] Added column {col_name} to {table_name} table.")
                    except Exception as e:
                        db.rollback()
                        print(f"[MIGRATION] Failed to add column {col_name} to {table_name}: {e}")

        # Purge duplicate users by email and username
        try:
            db.execute(text("""
                DELETE FROM users 
                WHERE id NOT IN (
                    SELECT MIN(id) 
                    FROM users 
                    GROUP BY email
                )
            """))
            db.commit()
            db.execute(text("""
                DELETE FROM users 
                WHERE username IS NOT NULL AND id NOT IN (
                    SELECT MIN(id) 
                    FROM users 
                    GROUP BY username
                )
            """))
            db.commit()
            print("[CLEANUP] Purged duplicate user entries.")
        except Exception as e:
            db.rollback()
            print(f"[CLEANUP] Failed to purge duplicates: {e}")

        # Seed Organizations
        if db.query(Organization).count() == 0:
            print("Seeding multi-tenant organizations...")
            org1 = Organization(name="Acme Corporation", enrollment_key="acme-key-123")
            org2 = Organization(name="Globex Corporation", enrollment_key="globex-key-456")
            db.add(org1)
            db.add(org2)
            db.commit()

        # Seed Departments
        acme = db.query(Organization).filter(Organization.name == "Acme Corporation").first()
        if acme and db.query(Department).filter(Department.organization_id == acme.id).count() == 0:
            print("Seeding departments...")
            d_it = Department(name="IT Support", organization_id=acme.id)
            d_hr = Department(name="HR", organization_id=acme.id)
            d_eng = Department(name="Engineering", organization_id=acme.id)
            d_fin = Department(name="Finance", organization_id=acme.id)
            db.add(d_it)
            db.add(d_hr)
            db.add(d_eng)
            db.add(d_fin)
            db.commit()

        # Seed Permissions
        if db.query(Permission).count() == 0:
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
                "SUPER_ADMIN": list(perms_dict.keys()),
                "ORGANIZATION_ADMIN": list(perms_dict.keys()),
                "IT_ADMIN": ["view_dashboard", "edit_dashboard", "view_tickets", "assign_tickets", "resolve_tickets", "manage_assets", "delete_assets", "view_reports", "generate_reports", "remote_control", "restart_device", "shutdown_device", "manage_alerts"],
                "HR_ADMIN": ["manage_users", "view_tickets"],
                "VIEWER": ["view_dashboard", "manage_assets", "view_reports"],
                "EMPLOYEE": ["view_dashboard", "view_tickets"]
            }

            for role_name, p_names in roles_defs.items():
                role_perms = [perms_models[pn] for pn in p_names if pn in perms_models]
                r = Role(name=role_name, description=f"Default role for {role_name}", permissions=role_perms)
                db.add(r)
            db.commit()

        # Seed default users
        if db.query(User).count() == 0:
            print("Seeding default users...")
            r_super = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()

            # Read admin password from environment or force change on first login
            admin_pwd = os.environ.get("SUPPORTFLOW_ADMIN_PASSWORD")
            force_change = False
            if not admin_pwd:
                admin_pwd = "password"
                force_change = True

            hashed_pw = get_password_hash(admin_pwd)
            super_user = User(
                email="superadmin@supportflow.com",
                username="superadmin",
                hashed_password=hashed_pw,
                password_hash=hashed_pw,
                full_name="Super Admin",
                role_id=r_super.id if r_super else None,
                role="SUPER_ADMIN",
                status="Active",
                is_active=True,
                force_password_change=force_change
            )
            db.add(super_user)
            db.commit()
            print(f"[SEED] Seeded single SUPER_ADMIN user. Force password change: {force_change}")

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
                if packet_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
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
    # Run heavy database migrations, seeding, and scheduler startup in a background task
    async def init_db_background():
        db = SessionLocal()
        try:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            columns = [col["name"] for col in inspector.get_columns("ticket_messages")]
            
            db_upgrade_needed = False
            if "is_read" not in columns:
                print("Upgrading database: adding is_read to ticket_messages...")
                db.execute(text("ALTER TABLE ticket_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE NOT NULL"))
                db_upgrade_needed = True
            if "read_at" not in columns:
                print("Upgrading database: adding read_at to ticket_messages...")
                db.execute(text("ALTER TABLE ticket_messages ADD COLUMN read_at TIMESTAMP"))
                db_upgrade_needed = True
            if "message_type" not in columns:
                print("Upgrading database: adding message_type to ticket_messages...")
                db.execute(text("ALTER TABLE ticket_messages ADD COLUMN message_type VARCHAR DEFAULT 'text' NOT NULL"))
                db_upgrade_needed = True
            if db_upgrade_needed:
                db.commit()
        except Exception as e:
            print(f"Error running database upgrades: {e}")
        finally:
            db.close()

        seed_database()
        scheduler.start_scheduler()
        print("SupportFlow backend server successfully initialized and monitoring scheduler running in background.")

    asyncio.create_task(init_db_background())

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

# Serve React frontend static files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "frontend", "dist")

@app.exception_handler(404)
async def custom_404_handler(request, __):
    if not request.url.path.startswith("/api") and not request.url.path.startswith("/docs") and not request.url.path.startswith("/redoc"):
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

if os.path.exists(frontend_dir):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

