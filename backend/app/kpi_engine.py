"""
KPI Calculation Engine — Blended Weighted-Average Formula.

Base Formula (Armstrong & Taylor, 2014; Kaplan & Norton, 1996):
    Base Score = Σ(score_i × weight_i) / Σ(weight_i)

Where:
    score_i  = manager's score for criterion i (0-100)
    weight_i = importance weight for criterion i (configured per team)

The final KPI score blends the base score with peer-review averages and goal
achievement, using per-team weights from `TeamScoreBlend` (no hardcoded values):

    Final Score = (base×base_w + peer×peer_w + goal×goal_w) / (base_w+peer_w+goal_w)

Only available components contribute: if an employee has no peer reviews and no
goals, the weights are renormalized over the available components so the score
is never artificially dragged down.
"""
from sqlalchemy.orm import Session
from .models import (
    Employee, Team, KPICriterion, TeamKPIConfig,
    KPIEntry, KPIResult, ReportingPeriod, PeerReview, Goal, TeamScoreBlend,
)


DEFAULT_BLEND = {"base": 0.70, "peer": 0.15, "goal": 0.15}


def _peer_score(employee_id: int, period_id: int, db: Session) -> tuple[float, int]:
    """Average peer-review score (0-100) and review count."""
    reviews = db.query(PeerReview).filter(
        PeerReview.reviewee_id == employee_id,
        PeerReview.period_id == period_id,
    ).all()
    if not reviews:
        return 0.0, 0
    avg = sum((r.teamwork_score + r.communication_score + r.reliability_score) / 3 for r in reviews) / len(reviews)
    return round(avg, 2), len(reviews)


def _goal_achievement(employee_id: int, period_id: int, db: Session) -> tuple[float, int]:
    """Average goal achievement % (0-100) and goal count."""
    goals = db.query(Goal).filter(
        Goal.employee_id == employee_id,
        Goal.period_id == period_id,
    ).all()
    if not goals:
        return 0.0, 0
    pcts = [round(g.current_value / g.target_value * 100, 2) if g.target_value > 0 else 0.0 for g in goals]
    return round(sum(pcts) / len(pcts), 2), len(goals)


