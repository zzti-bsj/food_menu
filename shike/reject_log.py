import json
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parents[1] / "logs" / "reject_log.jsonl"


def log_reject(name: str, stage: str, detail: list[str], entity: str = "食材") -> None:
    """追加一条判否日志(JSONL,一行一条);entity 区分食材/菜品等来源。"""
    entry = {
        "name": name,
        "stage": stage,
        "detail": detail,
        "entity": entity,
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
