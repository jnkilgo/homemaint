from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas
from app.task_engine import enrich_task

router = APIRouter()


def _enrich(task: models.Task, db: Session = None) -> schemas.TaskOut:
    out = schemas.TaskOut.model_validate(task)
    # For mileage/hours tasks, use latest usage log value instead of baseline
    current_usage = None
    if task.interval_type in ("hours", "miles") and db is not None:
        latest_log = (
            db.query(models.UsageLog)
            .filter(models.UsageLog.asset_id == task.asset_id)
            .order_by(models.UsageLog.recorded_at.desc())
            .first()
        )
        if latest_log:
            current_usage = latest_log.value
    enriched = enrich_task(task, task.asset, current_usage)
    out.status = enriched["status"]
    out.days_until_due = enriched["days_until_due"]
    out.usage_until_due = enriched["usage_until_due"]
    out.task_parts = []
    for tp in (task.task_parts or []):
        out.task_parts.append(schemas.TaskPartOut(
            id=tp.id,
            task_id=tp.task_id,
            part_id=tp.part_id,
            part_name=tp.part.name if tp.part else None,
            part_number=tp.part.part_number if tp.part else None,
            part_qty=tp.part.qty_on_hand if tp.part else 1,
            part_spec_notes=tp.part.spec_notes if tp.part else None,
        ))
    return out


@router.get("/", response_model=List[schemas.TaskOut])
def list_tasks(asset_id: int = None, property_id: int = None, status: str = None,
               db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.Task)
    if asset_id:
        q = q.filter(models.Task.asset_id == asset_id)
    elif property_id:
        asset_ids = [a.id for a in db.query(models.Asset).filter(models.Asset.property_id == property_id).all()]
        q = q.filter(models.Task.asset_id.in_(asset_ids))

    tasks = [_enrich(t, db) for t in q.all()]
    if status:
        tasks = [t for t in tasks if t.status == status]
    return tasks


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return _enrich(task, db)


@router.post("/", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    task_data = payload.model_dump(exclude={"parts"})
    task = models.Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _enrich(task, db)


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return _enrich(task, db)


@router.patch("/{task_id}/snooze", response_model=schemas.TaskOut)
def snooze_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.snoozed_until = payload.snoozed_until
    db.commit()
    db.refresh(task)
    return _enrich(task, db)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}


class ReorderItem(BaseModel):
    id: int
    sort_order: int
    task_group: Optional[str] = None


@router.post("/reorder")
def reorder_tasks(items: List[ReorderItem], db: Session = Depends(get_db), _=Depends(get_current_user)):
    for item in items:
        task = db.query(models.Task).filter(models.Task.id == item.id).first()
        if task:
            task.sort_order = item.sort_order
            if item.task_group is not None:
                task.task_group = item.task_group if item.task_group.strip() else None
    db.commit()
    return {"ok": True}
