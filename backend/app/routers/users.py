from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, date, timedelta

from app.database import get_db
from app.auth import get_current_user, require_admin, hash_password
from app import models, schemas

router = APIRouter()


def record_activity(db: Session, user_id: int, action_type: str):
    """Upsert a daily activity count row. Call from any router after a meaningful action."""
    today = date.today()
    activity = db.query(models.UserActivity).filter(
        models.UserActivity.user_id == user_id,
        models.UserActivity.date == today,
        models.UserActivity.action_type == action_type,
    ).first()
    if activity:
        activity.count += 1
    else:
        db.add(models.UserActivity(
            user_id=user_id,
            date=today,
            action_type=action_type,
            count=1,
        ))
    db.commit()


@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(models.User).all()


@router.get("/stats")
def user_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Return per-user engagement stats for the admin dashboard."""
    now = datetime.utcnow()
    online_threshold = now - timedelta(minutes=5)
    recent_threshold = now - timedelta(minutes=30)
    wau_threshold    = now - timedelta(days=7)

    users = db.query(models.User).all()
    results = []

    for u in users:
        # Count assets via properties
        asset_count = (
            db.query(func.count(models.Asset.id))
            .join(models.Property, models.Asset.property_id == models.Property.id)
            .filter(models.Property.user_id == u.id)
            .scalar() or 0
        )

        # Count tasks via assets via properties
        task_count = (
            db.query(func.count(models.Task.id))
            .join(models.Asset, models.Task.asset_id == models.Asset.id)
            .join(models.Property, models.Asset.property_id == models.Property.id)
            .filter(models.Property.user_id == u.id)
            .scalar() or 0
        )

        # Count completion logs directly by user
        completion_count = (
            db.query(func.count(models.CompletionLog.id))
            .filter(models.CompletionLog.user_id == u.id)
            .scalar() or 0
        )

        # Count properties
        property_count = (
            db.query(func.count(models.Property.id))
            .filter(models.Property.user_id == u.id)
            .scalar() or 0
        )

        # Weekly login activity
        week_logins = (
            db.query(func.sum(models.UserActivity.count))
            .filter(
                models.UserActivity.user_id == u.id,
                models.UserActivity.action_type == "login",
                models.UserActivity.date >= wau_threshold.date(),
            )
            .scalar() or 0
        )

        # Online status
        if u.last_seen_at and u.last_seen_at >= online_threshold:
            online_status = "online"
        elif u.last_seen_at and u.last_seen_at >= recent_threshold:
            online_status = "recent"
        else:
            online_status = "offline"

        results.append({
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "role": u.role,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
            "last_seen_at": u.last_seen_at,
            "login_count": u.login_count or 0,
            "online_status": online_status,
            "asset_count": asset_count,
            "task_count": task_count,
            "completion_count": completion_count,
            "property_count": property_count,
            "week_logins": int(week_logins),
        })

    return results


@router.post("/", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(400, "Username already exists")
    user = models.User(
        username=payload.username,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.id != user_id and current.role != "admin":
        raise HTTPException(403, "Forbidden")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if payload.display_name:
        user.display_name = payload.display_name
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role and current.role == "admin":
        user.role = payload.role.value
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"ok": True}
