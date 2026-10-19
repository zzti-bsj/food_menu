from shike.validate import validate_ingredient
from shike.vocab import load_vocab

VOCAB = load_vocab()

RADISH = {
    "name": "白萝卜",
    "aliases": "莱菔",
    "category": "蔬菜",
    "nature": "凉",
    "flavor": "辛,甘",
    "meridian": "肺,胃",
    "benefits": "消食导滞,降气化痰,行气宽中",
    "season_note": "秋冬",
    "caution": "脾胃虚寒者不宜生食过量",
    "classic_note": None,
    "solar_terms": "立冬,小雪,大雪,冬至,小寒,大寒",
}


def test_valid_record_passes():
    assert validate_ingredient(RADISH, VOCAB) == []


def test_unknown_field_rejected():
    record = {**RADISH, "extra": "x"}
    errors = validate_ingredient(record, VOCAB)
    assert any("未知字段" in e for e in errors)


def test_closed_values_rejected():
    record = {**RADISH, "nature": "超热", "benefits": "长生不老"}
    errors = validate_ingredient(record, VOCAB)
    assert any(e.startswith("nature:") for e in errors)
    assert any(e.startswith("benefits:") for e in errors)


def test_benefits_may_be_null_or_empty():
    assert validate_ingredient({**RADISH, "benefits": None}, VOCAB) == []
    assert validate_ingredient({**RADISH, "benefits": ""}, VOCAB) == []


def test_category_capped_at_three():
    record = {**RADISH, "category": "蔬菜,药食两用,谷类,水果"}
    errors = validate_ingredient(record, VOCAB)
    assert any("最多 3 个" in e for e in errors)


def test_solar_terms_must_ascending():
    record = {**RADISH, "solar_terms": "冬至,立冬"}
    errors = validate_ingredient(record, VOCAB)
    assert any("升序" in e for e in errors)


def test_required_missing_reported():
    errors = validate_ingredient({"name": "梨"}, VOCAB)
    for field in ("name", "category", "nature", "flavor", "meridian", "solar_terms"):
        assert any(e.startswith(f"{field}: 必填") for e in errors) or field == "name"
    assert not any(e.startswith("benefits") for e in errors)
