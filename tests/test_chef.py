import json

from llm.chef import DishChef
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


def make_chef(response=CREATED):
    return DishChef(client=FakeJSONClient(response))


def test_create_returns_parsed_record_with_prompt_anchors():
    chef = make_chef()
    record = chef.create(["白萝卜", "鸡胸肉"])
    assert record["name"] == "清炖白萝卜鸡胸汤"
    user = chef.client.last_user
    assert "候选食材:白萝卜、鸡胸肉" in user
    assert "大寒" in user and "立春" in user
    assert "库内食材档案" not in user


def test_create_prompt_contains_pantry_and_feedback():
    chef = make_chef()
    pantry = [
        {
            "name": "白萝卜",
            "nature": "凉",
            "flavor": "辛,甘",
            "meridian": "肺,胃",
            "benefits": "下气消食",
            "caution": "脾胃虚寒者少食",
        }
    ]
    chef.create(["白萝卜"], feedback=["热量与食材分量疑似不符"], pantry=pantry)
    user = chef.client.last_user
    assert "库内食材档案" in user
    assert "下气消食" in user and "脾胃虚寒者少食" in user
    assert "修订要求" in user and "热量与食材分量疑似不符" in user
