"""
Task status engine — calculates due dates, status, and escalation level
for all interval types: days, months, hours, miles, seasonal
"""

from datetime import datetime, date, timedelta
from typing import Optional, Tuple
from app import models





def get_task_status(task: models.Task, asset: models.Asset, current_usage: float = None) -> Tuple[str, Optional[int], Optional[float]]:
    """
    Returns (status, days_until_due, usage_until_due)
    status: "ok" | "due_soon" | "overdue" | "unknown" | "snoozed"
    """
    # Snooze check — if snoozed_until is in the future, treat as ok
    if task.snoozed_until:
        snooze_dt = task.snoozed_until if isinstance(task.snoozed_until, datetime) else datetime.combine(task.snoozed_until, datetime.min.time())
        if snooze_dt > datetime.utcnow():
            days_remaining = (snooze_dt.date() - date.today()).days
            return ("snoozed", days_remaining, None)

    if task.interval_type == "manual":
        return ("manual", None, None)

    if task.interval_type == "seasonal":
        return _seasonal_status(task)
    elif task.interval_type in ("hours", "miles"):
        return _usage_status(task, asset, current_usage)
    else:
        return _time_status(task)


def _time_status(task: models.Task) -> Tuple[str, Optional[int], Optional[float]]:
    if not task.last_completed_at:
        return ("overdue", -9999, None)

    interval_days = task.interval or 90
    if task.interval_type == "months":
        interval_days = (task.interval or 3) * 30

    due_date = task.last_completed_at + timedelta(days=interval_days)
    now = datetime.utcnow()
    days_remaining = (due_date - now).days

    status = _days_to_status(days_remaining, task.advance_warning_days or 14)
    return (status, days_remaining, None)


def _usage_status(task: models.Task, asset: models.Asset, current_usage: float = None) -> Tuple[str, Optional[int], Optional[float]]:
    current = current_usage if current_usage is not None else (
        asset.current_hours if task.interval_type == "hours" else asset.current_miles
    )
    if current is None or task.last_usage_value is None:
        # Fall back to time-based if no usage data
        return _time_status(task)

    interval = task.interval or 50
    usage_at_due = task.last_usage_value + interval
    usage_remaining = usage_at_due - current

    # Convert usage remaining to approximate days for status
    # (rough estimate: 5 usage units/week)
    approx_days = int(usage_remaining * (7 / 5))
    status = _days_to_status(approx_days, task.advance_warning_days or 14)
    return (status, approx_days, usage_remaining)


def _seasonal_status(task: models.Task) -> Tuple[str, Optional[int], Optional[float]]:
    if not task.season:
        return ("unknown", None, None)

    # Season windows: (start_month, end_month) inclusive
    SEASON_WINDOWS = {
        "spring": (3, 5),   # Mar–May
        "summer": (6, 8),   # Jun–Aug
        "fall":   (9, 11),  # Sep–Nov
        "winter": (12, 2),  # Dec–Feb (wraps year)
    }
    # Month when season starts (for countdown)
    SEASON_START = {"spring": 3, "summer": 6, "fall": 9, "winter": 12}

    now = datetime.utcnow()
    today = now.date()
    season = task.season
    start_m, end_m = SEASON_WINDOWS.get(season, (3, 5))

    # Check if we're currently in the season window
    m = today.month
    if start_m <= end_m:
        in_season = start_m <= m <= end_m
    else:  # wraps year (winter)
        in_season = m >= start_m or m <= end_m

    # Check if completed this season cycle
    def completed_this_season():
        if not task.last_completed_at:
            return False
        last = task.last_completed_at.date()
        # For winter, season cycle spans two calendar years
        if start_m > end_m:
            if last.month >= start_m:
                return last.year == today.year or last.year == today.year - 1
            else:
                return last.month <= end_m and (last.year == today.year or last.year == today.year + 1)
        else:
            return last.year == today.year and start_m <= last.month <= end_m

    if completed_this_season():
        # Done — count down to next season start
        next_start_m = SEASON_START.get(season, 3)
        next_year = today.year if next_start_m > today.month else today.year + 1
        next_season = date(next_year, next_start_m, 1)
        days_remaining = (next_season - today).days
        return ("ok", days_remaining, None)

    # Season length in days for midpoint calc
    SEASON_LENGTHS = {"spring": 92, "summer": 92, "fall": 91, "winter": 90}
    season_len = SEASON_LENGTHS.get(season, 91)
    half_season = season_len // 2

    if in_season:
        # Find days since season started
        start_m_num = SEASON_START.get(season, 3)
        if start_m_num > end_m:  # winter wraps
            if today.month >= start_m_num:
                season_start_date = date(today.year, start_m_num, 1)
            else:
                season_start_date = date(today.year - 1, start_m_num, 1)
        else:
            season_start_date = date(today.year, start_m_num, 1)
        days_into_season = (today - season_start_date).days
        if days_into_season < half_season:
            return ("due_soon", -days_into_season, None)
        else:
            return ("overdue", -(days_into_season - half_season), None)

    # Not in season — count down to start of next occurrence
    start_m = SEASON_START.get(season, 3)
    target = date(today.year, start_m, 1)
    if target <= today:
        target = date(today.year + 1, start_m, 1)
    days_remaining = (target - today).days
    status = _days_to_status(days_remaining, 7)  # due_soon 1 week before season
    return (status, days_remaining, None)

    return (status, days_remaining, None)


def _days_to_status(days_remaining: int, advance_warning_days: int) -> str:
    if days_remaining < 0:
        return "overdue"
    elif days_remaining <= advance_warning_days:
        return "due_soon"
    else:
        return "ok"


def get_escalation_level(days_overdue: int) -> int:
    """
    0 = not overdue
    1 = 1-7 days overdue  (daily reminder)
    2 = 8-14 days overdue (twice daily)
    3 = 15+ days overdue  (every 12h, urgent)
    """
    if days_overdue <= 0:
        return 0
    elif days_overdue <= 7:
        return 1
    elif days_overdue <= 14:
        return 2
    else:
        return 3


def enrich_task(task: models.Task, asset: models.Asset, current_usage: float = None) -> dict:
    """Returns a dict of computed status fields to attach to task responses."""
    status, days_until_due, usage_until_due = get_task_status(task, asset, current_usage)
    return {
        "status": status,
        "days_until_due": days_until_due,
        "usage_until_due": usage_until_due,
    }