def calculate_employee_kpi(employee_id: int, period_id: int, db: Session) -> dict | None:
    """
    Calculate the weighted-average KPI score for one employee in one period.
    Returns None if no KPI config found for the employee's team.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return None

    # Get team KPI configs
    configs = (
        db.query(TeamKPIConfig)
        .filter(TeamKPIConfig.team_id == employee.team_id, TeamKPIConfig.is_active == True)
        .all()
    )
    if not configs:
        return None

    # Build weighted score
    total_weighted = 0.0
    total_weight = 0.0
    breakdown = []

    for cfg in configs:
        entry = (
            db.query(KPIEntry)
            .filter(
                KPIEntry.employee_id == employee_id,
                KPIEntry.criterion_id == cfg.criterion_id,
                KPIEntry.period_id == period_id,
            )
            .first()
        )

        criterion = db.query(KPICriterion).filter(KPICriterion.id == cfg.criterion_id).first()
        score = entry.score if entry else 0.0
        weight = cfg.weight

        total_weighted += score * weight
        total_weight += weight

        breakdown.append({
            "criterion_id": cfg.criterion_id,
            "criterion_name": criterion.name if criterion else "Unknown",
            "score": score,
            "weight": weight,
            "weighted_contribution": round(score * weight, 2),
            "has_entry": entry is not None,
        })

    base_score = round(total_weighted / total_weight, 2) if total_weight > 0 else 0.0

    # ── Blend peer-review + goal achievement into the final score ──
    blend_cfg = db.query(TeamScoreBlend).filter(TeamScoreBlend.team_id == employee.team_id).first()
    if blend_cfg:
        weights = {"base": blend_cfg.base_weight, "peer": blend_cfg.peer_weight, "goal": blend_cfg.goal_weight}
    else:
        weights = dict(DEFAULT_BLEND)

    peer, peer_count = _peer_score(employee_id, period_id, db)
    goal, goal_count = _goal_achievement(employee_id, period_id, db)

    # Only components with data contribute; renormalize over available ones
    components = {"base": base_score}
    used_weights = {"base": weights["base"]}
    if peer_count > 0:
        components["peer"] = peer
        used_weights["peer"] = weights["peer"]
    if goal_count > 0:
        components["goal"] = goal
        used_weights["goal"] = weights["goal"]

    weight_sum = sum(used_weights.values())
    if weight_sum > 0:
        final_score = round(sum(components[k] * used_weights[k] for k in components) / weight_sum, 2)
    else:
        final_score = base_score

    return {
        "employee_id": employee_id,
        "period_id": period_id,
        "final_score": final_score,
        "blend": {
            "base_score": base_score,
            "peer_score": peer,
            "peer_count": peer_count,
            "goal_achievement": goal,
            "goal_count": goal_count,
            "weights": used_weights,
            "weight_sum": weight_sum,
        },
        "breakdown": {
            "total_weight": total_weight,
            "criteria": breakdown,
            "blend": {
                "base_score": base_score,
                "peer_score": peer,
                "peer_count": peer_count,
                "goal_achievement": goal,
                "goal_count": goal_count,
                "weights": used_weights,
                "weight_sum": weight_sum,
            },
        },
    }


def calculate_and_store(employee_id: int, period_id: int, db: Session):
    """Calculate and upsert the KPI result."""
    result_data = calculate_employee_kpi(employee_id, period_id, db)
    if not result_data:
        return None

    existing = (
        db.query(KPIResult)
        .filter(KPIResult.employee_id == employee_id, KPIResult.period_id == period_id)
        .first()
    )

    if existing:
        existing.final_score = result_data["final_score"]
        existing.breakdown = result_data["breakdown"]
    else:
        existing = KPIResult(
            employee_id=employee_id,
            period_id=period_id,
            final_score=result_data["final_score"],
            breakdown=result_data["breakdown"],
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing


def calculate_team_results(team_id: int, period_id: int, db: Session) -> list[dict]:
    """Calculate KPI for all employees in a team."""
    employees = db.query(Employee).filter(Employee.team_id == team_id).all()
    results = []
    for emp in employees:
        result = calculate_and_store(emp.id, period_id, db)
        if result:
            results.append({
                "employee_id": emp.id,
                "employee_name": emp.full_name,
                "employee_code": emp.employee_code,
                "final_score": result.final_score,
                "breakdown": result.breakdown,
            })
    return results


def calculate_company_results(period_id: int, db: Session) -> dict:
    """Calculate KPI for all employees across all teams."""
    teams = db.query(Team).all()
    all_scores = []
    team_reports = []

    for team in teams:
        team_results = calculate_team_results(team.id, period_id, db)
        team_scores = [r["final_score"] for r in team_results]
        team_reports.append({
            "team_id": team.id,
            "team_name": team.name,
            "avg_score": round(sum(team_scores) / len(team_scores), 2) if team_scores else 0.0,
            "member_count": len(team_results),
            "members": team_results,
        })
        all_scores.extend(team_scores)

    return {
        "period_id": period_id,
        "total_employees": len(all_scores),
        "company_avg": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0,
        "teams": team_reports,
    }


def get_employee_history(employee_id: int, db: Session) -> list[dict]:
    """Get all KPI results for an employee across periods."""
    results = (
        db.query(KPIResult)
        .filter(KPIResult.employee_id == employee_id)
        .order_by(KPIResult.calculated_at.desc())
        .all()
    )
    history = []
    for r in results:
        period = db.query(ReportingPeriod).filter(ReportingPeriod.id == r.period_id).first()
        history.append({
            "period_id": r.period_id,
            "period_name": period.name if period else "Unknown",
            "final_score": r.final_score,
            "breakdown": r.breakdown,
            "calculated_at": r.calculated_at.isoformat() if r.calculated_at else None,
        })
    return history
