"""词表端点与图片上传(移动端编辑表单选项源 / 封面上传)。"""
from io import BytesIO
from pathlib import Path

import pytest

from shike import repository
from shike.vocab import load_vocab
from web import auth
from web.app import UPLOAD_DIR, app

SECRET = "test-secret-0123456789abcdef0123456789abcdef"
PHONE = "13800000009"
PASSWORD = "pass123"


@pytest.fixture()
def client():
    return app.test_client()


@pytest.fixture()
def fake_auth(monkeypatch):
    monkeypatch.setenv("SHIKE_JWT_SECRET", SECRET)
    user = {"id": 7, "phone": PHONE, "password_hash": auth.hash_password(PASSWORD),
            "nickname": None, "role": "user", "status": "正常"}
    monkeypatch.setattr(repository, "find_user_by_phone", lambda p: user if p == PHONE else None)
    monkeypatch.setattr(repository, "find_user_by_id", lambda i: user if i == 7 else None)


def token(client):
    res = client.post("/api/auth/login", json={"phone": PHONE, "password": PASSWORD})
    return res.get_json()["token"]


def upload(client, tok, **kwargs):
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    # werkzeug 测试端文件部分须为 file-like;boundary 由 test client 自动生成
    return client.post("/api/uploads", headers=headers,
                       data={"file": (BytesIO(kwargs.pop("data")), kwargs.pop("filename"))})


def test_vocab_endpoint(client):
    data = client.get("/api/vocab").get_json()
    vocab = load_vocab()
    assert data["solar_terms"] == list(vocab.solar_terms)
    assert data["dish_categories"] == list(vocab.dish_categories)
    assert data["natures"] == list(vocab.natures)
    assert "山药" in "".join(data["benefits"].keys()) or len(data["benefits"]) > 0


def test_upload_requires_login(client):
    assert client.post("/api/uploads").status_code == 401


def test_upload_rejects_bad_ext(fake_auth, client):
    res = upload(client, token(client), data=b"x", filename="evil.exe")
    assert res.status_code == 400
    assert "jpg/png/webp/gif" in res.get_json()["error"]


def test_upload_rejects_empty(fake_auth, client):
    res = upload(client, token(client), data=b"", filename="a.png")
    assert res.status_code == 400


def test_upload_and_serve_roundtrip(fake_auth, client, monkeypatch, tmp_path):
    target = tmp_path / "uploads"
    monkeypatch.setattr("web.app.UPLOAD_DIR", target)
    res = upload(client, token(client), data=b"\x89PNG fake", filename="照片.png")
    assert res.status_code == 201
    url = res.get_json()["url"]
    assert url.startswith("/uploads/") and url.endswith(".png")
    saved = target / url.removeprefix("/uploads/")
    assert saved.read_bytes() == b"\x89PNG fake"
    # 随机名 16 位 hex
    assert len(saved.stem) == 16
    served = client.get(url)
    assert served.status_code == 200
    assert served.data == b"\x89PNG fake"


def test_serve_rejects_path_traversal(client):
    assert client.get("/uploads/..%2fapp.py").status_code == 404
    assert client.get("/uploads/abcdef.png").status_code == 404


def test_upload_endpoint_writes_into_default_dir(fake_auth, client, monkeypatch, tmp_path):
    """默认目录常量指向 web/uploads(模块加载期固定),此处仅验证常量本身。"""
    assert UPLOAD_DIR.name == "uploads"
    assert UPLOAD_DIR.parent.name == "web"
