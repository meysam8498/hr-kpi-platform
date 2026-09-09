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

    # ── 3) Scoring pending ──
    #   admin/hr without explicit grants → company-wide (they may score everyone)
    #   admin/hr with grants → granted teams only
    #   manager → own team + granted teams
    #   employee role → never a scorer (skip)
    if period and user.role != "employee":
        granted = managed_team_ids(user)
        if user.role in ("admin", "hr"):
            scope_query = (
                db.query(Employee).filter(Employee.team_id.in_(granted))
                if granted else db.query(Employee)
            )
        elif user.role == "manager":
            tids = set(granted)
            if user.team_id is not None:
                tids.add(int(user.team_id))
            scope_query = (
                db.query(Employee).filter(Employee.team_id.in_(list(tids)))
                if tids else None
            )
        else:
            scope_query = None
        if scope_query is not None:
            team_emps = scope_query.filter(
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
                company_wide = user.role in ("admin", "hr") and not granted
                tasks.append({
                    "kind": "scoring",
                    "title": "امتیازدهی به اعضای تیم" if not company_wide else "امتیازدهی کارمندان",
                    "description": (
                        f"{len(pending_score)} نفر از {len(team_emps)} کارمند سازمان در دوره «{period.name}» نمره نگرفته‌اند."
                        if company_wide else
                        f"{len(pending_score)} نفر از اعضای تیم‌های شما در دوره «{period.name}» نمره نگرفته‌اند."
                    ),
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


# ─── Manager multi-team overview ────────────────────────────────
@router.get("/team-overview")
def team_overview(period_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """KPI averages for every team the user may manage, side by side.

    admin/HR: all teams. manager (or tick-granted user): their teams only.
    Employees get 403 — this is a management view.
    """
    from ..auth import visible_team_ids, is_hr_plus, can_touch_employee
    from ..models import Team, KPIResult

    if user.role == "employee":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="این بخش مخصوص مدیران است")

    period = None
    if period_id:
        period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        period = _active_period(db)
    if not period:
        return {"period": None, "teams": []}

    teams_q = db.query(Team)
    if not is_hr_plus(user):
        tids = visible_team_ids(user) or []
        if not tids:
            return {"period": {"id": period.id, "name": period.name}, "teams": []}
        teams_q = teams_q.filter(Team.id.in_(tids))
    teams = teams_q.order_by(Team.id).all()

    out = []
    for t in teams:
        members = db.query(Employee).filter(
            Employee.team_id == t.id, Employee.is_archived == False,  # noqa: E712
        ).all()
        member_ids = [m.id for m in members]
        results = (
            db.query(KPIResult)
            .filter(KPIResult.period_id == period.id, KPIResult.employee_id.in_(member_ids))
            .all()
            if member_ids else []
        )
        scores = [r.final_score for r in results]
        avg = round(sum(scores) / len(scores), 1) if scores else None
        top = max(results, key=lambda r: r.final_score) if results else None
        low = min(results, key=lambda r: r.final_score) if results else None
        def _name(eid):
            m = next((m for m in members if m.id == eid), None)
            return m.full_name if m else None
        below = sum(1 for s in scores if s < 60)
        out.append({
            "team_id": t.id,
            "team_name": t.name,
            "member_count": len(members),
            "scored_count": len(scores),
            "average": avg,
            "top": {"name": _name(top.employee_id), "score": top.final_score} if top else None,
            "lowest": {"name": _name(low.employee_id), "score": low.final_score} if low else None,
            "below_60": below,
        })

    return {
        "period": {"id": period.id, "name": period.name},
        "teams": out,
    }
