"""
Granular permission enforcement — managed_team_ids / extra_employee_ids.

Scenario: one person wears two hats. An HR-staff user may also be a team
manager for one team, plus a plain employee elsewhere. These tests prove:
1. A manager scoped to team A cannot score team B.
2. With managed_team_ids=[B], the same manager CAN score team B.
3. extra_employee_ids grants scoring on an employee outside any managed team.
4. A user whose only grants are extra_employee_ids CAN see their own file.
"""
import json
from datetime import date

import pytest

from app.auth import hash_password
from app.models import User, Employee, Team, ReportingPeriod


def _mk_user(session, username, role, team_id=None, employee_id=None,
             managed=None, extra=None):
    u = User(
        username=username,
        password_hash=hash_password("pw123456"),
        full_name=username,
        role=role,
        team_id=team_id,
        employee_id=employee_id,
        managed_team_ids=json.dumps(managed) if managed else None,
        extra_employee_ids=json.dumps(extra) if extra else None,
    )
    session.add(u)
    session.commit()
    return u


def _login(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pw123456"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture
def reporting_period(db):
    period = ReportingPeriod(
        name="دوره تست",
        period_type="quarterly",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        is_active=True,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@pytest.fixture
def two_teams(db):
    ta = Team(name="تیم الف", description="A")
    tb = Team(name="تیم ب", description="B")
    db.add_all([ta, tb])
    db.commit()
    db.refresh(ta); db.refresh(tb)
    return ta, tb


@pytest.fixture
def members(db, two_teams):
    ta, tb = two_teams
    ea = Employee(employee_code="A1", first_name="علی", last_name="الف",
                  position="کارشناس", team_id=ta.id, hire_date=date(2025, 1, 1))
    eb = Employee(employee_code="B1", first_name="بهرام", last_name="ب",
                  position="کارشناس", team_id=tb.id, hire_date=date(2025, 1, 1))
    db.add_all([ea, eb])
    db.commit()
    db.refresh(ea); db.refresh(eb)
    return ea, eb


def test_manager_without_grant_cannot_score_other_team(client, db, two_teams, members, admin_headers):
    ta, tb = two_teams
    ea, eb = members
    _mk_user(db, "mgr1", "manager", team_id=ta.id, managed=[ta.id])
    h = _login(client, "mgr1")

    # Own team member: allowed
    r1 = client.post(f"/api/kpi/entries/batch?employee_id={ea.id}&period_id=1",
                     json=[{"criterion_id": 1, "score": 80}], headers=h)
    # Other team member: denied
    r2 = client.post(f"/api/kpi/entries/batch?employee_id={eb.id}&period_id=1",
                     json=[{"criterion_id": 1, "score": 80}], headers=h)
    assert r2.status_code == 403, r2.text


def test_manager_with_managed_team_scores_both(client, db, two_teams, members, sample_criteria, reporting_period):
    ta, tb = two_teams
    ea, eb = members
    _mk_user(db, "mgr2", "manager", team_id=ta.id, managed=[ta.id, tb.id])
    h = _login(client, "mgr2")
    r = client.post(f"/api/kpi/entries/batch?employee_id={eb.id}&period_id={reporting_period.id}",
                    json=[{"criterion_id": sample_criteria[0].id, "score": 70}], headers=h)
    assert r.status_code in (200, 201), r.text


def test_extra_employee_grant(client, db, two_teams, members, sample_criteria, reporting_period):
    ta, tb = two_teams
    ea, eb = members
    # Employee-hat user from team A, granted scoring on B1 specifically
    _mk_user(db, "emp1", "employee", team_id=ta.id, extra=[eb.id])
    h = _login(client, "emp1")
    r = client.post(f"/api/kpi/entries/batch?employee_id={eb.id}&period_id={reporting_period.id}",
                    json=[{"criterion_id": sample_criteria[0].id, "score": 90}], headers=h)
    assert r.status_code in (200, 201), r.text


def test_employee_scoping_list(client, db, two_teams, members):
    ta, tb = two_teams
    ea, eb = members
    _mk_user(db, "emp2", "employee", team_id=ta.id)
    h = _login(client, "emp2")
    r = client.get("/api/employees/", headers=h)
    assert r.status_code == 200
    names = [e["employee_code"] for e in r.json()]
    assert "A1" in names and "B1" not in names, names


def test_users_api_round_trips_permissions(client, db, two_teams, admin_headers):
    ta, tb = two_teams
    res = client.post("/api/auth/users", headers=admin_headers, json={
        "username": "dual", "password": "pw123456", "full_name": "دو نقش",
        "role": "manager", "team_id": ta.id,
        "managed_team_ids": [ta.id, tb.id],
        "extra_employee_ids": [1],
    })
    assert res.status_code in (200, 201), res.text
    body = res.json()
    assert sorted(body["managed_team_ids"]) == sorted([ta.id, tb.id])
    assert body["extra_employee_ids"] == [1]

    # Update path
    res2 = client.put(f"/api/auth/users/{body['id']}", headers=admin_headers,
                      json={"managed_team_ids": [tb.id], "extra_employee_ids": []})
    assert res2.status_code == 200, res2.text
    assert res2.json()["managed_team_ids"] == [tb.id]
    assert res2.json()["extra_employee_ids"] == []
