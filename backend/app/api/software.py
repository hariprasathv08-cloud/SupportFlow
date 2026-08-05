from fastapi import APIRouter, Depends
from typing import List
from app.schemas.system import SoftwareItem
from app.services import system_info
from app.core.dependencies import get_current_active_user

router = APIRouter()

@router.get("", response_model=List[SoftwareItem])
def get_software(current_user=Depends(get_current_active_user)):
    return system_info.get_installed_software()
