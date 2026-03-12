from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app import models

router = APIRouter()

@router.get('/')
def get_logs(asset_id: int = None, limit: int = 50, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if asset_id:
        logs = (
            db.query(models.UsageLog)
            .filter(models.UsageLog.asset_id == asset_id)
            .order_by(models.UsageLog.recorded_at.desc())
            .limit(limit)
            .all()
        )
        return logs
    return []
