from datetime import datetime, timedelta
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.user import User, Role
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.core.websocket import manager
from app.schemas.user import UserCreate, UserResponse, Token
from app.core import security
from app.core.dependencies import get_current_active_user
from jose import jwt

router = APIRouter()

logger = logging.getLogger("auth_performance")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("[%(asctime)s] %(name)s: %(message)s"))
    logger.addHandler(ch)

class UserLoginSchema(BaseModel):
    email: str # supports username or email
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str

class ChangePasswordSchema(BaseModel):
    old_password: str
    new_password: str

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    # Normalize email/username to avoid duplicates
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this corporate email already exists."
        )
    username_val = user_in.username or user_in.email.split("@")[0]
    existing_username = db.query(User).filter(User.username == username_val).first()
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists."
        )

    # First user automatically becomes SUPER_ADMIN if empty
    is_first_user = db.query(User).count() == 0
    
    # Check if creator has admin privileges
    is_admin_creator = False
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        try:
            from app.config import settings
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            email = payload.get("sub")
            if email:
                caller = db.query(User).filter(User.email == email).first()
                if caller and (caller.role == "SUPER_ADMIN" or caller.role == "ORGANIZATION_ADMIN"):
                    is_admin_creator = True
        except Exception:
            pass

    target_role_id = None
    role_name = "EMPLOYEE"

    if is_first_user:
        role_name = "SUPER_ADMIN"
    else:
        # Override requested role to EMPLOYEE if caller is not an admin
        req_role = user_in.role
        if is_admin_creator and req_role:
            role_name = req_role
        else:
            role_name = "EMPLOYEE"

    role_obj = db.query(Role).filter(Role.name == role_name).first()
    if not role_obj:
        role_obj = Role(name=role_name, description=f"Auto-created template for {role_name}")
        db.add(role_obj)
        db.commit()
        db.refresh(role_obj)
    target_role_id = role_obj.id

    hashed_pwd = security.get_password_hash(user_in.password)

    db_user = User(
        email=user_in.email,
        username=username_val,
        hashed_password=hashed_pwd,
        password_hash=hashed_pwd,
        full_name=user_in.full_name,
        role_id=target_role_id,
        role=role_name,
        is_active=user_in.is_active,
        status="Active",
        avatar=user_in.avatar or f"https://api.dicebear.com/7.x/initials/svg?seed={user_in.full_name}",
        department=user_in.department,
        job_title=user_in.job_title,
        phone=user_in.phone,
        manager=user_in.manager,
        force_password_change=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    audit = AuditLog(
        action="User Created",
        user_id=db_user.id,
        details=f"User {db_user.email} registered. Initial Role: {role_name}"
    )
    db.add(audit)
    db.commit()

    return db_user

def process_user_login(user: User, password_input: str, request: Request, db: Session) -> dict:
    from app.config import settings
    # 1. Lockout verification
    if user.status == "Locked":
        if user.lockout_until and user.lockout_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account locked out due to security policy"
            )
        else:
            # Lockout expired, reset attempts
            user.status = "Active"
            user.failed_login_attempts = 0
            user.lockout_until = None
            db.commit()

    # 2. Status verification
    if user.status in ["Suspended", "Disabled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Account is {user.status.lower()}"
        )
    if user.status == "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account registration is pending approval"
        )

    # 3. Password verification
    is_password_valid = security.verify_password(password_input, user.hashed_password)
    if not is_password_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.status = "Locked"
            user.lockout_until = datetime.utcnow() + timedelta(minutes=15)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )

    # Reset attempts on successful authentication
    user.failed_login_attempts = 0
    user.lockout_until = None
    user.last_login = datetime.utcnow()
    user.last_active = datetime.utcnow()

    role_name = user.role
    access_token = security.create_access_token(subject=user.email, role=role_name)
    refresh_token = security.create_access_token(
        subject=user.email, role=role_name, expires_delta=timedelta(days=30)
    )

    from app.models.session_log import SessionLog
    session_log = SessionLog(
        user_id=user.id,
        organization_id=user.organization_id,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        status="Active"
    )
    db.add(session_log)

    audit = AuditLog(
        action="Login",
        user_id=user.id,
        organization_id=user.organization_id,
        details=f"Successful login for {user.email}"
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": role_name,
        "full_name": user.full_name,
        "refresh_token": refresh_token,
        "force_password_change": user.force_password_change
    }

@router.post("/login", response_model=Token)
def login(login_data: UserLoginSchema, request: Request, db: Session = Depends(get_db)):
    is_email = "@" in login_data.email
    if is_email:
        user = db.query(User).filter(User.email == login_data.email).first()
    else:
        user = db.query(User).filter(User.username == login_data.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )

    return process_user_login(user, login_data.password, request, db)

@router.post("/login-form", response_model=Token)
def login_form(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    is_email = "@" in form_data.username
    if is_email:
        user = db.query(User).filter(User.email == form_data.username).first()
    else:
        user = db.query(User).filter(User.username == form_data.username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )

    return process_user_login(user, form_data.password, request, db)

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Account with this email does not exist."
        )

    # Generate password reset token (signed JWT)
    from app.config import settings
    reset_token = security.create_access_token(
        subject=user.email,
        role=user.role,
        expires_delta=timedelta(minutes=15)
    )

    db.add(AuditLog(action="Password Reset Requested", user_id=user.id, details=f"Forgot password reset link generated for {user.email}"))
    db.commit()
    return {
        "message": "Password reset link has been dispatched to your email.",
        "reset_token": reset_token
    }

@router.post("/reset-password")
def reset_password(data: ResetPasswordSchema, db: Session = Depends(get_db)):
    try:
        from app.config import settings
        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token payload")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    # Hash and save new password
    hashed_pw = security.get_password_hash(data.new_password)
    user.hashed_password = hashed_pw
    user.password_hash = hashed_pw
    user.force_password_change = False
    db.commit()

    db.add(AuditLog(action="Password Reset Completed", user_id=user.id, details=f"Password successfully reset via token for {user.email}"))
    db.commit()
    return {"message": "Password successfully reset. You can now log in."}

@router.post("/change-password")
def change_password(data: ChangePasswordSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    is_old_valid = security.verify_password(data.old_password, current_user.hashed_password)
    if not is_old_valid:
        raise HTTPException(status_code=400, detail="Incorrect current password")

    hashed_pw = security.get_password_hash(data.new_password)
    current_user.hashed_password = hashed_pw
    current_user.password_hash = hashed_pw
    current_user.force_password_change = False
    db.commit()

    db.add(AuditLog(action="Password Changed", user_id=current_user.id, details=f"Password changed successfully by {current_user.email}"))
    db.commit()
    return {"message": "Password changed successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.post("/refresh", response_model=Token)
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        from app.config import settings
        payload = jwt.decode(data.refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
        
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active or user.status in ["Suspended", "Locked", "Disabled"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive or disabled")
        
    access_token = security.create_access_token(subject=user.email, role=user.role)
    new_refresh_token = security.create_access_token(
        subject=user.email, role=user.role, expires_delta=timedelta(days=30)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
        "refresh_token": new_refresh_token,
        "force_password_change": user.force_password_change
    }

@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    from app.models.session_log import SessionLog
    active_sessions = db.query(SessionLog).filter(
        SessionLog.user_id == current_user.id,
        SessionLog.status == "Active"
    ).all()
    for sess in active_sessions:
        sess.status = "Ended"
        sess.logout_time = datetime.utcnow()
    
    audit = AuditLog(
        action="Logout",
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        details=f"Successful logout for {current_user.email}"
    )
    db.add(audit)
    db.commit()
    return {"message": "Logged out successfully"}
