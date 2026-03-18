from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any
import json

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models

router = APIRouter()

DEFAULTS = {
    "notifications_enabled":       "true",
    "quiet_hours_enabled":         "false",
    "quiet_start":                 "22:00",
    "quiet_end":                   "07:00",
    "notify_critical":             "true",
    "notify_overdue":              "true",
    "notify_due_soon":             "false",
    "disabled_properties":         "[]",   # JSON list of property IDs
    "usage_reminder_global_days":  "90",
    "usage_reminder_ha_notify":    "false",
}


def get_setting(db: Session, key: str) -> str:
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    return row.value if row else DEFAULTS.get(key, "")


def set_setting(db: Session, key: str, value: str):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(models.AppSetting(key=key, value=value))
    db.commit()


@router.get("/notifications")
def get_notification_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return {
        "notifications_enabled": get_setting(db, "notifications_enabled") == "true",
        "quiet_hours_enabled":   get_setting(db, "quiet_hours_enabled") == "true",
        "quiet_start":           get_setting(db, "quiet_start"),
        "quiet_end":             get_setting(db, "quiet_end"),
        "notify_critical":       get_setting(db, "notify_critical") == "true",
        "notify_overdue":        get_setting(db, "notify_overdue") == "true",
        "notify_due_soon":       get_setting(db, "notify_due_soon") == "true",
        "disabled_properties":   json.loads(get_setting(db, "disabled_properties") or "[]"),
    }


@router.put("/notifications")
def update_notification_settings(
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    bool_keys = ["notifications_enabled", "quiet_hours_enabled",
                 "notify_critical", "notify_overdue", "notify_due_soon"]
    str_keys  = ["quiet_start", "quiet_end"]
    list_keys = ["disabled_properties"]

    for key in bool_keys:
        if key in data:
            set_setting(db, key, "true" if data[key] else "false")
    for key in str_keys:
        if key in data:
            set_setting(db, key, str(data[key]))
    for key in list_keys:
        if key in data:
            set_setting(db, key, json.dumps(data[key]))

    return get_notification_settings(db)


@router.get("/usage-reminders")
def get_usage_reminder_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return {
        "usage_reminder_global_days": int(get_setting(db, "usage_reminder_global_days") or 90),
        "usage_reminder_ha_notify":   get_setting(db, "usage_reminder_ha_notify") == "true",
    }


@router.put("/usage-reminders")
def update_usage_reminder_settings(
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    if "usage_reminder_global_days" in data:
        set_setting(db, "usage_reminder_global_days", str(int(data["usage_reminder_global_days"])))
    if "usage_reminder_ha_notify" in data:
        set_setting(db, "usage_reminder_ha_notify", "true" if data["usage_reminder_ha_notify"] else "false")
    return get_usage_reminder_settings(db)


@router.get("/usage-reminders/due")
def get_assets_due_for_usage_log(
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    """Return assets that haven't had usage logged within their reminder window."""
    from datetime import datetime, timedelta

    global_days = int(get_setting(db, "usage_reminder_global_days") or 90)

    # Only assets that track hours or miles
    assets = db.query(models.Asset).filter(
        (models.Asset.current_hours != None) | (models.Asset.current_miles != None)
    ).all()

    due = []
    now = datetime.utcnow()

    for asset in assets:
        threshold_days = asset.usage_reminder_days or global_days

        # Check if all tasks are snoozed (skip if so)
        tasks = db.query(models.Task).filter(models.Task.asset_id == asset.id).all()
        if tasks and all(
            t.snoozed_until and t.snoozed_until > now.date()
            for t in tasks if t.snoozed_until
        ) and len([t for t in tasks if t.snoozed_until]) == len(tasks):
            continue

        # Find most recent usage log
        latest = db.query(models.UsageLog)\
            .filter(models.UsageLog.asset_id == asset.id)\
            .order_by(models.UsageLog.recorded_at.desc())\
            .first()

        last_logged = latest.recorded_at if latest else asset.created_at
        days_since = (now - last_logged).days

        if days_since >= threshold_days:
            prop = db.query(models.Property).filter(models.Property.id == asset.property_id).first()
            due.append({
                "asset_id": asset.id,
                "asset_name": asset.name,
                "property_name": prop.name if prop else "",
                "days_since": days_since,
                "threshold_days": threshold_days,
                "tracks": "hours" if asset.current_hours is not None else "miles",
                "current_value": asset.current_hours if asset.current_hours is not None else asset.current_miles,
            })

    return sorted(due, key=lambda x: x["days_since"], reverse=True)
