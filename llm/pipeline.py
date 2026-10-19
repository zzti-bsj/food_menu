from pymysql.err import IntegrityError

from llm.fill import IngredientFiller
from llm.verify import IngredientVerifier
from shike import repository
from shike.validate import validate_ingredient


class IngredientPipeline:
    """食材入库流水线:填充 → 结构与值域校验 → 事实核验 → 入库(待审核)。"""

    def __init__(
        self,
        filler: IngredientFiller | None = None,
        verifier: IngredientVerifier | None = None,
    ):
        self.filler = filler or IngredientFiller()
        self.verifier = verifier or IngredientVerifier()

    def run(self, name: str) -> dict:
        """跑完整流程;stage 取值 inserted / invalid / rejected / duplicate。"""
        try:
            record = self.filler.fill(name)
        except ValueError as exc:
            return {"name": name, "stage": "invalid", "errors": [str(exc)]}

        errors = validate_ingredient(record, self.filler.vocab)
        if errors:
            return {"name": name, "stage": "invalid", "errors": errors}

        passed, problems = self.verifier.verify(record)
        if not passed:
            return {"name": name, "stage": "rejected", "problems": problems}

        try:
            repository.insert_ingredient(record)
        except IntegrityError:
            return {"name": name, "stage": "duplicate"}
        return {"name": name, "stage": "inserted"}
