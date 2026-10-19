import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ENV = os.getenv("SHIKE_ENV", "dev")
if ENV not in ("dev", "prod"):
    raise ValueError(f"SHIKE_ENV 只能是 dev 或 prod,当前为: {ENV}")

load_dotenv(PROJECT_ROOT / f".env.{ENV}", override=True)

DB_CONFIG = {
    "host": os.getenv("SHIKE_DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("SHIKE_DB_PORT", "3306")),
    "user": os.getenv("SHIKE_DB_USER", "root"),
    "password": os.getenv("SHIKE_DB_PASSWORD", ""),
    "database": os.getenv("SHIKE_DB_NAME", "shike"),
    "charset": "utf8mb4",
}


def db_config(with_db: bool = True) -> dict:
    """返回 MySQL 连接参数;建库前场景传 with_db=False 以省略库名。"""
    cfg = dict(DB_CONFIG)
    if not with_db:
        cfg.pop("database")
    return cfg
