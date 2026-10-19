import json


class FakeJSONClient:
    """按脚本回放固定输出的假客户端,记录最后一次请求供断言。"""

    def __init__(self, response: str):
        self.response = response
        self.last_user = ""

    def chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        self.last_user = user
        return self.response

    def chat_json(self, system: str, user: str, temperature: float = 0.2) -> dict:
        self.last_user = user
        return json.loads(self.response)
