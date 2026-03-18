from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta, date

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models, schemas
from app.task_engine import get_task_status, enrich_task

router = APIRouter()


def _get_user_property_or_404(property_id: int, user: models.User, db: Session) -> models.Property:
    """Fetch a property by ID, enforcing ownership."""
    prop = db.query(models.Property).filter(
        models.Property.id == property_id,
        models.Property.user_id == user.id,
    ).first()
    if not prop:
        raise HTTPException(404, "Property not found")
    return prop


def _property_counts(prop: models.Property):
    overdue = due_soon = 0
    for asset in prop.assets:
        for task in asset.tasks:
            status, _, _ = get_task_status(task, asset)
            if status == "overdue":
                overdue += 1
            elif status in ("due_soon", "snoozed"):
                due_soon += 1
    return overdue, due_soon


@router.get("/", response_model=List[schemas.PropertyOut])
def list_properties(db: Session = Depends(get_db), current=Depends(get_current_user)):
    props = (
        db.query(models.Property)
        .filter(models.Property.user_id == current.id)
        .order_by(models.Property.is_default.desc(), models.Property.name)
        .all()
    )
    result = []
    for p in props:
        overdue, due_soon = _property_counts(p)
        out = schemas.PropertyOut.model_validate(p)
        out.asset_count = len(p.assets)
        out.overdue_count = overdue
        out.due_soon_count = due_soon
        result.append(out)
    return result


@router.get("/default", response_model=schemas.PropertyOut)
def get_default_property(db: Session = Depends(get_db), current=Depends(get_current_user)):
    prop = (
        db.query(models.Property)
        .filter(models.Property.user_id == current.id, models.Property.is_default == True)
        .first()
    )
    if not prop:
        prop = (
            db.query(models.Property)
            .filter(models.Property.user_id == current.id)
            .first()
        )
    if not prop:
        raise HTTPException(404, "No properties found")
    overdue, due_soon = _property_counts(prop)
    out = schemas.PropertyOut.model_validate(prop)
    out.asset_count = len(prop.assets)
    out.overdue_count = overdue
    out.due_soon_count = due_soon
    return out


@router.get("/dashboard", response_model=schemas.GlobalSummary)
def global_dashboard(db: Session = Depends(get_db), current=Depends(get_current_user)):
    props = db.query(models.Property).filter(models.Property.user_id == current.id).all()

    # Scoped counts
    all_assets = []
    all_tasks = []
    for p in props:
        all_assets.extend(p.assets)
        for a in p.assets:
            all_tasks.extend(a.tasks)

    overdue_tasks = []
    due_soon_tasks = []
    warranty_expiring = []
    aging_systems = []

    today = date.today()
    in_90_days = today + timedelta(days=90)
    in_2_years = today + timedelta(days=730)

    for prop in props:
        for asset in prop.assets:
            if asset.warranty_expires and asset.warranty_expires <= in_90_days:
                warranty_expiring.append({
                    "asset_id": asset.id,
                    "asset_name": asset.name,
                    "property_id": prop.id,
                    "property_name": prop.name,
                    "warranty_expires": asset.warranty_expires.isoformat(),
                    "days_remaining": (asset.warranty_expires - today).days,
                })

            if asset.install_date and asset.expected_lifespan_years:
                replace_date = date(
                    asset.install_date.year + asset.expected_lifespan_years,
                    asset.install_date.month,
                    asset.install_date.day,
                )
                if replace_date <= in_2_years:
                    aging_systems.append({
                        "asset_id": asset.id,
                        "asset_name": asset.name,
                        "property_id": prop.id,
                        "property_name": prop.name,
                        "install_date": asset.install_date.isoformat(),
                        "replace_by": replace_date.isoformat(),
                        "days_remaining": (replace_date - today).days,
                    })

            for task in asset.tasks:
                status, days_until_due, usage_until_due = get_task_status(task, asset)
                item = schemas.TaskStatusItem(
                    task_id=task.id,
                    task_name=task.name,
                    asset_id=asset.id,
                    asset_name=asset.name,
                    property_id=prop.id,
                    property_name=prop.name,
                    status=status,
                    days_until_due=days_until_due,
                    usage_until_due=usage_until_due,
                    last_completed_at=task.last_completed_at,
                    asset_category=asset.category,
                )
                if status == "overdue":
                    overdue_tasks.append(item)
                elif status in ("due_soon", "snoozed"):
                    due_soon_tasks.append(item)

    overdue_tasks.sort(key=lambda x: x.days_until_due or 0)
    due_soon_tasks.sort(key=lambda x: x.days_until_due or 999)

    return schemas.GlobalSummary(
        total_properties=len(props),
        total_assets=len(all_assets),
        total_tasks=len(all_tasks),
        overdue_count=len(overdue_tasks),
        due_soon_count=len(due_soon_tasks),
        overdue_tasks=overdue_tasks,
        due_soon_tasks=due_soon_tasks,
        warranty_expiring=sorted(warranty_expiring, key=lambda x: x["days_remaining"]),
        aging_systems=sorted(aging_systems, key=lambda x: x["days_remaining"]),
    )


@router.get("/{property_id}", response_model=schemas.PropertyOut)
def get_property(property_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    prop = _get_user_property_or_404(property_id, current, db)
    overdue, due_soon = _property_counts(prop)
    out = schemas.PropertyOut.model_validate(prop)
    out.asset_count = len(prop.assets)
    out.overdue_count = overdue
    out.due_soon_count = due_soon
    return out


@router.post("/", response_model=schemas.PropertyOut)
def create_property(payload: schemas.PropertyCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if payload.is_default:
        db.query(models.Property).filter(
            models.Property.user_id == current.id,
            models.Property.is_default == True,
        ).update({"is_default": False})
    prop = models.Property(**payload.model_dump(), user_id=current.id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    out = schemas.PropertyOut.model_validate(prop)
    out.asset_count = 0
    out.overdue_count = 0
    out.due_soon_count = 0
    return out


@router.put("/{property_id}", response_model=schemas.PropertyOut)
def update_property(property_id: int, payload: schemas.PropertyUpdate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    prop = _get_user_property_or_404(property_id, current, db)
    if payload.is_default:
        db.query(models.Property).filter(
            models.Property.user_id == current.id,
            models.Property.is_default == True,
        ).update({"is_default": False})
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(prop, k, v)
    db.commit()
    db.refresh(prop)
    overdue, due_soon = _property_counts(prop)
    out = schemas.PropertyOut.model_validate(prop)
    out.asset_count = len(prop.assets)
    out.overdue_count = overdue
    out.due_soon_count = due_soon
    return out


@router.delete("/{property_id}")
def delete_property(property_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    prop = _get_user_property_or_404(property_id, current, db)

    # Manually cascade through relationships that have cross-FK dependencies
    for asset in prop.assets:
        # Null out part_id on spare_inventory before tasks/parts are deleted
        for spare in asset.spare_inventory:
            spare.part_id = None
        db.flush()

        # Delete task parts and parts explicitly
        for task in asset.tasks:
            for tp in task.task_parts:
                db.delete(tp)
            for part in task.parts:
                db.delete(part)
            db.flush()

    db.flush()
    db.delete(prop)
    db.commit()
    return {"ok": True}
