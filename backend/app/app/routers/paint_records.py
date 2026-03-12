from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.PaintOut])
def list_paint(property_id: int = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.PaintRecord)
    if property_id:
        q = q.filter(models.PaintRecord.property_id == property_id)
    return q.order_by(models.PaintRecord.room_surface).all()


@router.post("/", response_model=schemas.PaintOut)
def create_paint(payload: schemas.PaintCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    record = models.PaintRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=schemas.PaintOut)
def update_paint(record_id: int, payload: schemas.PaintUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    record = db.query(models.PaintRecord).filter(models.PaintRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Paint record not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(record, k, v)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}")
def delete_paint(record_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    record = db.query(models.PaintRecord).filter(models.PaintRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Paint record not found")
    db.delete(record)
    db.commit()
    return {"ok": True}
