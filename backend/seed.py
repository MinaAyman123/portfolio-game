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
            name = "AI Medical Assistant",
            description = "An AI-powered medical assistant that analyzes symptoms, detects emergencies, predicts diseases, and recommends the right doctor specialty using RAG, AI Agent, and Tool Calling with Ollama Qwen2.5.",
            tech = ["Python", "FastAPI", "Streamlit", "ChromaDB", "Sentence Transformers", "Ollama", "RAG", "AI Agent", "PyPDF"],
            github = "https://github.com/MinaAyman123/Assiut-National-University-Project/tree/6adbf4b3e6c2764f25a5c1027868b7a18adbee97/AL%20Agent",
            metrics = {
                "diseases": 52,
                "specialties": 20,
                "emergency_cases": 15,
                "analysis_cases": 25,
                "tools": 3
            }
        ),
        Project(
            name = "AI Programming Assistant",
            description = "AI-powered platform for learning programming languages with leveled lessons, auto-generated quizzes, and smart code explanation.",
            tech = ["C#", "ASP.NET Core MVC", "Entity Framework Core", "SQL Server", "Ollama", "Tailwind CSS", "JavaScript"],
            github = "https://github.com/MinaAyman123/Assiut-National-University-Project/tree/6adbf4b3e6c2764f25a5c1027868b7a18adbee97/AI%20Programming%20Assistant",
            metrics = {
                "levels": 15,
                "quiz_questions": 10,
                "pass_score": 0.7,
                "ai_model": "llama3.2:3b"
            }
        ),

        Project(
    name = "Employee & Hotel Management System",
    description = "Desktop application for managing employees and hotel operations with role-based access control, booking/reservation system, and a responsive fullscreen UI.",
    tech = ["C#", "WinForms", "Entity Framework", "SQL Server", "LINQ"],
    github = "https://github.com/MinaAyman123/Assiut-National-University-Project/tree/6adbf4b3e6c2764f25a5c1027868b7a18adbee97/Employee%20%26%20Hotel%20Management%20System",
    metrics = {
        "Type": "Desktop Application",
        "Architecture": "Clean Architecture (Code First)",
        "Roles": "Admin, Manager, Worker",
        "Features": "Booking, Validation, Draggable UI, Show/Hide Password, Tooltips, Error Handling"
    }
    ),
        Project(
            name = "Superstore Sales Analysis Dashboard",
            description = "Interactive business intelligence dashboard for analyzing superstore sales data with advanced filtering, KPIs, and interactive visualizations.",
            tech = ["Python", "Streamlit", "Pandas", "NumPy", "Plotly"],
            github = "https://github.com/MinaAyman123/Stremlit.git",
            metrics = {
                "Type": "Interactive Dashboard",
                "KPIs": "Sales, Profit, Orders, Profit Margin, AOV",
                "Filters": "Date, Category, Segment, Location",
                "Features": "Interactive Charts, Dataset Export After Filtering"
            }
        ),

        Project(
            name = "Linear Regression from Scratch",
            description = "Implementation of Linear Regression from scratch using the Normal Equation with matrix operations and custom train/test split.",
            tech = ["Python", "NumPy", "Pandas"],
            github = "https://github.com/MinaAyman123/Assiut-National-University-Project/tree/main/Numpy%20Asssuiment",
            metrics = {
                "Type": "Machine Learning from Scratch",
                "Method": "Normal Equation (Matrix Operations)",
                "Evaluation": "Mean Squared Error (MSE)",
                "Constraint": "No External ML Libraries"
            }
        ),

        Project(
            name = "Job Scraping Automation Tool",
            description = "Web scraping automation tool for extracting job listings from Wuzzuf with pagination handling and CSV export.",
            tech = ["Python", "Requests", "BeautifulSoup", "Pandas"],
            github = "https://github.com/MinaAyman123/Zero-Grad-ML/tree/main/Python/Week%202",
            metrics = {
                "Type": "Web Scraping Automation",
                "Data Extracted": "Job Title, Company, Location, Description",
                "Features": "Pagination Handling, CSV Export",
                "Target": "Wuzzuf"
            }
        ),
        Project(
            name = "Tourism Village Booking System",
            description = "Full-featured web booking platform with search, booking, reviews, and an admin panel for managing villages, rooms, and reservations.",
            tech = ["FastAPI", "SQLite", "HTML", "CSS", "JavaScript"],
            github = "https://github.com/MinaAyman123/Assiut-National-University-Project/tree/main/Hotel",
            metrics = {
                "Type": "Web Application",
                "Modules": "Search, Booking, Reviews, Admin Panel",
                "Admin Features": "Manage Villages, Rooms, Reservations",
                "Focus": "Fast Performance, Secure Data Handling"
            }
        ),

        Project(
            name = "Guess Word Game",
            description = "Interactive word guessing game with multiple difficulty levels, categories, and a real-time feedback system.",
            tech = ["Python"],
            github = "https://github.com/MinaAyman123/Zero-Grad-ML/tree/main/Python/Week%203/Guess%20Word",
            metrics = {
                "Type": "Console Game",
                "Features": "Difficulty Levels, Categories, Real-time Feedback",
                "Code Style": "Clean Code with Functions & Control Structures"
            }
        ),

        
        
    ])
print("✅ Added 9 projects")

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