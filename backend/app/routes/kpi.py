"""
KPI Management routes — no auth required.
Includes: criteria, team config, scoring, Excel export/import, reports.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..models import (
    Employee, Team, KPICriterion, TeamKPIConfig,
    KPIEntry, KPIResult, ReportingPeriod, CriterionCategory, TeamScoreBlend,
)
from ..schemas import (
    KPICriterionCreate, KPICriterionUpdate, KPICriterionOut,
    TeamKPIConfigCreate, TeamKPIConfigUpdate, TeamKPIConfigOut,
    ReportingPeriodCreate, ReportingPeriodUpdate, ReportingPeriodOut,
    KPIScoreItem, KPIEntryOut, KPIResultOut,
    TeamScoreBlendOut, TeamScoreBlendUpdate,
)
from ..kpi_engine import (
    calculate_and_store, calculate_team_results,
    calculate_company_results, get_employee_history,
)
from ..excel import export_team_scoring_sheet, import_team_scoring_sheet
from .audit import log_audit

router = APIRouter(prefix="/api/kpi", tags=["KPI Management"])


# ──────────────────────────────────────────────
# KPI Criteria
# ──────────────────────────────────────────────

@router.get("/criteria", response_model=list[KPICriterionOut])
def list_criteria(category: str = None, db: Session = Depends(get_db)):
    query = db.query(KPICriterion).filter(KPICriterion.is_active == True)
    if category:
        query = query.filter(KPICriterion.category == category)
    return query.all()


@router.post("/criteria", response_model=KPICriterionOut, status_code=201)
def create_criterion(request: KPICriterionCreate, db: Session = Depends(get_db)):
    existing = db.query(KPICriterion).filter(KPICriterion.name == request.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="نام معیار تکراری است")
    criterion = KPICriterion(
        name=request.name, description=request.description,
        category=CriterionCategory(request.category),
        min_score=request.min_score, max_score=request.max_score,
    )
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    log_audit(db, "config", "criterion", criterion.id, f"ایجاد معیار KPI «{criterion.name}»")
    db.commit()
    return criterion


@router.put("/criteria/{crit_id}", response_model=KPICriterionOut)
def update_criterion(crit_id: int, request: KPICriterionUpdate, db: Session = Depends(get_db)):
    criterion = db.query(KPICriterion).filter(KPICriterion.id == crit_id).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="معیار یافت نشد")
    update_data = request.model_dump(exclude_unset=True)
    if "category" in update_data:
        update_data["category"] = CriterionCategory(update_data["category"])
    for field, value in update_data.items():
        setattr(criterion, field, value)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.delete("/criteria/{crit_id}")
def delete_criterion(crit_id: int, db: Session = Depends(get_db)):
    criterion = db.query(KPICriterion).filter(KPICriterion.id == crit_id).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="معیار یافت نشد")
    criterion.is_active = False
    db.commit()
    log_audit(db, "config", "criterion", crit_id, f"غیرفعال‌سازی معیار KPI «{criterion.name}»")
    db.commit()
    return {"message": f"معیار '{criterion.name}' غیرفعال شد"}


# ──────────────────────────────────────────────
# Team KPI Configuration
# ──────────────────────────────────────────────

@router.get("/teams/{team_id}/config", response_model=list[TeamKPIConfigOut])
def get_team_config(team_id: int, db: Session = Depends(get_db)):
    configs = db.query(TeamKPIConfig).filter(TeamKPIConfig.team_id == team_id).all()
    result = []
    for cfg in configs:
        crit = db.query(KPICriterion).filter(KPICriterion.id == cfg.criterion_id).first()
        result.append(TeamKPIConfigOut(
            id=cfg.id, team_id=cfg.team_id, criterion_id=cfg.criterion_id,
            criterion_name=crit.name if crit else None,
            criterion_category=crit.category.value if crit else None,
            weight=cfg.weight, is_active=cfg.is_active, created_at=cfg.created_at,
        ))
    return result


@router.post("/teams/{team_id}/config", response_model=TeamKPIConfigOut, status_code=201)
def add_team_config(team_id: int, request: TeamKPIConfigCreate, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    criterion = db.query(KPICriterion).filter(KPICriterion.id == request.criterion_id).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="معیار یافت نشد")
    existing = db.query(TeamKPIConfig).filter(
        TeamKPIConfig.team_id == team_id, TeamKPIConfig.criterion_id == request.criterion_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="این معیار قبلاً برای تیم تنظیم شده")
    config = TeamKPIConfig(team_id=team_id, criterion_id=request.criterion_id, weight=request.weight)
    db.add(config)
    db.commit()
    db.refresh(config)
    log_audit(db, "config", "team_config", config.id,
              f"افزودن معیار «{criterion.name}» به تیم «{team.name}» با وزن {request.weight}")
    db.commit()
    return TeamKPIConfigOut(
        id=config.id, team_id=config.team_id, criterion_id=config.criterion_id,
        criterion_name=criterion.name, criterion_category=criterion.category.value,
        weight=config.weight, is_active=config.is_active, created_at=config.created_at,
    )


@router.put("/teams/{team_id}/config/{config_id}", response_model=TeamKPIConfigOut)
def update_team_config(team_id: int, config_id: int, request: TeamKPIConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(TeamKPIConfig).filter(
        TeamKPIConfig.id == config_id, TeamKPIConfig.team_id == team_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="تنظیم یافت نشد")
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    crit = db.query(KPICriterion).filter(KPICriterion.id == config.criterion_id).first()
    return TeamKPIConfigOut(
        id=config.id, team_id=config.team_id, criterion_id=config.criterion_id,
        criterion_name=crit.name if crit else None,
        criterion_category=crit.category.value if crit else None,
        weight=config.weight, is_active=config.is_active, created_at=config.created_at,
    )


@router.delete("/teams/{team_id}/config/{config_id}")
def remove_team_config(team_id: int, config_id: int, db: Session = Depends(get_db)):
    config = db.query(TeamKPIConfig).filter(
        TeamKPIConfig.id == config_id, TeamKPIConfig.team_id == team_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="تنظیم یافت نشد")
    db.delete(config)
    db.commit()
    log_audit(db, "config", "team_config", config_id, "حذف معیار از تنظیمات تیم")
    db.commit()
    return {"message": "معیار از تنظیمات تیم حذف شد"}


# ──────────────────────────────────────────────
# Team Score Blend (peer-review + goal achievement weights)
# ──────────────────────────────────────────────

@router.get("/teams/{team_id}/blend", response_model=TeamScoreBlendOut)
def get_team_blend(team_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    blend = db.query(TeamScoreBlend).filter(TeamScoreBlend.team_id == team_id).first()
    if not blend:
        # Return defaults (not persisted)
        return TeamScoreBlendOut(team_id=team_id, team_name=team.name,
                                 base_weight=0.70, peer_weight=0.15, goal_weight=0.15,
                                 updated_at=datetime.utcnow())
    return TeamScoreBlendOut(team_id=team_id, team_name=team.name,
                             base_weight=blend.base_weight, peer_weight=blend.peer_weight,
                             goal_weight=blend.goal_weight, updated_at=blend.updated_at)


@router.put("/teams/{team_id}/blend", response_model=TeamScoreBlendOut)
def set_team_blend(team_id: int, request: TeamScoreBlendUpdate, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    blend = db.query(TeamScoreBlend).filter(TeamScoreBlend.team_id == team_id).first()
    if not blend:
        blend = TeamScoreBlend(team_id=team_id)
        db.add(blend)
    data = request.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(blend, field, value)
    # Auto-normalize weights to sum to 1
    s = blend.base_weight + blend.peer_weight + blend.goal_weight
    if s > 0:
        blend.base_weight = round(blend.base_weight / s, 4)
        blend.peer_weight = round(blend.peer_weight / s, 4)
        blend.goal_weight = round(blend.goal_weight / s, 4)
    db.commit()
    db.refresh(blend)
    log_audit(db, "config", "team_blend", team_id,
              f"تنظیم ترکیب نمره برای تیم «{team.name}»: پایه {blend.base_weight}, همکاران {blend.peer_weight}, اهداف {blend.goal_weight}")
    db.commit()
    return TeamScoreBlendOut(team_id=team_id, team_name=team.name,
                             base_weight=blend.base_weight, peer_weight=blend.peer_weight,
                             goal_weight=blend.goal_weight, updated_at=blend.updated_at)


# ──────────────────────────────────────────────
# Reporting Periods
# ──────────────────────────────────────────────

@router.get("/periods", response_model=list[ReportingPeriodOut])
def list_periods(db: Session = Depends(get_db)):
    return db.query(ReportingPeriod).order_by(ReportingPeriod.start_date.desc()).all()


@router.post("/periods", response_model=ReportingPeriodOut, status_code=201)
def create_period(request: ReportingPeriodCreate, db: Session = Depends(get_db)):
    period = ReportingPeriod(
        name=request.name, period_type=request.period_type,
        start_date=request.start_date, end_date=request.end_date,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    log_audit(db, "config", "period", period.id, f"ایجاد دوره «{period.name}»")
    db.commit()
    return period


@router.put("/periods/{period_id}", response_model=ReportingPeriodOut)
def update_period(period_id: int, request: ReportingPeriodUpdate, db: Session = Depends(get_db)):
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")
    update_data = request.model_dump(exclude_unset=True)
    # If activating this period, deactivate all others
    if update_data.get("is_active"):
        db.query(ReportingPeriod).filter(ReportingPeriod.is_active == True).update({"is_active": False})
    for field, value in update_data.items():
        setattr(period, field, value)
    db.commit()
    db.refresh(period)
    log_audit(db, "config", "period", period_id, f"به‌روزرسانی دوره «{period.name}»")
    db.commit()
    return period


@router.delete("/periods/{period_id}")
def delete_period(period_id: int, db: Session = Depends(get_db)):
    """Delete a period and everything attached to it (scores, results, goals,
    peer reviews, self-evaluations, PIPs). Intended for removing test periods."""
    from ..models import KPIEntry, KPIResult, Goal, PeerReview, SelfEvaluation

    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    was_active = period.is_active
    name = period.name

    # Clear dependent rows first (SQLite lacks enforced FK cascade here).
    # PIP rows are period-independent (date-range based), so they survive.
    db.query(KPIEntry).filter(KPIEntry.period_id == period_id).delete()
    db.query(KPIResult).filter(KPIResult.period_id == period_id).delete()
    db.query(Goal).filter(Goal.period_id == period_id).delete()
    db.query(PeerReview).filter(PeerReview.period_id == period_id).delete()
    db.query(SelfEvaluation).filter(SelfEvaluation.period_id == period_id).delete()
    db.delete(period)
    db.commit()

    log_audit(db, "config", "period", period_id, f"حذف دوره «{name}» به همراه تمام داده‌های آن")
    db.commit()
    return {"message": f"دوره «{name}» و تمام داده‌های وابسته به آن حذف شد", "was_active": was_active}


# ──────────────────────────────────────────────
# KPI Scoring (manual)
# ──────────────────────────────────────────────

@router.get("/entries", response_model=list[KPIEntryOut])
def list_entries(employee_id: int = None, period_id: int = None, db: Session = Depends(get_db)):
    query = db.query(KPIEntry)
    if employee_id:
        query = query.filter(KPIEntry.employee_id == employee_id)
    if period_id:
        query = query.filter(KPIEntry.period_id == period_id)
    entries = query.all()
    result = []
    for e in entries:
        emp = db.query(Employee).filter(Employee.id == e.employee_id).first()
        crit = db.query(KPICriterion).filter(KPICriterion.id == e.criterion_id).first()
        period = db.query(ReportingPeriod).filter(ReportingPeriod.id == e.period_id).first()
        result.append(KPIEntryOut(
            id=e.id, employee_id=e.employee_id, criterion_id=e.criterion_id,
            period_id=e.period_id, score=e.score, comment=e.comment,
            criterion_name=crit.name if crit else None,
            employee_name=emp.full_name if emp else None,
            period_name=period.name if period else None,
            created_at=e.created_at,
        ))
    return result


@router.post("/entries/batch")
def batch_score(employee_id: int, period_id: int, scores: list[KPIScoreItem], db: Session = Depends(get_db)):
    """Batch score: submit all criteria scores for one employee."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    count = 0
    for item in scores:
        criterion = db.query(KPICriterion).filter(KPICriterion.id == item.criterion_id).first()
        if not criterion:
            continue
        if not (criterion.min_score <= item.score <= criterion.max_score):
            continue

        existing = db.query(KPIEntry).filter(
            KPIEntry.employee_id == employee_id,
            KPIEntry.criterion_id == item.criterion_id,
            KPIEntry.period_id == period_id,
        ).first()

        if existing:
            existing.score = item.score
            existing.comment = item.comment
        else:
            entry = KPIEntry(
                employee_id=employee_id, criterion_id=item.criterion_id,
                period_id=period_id, score=item.score, comment=item.comment,
            )
            db.add(entry)
        count += 1

    db.commit()
    log_audit(db, "score", "entry", None,
              f"ثبت {count} نمره برای «{employee.full_name}» در دوره «{period.name}»")
    db.commit()
    return {"message": f"{count} نمره ثبت شد"}


