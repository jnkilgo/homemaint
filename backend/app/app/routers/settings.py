from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any
import json

from app.database import get_db
from app.auth import get_current_user, require_admin
from app import models

router = APIRouter()

DEFAULTS = {
    "notifications_enabled": "true",
    "quiet_hours_enabled":   "false",
    "quiet_start":           "22:00",
    "quiet_end":             "07:00",
    "notify_critical":       "true",
    "notify_overdue":        "true",
    "notify_due_soon":       "false",
    "disabled_properties":   "[]",   # JSON list of property IDs
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
