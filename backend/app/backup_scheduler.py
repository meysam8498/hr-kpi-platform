"""
Nightly automatic database backup with retention.

Runs inside the FastAPI lifespan as an asyncio background task:
- every BACKUP_INTERVAL_HOURS (default 24h) snapshots the SQLite database
- snapshots go to <db-dir>/backups/kpi_backup_YYYYMMDD_HHMMSS.db
- keeps the newest BACKUP_RETENTION_DAYS (default 30), deletes older ones

Pure standard library — no new dependencies.
"""
import asyncio
import os
import sqlite3
from datetime import datetime, timezone

from .config import settings

BACKUP_INTERVAL_HOURS = 24
BACKUP_RETENTION_DAYS = 30


def backup_dir() -> str:
    db_path = settings.DATABASE_URL
    if db_path.startswith("sqlite:///"):
        db_path = db_path[len("sqlite:///"):]
    return os.path.join(os.path.dirname(os.path.abspath(db_path)), "backups")


def create_backup() -> str | None:
    """Snapshot the live database with the SQLite online-backup API. Returns the path."""
    db_path = settings.DATABASE_URL
    if not db_path.startswith("sqlite:///"):
        return None
    db_path = db_path[len("sqlite:///"):]
    if not os.path.exists(db_path):
        return None

    os.makedirs(backup_dir(), exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(backup_dir(), f"kpi_backup_{stamp}.db")

    src = sqlite3.connect(db_path)
    try:
        dst = sqlite3.connect(dest)
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()
    return dest


def prune_old_backups(keep_days: int = BACKUP_RETENTION_DAYS) -> int:
    """Delete backups older than keep_days. Returns how many were removed."""
    cutoff = datetime.now().timestamp() - keep_days * 86400
    removed = 0
    try:
        for name in os.listdir(backup_dir()):
            if not name.startswith("kpi_backup_") or not name.endswith(".db"):
                continue
            path = os.path.join(backup_dir(), name)
            if os.path.getmtime(path) < cutoff:
                os.unlink(path)
                removed += 1
    except OSError:
        pass
    return removed


async def nightly_backup_loop():
    """Background task: backup every interval, prune old snapshots."""
    # First backup shortly after startup, then every interval.
    await asyncio.sleep(30)
    while True:
        try:
            path = create_backup()
            removed = prune_old_backups()
            if path:
                size_mb = os.path.getsize(path) / (1024 * 1024)
                print(f"[BACKUP] {os.path.basename(path)} ({size_mb:.1f} MB) — pruned {removed} old snapshot(s)")
        except Exception as e:  # never crash the app over a backup failure
            print(f"[BACKUP] error: {e}")
        await asyncio.sleep(BACKUP_INTERVAL_HOURS * 3600)
