import json
from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "cuisine_verify.jinja2"
SYSTEM = "你是深谙各菜系正宗技法的菜谱审校专家,兼通中医食疗,只输出 JSON。"
_MODE_LABELS = {
    "cuisine": "按菜系生成",
    "name": "按菜名生成",
    "ingredient": "按候选食材生成",
}


class CuisineVerifier:
    """对已通过结构与词表校验的美食大厨菜谱做正宗/安全/造假/可执行核验。"""

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient.for_role("cuisine_verify")

    def verify(self, record: dict, mode: str, context) -> tuple[str, list[str]]:
        """返回 (verdict: pass/fail/存疑, 问题列表);模型输出不合约定视为 fail。"""
        if isinstance(context, list):
            context = "候选食材:" + "、".join(str(c) for c in context)
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(
            mode_label=_MODE_LABELS.get(mode, mode),
            context=context,
            dish_json=json.dumps(record, ensure_ascii=False, indent=2),
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
