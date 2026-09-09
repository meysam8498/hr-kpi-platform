"""
Goal routes — individual targets set by admin for each employee.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal, Employee, ReportingPeriod, KPIResult, User
from ..schemas import GoalCreate, GoalUpdate, GoalOut
from ..auth import get_current_user, require_manager_plus, require_admin_or_hr, can_touch_employee

router = APIRouter(prefix="/api/goals", tags=["Goals"])


@router.get("/", response_model=list[GoalOut])
def list_goals(employee_id: int = None, period_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Employees see only their own goals."""
    query = db.query(Goal)
    if user.role == "employee":
        if user.employee_id is None:
            return []
        query = query.filter(Goal.employee_id == user.employee_id)
    if employee_id:
        query = query.filter(Goal.employee_id == employee_id)
    if period_id:
        query = query.filter(Goal.period_id == period_id)
    goals = query.order_by(Goal.created_at.desc()).all()
    result = []
    for g in goals:
        emp = db.query(Employee).filter(Employee.id == g.employee_id).first()
        period = db.query(ReportingPeriod).filter(ReportingPeriod.id == g.period_id).first()
        achievement = round((g.current_value / g.target_value) * 100, 1) if g.target_value > 0 else 0.0
        result.append(GoalOut(
            id=g.id, employee_id=g.employee_id, period_id=g.period_id,
            title=g.title, description=g.description,
            target_value=g.target_value, current_value=g.current_value,
            unit=g.unit, status=g.status, created_at=g.created_at,
            employee_name=emp.full_name if emp else None,
            period_name=period.name if period else None,
            achievement_pct=achievement,
        ))
    return result


@router.post("/", response_model=GoalOut, status_code=201)
def create_goal(request: GoalCreate, db: Session = Depends(get_db), user: User = Depends(require_manager_plus)):
    emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    if user.role == "manager" and not can_touch_employee(user, emp):
        raise HTTPException(status_code=403, detail="این کارمند در محدوده دسترسی شما نیست")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == request.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")
    goal = Goal(
        employee_id=request.employee_id, period_id=request.period_id,
        title=request.title, description=request.description,
        target_value=request.target_value, unit=request.unit,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return GoalOut(
        id=goal.id, employee_id=goal.employee_id, period_id=goal.period_id,
        title=goal.title, description=goal.description,
        target_value=goal.target_value, current_value=goal.current_value,
        unit=goal.unit, status=goal.status, created_at=goal.created_at,
        employee_name=emp.full_name, period_name=period.name, achievement_pct=0.0,
    )


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, request: GoalUpdate, db: Session = Depends(get_db), _: User = Depends(require_manager_plus)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="هدف یافت نشد")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    if goal.current_value >= goal.target_value and goal.status == "active":
        goal.status = "completed"
    db.commit()
    db.refresh(goal)
    emp = db.query(Employee).filter(Employee.id == goal.employee_id).first()
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == goal.period_id).first()
    achievement = round((goal.current_value / goal.target_value) * 100, 1) if goal.target_value > 0 else 0.0
    return GoalOut(
        id=goal.id, employee_id=goal.employee_id, period_id=goal.period_id,
        title=goal.title, description=goal.description,
        target_value=goal.target_value, current_value=goal.current_value,
        unit=goal.unit, status=goal.status, created_at=goal.created_at,
        employee_name=emp.full_name if emp else None,
        period_name=period.name if period else None,
        achievement_pct=achievement,
    )


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="هدف یافت نشد")
    db.delete(goal)
    db.commit()
    return {"message": "هدف حذف شد"}
