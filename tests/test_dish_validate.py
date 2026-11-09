import pytest

from shike.validate import validate_dish
from shike.vocab import load_vocab

VOCAB = load_vocab()

VALID = {
    "name": "清炖白萝卜鸡胸汤",
    "category": "健康厨师",
    "main_ingredients": [
        {"name": "白萝卜", "amount": "半根"},
        {"name": "鸡胸肉", "amount": "1块"},
    ],
    "excluded": [{"name": "菠菜", "reason": "与豆腐同食影响钙吸收"}],
    "extras": [{"name": "姜", "amount": "3片"}, {"name": "盐", "amount": "3g"}],
    "steps": [
        "白萝卜去皮切滚刀块;鸡胸肉冷水下锅,加料酒焯水去腥",
        "重新加水,放姜片,小火炖20分钟至筷子能轻松插透萝卜",
        "出锅前加盐调味",
    ],
    "calories": 320,
    "benefits": "白萝卜下气消食,鸡胸肉高蛋白低脂,汤鲜而不腻",
    "caution": "脾胃虚寒者少食",
    "style": "家常,炖",
    "solar_terms": "立冬,小雪",
}


def _check(mutate) -> list[str]:
    record = {**VALID, **mutate} if isinstance(mutate, dict) else mutate()
    return validate_dish(record, VOCAB)


def test_valid_record_passes():
    assert validate_dish(VALID, VOCAB) == []


def test_rejects_non_dict_record():
    errors = _check(lambda: ["不是对象"])
    assert any("JSON 对象" in e for e in errors)


def test_missing_required_fields_reported():
    record = {k: v for k, v in VALID.items() if k not in ("name", "steps", "calories")}
    errors = validate_dish(record, VOCAB)
    for field in ("name", "steps", "calories"):
        assert any(e.startswith(f"{field}:") for e in errors)


def test_unknown_field_rejected():
    errors = _check({"surprise": 1})
    assert any("未知字段" in e for e in errors)


def test_category_must_be_in_vocab():
    errors = _check({"category": "黑暗厨师"})
    assert any("category" in e and "词表" in e for e in errors)


def test_main_ingredients_must_be_nonempty_list_of_name_amount():
    for bad in ([], [{"name": "白萝卜"}], [{"amount": "半根"}], ["白萝卜 半根"], "白萝卜"):
        errors = _check({"main_ingredients": bad})
        assert errors, f"main_ingredients={bad!r} 应不通过"


def test_steps_must_be_nonempty_list_of_text():
    for bad in ([], ["第一步", ""], "第一步", ["   "]):
        errors = _check({"steps": bad})
        assert errors, f"steps={bad!r} 应不通过"


def test_calories_must_be_positive_int():
    for bad in ("三百", 0, -5, 320.5, None):
        errors = _check({"calories": bad})
        assert errors, f"calories={bad!r} 应不通过"


def test_solar_terms_vocab_and_order():
    errors = _check({"solar_terms": "立冬,不是节气"})
    assert any("词表" in e for e in errors)
    errors = _check({"solar_terms": "小雪,立冬"})
    assert any("升序" in e for e in errors)


def test_solar_terms_must_be_comma_separated_string_not_list():
    errors = _check({"solar_terms": ["立冬", "小雪"]})
    assert any("solar_terms" in e and "字符串" in e for e in errors)


def test_text_length_limits():
    errors = _check({"name": "超" * 101, "style": "长" * 101, "benefits": "长" * 501,
                     "caution": "长" * 501})
    assert len(errors) == 4


STORY = "入口煳辣荔枝味,酸甜微辣平衡,鸡丁滑嫩、花生酥脆;相传自清代丁宝桢家厨,川菜味型的教科书。"


def test_story_is_optional_known_field_with_limit():
    record = {**VALID, "story": STORY}
    assert validate_dish(record, VOCAB) == []
    errors = validate_dish({**record, "story": "长" * 501}, VOCAB)
    assert any(e.startswith("story:") for e in errors)


def test_cuisines_param_checks_style_first_segment():
    cuisines = ("川菜", "粤菜", "家常菜")
    ok = validate_dish({**VALID, "style": "川菜,煳辣快炒", "story": STORY}, VOCAB, cuisines=cuisines)
    assert ok == []
    bad = validate_dish({**VALID, "style": "日式,炒", "story": STORY}, VOCAB, cuisines=cuisines)
    assert any("style" in e and "菜系词表" in e for e in bad)


def test_cuisines_param_default_keeps_style_free():
    record = {**VALID, "style": "随便写,炖"}
    assert validate_dish(record, VOCAB) == []
    assert validate_dish(record, VOCAB, cuisines=None) == []
