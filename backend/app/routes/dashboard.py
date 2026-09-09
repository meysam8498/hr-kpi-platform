"""
Personal dashboard endpoint — role-aware task list + own-period report.

For every signed-in user this answers one question: "what should I do now?"
- Self-evaluation pending for the active period
- 360 reviews of teammates not yet given
- Team members still unscored (managers, or anyone with tick-based grants)

When nothing is pending, employees get a report of what THEY submitted this
period (self-eval, 360 given, active goals) — never the manager's final score,
which stays HR/manager-only — plus a notice that HR will inform them about
the next period.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Employee, ReportingPeriod, KPIEntry, PeerReview, SelfEvaluation, Goal, User,
)
from ..auth import get_current_user, managed_team_ids

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _active_period(db: Session) -> ReportingPeriod | None:
    period = (
        db.query(ReportingPeriod)
        .filter(ReportingPeriod.is_active == True, ReportingPeriod.is_archived == False)  # noqa: E712
        .first()
    )
    if not period:
        period = (
            db.query(ReportingPeriod)
            .filter(ReportingPeriod.is_archived == False)  # noqa: E712
            .order_by(ReportingPeriod.end_date.desc())
            .first()
        )
    return period


@router.get("/my-tasks")
def my_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    period = _active_period(db)
    me: Employee | None = (
        db.query(Employee).filter(Employee.id == user.employee_id).first()
        if user.employee_id else None
    )
    tasks: list[dict] = []

    # ── 1) Self-evaluation pending ──
    if me is not None and period:
        exists = db.query(SelfEvaluation).filter(
            SelfEvaluation.employee_id == me.id,
            SelfEvaluation.period_id == period.id,
        ).first()
        if not exists:
            tasks.append({
                "kind": "self_eval",
                "title": "ثبت خودارزیابی",
                "description": f"خودارزیابی دوره «{period.name}» هنوز ثبت نشده است.",
                "href": "/self-eval",
                "names": [],
            })

    # ── 2) 360 reviews of teammates not yet given ──
    if me is not None and me.team_id is not None and period:
        teammates = db.query(Employee).filter(
            Employee.team_id == me.team_id,
            Employee.id != me.id,
            Employee.is_archived == False,  # noqa: E712
        ).all()
        reviewed = {r.reviewee_id for r in db.query(PeerReview).filter(
            PeerReview.reviewer_id == me.id,
            PeerReview.period_id == period.id,
        ).all()}
        pending = [t for t in teammates if t.id not in reviewed]
        if pending:
            tasks.append({
                "kind": "peer_review",
                "title": "ارزیابی ۳۶۰ هم‌تیمی‌ها",
                "description": f"{len(pending)} همکار در تیم شما هنوز ارزیابی نشده‌اند.",
                "href": "/peer-reviews",
                "names": [t.full_name for t in pending][:6],
            })

    # ── 3) Scoring pending (managers: own team; anyone with tick grants: those teams) ──
    if period:
        team_ids = set(managed_team_ids(user))
        if user.role == "manager" and user.team_id is not None:
            team_ids.add(int(user.team_id))
        # admin/hr are unrestricted, so only surface explicitly granted teams
        if user.role in ("admin", "hr") and not managed_team_ids(user):
            team_ids = set()
        if team_ids:
            team_emps = db.query(Employee).filter(
                Employee.team_id.in_(list(team_ids)),
                Employee.is_archived == False,  # noqa: E712
            ).all()
            ids = [e.id for e in team_emps]
            scored: set[int] = set()
            if ids:
                scored = {row[0] for row in db.query(KPIEntry.employee_id).filter(
                    KPIEntry.period_id == period.id,
                    KPIEntry.employee_id.in_(ids),
                ).distinct().all()}
            pending_score = [e for e in team_emps if e.id not in scored]
            if pending_score:
                tasks.append({
                    "kind": "scoring",
                    "title": "امتیازدهی به اعضای تیم",
                    "description": f"{len(pending_score)} نفر از اعضای تیم‌های شما در دوره «{period.name}» نمره نگرفته‌اند.",
                    "href": "/scoring",
                    "names": [e.full_name for e in pending_score][:6],
                })

    # ── Own-period report (what THIS employee submitted — not the manager score) ──
    own_report = None
    if me is not None and period:
        se = db.query(SelfEvaluation).filter(
            SelfEvaluation.employee_id == me.id,
            SelfEvaluation.period_id == period.id,
        ).first()
        given = db.query(PeerReview).filter(
            PeerReview.reviewer_id == me.id,
            PeerReview.period_id == period.id,
        ).all()
        reviewees = []
        for r in given:
            rev = db.query(Employee).filter(Employee.id == r.reviewee_id).first()
            if rev:
                reviewees.append(rev.full_name)
        active_goals = db.query(Goal).filter(
            Goal.employee_id == me.id,
            Goal.period_id == period.id,
            Goal.status == "active",
        ).count()
        own_report = {
            "period_name": period.name,
            "self_eval": {
                "submitted": se is not None,
                "self_score": se.self_score if se else None,
                "strengths": se.strengths if se else None,
                "improvements": se.improvements if se else None,
            },
            "peer_reviews_given": len(given),
            "peer_reviewees": reviewees,
            "active_goals": active_goals,
        }

    return {
        "period": {"id": period.id, "name": period.name} if period else None,
        "tasks": tasks,
        "own_report": own_report,
        "hr_notice": "برای دوره بعدی، وظایف و اطلاعات جدید از طرف منابع انسانی به شما اطلاع‌رسانی می‌شود.",
    }
