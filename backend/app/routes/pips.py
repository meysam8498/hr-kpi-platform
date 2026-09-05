"""
PIP (Performance Improvement Plan) routes.
Auto-detect employees with <60 score in 2 consecutive periods.
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import PIP, Employee, Team, KPIResult, ReportingPeriod
from ..schemas import PIPCreate, PIPUpdate, PIPOut

router = APIRouter(prefix="/api/pips", tags=["PIPs"])


def _pip_out(pip: PIP, db: Session) -> PIPOut:
    emp = db.query(Employee).filter(Employee.id == pip.employee_id).first()
    team = db.query(Team).filter(Team.id == emp.team_id).first() if emp else None
    latest = db.query(KPIResult).filter(
        KPIResult.employee_id == pip.employee_id
    ).order_by(desc(KPIResult.calculated_at)).first()
    return PIPOut(
        id=pip.id, employee_id=pip.employee_id, title=pip.title,
        description=pip.description, start_date=pip.start_date, end_date=pip.end_date,
        target_score=pip.target_score, status=pip.status, notes=pip.notes,
        created_at=pip.created_at,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        team_name=team.name if team else None,
        latest_score=latest.final_score if latest else None,
    )


@router.get("/", response_model=list[PIPOut])
def list_pips(employee_id: int = None, db: Session = Depends(get_db)):
    query = db.query(PIP)
    if employee_id:
        query = query.filter(PIP.employee_id == employee_id)
    pips = query.order_by(PIP.created_at.desc()).all()
    return [_pip_out(p, db) for p in pips]


@router.post("/", response_model=PIPOut, status_code=201)
def create_pip(request: PIPCreate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    pip = PIP(
        employee_id=request.employee_id, title=request.title,
        description=request.description, start_date=request.start_date,
        end_date=request.end_date, target_score=request.target_score,
    )
    db.add(pip)
    db.commit()
    db.refresh(pip)
    return _pip_out(pip, db)


@router.put("/{pip_id}", response_model=PIPOut)
def update_pip(pip_id: int, request: PIPUpdate, db: Session = Depends(get_db)):
    pip = db.query(PIP).filter(PIP.id == pip_id).first()
    if not pip:
        raise HTTPException(status_code=404, detail="طرح بهبود یافت نشد")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(pip, field, value)
    db.commit()
    db.refresh(pip)
    return _pip_out(pip, db)


@router.delete("/{pip_id}")
def delete_pip(pip_id: int, db: Session = Depends(get_db)):
    pip = db.query(PIP).filter(PIP.id == pip_id).first()
    if not pip:
        raise HTTPException(status_code=404, detail="طرح بهبود یافت نشد")
    db.delete(pip)
    db.commit()
    return {"message": "طرح بهبود حذف شد"}


@router.post("/check-auto")
def check_auto_pips(db: Session = Depends(get_db)):
    """Auto-detect employees with <60 in 2 consecutive periods and create PIPs."""
    periods = db.query(ReportingPeriod).order_by(desc(ReportingPeriod.end_date)).all()
    if len(periods) < 2:
        return {"created": 0, "message": "حداقل ۲ دوره برای بررسی لازم است"}

    # Get last 2 periods
    recent_periods = periods[:2]
    period_ids = [p.id for p in recent_periods]

    employees = db.query(Employee).filter(Employee.is_archived == False).all()
    created = 0

    for emp in employees:
        # Check both periods have results
        results = []
        for pid in period_ids:
            result = db.query(KPIResult).filter(
                KPIResult.employee_id == emp.id,
                KPIResult.period_id == pid,
            ).first()
            results.append(result)

        if all(r is not None for r in results) and all(r.final_score < 60 for r in results):
            # Check if an active PIP already exists
            existing = db.query(PIP).filter(
                PIP.employee_id == emp.id,
                PIP.status == "active",
            ).first()
            if not existing:
                pip = PIP(
                    employee_id=emp.id,
                    title=f"طرح بهبود عملکرد — {emp.full_name}",
                    description=f"عملکرد {emp.full_name} در دو دوره متوالی زیر ۶۰ بوده است. نمرات: {', '.join(f'{r.final_score}' for r in results)}",
                    start_date=date.today(),
                    end_date=date(date.today().year, date.today().month + 3 if date.today().month <= 9 else date.today().month - 9, min(date.today().day, 28)),
                    target_score=60.0,
                )
                db.add(pip)
                created += 1

    db.commit()
    return {"created": created, "message": f"{created} طرح بهبود خودکار ایجاد شد"}
