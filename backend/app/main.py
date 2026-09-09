"""
KPI Management System — Simplified (No Auth, Single Admin).

Features:
- Team management (create, add/remove employees)
- KPI criteria configuration
- Excel export/import for scoring
- Weighted-average KPI calculation engine
"""
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db, SessionLocal
from .models import Team, Employee, KPICriterion, TeamKPIConfig, ReportingPeriod, CriterionCategory
from .routes import (
    teams, employees, kpi, pips, self_evaluations, custom_reports,
    notifications, goals, hr_analytics, absences, peer_reviews, audit, backup, auth,
    pdf_reports,
)


def seed_default_data():
    """Create default teams, criteria, and sample data."""
    db = SessionLocal()
    try:
        # Check if data exists
        if db.query(Team).first():
            return

        # 1. Create teams
        team_defs = [
            ("نرم‌افزار", "تیم توسعه نرم‌افزار"),
            ("زیرساخت", "تیم زیرساخت و عملیات"),
            ("فروش", "تیم فروش و بازرگانی"),
            ("منابع انسانی", "تیم منابع انسانی"),
            ("مالی", "تیم مالی"),
        ]
        teams_map = {}
        for slug, name in team_defs:
            team = Team(name=name, description=f"تیم {name}")
            db.add(team)
            db.flush()
            teams_map[slug] = team

        # 2. Create KPI criteria
        common_criteria = [
            ("حضور و غیاب", "حضور و تعهد به زمان‌بندی", CriterionCategory.COMMON),
            ("مهارت‌های ارتباطی", "اثربخشی در ارتباطات شفاهی و کتبی", CriterionCategory.COMMON),
            ("همکاری تیمی", "توانایی کار موثر با دیگران", CriterionCategory.COMMON),
            ("حل مسئله", "تفکر تحلیلی و حل خلاقانه مسائل", CriterionCategory.COMMON),
            ("انعطاف‌پذیری", "یادگیری مهارت‌های جدید و سازگاری", CriterionCategory.COMMON),
        ]
        team_specific = [
            ("کیفیت کد", "خوانایی، قابلیت نگهداری و پوشش تست", CriterionCategory.TEAM_SPECIFIC),
            ("سرعت تحویل", "سرعت و قابلیت اطمینان تحویل", CriterionCategory.TEAM_SPECIFIC),
            ("نوآوری فنی", "پیشنهاد و پیاده‌سازی بهبودهای فنی", CriterionCategory.TEAM_SPECIFIC),
            ("دستیابی به هدف فروش", "درصد تحقق اهداف فروش", CriterionCategory.TEAM_SPECIFIC),
            ("روابط با مشتری", "کیفیت تعاملات با مشتری", CriterionCategory.TEAM_SPECIFIC),
            ("رعایت فرآیندها", "رعایت سیاست‌ها و رویه‌ها", CriterionCategory.TEAM_SPECIFIC),
            ("دقت مالی", "دقت و به‌موقع بودن گزارش‌های مالی", CriterionCategory.TEAM_SPECIFIC),
        ]

        all_criteria = {}
        for name, desc, cat in common_criteria + team_specific:
            crit = KPICriterion(name=name, description=desc, category=cat)
            db.add(crit)
            db.flush()
            all_criteria[name] = crit

        # 3. Configure KPI weights per team
        sw = [all_criteria["کیفیت کد"], all_criteria["سرعت تحویل"], all_criteria["نوآوری فنی"],
              all_criteria["همکاری تیمی"], all_criteria["مهارت‌های ارتباطی"], all_criteria["حل مسئله"]]
        sw_w = [30, 25, 15, 15, 10, 5]
        for c, w in zip(sw, sw_w):
            db.add(TeamKPIConfig(team_id=teams_map["نرم‌افزار"].id, criterion_id=c.id, weight=w))

        infra = [all_criteria["کیفیت کد"], all_criteria["سرعت تحویل"], all_criteria["نوآوری فنی"],
                 all_criteria["همکاری تیمی"], all_criteria["حل مسئله"], all_criteria["انعطاف‌پذیری"]]
        infra_w = [25, 20, 20, 15, 15, 5]
        for c, w in zip(infra, infra_w):
            db.add(TeamKPIConfig(team_id=teams_map["زیرساخت"].id, criterion_id=c.id, weight=w))

        sales = [all_criteria["دستیابی به هدف فروش"], all_criteria["روابط با مشتری"],
                 all_criteria["مهارت‌های ارتباطی"], all_criteria["همکاری تیمی"],
                 all_criteria["انعطاف‌پذیری"], all_criteria["حضور و غیاب"]]
        sales_w = [35, 25, 15, 10, 10, 5]
        for c, w in zip(sales, sales_w):
            db.add(TeamKPIConfig(team_id=teams_map["فروش"].id, criterion_id=c.id, weight=w))

        hr = [all_criteria["رعایت فرآیندها"], all_criteria["مهارت‌های ارتباطی"],
              all_criteria["همکاری تیمی"], all_criteria["انعطاف‌پذیری"], all_criteria["حضور و غیاب"]]
        hr_w = [30, 25, 20, 15, 10]
        for c, w in zip(hr, hr_w):
            db.add(TeamKPIConfig(team_id=teams_map["منابع انسانی"].id, criterion_id=c.id, weight=w))

        fin = [all_criteria["دقت مالی"], all_criteria["حضور و غیاب"], all_criteria["رعایت فرآیندها"],
               all_criteria["مهارت‌های ارتباطی"], all_criteria["حل مسئله"]]
        fin_w = [35, 20, 20, 15, 10]
        for c, w in zip(fin, fin_w):
            db.add(TeamKPIConfig(team_id=teams_map["مالی"].id, criterion_id=c.id, weight=w))

        # 4. Sample employees
        sample = [
            ("EMP001", "علی", "رضایی", "مهندس نرم‌افزار", "نرم‌افزار"),
            ("EMP002", "سارا", "احمدی", "توسعه‌گر نرم‌افزار", "نرم‌افزار"),
            ("EMP003", "محمد", "حسنی", "مهندس زیرساخت", "زیرساخت"),
            ("EMP004", "فاطمه", "کریمی", "مسئول فروش", "فروش"),
            ("EMP005", "رضا", "محمدی", "کارشناس منابع انسانی", "منابع انسانی"),
            ("EMP006", "مریم", "باقری", "حسابدار", "مالی"),
        ]
        for code, first, last, pos, team_key in sample:
            emp = Employee(
                employee_code=code, first_name=first, last_name=last,
                position=pos, team_id=teams_map[team_key].id,
                hire_date=date(2023, 4, 14),
            )
            db.add(emp)

        # 5. Sample period
        period = ReportingPeriod(
            name="فصل اول ۱۴۰۴", period_type="quarterly",
            start_date=date(2025, 3, 20), end_date=date(2025, 6, 20),
            is_active=True,
        )
        db.add(period)

        db.commit()
        print("[OK] Default data seeded successfully.")

    except Exception as e:
        db.rollback()
        print(f"[WARN] Seed error: {e}")
    finally:
        db.close()


