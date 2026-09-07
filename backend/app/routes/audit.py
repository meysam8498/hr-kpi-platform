"""
Audit Log routes — compliance trail of who changed what and when.

A lightweight `log_audit` helper is reused across route files so every
score submission, employee edit, and config change is recorded.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog, User
from ..schemas import AuditLogOut
from ..auth import require_admin_or_hr

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


def log_audit(db: Session, action: str, entity_type: str, entity_id: int | None, description: str):
    """Record an audit entry (caller commits the session)."""
    db.add(AuditLog(
        action=action, entity_type=entity_type,
        entity_id=entity_id, description=description,
    ))


@router.get("/", response_model=list[AuditLogOut])
def list_logs(
    entity_type: str = None,
    action: str = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_hr),
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.created_at.desc()).limit(min(limit, 500)).all()
    return logs