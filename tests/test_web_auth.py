import time

import jwt as pyjwt
import pytest

from shike import repository
from web import auth
from web.app import app

SECRET = "test-secret-0123456789abcdef0123456789abcdef"

PHONE_OK, PHONE_DISABLED, PHONE_ADMIN = "13800000001", "13800000002", "13800000003"
PASSWORD = "pass123"


def make_user(uid, phone, role="user", status="正常"):
    return {
        "id": uid, "phone": phone, "password_hash": auth.hash_password(PASSWORD),
        "nickname": None, "role": role, "status": status,
    }


USERS = {
    1: make_user(1, PHONE_OK),
    2: make_user(2, PHONE_DISABLED, status="禁用"),
    3: make_user(3, PHONE_ADMIN, role="admin"),
}


@pytest.fixture()
def client():
    return app.test_client()


@pytest.fixture()
def fake_users(monkeypatch):
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    monkeypatch.setattr(repository, "find_user_by_phone", lambda p: next(
        (u for u in USERS.values() if u["phone"] == p), None))
    monkeypatch.setattr(repository, "find_user_by_id", lambda i: USERS.get(i))
    inserted = []

    def _insert(record):
        if any(u["phone"] == record["phone"] for u in USERS.values()):
            from pymysql.err import IntegrityError
            raise IntegrityError(1062, "Duplicate entry")
        record = {**make_user(len(USERS) + 1, record["phone"]), **record}
        USERS[record["id"]] = record
        inserted.append(record)

    monkeypatch.setattr(repository, "insert_user", _insert)
    return inserted


def register(client, phone=PHONE_OK, password=PASSWORD):
    return client.post("/api/auth/register", json={"phone": phone, "password": password})


def login(client, phone=PHONE_OK, password=PASSWORD):
    return client.post("/api/auth/login", json={"phone": phone, "password": password})


def bearer(client, path, token):
    return client.get(path, headers={"Authorization": f"Bearer {token}"})


def test_register_success_returns_token_pair_and_user(fake_users, client):
    res = register(client, phone="13900000009")
    assert res.status_code == 201
    body = res.get_json()
    assert body["user"]["phone"] == "13900000009" and body["user"]["role"] == "user"
    assert "password_hash" not in body["user"]
    me = bearer(client, "/api/auth/me", body["token"])
    assert me.status_code == 200 and me.get_json()["user"]["phone"] == "13900000009"


def test_register_rejects_bad_phone_and_short_password(fake_users, client):
    for bad in ("12345", "23800000001", "1380000000a", ""):
        assert register(client, phone=bad).status_code == 400, bad
    assert register(client, password="12345").status_code == 400


def test_register_rejects_duplicate_phone(fake_users, client):
    fresh = "13911112222"
    assert register(client, phone=fresh).status_code == 201
    assert register(client, phone=fresh).status_code == 409


def test_login_success_and_wrong_password(fake_users, client):
    ok = login(client)
    assert ok.status_code == 200
    assert ok.get_json()["token"] and ok.get_json()["refresh_token"]
    assert login(client, password="wrong!").status_code == 401
    assert login(client, phone="13800009999").status_code == 401


def test_login_rejects_disabled_user(fake_users, client):
    assert login(client, phone=PHONE_DISABLED).status_code == 401


def test_refresh_rotates_token_pair(fake_users, client):
    tokens = login(client).get_json()
    res = client.post("/api/auth/refresh",
                      headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["token"] and body["refresh_token"]
    me = bearer(client, "/api/auth/me", body["token"])
    assert me.status_code == 200


def test_refresh_rejects_access_token(fake_users, client):
    tokens = login(client).get_json()
    res = client.post("/api/auth/refresh",
                      headers={"Authorization": f"Bearer {tokens['token']}"})
    assert res.status_code == 401


def test_refresh_rejects_expired_token(fake_users, client, monkeypatch):
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    now = int(time.time())
    expired = pyjwt.encode(
        {"sub": 1, "type": "refresh", "iat": now - 3600, "exp": now - 60},
        SECRET, algorithm="HS256",
    )
    res = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401


def test_me_requires_token(fake_users, client):
    assert bearer(client, "/api/auth/me", "").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert bearer(client, "/api/auth/me", "not-a-jwt").status_code == 401


def test_me_rejects_forged_secret(fake_users, client, monkeypatch):
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    forged = pyjwt.encode({"sub": 1, "type": "access", "role": "admin",
                           "iat": int(time.time()), "exp": int(time.time()) + 60},
                          "attacker-secret", algorithm="HS256")
    assert bearer(client, "/api/auth/me", forged).status_code == 401


def test_me_rejects_refresh_token_as_access(fake_users, client):
    tokens = login(client).get_json()
    assert bearer(client, "/api/auth/me", tokens["refresh_token"]).status_code == 401


def test_require_admin(fake_users, client):
    from flask import jsonify

    admin = login(client, phone=PHONE_ADMIN).get_json()
    user = login(client).get_json()

    @auth.require_admin
    def only():
        return jsonify(ok=True)

    def run_with(token):
        with app.test_request_context(headers={"Authorization": f"Bearer {token}"}):
            res = only()
        return res.status_code if hasattr(res, "status_code") else res[1]

    assert run_with(user["token"]) == 403
    assert run_with(admin["token"]) == 200
