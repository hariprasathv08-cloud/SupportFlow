from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any

from app.schemas.system import SystemSpecs, ProcessInfo, ServiceInfo
from app.services import system_info
from app.core.dependencies import get_current_active_user, RoleChecker

router = APIRouter()

@router.get("/specs", response_model=SystemSpecs)
def get_specs(current_user=Depends(get_current_active_user)):
    return system_info.get_system_specs()

@router.get("/processes", response_model=List[ProcessInfo])
def get_processes(current_user=Depends(get_current_active_user)):
    return system_info.get_running_processes()

@router.get("/services", response_model=List[ServiceInfo])
def get_services(current_user=Depends(get_current_active_user)):
    return system_info.get_windows_services()

@router.post("/services/{service_name}/control")
def control_service(
    service_name: str,
    action: str = Query(..., regex="^(start|stop|restart)$"),
    current_user=Depends(RoleChecker(allowed_roles=["Admin", "Super Administrator", "Administrator"]))
):
    success = system_info.control_windows_service(service_name, action)
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to execute action '{action}' on service '{service_name}'."
        )
    return {"message": f"Successfully performed '{action}' on '{service_name}'."}
