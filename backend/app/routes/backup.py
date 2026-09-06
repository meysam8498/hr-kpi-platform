"""
Backup / Restore routes — one-click SQLite backup for a local-first HR tool.

Download: serves a snapshot of the SQLite database file.
Restore:  replaces the live database from an uploaded backup using the
          SQLite online-backup API (safe while the app is running).
"""
import os
import sqlite3
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse

from ..config import settings
from ..database import engine, get_db
from ..auth import require_admin
from ..models import User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/backup", tags=["Backup"])


def _db_path() -> str:
    url = settings.DATABASE_URL
    if url.startswith("sqlite:///"):
        path = url[len("sqlite:///"):]
        return path
    raise HTTPException(status_code=500, detail="فقط از SQLite پشتیبانی می‌شود")


@router.get("/info")
def backup_info(db: Session = Depends(get_db)):
    path = _db_path()
    try:
        size = os.path.getsize(path)
    except OSError:
        size = 0
    return {
        "database_path": path,
        "size_bytes": size,
        "size_mb": round(size / (1024 * 1024), 2) if size else 0.0,
        "last_modified": datetime.fromtimestamp(os.path.getmtime(path)).isoformat() if size else None,
    }


@router.get("/download")
def download_backup(_: User = Depends(require_admin)):
    path = _db_path()
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="فایل دیتابیس یافت نشد")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=f"kpi_backup_{stamp}.db",
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Replace the live database with the uploaded backup file."""
    content = await file.read()
    if len(content) < 100:  # clearly not a valid SQLite db
        raise HTTPException(status_code=400, detail="فایل معتبر نیست (حجم بسیار کم)")

    src_path = None
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    try:
        tmp.write(content)
        tmp.close()
        src_path = tmp.name

        # Validate it is a real SQLite file
        with sqlite3.connect(src_path) as conn:
            conn.execute("SELECT count(*) FROM sqlite_master")

        dst_path = _db_path()
        src = sqlite3.connect(src_path)
        try:
            dst = sqlite3.connect(dst_path)
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()

        # Drop SQLAlchemy's connection pool so it reopens the new file
        engine.dispose()
        return {"message": "دیتابیس با موفقیت بازیابی شد", "bytes": len(content)}
    except sqlite3.DatabaseError:
        raise HTTPException(status_code=400, detail="فایل آپلودشده یک دیتابیس SQLite معتبر نیست")
    finally:
        if src_path:
            os.unlink(src_path)