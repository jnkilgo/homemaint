"""
Escalation engine — runs on a schedule, evaluates all tasks,
publishes MQTT state, and fires mobile push notifications based on
escalation level.

Escalation levels:
  0 = not overdue
  1 = 1–7 days overdue   → daily notification, normal priority
  2 = 8–14 days overdue  → twice daily, high priority
  3 = 15+ days overdue   → every 12h, urgent priority
  due_soon               → once at advance_warning_days, low priority
"""

import logging
import os
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.database import SessionLocal
from app import models
from app.task_engine import get_task_status, get_escalation_level
from app.mqtt_manager import mqtt_manager

logger = logging.getLogger(__name__)

NOTIFICATIONS_ENABLED = os.getenv("NOTIFICATIONS_ENABLED", "true").lower() == "true"

# Track what notifications have been sent to avoid spamming
# key: (task_id, escalation_level, date_str) → True
_notified = {}


def _should_notify(task_id, escalation_level, twice_daily=False):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    hour  = datetime.now(timezone.utc).hour

    if twice_daily:
        # Notify at ~8am and ~8pm UTC
        slot = "am" if hour < 14 else "pm"
        key = (task_id, escalation_level, today, slot)
    else:
        key = (task_id, escalation_level, today)

    if key in _notified:
        return False
    _notified[key] = True
    return True


