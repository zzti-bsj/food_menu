import json

from llm.cuisine_chef import CuisineChef
from tests.fakes import FakeJSONClient

PANTRY = [
    {
        "name": "白萝卜",
        "nature": "凉",
        "flavor": "辛,甘",
        "meridian": "肺,胃",
        "benefits": "下气消食",
        "caution": "脾胃虚寒者少食",
    }
]


def make_chef(response="{}"):
    return CuisineChef(client=FakeJSONClient(response))


def test_cuisine_mode_renders_cuisine_template():
    chef = make_chef()
    chef.create("cuisine", {"cuisine": "川菜"}, known_names=["麻婆豆腐", "回锅肉"])
    user = chef.client.last_user
    assert "美食大厨" in user
    assert "从「川菜」中选一道" in user
    assert "不得重复" in user and "回锅肉" in user
    assert "川菜" in user.split("封闭选项")[1], "封闭选项应含菜系清单"
    assert "候选食材:" not in user and "not_found" not in user


def test_name_mode_renders_name_template():
    chef = make_chef()
    chef.create("name", {"name": "宫保鸡丁"})
    user = chef.client.last_user
    assert "为菜名「宫保鸡丁」" in user
    assert "not_found" in user, "菜名模式必须带防编造契约"
    assert "候选食材:" not in user and "不得重复" not in user


def test_ingredient_mode_renders_ingredient_template():
    chef = make_chef()
    chef.create("ingredient", {"ingredients": ["白萝卜", "鸡胸肉"]})
    user = chef.client.last_user
    assert "候选食材:白萝卜、鸡胸肉" in user
    assert "not_found" not in user


def test_prompt_contains_teaching_and_story_requirements():
    chef = make_chef()
    chef.create("cuisine", {"cuisine": "川菜"})
    user = chef.client.last_user
    assert "为什么" in user and "失败点" in user, "教学性步骤要求必须在共享段"
    assert "story" in user and "≤200字" in user


def test_prompt_contains_pantry_and_feedback():
    chef = make_chef()
    chef.create(
        "ingredient",
        {"ingredients": ["白萝卜"]},
        feedback=["story 超长"],
        pantry=PANTRY,
    )
    user = chef.client.last_user
    assert "库内食材档案" in user and "脾胃虚寒者少食" in user
    assert "修订要求" in user and "story 超长" in user


def test_create_returns_parsed_record():
    chef = CuisineChef(
        client=FakeJSONClient(json.dumps({"name": "宫保鸡丁", "story": "经典川味"}, ensure_ascii=False))
    )
    record = chef.create("name", {"name": "宫保鸡丁"})
    assert record["name"] == "宫保鸡丁"


def test_create_passthrough_not_found():
    chef = CuisineChef(client=FakeJSONClient('{"not_found": true, "reason": "查无此菜"}'))
    record = chef.create("name", {"name": "不存在的菜"})
    assert record == {"not_found": True, "reason": "查无此菜"}
