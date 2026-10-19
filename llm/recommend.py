from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient
from shike import repository
from shike.vocab import load_vocab

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "solar_term_ingredient_recommend.jinja2"
EXHAUSTED = "已穷尽该节气的食材"
SYSTEM = "你是一名中医食疗顾问,熟悉二十四节气的当令食材。"


class SolarTermIngredientRecommender:
    """按节气推荐未收录的当令食材;只产出名称列表,内容校验与补全由后续流水线负责。"""

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient.for_role("recommend")
        self.vocab = load_vocab()

    def recommend(self, term: str) -> list[str]:
        """返回推荐食材名列表;该节气已无可推荐时返回空列表;节气非法则抛错。"""
        if term not in self.vocab.solar_term_index:
            raise ValueError(f"非法节气: {term},合法值见 data/vocab/词表-节气.md")

        existing = repository.list_names_by_solar_term(term)
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(term=term, existing=existing)

        output = self.client.chat(SYSTEM, user)
        if EXHAUSTED in output:
            return []
        return [line.strip() for line in output.splitlines() if line.strip()]
