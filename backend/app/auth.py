"""
Authentication — JWT-based sessions with role-based access control.

Roles (least → most privilege):
- employee:  own reports + own self-evaluation
- manager:   own-team scoring + own-team reports
- hr:        HR manager — everything except user management
- admin:     full control incl. user management
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# ─── Login rate limiting ────────────────────────────────────
# In-memory sliding window per client IP: max LOGIN_MAX_ATTEMPTS
# failures within LOGIN_WINDOW_SECONDS → temporary lockout.
# (Single-process local app; no external cache needed.)
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300  # 5 minutes
LOGIN_LOCKOUT_SECONDS = 600  # 10 minutes

_failed_logins: dict[str, list[float]] = defaultdict(list)


def check_login_rate_limit(client_ip: str) -> None:
    """Raise 429 if this IP is currently locked out."""
    now = datetime.now(timezone.utc).timestamp()
    attempts = [t for t in _failed_logins.get(client_ip, []) if now - t < LOGIN_LOCKOUT_SECONDS]
    _failed_logins[client_ip] = attempts
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"تلاش‌های ناموفق زیاد است — {LOGIN_LOCKOUT_SECONDS // 60} دقیقه دیگر دوباره تلاش کنید",
        )


def record_failed_login(client_ip: str) -> None:
    now = datetime.now(timezone.utc).timestamp()
    attempts = [t for t in _failed_logins.get(client_ip, []) if now - t < LOGIN_WINDOW_SECONDS]
    attempts.append(now)
    _failed_logins[client_ip] = attempts


def clear_failed_logins(client_ip: str) -> None:
    _failed_logins.pop(client_ip, None)

# Secret: overridden via env var in production deployments.
SECRET_KEY = "kpi-local-secret-change-me"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "team_id": user.team_id,
        "employee_id": user.employee_id,
        "must_change_password": bool(user.must_change_password),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve the user from the Authorization Bearer token."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="برای دسترسی باید وارد شوید")
    token = auth[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="نشست شما منقضی شده — دوباره وارد شوید")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="توکن نامعتبر است")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="حساب کاربری غیرفعال است")
    return user


# ─── Role gates ──────────────────────────────────────────────

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="فقط مدیر سیستم به این بخش دسترسی دارد")
    return user


def require_admin_or_hr(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="دسترسی به این بخش برای شما مجاز نیست")
    return user


def require_manager_plus(user: User = Depends(get_current_user)) -> User:
    if user.role in ("admin", "hr", "manager"):
        return user
    # Tick-based grants also qualify: someone handed a team or specific
    # employees via the users page may score exactly those (route body
    # still scopes per-employee via can_touch_employee).
    if managed_team_ids(user) or extra_employee_ids(user):
        return user
    raise HTTPException(status_code=403, detail="دسترسی به این بخش برای شما مجاز نیست")


# ─── Scope helpers (call inside route bodies) ─────────────────

def is_hr_plus(user: User) -> bool:
    return user.role in ("admin", "hr")


def is_manager_plus(user: User) -> bool:
    return user.role in ("admin", "hr", "manager")


def ensure_team_scope(user: User, team_id) -> None:
    """Managers may only act on their own team. admin/hr unrestricted."""
    if user.role == "manager" and team_id is not None and user.team_id is not None:
        if int(team_id) != int(user.team_id):
            raise HTTPException(status_code=403, detail="فقط اعضای تیم خودتان در دسترس شماست")


def ensure_employee_in_scope(user: User, employee: "Employee") -> None:
    """Managers may only touch members of their own team."""
    if user.role == "manager" and user.team_id is not None:
        if employee.team_id is None or int(employee.team_id) != int(user.team_id):
            raise HTTPException(status_code=403, detail="این کارمند در تیم شما نیست")


def ensure_own_employee(user: User, employee_id) -> None:
    """Employees may only act on their own linked employee record."""
    if user.role == "employee":
        if user.employee_id is None or int(employee_id) != int(user.employee_id):
            raise HTTPException(status_code=403, detail="فقط اطلاعات خودتان در دسترس شماست")


# ─── Granular permissions (tick-based, admin-assigned) ────────
# managed_team_ids / extra_employee_ids let one person hold several
# hats: e.g. an HR manager who is also an employee scores her team
# AND herself; a person may lead two teams.

import json as _json


def managed_team_ids(user: User) -> list[int]:
    """Extra teams the user may manage (beyond user.team_id)."""
    if not user.managed_team_ids:
        return []
    try:
        return [int(t) for t in _json.loads(user.managed_team_ids)]
    except (ValueError, TypeError):
        return []


def extra_employee_ids(user: User) -> list[int]:
    """Extra employees the user may score or self-view (beyond employee_id)."""
    if not user.extra_employee_ids:
        return []
    try:
        return [int(e) for e in _json.loads(user.extra_employee_ids)]
    except (ValueError, TypeError):
        return []


def can_manage_team(user: User, team_id) -> bool:
    """True if the user may score/manage members of this team."""
    if is_hr_plus(user):
        return True
    if team_id is None:
        return False
    tid = int(team_id)
    if user.role == "manager" and user.team_id is not None and int(user.team_id) == tid:
        return True
    return tid in managed_team_ids(user)


def can_touch_employee(user: User, employee) -> bool:
    """True if the user may score this employee (own team, managed team, or extra grant)."""
    if is_hr_plus(user):
        return True
    if employee is None:
        return False
    if user.role == "manager" and user.team_id is not None and employee.team_id is not None \
            and int(user.team_id) == int(employee.team_id):
        return True
    if employee.id in extra_employee_ids(user):
        return True
    return can_manage_team(user, employee.team_id)


def visible_team_ids(user: User) -> Optional[list[int]]:
    """Teams whose data the user may see. None = unrestricted (admin/hr)."""
    if is_hr_plus(user):
        return None
    ids: set[int] = set()
    if user.team_id is not None:
        ids.add(int(user.team_id))
    ids.update(managed_team_ids(user))
    return list(ids) if ids else []
