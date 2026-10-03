from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

# مسار قاعدة البيانات
DB_PATH = Path(__file__).parent / "data" / "portfolio.db"
DB_PATH.parent.mkdir(exist_ok=True)

# إنشاء الـengine
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)

# Session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Base للـmodels
Base = declarative_base()


def get_db():
    """Dependency للـFastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()