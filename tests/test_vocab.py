import pytest

from shike.vocab import (
    VOCAB_DIR,
    Vocab,
    load_vocab,
    parse_benefits,
    parse_categories,
    parse_nature_flavor_meridian,
    parse_solar_terms,
)

VOCAB = load_vocab()


def _read(filename: str) -> str:
    return (VOCAB_DIR / filename).read_text(encoding="utf-8")


def test_parse_solar_terms():
    terms = parse_solar_terms(_read("词表-节气.md"))
    assert len(terms) == 24
    assert terms[0] == "立春"
    assert terms[-1] == "大寒"
    assert "白露" in terms


def test_parse_solar_terms_rejects_duplicate():
    text = "| 序号 | 节气 | 季节 |\n|--|--|--|\n| 1 | 立春 | 春 |\n| 2 | 立春 | 春 |\n"
    with pytest.raises(ValueError, match="节气"):
        parse_solar_terms(text)


def test_parse_categories():
    cats = parse_categories(_read("词表-分类.md"))
    assert len(cats) == 15
    assert cats[0] == "谷类"
    assert "药食两用" in cats
    assert "水产" in cats


def test_parse_nature_flavor_meridian():
    nfm = parse_nature_flavor_meridian(_read("词表-性味归经.md"))
    assert nfm["natures"] == ["寒", "微寒", "凉", "平", "微温", "温", "热"]
    assert nfm["flavors"] == ["酸", "苦", "甘", "辛", "咸"]
    assert len(nfm["meridians"]) == 12
    assert "三焦" in nfm["meridians"] and "心包" in nfm["meridians"]


def test_parse_nature_flavor_meridian_missing_section():
    with pytest.raises(ValueError, match="缺少小节"):
        parse_nature_flavor_meridian("## 四气(单选)\n\n`寒` `凉`\n")


def test_parse_benefits():
    benefits = parse_benefits(_read("词表-功效.md"))
    assert "温中散寒" in benefits
    assert "轻身消脂" in benefits
    assert "解鱼蟹毒" in benefits
    assert benefits["轻身消脂"].startswith("化浊降脂")
    assert all("★" not in term for term in benefits)


def test_parse_benefits_rejects_duplicate():
    text = "| 词条 | 白话 |\n|--|--|\n| 补中益气 | a |\n| 补中益气 | b |\n"
    with pytest.raises(ValueError, match="重复"):
        parse_benefits(text)


def test_load_vocab_aggregates():
    v: Vocab = VOCAB
    assert len(v.solar_terms) == 24
    assert len(v.categories) == 15
    assert len(v.meridians) == 12
    assert len(v.benefits) == 63
    assert v.solar_term_index["白露"] == 14
    assert v.solar_term_index["大寒"] == 23
