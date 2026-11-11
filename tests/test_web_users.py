import pytest

from shike import repository
from web import auth
from web.app import app

SECRET = "test-secret-0123456789abcdef0123456789abcdef"
PHONE_USER, PHONE_ADMIN, PHONE_OTHER = "13800000001", "13800000003", "13800000004"
PASSWORD = "pass123"

USERS: dict = {}
OWNS: dict = {}


def make_user(uid, phone, role="user", status="正常"):
    return {
        "id": uid, "phone": phone, "password_hash": auth.hash_password(PASSWORD),
        "nickname": None, "role": role, "status": status,
    }


def seed():
    USERS.clear()
    USERS.update({
        1: make_user(1, PHONE_USER),
        3: make_user(3, PHONE_ADMIN, role="admin"),
        4: make_user(4, PHONE_OTHER),
    })
    OWNS.clear()
    OWNS.update({1: True, 3: False, 4: False})


@pytest.fixture()
def client():
    return app.test_client()


@pytest.fixture()
def fake_users(monkeypatch):
    seed()
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    monkeypatch.setattr(repository, "find_user_by_phone", lambda p: next(
        (u for u in USERS.values() if u["phone"] == p), None))
    monkeypatch.setattr(repository, "find_user_by_id", lambda i: USERS.get(i))
    monkeypatch.setattr(repository, "list_users",
                        lambda: [USERS[i] for i in sorted(USERS)])

    def _update_user(user_id, fields):
        if user_id not in USERS:
            return False
        allowed = ("nickname", "role", "status", "password_hash")
        USERS[user_id].update({k: v for k, v in fields.items() if k in allowed})
        return True

    monkeypatch.setattr(repository, "update_user", _update_user)
    monkeypatch.setattr(repository, "user_owns_content", lambda i: OWNS.get(i, False))
    monkeypatch.setattr(repository, "delete_user",
                        lambda i: USERS.pop(i, None) is not None)


def token(client, phone=PHONE_USER):
    res = client.post("/api/auth/login", json={"phone": phone, "password": PASSWORD})
    return res.get_json()["token"]


def send(client, method, path, tok=None, json=None):
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    return getattr(client, method)(path, headers=headers, json=json)


def test_users_list_requires_admin(fake_users, client):
    assert client.get("/api/users").status_code == 401
    assert send(client, "get", "/api/users", token(client)).status_code == 403
    ok = send(client, "get", "/api/users", token(client, PHONE_ADMIN))
    assert ok.status_code == 200
    users = ok.get_json()
    assert [u["id"] for u in users] == [1, 3, 4]
    assert all("password_hash" not in u for u in users)


def test_patch_user_status_and_role(fake_users, client):
    admin = token(client, PHONE_ADMIN)
    ok = send(client, "patch", "/api/users/1", admin, json={"status": "禁用"})
    assert ok.status_code == 200 and ok.get_json()["user"]["status"] == "禁用"
    assert USERS[1]["status"] == "禁用"
    ok = send(client, "patch", "/api/users/1", admin, json={"role": "admin"})
    assert ok.status_code == 200 and USERS[1]["role"] == "admin"


def test_patch_user_rejects_bad_input(fake_users, client):
    admin = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/users/1", admin, json={"status": "封号"}).status_code == 400
    assert send(client, "patch", "/api/users/1", admin, json={"role": "root"}).status_code == 400
    assert send(client, "patch", "/api/users/1", admin, json={"phone": "13900000000"}).status_code == 400
    assert send(client, "patch", "/api/users/1", admin, json={"nickname": "字" * 51}).status_code == 400
    assert send(client, "patch", "/api/users/1", admin, json={}).status_code == 400
    assert send(client, "patch", "/api/users/99", admin, json={"status": "禁用"}).status_code == 404


def test_patch_user_self_guard(fake_users, client):
    admin = token(client, PHONE_ADMIN)
    assert send(client, "patch", "/api/users/3", admin, json={"status": "禁用"}).status_code == 400
    assert send(client, "patch", "/api/users/3", admin, json={"role": "user"}).status_code == 400


def test_delete_user_guards(fake_users, client):
    admin = token(client, PHONE_ADMIN)
    assert send(client, "delete", "/api/users/3", admin).status_code == 400
    assert send(client, "delete", "/api/users/1", admin).status_code == 409
    assert 1 in USERS
    assert send(client, "delete", "/api/users/4", admin).status_code == 200
    assert 4 not in USERS
    assert send(client, "delete", "/api/users/4", admin).status_code == 404


def test_me_patch_nickname(fake_users, client):
    tok = token(client)
    ok = send(client, "patch", "/api/auth/me", tok, json={"nickname": "阿明"})
    assert ok.status_code == 200 and ok.get_json()["user"]["nickname"] == "阿明"
    assert USERS[1]["nickname"] == "阿明"
    assert send(client, "patch", "/api/auth/me", tok, json={"nickname": ""}).status_code == 400
    assert send(client, "patch", "/api/auth/me", tok,
                json={"nickname": "字" * 51}).status_code == 400
    assert send(client, "patch", "/api/auth/me", tok, json={}).status_code == 400
    assert send(client, "patch", "/api/auth/me", tok,
                json={"current_password": PASSWORD}).status_code == 400
    assert send(client, "patch", "/api/auth/me", tok,
                json={"phone": "13900000000"}).status_code == 400


def test_me_patch_password(fake_users, client):
    tok = token(client)
    assert send(client, "patch", "/api/auth/me", tok,
                json={"password": "newpass1"}).status_code == 403
    assert send(client, "patch", "/api/auth/me", tok,
                json={"password": "newpass1", "current_password": "wrong!"}).status_code == 403
    assert send(client, "patch", "/api/auth/me", tok,
                json={"password": "12345", "current_password": PASSWORD}).status_code == 400
    ok = send(client, "patch", "/api/auth/me", tok,
              json={"password": "newpass1", "current_password": PASSWORD})
    assert ok.status_code == 200 and "password_hash" not in ok.get_json()["user"]
    relogin = client.post("/api/auth/login",
                          json={"phone": PHONE_USER, "password": "newpass1"})
    assert relogin.status_code == 200


def test_me_patch_requires_login(fake_users, client):
    assert client.patch("/api/auth/me", json={"nickname": "阿明"}).status_code == 401
