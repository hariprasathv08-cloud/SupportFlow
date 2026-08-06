from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertResolve
from app.core.dependencies import get_current_active_user, PermissionChecker
from app.core.scopes import get_scoped_alerts

router = APIRouter()

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = get_scoped_alerts(db, current_user)
    return query.order_by(Alert.created_at.desc()).all()

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    payload: AlertResolve,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_alerts"))
):
    alert = get_scoped_alerts(db, current_user).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=403, detail="Not authorized to access this alert")
        
    alert.resolved = payload.resolved
    if payload.resolved:
        alert.resolved_at = datetime.utcnow()
    else:
        alert.resolved_at = None
        
    db.commit()
    db.refresh(alert)
    return alert
