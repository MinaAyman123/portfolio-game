from fastapi import APIRouter
from schemas import ContactIn
import json
from pathlib import Path
from datetime import datetime

router = APIRouter(tags=["contact"])
LOG_FILE = Path(__file__).parent.parent / "data" / "messages.jsonl"


@router.post("/contact")
def contact(payload: ContactIn):
    LOG_FILE.parent.mkdir(exist_ok=True)
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        **payload.model_dump(),
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"status": "received", "message": "شكرًا لتواصلك!"}