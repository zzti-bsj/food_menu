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
