from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.scopes import get_scoped_software

router = APIRouter()

@router.get("")
def get_software(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    software_list = get_scoped_software(db, current_user).all()
    return [
        {
            "name": s.name,
            "version": s.version or "N/A",
            "publisher": s.publisher or "N/A",
            "install_date": s.install_date or "N/A"
        }
        for s in software_list
    ]
