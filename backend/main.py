from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routes import projects, skills, contact

# إنشاء الجداول في قاعدة البيانات
Base.metadata.create_all(bind=engine)

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