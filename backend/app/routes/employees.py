"""
Employee management routes — full CRUD + archive + transfer + bulk import.
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Employee, Team
from ..schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut, BulkImportItem, BulkImportResult
from .audit import log_audit

router = APIRouter(prefix="/api/employees", tags=["Employees"])


def _emp_out(emp: Employee, db: Session) -> EmployeeOut:
    team = db.query(Team).filter(Team.id == emp.team_id).first()
    return EmployeeOut(
        id=emp.id, employee_code=emp.employee_code,
        first_name=emp.first_name, last_name=emp.last_name,
        position=emp.position, team_id=emp.team_id,
        hire_date=emp.hire_date, phone=emp.phone,
        is_archived=emp.is_archived,
        created_at=emp.created_at, team_name=team.name if team else None,
    )


@router.get("/", response_model=list[EmployeeOut])
def list_employees(
    team_id: int = None,
    archived: bool = False,
    db: Session = Depends(get_db),
):
    """List employees. By default only active (non-archived)."""
    query = db.query(Employee)
    if team_id:
        query = query.filter(Employee.team_id == team_id)
    if not archived:
        query = query.filter(Employee.is_archived == False)
    else:
        # If explicitly requesting archived, show only archived
        query = query.filter(Employee.is_archived == True)
    employees = query.order_by(Employee.employee_code).all()
    return [_emp_out(e, db) for e in employees]


@router.get("/all", response_model=list[EmployeeOut])
def list_all_employees(
    team_id: int = None,
    db: Session = Depends(get_db),
):
    """List ALL employees including archived."""
    query = db.query(Employee)
    if team_id:
        query = query.filter(Employee.team_id == team_id)
    employees = query.order_by(Employee.employee_code).all()
    return [_emp_out(e, db) for e in employees]


@router.get("/{emp_id}", response_model=EmployeeOut)
def get_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    return _emp_out(emp, db)


@router.post("/", response_model=EmployeeOut, status_code=201)
def create_employee(request: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.employee_code == request.employee_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="کد پرسنلی تکراری است")
    team = db.query(Team).filter(Team.id == request.team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="تیم یافت نشد")
    emp = Employee(
        employee_code=request.employee_code,
        first_name=request.first_name,
        last_name=request.last_name,
        position=request.position,
        team_id=request.team_id,
        hire_date=request.hire_date,
        phone=request.phone,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    log_audit(db, "create", "employee", emp.id, f"ایجاد کارمند «{emp.full_name}» ({emp.employee_code})")
    db.commit()
    return _emp_out(emp, db)


@router.put("/{emp_id}", response_model=EmployeeOut)
def update_employee(emp_id: int, request: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    log_audit(db, "update", "employee", emp.id, f"ویرایش اطلاعات کارمند «{emp.full_name}»")
    db.commit()
    return _emp_out(emp, db)


@router.put("/{emp_id}/transfer", response_model=EmployeeOut)
def transfer_employee(emp_id: int, new_team_id: int, db: Session = Depends(get_db)):
    """Transfer an employee to a different team."""
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    team = db.query(Team).filter(Team.id == new_team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="تیم مقصد یافت نشد")
    old_team = db.query(Team).filter(Team.id == emp.team_id).first()
    emp.team_id = new_team_id
    db.commit()
    db.refresh(emp)
    log_audit(db, "transfer", "employee", emp.id,
              f"انتقال «{emp.full_name}» از تیم «{old_team.name if old_team else '—'}» به تیم «{team.name}»")
    db.commit()
    return _emp_out(emp, db)


@router.put("/{emp_id}/archive", response_model=EmployeeOut)
def archive_employee(emp_id: int, db: Session = Depends(get_db)):
    """Archive an employee (hide from active views)."""
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    emp.is_archived = True
    db.commit()
    db.refresh(emp)
    log_audit(db, "archive", "employee", emp.id, f"بایگانی کارمند «{emp.full_name}»")
    db.commit()
    return _emp_out(emp, db)


@router.put("/{emp_id}/unarchive", response_model=EmployeeOut)
def unarchive_employee(emp_id: int, db: Session = Depends(get_db)):
    """Restore an archived employee."""
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    emp.is_archived = False
    db.commit()
    db.refresh(emp)
    log_audit(db, "archive", "employee", emp.id, f"بازگردانی کارمند «{emp.full_name}» از بایگانی")
    db.commit()
    return _emp_out(emp, db)


@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="کارمند یافت نشد")
    name = emp.full_name
    db.delete(emp)
    db.commit()
    log_audit(db, "delete", "employee", emp_id, f"حذف کارمند «{name}»")
    db.commit()
    return {"message": f"کارمند '{name}' حذف شد"}


# ──────────────────────────────────────────────
# Bulk Import (JSON or Excel)
# ──────────────────────────────────────────────

@router.post("/import-json", response_model=BulkImportResult)
def bulk_import_json(items: list[BulkImportItem], db: Session = Depends(get_db)):
    """Bulk import employees from a JSON list."""
    created = 0
    skipped = []
    errors = []
    for i, item in enumerate(items):
        team = db.query(Team).filter(Team.id == item.team_id).first()
        if not team:
            errors.append({"row": i + 1, "reason": f"تیم با شناسه {item.team_id} یافت نشد"})
            continue
        existing = db.query(Employee).filter(Employee.employee_code == item.employee_code).first()
        if existing:
            skipped.append({"row": i + 1, "employee_code": item.employee_code, "reason": "کد پرسنلی تکراری"})
            continue
        emp = Employee(
            employee_code=item.employee_code, first_name=item.first_name,
            last_name=item.last_name, position=item.position,
            team_id=item.team_id, hire_date=item.hire_date, phone=item.phone,
        )
        db.add(emp)
        created += 1
    db.commit()
    log_audit(db, "import", "employee", None, f"ورود گروهی {created} کارمند جدید")
    db.commit()
    return BulkImportResult(created=created, skipped=skipped, errors=errors)


@router.post("/import-excel", response_model=BulkImportResult)
async def bulk_import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Bulk import employees from an Excel file.
    Expected columns (row 1 header): کد پرسنلی | نام | نام خانوادگی | سمت | تیم | تاریخ استخدام | تلفن(اختیاری)
    Team matched by name; hire date as yyyy-mm-dd.
    """
    from openpyxl import load_workbook
    from io import BytesIO

    content = await file.read()
    try:
        wb = load_workbook(BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="فایل اکسل معتبر نیست")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="فایل باید حداقل یک ردیف داده داشته باشد")

    # Column order: code, first, last, position, team, hire_date, phone
    created = 0
    skipped = []
    errors = []
    for i, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue
        try:
            code = str(row[0]).strip() if row[0] is not None else ""
            first = str(row[1]).strip() if row[1] is not None else ""
            last = str(row[2]).strip() if row[2] is not None else ""
            position = str(row[3]).strip() if row[3] is not None else ""
            team_name = str(row[4]).strip() if row[4] is not None else ""
            hire_str = str(row[5]).strip() if row[5] is not None else ""
            phone = str(row[6]).strip() if len(row) > 6 and row[6] is not None else None

            if not (code and first and last and team_name):
                errors.append({"row": i, "reason": "فیلدهای اجباری خالی هستند"})
                continue
            team = db.query(Team).filter(Team.name == team_name).first()
            if not team:
                errors.append({"row": i, "reason": f"تیم «{team_name}» یافت نشد"})
                continue
            try:
                hire_date = date.fromisoformat(hire_str[:10])
            except ValueError:
                errors.append({"row": i, "reason": f"تاریخ استخدام نامعتبر: {hire_str}"})
                continue
            if db.query(Employee).filter(Employee.employee_code == code).first():
                skipped.append({"row": i, "employee_code": code, "reason": "کد پرسنلی تکراری"})
                continue
            db.add(Employee(
                employee_code=code, first_name=first, last_name=last,
                position=position or "—", team_id=team.id,
                hire_date=hire_date, phone=phone,
            ))
            created += 1
        except Exception as e:
            errors.append({"row": i, "reason": str(e)[:100]})

    db.commit()
    log_audit(db, "import", "employee", None, f"ورود گروهی {created} کارمند از فایل اکسل")
    db.commit()
    return BulkImportResult(created=created, skipped=skipped, errors=errors)
