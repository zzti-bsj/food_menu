import os
from collections.abc import Mapping

from shike.config import PROJECT_ROOT  # noqa: F401 —— 导入即完成 .env 加载

_FIELDS = ("API_KEY", "BASE_URL", "MODEL")
_SKIP_PREFIXES = ("SHIKE_LLM_ROLE_",)


def load_profiles(environ: Mapping[str, str] = os.environ) -> dict[str, dict[str, str]]:
    """从 SHIKE_LLM_<档案名>_{API_KEY,BASE_URL,MODEL} 环境变量装配档案。"""
    profiles: dict[str, dict[str, str]] = {}
    for key, value in environ.items():
        if not key.startswith("SHIKE_LLM_") or key == "SHIKE_LLM_PROVIDER":
            continue
        if any(key.startswith(p) for p in _SKIP_PREFIXES):
            continue
        for field in _FIELDS:
            suffix = f"_{field}"
            if key.endswith(suffix):
                name = key[len("SHIKE_LLM_") : -len(suffix)].lower()
                if name:
                    profiles.setdefault(name, {})[field.lower()] = value
                break
    return profiles


PROFILES = load_profiles()


def profile_for(role: str) -> str:
    """解析角色对应的档案名;角色未配置时回落到默认档案。"""
    default = os.getenv("SHIKE_LLM_PROVIDER", "")
    name = os.getenv(f"SHIKE_LLM_ROLE_{role.upper()}", "") or default
    if name not in PROFILES:
        raise ValueError(
            f"未找到 LLM 档案: {name or '(空)'},角色 {role};请检查 .env 中 SHIKE_LLM_*"
        )
    return name
