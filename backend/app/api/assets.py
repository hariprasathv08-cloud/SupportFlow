from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import random

from app.database import get_db
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse
from app.core.dependencies import get_current_active_user, PermissionChecker

from app.core.scopes import get_scoped_assets

router = APIRouter()

@router.get("", response_model=List[AssetResponse])
def list_assets(
    hostname: Optional[str] = None,
    serial_number: Optional[str] = None,
    mac_address: Optional[str] = None,
    ip_address: Optional[str] = None,
    status: Optional[str] = None,
    os: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = get_scoped_assets(db, current_user)
    
    if hostname:
        query = query.filter(Asset.hostname.ilike(f"%{hostname}%"))
    if serial_number:
        query = query.filter(Asset.serial_number == serial_number)
    if mac_address:
        query = query.filter(Asset.mac_address == mac_address)
    if ip_address:
        query = query.filter(Asset.ip_address == ip_address)
    if status:
        query = query.filter(Asset.status == status)
    if os:
        query = query.filter(Asset.operating_system.ilike(f"%{os}%"))
        
    return query.all()

@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset_in: AssetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_assets"))
):
    # Check duplicate serial
    if asset_in.serial_number:
        dup = db.query(Asset).filter(Asset.serial_number == asset_in.serial_number).first()
        if dup:
            raise HTTPException(
                status_code=400,
                detail="Serial Number already registered in database."
            )
            
    # Generate unique UUID & Tag
    new_uuid = asset_in.uuid or str(uuid.uuid4())
    asset_tag = f"HDX-{new_uuid[:8].upper()}"

    creator_role = current_user.role.name if hasattr(current_user.role, "name") else str(current_user.role)
    org_id = current_user.organization_id if creator_role != "SUPER_ADMIN" else asset_in.organization_id
    dept_id = current_user.department_id if creator_role in ["IT_ADMIN", "HR_ADMIN"] else asset_in.department_id

    db_asset = Asset(
        uuid=new_uuid,
        asset_tag=asset_tag,
        asset_name=asset_in.asset_name or asset_in.hostname,
        hostname=asset_in.hostname,
        operating_system=asset_in.operating_system,
        type=asset_in.type,
        serial_number=asset_in.serial_number,
        manufacturer=asset_in.manufacturer,
        model=asset_in.model,
        ip_address=asset_in.ip_address,
        mac_address=asset_in.mac_address,
        department=asset_in.department or "IT Support",
        location=asset_in.location or "HQ",
        warranty=asset_in.warranty or "Active - 3 Years",
        purchase_date=asset_in.purchase_date,
        organization_id=org_id,
        department_id=dept_id,
        status="Offline",  # manually added assets start offline until agent registers
        health_score=100
    )
    
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@router.get("/{asset_id_val}", response_model=AssetResponse)
def get_asset(
    asset_id_val: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == asset_id_val).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to view this asset details")
    return asset

@router.put("/{asset_id_val}", response_model=AssetResponse)
def update_asset(
    asset_id_val: int,
    asset_up: AssetUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("manage_assets"))
):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == asset_id_val).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to modify this asset")
        
    for field, val in asset_up.dict(exclude_unset=True).items():
        setattr(asset, field, val)
        
    db.commit()
    db.refresh(asset)
    return asset

@router.delete("/{asset_id_val}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id_val: int,
    db: Session = Depends(get_db),
    current_user=Depends(PermissionChecker("delete_assets"))
):
    asset = get_scoped_assets(db, current_user).filter(Asset.id == asset_id_val).first()
    if not asset:
        raise HTTPException(status_code=403, detail="Not authorized to delete this asset")
    db.delete(asset)
    db.commit()
    return None
