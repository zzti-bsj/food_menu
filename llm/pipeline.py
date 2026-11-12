from pymysql.err import IntegrityError

from llm.fill import IngredientFiller
from llm.verify import IngredientVerifier
from shike import repository
from shike.validate import validate_ingredient


class IngredientPipeline:
    """食材入库流水线:填充 → 结构与值域校验 → 事实核验 → 入库(待审核);未过可带反馈修订重试。"""

    def __init__(
        self,
        filler: IngredientFiller | None = None,
        verifier: IngredientVerifier | None = None,
        max_revisions: int = 3,
    ):
        self.filler = filler or IngredientFiller()
        self.verifier = verifier or IngredientVerifier()
        self.max_revisions = max_revisions

    def run(self, name: str, user_id: int | None = None) -> dict:
        """跑完整流程;stage 取值 inserted / invalid / rejected / duplicate;存疑入库附 doubts。"""
        feedback = None
        last = {"stage": "invalid", "errors": ["流水线未产出结果"]}
        for _ in range(1 + self.max_revisions):
            try:
                record = self.filler.fill(name, feedback=feedback)
            except ValueError as exc:
                feedback = [str(exc)]
                last = {"stage": "invalid", "errors": feedback}
                continue

            errors = validate_ingredient(record, self.filler.vocab)
            if errors:
                feedback = errors
                last = {"stage": "invalid", "errors": errors}
                continue

            verdict, problems = self.verifier.verify(record)
            if verdict == "pass":
                return self._insert(name, record, user_id)
            if verdict == "存疑":
                result = self._insert(name, record, user_id)
                if result["stage"] == "inserted":
                    result["doubts"] = problems
                return result
            feedback = problems
            last = {"stage": "rejected", "problems": problems}

        last["name"] = name
        return last

    def _insert(self, name: str, record: dict, user_id: int | None = None) -> dict:
        try:
            repository.insert_ingredient(record, user_id)
        except IntegrityError:
            return {"name": name, "stage": "duplicate"}
        return {"name": name, "stage": "inserted"}
