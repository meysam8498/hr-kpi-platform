"""
Peer Review routes — lightweight 360-degree evaluation.

Teammates score each other on teamwork, communication, and reliability
(0-100 each). Averages per reviewee can be blended into the final score.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import PeerReview, Employee, ReportingPeriod, User
from ..schemas import PeerReviewCreate, PeerReviewUpdate, PeerReviewOut
from ..auth import (
    get_current_user, require_manager_plus, require_admin_or_hr,
    ensure_employee_in_scope, ensure_own_employee,
    visible_team_ids, can_touch_employee,
)

router = APIRouter(prefix="/api/peer-reviews", tags=["Peer Reviews"])


def _review_out(r: PeerReview, db: Session) -> PeerReviewOut:
    reviewer = db.query(Employee).filter(Employee.id == r.reviewer_id).first()
    reviewee = db.query(Employee).filter(Employee.id == r.reviewee_id).first()
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == r.period_id).first()
    avg = round((r.teamwork_score + r.communication_score + r.reliability_score) / 3, 1)
    return PeerReviewOut(
        id=r.id, reviewer_id=r.reviewer_id, reviewee_id=r.reviewee_id,
        period_id=r.period_id, teamwork_score=r.teamwork_score,
        communication_score=r.communication_score, reliability_score=r.reliability_score,
        comment=r.comment, created_at=r.created_at,
        reviewer_name=reviewer.full_name if reviewer else None,
        reviewee_name=reviewee.full_name if reviewee else None,
        period_name=period.name if period else None,
        avg_score=avg,
    )


@router.get("/", response_model=list[PeerReviewOut])
def list_reviews(
    period_id: int = None,
    reviewee_id: int = None,
    reviewer_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Employees see only reviews where THEY are the reviewer or reviewee.
    Managers see their team's reviews; admin/HR see all."""
    query = db.query(PeerReview)
    if user.role == "employee":
        if user.employee_id is None:
            return []
        query = query.filter(
            (PeerReview.reviewer_id == user.employee_id) | (PeerReview.reviewee_id == user.employee_id)
        )
    elif user.role == "manager":
        tids = visible_team_ids(user) or []
        if not tids:
            return []
        team_emp_ids = [e.id for e in db.query(Employee).filter(Employee.team_id.in_(tids)).all()]
        query = query.filter(
            PeerReview.reviewer_id.in_(team_emp_ids) | PeerReview.reviewee_id.in_(team_emp_ids)
        )
    if period_id:
        query = query.filter(PeerReview.period_id == period_id)
    if reviewee_id:
        query = query.filter(PeerReview.reviewee_id == reviewee_id)
    if reviewer_id:
        query = query.filter(PeerReview.reviewer_id == reviewer_id)
    reviews = query.order_by(PeerReview.created_at.desc()).limit(500).all()
    return [_review_out(r, db) for r in reviews]


@router.post("/", response_model=PeerReviewOut, status_code=201)
def create_review(request: PeerReviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if request.reviewer_id == request.reviewee_id:
        raise HTTPException(status_code=400, detail="کارمند نمی‌تواند به خودش نمره دهد")
    # Employees may only review teammates, and only AS themselves
    if user.role == "employee":
        if user.employee_id is None or int(request.reviewer_id) != int(user.employee_id):
            raise HTTPException(status_code=403, detail="فقط می‌توانید به عنوان خودتان ارزیابی ثبت کنید")
    reviewer = db.query(Employee).filter(Employee.id == request.reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="ارزیاب یافت نشد")
    reviewee = db.query(Employee).filter(Employee.id == request.reviewee_id).first()
    if not reviewee:
        raise HTTPException(status_code=404, detail="کارمند مورد ارزیابی یافت نشد")
    # 360 evaluation is strictly within the same team
    if reviewer.team_id is None or reviewee.team_id is None or reviewer.team_id != reviewee.team_id:
        raise HTTPException(status_code=403, detail="ارزیابی ۳۶۰ فقط بین همکاران تیم خودتان امکان‌پذیر است")
    if user.role == "manager" and not can_touch_employee(user, reviewer):
        raise HTTPException(status_code=403, detail="ارزیابی خارج از تیم‌های شما مجاز نیست")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == request.period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    existing = db.query(PeerReview).filter(
        PeerReview.reviewer_id == request.reviewer_id,
        PeerReview.reviewee_id == request.reviewee_id,
        PeerReview.period_id == request.period_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="این ارزیابی قبلاً ثبت شده است")

    review = PeerReview(**request.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return _review_out(review, db)


@router.put("/{review_id}", response_model=PeerReviewOut)
def update_review(review_id: int, request: PeerReviewUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    review = db.query(PeerReview).filter(PeerReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="ارزیابی یافت نشد")
    # Only the original reviewer (or admin/HR) can edit a review
    if user.role == "employee" and (user.employee_id is None or review.reviewer_id != user.employee_id):
        raise HTTPException(status_code=403, detail="فقط ارزیاب می‌تواند ارزیابی خودش را ویرایش کند")
    if user.role == "manager":
        reviewer = db.query(Employee).filter(Employee.id == review.reviewer_id).first()
        if reviewer and not can_touch_employee(user, reviewer):
            raise HTTPException(status_code=403, detail="این ارزیابی متعلق به تیم‌های شما نیست")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    db.commit()
    db.refresh(review)
    return _review_out(review, db)


@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    review = db.query(PeerReview).filter(PeerReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="ارزیابی یافت نشد")
    # Employees can delete only their own review; managers their team's; admin/HR any
    if user.role == "employee" and (user.employee_id is None or review.reviewer_id != user.employee_id):
        raise HTTPException(status_code=403, detail="فقط ارزیاب می‌تواند ارزیابی خودش را حذف کند")
    if user.role == "manager":
        reviewer = db.query(Employee).filter(Employee.id == review.reviewer_id).first()
        if reviewer and not can_touch_employee(user, reviewer):
            raise HTTPException(status_code=403, detail="این ارزیابی متعلق به تیم‌های شما نیست")
    db.delete(review)
    db.commit()
    return {"message": "ارزیابی حذف شد"}


@router.get("/summary/{reviewee_id}/{period_id}")
def review_summary(reviewee_id: int, period_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_plus)):
    """Average peer scores for one employee in one period.
    Managers/admin/HR only — employees must NOT see their 360 summary."""
    reviews = db.query(PeerReview).filter(
        PeerReview.reviewee_id == reviewee_id,
        PeerReview.period_id == period_id,
    ).all()
    if not reviews:
        return {"reviewee_id": reviewee_id, "period_id": period_id,
                "review_count": 0, "avg_score": 0.0,
                "teamwork_avg": 0.0, "communication_avg": 0.0, "reliability_avg": 0.0}
    return {
        "reviewee_id": reviewee_id,
        "period_id": period_id,
        "review_count": len(reviews),
        "avg_score": round(sum((r.teamwork_score + r.communication_score + r.reliability_score) / 3 for r in reviews) / len(reviews), 1),
        "teamwork_avg": round(sum(r.teamwork_score for r in reviews) / len(reviews), 1),
        "communication_avg": round(sum(r.communication_score for r in reviews) / len(reviews), 1),
        "reliability_avg": round(sum(r.reliability_score for r in reviews) / len(reviews), 1),
    }