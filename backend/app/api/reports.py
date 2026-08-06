from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.models.ticket import Ticket
from app.models.alert import Alert
from app.models.software import Software
from app.models.audit import AuditLog
from app.models.report_task import ReportTask
from app.services import report_gen
from app.core.dependencies import oauth2_scheme
from jose import jwt
from app.config import settings

router = APIRouter()

# Helper dependency to authenticate from headers OR query parameter
async def get_current_user_reports(
    db: Session = Depends(get_db),
    token: Optional[str] = Query(None, description="Auth token for reports download"),
    auth_header: Optional[str] = Depends(oauth2_scheme)
) -> User:
    actual_token = token
    if not actual_token and auth_header:
        actual_token = auth_header
    
    if not actual_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        if actual_token.startswith("Bearer "):
            actual_token = actual_token.split(" ")[1]
        payload = jwt.decode(actual_token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
        
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    return user

from app.core.scopes import get_scoped_assets, get_scoped_tickets, get_scoped_software, get_scoped_alerts, get_scoped_users

# Endpoint to fetch counts for disabling report options
@router.get("/status")
def get_reports_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_reports)
):
    total_assets = get_scoped_assets(db, current_user).count()
    total_tickets = get_scoped_tickets(db, current_user).count()
    total_software = get_scoped_software(db, current_user).count()
    total_alerts = get_scoped_alerts(db, current_user).count()
    total_users = get_scoped_users(db, current_user).count()
    
    dashboard_available = (total_assets > 0 or total_tickets > 0 or total_users > 0)
    
    return {
        "dashboard": dashboard_available,
        "assets": total_assets,
        "tickets": total_tickets,
        "software": total_software,
        "network": total_assets,
        "users": total_users,
        "alerts": total_alerts,
        "system_health": total_assets
    }

class ReportGenerationRequest(BaseModel):
    report_type: str
    formats: List[str]
    delivery: str
    emails: Optional[List[str]] = None
    date_range: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    include_charts: bool = False
    include_raw_data: bool = True

