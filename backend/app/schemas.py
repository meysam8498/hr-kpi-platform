"""
Pydantic schemas — all features.
"""
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ──────────────────────────────────────────────
# Team
# ──────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None

class TeamOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    member_count: int = 0
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Employee
# ──────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=150)
    team_id: int
    hire_date: date
    phone: Optional[str] = None

class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = Field(default=None, max_length=50)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    position: Optional[str] = Field(default=None, max_length=150)
    team_id: Optional[int] = None
    hire_date: Optional[date] = None
    phone: Optional[str] = None
    is_archived: Optional[bool] = None

class EmployeeOut(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    position: str
    team_id: int
    hire_date: date
    phone: Optional[str]
    is_archived: bool = False
    created_at: datetime
    team_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# KPI Criterion
# ──────────────────────────────────────────────
class KPICriterionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = "common"
    min_score: float = 0.0
    max_score: float = 100.0

class KPICriterionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    is_active: Optional[bool] = None

class KPICriterionOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    min_score: float
    max_score: float
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Team KPI Config
# ──────────────────────────────────────────────
class TeamKPIConfigCreate(BaseModel):
    criterion_id: int
    weight: float = Field(ge=0, le=100)

class TeamKPIConfigUpdate(BaseModel):
    weight: Optional[float] = Field(default=None, ge=0, le=100)
    is_active: Optional[bool] = None

class TeamKPIConfigOut(BaseModel):
    id: int
    team_id: int
    criterion_id: int
    criterion_name: Optional[str] = None
    criterion_category: Optional[str] = None
    weight: float
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Reporting Period
# ──────────────────────────────────────────────
class ReportingPeriodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    period_type: str = "quarterly"
    start_date: date
    end_date: date

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        if "start_date" in info.data and v <= info.data["start_date"]:
            raise ValueError("end_date must be after start_date")
        return v

class ReportingPeriodUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    period_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

class ReportingPeriodOut(BaseModel):
    id: int
    name: str
    period_type: str
    start_date: date
    end_date: date
    is_active: bool
    is_archived: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# KPI Entry / Result
# ──────────────────────────────────────────────
class KPIScoreItem(BaseModel):
    criterion_id: int
    score: float = Field(ge=0, le=100)
    comment: Optional[str] = None

class KPIEntryOut(BaseModel):
    id: int
    employee_id: int
    criterion_id: int
    period_id: int
    score: float
    comment: Optional[str]
    criterion_name: Optional[str] = None
    employee_name: Optional[str] = None
    period_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class KPIResultOut(BaseModel):
    id: int
    employee_id: int
    period_id: int
    final_score: float
    breakdown: Optional[dict]
    calculated_at: datetime
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    team_name: Optional[str] = None
    period_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Notification
# ──────────────────────────────────────────────
class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str
    type: str = "info"
    link: Optional[str] = None

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Goal
# ──────────────────────────────────────────────
class GoalCreate(BaseModel):
    employee_id: int
    period_id: int
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    target_value: float = Field(gt=0)
    unit: Optional[str] = None

class GoalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = None
    target_value: Optional[float] = Field(default=None, gt=0)
    current_value: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None

class GoalOut(BaseModel):
    id: int
    employee_id: int
    period_id: int
    title: str
    description: Optional[str]
    target_value: float
    current_value: float
    unit: Optional[str]
    status: str
    created_at: datetime
    employee_name: Optional[str] = None
    period_name: Optional[str] = None
    achievement_pct: float = 0.0
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Peer Review
# ──────────────────────────────────────────────
class PeerReviewCreate(BaseModel):
    reviewer_id: int
    reviewee_id: int
    period_id: int
    teamwork_score: float = Field(ge=0, le=100)
    communication_score: float = Field(ge=0, le=100)
    reliability_score: float = Field(ge=0, le=100)
    comment: Optional[str] = None

class PeerReviewUpdate(BaseModel):
    teamwork_score: Optional[float] = Field(default=None, ge=0, le=100)
    communication_score: Optional[float] = Field(default=None, ge=0, le=100)
    reliability_score: Optional[float] = Field(default=None, ge=0, le=100)
    comment: Optional[str] = None

class PeerReviewOut(BaseModel):
    id: int
    reviewer_id: int
    reviewee_id: int
    period_id: int
    teamwork_score: float
    communication_score: float
    reliability_score: float
    comment: Optional[str]
    created_at: datetime
    reviewer_name: Optional[str] = None
    reviewee_name: Optional[str] = None
    period_name: Optional[str] = None
    avg_score: float = 0.0
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Self Evaluation
# ──────────────────────────────────────────────
class SelfEvaluationCreate(BaseModel):
    employee_id: int
    period_id: int
    self_score: float = Field(ge=0, le=100)
    strengths: Optional[str] = None
    improvements: Optional[str] = None

class SelfEvaluationUpdate(BaseModel):
    self_score: Optional[float] = Field(default=None, ge=0, le=100)
    strengths: Optional[str] = None
    improvements: Optional[str] = None

class SelfEvaluationOut(BaseModel):
    id: int
    employee_id: int
    period_id: int
    self_score: float
    strengths: Optional[str]
    improvements: Optional[str]
    created_at: datetime
    employee_name: Optional[str] = None
    period_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# PIP (Performance Improvement Plan)
# ──────────────────────────────────────────────
class PIPCreate(BaseModel):
    employee_id: int
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    start_date: date
    end_date: date
    target_score: float = 60.0

class PIPUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = None
    target_score: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PIPOut(BaseModel):
    id: int
    employee_id: int
    title: str
    description: Optional[str]
    start_date: date
    end_date: date
    target_score: float
    status: str
    notes: Optional[str]
    created_at: datetime
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    team_name: Optional[str] = None
    latest_score: Optional[float] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Weight Preset
# ──────────────────────────────────────────────
class WeightPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    config_data: dict  # {criterion_id: weight}

class WeightPresetOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    config_data: dict
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Comparison
# ──────────────────────────────────────────────
class CompareRequest(BaseModel):
    employee_ids: list[int] = Field(min_length=2, max_length=5)
    period_id: int


# ──────────────────────────────────────────────
# Custom Report
# ──────────────────────────────────────────────
class CustomReportRequest(BaseModel):
    team_id: Optional[int] = None
    employee_ids: Optional[list[int]] = None
    period_ids: Optional[list[int]] = None
    criteria_ids: Optional[list[int]] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None


# ──────────────────────────────────────────────
# Absence
# ──────────────────────────────────────────────
class AbsenceCreate(BaseModel):
    employee_id: int
    absence_date: date
    reason: Optional[str] = None

class AbsenceOut(BaseModel):
    id: int
    employee_id: int
    absence_date: date
    reason: Optional[str]
    created_at: datetime
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    team_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Audit Log
# ──────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    description: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Team Score Blend
# ──────────────────────────────────────────────
class TeamScoreBlendOut(BaseModel):
    team_id: int
    base_weight: float
    peer_weight: float
    goal_weight: float
    updated_at: datetime
    team_name: Optional[str] = None
    model_config = {"from_attributes": True}

class TeamScoreBlendUpdate(BaseModel):
    base_weight: Optional[float] = Field(default=None, ge=0, le=1)
    peer_weight: Optional[float] = Field(default=None, ge=0, le=1)
    goal_weight: Optional[float] = Field(default=None, ge=0, le=1)


# ──────────────────────────────────────────────
# Bulk Employee Import
# ──────────────────────────────────────────────
class BulkImportItem(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=150)
    team_id: int
    hire_date: date
    phone: Optional[str] = None

class BulkImportResult(BaseModel):
    created: int
    skipped: list[dict]
    errors: list[dict]
