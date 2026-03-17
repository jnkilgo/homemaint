from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich(part: models.Part) -> schemas.PartOut:
    out = schemas.PartOut.model_validate(part)
    return out


@router.get("/", response_model=List[schemas.PartOut])
def list_parts(asset_id: int = None, task_id: int = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.Part)
    if asset_id:
        q = q.filter(models.Part.asset_id == asset_id)
    elif task_id:
        q = q.filter(models.Part.task_id == task_id)
    return [_enrich(p) for p in q.all()]


@router.post("/", response_model=schemas.PartOut)
def create_part(payload: schemas.PartCreate, asset_id: int = None, task_id: int = None,
                db: Session = Depends(get_db), _=Depends(get_current_user)):
    part = models.Part(asset_id=asset_id, task_id=task_id, **payload.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return _enrich(part)


@router.put("/{part_id}", response_model=schemas.PartOut)
def update_part(part_id: int, payload: schemas.PartCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(404, "Part not found")
    for k, v in payload.model_dump().items():
        setattr(part, k, v)
    db.commit()
    db.refresh(part)
    return _enrich(part)


@router.patch("/{part_id}/qty", response_model=schemas.PartOut)
def update_part_qty(part_id: int, payload: schemas.QtyUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(404, "Part not found")
    part.qty = max(0, payload.qty)
    db.commit()
    db.refresh(part)
    return _enrich(part)


@router.delete("/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(404, "Part not found")
    db.delete(part)
    db.commit()
    return {"ok": True}
