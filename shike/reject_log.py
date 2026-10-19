import json
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parents[1] / "logs" / "reject_log.jsonl"


def log_reject(name: str, stage: str, detail: list[str]) -> None:
    """追加一条判否日志(JSONL,一行一条)。"""
    entry = {
        "name": name,
        "stage": stage,
        "detail": detail,
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
