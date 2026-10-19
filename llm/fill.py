from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient
from shike.vocab import Vocab, load_vocab

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "ingredient_fill.jinja2"
SYSTEM = "你是一名严谨的中医食疗顾问,只输出 JSON。"


class IngredientFiller:
    """为一枚食材补全实体字段,返回解析后的 dict,不校验内容。"""

    def __init__(self, client: LLMClient | None = None, vocab: Vocab | None = None):
        self.client = client or LLMClient.for_role("fill")
        self.vocab = vocab or load_vocab()

    def fill(self, name: str, feedback: list[str] | None = None) -> dict:
        """渲染含全部封闭词表的提示词并调用模型,返回 JSON dict;feedback 为上轮被驳原因。"""
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(
            name=name,
            feedback=feedback,
            categories=self.vocab.categories,
            natures=self.vocab.natures,
            flavors=self.vocab.flavors,
            meridians=self.vocab.meridians,
            solar_terms=self.vocab.solar_terms,
            benefits=list(self.vocab.benefits),
        )
        return self.client.chat_json(SYSTEM, user)
