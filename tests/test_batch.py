from llm.batch import IngredientBatchPipeline
from shike import reject_log


class FakeRecommender:
    def __init__(self, names):
        self.names = names

    def recommend(self, term: str, user_id: int | None = None) -> list[str]:
        return list(self.names)


class FakePipeline:
    """按名字脚本化各阶段结果。"""

    results: dict[str, dict] = {}

    def run(self, name: str, user_id: int | None = None) -> dict:
        return self.results[name]


def make_batch(names, results):
    FakePipeline.results = results
    return IngredientBatchPipeline(
        recommender=FakeRecommender(names),
        pipeline_factory=FakePipeline,
    )


def test_batch_collects_inserted_and_failed():
    batch = make_batch(
        ["莲藕", "菱角", "芋头"],
        {
            "莲藕": {"name": "莲藕", "stage": "inserted"},
            "菱角": {"name": "菱角", "stage": "rejected", "problems": ["功效无据"]},
            "芋头": {"name": "芋头", "stage": "duplicate"},
        },
    )
    result = batch.run("白露")
    assert result["term"] == "白露"
    assert result["recommended"] == ["莲藕", "菱角", "芋头"]
    assert result["inserted"] == ["莲藕"]
    assert [f["stage"] for f in result["failed"]] == ["rejected", "duplicate"]


def test_batch_dedups_recommendations():
    batch = make_batch(
        ["山药", "山药", "莲藕"],
        {
            "山药": {"name": "山药", "stage": "inserted"},
            "莲藕": {"name": "莲藕", "stage": "inserted"},
        },
    )
    result = batch.run("霜降")
    assert result["recommended"] == ["山药", "莲藕"]
    assert result["failed"] == []


def test_batch_empty_recommendation():
    batch = make_batch([], {})
    result = batch.run("大寒")
    assert result == {
        "term": "大寒", "recommended": [], "inserted": [], "doubts": {}, "failed": [],
    }


def test_batch_logs_invalid_and_rejected_but_not_duplicate(monkeypatch):
    logged = []
    monkeypatch.setattr(
        reject_log, "log_reject", lambda n, s, d: logged.append((n, s, d))
    )
    batch = make_batch(
        ["莲藕", "菱角", "芋头"],
        {
            "莲藕": {"name": "莲藕", "stage": "invalid", "errors": ["nature 超出值域"]},
            "菱角": {"name": "菱角", "stage": "rejected", "problems": ["功效无据"]},
            "芋头": {"name": "芋头", "stage": "duplicate"},
        },
    )
    batch.run("白露")
    assert logged == [
        ("莲藕", "invalid", ["nature 超出值域"]),
        ("菱角", "rejected", ["功效无据"]),
    ]


def test_batch_collects_and_logs_doubts(monkeypatch):
    logged = []
    monkeypatch.setattr(reject_log, "log_reject", lambda n, s, d: logged.append((n, s, d)))
    batch = make_batch(
        ["山药", "莲藕"],
        {
            "山药": {"name": "山药", "stage": "inserted", "doubts": ["性味文献分歧"]},
            "莲藕": {"name": "莲藕", "stage": "inserted"},
        },
    )
    result = batch.run("霜降")
    assert result["inserted"] == ["山药", "莲藕"]
    assert result["doubts"] == {"山药": ["性味文献分歧"]}
    assert result["failed"] == []
    assert logged == [("山药", "存疑", ["性味文献分歧"])]
