from database import SessionLocal, Base, engine
from models import Project, Skill

# إنشاء الجداول
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ===== إضافة المشاريع =====
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
    print("✅ Added 3 projects")

# ===== إضافة المهارات =====
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
    print("✅ Added 8 skills")

db.commit()
db.close()
print("🎉 Seed complete!")