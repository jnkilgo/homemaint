from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas

router = APIRouter()


def _enrich(note: models.AssetNote) -> schemas.NoteOut:
    out = schemas.NoteOut.model_validate(note)
    if note.user:
        out.user_display_name = note.user.display_name
    return out


@router.get("/", response_model=List[schemas.NoteOut])
def list_notes(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    notes = db.query(models.AssetNote).filter(
        models.AssetNote.asset_id == asset_id
    ).order_by(models.AssetNote.created_at.desc()).all()
    return [_enrich(n) for n in notes]


@router.post("/", response_model=schemas.NoteOut)
def add_note(payload: schemas.NoteCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    asset = db.query(models.Asset).filter(models.Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    note = models.AssetNote(
        asset_id=payload.asset_id,
        body=payload.body,
        created_by=current.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _enrich(note)


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Admins only — notes are append-only for members."""
    note = db.query(models.AssetNote).filter(models.AssetNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}
