from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import random

from app.database import get_db
from app.models.user import User, Role, Permission
from app.models.audit import AuditLog
from app.schemas.user import (
    UserResponse, UserCreate, UserUpdate, 
    RoleResponse, PermissionResponse, AuditLogResponse
)
from app.core.dependencies import get_current_active_user, PermissionChecker
from app.core.security import get_password_hash

router = APIRouter()

from app.core.scopes import get_scoped_users

# --- Users Endpoints ---
@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return get_scoped_users(db, current_user).all()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    # Check if duplicate email
    dup = db.query(User).filter(User.email == user_in.email).first()
    if dup:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
        
    hashed_pwd = get_password_hash(user_in.password)
    username_val = user_in.username or user_in.email.split("@")[0]
    
    target_role_id = user_in.role_id
    if not target_role_id and user_in.role:
        role_obj = db.query(Role).filter(Role.name == user_in.role).first()
        if not role_obj:
            role_obj = Role(name=user_in.role, description=f"Auto-created template for {user_in.role}")
            db.add(role_obj)
            db.commit()
            db.refresh(role_obj)
        target_role_id = role_obj.id

    creator_role = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    if creator_role != "SUPER_ADMIN":
        org_id = current_user.organization_id
        dept_id = current_user.department_id if creator_role == "HR_ADMIN" else user_in.department_id
    else:
        org_id = user_in.organization_id
        dept_id = user_in.department_id
    
    db_user = User(
        email=user_in.email,
        username=username_val,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        role_id=target_role_id,
        is_active=user_in.is_active,
        status=user_in.status or "Active",
        avatar=user_in.avatar or f"https://api.dicebear.com/7.x/initials/svg?seed={user_in.full_name}",
        department=user_in.department,
        job_title=user_in.job_title,
        phone=user_in.phone,
        manager=user_in.manager,
        organization_id=org_id,
        department_id=dept_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    db.add(AuditLog(
        action="User Created", 
        user_id=current_user.id, 
        organization_id=current_user.organization_id,
        details=f"Admin created user: {db_user.email} (Role ID: {db_user.role_id})"
    ))
    db.commit()
    return db_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_up: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_role_id = user.role_id
    old_status = user.status

    for field, val in user_up.dict(exclude_unset=True).items():
        if field == "password" and val:
            user.hashed_password = get_password_hash(val)
        else:
            setattr(user, field, val)
            
    db.commit()
    db.refresh(user)

    # Audits
    if old_role_id != user.role_id:
        db.add(AuditLog(
            action="Role Change", 
            user_id=current_user.id, 
            details=f"Changed user {user.email} role from ID {old_role_id} to {user.role_id}"
        ))
    if old_status != user.status:
        db.add(AuditLog(
            action="Permission Change", 
            user_id=current_user.id, 
            details=f"Changed user {user.email} status from {old_status} to {user.status}"
        ))
    db.commit()
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot self-delete logged-in account.")

    db.add(AuditLog(
        action="User Deleted", 
        user_id=current_user.id, 
        details=f"Admin deleted user: {user.email}"
    ))
    db.delete(user)
    db.commit()
    return None

# --- Roles & Permissions Endpoints ---
@router.get("/roles/list", response_model=List[RoleResponse])
def get_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return db.query(Role).all()

@router.post("/roles/create", response_model=RoleResponse)
def create_role(
    name: str,
    description: Optional[str] = None,
    permission_ids: List[int] = Query([]),
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    dup = db.query(Role).filter(Role.name == name).first()
    if dup:
        raise HTTPException(status_code=400, detail="Role name already registered.")
        
    permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
    new_role = Role(
        name=name,
        description=description,
        is_custom=True,
        permissions=permissions
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    db.add(AuditLog(
        action="Role Created", 
        user_id=current_user.id, 
        details=f"Custom role created: {name} with {len(permissions)} permissions."
    ))
    db.commit()
    return new_role

@router.get("/permissions/list", response_model=List[PermissionResponse])
def get_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return db.query(Permission).all()

# --- Audit Logs Endpoint ---
@router.get("/audit-logs/list", response_model=List[AuditLogResponse])
def get_audit_logs_list(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    from app.core.scopes import get_scoped_audits
    return get_scoped_audits(db, current_user).order_by(AuditLog.created_at.desc()).all()

@router.get("/session-logs/list")
def get_session_logs(
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    from app.core.scopes import get_scoped_sessions
    from app.models.session_log import SessionLog
    sessions = get_scoped_sessions(db, current_user).order_by(SessionLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "username": s.user.username if s.user else "System",
            "email": s.user.email if s.user else "N/A",
            "ip_address": s.ip_address or "N/A",
            "user_agent": s.user_agent or "N/A",
            "login_time": s.login_time.isoformat() if s.login_time else None,
            "logout_time": s.logout_time.isoformat() if s.logout_time else None,
            "status": s.status
        }
        for s in sessions
    ]

# --- Bulk Actions ---
@router.post("/bulk-delete")
def bulk_delete_users(
    user_ids: List[int],
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    from app.core.scopes import get_scoped_users
    users_to_del = get_scoped_users(db, current_user).filter(User.id.in_(user_ids), User.id != current_user.id).all()
    count = len(users_to_del)
    for u in users_to_del:
        db.delete(u)
        
    db.add(AuditLog(
        action="User Deleted", 
        user_id=current_user.id, 
        organization_id=current_user.organization_id,
        details=f"Bulk deleted {count} users."
    ))
    db.commit()
    return {"message": f"Successfully deleted {count} users."}

@router.post("/bulk-status")
def bulk_status_users(
    user_ids: List[int],
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    from app.core.scopes import get_scoped_users
    users_to_up = get_scoped_users(db, current_user).filter(User.id.in_(user_ids)).all()
    for u in users_to_up:
        u.status = status
        
    db.add(AuditLog(
        action="Permission Change", 
        user_id=current_user.id, 
        organization_id=current_user.organization_id,
        details=f"Bulk updated {len(users_to_up)} users to status: {status}"
    ))
    db.commit()
    return {"message": f"Successfully updated status for {len(users_to_up)} users."}

# --- Identity Provider Integrations (AD / LDAP Simulators) ---
@router.post("/ad-sync")
def sync_active_directory(
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    # Simulate directory query
    ad_users = [
        {"email": "carol.danvers@supportflow.com", "full_name": "Carol Danvers", "title": "Security Analyst", "dept": "Security Operations"},
        {"email": "bruce.banner@supportflow.com", "full_name": "Bruce Banner", "title": "IT Manager", "dept": "Infrastructure Systems"}
    ]
    
    viewer_role = db.query(Role).filter(Role.name == "VIEWER").first()
    synced = 0
    for u in ad_users:
        exists = db.query(User).filter(User.email == u["email"]).first()
        if not exists:
            new_u = User(
                email=u["email"],
                username=u["email"].split("@")[0],
                hashed_password=get_password_hash("ADTempPass123!"),
                full_name=u["full_name"],
                role_id=viewer_role.id if viewer_role else None,
                job_title=u["title"],
                department=u["dept"],
                avatar=f"https://api.dicebear.com/7.x/initials/svg?seed={u['full_name']}"
            )
            db.add(new_u)
            synced += 1
            
    if synced > 0:
        db.add(AuditLog(action="User Created", user_id=current_user.id, details=f"Synced {synced} users from Active Directory."))
        db.commit()
        
    return {"message": f"Active Directory synchronization finished. Synced {synced} new accounts."}

@router.post("/csv-import")
def import_csv_users(
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    # Simulates CSV reading
    csv_users = [
        {"email": "peter.parker@supportflow.com", "full_name": "Peter Parker", "title": "IT Administrator", "dept": "IT Support"},
    ]
    admin_role = db.query(Role).filter(Role.name == "IT_ADMIN").first()
    synced = 0
    for u in csv_users:
        exists = db.query(User).filter(User.email == u["email"]).first()
        if not exists:
            new_u = User(
                email=u["email"],
                username=u["email"].split("@")[0],
                hashed_password=get_password_hash("CSVTempPass123!"),
                full_name=u["full_name"],
                role_id=admin_role.id if admin_role else None,
                job_title=u["title"],
                department=u["dept"],
                organization_id=current_user.organization_id,
                avatar=f"https://api.dicebear.com/7.x/initials/svg?seed={u['full_name']}"
            )
            db.add(new_u)
            synced += 1
            
    if synced > 0:
        db.commit()
    return {"message": f"CSV import finished. Imported {synced} new users."}

@router.get("/audits", response_model=List[AuditLogResponse])
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_users"))
):
    from app.core.scopes import get_scoped_audit_logs
    return get_scoped_audit_logs(db, current_user).order_by(AuditLog.created_at.desc()).limit(50).all()
