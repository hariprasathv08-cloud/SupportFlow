from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertResolve
from app.core.dependencies import get_current_active_user, RoleChecker

router = APIRouter()

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = db.query(Alert)
    if current_user.role == "Viewer":
        from app.models.asset import Asset
        asset = db.query(Asset).filter(Asset.assigned_user_id == current_user.id).first()
        if asset:
            query = query.filter(Alert.asset_id == asset.id)
        else:
            return []
    return query.order_by(Alert.created_at.desc()).all()

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    payload: AlertResolve,
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(allowed_roles=["Admin", "Super Administrator", "Administrator"]))
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.resolved = payload.resolved
    if payload.resolved:
        alert.resolved_at = datetime.utcnow()
    else:
        alert.resolved_at = None
        
    db.commit()
    db.refresh(alert)
    return alert
