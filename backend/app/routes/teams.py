"""
Team management routes.

Read: any authenticated user (needed for filters).
Create / update / delete: admin or HR only.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Team, Employee
from ..schemas import TeamCreate, TeamUpdate, TeamOut
from ..auth import get_current_user, require_admin_or_hr
from ..models import User

router = APIRouter(prefix="/api/teams", tags=["Teams"])


@router.get("/", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    teams = db.query(Team).all()
    result = []
    for t in teams:
        count = db.query(Employee).filter(Employee.team_id == t.id).count()
        result.append(TeamOut(
            id=t.id, name=t.name, description=t.description,
            created_at=t.created_at, member_count=count,
        ))
    return result


@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    count = db.query(Employee).filter(Employee.team_id == team.id).count()
    return TeamOut(
        id=team.id, name=team.name, description=team.description,
        created_at=team.created_at, member_count=count,
    )


@router.post("/", response_model=TeamOut, status_code=201)
def create_team(request: TeamCreate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    existing = db.query(Team).filter(Team.name == request.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="نام تیم تکراری است")
    team = Team(name=request.name, description=request.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    return TeamOut(id=team.id, name=team.name, description=team.description, created_at=team.created_at, member_count=0)


@router.put("/{team_id}", response_model=TeamOut)
def update_team(team_id: int, request: TeamUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
    db.commit()
    db.refresh(team)
    count = db.query(Employee).filter(Employee.team_id == team.id).count()
    return TeamOut(id=team.id, name=team.name, description=team.description, created_at=team.created_at, member_count=count)


@router.delete("/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_hr)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="تیم یافت نشد")
    member_count = db.query(Employee).filter(Employee.team_id == team_id).count()
    if member_count > 0:
        raise HTTPException(status_code=400, detail=f"تیم دارای {member_count} عضو است. ابتدا اعضا را حذف کنید.")
    db.delete(team)
    db.commit()
    return {"message": f"تیم '{team.name}' حذف شد"}
