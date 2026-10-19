import pymysql

from shike.config import db_config

_INGREDIENT_FIELDS = (
    "name",
    "aliases",
    "category",
    "nature",
    "flavor",
    "meridian",
    "benefits",
    "season_note",
    "caution",
    "classic_note",
    "solar_terms",
)


def list_names_by_solar_terms(terms: list[str]) -> list[str]:
    """返回已收录任一给定节气的全部食材名,按 id 升序。"""
    clause = " OR ".join(["FIND_IN_SET(%s, solar_terms)"] * len(terms))
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT name FROM ingredient WHERE {clause} ORDER BY id", terms)
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def insert_ingredient(record: dict) -> None:
    """以待审核状态写入一枚食材;name 冲突时抛 pymysql IntegrityError。"""
    fields = [f for f in _INGREDIENT_FIELDS if record.get(f) is not None]
    columns = ",".join(f"`{f}`" for f in fields + ["status"])
    placeholders = ",".join(["%s"] * (len(fields) + 1))
    values = [record[f] or None for f in fields] + ["待审核"]

    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO ingredient ({columns}) VALUES ({placeholders})", values
            )
        conn.commit()
    finally:
        conn.close()


def list_ingredients() -> list[dict]:
    """返回全部食材完整字段,待审核在前。"""
    fields = ", ".join(f"`{f}`" for f in ("id", *_INGREDIENT_FIELDS, "status"))
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT {fields} FROM ingredient "
                "ORDER BY FIELD(status,'待审核','已通过','已驳回'), id"
            )
            return list(cur.fetchall())
    finally:
        conn.close()


def update_ingredient_status(name: str, status: str) -> bool:
    """更新食材审核状态;返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                "UPDATE ingredient SET status=%s WHERE name=%s", (status, name)
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()
