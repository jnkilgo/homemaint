from typing import Optional
from datetime import datetime, date as date_type
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import secrets

from app.database import get_db
from app.auth import verify_password, create_access_token, hash_password, get_current_user
from app import models, schemas
from app.email import send_verify_email, send_reset_email

router = APIRouter()

REGISTRATION_OPEN = True  # Set False to disable self-signup


class RegisterRequest(BaseModel):
    username: str
    email: Optional[str] = None
    display_name: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/token", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Update login tracking fields
    now = datetime.utcnow()
    user.last_login_at = now
    user.last_seen_at = now
    user.login_count = (user.login_count or 0) + 1

    # Upsert daily activity record for login
    today = date_type.today()
    activity = db.query(models.UserActivity).filter(
        models.UserActivity.user_id == user.id,
        models.UserActivity.date == today,
        models.UserActivity.action_type == "login",
    ).first()
    if activity:
        activity.count += 1
    else:
        db.add(models.UserActivity(
            user_id=user.id,
            date=today,
            action_type="login",
            count=1,
        ))

    db.commit()

    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(payload: RegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not REGISTRATION_OPEN:
        raise HTTPException(403, "Registration is currently closed")

    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(400, "Username already taken")

    if payload.email and db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "Email already registered")

    verify_token = secrets.token_urlsafe(32)

    user = models.User(
        username=payload.username,
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        role="member",
        is_verified=True,
        verify_token=verify_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(send_verify_email, user.email, user.display_name, verify_token)

    return user


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.verify_token == token).first()
    if not user:
        raise HTTPException(400, "Invalid or expired verification token")
    user.is_verified = True
    user.verify_token = None
    db.commit()
    return {"ok": True, "message": "Email verified. You can now log in."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    # Always return 200 to avoid email enumeration
    if user:
        from datetime import datetime, timedelta
        reset_token = secrets.token_urlsafe(32)
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        background_tasks.add_task(send_reset_email, user.email, user.display_name, reset_token)
    return {"ok": True, "message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    user = db.query(models.User).filter(models.User.reset_token == payload.token).first()
    if not user:
        raise HTTPException(400, "Invalid or expired reset token")
    if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
        raise HTTPException(400, "Reset token has expired")
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"ok": True, "message": "Password reset successfully."}
