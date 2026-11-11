import json

from llm.cuisine_verify import CuisineVerifier
from tests.fakes import FakeJSONClient

PASS = '{"verdict":"pass","problems":[]}'
DOUBT = '{"verdict":"存疑","problems":["关键步骤未讲明为什么","story 典派说法存疑"]}'


def test_verify_prompt_contains_mode_context_and_dish():
    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verdict, problems = verifier.verify(
        {"name": "宫保鸡丁", "style": "川菜,炒"}, "cuisine", "川菜"
    )
    assert verdict == "pass" and problems == []
    user = verifier.client.last_user
    assert "按菜系生成" in user and "川菜" in user and "宫保鸡丁" in user

    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "ingredient", ["白萝卜", "鸡胸肉"])
    assert "候选食材:白萝卜、鸡胸肉" in verifier.client.last_user

    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "name", "宫保鸡丁")
    assert "按菜名生成" in verifier.client.last_user


def test_verify_prompt_contains_no_calorie_line_philosophy():
    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "name", "汤")
    user = verifier.client.last_user
    assert "没有低卡指标" in user and "造假" in user


def test_verify_treats_bad_output_as_fail():
    verifier = CuisineVerifier(client=FakeJSONClient("不是 JSON"))
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "fail" and problems


def test_verify_returns_doubt_verdict():
    verifier = CuisineVerifier(client=FakeJSONClient(DOUBT))
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "存疑" and len(problems) == 2


def test_verify_rejects_illegal_verdict():
    verifier = CuisineVerifier(
        client=FakeJSONClient(json.dumps({"verdict": "还行", "problems": []}, ensure_ascii=False))
    )
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "fail" and problems == ["验证 LLM verdict 不合法"]
