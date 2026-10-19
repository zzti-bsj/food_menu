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
