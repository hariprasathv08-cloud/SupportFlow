from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
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

class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this corporate email already exists."
        )

    # First user automatically becomes Super Administrator if no role is explicitly selected
    is_first_user = db.query(User).count() == 0
    target_role_id = user_in.role_id
    role_name = user_in.role or "Viewer"

    if is_first_user and not user_in.role_id and (not user_in.role or user_in.role == "Viewer"):
        super_role = db.query(Role).filter(Role.name == "Super Administrator").first()
        if not super_role:
            super_role = Role(name="Super Administrator", description="Root control role")
            db.add(super_role)
            db.commit()
            db.refresh(super_role)
        target_role_id = super_role.id
        role_name = "Super Administrator"
    else:
        # Resolve normal role name or lookup role by name string
        if target_role_id:
            role_obj = db.query(Role).filter(Role.id == target_role_id).first()
            if role_obj:
                role_name = role_obj.name
        elif user_in.role:
            role_obj = db.query(Role).filter(Role.name == user_in.role).first()
            if not role_obj:
                role_obj = Role(name=user_in.role, description=f"Auto-created template for {user_in.role}")
                db.add(role_obj)
                db.commit()
                db.refresh(role_obj)
            target_role_id = role_obj.id
            role_name = role_obj.name
        else:
            default_role = db.query(Role).filter(Role.name == "Viewer").first()
            if default_role:
                target_role_id = default_role.id
                role_name = default_role.name

    hashed_pwd = security.get_password_hash(user_in.password)
    username_val = user_in.username or user_in.email.split("@")[0]
    
    db_user = User(
        email=user_in.email,
        username=username_val,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        role_id=target_role_id,
        is_active=user_in.is_active,
        status="Active",
        avatar=user_in.avatar or f"https://api.dicebear.com/7.x/initials/svg?seed={user_in.full_name}",
        department=user_in.department,
        job_title=user_in.job_title,
        phone=user_in.phone,
        manager=user_in.manager
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Log Audit
    audit = AuditLog(
        action="User Created",
        user_id=db_user.id,
        details=f"User {db_user.email} registered. Initial Role: {role_name}"
    )
    db.add(audit)
    db.commit()

    # Dispatch notifications to Admins
    admins = db.query(User).join(Role).filter(Role.name.in_(["Admin", "Super Administrator", "Administrator"])).all()
    notifs = []
    for admin in admins:
        notif = Notification(
            user_id=admin.id,
            title="New User Registered",
            message=f"A new user {db_user.full_name} ({db_user.email}) has registered with role {role_name}.",
            category="user_registered",
            is_read=False
        )
        db.add(notif)
        notifs.append((admin.id, notif))
    db.commit()
    
    for admin_id, notif in notifs:
        try:
            db.refresh(notif)
            await manager.send_to_user(admin_id, {
                "type": "notification",
                "notification": {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "category": notif.category,
                    "is_read": notif.is_read,
                    "created_at": notif.created_at.isoformat()
                }
            })
        except Exception:
            pass

    return db_user

import time
import logging

logger = logging.getLogger("auth_performance")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("[%(asctime)s] %(name)s: %(message)s"))
    logger.addHandler(ch)

