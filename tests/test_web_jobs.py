"""异步作业端点:POST /api/jobs + GET /api/jobs/<id>(移动端生成改走这里)。
作业在后台线程执行,快照完成后保留 TTL;同参在途复用;归属作业仅本人/admin 可读。"""
import threading
import time

import pytest

import web.app as web_app
from tests.test_web_auth import PHONE_ADMIN, fake_users, login
from web.app import app


@pytest.fixture()
def client():
    return app.test_client()


class FakeInstantPipeline:
    """立即完成的假流水线:校验 run() 的入参转发与结果透传。"""

    def __init__(self):
        self.calls = []

    def run(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return {"ok": True, "args": args, "kwargs": kwargs}


@pytest.fixture(autouse=True)
def _clean_jobs():
    web_app._JOBS.clear()
    yield
    web_app._JOBS.clear()


def wait_done(client, job_id, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        res = client.get(f"/api/jobs/{job_id}")
        if res.status_code == 200 and res.get_json()["status"] != "running":
            return res
        time.sleep(0.01)
    raise AssertionError("作业未在超时内完成")


def test_create_job_rejects_bad_kind_and_payload(client):
    assert client.post("/api/jobs", json={"kind": "nope", "payload": {}}).status_code == 400
    assert client.post("/api/jobs", json={"kind": "batch"}).status_code == 400
    assert client.post("/api/jobs", json={"kind": "batch", "payload": {"term": "不是节气"}}).status_code == 400
    assert client.post("/api/jobs", json={"kind": "dish", "payload": {"ingredients": "莲藕"}}).status_code == 400


def test_job_batch_roundtrip(monkeypatch, client):
    fake = FakeInstantPipeline()
    monkeypatch.setattr(web_app, "IngredientBatchPipeline", lambda: fake)
    res = client.post("/api/jobs", json={"kind": "batch", "payload": {"term": "白露"}})
    assert res.status_code == 202
    job_id = res.get_json()["job_id"]
    done = wait_done(client, job_id)
    assert done.get_json() == {
        "status": "done",
        "result": {"ok": True, "args": ["白露"], "kwargs": {"user_id": None}},
    }


def test_job_dish_validation_parity(client):
    """与同步端点同一套校验:厨师/食材线入参非法一律 400。"""
    assert client.post("/api/jobs", json={"kind": "dish", "payload": {"ingredients": []}}).status_code == 400
    assert client.post("/api/jobs", json={"kind": "dish", "payload": {"ingredients": ["", " "]}}).status_code == 400


def test_job_dish_cuisine_roundtrip(monkeypatch, client):
    fake = FakeInstantPipeline()
    monkeypatch.setattr(web_app, "CuisinePipeline", lambda: fake)
    res = client.post(
        "/api/jobs",
        json={"kind": "dish", "payload": {"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"}},
    )
    done = wait_done(client, res.get_json()["job_id"])
    payload = done.get_json()["result"]
    assert payload["args"][0] == "name"
    assert payload["args"][1] == {"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"}


def test_job_dedupes_running_same_payload(monkeypatch, client):
    """同参数在途作业复用同一 job_id;完成后不再复用。"""
    release = threading.Event()

    class FakeBlocked:
        def run(self, term, user_id=None):
            release.wait(5)
            return {"term": term}

    monkeypatch.setattr(web_app, "IngredientBatchPipeline", FakeBlocked)
    body = {"kind": "batch", "payload": {"term": "白露"}}
    first = client.post("/api/jobs", json=body).get_json()["job_id"]
    second = client.post("/api/jobs", json=body).get_json()["job_id"]
    assert first == second
    release.set()
    wait_done(client, first)
    third = client.post("/api/jobs", json=body).get_json()["job_id"]
    assert third != first


def test_job_owner_scope(monkeypatch, client, fake_users):
    """归属作业仅本人/admin 可读;匿名作业人人可读。"""
    fake = FakeInstantPipeline()
    monkeypatch.setattr(web_app, "IngredientBatchPipeline", lambda: fake)
    user_token = login(client).get_json()["token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    body = {"kind": "batch", "payload": {"term": "白露"}}

    owned = client.post("/api/jobs", json=body, headers=user_headers).get_json()["job_id"]
    assert client.get(f"/api/jobs/{owned}").status_code == 403
    other = client.post("/api/auth/register", json={"phone": "13800000004", "password": "pass123"})
    other_headers = {"Authorization": f"Bearer {other.get_json()['token']}"}
    assert client.get(f"/api/jobs/{owned}", headers=other_headers).status_code == 403
    admin_headers = {"Authorization": f"Bearer {login(client, PHONE_ADMIN).get_json()['token']}"}
    assert client.get(f"/api/jobs/{owned}", headers=admin_headers).status_code == 200

    anon = client.post("/api/jobs", json=body).get_json()["job_id"]
    assert client.get(f"/api/jobs/{anon}", headers=other_headers).status_code == 200


def test_job_unknown_id_404(client):
    assert client.get("/api/jobs/does-not-exist").status_code == 404
