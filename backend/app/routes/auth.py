"""
Auth routes — login, current user, and user management (admin only).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..auth import (
    create_token, get_current_user, hash_password, verify_password,
    require_admin, require_admin_or_hr,
    check_login_rate_limit, record_failed_login, clear_failed_logins,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ─── Schemas ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=4, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    role: str = "employee"  # admin/hr/manager/employee
    team_id: Optional[int] = None
    employee_id: Optional[int] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    team_id: Optional[int] = None
    employee_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    team_id: Optional[int]
    employee_id: Optional[int]
    is_active: bool
    must_change_password: bool = False
    model_config = {"from_attributes": True}

class TokenOut(BaseModel):
    token: str
    user: UserOut

VALID_ROLES = {"admin", "hr", "manager", "employee"}


# ─── Login / me ──────────────────────────────────────────────

@router.post("/login", response_model=TokenOut)
def login(request: LoginRequest, http: Request, db: Session = Depends(get_db)):
    client_ip = http.client.host if http.client else "unknown"
    check_login_rate_limit(client_ip)
    user = db.query(User).filter(User.username == request.username.strip()).first()
    if not user or not verify_password(request.password, user.password_hash):
        record_failed_login(client_ip)
        raise HTTPException(status_code=401, detail="نام کاربری یا رمز عبور اشتباه است")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="حساب شما غیرفعال شده است")
    clear_failed_logins(client_ip)
    return {"token": create_token(user), "user": user}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=4, max_length=128)


@router.post("/change-password")
def change_password(request: ChangePasswordRequest, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Any logged-in user changes their own password (old password required)."""
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="رمز عبور فعلی اشتباه است")
    if request.current_password == request.new_password:
        raise HTTPException(status_code=422, detail="رمز جدید باید با رمز فعلی متفاوت باشد")
    user.password_hash = hash_password(request.new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "رمز عبور با موفقیت تغییر کرد"}


# ─── User management (admin) ─────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    return db.query(User).order_by(User.role, User.username).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(request: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if request.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail="نقش نامعتبر است")
    if db.query(User).filter(User.username == request.username.strip()).first():
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است")
    user = User(
        username=request.username.strip(),
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        role=request.role,
        team_id=request.team_id,
        employee_id=request.employee_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, request: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    data = request.model_dump(exclude_unset=True)
    if "role" in data:
        if data["role"] not in VALID_ROLES:
            raise HTTPException(status_code=422, detail="نقش نامعتبر است")
        if user.username == "admin" and data["role"] != "admin":
            raise HTTPException(status_code=400, detail="نقش حساب اصلی مدیر سیستم قابل تغییر نیست")
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="حساب اصلی مدیر سیستم قابل حذف نیست")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="نمی‌توانید حساب خودتان را حذف کنید")
    db.delete(user)
    db.commit()
    return {"message": "کاربر حذف شد"}
