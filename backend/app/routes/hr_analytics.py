"""
HR Analytics routes — workforce overview & performance analytics.

Sources (HR KPI frameworks):
- strategicplanning.me/kpis-in-human-resources/  — 34 HR KPIs (turnover, absenteeism,
  high/low performer share, performance improvement vs previous review)
- karokasb.org/human-resources-kpis/            — strategy-aligned KPIs only
- vitrayco.com/bi-dashboards/hr                 — HR BI dashboard views (workforce
  overview, attrition trend, performance evaluation across periods)

All metrics are computed live from existing data (employees, teams, KPI results).
Band thresholds match the frontend score-badge: >=80 excellent, 70-79 good,
60-69 average, <60 poor.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models import (
    Employee, Team, KPIResult, ReportingPeriod,
    AbsenceRecord, SelfEvaluation, Goal,
)

router = APIRouter(prefix="/api/hr", tags=["HR Analytics"])

# Score bands (match frontend .score-badge thresholds)
EXCELLENT_MIN = 80
GOOD_MIN = 70
AVERAGE_MIN = 60


def _band(score: float) -> str:
    if score >= EXCELLENT_MIN:
        return "excellent"
    if score >= GOOD_MIN:
        return "good"
    if score >= AVERAGE_MIN:
        return "average"
    return "poor"


@router.get("/analytics")
def hr_analytics(period_id: int = None, db: Session = Depends(get_db)):
    """HR dashboard: workforce overview + performance analytics for a period."""
    # ── 1. Workforce overview ──
    employees = db.query(Employee).all()
    active_emps = [e for e in employees if not e.is_archived]
    archived_emps = [e for e in employees if e.is_archived]
    total = len(employees)

    teams = db.query(Team).order_by(Team.name).all()
    per_team = []
    for team in teams:
        members = [e for e in employees if e.team_id == team.id]
        per_team.append({
            "team_id": team.id,
            "team_name": team.name,
            "active": len([e for e in members if not e.is_archived]),
            "archived": len([e for e in members if e.is_archived]),
        })

    cutoff_new = date.today() - timedelta(days=365)
    new_hires = len([e for e in active_emps if e.hire_date and e.hire_date >= cutoff_new])
    experienced = len(active_emps) - new_hires

    workforce = {
        "active_count": len(active_emps),
        "archived_count": len(archived_emps),
        "total_count": total,
        "attrition_rate": round(len(archived_emps) / total, 3) if total else 0.0,
        "new_hires": new_hires,
        "experienced": experienced,
        "per_team": per_team,
    }

    # ── 2. Periods available for analysis (all, for trend) ──
    periods = db.query(ReportingPeriod).order_by(ReportingPeriod.start_date).all()
    period_list = [{"id": p.id, "name": p.name, "is_active": p.is_active,
                    "is_archived": p.is_archived} for p in periods]

    # ── 3. Select period (default: latest non-archived) ──
    if period_id is None:
        candidates = [p for p in periods if not p.is_archived]
        selected = candidates[-1] if candidates else (periods[-1] if periods else None)
    else:
        selected = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
        if not selected:
            raise HTTPException(status_code=404, detail="دوره یافت نشد")

    selected_payload = None
    if selected:
        results = db.query(KPIResult).filter(KPIResult.period_id == selected.id).all()

        # Scores with employee + team context
        scored = []
        for r in results:
            emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
            team = db.query(Team).filter(Team.id == emp.team_id).first() if emp else None
            scored.append({
                "employee_id": r.employee_id,
                "employee_name": emp.full_name if emp else "—",
                "employee_code": emp.employee_code if emp else "—",
                "team_id": team.id if team else None,
                "team_name": team.name if team else "—",
                "score": round(r.final_score, 1),
            })

        # Score distribution bands
        bands = {"excellent": 0, "good": 0, "average": 0, "poor": 0}
        for s in scored:
            bands[_band(s["score"])] += 1

        # Team ranking
        team_agg = {}
        for s in scored:
            tid = s["team_id"]
            if tid is None:
                continue
            agg = team_agg.setdefault(tid, {"team_id": tid, "team_name": s["team_name"], "sum": 0.0, "count": 0})
            agg["sum"] += s["score"]
            agg["count"] += 1
        team_ranking = []
        for tid, agg in team_agg.items():
            team_ranking.append({
                "team_id": agg["team_id"],
                "team_name": agg["team_name"],
                "avg": round(agg["sum"] / agg["count"], 1),
                "count": agg["count"],
            })
        team_ranking.sort(key=lambda x: x["avg"], reverse=True)

        # Top / bottom performers
        sorted_scores = sorted(scored, key=lambda x: x["score"], reverse=True)
        top = sorted_scores[:5]
        bottom = list(reversed(sorted_scores[-5:])) if len(sorted_scores) > 5 else sorted_scores

        avg = round(sum(s["score"] for s in scored) / len(scored), 1) if scored else 0.0

        selected_payload = {
            "id": selected.id,
            "name": selected.name,
            "avg_score": avg,
            "scored_count": len(scored),
            "bands": bands,
            "team_ranking": team_ranking,
            "top": top,
            "bottom": bottom,
        }

    # ── 4. Trend across all periods ──
    trend = []
    for p in periods:
        results = db.query(KPIResult).filter(KPIResult.period_id == p.id).all()
        if results:
            avg_p = round(sum(r.final_score for r in results) / len(results), 1)
            trend.append({"period_id": p.id, "name": p.name, "avg": avg_p,
                          "count": len(results)})

    # ── 5. Improvement vs previous period (HR KPI #34: % improved vs last review) ──
    improvement = None
    if selected:
        previous = None
        for p in periods:
            if p.start_date < selected.start_date:
                previous = p
            else:
                break
        if previous:
            prev_results = {r.employee_id: r.final_score for r in
                            db.query(KPIResult).filter(KPIResult.period_id == previous.id).all()}
            improved = declined = stable = 0
            deltas = []
            for s in scored:
                prev = prev_results.get(s["employee_id"])
                if prev is None:
                    continue
                delta = s["score"] - prev
                deltas.append(delta)
                if delta > 0.5:
                    improved += 1
                elif delta < -0.5:
                    declined += 1
                else:
                    stable += 1
            comparable = improved + declined + stable
            prev_avg = round(sum(prev_results.values()) / len(prev_results), 1) if prev_results else 0.0
            improvement = {
                "previous_period_id": previous.id,
                "previous_period_name": previous.name,
                "previous_avg": prev_avg,
                "delta": round(avg - prev_avg, 1),
                "improved": improved,
                "declined": declined,
                "stable": stable,
                "comparable": comparable,
                "improved_pct": round(improved / comparable * 100, 1) if comparable else 0.0,
            }

    # ── 6. Absence stats (HR KPI: absenteeism rate) — current year ──
    year_start = date(date.today().year, 1, 1)
    year_end = date.today()
    absence_records = db.query(AbsenceRecord).filter(
        AbsenceRecord.absence_date >= year_start,
        AbsenceRecord.absence_date <= year_end,
    ).all()
    absence_days = len(absence_records)
    workdays_year = sum(1 for i in range((year_end - year_start).days + 1)
                        if (year_start + timedelta(days=i)).weekday() < 6)
    absence_rate = round(absence_days / (len(active_emps) * workdays_year), 4) if active_emps and workdays_year else 0.0

    team_absence = {}
    for r in absence_records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        if not emp:
            continue
        tid = emp.team_id
        team_absence[tid] = team_absence.get(tid, 0) + 1
    absences = {
        "total_absence_days": absence_days,
        "absence_rate": absence_rate,
        "period": {"from": year_start.isoformat(), "to": year_end.isoformat()},
        "per_team": [
            {"team_id": tid, "team_name": (db.query(Team).filter(Team.id == tid).first().name
                                            if db.query(Team).filter(Team.id == tid).first() else "—"),
             "absence_days": days}
            for tid, days in sorted(team_absence.items(), key=lambda x: x[1], reverse=True)
        ],
    }

    # ── 7. Self-eval vs manager gap (org-wide, per team) ──
    self_gap = None
    if selected:
        self_evals = {se.employee_id: se.self_score for se in
                      db.query(SelfEvaluation).filter(SelfEvaluation.period_id == selected.id).all()}
        manager_scores = {s["employee_id"]: s["score"] for s in scored}
        per_emp_gap = []
        for emp_id, self_score in self_evals.items():
            mgr = manager_scores.get(emp_id)
            if mgr is None:
                continue
            emp = db.query(Employee).filter(Employee.id == emp_id).first()
            per_emp_gap.append({
                "employee_id": emp_id,
                "employee_name": emp.full_name if emp else "—",
                "self_score": self_score,
                "manager_score": mgr,
                "gap": round(self_score - mgr, 1),
            })
        per_emp_gap.sort(key=lambda x: abs(x["gap"]), reverse=True)
        if per_emp_gap:
            avg_self = round(sum(g["self_score"] for g in per_emp_gap) / len(per_emp_gap), 1)
            avg_mgr = round(sum(g["manager_score"] for g in per_emp_gap) / len(per_emp_gap), 1)
            self_gap = {
                "avg_self_score": avg_self,
                "avg_manager_score": avg_mgr,
                "avg_gap": round(avg_self - avg_mgr, 1),
                "count": len(per_emp_gap),
                "per_employee": per_emp_gap[:10],
            }

    # ── 8. Consecutive-decline alerts (2 periods in a row) ──
    decline_alerts = []
    results_by_period = {}
    for p in periods:
        results_by_period[p.id] = {r.employee_id: r.final_score for r in
                                   db.query(KPIResult).filter(KPIResult.period_id == p.id).all()}
    ordered_ids = [p.id for p in periods]
    emp_ids = set()
    for r in results_by_period.values():
        emp_ids.update(r.keys())
    for emp_id in emp_ids:
        emp_scores = [(pid, results_by_period[pid].get(emp_id)) for pid in ordered_ids]
        scored_pairs = [(pid, s) for pid, s in emp_scores if s is not None]
        if len(scored_pairs) < 3:
            continue
        last3 = scored_pairs[-3:]
        if last3[-1][1] < last3[-2][1] < last3[-3][1]:
            emp = db.query(Employee).filter(Employee.id == emp_id).first()
            decline_alerts.append({
                "employee_id": emp_id,
                "employee_name": emp.full_name if emp else "—",
                "employee_code": emp.employee_code if emp else "—",
                "team_name": emp.team.name if emp and emp.team else "—",
                "latest_score": last3[-1][1],
                "scores": [s for _, s in last3],
                "periods": [db.query(ReportingPeriod).filter(ReportingPeriod.id == pid).first().name if db.query(ReportingPeriod).filter(ReportingPeriod.id == pid).first() else "—" for pid, _ in last3],
            })

    # ── 9. Goals achievement (per selected period) ──
    goals_achievement = None
    if selected:
        goals = db.query(Goal).filter(Goal.period_id == selected.id).all()
        if goals:
            achievements = [round(g.current_value / g.target_value * 100, 1) if g.target_value > 0 else 0.0 for g in goals]
            completed = len([g for g in goals if g.status == "completed"])
            goals_achievement = {
                "total_goals": len(goals),
                "completed": completed,
                "completion_rate": round(completed / len(goals) * 100, 1) if goals else 0.0,
                "avg_achievement": round(sum(achievements) / len(achievements), 1) if achievements else 0.0,
            }

    return {
        "workforce": workforce,
        "periods": period_list,
        "selected_period": selected_payload,
        "trend": trend,
        "improvement": improvement,
        "absences": absences,
        "self_gap": self_gap,
        "decline_alerts": decline_alerts,
        "goals_achievement": goals_achievement,
    }