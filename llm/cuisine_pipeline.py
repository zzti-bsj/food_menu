from pymysql.err import IntegrityError

from llm.cuisine_chef import CuisineChef
from llm.cuisine_verify import CuisineVerifier
from shike import reject_log, repository
from shike.validate import validate_dish

CATEGORY = "美食大厨"
MODES = ("cuisine", "name", "ingredient")
_NAME_SEPARATORS = (",", "，", "、", "/", "|")


def validate_name_input(name) -> str | None:
    """菜名输入合法性校验,返回错误说明;None 即合法。"""
    cleaned = str(name or "").strip()
    if not cleaned:
        return "菜名不能为空"
    if len(cleaned) > 100:
        return "菜名过长(>100字)"
    if any(sep in cleaned for sep in _NAME_SEPARATORS):
        return "菜名只能是单个菜名,不能包含逗号、顿号、斜杠等分隔符"
    return None


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
        "story": record.get("story"),
        "style": record["style"],
        "solar_terms": record["solar_terms"],
        "remark": remark,
    }


class CuisinePipeline:
    """美食大厨入库流水线:三模式生成 → 结构与值域校验 → 正宗/安全核验 → 入库(待审核);未过可带反馈修订重试。"""

    def __init__(
        self,
        chef: CuisineChef | None = None,
        verifier: CuisineVerifier | None = None,
        max_revisions: int = 3,
    ):
        self.chef = chef or CuisineChef()
        self.verifier = verifier or CuisineVerifier()
        self.max_revisions = max_revisions

    def run(self, mode: str, payload: dict, user_id: int | None = None) -> dict:
        """跑完整流程;stage 取值 inserted/rejected/invalid/duplicate/invalid_input/not_found。"""
        if mode not in MODES:
            return {"stage": "invalid_input", "reason": f"未知模式:{mode}"}

        if mode == "name":
            reason = validate_name_input(payload.get("name"))
            if reason:
                return {"stage": "invalid_input", "reason": reason}
            name = str(payload["name"]).strip()
            if repository.find_dish_by_name(name, owner=user_id):
                return {"stage": "duplicate", "name": name}
            payload = {"name": name}
        elif mode == "cuisine":
            cuisine = str(payload.get("cuisine") or "").strip()
            if cuisine not in self.chef.vocab.cuisines:
                return {"stage": "invalid_input", "reason": f"菜系「{cuisine}」不在菜系词表中"}
            payload = {"cuisine": cuisine}
        else:
            raw = payload.get("ingredients")
            if (
                not isinstance(raw, list)
                or not raw
                or not all(isinstance(i, str) and i.strip() for i in raw)
            ):
                return {"stage": "invalid_input", "reason": "ingredients 须为非空字符串数组"}
            payload = {"ingredients": list(dict.fromkeys(i.strip() for i in raw))}

        ingredients = payload.get("ingredients", [])
        pantry = (
            repository.find_ingredients_by_names(ingredients, owner=user_id)
            if ingredients
            else []
        )
        known_names = (
            repository.list_dish_names_by_cuisine(payload["cuisine"], owner=user_id)
            if mode == "cuisine"
            else None
        )
        context = payload.get("cuisine") or payload.get("name") or ingredients
        feedback = None
        last: dict = {"stage": "invalid", "errors": ["流水线未产出结果"]}

        for _ in range(1 + self.max_revisions):
            try:
                record = self.chef.create(
                    mode, payload, feedback=feedback, pantry=pantry, known_names=known_names
                )
            except ValueError as exc:
                feedback = [str(exc)]
                last = {"stage": "invalid", "errors": feedback}
                continue

            if record.get("not_found"):
                reason = str(record.get("reason") or "无法确认这道菜")
                reject_log.log_reject(
                    payload.get("name") or record.get("name") or "?",
                    "not_found", [reason], entity="美食大厨",
                )
                return {"stage": "not_found", "reason": reason,
                        "name": payload.get("name") or record.get("name")}

            record["category"] = CATEGORY
            errors = validate_dish(record, self.chef.vocab, cuisines=self.chef.vocab.cuisines)
            if not str(record.get("story") or "").strip():
                errors.append("story: 必填(风味与文化背景)")
            if mode == "cuisine":
                first = str(record.get("style") or "").split(",")[0].strip()
                if first != payload["cuisine"]:
                    errors.append(f"style: 菜系位须为「{payload['cuisine']}」,当前「{first}」")
            if mode != "ingredient" and record.get("excluded"):
                errors.append("excluded: 本模式不应弃置食材,须为空数组")
            if errors:
                feedback = errors
                last = {"stage": "invalid", "errors": errors,
                        "name": record.get("name"), "excluded": record.get("excluded", [])}
                continue

            verdict, problems = self.verifier.verify(record, mode, context)
            if verdict == "pass":
                return self._insert(mode, record, None, user_id)
            if verdict == "存疑":
                result = self._insert(mode, record, "\n".join(problems), user_id)
                if result["stage"] == "inserted":
                    result["doubts"] = problems
                    reject_log.log_reject(record["name"], "存疑", problems, entity="美食大厨")
                return result
            feedback = problems
            last = {"stage": "rejected", "problems": problems,
                    "name": record.get("name"), "excluded": record.get("excluded", [])}

        last["ingredients"] = ingredients
        last["mode"] = mode
        name_for_log = (
            last.get("name")
            or payload.get("name")
            or payload.get("cuisine")
            or ",".join(payload.get("ingredients", []))
        )
        reject_log.log_reject(
            name_for_log,
            last["stage"],
            last.get("errors") or last.get("problems") or [],
            entity="美食大厨",
        )
        return last

    def _insert(self, mode: str, record: dict, remark: str | None, user_id: int | None = None) -> dict:
        db = to_db_record(record, remark)
        try:
            repository.insert_dish(db, user_id)
        except IntegrityError:
            return {"stage": "duplicate", "name": record.get("name")}
        return {
            "mode": mode,
            "stage": "inserted",
            "name": record["name"],
            "dish": db,
            "excluded": record.get("excluded", []),
            "story": record.get("story"),
        }
