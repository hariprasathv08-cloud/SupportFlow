from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String, default="system", nullable=False) # dark, light, system
    language = Column(String, default="en", nullable=False)
    timezone = Column(String, default="UTC", nullable=False)
    sidebar_state = Column(String, default="expanded", nullable=False) # expanded, collapsed
    density = Column(String, default="normal", nullable=False) # normal, compact
    notification_preferences = Column(String, default="all", nullable=False) # all, critical, none

    user = relationship("User", back_populates="preferences")
