from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich(c: models.Contractor) -> schemas.ContractorOut:
    out = schemas.ContractorOut.model_validate(c)
    out.job_count = len(c.completion_logs)
    out.total_spend = sum(l.cost or 0 for l in c.completion_logs)
    return out


def _enrich_ac(ac: models.AssetContractor) -> schemas.AssetContractorOut:
    out = schemas.AssetContractorOut.model_validate(ac)
    if ac.contractor:
        out.contractor_name  = ac.contractor.name
        out.contractor_trade = ac.contractor.trade
        out.contractor_phone = ac.contractor.phone
        out.contractor_email = ac.contractor.email
    return out


@router.get("/", response_model=List[schemas.ContractorOut])
def list_contractors(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_enrich(c) for c in db.query(models.Contractor).order_by(models.Contractor.name).all()]


@router.get("/{contractor_id}", response_model=schemas.ContractorOut)
def get_contractor(contractor_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(404, "Contractor not found")
    return _enrich(c)


@router.post("/", response_model=schemas.ContractorOut)
def create_contractor(payload: schemas.ContractorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = models.Contractor(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _enrich(c)


@router.put("/{contractor_id}", response_model=schemas.ContractorOut)
def update_contractor(contractor_id: int, payload: schemas.ContractorUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(404, "Contractor not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _enrich(c)


@router.delete("/{contractor_id}")
def delete_contractor(contractor_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    c = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(404, "Contractor not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Asset ↔ Contractor associations ────────────────────────────────────────

@router.get("/assets/{asset_id}/contractors", response_model=List[schemas.AssetContractorOut])
def list_asset_contractors(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.query(models.AssetContractor).filter(models.AssetContractor.asset_id == asset_id).all()
    return [_enrich_ac(r) for r in rows]


@router.post("/assets/{asset_id}/contractors", response_model=schemas.AssetContractorOut)
def add_asset_contractor(asset_id: int, payload: schemas.AssetContractorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Prevent duplicates
    existing = db.query(models.AssetContractor).filter(
        models.AssetContractor.asset_id == asset_id,
        models.AssetContractor.contractor_id == payload.contractor_id
    ).first()
    if existing:
        raise HTTPException(400, "Contractor already associated with this asset")
    ac = models.AssetContractor(asset_id=asset_id, **payload.model_dump())
    db.add(ac)
    db.commit()
    db.refresh(ac)
    return _enrich_ac(ac)


@router.delete("/assets/{asset_id}/contractors/{contractor_id}")
def remove_asset_contractor(asset_id: int, contractor_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    ac = db.query(models.AssetContractor).filter(
        models.AssetContractor.asset_id == asset_id,
        models.AssetContractor.contractor_id == contractor_id
    ).first()
    if not ac:
        raise HTTPException(404, "Association not found")
    db.delete(ac)
    db.commit()
    return {"ok": True}
