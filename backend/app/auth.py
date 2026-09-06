"""
Authentication — JWT-based sessions with role-based access control.

Roles (least → most privilege):
- employee:  own reports + own self-evaluation
- manager:   own-team scoring + own-team reports
- hr:        HR manager — everything except user management
- admin:     full control incl. user management
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

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
    if user.role not in ("admin", "hr", "manager"):
        raise HTTPException(status_code=403, detail="دسترسی به این بخش برای شما مجاز نیست")
    return user
