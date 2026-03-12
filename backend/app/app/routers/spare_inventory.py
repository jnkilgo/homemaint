from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.SpareOut])
def list_spares(asset_id: int = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(models.SpareInventory)
    if asset_id:
        q = q.filter(models.SpareInventory.asset_id == asset_id)
    return q.all()


@router.post("/", response_model=schemas.SpareOut)
def create_spare(payload: schemas.SpareCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    spare = models.SpareInventory(**payload.model_dump())
    db.add(spare)
    db.commit()
    db.refresh(spare)
    return spare


@router.put("/{spare_id}", response_model=schemas.SpareOut)
def update_spare(spare_id: int, payload: schemas.SpareUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    spare = db.query(models.SpareInventory).filter(models.SpareInventory.id == spare_id).first()
    if not spare:
        raise HTTPException(404, "Spare not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(spare, k, v)
    db.commit()
    db.refresh(spare)
    return spare


@router.delete("/{spare_id}")
def delete_spare(spare_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    spare = db.query(models.SpareInventory).filter(models.SpareInventory.id == spare_id).first()
    if not spare:
        raise HTTPException(404, "Spare not found")
    db.delete(spare)
    db.commit()
    return {"ok": True}
