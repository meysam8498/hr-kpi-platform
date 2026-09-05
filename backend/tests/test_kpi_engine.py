"""
Tests for the KPI Calculation Engine.

Covers:
- Weighted-average base formula
- Blending with peer reviews and goal achievement
- Edge cases (missing scores, no config)
- Result caching and idempotency
- Employee history
"""
from datetime import date

from app.kpi_engine import (
    calculate_employee_kpi, calculate_and_store, calculate_team_results,
    get_employee_history, _peer_score, _goal_achievement,
)
from app.models import (
    KPIEntry, KPIResult, Employee, Team, ReportingPeriod,
    PeerReview, Goal,
)


def _score_all(db, emp, period, criteria, score):
    for crit in criteria:
        db.add(KPIEntry(employee_id=emp.id, criterion_id=crit.id, period_id=period.id, score=float(score)))
    db.commit()


class TestWeightedAverageBase:
    def test_equal_weight_scoring(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        _score_all(db, employee_profile, reporting_period, sample_criteria, 80.0)
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        assert abs(result["final_score"] - 80.0) < 0.01
        assert result["blend"]["base_score"] == 80.0

    def test_weighted_average_calculation(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        scores = [100.0, 80.0, 60.0]  # weights [40, 35, 25]
        for crit, score in zip(sample_criteria, scores):
            db.add(KPIEntry(employee_id=employee_profile.id, criterion_id=crit.id, period_id=reporting_period.id, score=score))
        db.commit()
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        # No peer/goal data → renormalized over base only → final == base
        assert abs(result["final_score"] - 83.0) < 0.01

    def test_missing_score_treated_as_zero(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        db.add(KPIEntry(employee_id=employee_profile.id, criterion_id=sample_criteria[0].id, period_id=reporting_period.id, score=100.0))
        db.commit()
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        assert abs(result["final_score"] - 40.0) < 0.01

    def test_no_criteria_configured_returns_none(self, db, employee_profile, reporting_period):
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is None

    def test_no_entries_returns_zero(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        assert result["final_score"] == 0.0


class TestBlend:
    def test_blend_with_peer_and_goal(self, db, team, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        # A real reviewer (FK to employees)
        reviewer = Employee(employee_code="R1", first_name="Rev", last_name="iewer",
                            position="Mgr", team_id=team.id, hire_date=date(2024, 1, 1))
        db.add(reviewer)
        db.commit()
        _score_all(db, employee_profile, reporting_period, sample_criteria, 80.0)
        # Peer review: teamwork 90, comm 90, reli 90 → peer = 90
        db.add(PeerReview(reviewer_id=reviewer.id, reviewee_id=employee_profile.id, period_id=reporting_period.id,
                          teamwork_score=90, communication_score=90, reliability_score=90))
        # Goal: 50/50 → 100
        db.add(Goal(employee_id=employee_profile.id, period_id=reporting_period.id,
                    title="Goal", target_value=50, current_value=50))
        db.commit()
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        b = result["blend"]
        assert b["base_score"] == 80.0
        assert b["peer_score"] == 90.0
        assert b["peer_count"] == 1
        assert b["goal_achievement"] == 100.0
        assert b["goal_count"] == 1
        # Default weights 0.7/0.15/0.15, sum=1 → 0.7*80 + 0.15*90 + 0.15*100 = 56 + 13.5 + 15 = 84.5
        assert abs(result["final_score"] - 84.5) < 0.01

    def test_blend_renormalizes_when_no_peer(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        _score_all(db, employee_profile, reporting_period, sample_criteria, 80.0)
        db.add(Goal(employee_id=employee_profile.id, period_id=reporting_period.id,
                    title="Goal", target_value=50, current_value=25))
        db.commit()
        result = calculate_employee_kpi(employee_profile.id, reporting_period.id, db)
        assert result is not None
        b = result["blend"]
        assert b["peer_count"] == 0
        assert b["goal_count"] == 1
        # Available components: base (0.7) + goal (0.15) → normalized sum 0.85
        # final = (0.7*80 + 0.15*50) / 0.85 = (56 + 7.5) / 0.85 = 74.7
        assert abs(result["final_score"] - 74.7) < 0.01


class TestCalculationAndStorage:
    def test_first_calculation_creates_result(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        _score_all(db, employee_profile, reporting_period, sample_criteria, 75.0)
        result = calculate_and_store(employee_profile.id, reporting_period.id, db)
        assert result is not None
        assert abs(result.final_score - 75.0) < 0.01
        stored = db.query(KPIResult).filter(
            KPIResult.employee_id == employee_profile.id,
            KPIResult.period_id == reporting_period.id,
        ).first()
        assert stored is not None
        assert stored.breakdown is not None

    def test_recalculation_overwrites(self, db, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        _score_all(db, employee_profile, reporting_period, sample_criteria, 50.0)
        r1 = calculate_and_store(employee_profile.id, reporting_period.id, db)
        assert abs(r1.final_score - 50.0) < 0.01
        for entry in db.query(KPIEntry).filter(
            KPIEntry.employee_id == employee_profile.id,
            KPIEntry.period_id == reporting_period.id,
        ).all():
            entry.score = 90.0
        db.commit()
        r2 = calculate_and_store(employee_profile.id, reporting_period.id, db)
        assert abs(r2.final_score - 90.0) < 0.01
        count = db.query(KPIResult).filter(
            KPIResult.employee_id == employee_profile.id,
            KPIResult.period_id == reporting_period.id,
        ).count()
        assert count == 1


class TestEmployeeHistory:
    def test_history_chronological_order(self, db, employee_profile, sample_criteria, team_kpi_config):
        periods = []
        for i, (ms, me) in enumerate([
            (date(2026, 1, 1), date(2026, 1, 31)),
            (date(2026, 2, 1), date(2026, 2, 28)),
            (date(2026, 3, 1), date(2026, 3, 31)),
        ]):
            p = ReportingPeriod(name=f"Period {i+1}", period_type="monthly", start_date=ms, end_date=me)
            db.add(p)
            db.flush()
            periods.append(p)
            for crit in sample_criteria:
                db.add(KPIEntry(employee_id=employee_profile.id, criterion_id=crit.id, period_id=p.id, score=float(60 + i * 10)))
        db.commit()
        for p in periods:
            calculate_and_store(employee_profile.id, p.id, db)
        history = get_employee_history(employee_profile.id, db)
        assert len(history) == 3
        # get_employee_history returns newest-first
        assert history[0]["period_name"] == "Period 3"
        assert history[2]["period_name"] == "Period 1"
        assert history[0]["final_score"] > history[2]["final_score"]


class TestTeamCalculation:
    def test_team_results_include_all_members(self, db, team, employee_profile, sample_criteria, team_kpi_config, reporting_period):
        emp2 = Employee(employee_code="T002", first_name="Second", last_name="Employee",
                        position="Tester", team_id=team.id, hire_date=date(2024, 1, 1))
        db.add(emp2)
        db.commit()
        for crit in sample_criteria:
            db.add(KPIEntry(employee_id=emp2.id, criterion_id=crit.id, period_id=reporting_period.id, score=70.0))
        db.commit()
        results = calculate_team_results(team.id, reporting_period.id, db)
        emp2_result = next(r for r in results if r["employee_id"] == emp2.id)
        assert abs(emp2_result["final_score"] - 70.0) < 0.01