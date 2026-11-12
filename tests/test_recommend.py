import pytest

from llm.recommend import EXHAUSTED, SolarTermIngredientRecommender
from shike import repository


class FakeClient:
    """按脚本回放模型输出的假客户端。"""

    def __init__(self, response: str):
        self.response = response
        self.last_user = ""

    def chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        self.last_user = user
        return self.response


@pytest.fixture
def patch_existing(monkeypatch):
    calls = []

    def _patch(names: list[str]):
        def fake(terms, owner=None):
            calls.append(terms)
            return names

        monkeypatch.setattr(repository, "list_names_by_solar_terms", fake)

    _patch.calls = calls
    return _patch


def test_invalid_term_raises():
    r = SolarTermIngredientRecommender(client=FakeClient(""))
    with pytest.raises(ValueError, match="非法节气"):
        r.recommend("夏眠")


def test_existing_covers_five_terms_with_wraparound(patch_existing):
    patch_existing([])
    r = SolarTermIngredientRecommender(client=FakeClient(EXHAUSTED))
    r.recommend("大寒")
    assert patch_existing.calls == [["冬至", "小寒", "大寒", "立春", "雨水"]]


def test_recommend_returns_names(patch_existing):
    patch_existing(["梨", "银耳"])
    client = FakeClient("山药\n莲藕\n百合")
    r = SolarTermIngredientRecommender(client=client)
    assert r.recommend("白露") == ["山药", "莲藕", "百合"]
    assert "白露" in client.last_user
    assert "梨" in client.last_user


def test_exhausted_returns_empty(patch_existing):
    patch_existing([])
    r = SolarTermIngredientRecommender(client=FakeClient(EXHAUSTED))
    assert r.recommend("大寒") == []
