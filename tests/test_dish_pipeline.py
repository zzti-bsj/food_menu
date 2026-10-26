import json

import pytest

from llm.chef import DishChef
from llm.dish_pipeline import DishPipeline
from llm.dish_verify import DishVerifier
from shike import reject_log, repository
from tests.fakes import FakeJSONClient

CREATED = json.dumps(
    {
        "name": "清炖白萝卜鸡胸汤",
        "main_ingredients": [
            {"name": "白萝卜", "amount": "半根"},
            {"name": "鸡胸肉", "amount": "1块"},
        ],
        "excluded": [{"name": "菠菜", "reason": "与豆腐同食影响钙吸收"}],
        "extras": [{"name": "姜", "amount": "3片"}, {"name": "盐", "amount": "3g"}],
        "steps": ["白萝卜去皮切滚刀块;鸡胸肉焯水去腥", "小火炖20分钟至筷子能轻松插透", "出锅前加盐"],
        "calories": 320,
        "benefits": "白萝卜下气消食,鸡胸肉高蛋白低脂",
        "caution": None,
        "style": "家常,炖",
        "solar_terms": "立冬,小雪",
    },
    ensure_ascii=False,
)
PASS = '{"verdict":"pass","problems":[]}'
DOUBT = '{"verdict":"存疑","problems":["热量与食材分量疑似不符","萝卜性凉,脾胃虚寒者宜少食未提示"]}'


def make_pipeline(create_response=CREATED, verify_response=PASS):
    chef = DishChef(client=FakeJSONClient(create_response))
    verifier = DishVerifier(client=FakeJSONClient(verify_response))
    return DishPipeline(chef=chef, verifier=verifier), chef


@pytest.fixture(autouse=True)
def _stub_pantry(monkeypatch):
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: [])


def test_verifier_prompt_contains_ingredients_and_dish():
    verifier = DishVerifier(client=FakeJSONClient(PASS))
    verdict, problems = verifier.verify({"name": "清炖白萝卜鸡胸汤"}, ["白萝卜", "鸡胸肉"])
    assert verdict == "pass" and problems == []
    user = verifier.client.last_user
    assert "白萝卜、鸡胸肉" in user
    assert "清炖白萝卜鸡胸汤" in user


def test_verifier_treats_bad_output_as_fail():
    verifier = DishVerifier(client=FakeJSONClient("不是 JSON"))
    verdict, problems = verifier.verify({"name": "汤"}, ["白萝卜"])
    assert verdict == "fail"
    assert problems


def test_verifier_returns_doubt_verdict():
    verifier = DishVerifier(client=FakeJSONClient(DOUBT))
    verdict, problems = verifier.verify({"name": "汤"}, ["白萝卜"])
    assert verdict == "存疑"
    assert len(problems) == 2


def test_pipeline_pass_inserts_converted_record(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_dish", lambda r: inserted.append(r))
    pipeline, _ = make_pipeline()

    result = pipeline.run(["白萝卜", "鸡胸肉", "菠菜"])
    assert result["stage"] == "inserted"
    assert result["name"] == "清炖白萝卜鸡胸汤"
    assert result["excluded"] == [{"name": "菠菜", "reason": "与豆腐同食影响钙吸收"}]
    assert inserted, "应写入菜品"
    db = inserted[0]
    assert db["category"] == "健康厨师"
    assert db["main_ingredients"] == "白萝卜 半根,鸡胸肉 1块"
    assert db["extras"] == "姜 3片,盐 3g"
    assert db["steps"] == (
        "1. 白萝卜去皮切滚刀块;鸡胸肉焯水去腥\n"
        "2. 小火炖20分钟至筷子能轻松插透\n"
        "3. 出锅前加盐"
    )
    assert db["calories"] == "约320千卡"
    assert db["remark"] is None
    assert result["dish"]["name"] == "清炖白萝卜鸡胸汤"


def test_pipeline_doubt_writes_remark_lines_and_returns_doubts(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_dish", lambda r: inserted.append(r))
    pipeline, _ = make_pipeline(verify_response=DOUBT)

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "inserted"
    assert result["doubts"] == ["热量与食材分量疑似不符", "萝卜性凉,脾胃虚寒者宜少食未提示"]
    assert inserted[0]["remark"] == "热量与食材分量疑似不符\n萝卜性凉,脾胃虚寒者宜少食未提示"


def test_pipeline_fail_revision_then_pass(monkeypatch):
    inserted = []
    monkeypatch.setattr(repository, "insert_dish", lambda r: inserted.append(r))
    pipeline, chef = make_pipeline(verify_response=["{\"verdict\":\"fail\",\"problems\":[\"步骤缺少火候\"]}", PASS])

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "inserted"
    assert inserted
    assert "修订要求" in chef.client.last_user and "步骤缺少火候" in chef.client.last_user


def test_pipeline_revision_cap_logs_reject(monkeypatch):
    logged = []
    monkeypatch.setattr(reject_log, "log_reject",
                        lambda name, stage, detail, entity="食材": logged.append((name, stage, entity)))
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)
    pipeline, chef = make_pipeline(verify_response='{"verdict":"fail","problems":["相克"]}')

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "rejected"
    assert result["problems"] == ["相克"]
    assert chef.client.calls == 4
    assert logged == [("清炖白萝卜鸡胸汤", "rejected", "菜品")]


def test_pipeline_duplicate_name(monkeypatch):
    from pymysql.err import IntegrityError

    def raise_duplicate(record):
        raise IntegrityError(1062, "Duplicate entry")

    monkeypatch.setattr(repository, "insert_dish", raise_duplicate)
    pipeline, _ = make_pipeline()

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "duplicate"


def test_pipeline_pantry_injected_into_chef_prompt(monkeypatch):
    pantry = [{"name": "白萝卜", "nature": "凉", "flavor": "辛,甘",
               "meridian": "肺,胃", "benefits": "下气消食", "caution": None}]
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: pantry)
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)
    pipeline, chef = make_pipeline()

    pipeline.run(["白萝卜"])
    assert "库内食材档案" in chef.client.last_user


def test_pipeline_bad_create_json_fails_gracefully(monkeypatch):
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)
    pipeline, _ = make_pipeline(create_response="不是 JSON")

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "invalid"
    assert result["errors"]


def test_pipeline_invalid_record_feeds_back_required_fields(monkeypatch):
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)
    bad = json.dumps({"name": "汤"}, ensure_ascii=False)
    pipeline, chef = make_pipeline(create_response=bad)

    result = pipeline.run(["白萝卜"])
    assert result["stage"] == "invalid"
    assert "必填" in " ".join(result["errors"])
    assert "修订要求" in chef.client.last_user
