from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient
from shike.vocab import Vocab, load_vocab

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "dish_create.jinja2"
SYSTEM = "你是「健康厨师」——深谙营养与低卡烹饪的顶级厨师,只输出 JSON。"


class DishChef:
    """用给定候选食材专注设计一道健康低卡的菜,返回结构化菜谱 dict,不校验内容。"""

    def __init__(self, client: LLMClient | None = None, vocab: Vocab | None = None):
        self.client = client or LLMClient.for_role("chef")
        self.vocab = vocab or load_vocab()

    def create(
        self,
        ingredients: list[str],
        feedback: list[str] | None = None,
        pantry: list[dict] | None = None,
    ) -> dict:
        """渲染提示词并调用模型;pantry 为库内食材档案,feedback 为上轮被驳原因。"""
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(
            ingredients=ingredients,
            feedback=feedback,
            pantry=pantry or [],
            solar_terms=self.vocab.solar_terms,
        )
        return self.client.chat_json(SYSTEM, user)