def _cleanup_notified():
    """Purge notification history older than 2 days to prevent memory growth."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    keys_to_delete = [k for k in _notified if isinstance(k[2], str) and k[2] < today]
    for k in keys_to_delete:
        del _notified[k]


def run_escalation(startup_run=False):
    """Main escalation job — called by scheduler every hour."""
    if not NOTIFICATIONS_ENABLED:
        logger.debug("Notifications disabled — skipping escalation run")
        return
    if not mqtt_manager.connected:
        logger.debug("MQTT not connected, skipping escalation run")
        return

    logger.info("Running escalation engine…")
    db = SessionLocal()

    try:
        properties = db.query(models.Property).all()
        global_overdue = 0
        global_due_soon = 0
        global_tasks = 0

        for prop in properties:
            prop_overdue = 0
            prop_due_soon = 0
            prop_tasks = 0

            for asset in prop.assets:
                for task in asset.tasks:
                    status, days_until_due, usage_until_due = get_task_status(task, asset)
                    last_done = task.last_completed_at.isoformat() if task.last_completed_at else None
                    last_by_user = db.query(models.User).filter(models.User.id == task.last_completed_by).first()
                    last_by = last_by_user.display_name if last_by_user else None

                    days_overdue = abs(days_until_due) if (status == "overdue" and days_until_due is not None) else 0
                    escalation_level = get_escalation_level(days_overdue) if status == "overdue" else 0

                    # Register discovery entities (idempotent — retained in broker)
                    mqtt_manager.register_task_sensor(
                        prop.id, prop.name,
                        asset.id, asset.name,
                        task.id, task.name
                    )

                    # Publish state
                    mqtt_manager.publish_task_state(
                        prop.id, asset.id, task.id,
                        status, days_until_due, usage_until_due,
                        last_done, last_by, escalation_level
                    )

                    # Fire notifications (skip on startup to avoid notification flood)
                    if not startup_run:
                        _handle_notification(task, asset, prop, status, days_until_due, escalation_level)

                    prop_tasks += 1
                    if status == "overdue":   prop_overdue += 1
                    if status == "due_soon":  prop_due_soon += 1

            # Property summary + per-property notify discovery
            mqtt_manager.register_property_sensor(prop.id, prop.name)
            mqtt_manager.register_property_notify_sensor(prop.id, prop.name)
            mqtt_manager.publish_property_summary(prop.id, prop_overdue, prop_due_soon, prop_tasks)

            global_overdue  += prop_overdue
            global_due_soon += prop_due_soon
            global_tasks    += prop_tasks

        # Global summary
        mqtt_manager.register_global_sensor()
        mqtt_manager.publish_global_summary(
            global_overdue, global_due_soon,
            len(properties), global_tasks
        )

        _cleanup_notified()
        logger.info(f"Escalation complete — {global_overdue} overdue, {global_due_soon} due soon across {len(properties)} properties")

    except Exception as e:
        logger.error(f"Escalation engine error: {e}", exc_info=True)
    finally:
        db.close()


def _handle_notification(task, asset, prop, status, days_until_due, escalation_level):
    """Decide whether to send a push notification for this task."""
    task_label = f"{asset.name} — {task.name}"
    prop_label = prop.name

    if status == "due_soon" and days_until_due is not None:
        if _should_notify(task.id, "due_soon"):
            mqtt_manager.send_mobile_notification(
                title=f"Due soon: {task_label}",
                message=f"{prop_label} · Due in {days_until_due} day{'s' if days_until_due != 1 else ''}",
                tag=f"hm_task_{task.id}",
                priority="normal",
                property_id=prop.id,
            )

    elif escalation_level == 1:
        if _should_notify(task.id, 1):
            mqtt_manager.send_mobile_notification(
                title=f"Overdue: {task_label}",
                message=f"{prop_label} · {abs(days_until_due or 0)} days overdue",
                tag=f"hm_task_{task.id}",
                priority="normal",
                property_id=prop.id,
            )

    elif escalation_level == 2:
        if _should_notify(task.id, 2, twice_daily=True):
            mqtt_manager.send_mobile_notification(
                title=f"⚠ Overdue: {task_label}",
                message=f"{prop_label} · {abs(days_until_due or 0)} days overdue — needs attention",
                tag=f"hm_task_{task.id}",
                priority="normal",
                property_id=prop.id,
            )

    elif escalation_level == 3:
        if _should_notify(task.id, 3, twice_daily=True):
            mqtt_manager.send_mobile_notification(
                title=f"🚨 Overdue: {task_label}",
                message=f"{prop_label} · {abs(days_until_due or 0)} days overdue — action required",
                tag=f"hm_task_{task.id}",
                priority="normal",
                property_id=prop.id,
            )


def run_usage_reminders():
    """Daily job — fire HA notifications for assets overdue for usage logging."""
    from app.routers.settings import get_setting

    db = SessionLocal()
    try:
        ha_notify     = get_setting(db, "usage_reminder_ha_notify") == "true"
        notif_enabled = get_setting(db, "notifications_enabled") == "true"
        if not ha_notify or not notif_enabled:
            return

        from datetime import datetime, timedelta
        global_days = int(get_setting(db, "usage_reminder_global_days") or 90)
        assets = db.query(models.Asset).filter(
            (models.Asset.current_hours != None) | (models.Asset.current_miles != None)
        ).all()

        now = datetime.utcnow()
        for asset in assets:
            threshold_days = asset.usage_reminder_days or global_days

            # Skip if already notified within this threshold window
            if asset.usage_reminder_sent_at:
                days_since_notify = (now - asset.usage_reminder_sent_at).days
                if days_since_notify < threshold_days:
                    continue

            # Check if all tasks snoozed
            tasks = db.query(models.Task).filter(models.Task.asset_id == asset.id).all()
            if tasks and all(
                t.snoozed_until and t.snoozed_until > now.date()
                for t in tasks if t.snoozed_until
            ) and len([t for t in tasks if t.snoozed_until]) == len(tasks):
                continue

            # Check last usage log
            latest = db.query(models.UsageLog)\
                .filter(models.UsageLog.asset_id == asset.id)\
                .order_by(models.UsageLog.recorded_at.desc())\
                .first()

            last_logged = latest.recorded_at if latest else asset.created_at
            days_since = (now - last_logged).days

            if days_since >= threshold_days:
                prop = db.query(models.Property).filter(models.Property.id == asset.property_id).first()
                prop_name = prop.name if prop else ""
                prop_id   = prop.id if prop else None
                tracks  = "hours" if asset.current_hours is not None else "miles"
                current = asset.current_hours if asset.current_hours is not None else asset.current_miles

                mqtt_manager.send_mobile_notification(
                    title=f"Usage Log Reminder — {asset.name}",
                    message=f"{asset.name} ({prop_name}) hasn't had {tracks} logged in {days_since} days. Current: {current:,.0f} {tracks}.",
                    priority="low",
                    tag=f"usage_reminder_{asset.id}",
                    property_id=prop_id,
                )

                # Mark sent
                asset.usage_reminder_sent_at = now
                db.commit()
                logger.info(f"Usage reminder sent for asset {asset.id} ({asset.name})")

    except Exception as e:
        logger.error(f"Usage reminder job error: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler background scheduler."""
    scheduler = BackgroundScheduler(timezone="UTC")

    # Run escalation every hour
    scheduler.add_job(
        run_escalation,
        trigger=IntervalTrigger(hours=1),
        id="escalation",
        name="HomeMaint Escalation Engine",
        replace_existing=True,
        max_instances=1,
    )

    # Run once at startup after a short delay (one-shot)
    from apscheduler.triggers.date import DateTrigger
    from datetime import datetime, timezone, timedelta
    scheduler.add_job(
        lambda: run_escalation(startup_run=True),
        trigger=DateTrigger(run_date=datetime.now(timezone.utc) + timedelta(seconds=30)),
        id="escalation_startup",
        name="Startup escalation run",
        replace_existing=True,
        max_instances=1,
    )

    # Run usage reminders daily at 9am UTC
    scheduler.add_job(
        run_usage_reminders,
        trigger=IntervalTrigger(hours=24),
        id="usage_reminders",
        name="Usage Log Reminders",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info("Escalation scheduler started")
    return scheduler
