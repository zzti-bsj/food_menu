import pytest
from pymysql.err import IntegrityError

from shike import repository
from web import auth
from web.app import app

SECRET = "test-secret-0123456789abcdef0123456789abcdef"
PHONE_USER, PHONE_ADMIN, PHONE_OTHER = "13800000001", "13800000003", "13800000004"
PASSWORD = "pass123"

INGREDIENTS: dict = {}
DISHES: dict = {}
USERS: dict = {}


def make_user(uid, phone, role="user"):
    return {
        "id": uid, "phone": phone, "password_hash": auth.hash_password(PASSWORD),
        "nickname": None, "role": role, "status": "正常",
    }


def make_ingredient(ingredient_id, name="山药", user_id=None):
    return {
        "id": ingredient_id, "user_id": user_id, "name": name, "aliases": None,
        "category": "薯芋,药食两用", "nature": "平", "flavor": "甘",
        "meridian": "脾,肺,肾", "benefits": None, "season_note": "全年",
        "caution": None, "classic_note": None, "image": None, "solar_terms": "白露",
        "status": "已通过",
    }


def make_dish(dish_id, name="凉拌鸡丝", user_id=None):
    return {
        "id": dish_id, "user_id": user_id, "name": name, "category": "健康厨师",
        "main_ingredients": "鸡胸肉 1块", "extras": None, "steps": "1. 煮熟\n2. 拌匀",
        "calories": "约350千卡", "benefits": "高蛋白低脂", "story": None,
        "image": None, "caution": None, "style": "家常菜,凉拌",
        "solar_terms": "白露", "remark": None, "status": "已通过",
    }


def seed():
    INGREDIENTS.clear()
    INGREDIENTS.update({
        10: make_ingredient(10),
        11: make_ingredient(11, name="莲藕", user_id=1),
    })
    DISHES.clear()
    DISHES.update({
        20: make_dish(20),
        21: make_dish(21, name="私房焖面", user_id=1),
    })
    USERS.clear()
    USERS.update({
        1: make_user(1, PHONE_USER),
        2: make_user(2, PHONE_OTHER),
        3: make_user(3, PHONE_ADMIN, role="admin"),
    })


@pytest.fixture()
def client():
    return app.test_client()


@pytest.fixture()
def fake_db(monkeypatch):
    seed()
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    monkeypatch.setattr(repository, "find_user_by_phone", lambda p: next(
        (u for u in USERS.values() if u["phone"] == p), None))
    monkeypatch.setattr(repository, "find_user_by_id", lambda i: USERS.get(i))

    def _update(table, row_id, fields):
        store = INGREDIENTS if table == "ingredient" else DISHES
        if row_id not in store:
            return False
        name = fields.get("name")
        if name and any(r["name"] == name for rid, r in store.items() if rid != row_id):
            raise IntegrityError(1062, "Duplicate entry")
        store[row_id].update(fields)
        return True

    def _delete(table, row_id):
        store = INGREDIENTS if table == "ingredient" else DISHES
        return store.pop(row_id, None) is not None

    monkeypatch.setattr(repository, "find_ingredient_by_id",
                        lambda i: INGREDIENTS.get(i))
    monkeypatch.setattr(repository, "update_ingredient",
                        lambda i, f: _update("ingredient", i, f))
    monkeypatch.setattr(repository, "delete_ingredient",
                        lambda i: _delete("ingredient", i))
    monkeypatch.setattr(repository, "find_dish_by_id", lambda i: DISHES.get(i))
    monkeypatch.setattr(repository, "update_dish",
                        lambda i, f: _update("dish", i, f))
    monkeypatch.setattr(repository, "delete_dish", lambda i: _delete("dish", i))


def token(client, phone=PHONE_USER):
    res = client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD})
    return res.get_json()["token"]


def send(client, method, path, tok=None, json=None):
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    return getattr(client, method)(path, headers=headers, json=json)


def test_detail_public_official_and_private_hidden(fake_db, client):
    assert client.get("/api/ingredients/10").get_json()["name"] == "山药"
    assert client.get("/api/ingredients/11").status_code == 404
    assert client.get("/api/dishes/20").get_json()["name"] == "凉拌鸡丝"
    assert client.get("/api/dishes/21").status_code == 404
    assert client.get("/api/ingredients/999").status_code == 404


def test_detail_private_visible_to_owner_and_admin(fake_db, client):
    owner, admin, other = token(client), token(client, PHONE_ADMIN), token(client, PHONE_OTHER)
    for path in ("/api/ingredients/11", "/api/dishes/21"):
        assert send(client, "get", path, owner).status_code == 200
        assert send(client, "get", path, admin).status_code == 200
        assert send(client, "get", path, other).status_code == 404


