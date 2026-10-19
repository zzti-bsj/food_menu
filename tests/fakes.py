import json


class FakeJSONClient:
    """按脚本回放固定输出的假客户端,记录最后一次请求供断言;response 传列表则依次弹出。"""

    def __init__(self, response):
        self.responses = [response] if isinstance(response, str) else list(response)
        self.last_user = ""
        self.calls = 0

    def _next(self) -> str:
        if len(self.responses) > 1:
            return self.responses.pop(0)
        return self.responses[0]

    def chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        self.last_user = user
        return self._next()

    def chat_json(self, system: str, user: str, temperature: float = 0.2) -> dict:
        self.last_user = user
        self.calls += 1
        return json.loads(self._next())
