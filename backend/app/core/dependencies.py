from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Role, Permission
from app.schemas.user import TokenData
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login-form")

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active or current_user.status in ["Suspended", "Locked", "Disabled"]:
        raise HTTPException(status_code=400, detail="Account is inactive, suspended, locked, or disabled")
    return current_user

class PermissionChecker:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
        role_name = current_user.role
        if role_name == "SUPER_ADMIN":
            return current_user

        role_obj = current_user.role_obj
        if not role_obj and role_name:
            role_obj = db.query(Role).filter(Role.name == role_name).first()

        if not role_obj:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role has no defined permissions."
            )

        permissions = [p.name for p in role_obj.permissions]
        if self.required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not possess authorization for this action."
            )
        return current_user

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_active_user)):
        role_name = current_user.role
        if role_name in ["Super Administrator", "Admin", "SUPER_ADMIN"]:
            return current_user
            
        if role_name not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not possess authorization for this action"
            )
        return current_user
