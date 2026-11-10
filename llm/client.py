import json
import re

from openai import OpenAI

from llm.config import PROFILES, profile_for

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


def _strip_fences(text: str) -> str:
    """剥掉模型输出可能包裹的 markdown 代码围栏。"""
    return _FENCE.sub("", text).strip()


class LLMClient:
    """OpenAI 兼容 Chat 客户端;按档案名构建,可对接 GLM/DeepSeek/OpenAI 等。"""
    def __init__(self, profile: str | None = None, **overrides):
        name = profile or profile_for("default")
        if name not in PROFILES:
            raise ValueError(f"未找到 LLM 档案: {name},请检查 .env 中 SHIKE_LLM_*")
        cfg = {**PROFILES[name], **overrides}
        missing = [k for k in ("api_key", "base_url", "model") if not cfg.get(k)]
        if missing:
            raise ValueError(f"档案 {name} 缺少配置: {','.join(missing)}")
        self.profile = name
        self.model = cfg["model"]
        self._client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])

    @classmethod
    def for_role(cls, role: str) -> "LLMClient":
        """按流水线角色(recommend/fill/verify/chef/dish_verify/cuisine_chef/cuisine_verify)取档案构建客户端。"""
        return cls(profile=profile_for(role))

    def chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        """单轮对话,返回模型输出的纯文本。"""
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
        )
        return resp.choices[0].message.content.strip()

    def chat_json(self, system: str, user: str, temperature: float = 0.2) -> dict:
        """单轮对话并解析 JSON 输出;非法 JSON 抛 ValueError。"""
        raw = self.chat(system, user, temperature)
        try:
            return json.loads(_strip_fences(raw))
        except json.JSONDecodeError as exc:
            raise ValueError(f"模型输出不是合法 JSON: {raw[:200]}") from exc
