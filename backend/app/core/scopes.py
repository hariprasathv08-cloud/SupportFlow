from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.ticket import Ticket
from app.models.alert import Alert
from app.models.software import Software
from app.models.user import User
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.organization import Organization

def get_scoped_assets(db: Session, user: User):
    # Retrieve role name
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Asset)
    
    query = db.query(Asset).filter(Asset.organization_id == user.organization_id)
    if role_name in ["IT_ADMIN", "HR_ADMIN"] and user.department_id is not None:
        query = query.filter(Asset.department_id == user.department_id)
    elif role_name == "EMPLOYEE":
        query = query.filter(Asset.assigned_user_id == user.id)
    return query

def get_scoped_tickets(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Ticket)
    
    query = db.query(Ticket).filter(Ticket.organization_id == user.organization_id)
    if role_name in ["IT_ADMIN", "HR_ADMIN"] and user.department_id is not None:
        query = query.filter(Ticket.department_id == user.department_id)
    elif role_name == "EMPLOYEE":
        query = query.filter(Ticket.created_by_id == user.id)
    return query

def get_scoped_alerts(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Alert)
    
    query = db.query(Alert).filter(Alert.organization_id == user.organization_id)
    if role_name in ["IT_ADMIN", "HR_ADMIN"] and user.department_id is not None:
        query = query.join(Asset).filter(Asset.department_id == user.department_id)
    elif role_name == "EMPLOYEE":
        query = query.join(Asset).filter(Asset.assigned_user_id == user.id)
    return query

def get_scoped_software(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Software)
    
    query = db.query(Software).filter(Software.organization_id == user.organization_id)
    if role_name in ["IT_ADMIN", "HR_ADMIN"] and user.department_id is not None:
        query = query.join(Asset).filter(Asset.department_id == user.department_id)
    elif role_name == "EMPLOYEE":
        query = query.join(Asset).filter(Asset.assigned_user_id == user.id)
    return query

def get_scoped_users(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(User)
    
    query = db.query(User).filter(User.organization_id == user.organization_id)
    if role_name in ["IT_ADMIN", "HR_ADMIN"] and user.department_id is not None:
        query = query.filter(User.department_id == user.department_id)
    elif role_name == "EMPLOYEE":
        query = query.filter(User.id == user.id)
    return query

def get_scoped_audit_logs(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(AuditLog)
    
    return db.query(AuditLog).filter(AuditLog.organization_id == user.organization_id)

def get_scoped_departments(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Department)
    
    return db.query(Department).filter(Department.organization_id == user.organization_id)

def get_scoped_organizations(db: Session, user: User):
    role_name = user.role.name if hasattr(user.role, "name") else str(user.role)
    if role_name == "SUPER_ADMIN":
        return db.query(Organization)
    
    return db.query(Organization).filter(Organization.id == user.organization_id)
