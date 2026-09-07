"""
PDF report routes — server-side Persian PDF export for individual and team reports.

GET /api/pdf/employee/{employee_id}/{period_id}   — individual report card
GET /api/pdf/team/{team_id}/{period_id}           — team summary report
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Employee, Team, KPIResult, KPIEntry, KPICriterion,
    ReportingPeriod, Goal, SelfEvaluation, TeamScoreBlend,
)
from ..pdf import KPIPDF, build_pdf, score_color, fonts_available, _fa_num, _shape
from ..utils.jalali import gregorian_to_jalali

router = APIRouter(prefix="/api/pdf", tags=["PDF Reports"])


def _fa_date(d: date | None) -> str:
    """Gregorian date → Jalali yyyy/mm/dd string with Persian digits."""
    if d is None:
        return "—"
    jy, jm, jd = gregorian_to_jalali(d.year, d.month, d.day)
    return _fa_num(f"{jy:04d}/{jm:02d}/{jd:02d}")


def _fa_score(s: float | None) -> str:
    if s is None:
        return "—"
    return _fa_num(f"{s:.1f}")


def _period_label(period: ReportingPeriod) -> str:
    return f"{period.name} ({_fa_date(period.start_date)} تا {_fa_date(period.end_date)})"


@router.get("/employee/{employee_id}/{period_id}")
def employee_pdf(employee_id: int, period_id: int, db: Session = Depends(get_db)):
    if not fonts_available():
        raise HTTPException(status_code=503, detail="فونت PDF نصب نیست")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")
    team = db.query(Team).filter(Team.id == emp.team_id).first()

    result = db.query(KPIResult).filter(
        KPIResult.employee_id == employee_id, KPIResult.period_id == period_id
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="برای این کارمند در این دوره نمره‌ای محاسبه نشده است")

    entries = db.query(KPIEntry).filter(
        KPIEntry.employee_id == employee_id, KPIEntry.period_id == period_id
    ).all()
    self_eval = db.query(SelfEvaluation).filter(
        SelfEvaluation.employee_id == employee_id, SelfEvaluation.period_id == period_id
    ).first()
    goals = db.query(Goal).filter(
        Goal.employee_id == employee_id, Goal.period_id == period_id
    ).all()

    def render():
        pdf = KPIPDF(title=f"گزارش عملکرد — {emp.full_name}")
        pdf.add_page()

        pdf.title_bar(f"کارنامه عملکرد {_fa_num(period.name)}")

        # ─── Employee info ───
        pdf.section("اطلاعات کارمند")
        pdf.kv_row("نام و نام خانوادگی:", emp.full_name)
        pdf.kv_row("کد پرسنلی:", _fa_num(emp.employee_code))
        pdf.kv_row("سمت:", emp.position or "—")
        pdf.kv_row("تیم:", team.name if team else "—")
        pdf.kv_row("دوره:", _period_label(period))

        # ─── Final score ───
        pdf.ln(2)
        c = score_color(result.final_score)
        pdf.set_fill_color(*c)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Vazir", "B", 13)
        pdf.cell(0, 12, _shape(f"نمره نهایی: {_fa_score(result.final_score)} از ۱۰۰"),
                 align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

        # ─── Criteria breakdown ───
        if entries:
            pdf.section("جزئیات معیارها")
            crit_names = {c.id: c.name for c in db.query(KPICriterion).all()}
            rows = []
            for e in entries:
                rows.append([
                    crit_names.get(e.criterion_id, "—"),
                    _fa_score(e.score),
                    (e.comment or "—")[:40],
                ])
            pdf.table(["معیار", "نمره", "توضیح"], rows, [70, 25, 90], score_col=1)

        # ─── Self evaluation ───
        if self_eval:
            pdf.section("خودارزیابی")
            pdf.kv_row("نمره خودارزیابی:", _fa_score(self_eval.self_score))
            gap = self_eval.self_score - (result.final_score or 0)
            pdf.kv_row("اختلاف با نمره مدیر:", _fa_score(gap),
                       value_color=score_color(60 if abs(gap) <= 10 else 40))

        # ─── Goals ───
        if goals:
            pdf.section("اهداف")
            rows = [[g.title, _fa_score(g.progress if hasattr(g, "progress") else 0)] for g in goals]
            pdf.table(["عنوان هدف", "پیشرفت"], rows, [120, 40], score_col=1)

        # ─── Breakdown ───
        if result.breakdown:
            pdf.section("ترکیب نمره")
            bd = result.breakdown
            if isinstance(bd, dict):
                for k, v in bd.items():
                    if isinstance(v, (int, float)):
                        pdf.kv_row(f"{k}:", _fa_score(v))
                    elif isinstance(v, dict):
                        for k2, v2 in v.items():
                            if isinstance(v2, (int, float)):
                                pdf.kv_row(f"{k} — {k2}:", _fa_score(v2))

        return pdf

    buf = build_pdf(render)
    from urllib.parse import quote
    fname = quote(f"گزارش-{emp.full_name}-{period.name}.pdf")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=employee_report.pdf; filename*=UTF-8''{fname}"},
    )


@router.get("/team/{team_id}/{period_id}")
def team_pdf(team_id: int, period_id: int, db: Session = Depends(get_db)):
    if not fonts_available():
        raise HTTPException(status_code=503, detail="فونت PDF نصب نیست")

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    members = db.query(Employee).filter(
        Employee.team_id == team_id, Employee.is_archived == False
    ).all()
    results = []
    for m in members:
        r = db.query(KPIResult).filter(
            KPIResult.employee_id == m.id, KPIResult.period_id == period_id
        ).first()
        if r:
            results.append((m, r))
    if not results:
        raise HTTPException(status_code=404, detail="برای این تیم در این دوره نمره‌ای محاسبه نشده است")

    scores = [r.final_score for _, r in results]
    avg = sum(scores) / len(scores)

    def render():
        pdf = KPIPDF(title=f"گزارش تیم — {team.name}")
        pdf.add_page()

        pdf.title_bar(f"گزارش تیم {team.name} — {_fa_num(period.name)}")

        pdf.section("خلاصه")
        pdf.kv_row("تعداد اعضای نمره‌داده‌شده:", _fa_num(len(results)))
        pdf.kv_row("میانگین تیم:", _fa_score(avg))
        pdf.kv_row("بیشترین نمره:", _fa_score(max(scores)))
        pdf.kv_row("کمترین نمره:", _fa_score(min(scores)))

        pdf.section("جدول اعضا")
        rows = []
        for m, r in sorted(results, key=lambda x: x[1].final_score or 0, reverse=True):
            rows.append([
                m.full_name,
                _fa_num(m.employee_code),
                m.position or "—",
                _fa_score(r.final_score),
            ])
        pdf.table(["نام", "کد پرسنلی", "سمت", "نمره نهایی"], rows, [55, 25, 60, 25], score_col=3)

        return pdf

    buf = build_pdf(render)
    from urllib.parse import quote
    fname = quote(f"گزارش-{team.name}-{period.name}.pdf")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=team_report.pdf; filename*=UTF-8''{fname}"},
    )
