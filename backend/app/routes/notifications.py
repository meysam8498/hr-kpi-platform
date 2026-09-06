"""
Notification routes — in-app alerts and deadline reminders.
"""
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Notification, ReportingPeriod, Team, Employee, KPIEntry
from ..schemas import NotificationCreate, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationOut])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Notification).order_by(Notification.created_at.desc())
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.limit(100).all()


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(func.count(Notification.id)).filter(Notification.is_read == False).scalar()
    return {"count": count}


@router.post("/", response_model=NotificationOut, status_code=201)
def create_notification(request: NotificationCreate, db: Session = Depends(get_db)):
    notif = Notification(
        title=request.title, message=request.message,
        type=request.type, link=request.link,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


@router.put("/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="اعلان یافت نشد")
    notif.is_read = True
    db.commit()
    return {"message": "خوانده شد"}


@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "همه اعلان‌ها خوانده شد"}


@router.delete("/{notif_id}")
def delete_notification(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="اعلان یافت نشد")
    db.delete(notif)
    db.commit()
    return {"message": "حذف شد"}


@router.post("/remind-managers/{period_id}")
def remind_managers(period_id: int, db: Session = Depends(get_db)):
    """Create a reminder listing teams whose members have no scores in the period.

    Single-summary design (keeps the panel simple): one notification naming
    every unscored team, instead of one notification per team.
    """
    period = db.query(ReportingPeriod).filter(ReportingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="دوره یافت نشد")

    # Teams that are fully unscored in this period
    teams = db.query(Team).all()
    missing: list[str] = []
    for team in teams:
        members = db.query(Employee).filter(
            Employee.team_id == team.id,
            Employee.is_archived == False,
        ).all()
        if not members:
            continue
        member_ids = [m.id for m in members]
        scored = db.query(KPIEntry.id).filter(
            KPIEntry.period_id == period_id,
            KPIEntry.employee_id.in_(member_ids),
        ).first()
        if not scored:
            missing.append(team.name)

    if not missing:
        return {"created": 0, "missing": [], "message": "همه تیم‌ها امتیازدهی شده‌اند — نیازی به یادآوری نیست"}

    names = "، ".join(missing)
    notif = Notification(
        title=f"📝 یادآوری امتیازدهی: دوره «{period.name}»",
        message=f"تیم‌های زیر هنوز در این دوره امتیازی ثبت نکرده‌اند: {names}",
        type="deadline",
        link="/scoring",
    )
    db.add(notif)
    db.commit()
    return {"created": 1, "missing": missing, "message": "یادآوری برای مدیران ثبت شد"}


@router.post("/check-deadlines")
def check_deadlines(db: Session = Depends(get_db)):
    """Auto-generate reminders for periods ending soon."""
    today = date.today()
    periods = db.query(ReportingPeriod).filter(
        ReportingPeriod.is_active == True,
        ReportingPeriod.end_date >= today,
    ).all()

    created = 0
    for period in periods:
        days_left = (period.end_date - today).days
        if days_left <= 7:
            existing = db.query(Notification).filter(
                Notification.title.contains(period.name),
                Notification.type == "deadline",
            ).first()
            if not existing:
                notif = Notification(
                    title=f"⏰ یادآوری: دوره «{period.name}» در {days_left} روز تمام می‌شود",
                    message=f"دوره «{period.name}» در تاریخ {period.end_date} پایان می‌یابد. لطفاً امتیازدهی را تکمیل کنید.",
                    type="deadline",
                    link="/admin/periods",
                )
                db.add(notif)
                created += 1

    db.commit()
    return {"created": created, "message": f"{created} یادآوری جدید ایجاد شد"}
