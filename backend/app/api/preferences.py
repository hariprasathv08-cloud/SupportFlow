from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.preferences import UserPreferences
from app.models.user import User
from app.schemas.preferences import UserPreferencesResponse, UserPreferencesUpdate
from app.core.dependencies import get_current_active_user

router = APIRouter()

@router.get("/preferences", response_model=UserPreferencesResponse)
def get_user_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(
            user_id=current_user.id,
            theme="system",
            language="en",
            timezone="UTC",
            sidebar_state="expanded",
            density="normal",
            notification_preferences="all"
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs

@router.put("/preferences", response_model=UserPreferencesResponse)
def update_user_preferences(
    prefs_in: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(
            user_id=current_user.id,
            theme="system",
            language="en",
            timezone="UTC",
            sidebar_state="expanded",
            density="normal",
            notification_preferences="all"
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
        
    update_data = prefs_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)
        
    db.commit()
    db.refresh(prefs)
    return prefs
