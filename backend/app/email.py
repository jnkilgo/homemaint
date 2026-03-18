"""
Email sending via Resend (https://resend.com) — free tier is 3,000 emails/month.
Set RESEND_API_KEY env var. Set APP_BASE_URL to your Railway domain.

To switch to SendGrid: replace the _send() implementation.
"""

import os
import httpx
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL     = os.getenv("FROM_EMAIL", "HomeMaint <noreply@yourdomain.com>")
BASE_URL       = os.getenv("APP_BASE_URL", "http://localhost:8000")


def _send(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set — skipping email to {to}. Subject: {subject}")
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to}: {e}")
        return False


def send_verify_email(to: str, name: str, token: str) -> bool:
    link = f"{BASE_URL}/verify-email?token={token}"
    html = f"""
    <p>Hi {name},</p>
    <p>Thanks for signing up for HomeMaint. Click the link below to verify your email:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link does not expire.</p>
    <p>— HomeMaint</p>
    """
    return _send(to, "Verify your HomeMaint email", html)


def send_reset_email(to: str, name: str, token: str) -> bool:
    link = f"{BASE_URL}/reset-password?token={token}"
    html = f"""
    <p>Hi {name},</p>
    <p>A password reset was requested for your HomeMaint account. Click the link below:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    <p>— HomeMaint</p>
    """
    return _send(to, "Reset your HomeMaint password", html)
