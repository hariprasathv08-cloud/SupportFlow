from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# Join table for Role-Permission (Many-to-Many)
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
)

# Join table for User-Permission (Many-to-Many override permissions)
user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
)

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    is_custom = Column(Boolean, default=False, nullable=False)

    permissions = relationship("Permission", secondary=role_permissions, lazy="joined")
    users = relationship("User", back_populates="role_obj")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    
    # IAM profile details
    department = Column(String, default="IT Support", nullable=True)
    job_title = Column(String, default="IT Analyst", nullable=True)
    phone = Column(String, nullable=True)
    manager = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="Active", nullable=False) # Active, Suspended, Lockout
    
    # Multi-factor Auth
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String, nullable=True)
    
    # Audit timestamps
    last_login = Column(DateTime, nullable=True)
    last_active = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    role_obj = relationship("Role", back_populates="users", lazy="joined")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="joined")
    
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    role = Column(String, default="EMPLOYEE", nullable=True)
    device_uuid = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    password_hash = Column(String, nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    lockout_until = Column(DateTime, nullable=True)
    force_password_change = Column(Boolean, default=False, nullable=False)

    organization = relationship("Organization")
    department_relation = relationship("Department")

    # Direct custom permissions override
    custom_permissions = relationship("Permission", secondary=user_permissions, lazy="joined")

    @property
    def role_detail(self):
        return self.role_obj
