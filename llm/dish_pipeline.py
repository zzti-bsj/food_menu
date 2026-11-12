from pymysql.err import IntegrityError

from llm.chef import DishChef
from llm.dish_verify import DishVerifier
from shike import reject_log, repository
from shike.validate import validate_dish

CATEGORY = "健康厨师"


def to_db_record(record: dict, remark: str | None) -> dict:
    """把模型输出的嵌套菜谱 JSON 拼平为 dish 表的纯文本字段。"""
    mains = ",".join(f"{i['name']} {i['amount']}" for i in record["main_ingredients"])
    extras = ",".join(f"{i['name']} {i['amount']}" for i in record.get("extras") or [])
    steps = "\n".join(f"{n}. {s}" for n, s in enumerate(record["steps"], 1))
    return {
        "name": record["name"],
        "category": CATEGORY,
        "main_ingredients": mains,
        "extras": extras or None,
        "steps": steps,
        "calories": f"约{record['calories']}千卡",
        "benefits": record["benefits"],
        "caution": record.get("caution"),
        "style": record["style"],
        "solar_terms": record["solar_terms"],
        "remark": remark,
    }


class DishPipeline:
    """菜品入库流水线:生成 → 结构与值域校验 → 相克/安全核验 → 入库(待审核);未过可带反馈修订重试。"""

    def __init__(
        self,
        chef: DishChef | None = None,
        verifier: DishVerifier | None = None,
        max_revisions: int = 3,
    ):
        self.chef = chef or DishChef()
        self.verifier = verifier or DishVerifier()
        self.max_revisions = max_revisions

    def run(self, ingredients: list[str], user_id: int | None = None) -> dict:
        """跑完整流程;stage 取值 inserted / rejected / invalid / duplicate;存疑入库附 doubts。"""
        ingredients = list(dict.fromkeys(ingredients))
        pantry = repository.find_ingredients_by_names(ingredients, owner=user_id)
        feedback = None
        last: dict = {"stage": "invalid", "errors": ["流水线未产出结果"]}

        for _ in range(1 + self.max_revisions):
            try:
                record = self.chef.create(ingredients, feedback=feedback, pantry=pantry)
            except ValueError as exc:
                feedback = [str(exc)]
                last = {"stage": "invalid", "errors": feedback}
                continue

            record["category"] = CATEGORY
            errors = validate_dish(record, self.chef.vocab)
            if errors:
                feedback = errors
                last = {"stage": "invalid", "errors": errors,
                        "name": record.get("name"), "excluded": record.get("excluded", [])}
                continue

            verdict, problems = self.verifier.verify(record, ingredients)
            if verdict == "pass":
                return self._insert(ingredients, record, None, user_id)
            if verdict == "存疑":
                result = self._insert(ingredients, record, "\n".join(problems), user_id)
                if result["stage"] == "inserted":
                    result["doubts"] = problems
                    reject_log.log_reject(record["name"], "存疑", problems, entity="菜品")
                return result
            feedback = problems
            last = {"stage": "rejected", "problems": problems,
                    "name": record.get("name"), "excluded": record.get("excluded", [])}

        last["ingredients"] = ingredients
        reject_log.log_reject(
            last.get("name") or ",".join(ingredients), last["stage"],
            last.get("errors") or last.get("problems") or [], entity="菜品",
        )
        return last

    def _insert(self, ingredients: list[str], record: dict, remark: str | None, user_id: int | None = None) -> dict:
        db = to_db_record(record, remark)
        try:
            repository.insert_dish(db, user_id)
        except IntegrityError:
            return {"ingredients": ingredients, "stage": "duplicate", "name": record.get("name")}
        return {
            "ingredients": ingredients,
            "stage": "inserted",
            "name": record["name"],
            "dish": db,
            "excluded": record.get("excluded", []),
        }
