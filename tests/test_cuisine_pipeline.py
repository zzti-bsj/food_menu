import json

import pytest

from llm.cuisine_chef import CuisineChef
from llm.cuisine_pipeline import CuisinePipeline
from llm.cuisine_verify import CuisineVerifier
from shike import reject_log, repository
from tests.fakes import FakeJSONClient

STORY = "入口煳辣荔枝味,酸甜微辣平衡,鸡丁滑嫩、花生酥脆;相传自清代丁宝桢家厨,川菜味型的教科书。"

CREATED = json.dumps(
    {
        "name": "宫保鸡丁",
        "main_ingredients": [
            {"name": "鸡胸肉", "amount": "1块"},
            {"name": "花生米", "amount": "1把"},
        ],
        "excluded": [],
        "extras": [{"name": "干辣椒", "amount": "8根"}, {"name": "花椒", "amount": "20粒"}],
        "steps": [
            "鸡胸肉逆纹切1.5cm丁,加盐料酒蛋清抓匀——逆纹切断肌纤维才嫩",
            "油七成热下干辣椒花椒爆香,约10秒出香即下鸡丁,晚则煳",
            "大火快炒1分钟至鸡丁变色,烹入碗汁,收至挂勺",
        ],
        "calories": 380,
        "benefits": "鸡胸肉高蛋白低脂,花椒温中散寒",
        "caution": None,
        "story": STORY,
        "style": "川菜,煳辣快炒",
        "solar_terms": "立冬,小雪",
    },
    ensure_ascii=False,
)
PASS = '{"verdict":"pass","problems":[]}'
DOUBT = '{"verdict":"存疑","problems":["关键步骤未讲明为什么"]}'


def make_pipeline(create_response=CREATED, verify_response=PASS):
    chef = CuisineChef(client=FakeJSONClient(create_response))
    verifier = CuisineVerifier(client=FakeJSONClient(verify_response))
    return CuisinePipeline(chef=chef, verifier=verifier), chef


@pytest.fixture(autouse=True)
def _stub_repository(monkeypatch):
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: [])
    monkeypatch.setattr(repository, "list_dish_names_by_cuisine", lambda cuisine: [])
    monkeypatch.setattr(repository, "find_dish_by_name", lambda name: None)
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)


def test_name_mode_invalid_input_short_circuits():
    pipeline, chef = make_pipeline()
    for bad in ("", "  ", "宫保鸡丁,麻婆豆腐", "宫保鸡丁、回锅肉", "A" * 101, None):
        result = pipeline.run("name", {"name": bad})
        assert result["stage"] == "invalid_input", f"{bad!r} 应不合法"
    assert chef.client.calls == 0


def test_name_mode_duplicate_precheck_skips_llm(monkeypatch):
    monkeypatch.setattr(repository, "find_dish_by_name", lambda name: {"name": name})
    pipeline, chef = make_pipeline()
    result = pipeline.run("name", {"name": "宫保鸡丁"})
    assert result["stage"] == "duplicate" and result["name"] == "宫保鸡丁"
    assert chef.client.calls == 0


def test_name_mode_not_found_short_circuits_and_logs(monkeypatch):
    logged = []
    monkeypatch.setattr(
        reject_log, "log_reject",
        lambda name, stage, detail, entity="食材": logged.append((name, stage, entity)),
    )
    pipeline, chef = make_pipeline(create_response='{"not_found": true, "reason": "查无此菜"}')
    result = pipeline.run("name", {"name": "不存在的菜"})
    assert result["stage"] == "not_found" and result["reason"] == "查无此菜"
    assert chef.client.calls == 1
    assert logged == [("不存在的菜", "not_found", "美食大厨")]


def test_cuisine_mode_pass_inserts_with_known_names_and_story(monkeypatch):
    monkeypatch.setattr(repository, "list_dish_names_by_cuisine", lambda c: ["麻婆豆腐"])
    pipeline, chef = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted" and result["name"] == "宫保鸡丁"
    user = chef.client.last_user
    assert "不得重复" in user and "麻婆豆腐" in user
    db = result["dish"]
    assert db["category"] == "美食大厨"
    assert db["story"] == STORY
    assert db["main_ingredients"] == "鸡胸肉 1块,花生米 1把"
    assert db["calories"] == "约380千卡"
    assert db["steps"].startswith("1. ")
    assert db["remark"] is None


