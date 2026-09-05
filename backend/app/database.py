"""
Database engine and session management.

Uses SQLite for zero-dependency local operation.
The async driver is aiosqlite; SQLAlchemy 2.0 async patterns.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import settings

# SQLite works synchronously under the hood even with aiosqlite.
# We use synchronous SQLAlchemy for simplicity and reliability.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite-specific
    echo=settings.DEBUG,
)

# Enable WAL mode and foreign keys for better concurrency and integrity
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """
    FastAPI dependency that yields a database session.
    Ensures proper cleanup after each request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all tables. Called on application startup.
    """
    # Import models so they register with Base.metadata
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
