import json

from llm.fill import IngredientFiller
from llm.pipeline import IngredientPipeline
from llm.verify import IngredientVerifier
from shike import repository
from tests.fakes import FakeJSONClient

FILLED = json.dumps(
    {
        "name": "山药",
        "aliases": "薯蓣",
        "category": "薯芋,药食两用",
        "nature": "平",
        "flavor": "甘",
        "meridian": "脾,肺,肾",
        "benefits": "健脾益气,补肺益气,滋补肾阴",
        "season_note": "秋冬",
        "caution": "湿盛中满者不宜",
        "classic_note": None,
        "solar_terms": "立冬,小雪,大雪,冬至",
    },
    ensure_ascii=False,
)


def make_pipeline(fill_response: str, verify_response: str):
    filler = IngredientFiller(client=FakeJSONClient(fill_response))
    verifier = IngredientVerifier(client=FakeJSONClient(verify_response))
    return IngredientPipeline(filler=filler, verifier=verifier), filler


def test_fill_prompt_contains_vocab_and_name():
    filler = IngredientFiller(client=FakeJSONClient(FILLED))
    filler.fill("山药")
    user = filler.client.last_user
    assert "待填写食材:山药" in user
    assert "轻身消脂" in user
    assert "大寒" in user and "立春" in user
    assert "药食两用" in user


def test_pipeline_bad_fill_json_fails_gracefully(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    pipeline, _ = make_pipeline("不是 JSON", '{"verdict":"pass","problems":[]}')

    result = pipeline.run("红薯")
    assert result["stage"] == "invalid"
    assert result["errors"]
    assert inserted == []


def test_pipeline_invalid_record_stops_before_verify(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    bad = json.dumps({"name": "山药", "nature": "超热"}, ensure_ascii=False)
    pipeline, _ = make_pipeline(bad, '{"verdict":"pass","problems":[]}')

    result = pipeline.run("山药")
    assert result["stage"] == "invalid"
    assert result["errors"]
    assert inserted == []


def test_pipeline_rejected_by_verifier(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    pipeline, _ = make_pipeline(
        FILLED, '{"verdict":"fail","problems":["归经与本草记载不符"]}'
    )

    result = pipeline.run("山药")
    assert result["stage"] == "rejected"
    assert result["problems"] == ["归经与本草记载不符"]
    assert inserted == []


def test_pipeline_pass_inserts_pending_record(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    pipeline, _ = make_pipeline(FILLED, '{"verdict":"pass","problems":[]}')

    result = pipeline.run("山药")
    assert result == {"name": "山药", "stage": "inserted"}
    assert inserted and inserted[0]["name"] == "山药"


def test_pipeline_pass_inserts_with_owner(monkeypatch):
    """回归:登录用户的归属必须穿透到入库(user_id 不能在 _insert 调用点丢失)。"""
    captured = []
    monkeypatch.setattr(
        repository, "insert_ingredient", lambda r, user_id=None: captured.append(user_id)
    )
    pipeline, _ = make_pipeline(FILLED, '{"verdict":"pass","problems":[]}')
    result = pipeline.run("白萝卜", user_id=7)
    assert result["stage"] == "inserted"
    assert captured == [7]


def test_pipeline_duplicate_name(monkeypatch):
    from pymysql.err import IntegrityError

    def raise_duplicate(record, user_id=None):
        raise IntegrityError(1062, "Duplicate entry")

    monkeypatch.setattr(repository, "insert_ingredient", raise_duplicate)
    pipeline, _ = make_pipeline(FILLED, '{"verdict":"pass","problems":[]}')

    assert pipeline.run("山药") == {"name": "山药", "stage": "duplicate"}


def test_verifier_treats_bad_output_as_fail():
    verifier = IngredientVerifier(client=FakeJSONClient("不是 JSON"))
    verdict, problems = verifier.verify({"name": "山药"})
    assert verdict == "fail"
    assert problems


def test_verifier_returns_doubt_verdict():
    verifier = IngredientVerifier(
        client=FakeJSONClient('{"verdict":"存疑","problems":["文献分歧"]}')
    )
    verdict, problems = verifier.verify({"name": "山药"})
    assert verdict == "存疑"
    assert problems == ["文献分歧"]


def test_pipeline_revision_recovers_from_invalid(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    bad = json.dumps({"name": "山药", "nature": "超热"}, ensure_ascii=False)
    filler = IngredientFiller(client=FakeJSONClient([bad, FILLED]))
    verifier = IngredientVerifier(client=FakeJSONClient('{"verdict":"pass","problems":[]}'))
    pipeline = IngredientPipeline(filler=filler, verifier=verifier)

    result = pipeline.run("山药")
    assert result["stage"] == "inserted"
    assert inserted and "修订要求" in filler.client.last_user


def test_pipeline_revision_cap(monkeypatch):
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: None)
    bad = json.dumps({"name": "山药", "nature": "超热"}, ensure_ascii=False)
    filler = IngredientFiller(client=FakeJSONClient(bad))
    pipeline = IngredientPipeline(
        filler=filler,
        verifier=IngredientVerifier(client=FakeJSONClient('{"verdict":"pass","problems":[]}')),
    )

    result = pipeline.run("山药")
    assert result["stage"] == "invalid"
    assert filler.client.calls == 4


def test_pipeline_doubt_inserts_with_doubts(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_ingredient", lambda r, user_id=None: inserted.append(r))
    pipeline, _ = make_pipeline(FILLED, '{"verdict":"存疑","problems":["性味记载存在分歧"]}')

    result = pipeline.run("山药")
    assert result["stage"] == "inserted"
    assert result["doubts"] == ["性味记载存在分歧"]
    assert inserted
