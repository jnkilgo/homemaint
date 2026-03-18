from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.auth import get_current_user
from app import models, schemas

router = APIRouter()

def _enrich(loan: models.AssetLoan) -> schemas.AssetLoanOut:
    out = schemas.AssetLoanOut.model_validate(loan)
    if loan.asset:
        out.asset_name = loan.asset.name
        if loan.asset.property:
            out.property_name = loan.asset.property.name
    if loan.expected_return_date and not loan.returned_date:
        today = date.today()
        days = (loan.expected_return_date - today).days
        out.days_until_due = days
        if days < 0:
            out.status = 'overdue'
        elif days <= 14:
            out.status = 'due_soon'
        else:
            out.status = 'ok'
    elif loan.returned_date:
        out.status = 'returned'
    return out

@router.get("/", response_model=List[schemas.AssetLoanOut])
def list_loans(active_only: bool = False, db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = (db.query(models.AssetLoan)
         .join(models.Asset)
         .join(models.Property)
         .filter(models.Property.user_id == current.id))
    if active_only:
        q = q.filter(models.AssetLoan.returned_date == None)
    return [_enrich(l) for l in q.order_by(models.AssetLoan.loan_date.desc()).all()]

@router.get("/asset/{asset_id}", response_model=List[schemas.AssetLoanOut])
def list_asset_loans(asset_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = (db.query(models.Asset)
             .join(models.Property)
             .filter(models.Asset.id == asset_id, models.Property.user_id == current.id)
             .first())
    if not asset:
        raise HTTPException(404, "Asset not found")
    loans = db.query(models.AssetLoan).filter(models.AssetLoan.asset_id == asset_id).order_by(models.AssetLoan.loan_date.desc()).all()
    return [_enrich(l) for l in loans]

@router.post("/", response_model=schemas.AssetLoanOut)
def create_loan(payload: schemas.AssetLoanCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = (db.query(models.Asset)
             .join(models.Property)
             .filter(models.Asset.id == payload.asset_id, models.Property.user_id == current.id)
             .first())
    if not asset:
        raise HTTPException(404, "Asset not found")
    loan = models.AssetLoan(**payload.model_dump())
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _enrich(loan)

@router.patch("/{loan_id}/return", response_model=schemas.AssetLoanOut)
def return_loan(loan_id: int, payload: schemas.AssetLoanReturn, db: Session = Depends(get_db), current=Depends(get_current_user)):
    loan = (db.query(models.AssetLoan)
            .join(models.Asset)
            .join(models.Property)
            .filter(models.AssetLoan.id == loan_id, models.Property.user_id == current.id)
            .first())
    if not loan:
        raise HTTPException(404, "Loan not found")
    loan.returned_date = payload.returned_date
    db.commit()
    db.refresh(loan)
    return _enrich(loan)

@router.delete("/{loan_id}")
def delete_loan(loan_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    loan = (db.query(models.AssetLoan)
            .join(models.Asset)
            .join(models.Property)
            .filter(models.AssetLoan.id == loan_id, models.Property.user_id == current.id)
            .first())
    if not loan:
        raise HTTPException(404, "Loan not found")
    db.delete(loan)
    db.commit()
    return {"ok": True}
