from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.auth import get_current_user
from app import models, schemas
from app.task_engine import get_task_status

router = APIRouter()


def _get_user_asset_or_404(asset_id: int, user: models.User, db: Session) -> models.Asset:
    """Fetch an asset by ID, enforcing ownership via property chain."""
    asset = (
        db.query(models.Asset)
        .join(models.Property, models.Asset.property_id == models.Property.id)
        .filter(models.Asset.id == asset_id, models.Property.user_id == user.id)
        .first()
    )
    if not asset:
        raise HTTPException(404, "Asset not found")
    return asset


def _enrich_asset(asset: models.Asset) -> schemas.AssetOut:
    out = schemas.AssetOut.model_validate(asset)
    overdue = sum(1 for t in asset.tasks if get_task_status(t, asset)[0] == "overdue")
    due_soon = sum(1 for t in asset.tasks if get_task_status(t, asset)[0] in ("due_soon", "snoozed"))
    out.task_count = len(asset.tasks)
    out.overdue_count = overdue
    out.due_soon_count = due_soon

    if asset.install_date:
        out.age_years = round((date.today() - asset.install_date).days / 365.25, 1)
        if asset.expected_lifespan_years:
            years_left = asset.expected_lifespan_years - out.age_years
            out.replacement_due_soon = years_left <= 2

    return out


@router.get("/", response_model=List[schemas.AssetOut])
def list_assets(property_id: int = None, db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = (
        db.query(models.Asset)
        .join(models.Property, models.Asset.property_id == models.Property.id)
        .filter(models.Property.user_id == current.id)
    )
    if property_id:
        q = q.filter(models.Asset.property_id == property_id)
    return [_enrich_asset(a) for a in q.all()]


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = _get_user_asset_or_404(asset_id, current, db)
    return _enrich_asset(asset)


@router.post("/", response_model=schemas.AssetOut)
def create_asset(payload: schemas.AssetCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    # Verify the target property belongs to current user
    prop = db.query(models.Property).filter(
        models.Property.id == payload.property_id,
        models.Property.user_id == current.id,
    ).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    asset = models.Asset(**payload.model_dump())
    db.add(asset)
    db.flush()
    db.commit()
    db.refresh(asset)
    return _enrich_asset(asset)


@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(asset_id: int, payload: schemas.AssetUpdate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = _get_user_asset_or_404(asset_id, current, db)
    data = payload.model_dump()
    if data.get("custom_fields") is not None:
        data["custom_fields"] = __import__("json").dumps(data["custom_fields"])
    elif "custom_fields" in data:
        data["custom_fields"] = None
    for k, v in data.items():
        setattr(asset, k, v)
    db.flush()
    db.commit()
    db.refresh(asset)
    return _enrich_asset(asset)


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = _get_user_asset_or_404(asset_id, current, db)
    db.delete(asset)
    db.flush()
    db.commit()
    return {"ok": True}


@router.put("/{asset_id}/usage", response_model=schemas.AssetOut)
def update_usage(asset_id: int, payload: schemas.UsageLogCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = _get_user_asset_or_404(asset_id, current, db)
    asset.current_hours = payload.value
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
def get_usage_logs(asset_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    _get_user_asset_or_404(asset_id, current, db)  # ownership check
    logs = (
        db.query(models.UsageLog)
        .filter(models.UsageLog.asset_id == asset_id)
        .order_by(models.UsageLog.recorded_at.desc())
        .limit(50)
        .all()
    )
    return logs


@router.delete("/{asset_id}/usage_logs/{log_id}", status_code=204)
def delete_usage_log(asset_id: int, log_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    _get_user_asset_or_404(asset_id, current, db)  # ownership check
    log = db.query(models.UsageLog).filter(
        models.UsageLog.id == log_id,
        models.UsageLog.asset_id == asset_id,
    ).first()
    if not log:
        raise HTTPException(404, "Usage log not found")
    db.delete(log)
    db.commit()
