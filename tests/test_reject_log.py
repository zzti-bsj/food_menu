import json

from shike import reject_log
from shike.reject_log import log_reject  # 收集期绑定原函数,规避 conftest 的全量 patch


def test_log_reject_appends_jsonl_with_entity(monkeypatch, tmp_path):
    monkeypatch.setattr(reject_log, "LOG_FILE", tmp_path / "reject_log.jsonl")

    log_reject("山药", "rejected", ["归经不符"])
    log_reject("清炖萝卜汤", "存疑", ["热量与分量疑似不符"], entity="菜品")

    first, second = (json.loads(line) for line in
                     (tmp_path / "reject_log.jsonl").read_text(encoding="utf-8").splitlines())
    assert first["name"] == "山药" and first["entity"] == "食材"
    assert second["name"] == "清炖萝卜汤" and second["entity"] == "菜品"
    assert second["detail"] == ["热量与分量疑似不符"]
    assert first["created_at"] and second["created_at"]
