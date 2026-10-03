from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Skill
from schemas import SkillOut

router = APIRouter(tags=["skills"])


@router.get("/skills", response_model=List[SkillOut])
def list_skills(db: Session = Depends(get_db)):
    return db.query(Skill).all()