import pytest

import web.app as web_app
from shike import repository
from tests.test_web_auth import fake_users, login
from web.app import app


@pytest.fixture()
def client():
    return app.test_client()


def test_ingredients_grouped_by_status(monkeypatch, client, fake_users):
    """登录态:官方(NULL)+ 本人可见,官方排前;他人内容不可见。未登录:仅官方。"""
    token = login(client).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    rows = [
        {"id": 1, "user_id": None, "name": "山药官方", "status": "待审核"},
        {"id": 2, "user_id": 1, "name": "山药私有", "status": "待审核"},
        {"id": 3, "user_id": 9, "name": "他人私有", "status": "待审核"},
        {"id": 4, "user_id": None, "name": "莲藕", "status": "已通过"},
        {"id": 5, "user_id": 1, "name": "私有通过", "status": "已通过"},
    ]
    monkeypatch.setattr(repository, "list_ingredients", lambda: rows)
    data = client.get("/api/ingredients", headers=headers).get_json()
    assert [r["name"] for r in data["待审核"]] == ["山药官方", "山药私有"]
    # 回归:行必须携带 user_id(否则客户端归属过滤失效)
    assert data["待审核"][0]["user_id"] is None
    assert data["待审核"][1]["user_id"] == 1
    assert [r["name"] for r in data["已通过"]] == ["莲藕", "私有通过"]
    assert data["已驳回"] == []
    anon = client.get("/api/ingredients").get_json()
    assert [r["name"] for r in anon["待审核"]] == ["山药官方"]


def test_set_status_flow(monkeypatch, client, fake_users):
    """审核鉴权:登录 + 归属人/admin;未登录 401;非归属人 404 防探测。"""
    token = login(client).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    monkeypatch.setattr(
        repository,
        "find_ingredient_by_name",
        lambda n: {"id": 1, "name": n, "user_id": 1, "status": "待审核"} if n == "山药" else None,
    )
    monkeypatch.setattr(repository, "update_ingredient_status", lambda n, s: n == "山药")
    ok = client.post("/api/status", json={"name": "山药", "status": "已通过"}, headers=headers)
    miss = client.post("/api/status", json={"name": "莲藕", "status": "已通过"}, headers=headers)
    bad = client.post("/api/status", json={"name": "山药", "status": "作废"}, headers=headers)
    assert ok.status_code == 200
    assert miss.status_code == 404
    assert bad.status_code == 400

    # 非归属人 404 防探测
    monkeypatch.setattr(
        repository,
        "find_ingredient_by_name",
        lambda n: {"id": 1, "name": n, "user_id": 999, "status": "待审核"},
    )
    other = client.post("/api/status", json={"name": "山药", "status": "已通过"}, headers=headers)
    assert other.status_code == 404

    # 未登录 401
    anon = client.post("/api/status", json={"name": "山药", "status": "已通过"})
    assert anon.status_code == 401


def test_terms_endpoint_returns_vocab(client):
    terms = client.get("/api/terms").get_json()
    assert "白露" in terms and len(terms) == 24


def test_batch_rejects_illegal_term(client):
    assert client.post("/api/batch", json={"term": "不是节气"}).status_code == 400


def test_batch_returns_pipeline_result(monkeypatch, client):
    """批次结果直接随响应返回(不再有服务端 last 存储)。"""
    class FakeBatch:
        def run(self, term, user_id=None):
            return {
                "term": term, "recommended": ["莲藕"], "inserted": ["莲藕"],
                "doubts": {}, "failed": [],
            }

    monkeypatch.setattr(web_app, "IngredientBatchPipeline", FakeBatch)
    res = client.post("/api/batch", json={"term": "白露"})
    assert res.get_json()["inserted"] == ["莲藕"]


def test_dishes_grouped_by_status(monkeypatch, client, fake_users):
    token = login(client).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    rows = [
        {"id": 1, "user_id": None, "name": "清炖白萝卜鸡胸汤", "status": "待审核"},
        {"id": 2, "user_id": 9, "name": "他人私有菜", "status": "待审核"},
        {"id": 3, "user_id": 1, "name": "私有菜", "status": "已通过"},
        {"id": 4, "user_id": None, "name": "凉拌鸡丝", "status": "已通过"},
    ]
    monkeypatch.setattr(repository, "list_dishes", lambda: rows)
    data = client.get("/api/dishes", headers=headers).get_json()
    assert [r["name"] for r in data["待审核"]] == ["清炖白萝卜鸡胸汤"]
    assert [r["name"] for r in data["已通过"]] == ["凉拌鸡丝", "私有菜"]
    assert data["已驳回"] == []


def test_set_dish_status_flow(monkeypatch, client, fake_users):
    token = login(client).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    monkeypatch.setattr(
        repository,
        "find_dish_by_name_any",
        lambda n: {"id": 1, "name": n, "user_id": 1, "status": "待审核"} if n == "清炖白萝卜鸡胸汤" else None,
    )
    monkeypatch.setattr(repository, "update_dish_status", lambda n, s: n == "清炖白萝卜鸡胸汤")
    ok = client.post("/api/dish/status", json={"name": "清炖白萝卜鸡胸汤", "status": "已通过"}, headers=headers)
    miss = client.post("/api/dish/status", json={"name": "凉拌鸡丝", "status": "已通过"}, headers=headers)
    bad = client.post("/api/dish/status", json={"name": "清炖白萝卜鸡胸汤", "status": "作废"}, headers=headers)
    assert ok.status_code == 200
    assert miss.status_code == 404
    assert bad.status_code == 400

    # 未登录 401
    anon = client.post("/api/dish/status", json={"name": "清炖白萝卜鸡胸汤", "status": "已通过"})
    assert anon.status_code == 401


def test_create_dish_runs_pipeline(monkeypatch, client):
    calls = []

    class FakeDishPipeline:
        def run(self, ingredients, user_id=None):
            calls.append((ingredients, user_id))
            return {"ingredients": ingredients, "stage": "inserted",
                    "name": "清炖白萝卜鸡胸汤", "dish": {"name": "清炖白萝卜鸡胸汤"},
                    "excluded": []}

    monkeypatch.setattr(web_app, "DishPipeline", FakeDishPipeline)
    res = client.post("/api/dishes", json={"ingredients": ["白萝卜", "鸡胸肉", "白萝卜"]})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert calls == [(["白萝卜", "鸡胸肉"], None)]  # 未登录:归属官方(None)


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
        def run(self, mode, payload, user_id=None):
            calls.append((mode, payload, user_id))
            return {"stage": "inserted", "name": "宫保鸡丁", "dish": {}, "excluded": []}

    monkeypatch.setattr(web_app, "CuisinePipeline", FakeCuisinePipeline)
    res = client.post("/api/dishes", json={"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert calls == [("name", {"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"}, None)]


def test_create_dish_health_path_unchanged(monkeypatch, client):
    class FakeDishPipeline:
        def __init__(self):
            pass

        def run(self, ingredients, user_id=None):
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
