from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas
from app.task_engine import get_task_status

router = APIRouter()


def _enrich_asset(asset: models.Asset) -> schemas.AssetOut:
    out = schemas.AssetOut.model_validate(asset)
    overdue = sum(1 for t in asset.tasks if get_task_status(t, asset)[0] == "overdue")
    out.task_count = len(asset.tasks)
    due_soon = sum(1 for t in asset.tasks if get_task_status(t, asset)[0] in ("due_soon", "snoozed"))
    out.overdue_count = overdue
    out.due_soon_count = due_soon

    if asset.install_date:
        out.age_years = round((date.today() - asset.install_date).days / 365.25, 1)
        if asset.expected_lifespan_years:
            years_left = asset.expected_lifespan_years - out.age_years
            out.replacement_due_soon = years_left <= 2

    return out


@router.get("/", response_model=List[schemas.AssetOut])
def list_assets(property_id: int = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.Asset)
    if property_id:
        q = q.filter(models.Asset.property_id == property_id)
    return [_enrich_asset(a) for a in q.all()]


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    return _enrich_asset(asset)


@router.post("/", response_model=schemas.AssetOut)
def create_asset(payload: schemas.AssetCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    prop = db.query(models.Property).filter(models.Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    asset = models.Asset(**payload.model_dump())
    db.add(asset)
    db.flush()
    db.commit()
    db.refresh(asset)
    return _enrich_asset(asset)


@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(asset_id: int, payload: schemas.AssetUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    SKIP = set()
    data = {k: v for k, v in payload.model_dump().items() if k not in SKIP}
    if data.get('custom_fields') is not None:
        data['custom_fields'] = __import__('json').dumps(data['custom_fields'])
    elif 'custom_fields' in data:
        data['custom_fields'] = None
    for k, v in data.items():
        setattr(asset, k, v)
    db.flush()
    db.commit()
    db.refresh(asset)
    return _enrich_asset(asset)


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.flush()
    db.commit()
    return {"ok": True}


@router.put("/{asset_id}/usage", response_model=schemas.AssetOut)
def update_usage(asset_id: int, payload: schemas.UsageLogCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Update current hours or miles for a usage-tracked asset."""
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")

    # Determine if this is hours or miles based on existing data
    if True:
        asset.current_hours = payload.value
    else:
        asset.current_miles = payload.value

    # Log it
    log = models.UsageLog(
        asset_id=asset_id,
        value=payload.value,
        recorded_by=current.id,
        note=payload.note,
    )
    db.add(log)
    db.flush()
    db.commit()
    db.refresh(asset)
    return _enrich_asset(asset)

@router.get("/{asset_id}/usage_logs", response_model=List[schemas.UsageLogOut])
def get_usage_logs(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    logs = (
        db.query(models.UsageLog)
        .filter(models.UsageLog.asset_id == asset_id)
        .order_by(models.UsageLog.recorded_at.desc())
        .limit(50)
        .all()
    )
    return logs

@router.delete("/{asset_id}/usage_logs/{log_id}", status_code=204)
def delete_usage_log(asset_id: int, log_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    log = db.query(models.UsageLog).filter(
        models.UsageLog.id == log_id,
        models.UsageLog.asset_id == asset_id
    ).first()
    if not log:
        raise HTTPException(404, "Usage log not found")
    db.delete(log)
    db.commit()

