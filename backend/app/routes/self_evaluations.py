"""
Self-Evaluation routes — employee self-assessment panel.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SelfEvaluation, Employee, ReportingPeriod, User
from ..schemas import SelfEvaluationCreate, SelfEvaluationUpdate, SelfEvaluationOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/self-evaluations", tags=["Self Evaluations"])


def _se_out(se: SelfEvaluation, db: Session) -> SelfEvaluationOut:
    emp = db.query(Employee).filter(Employee.id == se.employee_id).first()
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == se.period_id).first()
    return SelfEvaluationOut(
        id=se.id, employee_id=se.employee_id, period_id=se.period_id,
        self_score=se.self_score, strengths=se.strengths, improvements=se.improvements,
        created_at=se.created_at,
        employee_name=emp.full_name if emp else None,
        period_name=period.name if period else None,
    )


@router.get("/", response_model=list[SelfEvaluationOut])
def list_self_evals(employee_id: int = None, period_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Employees see only their own self-evaluations."""
    query = db.query(SelfEvaluation)
    if user.role == "employee":
        if user.employee_id is None:
            return []
        query = query.filter(SelfEvaluation.employee_id == user.employee_id)
    if employee_id:
        query = query.filter(SelfEvaluation.employee_id == employee_id)
    if period_id:
        query = query.filter(SelfEvaluation.period_id == period_id)
    return [_se_out(s, db) for s in query.all()]


@router.post("/", response_model=SelfEvaluationOut, status_code=201)
def create_self_eval(request: SelfEvaluationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Employees can only create their OWN self-evaluation
    if user.role == "employee" and (user.employee_id is None or int(request.employee_id) != int(user.employee_id)):
        raise HTTPException(status_code=403, detail="فقط می‌توانید خودارزیابی خودتان را ثبت کنید")
    emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == request.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")
    existing = db.query(SelfEvaluation).filter(
        SelfEvaluation.employee_id == request.employee_id,
        SelfEvaluation.period_id == request.period_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="خودارزیابی برای این دوره قبلاً ثبت شده")
    se = SelfEvaluation(
        employee_id=request.employee_id, period_id=request.period_id,
        self_score=request.self_score, strengths=request.strengths,
        improvements=request.improvements,
    )
    db.add(se)
    db.commit()
    db.refresh(se)
    return _se_out(se, db)


@router.put("/{se_id}", response_model=SelfEvaluationOut)
def update_self_eval(se_id: int, request: SelfEvaluationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    se = db.query(SelfEvaluation).filter(SelfEvaluation.id == se_id).first()
    if not se:
        raise HTTPException(status_code=404, detail="خودارزیابی یافت نشد")
    if user.role == "employee" and (user.employee_id is None or se.employee_id != user.employee_id):
        raise HTTPException(status_code=403, detail="فقط خودارزیابی خودتان قابل ویرایش است")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(se, field, value)
    db.commit()
    db.refresh(se)
    return _se_out(se, db)


@router.delete("/{se_id}")
def delete_self_eval(se_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    se = db.query(SelfEvaluation).filter(SelfEvaluation.id == se_id).first()
    if not se:
        raise HTTPException(status_code=404, detail="خودارزیابی یافت نشد")
    if user.role == "employee" and (user.employee_id is None or se.employee_id != user.employee_id):
        raise HTTPException(status_code=403, detail="فقط خودارزیابی خودتان قابل حذف است")
    db.delete(se)
    db.commit()
    return {"message": "خودارزیابی حذف شد"}
