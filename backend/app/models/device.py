from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    cpu_usage = Column(Float, nullable=False)
    ram_usage = Column(Float, nullable=False)
    disk_usage = Column(Float, nullable=False)
    disk_free_gb = Column(Float, nullable=True)
    cpu_temp = Column(Float, nullable=True)
    
    processes = Column(JSON, nullable=True)
    services = Column(JSON, nullable=True)
    software = Column(JSON, nullable=True)
    network_interfaces = Column(JSON, nullable=True)
    docker_containers = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="telemetry_history")