def test_patch_requires_login(fake_db, client):
    assert client.patch("/api/ingredients/10", json={"season_note": "秋季"}).status_code == 401
    assert send(client, "patch", "/api/ingredients/10", "not-a-jwt",
                json={"season_note": "秋季"}).status_code == 401


def test_patch_official_requires_admin(fake_db, client):
    denied = send(client, "patch", "/api/ingredients/10", token(client),
                  json={"season_note": "9-11月"})
    assert denied.status_code == 403
    ok = send(client, "patch", "/api/ingredients/10", token(client, PHONE_ADMIN),
              json={"season_note": "9-11月"})
    assert ok.status_code == 200
    assert ok.get_json()["season_note"] == "9-11月"
    assert INGREDIENTS[10]["season_note"] == "9-11月"


def test_patch_own_private_content(fake_db, client):
    ok = send(client, "patch", "/api/dishes/21", token(client),
              json={"benefits": "温补不上火"})
    assert ok.status_code == 200
    assert DISHES[21]["benefits"] == "温补不上火"


def test_patch_ingredient_rejects_unknown_status_and_bad_values(fake_db, client):
    tok = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/ingredients/10", tok,
                json={"status": "已通过"}).status_code == 400
    assert send(client, "patch", "/api/ingredients/10", tok,
                json={"user_id": 2}).status_code == 400
    assert send(client, "patch", "/api/ingredients/10", tok,
                json={"nature": "特温"}).status_code == 400
    assert send(client, "patch", "/api/ingredients/10", tok,
                json={"solar_terms": "小雪,立冬"}).status_code == 400
    assert send(client, "patch", "/api/ingredients/10", tok, json={}).status_code == 400


def test_patch_dish_rejects_bad_values(fake_db, client):
    tok = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/dishes/20", tok,
                json={"category": "私房菜"}).status_code == 400
    assert send(client, "patch", "/api/dishes/20", tok,
                json={"calories": 350}).status_code == 400
    assert send(client, "patch", "/api/dishes/20", tok,
                json={"name": " "}).status_code == 400
    ok = send(client, "patch", "/api/dishes/20", tok,
              json={"calories": "约420千卡", "image": "https://cdn.example/20.png"})
    assert ok.status_code == 200
    assert ok.get_json()["calories"] == "约420千卡"
    assert DISHES[20]["image"] == "https://cdn.example/20.png"


def test_patch_ingredient_image(fake_db, client):
    tok = token(client, PHONE_ADMIN)
    ok = send(client, "patch", "/api/ingredients/10", tok,
              json={"image": " https://cdn.example/shanyao.png "})
    assert ok.status_code == 200
    assert ok.get_json()["image"] == "https://cdn.example/shanyao.png"
    assert INGREDIENTS[10]["image"] == "https://cdn.example/shanyao.png"
    clear = send(client, "patch", "/api/ingredients/10", tok, json={"image": ""})
    assert clear.status_code == 200 and clear.get_json()["image"] is None
    bad = send(client, "patch", "/api/ingredients/10", tok, json={"image": 123})
    assert bad.status_code == 400


def test_patch_name_conflict_returns_409(fake_db, client):
    tok = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/ingredients/11", tok,
                json={"name": "山药"}).status_code == 409
    assert send(client, "patch", "/api/dishes/21", tok,
                json={"name": "凉拌鸡丝"}).status_code == 409


def test_patch_missing_returns_404(fake_db, client):
    tok = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/ingredients/99", tok,
                json={"season_note": "秋季"}).status_code == 404
    assert send(client, "patch", "/api/dishes/99", tok,
                json={"calories": "约1千卡"}).status_code == 404


def test_delete_hard_removes_row(fake_db, client):
    admin = token(client, PHONE_ADMIN)
    assert send(client, "delete", "/api/ingredients/10", admin).status_code == 200
    assert 10 not in INGREDIENTS
    assert client.get("/api/ingredients/10").status_code == 404
    assert send(client, "delete", "/api/dishes/20", admin).status_code == 200
    assert 20 not in DISHES


def test_delete_permission(fake_db, client):
    assert send(client, "delete", "/api/ingredients/10", token(client)).status_code == 403
    assert 10 in INGREDIENTS
    owner = token(client)
    assert send(client, "delete", "/api/ingredients/11", owner).status_code == 200
    assert 11 not in INGREDIENTS
    assert send(client, "delete", "/api/ingredients/11", owner).status_code == 404
