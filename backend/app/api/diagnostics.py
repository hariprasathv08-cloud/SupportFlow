from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from app.schemas.system import DiagnosticsResult
from app.services import pc_health
from app.core.dependencies import get_current_active_user
from app.database import get_db
from app.models.asset import Asset
from app.core.websocket import manager

router = APIRouter()

@router.post("/run", response_model=DiagnosticsResult)
async def run_diagnostics(
    device_id: Optional[int] = None,
    bypass_cache: bool = True,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    # Enforce access boundaries:
    if current_user.role == "Viewer":
        asset = db.query(Asset).filter(Asset.assigned_user_id == current_user.id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No monitored endpoint connected. Install the endpoint agent to perform diagnostics."
            )
        target_device_id = asset.id
    else:
        if device_id is not None:
            asset = db.query(Asset).filter(Asset.id == device_id).first()
            if not asset:
                raise HTTPException(status_code=404, detail="Device not found")
            target_device_id = device_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No monitored endpoint connected. Please specify a device ID."
            )

    async def ws_callback(packet: dict):
        await manager.broadcast(packet)

    return await pc_health.run_pc_health_check_async(
        device_id=target_device_id,
        db=db,
        bypass_cache=bypass_cache,
        broadcast_callback=ws_callback
    )
