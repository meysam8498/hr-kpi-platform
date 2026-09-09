"""
KPI normalization mode — «normalize only over entered criteria».

A team with 2 configured criteria where the employee was scored on only
one of them:
- default mode: the missing criterion counts as 0 → unfair low score
- normalize_over_entered: only the scored criterion counts → fair score
"""
from datetime import date

import pytest

from app.kpi_engine import calculate_employee_kpi
from app.models import (
    Employee, Team, KPICriterion, TeamKPIConfig, CriterionCategory,
    KPIEntry, ReportingPeriod, TeamScoreBlend,
)


@pytest.fixture
def partial_setup(db):
    team = Team(name="تیم نرمال", description="t")
    db.add(team)
    db.commit()
    db.refresh(team)

    c1 = KPICriterion(name="معیار یک", description="d", category=CriterionCategory.COMMON)
    c2 = KPICriterion(name="معیار دو", description="d", category=CriterionCategory.COMMON)
    db.add_all([c1, c2])
    db.commit()
    db.refresh(c1)
    db.refresh(c2)

    db.add_all([
        TeamKPIConfig(team_id=team.id, criterion_id=c1.id, weight=50.0),
        TeamKPIConfig(team_id=team.id, criterion_id=c2.id, weight=50.0),
    ])
    emp = Employee(employee_code="N1", first_name="نرمال", last_name="ساز",
                   position="کارشناس", team_id=team.id, hire_date=date(2025, 1, 1))
    db.add(emp)
    db.commit()
    db.refresh(emp)

    period = ReportingPeriod(name="دوره ن", period_type="quarterly",
                             start_date=date(2026, 1, 1), end_date=date(2026, 3, 31),
                             is_active=True)
    db.add(period)
    db.commit()
    db.refresh(period)

    # Only c1 scored: 80. c2 has NO entry.
    db.add(KPIEntry(employee_id=emp.id, period_id=period.id, criterion_id=c1.id, score=80.0))
    db.commit()

    return team, emp, period, c1, c2


def test_default_mode_counts_missing_as_zero(db, partial_setup):
    team, emp, period, c1, c2 = partial_setup
    result = calculate_employee_kpi(emp.id, period.id, db)
    assert result is not None
    # 80*50 / 100 = 40 — punished for the missing entry
    assert result["final_score"] == 40.0
    assert result["breakdown"]["normalize_over_entered"] is False


def test_normalize_over_entered_skips_missing(db, partial_setup):
    team, emp, period, c1, c2 = partial_setup
    db.query(TeamKPIConfig).filter(TeamKPIConfig.team_id == team.id).update(
        {"normalize_over_entered": True}
    )
    db.commit()
    result = calculate_employee_kpi(emp.id, period.id, db)
    assert result is not None
    # 80*50 / 50 = 80 — only entered criteria count
    assert result["final_score"] == 80.0
    assert result["breakdown"]["normalize_over_entered"] is True


def test_fully_scored_team_unchanged_by_flag(db, partial_setup):
    team, emp, period, c1, c2 = partial_setup
    db.add(KPIEntry(employee_id=emp.id, period_id=period.id, criterion_id=c2.id, score=60.0))
    db.query(TeamKPIConfig).filter(TeamKPIConfig.team_id == team.id).update(
        {"normalize_over_entered": True}
    )
    db.commit()
    result = calculate_employee_kpi(emp.id, period.id, db)
    # (80*50 + 60*50) / 100 = 70 — identical in both modes
    assert result["final_score"] == 70.0
