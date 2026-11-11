import pytest

import web.app as web_app
from shike import repository
from web.app import app


@pytest.fixture()
def client():
    return app.test_client()


def test_ingredients_grouped_by_status(monkeypatch, client):
    rows = [
        {"name": "山药", "status": "待审核"},
        {"name": "莲藕", "status": "已通过"},
    ]
    monkeypatch.setattr(repository, "list_ingredients", lambda: rows)
    data = client.get("/api/ingredients").get_json()
    assert [r["name"] for r in data["待审核"]] == ["山药"]
    assert [r["name"] for r in data["已通过"]] == ["莲藕"]
    assert data["已驳回"] == []


def test_set_status_flow(monkeypatch, client):
    monkeypatch.setattr(repository, "update_ingredient_status", lambda n, s: n == "山药")
    ok = client.post("/api/status", json={"name": "山药", "status": "已通过"})
    miss = client.post("/api/status", json={"name": "莲藕", "status": "已通过"})
    bad = client.post("/api/status", json={"name": "山药", "status": "作废"})
    assert ok.status_code == 200
    assert miss.status_code == 404
    assert bad.status_code == 400


def test_terms_endpoint_returns_vocab(client):
    terms = client.get("/api/terms").get_json()
    assert "白露" in terms and len(terms) == 24


def test_batch_rejects_illegal_term(client):
    assert client.post("/api/batch", json={"term": "不是节气"}).status_code == 400


def test_batch_keeps_last_result(monkeypatch, client):
    class FakeBatch:
        def run(self, term):
            return {"term": term, "recommended": ["莲藕"], "inserted": ["莲藕"], "failed": []}

    monkeypatch.setattr(web_app, "IngredientBatchPipeline", FakeBatch)
    res = client.post("/api/batch", json={"term": "白露"})
    assert res.get_json()["inserted"] == ["莲藕"]
    assert client.get("/api/batch/last").get_json()["term"] == "白露"


def test_dishes_grouped_by_status(monkeypatch, client):
    rows = [
        {"name": "清炖白萝卜鸡胸汤", "status": "待审核"},
        {"name": "凉拌鸡丝", "status": "已通过"},
    ]
    monkeypatch.setattr(repository, "list_dishes", lambda: rows)
    data = client.get("/api/dishes").get_json()
    assert [r["name"] for r in data["待审核"]] == ["清炖白萝卜鸡胸汤"]
    assert [r["name"] for r in data["已通过"]] == ["凉拌鸡丝"]
    assert data["已驳回"] == []


def test_set_dish_status_flow(monkeypatch, client):
    monkeypatch.setattr(repository, "update_dish_status", lambda n, s: n == "清炖白萝卜鸡胸汤")
    ok = client.post("/api/dish/status", json={"name": "清炖白萝卜鸡胸汤", "status": "已通过"})
    miss = client.post("/api/dish/status", json={"name": "凉拌鸡丝", "status": "已通过"})
    bad = client.post("/api/dish/status", json={"name": "清炖白萝卜鸡胸汤", "status": "作废"})
    assert ok.status_code == 200
    assert miss.status_code == 404
    assert bad.status_code == 400


def test_create_dish_runs_pipeline(monkeypatch, client):
    calls = []

    class FakeDishPipeline:
        def run(self, ingredients):
            calls.append(ingredients)
            return {"ingredients": ingredients, "stage": "inserted",
                    "name": "清炖白萝卜鸡胸汤", "dish": {"name": "清炖白萝卜鸡胸汤"},
                    "excluded": []}

    monkeypatch.setattr(web_app, "DishPipeline", FakeDishPipeline)
    res = client.post("/api/dishes", json={"ingredients": ["白萝卜", "鸡胸肉", "白萝卜"]})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert calls == [["白萝卜", "鸡胸肉"]]


def test_create_dish_rejects_bad_ingredients(client):
    for bad in (None, [], ["  "], "白萝卜", [1]):
        assert client.post("/api/dishes", json={"ingredients": bad}).status_code == 400


def test_cuisines_endpoint(client):
    cuisines = client.get("/api/cuisines").get_json()
    assert "川菜" in cuisines and "家常菜" in cuisines and "西餐" in cuisines
    assert len(cuisines) == 18


def test_create_dish_chef_cuisine_dispatch(monkeypatch, client):
    calls = []

    class FakeCuisinePipeline:
        def run(self, mode, payload):
            calls.append((mode, payload))
            return {"stage": "inserted", "name": "宫保鸡丁", "dish": {}, "excluded": []}

    monkeypatch.setattr(web_app, "CuisinePipeline", FakeCuisinePipeline)
    res = client.post("/api/dishes", json={"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert calls == [("name", {"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"})]


def test_create_dish_health_path_unchanged(monkeypatch, client):
    class FakeDishPipeline:
        def __init__(self):
            pass

        def run(self, ingredients):
            return {"stage": "inserted", "name": "汤", "dish": {}, "excluded": []}

    monkeypatch.setattr(web_app, "DishPipeline", FakeDishPipeline)
    res = client.post("/api/dishes", json={"ingredients": ["白萝卜"]})
    assert res.get_json()["stage"] == "inserted"


def test_set_dish_image(monkeypatch, client):
    calls = []
    monkeypatch.setattr(
        repository, "update_dish_image", lambda n, i: calls.append((n, i)) or True
    )
    ok = client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": "https://x/1.jpg"})
    assert ok.status_code == 200
    assert calls[-1] == ("宫保鸡丁", "https://x/1.jpg")
    clear = client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": ""})
    assert clear.status_code == 200
    assert calls[-1] == ("宫保鸡丁", None)


def test_set_dish_image_rejects_bad_params(monkeypatch, client):
    monkeypatch.setattr(repository, "update_dish_image", lambda n, i: False)
    assert client.post("/api/dish/image", json={"image": "x"}).status_code == 400
    assert client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": 1}).status_code == 400
    miss = client.post("/api/dish/image", json={"name": "不存在", "image": "x"})
    assert miss.status_code == 404
