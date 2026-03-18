"""
Import router — accepts a JSON payload describing one or more assets
(with tasks and parts) and creates them in bulk under a given property.

Used by the HomeMaint import prompts to onboard assets from manual photos
or conversational descriptions.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models

router = APIRouter()


# ── Import schemas ─────────────────────────────────────────────────────────

class ImportPart(BaseModel):
    name: str
    part_number: Optional[str] = None
    supplier: Optional[str] = None
    qty: Optional[int] = 1
    last_price: Optional[float] = None
    reorder_url: Optional[str] = None
    spec_notes: Optional[str] = None


class ImportTask(BaseModel):
    name: str
    description: Optional[str] = None
    interval_type: str = "days"   # days, hours, miles, seasonal, manual
    interval: Optional[int] = None
    season: Optional[str] = None  # spring, summer, fall, winter
    advance_warning_days: int = 14
    is_critical: bool = False
    parts: Optional[List[ImportPart]] = []


class ImportAsset(BaseModel):
    name: str
    icon: Optional[str] = None
    category: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    model_year: Optional[int] = None
    serial_number: Optional[str] = None
    install_date: Optional[date] = None
    location_on_property: Optional[str] = None
    expected_lifespan_years: Optional[int] = None
    purchase_price: Optional[float] = None
    current_hours: Optional[float] = None
    current_miles: Optional[float] = None
    notes: Optional[str] = None
    tasks: Optional[List[ImportTask]] = []


class ImportPayload(BaseModel):
    property_id: int
    assets: List[ImportAsset]


class ImportResult(BaseModel):
    assets_created: int
    tasks_created: int
    parts_created: int
    asset_names: List[str]


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post("/assets", response_model=ImportResult)
def import_assets(
    payload: ImportPayload,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    # Verify property exists
    prop = db.query(models.Property).filter(models.Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    assets_created = 0
    tasks_created = 0
    parts_created = 0
    asset_names = []

    for a in payload.assets:
        # Derive install_date from model_year if no install_date provided
        install_date = a.install_date
        if not install_date and a.model_year:
            install_date = date(a.model_year, 1, 1)

        asset = models.Asset(
            property_id=payload.property_id,
            name=a.name,
            icon=a.icon or "🔧",
            category=a.category,
            make=a.make,
            model=a.model,
            serial_number=a.serial_number,
            install_date=install_date,
            location_on_property=a.location_on_property,
            expected_lifespan_years=a.expected_lifespan_years,
            purchase_price=a.purchase_price,
            current_hours=a.current_hours,
            current_miles=a.current_miles,
        )
        db.add(asset)
        db.flush()  # get asset.id

        for t in (a.tasks or []):
            # Validate interval_type
            valid_types = {e.value for e in models.IntervalType}
            interval_type = t.interval_type if t.interval_type in valid_types else "manual"

            valid_seasons = {e.value for e in models.Season} if t.season else None
            season = t.season if (t.season and t.season in {e.value for e in models.Season}) else None

            task = models.Task(
                asset_id=asset.id,
                name=t.name,
                description=t.description,
                interval=t.interval,
                interval_type=interval_type,
                season=season,
                advance_warning_days=t.advance_warning_days,
                is_critical=t.is_critical,
            )
            db.add(task)
            db.flush()

            for p in (t.parts or []):
                part = models.Part(
                    task_id=task.id,
                    name=p.name,
                    part_number=p.part_number,
                    supplier=p.supplier,
                    last_price=p.last_price,
                    reorder_url=p.reorder_url,
                    spec_notes=p.spec_notes if hasattr(models.Part, 'spec_notes') else None,
                )
                db.add(part)
                parts_created += 1

            tasks_created += 1

        assets_created += 1
        asset_names.append(a.name)

    db.commit()

    return ImportResult(
        assets_created=assets_created,
        tasks_created=tasks_created,
        parts_created=parts_created,
        asset_names=asset_names,
    )
