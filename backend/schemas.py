from pydantic import BaseModel
from typing import List, Optional, Dict


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    tech: Optional[List[str]] = []
    github: Optional[str] = None
    demo: Optional[str] = None
    image: Optional[str] = None
    metrics: Optional[Dict] = None

    class Config:
        from_attributes = True


class SkillOut(BaseModel):
    id: int
    category: str
    name: str
    level: int

    class Config:
        from_attributes = True


class ContactIn(BaseModel):
    name: str
    email: str
    message: str