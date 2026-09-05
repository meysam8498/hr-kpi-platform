"""
Custom Report routes — flexible filtering by team, employee, period, criteria, score range.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Employee, Team, KPICriterion, KPIEntry, KPIResult,
    ReportingPeriod, TeamKPIConfig, SelfEvaluation,
)
from ..schemas import CustomReportRequest

router = APIRouter(prefix="/api/reports", tags=["Custom Reports"])


@router.post("/custom")
def generate_custom_report(request: CustomReportRequest, db: Session = Depends(get_db)):
    """Generate a custom report with flexible filters."""
    # Build employee list
    emp_query = db.query(Employee).filter(Employee.is_archived == False)
    if request.team_id:
        emp_query = emp_query.filter(Employee.team_id == request.team_id)
    if request.employee_ids:
        emp_query = emp_query.filter(Employee.id.in_(request.employee_ids))
    employees = emp_query.all()
    emp_ids = [e.id for e in employees]

    # Build period filter
    period_query = db.query(ReportingPeriod)
    if request.period_ids:
        period_query = period_query.filter(ReportingPeriod.id.in_(request.period_ids))
    periods = period_query.all()
    period_ids = [p.id for p in periods]

    # Build criteria filter
    criteria_ids = request.criteria_ids or []

    # Get results
    results = []
    for emp in employees:
        team = db.query(Team).filter(Team.id == emp.team_id).first()
        emp_periods = []
        for period in periods:
            kpi_result = db.query(KPIResult).filter(
                KPIResult.employee_id == emp.id,
                KPIResult.period_id == period.id,
            ).first()

            # Apply score filter
            if kpi_result:
                if request.min_score is not None and kpi_result.final_score < request.min_score:
                    continue
                if request.max_score is not None and kpi_result.final_score > request.max_score:
                    continue

            # Get criteria breakdown
            entries = db.query(KPIEntry).filter(
                KPIEntry.employee_id == emp.id,
                KPIEntry.period_id == period.id,
            ).all()
            if criteria_ids:
                entries = [e for e in entries if e.criterion_id in criteria_ids]

            # Self-evaluation comparison
            self_eval = db.query(SelfEvaluation).filter(
                SelfEvaluation.employee_id == emp.id,
                SelfEvaluation.period_id == period.id,
            ).first()

            emp_periods.append({
                "period_id": period.id,
                "period_name": period.name,
                "final_score": kpi_result.final_score if kpi_result else None,
                "breakdown": kpi_result.breakdown if kpi_result else None,
                "self_evaluation": {
                    "self_score": self_eval.self_score,
                    "strengths": self_eval.strengths,
                    "improvements": self_eval.improvements,
                } if self_eval else None,
                "entries": [{
                    "criterion_id": e.criterion_id,
                    "criterion_name": db.query(KPICriterion).filter(KPICriterion.id == e.criterion_id).first().name if db.query(KPICriterion).filter(KPICriterion.id == e.criterion_id).first() else None,
                    "score": e.score,
                    "comment": e.comment,
                } for e in entries],
            })

        if emp_periods:
            results.append({
                "employee_id": emp.id,
                "employee_name": emp.full_name,
                "employee_code": emp.employee_code,
                "position": emp.position,
                "team_name": team.name if team else None,
                "periods": emp_periods,
            })

    # Summary
    all_scores = []
    for r in results:
        for p in r["periods"]:
            if p["final_score"] is not None:
                all_scores.append(p["final_score"])

    return {
        "filters": {
            "team_id": request.team_id,
            "employee_ids": request.employee_ids,
            "period_ids": request.period_ids,
            "criteria_ids": request.criteria_ids,
            "min_score": request.min_score,
            "max_score": request.max_score,
        },
        "summary": {
            "total_employees": len(results),
            "total_records": len(all_scores),
            "avg_score": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0,
            "min_score": min(all_scores) if all_scores else 0,
            "max_score": max(all_scores) if all_scores else 0,
        },
        "employees": results,
    }
