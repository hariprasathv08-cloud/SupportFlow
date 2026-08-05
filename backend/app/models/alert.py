from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True)
    category = Column(String, nullable=False)  # CPU, RAM, Disk, Firewall, Defender, Internet, Update, Connection
    severity = Column(String, nullable=False)  # Warning, Critical
    message = Column(String, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    asset = relationship("Asset", back_populates="alerts")
