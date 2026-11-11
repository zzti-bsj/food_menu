from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from llm.client import LLMClient
from shike.vocab import Vocab, load_vocab

PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"
MODE_PROMPTS = {
    "cuisine": "cuisine_by_cuisine.jinja2",
    "name": "cuisine_by_name.jinja2",
    "ingredient": "cuisine_by_ingredient.jinja2",
}
SYSTEM = "你是「美食大厨」——主流菜系与地方风味的顶级厨师兼烹饪教师,只输出 JSON。"
_ENV = Environment(loader=FileSystemLoader(PROMPT_DIR))


class CuisineChef:
    """按三种模式(给菜系/给菜名/给食材)生成可复刻的菜谱 JSON,不校验内容。"""

    def __init__(self, client: LLMClient | None = None, vocab: Vocab | None = None):
        self.client = client or LLMClient.for_role("cuisine_chef")
        self.vocab = vocab or load_vocab()

    def create(
        self,
        mode: str,
        payload: dict,
        feedback: list[str] | None = None,
        pantry: list[dict] | None = None,
        known_names: list[str] | None = None,
    ) -> dict:
        """按模式渲染提示词并调用模型;payload 按 mode 取 cuisine/name/ingredients。"""
        template = _ENV.get_template(MODE_PROMPTS[mode])
        user = template.render(
            solar_terms=self.vocab.solar_terms,
            cuisines=self.vocab.cuisines,
            feedback=feedback,
            pantry=pantry or [],
            known_names=known_names or [],
            **payload,
        )
        return self.client.chat_json(SYSTEM, user)
