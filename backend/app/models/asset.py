from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True, nullable=False)
    asset_tag = Column(String, unique=True, index=True, nullable=False)
    asset_name = Column(String, nullable=True)
    
    # Auto-Discovered Hardware Specs
    hostname = Column(String, nullable=True)
    operating_system = Column(String, nullable=True) # Windows, Linux, macOS
    os_version = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    model = Column(String, nullable=True)
    serial_number = Column(String, unique=True, index=True, nullable=True)
    motherboard_serial = Column(String, nullable=True)
    bios_version = Column(String, nullable=True)
    cpu = Column(String, nullable=True)
    ram = Column(String, nullable=True)
    storage = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    current_user = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    type = Column(String, default="Workstation", nullable=True) # Laptop, Desktop, Printer, Router, Switch, Firewall, Monitor, Server, Virtual Machine
    
    # Custom Administration Fields
    department = Column(String, default="IT Support", nullable=True)
    location = Column(String, default="HQ", nullable=True)
    warranty = Column(String, default="Active - 3 Years", nullable=True)
    purchase_date = Column(DateTime, nullable=True)
    
    # Live Status Indicators
    status = Column(String, default="Online", nullable=False) # Online, Offline
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Snapshots
    health_score = Column(Integer, default=100)
    cpu_usage = Column(Float, default=0.0)
    ram_usage = Column(Float, default=0.0)
    disk_usage = Column(Float, default=0.0)
    uptime = Column(Float, default=0.0)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])

    # Relationships
    telemetry_history = relationship("Telemetry", back_populates="asset", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="asset", cascade="all, delete-orphan")
    software = relationship("Software", back_populates="asset", cascade="all, delete-orphan")
    software_history = relationship("SoftwareHistory", back_populates="asset", cascade="all, delete-orphan")
