from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from routes import projects, skills, contact

# إنشاء الجداول
Base.metadata.create_all(bind=engine)

# ✅ Auto-seed لو الداتا فاضية
def auto_seed():
    from models import Project, Skill
    db = SessionLocal()
    try:
        if db.query(Project).count() == 0:
            db.add_all([
                Project(
                    name="Flower Classification",
                    description="CNN model classifying 102 flower species with 94% accuracy",
                    tech=["Python", "TensorFlow", "OpenCV"],
                    github="https://github.com/MinaAyman123/flower-classification",
                    metrics={"accuracy": 0.94, "classes": 102},
                ),
                Project(
                    name="EuroSAT Land Cover",
                    description="Satellite image classification using ResNet-50",
                    tech=["PyTorch", "NumPy", "Matplotlib"],
                    github="https://github.com/MinaAyman123/eurosat",
                    metrics={"accuracy": 0.97, "classes": 10},
                ),
                Project(
                    name="Smart Waste Detection",
                    description="Real-time waste classification on edge devices",
                    tech=["YOLOv8", "OpenCV", "FastAPI"],
                    github="https://github.com/MinaAyman123/smart-waste",
                    metrics={"mAP": 0.88, "fps": 30},
                ),
            ])
            print("✅ Auto-seeded 3 projects")

        if db.query(Skill).count() == 0:
            skills_data = [
                ("AI/ML",   "Python",      95),
                ("AI/ML",   "PyTorch",     88),
                ("AI/ML",   "TensorFlow",  85),
                ("CV",      "OpenCV",      92),
                ("Backend", "FastAPI",     90),
                ("Backend", "SQLite",      80),
                ("Tools",   "Git",         90),
                ("Tools",   "Docker",      75),
            ]
            db.add_all([Skill(category=c, name=n, level=l) for c, n, l in skills_data])
            print("✅ Auto-seeded 8 skills")

        db.commit()
    finally:
        db.close()

auto_seed()
# إنشاء التطبيق
app = FastAPI(
    title="Portfolio API",
    description="Backend for Mina Ayman's Portfolio",
    version="1.0",
)

# CORS - السماح للـFrontend إنه يطلب من الـAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://portfolio-game-frontend.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ربط الـroutes
app.include_router(projects.router, prefix="/api")
app.include_router(skills.router,   prefix="/api")
app.include_router(contact.router,  prefix="/api")


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "portfolio-api",
        "docs": "/docs",
    }