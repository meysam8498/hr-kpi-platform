"""
Smoke tests for the no-auth single-admin API.

The system is intentionally authentication-free (one admin manages everything).
These tests confirm the core endpoints are reachable and behave correctly.
"""
from datetime import date


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200


def test_teams_list_empty(client, admin_headers):
    r = client.get("/api/teams/", headers=admin_headers)
    assert r.status_code == 200


def test_create_and_list_team(client, admin_headers):
    r = client.post("/api/teams/", json={"name": "T1", "description": "desc"}, headers=admin_headers)
    assert r.status_code == 201
    team_id = r.json()["id"]
    r = client.get("/api/teams/", headers=admin_headers)
    assert any(t["id"] == team_id for t in r.json())


def test_employee_crud(client, team, admin_headers):
    # Create team via API
    tr = client.post("/api/teams/", json={"name": "Software"}, headers=admin_headers)
    team_id = tr.json()["id"]

    r = client.post("/api/employees/", json={
        "employee_code": "EMP01", "first_name": "Ali", "last_name": "Rezaei",
        "position": "Dev", "team_id": team_id, "hire_date": "2024-01-01",
    }, headers=admin_headers)
    assert r.status_code == 201
    emp_id = r.json()["id"]

    r = client.get(f"/api/employees/{emp_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["employee_code"] == "EMP01"

    # Duplicate code rejected
    r = client.post("/api/employees/", json={
        "employee_code": "EMP01", "first_name": "A", "last_name": "B",
        "position": "X", "team_id": team_id, "hire_date": "2024-01-01",
    }, headers=admin_headers)
    assert r.status_code == 400

    # Transfer
    tr2 = client.post("/api/teams/", json={"name": "Sales"}, headers=admin_headers)
    t2 = tr2.json()["id"]
    r = client.put(f"/api/employees/{emp_id}/transfer?new_team_id={t2}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["team_id"] == t2

    # Archive + unarchive
    r = client.put(f"/api/employees/{emp_id}/archive", headers=admin_headers)
    assert r.status_code == 200 and r.json()["is_archived"] is True
    r = client.put(f"/api/employees/{emp_id}/unarchive", headers=admin_headers)
    assert r.status_code == 200 and r.json()["is_archived"] is False


def test_bulk_import_json(client, admin_headers):
    tr = client.post("/api/teams/", json={"name": "Team"}, headers=admin_headers)
    team_id = tr.json()["id"]
    payload = [
        {"employee_code": "B1", "first_name": "A", "last_name": "One", "position": "X", "team_id": team_id, "hire_date": "2024-01-01"},
        {"employee_code": "B2", "first_name": "B", "last_name": "Two", "position": "Y", "team_id": team_id, "hire_date": "2024-02-01"},
    ]
    r = client.post("/api/employees/import-json", json=payload, headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert len(body["skipped"]) == 0


def test_team_blend_config(client, admin_headers):
    tr = client.post("/api/teams/", json={"name": "Blend"}, headers=admin_headers)
    team_id = tr.json()["id"]
    # Defaults
    r = client.get(f"/api/kpi/teams/{team_id}/blend", headers=admin_headers)
    assert r.status_code == 200
    assert abs(r.json()["base_weight"] - 0.70) < 0.001
    # Update
    r = client.put(f"/api/kpi/teams/{team_id}/blend", json={"base_weight": 0.5, "peer_weight": 0.3, "goal_weight": 0.2}, headers=admin_headers)
    assert r.status_code == 200
    assert abs(r.json()["base_weight"] - 0.5) < 0.001


def test_audit_logged_on_create(client, admin_headers):
    tr = client.post("/api/teams/", json={"name": "Audit"}, headers=admin_headers)
    team_id = tr.json()["id"]
    client.post("/api/employees/", json={
        "employee_code": "A1", "first_name": "A", "last_name": "B",
        "position": "X", "team_id": team_id, "hire_date": "2024-01-01",
    }, headers=admin_headers)
    r = client.get("/api/audit-logs/", headers=admin_headers)
    assert r.status_code == 200
    assert any(log["entity_type"] == "employee" for log in r.json())


def test_backup_info(client, admin_headers):
    r = client.get("/api/backup/info", headers=admin_headers)
    assert r.status_code == 200
    assert "size_bytes" in r.json()


def test_hr_analytics_returns_sections(client, admin_headers):
    r = client.get("/api/hr/analytics", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    for key in ["workforce", "periods", "trend", "improvement", "absences",
                "self_gap", "decline_alerts", "goals_achievement"]:
        assert key in data


def test_employee_cannot_create_team(client, admin_headers):
    """Role enforcement: a plain employee must get 403 on team creation."""
    from app.auth import hash_password
    res = client.post("/api/auth/login", json={"username": "testadmin", "password": "testpass123"})
    token = res.json()["token"]
    # create an employee-role user via admin
    import jwt as _jwt
    from app.auth import SECRET_KEY, ALGORITHM
    from app.database import SessionLocal as _ignored
    # create user directly through admin API
    r = client.post("/api/auth/users", json={
        "username": "empuser", "password": "emppass1", "full_name": "Emp User", "role": "employee",
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, r.text
    emp_res = client.post("/api/auth/login", json={"username": "empuser", "password": "emppass1"})
    emp_token = emp_res.json()["token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # employee cannot create a team
    r = client.post("/api/teams/", json={"name": "Sneaky"}, headers=emp_headers)
    assert r.status_code == 403
    # employee cannot create an employee
    r = client.post("/api/employees/", json={
        "employee_code": "X9", "first_name": "X", "last_name": "Y",
        "position": "Z", "team_id": 1, "hire_date": "2024-01-01",
    }, headers=emp_headers)
    assert r.status_code == 403
    # employee cannot list other employees' audit logs
    r = client.get("/api/audit-logs/", headers=emp_headers)
    assert r.status_code == 403
    # employee cannot read HR analytics
    r = client.get("/api/hr/analytics", headers=emp_headers)
    assert r.status_code == 403