# ──────────────────────────────────────────────
# Excel Export / Import
# ──────────────────────────────────────────────

@router.get("/export/{team_id}/{period_id}")
def export_excel(team_id: int, period_id: int, db: Session = Depends(get_db)):
    """Download Excel scoring sheet for a team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    buffer = export_team_scoring_sheet(team_id, period_id, db)
    # Use ASCII-safe filename for Content-Disposition
    safe_name = f"KPI_Team{team_id}_Period{period_id}"

    from urllib.parse import quote
    # Persian name in UTF-8 for modern browsers, ASCII fallback
    persian_name = f"KPI_{team.name}_{period.name}".replace(" ", "_")
    encoded_persian = quote(f"{persian_name}.xlsx")

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={safe_name}.xlsx; filename*=UTF-8''{encoded_persian}"},
    )


@router.post("/import/{team_id}/{period_id}")
async def import_excel(team_id: int, period_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload filled Excel scoring sheet to update scores."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    content = await file.read()
    result = import_team_scoring_sheet(team_id, period_id, content, db)
    return result


# ──────────────────────────────────────────────
# KPI Calculation & Results
# NOTE: specific routes (company, team) MUST come before generic {employee_id}
# ──────────────────────────────────────────────

@router.post("/calculate/company/{period_id}")
def calculate_company(period_id: int, db: Session = Depends(get_db)):
    return calculate_company_results(period_id, db)


@router.post("/calculate/team/{team_id}/{period_id}")
def calculate_team(team_id: int, period_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    results = calculate_team_results(team_id, period_id, db)
    return {"team_id": team_id, "period_id": period_id, "results": results}


@router.post("/calculate/{employee_id}/{period_id}", response_model=KPIResultOut)
def calculate_employee(employee_id: int, period_id: int, db: Session = Depends(get_db)):
    result = calculate_and_store(employee_id, period_id, db)
    if result is None:
        raise HTTPException(status_code=400, detail="تنظیمات KPI برای تیم یافت نشد")
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    team = db.query(Team).filter(Team.id == emp.team_id).first() if emp else None
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    return KPIResultOut(
        id=result.id, employee_id=result.employee_id, period_id=result.period_id,
        final_score=result.final_score, breakdown=result.breakdown,
        calculated_at=result.calculated_at,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        team_name=team.name if team else None,
        period_name=period.name if period else None,
    )


@router.get("/results/{employee_id}", response_model=list[KPIResultOut])
def get_employee_results(employee_id: int, db: Session = Depends(get_db)):
    results = db.query(KPIResult).filter(KPIResult.employee_id == employee_id).all()
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    team = db.query(Team).filter(Team.id == emp.team_id).first() if emp else None
    out = []
    for r in results:
        period = db.query(ReportingPeriod).filter(ReportingPeriod.id == r.period_id).first()
        out.append(KPIResultOut(
            id=r.id, employee_id=r.employee_id, period_id=r.period_id,
            final_score=r.final_score, breakdown=r.breakdown, calculated_at=r.calculated_at,
            employee_name=emp.full_name if emp else None,
            employee_code=emp.employee_code if emp else None,
            team_name=team.name if team else None,
            period_name=period.name if period else None,
        ))
    return out


@router.get("/history/{employee_id}")
def employee_history(employee_id: int, db: Session = Depends(get_db)):
    return get_employee_history(employee_id, db)


@router.get("/reports/team/{team_id}/{period_id}")
def team_report(team_id: int, period_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    employees = db.query(Employee).filter(Employee.team_id == team_id).all()
    members = []
    for emp in employees:
        result = db.query(KPIResult).filter(
            KPIResult.employee_id == emp.id, KPIResult.period_id == period_id
        ).first()
        if result:
            members.append({
                "employee_id": emp.id, "employee_name": emp.full_name,
                "employee_code": emp.employee_code, "final_score": result.final_score,
                "breakdown": result.breakdown,
            })
    scores = [m["final_score"] for m in members]
    return {
        "team_id": team_id, "team_name": team.name,
        "period_id": period_id, "period_name": period.name if period else None,
        "avg_score": round(sum(scores) / len(scores), 2) if scores else 0.0,
        "member_count": len(employees), "members": members,
    }


@router.get("/reports/company/{period_id}")
def company_report(period_id: int, db: Session = Depends(get_db)):
    return calculate_company_results(period_id, db)


# ──────────────────────────────────────────────
# Auto-archive periods (>3 months past end_date)
# ──────────────────────────────────────────────

from datetime import timedelta, date

ARCHIVE_MONTHS = 3

def _compute_cutoff() -> date:
    """Compute date exactly ARCHIVE_MONTHS months before today."""
    today = date.today()
    m = today.month - ARCHIVE_MONTHS
    y = today.year
    while m <= 0:
        m += 12
        y -= 1
    d = min(today.day, 28)  # safe day for any month
    return date(y, m, d)

@router.post("/periods/auto-archive")
def auto_archive_periods(db: Session = Depends(get_db)):
    """Archive periods where end_date is more than 3 months ago."""
    cutoff = _compute_cutoff()
    expired = db.query(ReportingPeriod).filter(
        ReportingPeriod.end_date < cutoff,
        ReportingPeriod.is_archived == False,
    ).all()
    count = 0
    for period in expired:
        period.is_archived = True
        if period.is_active:
            period.is_active = False
        count += 1
    db.commit()
    return {"message": f"{count} دوره آرشیو شد", "archived_count": count}


def run_auto_archive(db: Session):
    """Called on startup to auto-archive expired periods."""
    cutoff = _compute_cutoff()
    expired = db.query(ReportingPeriod).filter(
        ReportingPeriod.end_date < cutoff,
        ReportingPeriod.is_archived == False,
    ).all()
    for period in expired:
        period.is_archived = True
        if period.is_active:
            period.is_active = False
    if expired:
        db.commit()
        print(f"[OK] Auto-archived {len(expired)} expired periods.")
