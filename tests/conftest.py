import pytest

from shike import repository


@pytest.fixture(autouse=True)
def _no_reject_log(monkeypatch):
    """单测不写判否日志表。"""
    monkeypatch.setattr(repository, "insert_reject_log", lambda *args: None)
