import os
import shutil
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.ticket import Ticket, Comment, Attachment, TicketHistory, TicketMessage
from app.models.asset import Asset
from app.models.user import User, Role
from app.models.notification import Notification
from app.schemas.ticket import TicketCreate, TicketResponse, TicketUpdate, CommentResponse, TicketMessageResponse
from app.core.dependencies import get_current_active_user
from app.core.websocket import manager

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

from app.core.scopes import get_scoped_tickets

@router.get("", response_model=List[TicketResponse])
async def list_tickets(
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = get_scoped_tickets(db, current_user)
        
    if status_filter:
        query = query.filter(Ticket.status == status_filter)
    if priority_filter:
        query = query.filter(Ticket.priority == priority_filter)
        
    return query.order_by(Ticket.created_at.desc()).all()

@router.post("", response_model=TicketResponse)
async def create_ticket(
    ticket_in: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Locate user's active device asset from check-in database
    asset = db.query(Asset).filter(Asset.assigned_user_id == current_user.id).first()

    db_ticket = Ticket(
        title=ticket_in.title,
        description=ticket_in.description,
        category=ticket_in.category or "General",
        priority=ticket_in.priority,
        status="Open",
        assigned_to_id=ticket_in.assigned_to_id,
        created_by_id=current_user.id,
        due_date=ticket_in.due_date,
        organization_id=current_user.organization_id,
        department_id=current_user.department_id
    )

    # Attach live machine diagnostics automatically if found
    if asset:
        db_ticket.device_hostname = asset.hostname
        db_ticket.device_serial = asset.serial_number
        db_ticket.device_mac = asset.mac_address
        db_ticket.device_ip = asset.ip_address
        db_ticket.device_os = asset.operating_system
        db_ticket.device_cpu = asset.cpu
        db_ticket.device_ram = asset.ram
        db_ticket.device_disk = asset.storage
        db_ticket.device_user = asset.current_user
        db_ticket.device_uptime = str(round(asset.uptime, 1)) if asset.uptime else "0.0"
        db_ticket.device_location = asset.location or "HQ"
        db_ticket.device_internet_status = "Connected" if asset.status == "Online" else "Disconnected"

    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    # Log to history
    history = TicketHistory(
        ticket_id=db_ticket.id,
        user_id=current_user.id,
        action="Created ticket"
    )
    db.add(history)
    db.commit()
    db.refresh(db_ticket)

    # Email notification print log
    print(f"[MAIL SYSTEM] Ticket #{db_ticket.id} Created: '{db_ticket.title}'. Dispatched alerts to operations coordinators.")

    # Dispatch notifications to Admins of the same organization
    admins = db.query(User).join(Role).filter(
        Role.name.in_(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN"]),
        (User.organization_id == current_user.organization_id) | (Role.name == "SUPER_ADMIN")
    ).all()
    notifs = []
    for admin in admins:
        notif = Notification(
            user_id=admin.id,
            title="New Ticket Created",
            message=f"A new ticket #{db_ticket.id} '{db_ticket.title}' has been submitted by {current_user.full_name}.",
            category="ticket_created",
            ticket_id=db_ticket.id,
            is_read=False
        )
        db.add(notif)
        notifs.append((admin.id, notif))
    db.commit()
    
    for admin_id, notif in notifs:
        db.refresh(notif)
        await manager.send_to_user(admin_id, {
            "type": "notification",
            "notification": {
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "category": notif.category,
                "ticket_id": notif.ticket_id,
                "is_read": notif.is_read,
                "created_at": notif.created_at.isoformat()
            }
        })

    # Broadcast notification over WebSockets
    await manager.broadcast({
        "type": "new_ticket",
        "ticket": {
            "id": db_ticket.id,
            "title": db_ticket.title,
            "priority": db_ticket.priority,
            "created_by": current_user.full_name,
            "status": db_ticket.status
        }
    })

    return db_ticket

@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = get_scoped_tickets(db, current_user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
        
    return ticket

@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: int,
    ticket_up: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = get_scoped_tickets(db, current_user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=403, detail="Not authorized to update this ticket")

    changes = []
    old_status = ticket.status
    old_assigned = ticket.assigned_to_id
    
    if ticket_up.title is not None and ticket_up.title != ticket.title:
        changes.append(f"Updated title to '{ticket_up.title}'")
        ticket.title = ticket_up.title
        
    if ticket_up.description is not None and ticket_up.description != ticket.description:
        changes.append("Updated description")
        ticket.description = ticket_up.description
        
    if ticket_up.priority is not None and ticket_up.priority != ticket.priority:
        changes.append(f"Changed priority from {ticket.priority} to {ticket_up.priority}")
        ticket.priority = ticket_up.priority
        
    if ticket_up.status is not None and ticket_up.status != ticket.status:
        changes.append(f"Changed status from {ticket.status} to {ticket_up.status}")
        ticket.status = ticket_up.status
        
    if ticket_up.assigned_to_id is not None and ticket_up.assigned_to_id != ticket.assigned_to_id:
        tech = db.query(User).filter(User.id == ticket_up.assigned_to_id).first()
        tech_name = tech.full_name if tech else "Unassigned"
        changes.append(f"Reassigned ticket to {tech_name}")
        ticket.assigned_to_id = ticket_up.assigned_to_id
        
    if ticket_up.due_date is not None and ticket_up.due_date != ticket.due_date:
        changes.append(f"Updated due date to {ticket_up.due_date.strftime('%Y-%m-%d')}")
        ticket.due_date = ticket_up.due_date

    if changes:
        db.commit()
        # Log all changes in history
        for change in changes:
            history = TicketHistory(
                ticket_id=ticket.id,
                user_id=current_user.id,
                action=change
            )
            db.add(history)
        db.commit()
        
        # 1. Assignment notification dispatch
        if ticket_up.assigned_to_id is not None and ticket_up.assigned_to_id != old_assigned:
            tech = db.query(User).filter(User.id == ticket_up.assigned_to_id).first()
            tech_name = tech.full_name if tech else "Unassigned"
            
            # Notify tech
            if tech:
                notif_tech = Notification(
                    user_id=tech.id,
                    title="Assigned Ticket",
                    message=f"Ticket #{ticket.id} '{ticket.title}' has been assigned to you.",
                    category="ticket_assigned",
                    ticket_id=ticket.id,
                    is_read=False
                )
                db.add(notif_tech)
                
            # Notify employee (creator)
            notif_emp = Notification(
                user_id=ticket.created_by_id,
                title="Ticket Assigned",
                message=f"Your ticket #{ticket.id} '{ticket.title}' has been assigned to administrator {tech_name}.",
                category="ticket_assigned",
                ticket_id=ticket.id,
                is_read=False
            )
            db.add(notif_emp)

        # 2. Status notification dispatch
        if ticket_up.status is not None and ticket_up.status != old_status:
            if ticket.status in ["Resolved", "Closed"]:
                category = "resolved" if ticket.status == "Resolved" else "closed"
                title = f"Ticket {ticket.status}"
                message = f"Ticket #{ticket.id} '{ticket.title}' has been {ticket.status.lower()}."
                
                # Notify employee
                notif_emp = Notification(
                    user_id=ticket.created_by_id,
                    title=title,
                    message=message,
                    category=category,
                    ticket_id=ticket.id,
                    is_read=False
                )
                db.add(notif_emp)
                
                # Notify assigned tech
                if ticket.assigned_to_id:
                    notif_tech = Notification(
                        user_id=ticket.assigned_to_id,
                        title=title,
                        message=message,
                        category=category,
                        ticket_id=ticket.id,
                        is_read=False
                    )
                    db.add(notif_tech)
                    
        db.commit()
        db.refresh(ticket)

        # Dispatch websocket alerts for any new notifications
        recent_notifs = db.query(Notification).filter(Notification.ticket_id == ticket.id, Notification.is_read == False).all()
        for notif in recent_notifs:
            await manager.send_to_user(notif.user_id, {
                "type": "notification",
                "notification": {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "category": notif.category,
                    "ticket_id": notif.ticket_id,
                    "is_read": notif.is_read,
                    "created_at": notif.created_at.isoformat()
                }
            })

        # Dispatch simulated email logs for updates
        if old_status != ticket.status:
            print(f"[MAIL SYSTEM] Ticket #{ticket.id} status changed from '{old_status}' to '{ticket.status}'. Notified user {ticket.created_by.email}.")
        if old_assigned != ticket.assigned_to_id and ticket.assigned_to:
            print(f"[MAIL SYSTEM] Ticket #{ticket.id} assigned to Administrator {ticket.assigned_to.full_name}. Notified {ticket.assigned_to.email}.")

        # WebSocket broadcast for dashboard updates
        await manager.broadcast({
            "type": "ticket_update",
            "ticket_id": ticket.id,
            "status": ticket.status,
            "assigned_to": ticket.assigned_to.full_name if ticket.assigned_to else "Unassigned",
            "message": f"Ticket updated: {changes[0]}"
        })
        
    return ticket

@router.post("/{ticket_id}/comments-json", response_model=CommentResponse)
async def add_comment_json(
    ticket_id: int,
    comment_in: BaseModel, # We dynamically parse JSON content
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = get_scoped_tickets(db, current_user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=403, detail="Not authorized to edit this ticket")
        
    db_comment = Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        content=getattr(comment_in, "content", "")
    )
    db.add(db_comment)
    
    history = TicketHistory(
        ticket_id=ticket_id,
        user_id=current_user.id,
        action=f"Added comment"
    )
    db.add(history)
    db.commit()
    db.refresh(db_comment)
    return db_comment

@router.get("/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def list_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = get_scoped_tickets(db, current_user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=403, detail="Not authorized to read messages on this ticket")
        
    role_name = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    is_admin = role_name in ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN"]
    is_viewer = role_name == "EMPLOYEE"
        
    return db.query(TicketMessage).filter(TicketMessage.ticket_id == ticket_id).order_by(TicketMessage.created_at.asc()).all()

@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
async def send_ticket_message(
    ticket_id: int,
    message: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = get_scoped_tickets(db, current_user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=403, detail="Not authorized to communicate on this ticket")
        
    role_name = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    is_admin = role_name in ["SUPER_ADMIN", "ORGANIZATION_ADMIN", "IT_ADMIN", "HR_ADMIN"]
    is_viewer = role_name == "EMPLOYEE"

    file_path = None
    file_name = None
    message_type = "text"
    
    if file:
        file_name = file.filename
        safe_filename = f"{int(datetime.now().timestamp())}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        ext = file_name.split(".")[-1].lower()
        if ext in ["jpg", "jpeg", "png", "gif", "webp"]:
            message_type = "image"
        elif ext == "pdf":
            message_type = "pdf"
        elif ext in ["log", "txt"]:
            message_type = "log"
        else:
            message_type = "screenshot" if "screenshot" in file_name.lower() else "log"

    db_msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=message,
        file_path=file_path,
        file_name=file_name,
        message_type=message_type,
        is_read=False
    )
    db.add(db_msg)
    
    # Dispatch message notifications (Employee Reply to Tech, Tech/Admin Reply to Employee)
    if ticket.created_by_id == current_user.id:
        if ticket.assigned_to_id:
            notif = Notification(
                user_id=ticket.assigned_to_id,
                title="New Message from Employee",
                message=f"Employee {current_user.full_name} sent a message on ticket #{ticket.id}: {message}",
                category="reply",
                ticket_id=ticket.id,
                is_read=False
            )
            db.add(notif)
    else:
        notif = Notification(
            user_id=ticket.created_by_id,
            title="New Message from Support",
            message=f"Support team sent a message on ticket #{ticket.id}: {message}",
            category="reply",
            ticket_id=ticket.id,
            is_read=False
        )
        db.add(notif)
        
    db.commit()
    db.refresh(db_msg)

    # Broadcast message via WebSockets to participants
    ws_message = {
        "type": "ticket_message",
        "ticket_id": ticket_id,
        "message": {
            "id": db_msg.id,
            "sender": current_user.full_name,
            "sender_id": current_user.id,
            "message": db_msg.message,
            "file_name": db_msg.file_name,
            "file_path": db_msg.file_path,
            "is_read": db_msg.is_read,
            "read_at": db_msg.read_at.isoformat() if db_msg.read_at else None,
            "message_type": db_msg.message_type,
            "created_at": db_msg.created_at.isoformat()
        }
    }
    await manager.send_to_ticket_participants(ticket, ws_message, db)
    
    # Broadcast notification via WebSockets
    recent_notifs = db.query(Notification).filter(Notification.ticket_id == ticket.id, Notification.is_read == False).all()
    for n in recent_notifs:
        await manager.send_to_user(n.user_id, {
            "type": "notification",
            "notification": {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "category": n.category,
                "ticket_id": n.ticket_id,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat()
            }
        })

    return db_msg

@router.post("/{ticket_id}/chat/read")
async def mark_chat_messages_as_read(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    is_admin = current_user.role in ["Admin", "Super Administrator", "Administrator"]
    is_viewer = current_user.role == "Viewer"
    
    if is_viewer and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif not is_admin and not is_viewer:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    unread_messages = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket_id,
        TicketMessage.sender_id != current_user.id,
        TicketMessage.is_read == False
    ).all()
    now = datetime.utcnow()
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = now
    db.commit()
    
    # Broadcast read update to participants
    message = {
        "type": "messages_read",
        "ticket_id": ticket_id,
        "reader_id": current_user.id,
        "read_at": now.isoformat()
    }
    await manager.send_to_ticket_participants(ticket, message, db)
    
    return {"status": "ok", "marked_count": len(unread_messages)}


