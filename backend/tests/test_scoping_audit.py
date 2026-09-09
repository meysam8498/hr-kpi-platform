"""
Scoping-audit negative tests.

Every endpoint that once leaked across teams or worked without a token is
locked here:
- PIPs: were completely unauthenticated; now require login everywhere,
  managers are limited to their teams, employees see only their own.
- Notifications: read endpoints require login; delete is admin/HR only.
- Goals: a manager cannot create a goal for another team's employee.
- 360 summary: a manager cannot view another team's employee summary.
- PDF/Excel: cross-team requests are denied even for multi-team managers.
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
def period(db):
    p = ReportingPeriod(
        name="دوره ممیزی", period_type="quarterly",
        start_date=date(2026, 1, 1), end_date=date(2026, 3, 31),
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def two_teams(db):
    ta = Team(name="تیم الف", description="A")
    tb = Team(name="تیم ب", description="B")
    db.add_all([ta, tb])
    db.commit()
    db.refresh(ta)
    db.refresh(tb)
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
    db.refresh(ea)
    db.refresh(eb)
    return ea, eb


# ─── PIPs: previously unauthenticated ────────────────────────────

def test_pip_list_requires_auth(client, db):
    r = client.get("/api/pips/")
    assert r.status_code == 401, r.text


def test_pip_create_requires_auth(client, db, two_teams, members):
    ta, _ = two_teams
    ea, _ = members
    r = client.post("/api/pips/", json={
        "employee_id": ea.id, "title": "t", "target_score": 60,
        "start_date": "2026-01-01", "end_date": "2026-04-01",
    })
    assert r.status_code in (401, 403), r.text


def test_pip_auto_check_requires_admin(client, db, admin_headers):
    r = client.post("/api/pips/check-auto")
    assert r.status_code == 401, r.text
    # manager must also be denied (admin/HR only)
    _mk_user(db, "mgr_pip", "manager")
    h = _login(client, "mgr_pip")
    r2 = client.post("/api/pips/check-auto", headers=h)
    assert r2.status_code == 403, r2.text


def test_manager_cannot_create_pip_for_other_team(client, db, two_teams, members, admin_headers):
    _, tb = two_teams
    _, eb = members
    ta, _ = two_teams
    _mk_user(db, "mgr_a", "manager", team_id=ta.id, managed=[ta.id])
    h = _login(client, "mgr_a")
    r = client.post("/api/pips/", headers=h, json={
        "employee_id": eb.id, "title": "خارج از تیم", "target_score": 60,
        "start_date": "2026-01-01", "end_date": "2026-04-01",
    })
    assert r.status_code == 403, r.text


def test_employee_sees_only_own_pips(client, db, two_teams, members, admin_headers):
    ta, _ = two_teams
    ea, eb = members
    # admin creates PIPs for both employees
    for e in (ea, eb):
        r = client.post("/api/pips/", headers=admin_headers, json={
            "employee_id": e.id, "title": f"طرح {e.employee_code}",
            "target_score": 60, "start_date": "2026-01-01", "end_date": "2026-04-01",
        })
        assert r.status_code == 201, r.text
    _mk_user(db, "emp_a", "employee", team_id=ta.id, employee_id=ea.id)
    h = _login(client, "emp_a")
    r = client.get("/api/pips/", headers=h)
    assert r.status_code == 200
    titles = [p["title"] for p in r.json()]
    assert any("A1" in t for t in titles), titles
    assert not any("B1" in t for t in titles), titles


# ─── Notifications ────────────────────────────────────────────────

def test_notification_list_requires_auth(client, db):
    r = client.get("/api/notifications/")
    assert r.status_code == 401, r.text
    r2 = client.get("/api/notifications/unread-count")
    assert r2.status_code == 401, r2.text


def test_notification_delete_admin_only(client, db, two_teams):
    ta, _ = two_teams
    _mk_user(db, "mgr_n", "manager", team_id=ta.id)
    h = _login(client, "mgr_n")
    r = client.delete("/api/notifications/1", headers=h)
    assert r.status_code == 403, r.text


# ─── Goals ────────────────────────────────────────────────────────

def test_manager_cannot_create_goal_for_other_team(client, db, two_teams, members, period):
    ta, _ = two_teams
    _, eb = members
    _mk_user(db, "mgr_g", "manager", team_id=ta.id, managed=[ta.id])
    h = _login(client, "mgr_g")
    r = client.post("/api/goals/", headers=h, json={
        "employee_id": eb.id, "period_id": period.id,
        "title": "هدف خارج از تیم", "target_value": 10, "unit": "عدد",
    })
    assert r.status_code == 403, r.text


# ─── 360 summary ─────────────────────────────────────────────────

def test_manager_cannot_view_other_team_360_summary(client, db, two_teams, members, period):
    ta, _ = two_teams
    _, eb = members
    _mk_user(db, "mgr_s", "manager", team_id=ta.id, managed=[ta.id])
    h = _login(client, "mgr_s")
    r = client.get(f"/api/peer-reviews/summary/{eb.id}/{period.id}", headers=h)
    assert r.status_code == 403, r.text


# ─── PDF / Excel cross-team ──────────────────────────────────────

def test_manager_multi_team_pdf_allowed_and_denied(client, db, two_teams, members, period, admin_headers):
    """Multi-team manager (grants) may export granted teams, not others."""
    ta, tb = two_teams
    _mk_user(db, "mgr_mt", "manager", team_id=ta.id, managed=[ta.id, tb.id])
    h = _login(client, "mgr_mt")
    # granted team: passes the permission gate (404/503 for missing data is OK)
    r_ok = client.get(f"/api/pdf/team/{tb.id}/{period.id}", headers=h)
    assert r_ok.status_code != 403, r_ok.text
    # a third team with no grant
    tc = Team(name="تیم ج", description="C")
    db.add(tc)
    db.commit()
    db.refresh(tc)
    r_no = client.get(f"/api/pdf/team/{tc.id}/{period.id}", headers=h)
    assert r_no.status_code == 403, r_no.text
