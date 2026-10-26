import pytest

from shike import reject_log


@pytest.fixture(autouse=True)
def _no_reject_log(monkeypatch):
    """单测不写判否日志文件。"""
    monkeypatch.setattr(reject_log, "log_reject", lambda *args, **kwargs: None)
