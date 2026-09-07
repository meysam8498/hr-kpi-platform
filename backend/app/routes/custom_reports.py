"""
Custom Report routes — flexible filtering by team, employee, period, criteria, score range,
plus Jalali date-range filtering and Excel export of the generated report.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Employee, Team, KPICriterion, KPIEntry, KPIResult,
    ReportingPeriod, TeamKPIConfig, SelfEvaluation, User,
)
from ..schemas import CustomReportRequest
from ..utils.jalali import parse_jalali_or_gregorian
from ..auth import require_manager_plus, require_admin_or_hr

router = APIRouter(prefix="/api/reports", tags=["Custom Reports"])


@router.post("/custom")
def generate_custom_report(request: CustomReportRequest, db: Session = Depends(get_db), _: User = Depends(require_manager_plus)):
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

    # Jalali date-range filter (on period start_date)
    date_from = parse_jalali_or_gregorian(request.date_from) if request.date_from else None
    date_to = parse_jalali_or_gregorian(request.date_to) if request.date_to else None
    if date_from is None and request.date_from:
        raise HTTPException(status_code=422, detail="تاریخ شروع نامعتبر است — قالب: ۱۴۰۴/۰۱/۰۱")
    if date_to is None and request.date_to:
        raise HTTPException(status_code=422, detail="تاریخ پایان نامعتبر است — قالب: ۱۴۰۴/۱۲/۲۹")
    if date_from:
        period_query = period_query.filter(ReportingPeriod.start_date >= date_from)
    if date_to:
        period_query = period_query.filter(ReportingPeriod.start_date <= date_to)

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
            "date_from": request.date_from,
            "date_to": request.date_to,
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


def _build_custom_report_data(request: CustomReportRequest, db: Session) -> dict:
    """Shared report builder used by both the JSON endpoint and Excel export."""
    return generate_custom_report.__wrapped__(request, db) if hasattr(generate_custom_report, "__wrapped__") else _build_report(request, db)


def _build_report(request: CustomReportRequest, db: Session) -> dict:
    """Build the report data structure (refactored from generate_custom_report)."""
    from fastapi import HTTPException as _HE

    emp_query = db.query(Employee).filter(Employee.is_archived == False)
    if request.team_id:
        emp_query = emp_query.filter(Employee.team_id == request.team_id)
    if request.employee_ids:
        emp_query = emp_query.filter(Employee.id.in_(request.employee_ids))
    employees = emp_query.all()

    period_query = db.query(ReportingPeriod)
    if request.period_ids:
        period_query = period_query.filter(ReportingPeriod.id.in_(request.period_ids))
    date_from = parse_jalali_or_gregorian(request.date_from) if request.date_from else None
    date_to = parse_jalali_or_gregorian(request.date_to) if request.date_to else None
    if date_from:
        period_query = period_query.filter(ReportingPeriod.start_date >= date_from)
    if date_to:
        period_query = period_query.filter(ReportingPeriod.start_date <= date_to)
    periods = period_query.all()

    criteria_ids = request.criteria_ids or []
    results = []
    for emp in employees:
        team = db.query(Team).filter(Team.id == emp.team_id).first()
        emp_periods = []
        for period in periods:
            kpi_result = db.query(KPIResult).filter(
                KPIResult.employee_id == emp.id,
                KPIResult.period_id == period.id,
            ).first()
            if kpi_result:
                if request.min_score is not None and kpi_result.final_score < request.min_score:
                    continue
                if request.max_score is not None and kpi_result.final_score > request.max_score:
                    continue
            entries = db.query(KPIEntry).filter(
                KPIEntry.employee_id == emp.id,
                KPIEntry.period_id == period.id,
            ).all()
            if criteria_ids:
                entries = [e for e in entries if e.criterion_id in criteria_ids]
            self_eval = db.query(SelfEvaluation).filter(
                SelfEvaluation.employee_id == emp.id,
                SelfEvaluation.period_id == period.id,
            ).first()
            emp_periods.append({
                "period_id": period.id,
                "period_name": period.name,
                "final_score": kpi_result.final_score if kpi_result else None,
                "self_evaluation": {"self_score": self_eval.self_score} if self_eval else None,
                "entries": [{
                    "criterion_id": e.criterion_id,
                    "criterion_name": (db.query(KPICriterion).filter(KPICriterion.id == e.criterion_id).first().name if db.query(KPICriterion).filter(KPICriterion.id == e.criterion_id).first() else None),
                    "score": e.score,
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

    all_scores = [p["final_score"] for r in results for p in r["periods"] if p["final_score"] is not None]
    return {
        "filters": {"team_id": request.team_id, "date_from": request.date_from, "date_to": request.date_to},
        "summary": {
            "total_employees": len(results),
            "total_records": len(all_scores),
            "avg_score": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0,
            "min_score": min(all_scores) if all_scores else 0,
            "max_score": max(all_scores) if all_scores else 0,
        },
        "employees": results,
    }


@router.post("/custom/export")
def export_custom_report_excel(request: CustomReportRequest, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    """Export the custom report (same filters) as a styled Excel file."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    report = _build_report(request, db)
    if not report["employees"]:
        raise HTTPException(status_code=404, detail="داده‌ای برای خروجی یافت نشد — فیلترها را تغییر دهید")

    wb = Workbook()
    ws = wb.active
    ws.title = "گزارش سفارشی"
    ws.sheet_view.rightToLeft = True

    header_font = Font(name="Tahoma", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="4F46E5")
    bold_font = Font(name="Tahoma", bold=True, size=10)

    # Title row
    ws.merge_cells("A1:E1")
    c = ws.cell(1, 1, "گزارش سفارشی عملکرد")
    c.font = Font(name="Tahoma", bold=True, size=14)
    c.alignment = Alignment(horizontal="center")

    # Filter description row
    filter_bits = []
    if request.team_id:
        t = db.query(Team).filter(Team.id == request.team_id).first()
        if t: filter_bits.append(f"تیم: {t.name}")
    if request.date_from: filter_bits.append(f"از {request.date_from}")
    if request.date_to: filter_bits.append(f"تا {request.date_to}")
    ws.merge_cells("A2:E2")
    c = ws.cell(2, 1, " | ".join(filter_bits) if filter_bits else "همه تیم‌ها و دوره‌ها")
    c.font = Font(name="Tahoma", size=9, color="6B7280")
    c.alignment = Alignment(horizontal="center")

    # Header row
    headers = ["کد پرسنلی", "نام و نام خانوادگی", "تیم", "دوره", "نمره نهایی"]
    for col, h in enumerate(headers, 1):
        c = ws.cell(4, col, h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center")

    row = 5
    for emp in report["employees"]:
        for p in emp["periods"]:
            ws.cell(row, 1, emp["employee_code"]).font = bold_font
            ws.cell(row, 2, emp["employee_name"])
            ws.cell(row, 3, emp["team_name"] or "-")
            ws.cell(row, 4, p["period_name"])
            score = p["final_score"]
            ws.cell(row, 5, round(score, 1) if score is not None else "-")
            row += 1

    # Summary row
    row += 1
    ws.cell(row, 2, "میانگین کل:").font = bold_font
    ws.cell(row, 5, report["summary"]["avg_score"]).font = bold_font

    widths = [14, 26, 20, 18, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    from urllib.parse import quote
    fname = quote("گزارش-سفارشی.xlsx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=custom_report.xlsx; filename*=UTF-8''{fname}"},
    )
