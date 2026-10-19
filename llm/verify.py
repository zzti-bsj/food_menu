import json
from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "ingredient_verify.jinja2"
SYSTEM = "你是一名中医食疗审校专家,只输出 JSON。"


class IngredientVerifier:
    """对已通过结构与词表校验的食材 JSON 做事实核验。"""

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient.for_role("verify")

    def verify(self, record: dict) -> tuple[str, list[str]]:
        """返回 (verdict: pass/fail/存疑, 问题列表);模型输出不合约定视为 fail。"""
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(
            ingredient_json=json.dumps(record, ensure_ascii=False, indent=2)
        )
        try:
            result = self.client.chat_json(SYSTEM, user)
        except ValueError:
            return "fail", ["验证 LLM 输出不是合法 JSON"]

        problems = result.get("problems")
        if not isinstance(problems, list):
            problems = [str(problems)] if problems else []
        verdict = result.get("verdict")
        if verdict not in ("pass", "fail", "存疑"):
            return "fail", ["验证 LLM verdict 不合法"]
        return verdict, [str(p) for p in problems]
