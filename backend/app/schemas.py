"""
Pydantic schemas — request validation and API response shapes
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    admin = "admin"
    member = "member"

class PropertyType(str, Enum):
    primary = "primary"
    rental_sfh = "rental_sfh"
    rental_multi = "rental_multi"
    vacation = "vacation"

class IntervalType(str, Enum):
    days = "days"
    months = "months"
    hours = "hours"
    miles = "miles"
    seasonal = "seasonal"
    manual = "manual"

class Season(str, Enum):
    spring = "spring"
    summer = "summer"
    fall = "fall"
    winter = "winter"

class TaskStatus(str, Enum):
    ok = "ok"
    due_soon = "due_soon"
    overdue = "overdue"
    unknown = "unknown"


# ── User ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    display_name: str
    password: str
    role: UserRole = UserRole.member

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    display_name: str
    role: str
    created_at: datetime


# ── Auth ───────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ── Property ───────────────────────────────────────────────────────────────

class PropertyCreate(BaseModel):
    name: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    property_type: PropertyType = PropertyType.primary
    is_default: bool = False
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None

class PropertyUpdate(PropertyCreate):
    name: Optional[str] = None

class PropertyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    property_type: str
    is_default: bool
    purchase_date: Optional[date]
    purchase_price: Optional[float]
    notes: Optional[str]
    created_at: datetime
    asset_count: Optional[int] = 0
    overdue_count: Optional[int] = 0
    due_soon_count: Optional[int] = 0


# ── Asset ──────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    property_id: int
    name: str
    category: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    model_year: Optional[int] = None
    serial_number: Optional[str] = None
    install_date: Optional[date] = None
    expected_lifespan_years: Optional[int] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    warranty_expires: Optional[date] = None
    location_on_property: Optional[str] = None
    current_hours: Optional[float] = None
    current_miles: Optional[float] = None
    icon: Optional[str] = None
    is_loanable: Optional[bool] = False
    custom_fields: Optional[str] = None
    usage_reminder_days: Optional[int] = None

class AssetUpdate(AssetCreate):
    property_id: Optional[int] = None
    name: Optional[str] = None
    model_year: Optional[int] = None
    purchase_date: Optional[date] = None
    custom_fields: Optional[str] = None
    usage_reminder_days: Optional[int] = None

class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    property_id: int
    name: str
    category: Optional[str]
    make: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    install_date: Optional[date]
    expected_lifespan_years: Optional[int]
    purchase_price: Optional[float]
    warranty_expires: Optional[date]
    location_on_property: Optional[str]
    current_hours: Optional[float]
    current_miles: Optional[float]
    icon: Optional[str]
    is_loanable: bool = False
    created_at: datetime
    task_count: Optional[int] = 0
    overdue_count: Optional[int] = 0
    due_soon_count: Optional[int] = 0
    age_years: Optional[float] = None
    replacement_due_soon: Optional[bool] = False
    usage_reminder_days: Optional[int] = None
    usage_reminder_sent_at: Optional[datetime] = None


# ── Task ───────────────────────────────────────────────────────────────────

class PartCreate(BaseModel):
    name: str
    part_number: Optional[str] = None
    supplier: Optional[str] = None
    reorder_url: Optional[str] = None
    last_price: Optional[float] = None
    qty: int = 1
    spec_notes: Optional[str] = None

class QtyUpdate(BaseModel):
    qty: int

class PartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: Optional[int] = None
    task_id: Optional[int] = None
    name: str
    part_number: Optional[str]
    supplier: Optional[str]
    reorder_url: Optional[str]
    last_price: Optional[float]
    qty: int = 1
    spec_notes: Optional[str] = None
    task_name: Optional[str] = None

class TaskCreate(BaseModel):
    asset_id: int
    name: str
    description: Optional[str] = None
    interval: Optional[int] = None
    interval_type: IntervalType
    season: Optional[Season] = None
    advance_warning_days: int = 14
    is_critical: bool = False
    task_group: Optional[str] = None
    tools: Optional[str] = None
    parts: Optional[List[PartCreate]] = []

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    interval: Optional[int] = None
    interval_type: Optional[IntervalType] = None
    season: Optional[Season] = None
    advance_warning_days: Optional[int] = None
    is_critical: Optional[bool] = None
    snoozed_until: Optional[date] = None
    task_group: Optional[str] = None
    sort_order: Optional[int] = None
    tools: Optional[str] = None
    tools: Optional[str] = None

class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    name: str
    description: Optional[str]
    interval: Optional[int]
    interval_type: str
    season: Optional[str]
    advance_warning_days: int
    is_critical: bool = False
    last_completed_at: Optional[datetime]
    last_usage_value: Optional[float]
    snoozed_until: Optional[date] = None
    task_group: Optional[str] = None
    sort_order: int = 0
    tools: Optional[str] = None
    created_at: datetime

    status: Optional[str] = "unknown"
    days_until_due: Optional[int] = None
    usage_until_due: Optional[float] = None
    task_parts: List["TaskPartOut"] = []


# ── Spare Inventory ────────────────────────────────────────────────────────

class SpareCreate(BaseModel):
    asset_id: int
    part_id: Optional[int] = None
    name: str
    part_number: Optional[str] = None
    quantity: int = 1
    storage_location: Optional[str] = None
    notes: Optional[str] = None

class SpareUpdate(BaseModel):
    part_id: Optional[int] = None
    name: Optional[str] = None
    part_number: Optional[str] = None
    quantity: Optional[int] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None

class SpareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    part_id: Optional[int]
    name: str
    part_number: Optional[str]
    quantity: int
    storage_location: Optional[str]
    notes: Optional[str]
    date_added: datetime
    part_name: Optional[str] = None


# ── Completion Log ─────────────────────────────────────────────────────────

class LogCreate(BaseModel):
    task_id: Optional[int] = None
    description: Optional[str] = None  # for freeform entries (no task)
    note: Optional[str] = None
    contractor_id: Optional[int] = None
    cost: Optional[float] = None
    spare_used_id: Optional[int] = None
    usage_value: Optional[float] = None  # current hours/miles at time of completion
    completed_at: Optional[datetime] = None  # defaults to now
    asset_id: Optional[int] = None  # required when task_id is None

class LogUpdate(BaseModel):
    completed_at: Optional[datetime] = None
    note: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    contractor_id: Optional[int] = None

class LogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: Optional[int]
    user_id: Optional[int]
    completed_at: datetime
    note: Optional[str]
    description: Optional[str] = None
    contractor_id: Optional[int]
    cost: Optional[float]
    spare_used_id: Optional[int]
    usage_value: Optional[float]
    user_display_name: Optional[str] = None
    contractor_name: Optional[str] = None
    task_name: Optional[str] = None
    asset_name: Optional[str] = None
    property_name: Optional[str] = None
    interval_type: Optional[str] = None


# ── Paint Record ───────────────────────────────────────────────────────────

class PaintCreate(BaseModel):
    property_id: int
    room_surface: str
    brand: Optional[str] = None
    color_name: Optional[str] = None
    color_code: Optional[str] = None
    sheen: Optional[str] = None
    date_painted: Optional[date] = None
    painted_by: Optional[str] = None
    notes: Optional[str] = None

class PaintUpdate(PaintCreate):
    property_id: Optional[int] = None
    room_surface: Optional[str] = None

class PaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    property_id: int
    room_surface: str
    brand: Optional[str]
    color_name: Optional[str]
    color_code: Optional[str]
    sheen: Optional[str]
    date_painted: Optional[date]
    painted_by: Optional[str]
    notes: Optional[str]
    created_at: datetime


# ── Contractor ─────────────────────────────────────────────────────────────

class AssetContractorCreate(BaseModel):
    contractor_id: int
    notes: Optional[str] = None

class AssetContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    contractor_id: int
    notes: Optional[str]
    contractor_name: Optional[str] = None
    contractor_trade: Optional[str] = None
    contractor_phone: Optional[str] = None
    contractor_email: Optional[str] = None


class ContractorCreate(BaseModel):
    name: str
    trade: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class ContractorUpdate(ContractorCreate):
    name: Optional[str] = None

class ContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    trade: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    created_at: datetime
    job_count: Optional[int] = 0
    total_spend: Optional[float] = 0.0


# ── Asset Note ─────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    asset_id: int
    body: str

class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    body: str
    created_at: datetime
    created_by: Optional[int]
    user_display_name: Optional[str] = None


# ── Usage Log ──────────────────────────────────────────────────────────────

class UsageLogCreate(BaseModel):
    asset_id: int
    value: float
    note: Optional[str] = None

class UsageLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    value: float
    recorded_at: datetime
    recorded_by: Optional[int]
    note: Optional[str]


# ── Dashboard ──────────────────────────────────────────────────────────────

class TaskStatusItem(BaseModel):
    task_id: int
    task_name: str
    asset_id: int
    asset_name: str
    property_id: int
    property_name: str
    status: str
    days_until_due: Optional[int]
    usage_until_due: Optional[float]
    last_completed_at: Optional[datetime]
    asset_category: Optional[str] = None

class GlobalSummary(BaseModel):
    total_properties: int
    total_assets: int
    total_tasks: int
    overdue_count: int
    due_soon_count: int
    overdue_tasks: List[TaskStatusItem]
    due_soon_tasks: List[TaskStatusItem]
    warranty_expiring: List[dict]
    aging_systems: List[dict]


# ── Component ──────────────────────────────────────────────────────────────

class ComponentCreate(BaseModel):
    name: str
    installed_date: Optional[date] = None
    expected_lifespan_years: Optional[float] = None
    notes: Optional[str] = None

class ComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    name: str
    installed_date: Optional[date]
    expected_lifespan_years: Optional[float]
    notes: Optional[str]
    created_at: datetime
    age_years: Optional[float] = None
    expires_soon: Optional[bool] = False
    expired: Optional[bool] = False


# ── Task Parts ─────────────────────────────────────────────────────────────

class TaskPartCreate(BaseModel):
    part_id: int

class TaskPartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    part_id: int
    part_name: Optional[str] = None
    part_number: Optional[str] = None
    part_qty: Optional[int] = 1
    part_spec_notes: Optional[str] = None
    qty_on_hand: Optional[int] = 0

class AssetLoanCreate(BaseModel):
    asset_id: int
    loaned_to: str
    loan_date: date
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None

class AssetLoanReturn(BaseModel):
    returned_date: date

class AssetLoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    asset_id: int
    loaned_to: str
    loan_date: date
    expected_return_date: Optional[date]
    returned_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    asset_name: Optional[str] = None
    property_name: Optional[str] = None
    days_until_due: Optional[int] = None
    status: Optional[str] = None
