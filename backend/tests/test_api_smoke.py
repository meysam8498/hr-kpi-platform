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


def test_teams_list_empty(client):
    r = client.get("/api/teams/")
    assert r.status_code == 200


def test_create_and_list_team(client):
    r = client.post("/api/teams/", json={"name": "T1", "description": "desc"})
    assert r.status_code == 201
    team_id = r.json()["id"]
    r = client.get("/api/teams/")
    assert any(t["id"] == team_id for t in r.json())


def test_employee_crud(client, team):
    # Create team via API
    tr = client.post("/api/teams/", json={"name": "Software"})
    team_id = tr.json()["id"]

    r = client.post("/api/employees/", json={
        "employee_code": "EMP01", "first_name": "Ali", "last_name": "Rezaei",
        "position": "Dev", "team_id": team_id, "hire_date": "2024-01-01",
    })
    assert r.status_code == 201
    emp_id = r.json()["id"]

    r = client.get(f"/api/employees/{emp_id}")
    assert r.status_code == 200
    assert r.json()["employee_code"] == "EMP01"

    # Duplicate code rejected
    r = client.post("/api/employees/", json={
        "employee_code": "EMP01", "first_name": "A", "last_name": "B",
        "position": "X", "team_id": team_id, "hire_date": "2024-01-01",
    })
    assert r.status_code == 400

    # Transfer
    tr2 = client.post("/api/teams/", json={"name": "Sales"})
    t2 = tr2.json()["id"]
    r = client.put(f"/api/employees/{emp_id}/transfer?new_team_id={t2}")
    assert r.status_code == 200
    assert r.json()["team_id"] == t2

    # Archive + unarchive
    r = client.put(f"/api/employees/{emp_id}/archive")
    assert r.status_code == 200 and r.json()["is_archived"] is True
    r = client.put(f"/api/employees/{emp_id}/unarchive")
    assert r.status_code == 200 and r.json()["is_archived"] is False


def test_bulk_import_json(client):
    tr = client.post("/api/teams/", json={"name": "Team"})
    team_id = tr.json()["id"]
    payload = [
        {"employee_code": "B1", "first_name": "A", "last_name": "One", "position": "X", "team_id": team_id, "hire_date": "2024-01-01"},
        {"employee_code": "B2", "first_name": "B", "last_name": "Two", "position": "Y", "team_id": team_id, "hire_date": "2024-02-01"},
    ]
    r = client.post("/api/employees/import-json", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert len(body["skipped"]) == 0


def test_team_blend_config(client):
    tr = client.post("/api/teams/", json={"name": "Blend"})
    team_id = tr.json()["id"]
    # Defaults
    r = client.get(f"/api/kpi/teams/{team_id}/blend")
    assert r.status_code == 200
    assert abs(r.json()["base_weight"] - 0.70) < 0.001
    # Update
    r = client.put(f"/api/kpi/teams/{team_id}/blend", json={"base_weight": 0.5, "peer_weight": 0.3, "goal_weight": 0.2})
    assert r.status_code == 200
    assert abs(r.json()["base_weight"] - 0.5) < 0.001


def test_audit_logged_on_create(client):
    tr = client.post("/api/teams/", json={"name": "Audit"})
    team_id = tr.json()["id"]
    client.post("/api/employees/", json={
        "employee_code": "A1", "first_name": "A", "last_name": "B",
        "position": "X", "team_id": team_id, "hire_date": "2024-01-01",
    })
    r = client.get("/api/audit-logs/")
    assert r.status_code == 200
    assert any(log["entity_type"] == "employee" for log in r.json())


def test_backup_info(client):
    r = client.get("/api/backup/info")
    assert r.status_code == 200
    assert "size_bytes" in r.json()


def test_hr_analytics_returns_sections(client):
    r = client.get("/api/hr/analytics")
    assert r.status_code == 200
    data = r.json()
    for key in ["workforce", "periods", "trend", "improvement", "absences",
                "self_gap", "decline_alerts", "goals_achievement"]:
        assert key in data