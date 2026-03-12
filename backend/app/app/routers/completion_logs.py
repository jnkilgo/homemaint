from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich_log(log: models.CompletionLog) -> schemas.LogOut:
    out = schemas.LogOut.model_validate(log)
    if log.user:
        out.user_display_name = log.user.display_name
    if log.contractor:
        out.contractor_name = log.contractor.name
    if log.task:
        out.task_name = log.task.name
        out.interval_type = log.task.interval_type
        if log.task.asset:
            out.asset_name = log.task.asset.name
            if log.task.asset.property:
                out.property_name = log.task.asset.property.name
    elif log.asset:
        out.asset_name = log.asset.name
        if log.asset.property:
            out.property_name = log.asset.property.name
    return out


@router.get("/", response_model=List[schemas.LogOut])
def list_logs(
    task_id: int = None,
    asset_id: int = None,
    property_id: int = None,
    contractor_id: int = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    q = db.query(models.CompletionLog).order_by(models.CompletionLog.completed_at.desc())

    if task_id:
        q = q.filter(models.CompletionLog.task_id == task_id)
    elif asset_id:
        task_ids = [t.id for t in db.query(models.Task).filter(models.Task.asset_id == asset_id).all()]
        q = q.filter(
            (models.CompletionLog.task_id.in_(task_ids)) |
            (models.CompletionLog.asset_id == asset_id)
        )
    elif property_id:
        asset_ids = [a.id for a in db.query(models.Asset).filter(models.Asset.property_id == property_id).all()]
        task_ids = [t.id for t in db.query(models.Task).filter(models.Task.asset_id.in_(asset_ids)).all()]
        q = q.filter(models.CompletionLog.task_id.in_(task_ids))
    elif contractor_id:
        q = q.filter(models.CompletionLog.contractor_id == contractor_id)

    return [_enrich_log(l) for l in q.limit(limit).all()]


@router.post("/", response_model=schemas.LogOut)
def log_completion(payload: schemas.LogCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    completed_at = payload.completed_at or datetime.utcnow()

    if payload.task_id:
        task = db.query(models.Task).filter(models.Task.id == payload.task_id).first()
        if not task:
            raise HTTPException(404, "Task not found")

        # Decrement spare if used
        if payload.spare_used_id:
            spare = db.query(models.SpareInventory).filter(models.SpareInventory.id == payload.spare_used_id).first()
            if spare and spare.quantity > 0:
                spare.quantity -= 1

        log = models.CompletionLog(
            task_id=payload.task_id,
            user_id=current.id,
            completed_at=completed_at,
            note=payload.note,
            description=payload.description,
            contractor_id=payload.contractor_id,
            cost=payload.cost,
            spare_used_id=payload.spare_used_id,
            usage_value=payload.usage_value,
        )

        # Update task's last_completed fields
        task.last_completed_at = completed_at
        task.last_completed_by = current.id
        if payload.usage_value is not None:
            task.last_usage_value = payload.usage_value
            asset = task.asset
            if task.interval_type == "hours":
                asset.current_hours = payload.usage_value
            elif task.interval_type == "miles":
                asset.current_miles = payload.usage_value

    else:
        # Freeform entry — must have asset_id and description
        if not payload.asset_id:
            raise HTTPException(400, "asset_id required for freeform log entries")
        asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
        if not asset:
            raise HTTPException(404, "Asset not found")

        log = models.CompletionLog(
            task_id=None,
            asset_id=payload.asset_id,
            user_id=current.id,
            completed_at=completed_at,
            note=payload.note,
            description=payload.description,
            contractor_id=payload.contractor_id,
            cost=payload.cost,
            usage_value=payload.usage_value,
        )

        # Update asset usage if provided
        if payload.usage_value is not None:
            asset.current_hours = payload.usage_value if asset.current_hours else asset.current_hours
            asset.current_miles = payload.usage_value if asset.current_miles else asset.current_miles

    db.add(log)
    db.commit()
    db.refresh(log)
    return _enrich_log(log)


@router.patch("/{log_id}", response_model=schemas.LogOut)
def update_log(log_id: int, payload: schemas.LogUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    log = db.query(models.CompletionLog).filter(models.CompletionLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Log not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(log, k, v)
    db.commit()
    db.refresh(log)
    return _enrich_log(log)


@router.delete("/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Admins only — completion logs are immutable for members."""
    log = db.query(models.CompletionLog).filter(models.CompletionLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Log not found")
    db.delete(log)
    db.commit()
    return {"ok": True}


@router.get("/summary/annual")
def annual_cost_summary(property_id: int = None, year: int = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Annual maintenance spend per property, broken down by asset."""
    from sqlalchemy import extract, func

    year = year or datetime.utcnow().year
    q = db.query(models.CompletionLog).filter(
        extract("year", models.CompletionLog.completed_at) == year,
        models.CompletionLog.cost != None
    )

    logs = q.all()
    summary = {}

    for log in logs:
        if not log.task or not log.task.asset:
            continue
        asset = log.task.asset
        prop = asset.property
        if property_id and prop.id != property_id:
            continue

        prop_key = prop.name
        asset_key = asset.name

        if prop_key not in summary:
            summary[prop_key] = {"total": 0.0, "assets": {}}
        if asset_key not in summary[prop_key]["assets"]:
            summary[prop_key]["assets"][asset_key] = 0.0

        summary[prop_key]["assets"][asset_key] += log.cost or 0
        summary[prop_key]["total"] += log.cost or 0

    return {"year": year, "summary": summary}