def seed_default_users():
    """Ensure the built-in admin and HR accounts exist — runs on every
    startup so existing databases (e.g. Docker volumes created before
    authentication was added) still get their login accounts."""
    from .models import User
    from .auth import hash_password
    db = SessionLocal()
    try:
        created = False
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(username="admin", password_hash=hash_password("admin123"),
                        full_name="مدیر سیستم", role="admin",
                        must_change_password=True))
            created = True
        if not db.query(User).filter(User.username == "hr").first():
            db.add(User(username="hr", password_hash=hash_password("hr123"),
                        full_name="مدیر منابع انسانی", role="hr",
                        must_change_password=True))
            created = True
        if created:
            db.commit()
            print("[OK] Default users ensured: admin/admin123, hr/hr123 (must change password on first login)")
    except Exception as e:
        db.rollback()
        print(f"[WARN] User seed error: {e}")
    finally:
        db.close()


def seed_demo_period_with_scores():
    """Ensure a second, closed reporting period exists with calculated
    scores for at least a few employees — so date-range filters and
    comparison features are demonstrable on a fresh install.

    Idempotent: only seeds when fewer than two periods exist. Skips
    quietly on databases that already have real data.
    """
    from .models import KPIEntry, KPIResult
    from .kpi_engine import calculate_and_store
    import random

    db = SessionLocal()
    try:
        periods = db.query(ReportingPeriod).order_by(ReportingPeriod.start_date).all()
        if len(periods) >= 2:
            return  # real data or already seeded

        # Only seed into an obviously empty/demo database
        employees = db.query(Employee).filter(Employee.is_archived == False).all()
        if not employees:
            return

        # Where does the existing (or just-seeded) period sit in time?
        existing = periods[0] if periods else None
        if existing:
            base_y, base_m = existing.start_date.year, existing.start_date.month
            active_is_existing = True
        else:
            today = date.today()
            base_y, base_m = today.year, today.month
            active_is_existing = False

        # Previous quarter as the closed demo period
        def _prev_quarter(y, m):
            return (y - 1, 10) if m <= 3 else (y, ((m - 1) // 3) * 3 - 2)

        py, pm = _prev_quarter(base_y, base_m)
        pm_end = pm + 2
        demo = ReportingPeriod(
            name="دوره نمونه (بسته‌شده)", period_type="quarterly",
            start_date=date(py, pm, 1),
            end_date=date(py, pm_end, 28 if pm_end in (4, 6, 9, 11) else 31),
            is_active=False,  # closed — the other period stays the active one
        )
        db.add(demo)
        db.commit()
        db.refresh(demo)

        # Deterministic pseudo-random scores for a believable spread
        rng = random.Random(1405)
        criteria = db.query(KPICriterion).all()
        scored = 0
        for emp in employees:
            cfgs = db.query(TeamKPIConfig).filter(TeamKPIConfig.team_id == emp.team_id).all()
            use = cfgs if cfgs else [(type("C", (), {"criterion_id": c.id})()) for c in criteria[:3]]
            for cfg in use:
                db.add(KPIEntry(
                    employee_id=emp.id, period_id=demo.id,
                    criterion_id=cfg.criterion_id,
                    score=rng.randint(55, 98),
                    comment=None,
                ))
            scored += 1
        db.commit()

        # Calculate results so reports/comparisons have data
        for emp in employees:
            try:
                calculate_and_store(emp.id, demo.id, db)
            except Exception:
                db.rollback()
        print(f"[OK] Demo period seeded: «{demo.name}» with scores for {scored} employees.")

    except Exception as e:
        db.rollback()
        print(f"[WARN] Demo period seed error: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_default_data()
    seed_default_users()
    seed_demo_period_with_scores()
    # Auto-archive periods >3 months old
    from .routes.kpi import run_auto_archive
    db = SessionLocal()
    try:
        run_auto_archive(db)
    finally:
        db.close()
    # Nightly automatic database backup (30-day retention)
    import asyncio
    from .backup_scheduler import nightly_backup_loop
    backup_task = asyncio.create_task(nightly_backup_loop())
    yield
    backup_task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

import re

def cors_origins():
    """Allow any localhost origin for development flexibility."""
    return ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(employees.router)
app.include_router(kpi.router)
app.include_router(pips.router)
app.include_router(self_evaluations.router)
app.include_router(custom_reports.router)
app.include_router(notifications.router)
app.include_router(goals.router)
app.include_router(hr_analytics.router)
app.include_router(absences.router)
app.include_router(peer_reviews.router)
app.include_router(audit.router)
app.include_router(backup.router)
app.include_router(pdf_reports.router)
from app.routes import dashboard as _dashboard_router  # noqa: E402
app.include_router(_dashboard_router.router)


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
