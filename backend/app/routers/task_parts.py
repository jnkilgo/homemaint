from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich(tp: models.TaskPart) -> schemas.TaskPartOut:
    out = schemas.TaskPartOut.model_validate(tp)
    if tp.part:
        out.part_name = tp.part.name
        out.part_number = tp.part.part_number
        out.qty_on_hand = tp.part.qty_on_hand or 0
    return out


@router.get("/", response_model=List[schemas.TaskPartOut])
def list_task_parts(task_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    tps = db.query(models.TaskPart).filter(models.TaskPart.task_id == task_id).all()
    return [_enrich(tp) for tp in tps]


@router.post("/", response_model=schemas.TaskPartOut)
def link_part(task_id: int, payload: schemas.TaskPartCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
    if not part:
        raise HTTPException(404, "Part not found")
    # Avoid duplicates
    existing = db.query(models.TaskPart).filter(
        models.TaskPart.task_id == task_id,
        models.TaskPart.part_id == payload.part_id
    ).first()
    if existing:
        return _enrich(existing)
    tp = models.TaskPart(task_id=task_id, part_id=payload.part_id)
    db.add(tp)
    db.commit()
    db.refresh(tp)
    return _enrich(tp)


@router.delete("/{tp_id}")
def unlink_part(tp_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    tp = db.query(models.TaskPart).filter(models.TaskPart.id == tp_id).first()
    if not tp:
        raise HTTPException(404, "Not found")
    db.delete(tp)
    db.commit()
    return {"ok": True}
