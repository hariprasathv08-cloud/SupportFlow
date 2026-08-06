from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Software(Base):
    __tablename__ = "software"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    endpoint_uuid = Column(String, nullable=False)
    
    name = Column(String, index=True, nullable=False)
    version = Column(String, index=True, nullable=True)
    publisher = Column(String, index=True, nullable=True)
    architecture = Column(String, nullable=True)
    install_date = Column(String, nullable=True)
    install_size = Column(String, nullable=True)
    install_path = Column(String, nullable=True)
    executable = Column(String, nullable=True)
    package_manager = Column(String, nullable=True)
    license = Column(String, nullable=True)
    uninstall_command = Column(String, nullable=True)
    auto_update_enabled = Column(Boolean, default=False)
    security_status = Column(String, default="Secure") # "Secure", "Outdated", "Security Risk", "Requires Update"
    digital_signature = Column(String, default="Unsigned", nullable=True)
    dependencies = Column(Text, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    asset = relationship("Asset", back_populates="software")
    organization = relationship("Organization")

class SoftwareHistory(Base):
    __tablename__ = "software_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    software_name = Column(String, nullable=False)
    action = Column(String, nullable=False) # "Installed", "Upgraded", "Uninstalled"
    old_version = Column(String, nullable=True)
    new_version = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    asset = relationship("Asset", back_populates="software_history")
    organization = relationship("Organization")