def test_cuisine_mode_style_mismatch_feeds_back(monkeypatch):
    bad = json.dumps({**json.loads(CREATED), "style": "粤菜,炒"}, ensure_ascii=False)
    pipeline, chef = make_pipeline(create_response=[bad, CREATED])
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "菜系位须为「川菜」" in chef.client.last_user
    assert chef.client.calls == 2


def test_name_mode_rejects_nonempty_excluded(monkeypatch):
    with_excluded = json.dumps(
        {**json.loads(CREATED), "excluded": [{"name": "菠菜", "reason": "不搭"}]},
        ensure_ascii=False,
    )
    pipeline, chef = make_pipeline(create_response=with_excluded)
    result = pipeline.run("name", {"name": "宫保鸡丁"})
    assert result["stage"] == "invalid"
    assert "本模式不应弃置食材" in " ".join(result["errors"])
    assert chef.client.calls == 4


def test_ingredient_mode_happy_path_with_pantry_and_excluded(monkeypatch):
    pantry = [{"name": "白萝卜", "nature": "凉", "flavor": "辛,甘",
               "meridian": "肺,胃", "benefits": "下气消食", "caution": None}]
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: pantry)
    pipeline, chef = make_pipeline()
    result = pipeline.run("ingredient", {"ingredients": ["白萝卜", "鸡胸肉", "白萝卜"]})
    assert result["stage"] == "inserted"
    assert "库内食材档案" in chef.client.last_user
    assert "候选食材:白萝卜、鸡胸肉" in chef.client.last_user


def test_ingredient_mode_requires_nonempty_ingredients():
    pipeline, chef = make_pipeline()
    for bad in ([], ["  "], "白萝卜"):
        result = pipeline.run("ingredient", {"ingredients": bad})
        assert result["stage"] == "invalid_input"
    assert chef.client.calls == 0


def test_cuisine_mode_rejects_cuisine_outside_vocab():
    pipeline, chef = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "黑暗料理"})
    assert result["stage"] == "invalid_input"
    assert chef.client.calls == 0


def test_doubt_inserts_with_remark():
    pipeline, _ = make_pipeline(verify_response=DOUBT)
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert result["doubts"] == ["关键步骤未讲明为什么"]
    assert result["dish"]["remark"] == "关键步骤未讲明为什么"


def test_fail_revision_then_pass():
    pipeline, chef = make_pipeline(
        verify_response=['{"verdict":"fail","problems":["步骤缺少火候"]}', PASS]
    )
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "修订要求" in chef.client.last_user and "步骤缺少火候" in chef.client.last_user


def test_revision_cap_logs_reject_with_entity(monkeypatch):
    logged = []
    monkeypatch.setattr(
        reject_log, "log_reject",
        lambda name, stage, detail, entity="食材": logged.append((name, stage, entity)),
    )
    pipeline, chef = make_pipeline(verify_response='{"verdict":"fail","problems":["相克"]}')
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "rejected" and result["problems"] == ["相克"]
    assert chef.client.calls == 4
    assert logged == [("宫保鸡丁", "rejected", "美食大厨")]


def test_story_required_feedback():
    no_story = json.dumps({k: v for k, v in json.loads(CREATED).items() if k != "story"},
                          ensure_ascii=False)
    pipeline, chef = make_pipeline(create_response=[no_story, CREATED])
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "story: 必填" in chef.client.last_user


def test_duplicate_on_insert_race(monkeypatch):
    from pymysql.err import IntegrityError

    def raise_duplicate(record):
        raise IntegrityError(1062, "Duplicate entry")

    monkeypatch.setattr(repository, "insert_dish", raise_duplicate)
    pipeline, _ = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "duplicate"
