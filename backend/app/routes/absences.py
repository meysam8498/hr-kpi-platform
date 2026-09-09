"""
Absence routes — attendance tracking.

Feeds the HR absenteeism KPI (one of the top HR KPIs from the
strategicplanning.me framework): absence days per employee/team.
"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AbsenceRecord, Employee, Team, User
from ..auth import get_current_user, require_manager_plus, require_admin_or_hr, visible_team_ids
from ..schemas import AbsenceCreate, AbsenceOut

router = APIRouter(prefix="/api/absences", tags=["Absences"])


def _absence_out(a: AbsenceRecord, db: Session) -> AbsenceOut:
    emp = db.query(Employee).filter(Employee.id == a.employee_id).first()
    team = db.query(Team).filter(Team.id == emp.team_id).first() if emp else None
    return AbsenceOut(
        id=a.id, employee_id=a.employee_id, absence_date=a.absence_date,
        reason=a.reason, created_at=a.created_at,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        team_name=team.name if team else None,
    )


@router.get("/", response_model=list[AbsenceOut])
def list_absences(
    employee_id: int = None,
    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(AbsenceRecord)
    # Employees see only their own absences; managers their team's
    if user.role == "employee":
        if user.employee_id is None:
            return []
        query = query.filter(AbsenceRecord.employee_id == user.employee_id)
    elif user.role == "manager":
        tids = visible_team_ids(user) or []
        if not tids:
            return []
        team_emp_ids = [e.id for e in db.query(Employee).filter(Employee.team_id.in_(tids)).all()]
        query = query.filter(AbsenceRecord.employee_id.in_(team_emp_ids))
    if employee_id:
        query = query.filter(AbsenceRecord.employee_id == employee_id)
    if from_date:
        query = query.filter(AbsenceRecord.absence_date >= from_date)
    if to_date:
        query = query.filter(AbsenceRecord.absence_date <= to_date)
    records = query.order_by(AbsenceRecord.absence_date.desc()).limit(500).all()
    return [_absence_out(r, db) for r in records]


@router.post("/", response_model=AbsenceOut, status_code=201)
def create_absence(request: AbsenceCreate, db: Session = Depends(get_db), _: User = Depends(require_manager_plus)):
    emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    existing = db.query(AbsenceRecord).filter(
        AbsenceRecord.employee_id == request.employee_id,
        AbsenceRecord.absence_date == request.absence_date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="این روز قبلاً به عنوان غیبت ثبت شده است")
    record = AbsenceRecord(
        employee_id=request.employee_id,
        absence_date=request.absence_date,
        reason=request.reason,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _absence_out(record, db)


@router.delete("/{absence_id}")
def delete_absence(absence_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    record = db.query(AbsenceRecord).filter(AbsenceRecord.id == absence_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="رکورد غیبت یافت نشد")
    db.delete(record)
    db.commit()
    return {"message": "رکورد غیبت حذف شد"}


@router.get("/summary")
def absence_summary(

    from_date: date = None,
    to_date: date = None,
    db: Session = Depends(get_db),
):
    """Absence summary per employee + team for a date range (default: current year)."""
    today = date.today()
    start = from_date or date(today.year, 1, 1)
    end = to_date or today

    employees = db.query(Employee).filter(Employee.is_archived == False).all()
    records = db.query(AbsenceRecord).filter(
        AbsenceRecord.absence_date >= start,
        AbsenceRecord.absence_date <= end,
    ).all()

    by_emp = {}
    for r in records:
        by_emp[r.employee_id] = by_emp.get(r.employee_id, 0) + 1

    total_days = sum(by_emp.values())
    # Working days in range (Mon-Sat in Iran; simplified Mon-Fri estimate)
    workdays = sum(1 for i in range((end - start).days + 1)
                   if (start + timedelta(days=i)).weekday() < 6)

    per_employee = []
    for emp in employees:
        days = by_emp.get(emp.id, 0)
        per_employee.append({
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "employee_code": emp.employee_code,
            "team_id": emp.team_id,
            "team_name": emp.team.name if emp.team else None,
            "absence_days": days,
        })
    per_employee.sort(key=lambda x: x["absence_days"], reverse=True)

    # Team aggregation
    team_agg = {}
    for item in per_employee:
        tid = item["team_id"]
        agg = team_agg.setdefault(tid, {"team_id": tid, "team_name": item["team_name"], "days": 0, "members": 0})
        agg["days"] += item["absence_days"]
        agg["members"] += 1
    per_team = sorted(
        [{"team_id": a["team_id"], "team_name": a["team_name"],
          "absence_days": a["days"], "members": a["members"]}
         for a in team_agg.values()],
        key=lambda x: x["absence_days"], reverse=True,
    )

    total_members = len(employees)
    absence_rate = round(total_days / (total_members * workdays), 4) if total_members and workdays else 0.0

    return {
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "workdays": workdays,
        "total_absence_days": total_days,
        "absence_rate": absence_rate,
        "per_employee": per_employee,
        "per_team": per_team,
    }