@router.post("/login", response_model=Token)
def login(login_data: UserLoginSchema, db: Session = Depends(get_db)):
    start_total = time.perf_counter()
    
    # 1. Fast db existence check to avoid full table count scan
    start_db = time.perf_counter()
    no_users = db.query(User.id).first() is None
    db_query_time = time.perf_counter() - start_db
    
    if no_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No corporate accounts exist in the directory. Please toggle 'Create an organization staff account' below to sign up."
        )
    
    # 2. Get user details via indexed lookup
    start_user_db = time.perf_counter()
    user = db.query(User).filter(User.email == login_data.email).first()
    db_user_query_time = time.perf_counter() - start_user_db
    
    total_db_time = db_query_time + db_user_query_time

    # 3. Bcrypt password verification (efficiently only once)
    start_auth = time.perf_counter()
    is_password_valid = user and security.verify_password(login_data.password, user.hashed_password)
    auth_time = time.perf_counter() - start_auth
    
    if not is_password_valid:
        logger.info(
            f"Failed Login Trace for {login_data.email}:\n"
            f"  - Database lookups: {total_db_time:.4f}s\n"
            f"  - Bcrypt check: {auth_time:.4f}s"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    
    if not user.is_active or user.status == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive or suspended user account"
        )
    if user.status == "Lockout":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account locked out due to security policy"
        )
        
    # 4. Generate JWT access token
    start_jwt = time.perf_counter()
    role_name = user.role
    access_token = security.create_access_token(
        subject=user.email, role=role_name
    )
    refresh_token = security.create_access_token(
        subject=user.email, role=role_name, expires_delta=timedelta(days=30)
    )
    jwt_time = time.perf_counter() - start_jwt
    
    # Audit and timestamp login (DB write)
    user.last_login = datetime.utcnow()
    user.last_active = datetime.utcnow()
    
    audit = AuditLog(
        action="Login",
        user_id=user.id,
        details=f"Successful login for {user.email}"
    )
    db.add(audit)
    db.commit()
    
    total_time = time.perf_counter() - start_total
    
    logger.info(
        f"Login Performance Trace for {login_data.email}:\n"
        f"  - Database lookups time: {total_db_time:.4f}s\n"
        f"  - Password verification (bcrypt) time: {auth_time:.4f}s\n"
        f"  - JWT generation time: {jwt_time:.4f}s\n"
        f"  - Total Login Endpoint time: {total_time:.4f}s"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": role_name,
        "full_name": user.full_name,
        "refresh_token": refresh_token
    }

@router.post("/login-form", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    start_total = time.perf_counter()
    
    # 1. Fast db existence check to avoid full table count scan
    start_db = time.perf_counter()
    no_users = db.query(User.id).first() is None
    db_query_time = time.perf_counter() - start_db
    
    if no_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No corporate accounts exist in the directory. Please toggle 'Create an organization staff account' below to sign up."
        )
    
    # 2. Get user details via indexed lookup
    start_user_db = time.perf_counter()
    user = db.query(User).filter(User.email == form_data.username).first()
    db_user_query_time = time.perf_counter() - start_user_db
    
    total_db_time = db_query_time + db_user_query_time

    # 3. Bcrypt password verification (efficiently only once)
    start_auth = time.perf_counter()
    is_password_valid = user and security.verify_password(form_data.password, user.hashed_password)
    auth_time = time.perf_counter() - start_auth
    
    if not is_password_valid:
        logger.info(
            f"Failed Form Login Trace for {form_data.username}:\n"
            f"  - Database lookups: {total_db_time:.4f}s\n"
            f"  - Bcrypt check: {auth_time:.4f}s"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
        
    if not user.is_active or user.status == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive or suspended user account"
        )
    if user.status == "Lockout":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account locked out due to security policy"
        )
        
    # 4. Generate JWT access token
    start_jwt = time.perf_counter()
    role_name = user.role
    # 4. Generate JWT access token
    start_jwt = time.perf_counter()
    role_name = user.role
    access_token = security.create_access_token(
        subject=user.email, role=role_name
    )
    refresh_token = security.create_access_token(
        subject=user.email, role=role_name, expires_delta=timedelta(days=30)
    )
    jwt_time = time.perf_counter() - start_jwt
    
    # Audit and timestamp login (DB write)
    user.last_login = datetime.utcnow()
    user.last_active = datetime.utcnow()
    db.add(AuditLog(action="Login", user_id=user.id, details=f"Form OAuth login for {user.email}"))
    db.commit()
    
    total_time = time.perf_counter() - start_total
    
    logger.info(
        f"Form Login Performance Trace for {form_data.username}:\n"
        f"  - Database lookups time: {total_db_time:.4f}s\n"
        f"  - Password verification (bcrypt) time: {auth_time:.4f}s\n"
        f"  - JWT generation time: {jwt_time:.4f}s\n"
        f"  - Total Form Login Endpoint time: {total_time:.4f}s"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": role_name,
        "full_name": user.full_name,
        "refresh_token": refresh_token
    }

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Account with this email does not exist."
        )
    print(f"PASSWORD RESET REQUEST FOR USER: {data.email}")
    db.add(AuditLog(action="Password Change", user_id=user.id, details=f"Forgot password reset link dispatched to {user.email}"))
    db.commit()
    return {"message": "Password reset link has been dispatched to your email."}

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
    if user is None or not user.is_active or user.status == "Suspended":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive or suspended")
        
    access_token = security.create_access_token(subject=user.email, role=user.role)
    new_refresh_token = security.create_access_token(
        subject=user.email, role=user.role, expires_delta=timedelta(days=30)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
        "refresh_token": new_refresh_token
    }
