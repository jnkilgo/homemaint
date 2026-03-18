from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich(c: models.Component) -> schemas.ComponentOut:
    out = schemas.ComponentOut.model_validate(c)
    if c.installed_date:
        out.age_years = round((date.today() - c.installed_date).days / 365.25, 1)
        if c.expected_lifespan_years:
            years_left = c.expected_lifespan_years - out.age_years
            out.expires_soon = 0 < years_left <= 0.25   # within 3 months
            out.expired = years_left <= 0
    return out


@router.get("/", response_model=List[schemas.ComponentOut])
def list_components(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    comps = db.query(models.Component).filter(models.Component.asset_id == asset_id).all()
    return [_enrich(c) for c in comps]


@router.post("/", response_model=schemas.ComponentOut)
def create_component(asset_id: int, payload: schemas.ComponentCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    comp = models.Component(asset_id=asset_id, **payload.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return _enrich(comp)


@router.put("/{comp_id}", response_model=schemas.ComponentOut)
def update_component(comp_id: int, payload: schemas.ComponentCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    comp = db.query(models.Component).filter(models.Component.id == comp_id).first()
    if not comp:
        raise HTTPException(404, "Component not found")
    for k, v in payload.model_dump().items():
        setattr(comp, k, v)
    db.commit()
    db.refresh(comp)
    return _enrich(comp)


@router.delete("/{comp_id}")
def delete_component(comp_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    comp = db.query(models.Component).filter(models.Component.id == comp_id).first()
    if not comp:
        raise HTTPException(404, "Component not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}
