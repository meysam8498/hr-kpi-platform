"""
Test configuration and fixtures.

Uses an in-memory SQLite database for fast, isolated tests.
StaticPool ensures all connections share the same in-memory DB.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import (
    Team, Employee, KPICriterion, TeamKPIConfig, CriterionCategory,
    User,
)

# In-memory test database with StaticPool so all sessions share the same DB
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign keys for SQLite
@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    from app import models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    """Provide a database session for tests."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """Provide a FastAPI test client."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def admin_headers(client):
    """Create an admin user and return Authorization headers."""
    from app.auth import hash_password
    from app.database import SessionLocal

    # Use the real SessionLocal bound to the test override? No — get_db is
    # overridden to the in-memory test DB, so create the user via the client
    # after directly inserting with the test session.
    from tests.conftest import TestSessionLocal  # noqa: F401
    from sqlalchemy.orm import Session as _S

    # Insert admin directly using the same engine the app's get_db override uses
    session = TestSessionLocal()
    user = session.query(User).filter(User.username == "testadmin").first()
    if not user:
        user = User(
            username="testadmin",
            password_hash=hash_password("testpass123"),
            full_name="Test Admin",
            role="admin",
        )
        session.add(user)
        session.commit()
    user_id = user.id
    session.close()

    res = client.post("/api/auth/login", json={"username": "testadmin", "password": "testpass123"})
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def team(db):
    """Create a team."""
    t = Team(name="Test Team", description="A test team")
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@pytest.fixture
def employee_profile(db, team):
    """Create an employee profile."""
    profile = Employee(
        employee_code="T001",
        first_name="Test",
        last_name="Employee",
        position="Developer",
        team_id=team.id,
        hire_date=date(2024, 1, 1),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@pytest.fixture
def sample_criteria(db):
    """Create common KPI criteria for testing."""
    criteria = [
        KPICriterion(name="Quality", description="Work quality", category=CriterionCategory.COMMON),
        KPICriterion(name="Speed", description="Delivery speed", category=CriterionCategory.COMMON),
        KPICriterion(name="Teamwork", description="Collaboration", category=CriterionCategory.COMMON),
    ]
    for c in criteria:
        db.add(c)
    db.commit()
    for c in criteria:
        db.refresh(c)
    return criteria


@pytest.fixture
def team_kpi_config(db, team, sample_criteria):
    """Configure KPI weights for the test team."""
    configs = []
    weights = [40, 35, 25]  # Sum = 100
    for crit, weight in zip(sample_criteria, weights):
        cfg = TeamKPIConfig(
            team_id=team.id,
            criterion_id=crit.id,
            weight=weight,
        )
        db.add(cfg)
        configs.append(cfg)
    db.commit()
    for cfg in configs:
        db.refresh(cfg)
    return configs


@pytest.fixture
def reporting_period(db):
    """Create a reporting period."""
    from app.models import ReportingPeriod
    period = ReportingPeriod(
        name="Q1 2026",
        period_type="quarterly",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 31),
        is_active=True,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period