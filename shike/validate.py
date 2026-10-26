from shike.vocab import Vocab

REQUIRED_FIELDS = ("name", "category", "nature", "flavor", "meridian", "solar_terms")
OPTIONAL_FIELDS = ("aliases", "benefits", "season_note", "caution", "classic_note")
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS


def validate_ingredient(record: dict, vocab: Vocab) -> list[str]:
    """校验食材记录的结构与封闭字段值域,返回错误列表,空列表即通过。"""
    if not isinstance(record, dict):
        return [f"记录须为 JSON 对象,当前为 {type(record).__name__}"]

    errors: list[str] = []

    unknown = set(record) - set(ALL_FIELDS)
    if unknown:
        errors.append(f"未知字段: {','.join(sorted(unknown))}")

    for field, value in record.items():
        if field in ALL_FIELDS and value is not None and not isinstance(value, str):
            errors.append(f"{field}: 应为字符串或 null")

    def check(field: str, allowed, max_n: int | None = None) -> list[str] | None:
        raw = record.get(field)
        if raw is None or not str(raw).strip():
            if field in REQUIRED_FIELDS:
                errors.append(f"{field}: 必填")
            return None
        values = [v.strip() for v in raw.split(",") if v.strip()]
        allowed_set = set(allowed)
        bad = [v for v in values if v not in allowed_set]
        if bad:
            errors.append(f"{field}: {'、'.join(bad)} 不在词表中")
        if max_n is not None and len(values) > max_n:
            errors.append(f"{field}: 最多 {max_n} 个,现有 {len(values)} 个")
        return values

    if not str(record.get("name") or "").strip():
        errors.append("name: 必填")

    check("category", vocab.categories, max_n=3)
    check("nature", vocab.natures)
    check("flavor", vocab.flavors)
    check("meridian", vocab.meridians)
    check("benefits", vocab.benefits, max_n=3)

    terms = check("solar_terms", vocab.solar_terms)
    if terms:
        index = vocab.solar_term_index
        seq = [index[t] for t in terms if t in index]
        if seq != sorted(seq):
            errors.append("solar_terms: 未按节气先后顺序升序")

    return errors


DISH_REQUIRED_FIELDS = (
    "name",
    "category",
    "main_ingredients",
    "steps",
    "calories",
    "benefits",
    "style",
    "solar_terms",
)
DISH_OPTIONAL_FIELDS = ("excluded", "extras", "caution")
DISH_ALL_FIELDS = DISH_REQUIRED_FIELDS + DISH_OPTIONAL_FIELDS
DISH_TEXT_LIMITS = {"name": 100, "style": 100, "benefits": 500, "caution": 500}
DISH_JOINED_LIMIT = 500


def validate_dish(record: dict, vocab: Vocab) -> list[str]:
    """校验菜谱记录的结构、词表值域与长度上限,返回错误列表,空列表即通过。"""
    if not isinstance(record, dict):
        return [f"记录须为 JSON 对象,当前为 {type(record).__name__}"]

    errors: list[str] = []

    unknown = set(record) - set(DISH_ALL_FIELDS)
    if unknown:
        errors.append(f"未知字段: {','.join(sorted(unknown))}")

    for field in DISH_REQUIRED_FIELDS:
        if record.get(field) in (None, "", [], {}):
            errors.append(f"{field}: 必填")

    category = record.get("category")
    if category is not None and category not in vocab.dish_categories:
        errors.append(f"category: {category} 不在词表中")

    for field, limit in DISH_TEXT_LIMITS.items():
        value = record.get(field)
        if value is None:
            continue
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{field}: 应为非空字符串")
        elif len(value) > limit:
            errors.append(f"{field}: 超长(>{limit}字)")

    calories = record.get("calories")
    if calories is not None and (
        not isinstance(calories, int) or isinstance(calories, bool) or calories <= 0
    ):
        errors.append("calories: 应为正整数(千卡)")

    def check_items(field: str, keys: tuple[str, ...]) -> None:
        value = record.get(field)
        if value is None or (field in DISH_REQUIRED_FIELDS and value == []):
            return
        if not isinstance(value, list):
            errors.append(f"{field}: 应为数组")
            return
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                errors.append(f"{field}[{i}]: 应为对象")
            elif any(not str(item.get(k) or "").strip() for k in keys):
                errors.append(f"{field}[{i}]: {'/'.join(keys)} 均须非空")
        joined = ",".join(
            str(item.get("name", "")) for item in value if isinstance(item, dict)
        )
        if len(joined) > DISH_JOINED_LIMIT:
            errors.append(f"{field}: 清单过长(>{DISH_JOINED_LIMIT}字)")

    check_items("main_ingredients", ("name", "amount"))
    check_items("extras", ("name", "amount"))
    check_items("excluded", ("name", "reason"))

    steps = record.get("steps")
    if steps is not None:
        if not isinstance(steps, list):
            errors.append("steps: 应为数组")
        else:
            for i, step in enumerate(steps):
                if not isinstance(step, str) or not step.strip():
                    errors.append(f"steps[{i}]: 应为非空文本")

    raw_terms = record.get("solar_terms")
    if raw_terms is not None and not isinstance(raw_terms, str):
        errors.append("solar_terms: 应为半角逗号分隔的字符串,如 \"立冬,小雪\"")
    elif isinstance(raw_terms, str) and raw_terms.strip():
        values = [t.strip() for t in raw_terms.split(",") if t.strip()]
        bad = [v for v in values if v not in set(vocab.solar_terms)]
        if bad:
            errors.append(f"solar_terms: {'、'.join(bad)} 不在词表中")
        else:
            seq = [vocab.solar_term_index[t] for t in values]
            if seq != sorted(seq):
                errors.append("solar_terms: 未按节气先后顺序升序")

    return errors
