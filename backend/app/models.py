"""
SQLAlchemy ORM models — maps to all HomeMaint database tables
M9: Added user_id FK to Property for multi-tenant isolation
M10: Added user tracking fields + UserActivity model
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Date, DateTime,
    ForeignKey, Text, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class PropertyType(str, enum.Enum):
    primary = "primary"
    rental_sfh = "rental_sfh"
    rental_multi = "rental_multi"
    vacation = "vacation"


class IntervalType(str, enum.Enum):
    days = "days"
    months = "months"
    hours = "hours"
    miles = "miles"
    seasonal = "seasonal"


class Season(str, enum.Enum):
    spring = "spring"
    summer = "summer"
    fall = "fall"
    winter = "winter"


class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True, index=True)
    username            = Column(String, unique=True, nullable=False, index=True)
    email               = Column(String, unique=True, nullable=True, index=True)
    display_name        = Column(String, nullable=False)
    password_hash       = Column(String, nullable=False)
    role                = Column(String, default="member", nullable=False)
    is_verified         = Column(Boolean, default=False, nullable=False)
    verify_token        = Column(String, nullable=True)
    reset_token         = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    last_login_at       = Column(DateTime, nullable=True)
    last_seen_at        = Column(DateTime, nullable=True)
    login_count         = Column(Integer, default=0, nullable=False)
    created_at          = Column(DateTime, server_default=func.now())

    properties      = relationship("Property", back_populates="owner")
    completion_logs = relationship("CompletionLog", back_populates="user")
    asset_notes     = relationship("AssetNote", back_populates="user")
    usage_logs      = relationship("UsageLog", back_populates="user")
    activity_logs   = relationship("UserActivity", back_populates="user")


class Property(Base):
    __tablename__ = "properties"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name           = Column(String, nullable=False)
    address_line1  = Column(String)
    address_line2  = Column(String)
    city           = Column(String)
    state          = Column(String)
    zip_code       = Column(String)
    property_type  = Column(String, default="primary")
    is_default     = Column(Boolean, default=False)
    purchase_date  = Column(Date, nullable=True)
    purchase_price = Column(Float, nullable=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())

    owner         = relationship("User", back_populates="properties")
    assets        = relationship("Asset", back_populates="property", cascade="all, delete-orphan")
    paint_records = relationship("PaintRecord", back_populates="property", cascade="all, delete-orphan")
    documents     = relationship("Document", back_populates="property")


class Asset(Base):
    __tablename__ = "assets"

    id                      = Column(Integer, primary_key=True, index=True)
    property_id             = Column(Integer, ForeignKey("properties.id"), nullable=False)
    name                    = Column(String, nullable=False)
    category                = Column(String, nullable=True)
    make                    = Column(String, nullable=True)
    model                   = Column(String, nullable=True)
    serial_number           = Column(String, nullable=True)
    install_date            = Column(Date, nullable=True)
    expected_lifespan_years = Column(Integer, nullable=True)
    purchase_price          = Column(Float, nullable=True)
    warranty_expires        = Column(Date, nullable=True)
    location_on_property    = Column(String, nullable=True)
    current_hours           = Column(Float, nullable=True)
    current_miles           = Column(Float, nullable=True)
    usage_reminder_days     = Column(Integer, nullable=True)
    usage_reminder_sent_at  = Column(DateTime, nullable=True)
    icon                    = Column(String, nullable=True)
    is_loanable             = Column(Boolean, default=False, nullable=False)
    model_year              = Column(Integer, nullable=True)
    custom_fields           = Column(Text, nullable=True)
    purchase_date           = Column(Date, nullable=True)
    created_at              = Column(DateTime, server_default=func.now())

    property          = relationship("Property", back_populates="assets")
    loans             = relationship("AssetLoan", back_populates="asset", cascade="all, delete-orphan")
    tasks             = relationship("Task", back_populates="asset", cascade="all, delete-orphan")
    notes             = relationship("AssetNote", back_populates="asset", cascade="all, delete-orphan")
    spare_inventory   = relationship("SpareInventory", back_populates="asset", cascade="all, delete-orphan")
    usage_logs        = relationship("UsageLog", back_populates="asset", cascade="all, delete-orphan")
    asset_contractors = relationship("AssetContractor", back_populates="asset", cascade="all, delete-orphan")
    components        = relationship("Component", back_populates="asset", cascade="all, delete-orphan")
    documents         = relationship("Document", back_populates="asset")


class AssetNote(Base):
    __tablename__ = "asset_notes"

    id         = Column(Integer, primary_key=True, index=True)
    asset_id   = Column(Integer, ForeignKey("assets.id"), nullable=False)
    body       = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    asset = relationship("Asset", back_populates="notes")
    user  = relationship("User", back_populates="asset_notes")


class Task(Base):
    __tablename__ = "tasks"

    id                   = Column(Integer, primary_key=True, index=True)
    asset_id             = Column(Integer, ForeignKey("assets.id"), nullable=False)
    name                 = Column(String, nullable=False)
    description          = Column(Text, nullable=True)
    interval             = Column(Integer, nullable=True)
    interval_type        = Column(String, nullable=False)
    season               = Column(String, nullable=True)
    advance_warning_days = Column(Integer, default=14)
    is_critical          = Column(Boolean, default=False)
    tools                = Column(Text, nullable=True)
    task_group           = Column(String, nullable=True)
    sort_order           = Column(Integer, default=0)
    last_completed_at    = Column(DateTime, nullable=True)
    last_completed_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_usage_value     = Column(Float, nullable=True)
    snoozed_until        = Column(Date, nullable=True)
    created_at           = Column(DateTime, server_default=func.now())

    asset           = relationship("Asset", back_populates="tasks")
    parts           = relationship("Part", back_populates="task", cascade="all, delete-orphan")
    completion_logs = relationship("CompletionLog", back_populates="task", cascade="all, delete-orphan")
    task_parts      = relationship("TaskPart", back_populates="task", cascade="all, delete-orphan")


class Part(Base):
    __tablename__ = "parts"

    id          = Column(Integer, primary_key=True, index=True)
    task_id     = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    name        = Column(String, nullable=False)
    part_number = Column(String, nullable=True)
    supplier    = Column(String, nullable=True)
    reorder_url = Column(String, nullable=True)
    last_price  = Column(Float, nullable=True)
    qty_on_hand = Column(Integer, default=0, nullable=False)
    qty         = Column(Integer, default=1)
    spec_notes  = Column(String, nullable=True)
    asset_id    = Column(Integer, ForeignKey("assets.id"), nullable=True)
    created_at  = Column(DateTime, server_default=func.now())

    task = relationship("Task", back_populates="parts")


class SpareInventory(Base):
    __tablename__ = "spare_inventory"

    id               = Column(Integer, primary_key=True, index=True)
    asset_id         = Column(Integer, ForeignKey("assets.id"), nullable=False)
    part_id          = Column(Integer, ForeignKey("parts.id"), nullable=True)
    name             = Column(String, nullable=False)
    part_number      = Column(String, nullable=True)
    quantity         = Column(Integer, default=0, nullable=False)
    storage_location = Column(String, nullable=True)
    notes            = Column(Text, nullable=True)
    date_added       = Column(DateTime, server_default=func.now())

    asset = relationship("Asset", back_populates="spare_inventory")
    part  = relationship("Part", foreign_keys=[part_id])


class CompletionLog(Base):
    __tablename__ = "completion_logs"

    id            = Column(Integer, primary_key=True, index=True)
    task_id       = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    asset_id      = Column(Integer, ForeignKey("assets.id"), nullable=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at  = Column(DateTime, server_default=func.now())
    note          = Column(Text, nullable=True)
    description   = Column(Text, nullable=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=True)
    cost          = Column(Float, nullable=True)
    spare_used_id = Column(Integer, ForeignKey("spare_inventory.id"), nullable=True)
    usage_value   = Column(Float, nullable=True)

    task       = relationship("Task", back_populates="completion_logs")
    asset      = relationship("Asset", foreign_keys=[asset_id])
    user       = relationship("User", back_populates="completion_logs")
    contractor = relationship("Contractor", back_populates="completion_logs")


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id          = Column(Integer, primary_key=True, index=True)
    asset_id    = Column(Integer, ForeignKey("assets.id"), nullable=False)
    value       = Column(Float, nullable=False)
    recorded_at = Column(DateTime, server_default=func.now())
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    note        = Column(String, nullable=True)

    asset = relationship("Asset", back_populates="usage_logs")
    user  = relationship("User", back_populates="usage_logs")


class PaintRecord(Base):
    __tablename__ = "paint_records"

    id           = Column(Integer, primary_key=True, index=True)
    property_id  = Column(Integer, ForeignKey("properties.id"), nullable=False)
    room_surface = Column(String, nullable=False)
    brand        = Column(String, nullable=True)
    color_name   = Column(String, nullable=True)
    color_code   = Column(String, nullable=True)
    sheen        = Column(String, nullable=True)
    date_painted = Column(Date, nullable=True)
    painted_by   = Column(String, nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    property = relationship("Property", back_populates="paint_records")


class AssetContractor(Base):
    __tablename__ = "asset_contractors"

    id            = Column(Integer, primary_key=True, index=True)
    asset_id      = Column(Integer, ForeignKey("assets.id"), nullable=False)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=False)
    notes         = Column(String, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    asset      = relationship("Asset", back_populates="asset_contractors")
    contractor = relationship("Contractor", back_populates="asset_contractors")


class Contractor(Base):
    __tablename__ = "contractors"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    trade      = Column(String, nullable=True)
    phone      = Column(String, nullable=True)
    email      = Column(String, nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    completion_logs   = relationship("CompletionLog", back_populates="contractor")
    asset_contractors = relationship("AssetContractor", back_populates="contractor")


class Document(Base):
    __tablename__ = "documents"

    id          = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    asset_id    = Column(Integer, ForeignKey("assets.id"), nullable=True)
    filename    = Column(String, nullable=False)
    label       = Column(String, nullable=True)
    file_path   = Column(String, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())

    property = relationship("Property", back_populates="documents")
    asset    = relationship("Asset", back_populates="documents")


class Component(Base):
    __tablename__ = "components"

    id                      = Column(Integer, primary_key=True, index=True)
    asset_id                = Column(Integer, ForeignKey("assets.id"), nullable=False)
    name                    = Column(String, nullable=False)
    installed_date          = Column(Date, nullable=True)
    expected_lifespan_years = Column(Float, nullable=True)
    notes                   = Column(Text, nullable=True)
    created_at              = Column(DateTime, server_default=func.now())

    asset = relationship("Asset", back_populates="components")


class TaskPart(Base):
    __tablename__ = "task_parts"

    id      = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)

    task = relationship("Task", back_populates="task_parts")
    part = relationship("Part", foreign_keys=[part_id])


class AppSetting(Base):
    __tablename__ = "app_settings"

    key   = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


class AssetLoan(Base):
    __tablename__ = "asset_loans"

    id                   = Column(Integer, primary_key=True, index=True)
    asset_id             = Column(Integer, ForeignKey("assets.id"), nullable=False)
    loaned_to            = Column(String, nullable=False)
    loan_date            = Column(Date, nullable=False)
    expected_return_date = Column(Date, nullable=True)
    returned_date        = Column(Date, nullable=True)
    notes                = Column(Text, nullable=True)
    created_at           = Column(DateTime, server_default=func.now())

    asset = relationship("Asset", back_populates="loans")


class UserActivity(Base):
    __tablename__ = "user_activity"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date        = Column(Date, nullable=False)
    action_type = Column(String, nullable=False)
    count       = Column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'date', 'action_type', name='uq_user_activity'),
    )

    user = relationship("User", back_populates="activity_logs")