def run_report_generation(task_id: str, req_data: dict, user_id: int):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        task = db.query(ReportTask).filter(ReportTask.task_id == task_id).first()
        if not task:
            return
            
        task.status = "Generating"
        task.progress = 20
        db.commit()
        
        # Resolve user permissions
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        
        from app.core.scopes import get_scoped_assets, get_scoped_tickets, get_scoped_software, get_scoped_alerts, get_scoped_users

        def get_assets_query():
            return get_scoped_assets(db, user)
            
        def get_tickets_query():
            return get_scoped_tickets(db, user)
            
        def get_alerts_query():
            return get_scoped_alerts(db, user)
            
        def get_software_query():
            return get_scoped_software(db, user)
            
        def get_users_query():
            return get_scoped_users(db, user)

        # Create output directory
        out_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "generated_reports")
        os.makedirs(out_dir, exist_ok=True)
        
        report_type = req_data.get("report_type")
        formats = req_data.get("formats", ["pdf"])
        date_range = req_data.get("date_range", "today")
        
        generated_filenames = []
        
        for fmt in formats:
            date_str = datetime.now().strftime("%Y-%m-%d")
            ext = "xlsx" if fmt == "excel" else fmt
            clean_type = report_type.replace(" ", "_")
            filename = f"{clean_type}_{date_str}.{ext}"
            file_path = os.path.join(out_dir, filename)
            
            file_bytes = b""
            
            if report_type == "Complete Enterprise Report":
                if fmt == "pdf":
                    file_bytes = report_gen.generate_complete_enterprise_pdf(db, date_range, user_id)
                elif fmt == "excel":
                    file_bytes = report_gen.generate_complete_enterprise_excel(db, date_range, user_id)
                elif fmt == "csv":
                    headers = ["Enterprise Operations Summary Indicator", "Count"]
                    rows = [
                        ["Endpoints Managed", get_assets_query().count()],
                        ["Tickets backlog", get_tickets_query().count()],
                        ["Unresolved alerts", get_alerts_query().filter(Alert.resolved == False).count()],
                        ["Users count", get_users_query().count()]
                    ]
                    csv_str = report_gen.generate_csv_report(headers, rows)
                    file_bytes = csv_str.encode('utf-8')
            else:
                if report_type == "Dashboard Summary":
                    if fmt == "pdf":
                        summary_data = {
                            "total_assets": get_assets_query().count(),
                            "total_tickets": get_tickets_query().count(),
                            "resolved_tickets": get_tickets_query().filter(Ticket.status == "Resolved").count(),
                            "critical_alerts": get_alerts_query().filter(Alert.resolved == False, Alert.severity == "Critical").count(),
                            "total_users": get_users_query().count()
                        }
                        tickets_list = get_tickets_query().order_by(Ticket.created_at.desc()).limit(5).all()
                        recent_tickets = [
                            [t.id, t.title, t.category, t.priority, t.status, t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else '']
                            for t in tickets_list
                        ]
                        alerts_list = get_alerts_query().filter(Alert.resolved == False).order_by(Alert.created_at.desc()).limit(5).all()
                        active_alerts = [
                            [a.id, a.asset.hostname if a.asset else 'Local Host', a.category, a.severity, a.message, a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else '']
                            for a in alerts_list
                        ]
                        file_bytes = report_gen.generate_dashboard_pdf(summary_data, recent_tickets, active_alerts)
                    else:
                        headers = ["Metric", "Count"]
                        rows = [
                            ["Assets Monitored", get_assets_query().count()],
                            ["Total Tickets", get_tickets_query().count()],
                            ["Active alerts", get_alerts_query().filter(Alert.resolved == False).count()]
                        ]
                        if fmt == "excel":
                            file_bytes = report_gen.generate_excel_report("Dashboard_Summary", headers, rows)
                        else:
                            csv_str = report_gen.generate_csv_report(headers, rows)
                            file_bytes = csv_str.encode('utf-8')
                elif report_type == "Assets":
                    assets = get_assets_query().all()
                    headers = ["ID", "Asset Tag", "Hostname", "Type", "Status", "Health Score"]
                    rows = [[a.id, a.asset_tag, a.hostname or 'N/A', a.type or 'Workstation', a.status, f"{a.health_score}%"] for a in assets]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Assets Inventory", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Assets_Inventory", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "Tickets":
                    tickets = get_tickets_query().all()
                    headers = ["ID", "Title", "Priority", "Status", "Created At"]
                    rows = [[t.id, t.title, t.priority, t.status, t.created_at.strftime("%Y-%m-%d") if t.created_at else ''] for t in tickets]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Tickets Audit", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Tickets_Audit", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "Software Inventory":
                    software = get_software_query().all()
                    headers = ["ID", "Host", "Name", "Version", "Publisher"]
                    rows = [[s.id, s.asset.hostname if s.asset else s.endpoint_uuid, s.name, s.version or 'N/A', s.publisher or 'N/A'] for s in software]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Software Audit", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Software_Audit", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "Network":
                    assets = get_assets_query().all()
                    headers = ["Hostname", "IP Address", "MAC Address", "Status"]
                    rows = [[a.hostname or 'N/A', a.ip_address or 'N/A', a.mac_address or 'N/A', a.status] for a in assets]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Network Telemetry", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Network_Telemetry", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "System Health":
                    assets = get_assets_query().all()
                    headers = ["Hostname", "CPU Usage", "RAM Usage", "Disk Usage", "Health Score"]
                    rows = [[a.hostname or 'N/A', f"{a.cpu_usage}%", f"{a.ram_usage}%", f"{a.disk_usage}%", f"{a.health_score}%"] for a in assets]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("System Health Diagnostics", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("System_Health_Diagnostics", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "Users":
                    users = get_users_query().all()
                    headers = ["ID", "Full Name", "Email", "Role", "Status"]
                    rows = [[u.id, u.full_name, u.email, u.role, u.status] for u in users]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Users Ledger", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Users_Ledger", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
                elif report_type == "Alerts":
                    alerts = get_alerts_query().all()
                    headers = ["ID", "Category", "Severity", "Message", "Resolved"]
                    rows = [[al.id, al.category, al.severity, al.message, "Resolved" if al.resolved else "Active"] for al in alerts]
                    if fmt == "pdf":
                        file_bytes = report_gen.generate_pdf_report("Vulnerabilities Alerts", headers, rows)
                    elif fmt == "excel":
                        file_bytes = report_gen.generate_excel_report("Vulnerabilities_Alerts", headers, rows)
                    else:
                        csv_str = report_gen.generate_csv_report(headers, rows)
                        file_bytes = csv_str.encode('utf-8')
            
            with open(file_path, "wb") as f:
                f.write(file_bytes)
                
            generated_filenames.append(filename)

        task.status = "Compressing"
        task.progress = 60
        db.commit()
        
        import time as time_sleep
        time_sleep.sleep(0.5)

        delivery = req_data.get("delivery")
        if delivery in ["email", "both"]:
            task.status = "Sending"
            task.progress = 80
            db.commit()
            
            emails = req_data.get("emails", [])
            full_paths = [os.path.join(out_dir, f) for f in generated_filenames]
            report_gen.send_report_email(emails, full_paths, report_type)

        task.status = "Completed"
        task.progress = 100
        task.file_path = ",".join(generated_filenames)
        task.completed_at = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        print(f"Background Report Task Error: {e}")
        try:
            task = db.query(ReportTask).filter(ReportTask.task_id == task_id).first()
            if task:
                task.status = "Failed"
                task.progress = 0
                task.error_message = str(e)
                db.commit()
        except:
            pass
    finally:
        db.close()

from app.schemas.report_task import ReportTaskResponse

@router.post("/generate", response_model=ReportTaskResponse)
def generate_report(
    req: ReportGenerationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_reports)
):
    task_id = str(uuid.uuid4())
    db_task = ReportTask(
        task_id=task_id,
        user_id=current_user.id,
        report_type=req.report_type,
        formats=",".join(req.formats),
        delivery=req.delivery,
        emails=",".join(req.emails) if req.emails else None,
        date_range=req.date_range,
        status="Queued",
        progress=0
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    background_tasks.add_task(run_report_generation, task_id, req.dict(), current_user.id)
    
    return db_task

@router.get("/tasks/{task_id}", response_model=ReportTaskResponse)
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_reports)
):
    task = db.query(ReportTask).filter(ReportTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/history", response_model=List[ReportTaskResponse])
def get_task_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_reports)
):
    return db.query(ReportTask).filter(ReportTask.user_id == current_user.id).order_by(ReportTask.created_at.desc()).all()

@router.get("/download/{filename}")
def download_file(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_reports)
):
    out_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "generated_reports")
    file_path = os.path.join(out_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="application/octet-stream", filename=filename)
