from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.database import Base

class ReportTask(Base):
    __tablename__ = "report_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String, nullable=False)
    formats = Column(String, nullable=False) # comma-separated like "pdf,excel"
    delivery = Column(String, nullable=False) # download, email, both
    emails = Column(String, nullable=True) # comma-separated emails
    date_range = Column(String, nullable=False)
    status = Column(String, default="Queued", nullable=False) # Queued, Generating, Compressing, Sending, Completed, Failed
    progress = Column(Integer, default=0, nullable=False)
    error_message = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
