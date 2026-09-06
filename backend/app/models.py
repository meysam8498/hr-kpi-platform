"""
SQLAlchemy ORM Models — KPI Management System (No Auth).

Single admin manages everything:
- Teams, Employees, KPI Criteria, Entries, Results
- Notifications (in-app alerts & reminders)
- Goals (individual targets set by admin)
- Peer Reviews (360-degree evaluation)
- Self Evaluations (employee self-assessment)
- PIPs (Performance Improvement Plans)
- Weight Presets (reusable KPI weight configurations)
"""
import enum
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean,
    DateTime, Date, Enum, ForeignKey, UniqueConstraint,
    JSON, Index,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .database import Base


class PeriodType(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"


class CriterionCategory(str, enum.Enum):
    COMMON = "common"
    TEAM_SPECIFIC = "team_specific"


# ──────────────────────────────────────────────
# Team
# ──────────────────────────────────────────────
class User(Base):
    """Login accounts. Roles:
    - admin:  full control incl. users, config, periods, backup
    - hr:     HR manager — sees everything, controls periods/scoring, no user management
    - manager: team manager — scores own team only, sees own-team reports
    - employee: sees own reports and own self-evaluation only
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="employee")  # admin/hr/manager/employee
    team_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("teams.id"), nullable=True)  # for managers/employees
    employee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)  # link employee self-view
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship("Team")
    employee: Mapped["Employee"] = relationship("Employee")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members: Mapped[list["Employee"]] = relationship("Employee", back_populates="team", cascade="all, delete-orphan")
    kpi_configs: Mapped[list["TeamKPIConfig"]] = relationship("TeamKPIConfig", back_populates="team", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# Employee
# ──────────────────────────────────────────────
class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[str] = mapped_column(String(150), nullable=False)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False)
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    kpi_entries: Mapped[list["KPIEntry"]] = relationship("KPIEntry", back_populates="employee", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="employee", cascade="all, delete-orphan")
    peer_reviews_given: Mapped[list["PeerReview"]] = relationship("PeerReview", foreign_keys="PeerReview.reviewer_id", back_populates="reviewer")
    peer_reviews_received: Mapped[list["PeerReview"]] = relationship("PeerReview", foreign_keys="PeerReview.reviewee_id", back_populates="reviewee")
    self_evaluations: Mapped[list["SelfEvaluation"]] = relationship("SelfEvaluation", back_populates="employee", cascade="all, delete-orphan")
    pips: Mapped[list["PIP"]] = relationship("PIP", back_populates="employee", cascade="all, delete-orphan")
    absences: Mapped[list["AbsenceRecord"]] = relationship("AbsenceRecord", back_populates="employee", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# ──────────────────────────────────────────────
# KPI Criterion
# ──────────────────────────────────────────────
class KPICriterion(Base):
    __tablename__ = "kpi_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[CriterionCategory] = mapped_column(
        Enum(CriterionCategory), nullable=False, default=CriterionCategory.COMMON
    )
    min_score: Mapped[float] = mapped_column(Float, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, default=100.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team_configs: Mapped[list["TeamKPIConfig"]] = relationship("TeamKPIConfig", back_populates="criterion")
    entries: Mapped[list["KPIEntry"]] = relationship("KPIEntry", back_populates="criterion")


# ──────────────────────────────────────────────
# Team KPI Config (Weight Assignment)
# ──────────────────────────────────────────────
class TeamKPIConfig(Base):
    __tablename__ = "team_kpi_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False)
    criterion_id: Mapped[int] = mapped_column(Integer, ForeignKey("kpi_criteria.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped["Team"] = relationship("Team", back_populates="kpi_configs")
    criterion: Mapped["KPICriterion"] = relationship("KPICriterion", back_populates="team_configs")

    __table_args__ = (
        UniqueConstraint("team_id", "criterion_id", name="uq_team_criterion"),
    )


# ──────────────────────────────────────────────
# Reporting Period
# ──────────────────────────────────────────────
class ReportingPeriod(Base):
    __tablename__ = "reporting_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    period_type: Mapped[PeriodType] = mapped_column(Enum(PeriodType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entries: Mapped[list["KPIEntry"]] = relationship("KPIEntry", back_populates="period")


# ──────────────────────────────────────────────
# KPI Entry (Score Record)
# ──────────────────────────────────────────────
class KPIEntry(Base):
    __tablename__ = "kpi_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    criterion_id: Mapped[int] = mapped_column(Integer, ForeignKey("kpi_criteria.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("reporting_periods.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="kpi_entries")
    criterion: Mapped["KPICriterion"] = relationship("KPICriterion", back_populates="entries")
    period: Mapped["ReportingPeriod"] = relationship("ReportingPeriod", back_populates="entries")

    __table_args__ = (
        UniqueConstraint("employee_id", "criterion_id", "period_id", name="uq_entry"),
    )


# ──────────────────────────────────────────────
# KPI Result (Calculated — Cached)
# ──────────────────────────────────────────────
class KPIResult(Base):
    __tablename__ = "kpi_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("reporting_periods.id"), nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee")
    period: Mapped["ReportingPeriod"] = relationship("ReportingPeriod")

    __table_args__ = (
        UniqueConstraint("employee_id", "period_id", name="uq_result"),
    )


# ──────────────────────────────────────────────
# Notification (In-App Alerts & Reminders)
# ──────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="info")  # info, warning, success, deadline
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ──────────────────────────────────────────────
# Goal (Individual Targets)
# ──────────────────────────────────────────────
class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("reporting_periods.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g. "lines", "clients", "%"
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, missed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="goals")
    period: Mapped["ReportingPeriod"] = relationship("ReportingPeriod")


# ──────────────────────────────────────────────
# Peer Review (360-Degree Evaluation)
# ──────────────────────────────────────────────
class PeerReview(Base):
    __tablename__ = "peer_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reviewer_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    reviewee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("reporting_periods.id"), nullable=False)
    teamwork_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    communication_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    reliability_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    reviewer: Mapped["Employee"] = relationship("Employee", foreign_keys=[reviewer_id], back_populates="peer_reviews_given")
    reviewee: Mapped["Employee"] = relationship("Employee", foreign_keys=[reviewee_id], back_populates="peer_reviews_received")
    period: Mapped["ReportingPeriod"] = relationship("ReportingPeriod")

    __table_args__ = (
        UniqueConstraint("reviewer_id", "reviewee_id", "period_id", name="uq_peer_review"),
    )


# ──────────────────────────────────────────────
# Self Evaluation
# ──────────────────────────────────────────────
class SelfEvaluation(Base):
    __tablename__ = "self_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("reporting_periods.id"), nullable=False)
    self_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    improvements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="self_evaluations")
    period: Mapped["ReportingPeriod"] = relationship("ReportingPeriod")

    __table_args__ = (
        UniqueConstraint("employee_id", "period_id", name="uq_self_eval"),
    )


# ──────────────────────────────────────────────
# PIP (Performance Improvement Plan)
# ──────────────────────────────────────────────
class PIP(Base):
    __tablename__ = "pips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    target_score: Mapped[float] = mapped_column(Float, default=60.0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, cancelled
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="pips")


# ──────────────────────────────────────────────
# Weight Preset (Reusable Templates)
# ──────────────────────────────────────────────
class WeightPreset(Base):
    __tablename__ = "weight_presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config_data: Mapped[dict] = mapped_column(JSON, nullable=False)  # {criterion_id: weight}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ──────────────────────────────────────────────
# Team Score Blend (how peer-review + goals blend into final KPI)
# ──────────────────────────────────────────────
class TeamScoreBlend(Base):
    __tablename__ = "team_score_blends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), unique=True, nullable=False)
    base_weight: Mapped[float] = mapped_column(Float, default=0.70)   # weighted KPI score weight
    peer_weight: Mapped[float] = mapped_column(Float, default=0.15)   # 360 peer-review weight
    goal_weight: Mapped[float] = mapped_column(Float, default=0.15)   # goal achievement weight
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team: Mapped["Team"] = relationship("Team")


# ──────────────────────────────────────────────
# Absence Record (attendance tracking)
# ──────────────────────────────────────────────
class AbsenceRecord(Base):
    __tablename__ = "absence_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    absence_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="absences")

    __table_args__ = (
        UniqueConstraint("employee_id", "absence_date", name="uq_absence"),
    )


# ──────────────────────────────────────────────
# Audit Log (compliance trail)
# ──────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # create, update, delete, score, archive, transfer, config
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # employee, team, criterion, entry, period
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
