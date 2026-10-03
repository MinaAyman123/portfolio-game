from sqlalchemy import Column, Integer, String, Text, JSON
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(120), nullable=False)
    description = Column(Text)
    tech        = Column(JSON)          # list[str]
    github      = Column(String(300))
    demo        = Column(String(300))
    image       = Column(String(300))
    metrics     = Column(JSON)          # dict


class Skill(Base):
    __tablename__ = "skills"

    id       = Column(Integer, primary_key=True)
    category = Column(String(80))
    name     = Column(String(80))
    level    = Column(Integer)          # 0-100