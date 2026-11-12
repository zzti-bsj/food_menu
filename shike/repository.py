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
_INGREDIENT_WRITABLE = (*_INGREDIENT_FIELDS, "image")


def _visible_where(owner: int | None) -> tuple[str, list]:
    """可见范围子句:官方(user_id IS NULL)+ 本人;owner 为空(未登录)时仅官方。"""
    if owner is None:
        return "user_id IS NULL", []
    return "(user_id IS NULL OR user_id = %s)", [owner]


def list_names_by_solar_terms(terms: list[str], owner: int | None = None) -> list[str]:
    """返回可见范围内已收录任一给定节气的全部食材名,按 id 升序。"""
    clause = " OR ".join(["FIND_IN_SET(%s, solar_terms)"] * len(terms))
    vis, vis_params = _visible_where(owner)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT name FROM ingredient WHERE {vis} AND ({clause}) ORDER BY id",
                [*vis_params, *terms],
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def insert_ingredient(record: dict, user_id: int | None = None) -> None:
    """以待审核状态写入一枚食材;user_id 非空时记录归属;name 冲突时抛 IntegrityError。"""
    fields = [f for f in _INGREDIENT_FIELDS if record.get(f) is not None]
    columns = ",".join(f"`{f}`" for f in fields + ["status"])
    placeholders = ",".join(["%s"] * (len(fields) + 1))
    values = [record[f] or None for f in fields] + ["待审核"]
    if user_id is not None:
        columns += ",`user_id`"
        placeholders += ",%s"
        values.append(user_id)

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
    """返回全部食材完整字段(含归属 user_id),待审核在前。"""
    fields = ", ".join(f"`{f}`" for f in ("id", "user_id", *_INGREDIENT_FIELDS, "status", "created_at"))
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


def find_ingredients_by_names(names: list[str], owner: int | None = None) -> list[dict]:
    """按名称列表返回可见范围内食材的性味归经档案(pantry 用),按 id 升序;不存在的忽略。"""
    if not names:
        return []
    placeholders = ",".join(["%s"] * len(names))
    vis, vis_params = _visible_where(owner)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                "SELECT name,nature,flavor,meridian,benefits,caution FROM ingredient "
                f"WHERE name IN ({placeholders}) AND {vis} ORDER BY id",
                [*names, *vis_params],
            )
            return list(cur.fetchall())
    finally:
        conn.close()


def find_ingredient_by_id(ingredient_id: int) -> dict | None:
    """按 id 查一枚食材完整档案(含归属、审核状态与图片);不命中返回 None。"""
    fields = ", ".join(f"`{f}`" for f in ("id", "user_id", *_INGREDIENT_WRITABLE, "status", "created_at"))
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT {fields} FROM ingredient WHERE id=%s LIMIT 1", (ingredient_id,)
            )
            return cur.fetchone()
    finally:
        conn.close()


def update_ingredient(ingredient_id: int, fields: dict) -> bool:
    """按 id 更新食材白名单字段(审核状态走 update_ingredient_status);返回是否命中。"""
    names = [f for f in _INGREDIENT_WRITABLE if f in fields]
    if not names:
        return False
    assignments = ",".join(f"`{f}`=%s" for f in names)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                f"UPDATE ingredient SET {assignments} WHERE id=%s",
                [fields[f] for f in names] + [ingredient_id],
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


def delete_ingredient(ingredient_id: int) -> bool:
    """按 id 硬删除一枚食材(释放 uk_name 供重新收录);返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                "DELETE FROM ingredient WHERE id=%s", (ingredient_id,)
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


_USER_FIELDS = ("phone", "password_hash", "nickname", "avatar", "role", "status")
_USER_SELECT = "id,phone,password_hash,nickname,avatar,role,status"


def insert_user(record: dict) -> None:
    """写入一枚用户;phone 冲突时抛 pymysql IntegrityError。"""
    fields = [f for f in _USER_FIELDS if record.get(f) is not None]
    columns = ",".join(f"`{f}`" for f in fields)
    placeholders = ",".join(["%s"] * len(fields))
    values = [record[f] for f in fields]

    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(f"INSERT INTO user ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


def find_user_by_phone(phone: str) -> dict | None:
    """按手机号查一枚用户(含密码哈希,登录校验用);不命中返回 None。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT {_USER_SELECT} FROM user WHERE phone=%s LIMIT 1", (phone,)
            )
            return cur.fetchone()
    finally:
        conn.close()


def find_user_by_id(user_id: int) -> dict | None:
    """按 id 查一枚用户(令牌换用户用);不命中返回 None。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT {_USER_SELECT} FROM user WHERE id=%s LIMIT 1", (user_id,)
            )
            return cur.fetchone()
    finally:
        conn.close()


def list_users() -> list[dict]:
    """返回全部用户(含密码哈希,展示层须脱敏),按 id 升序。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(f"SELECT {_USER_SELECT} FROM user ORDER BY id")
            return list(cur.fetchall())
    finally:
        conn.close()


_USER_WRITABLE = ("nickname", "avatar", "role", "status", "password_hash")


def update_user(user_id: int, fields: dict) -> bool:
    """按 id 更新用户白名单字段(手机号不可改);返回是否命中。"""
    names = [f for f in _USER_WRITABLE if f in fields]
    if not names:
        return False
    assignments = ",".join(f"`{f}`=%s" for f in names)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                f"UPDATE user SET {assignments} WHERE id=%s",
                [fields[f] for f in names] + [user_id],
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


def user_owns_content(user_id: int) -> bool:
    """该用户名下是否仍有食材或菜品(删号前守卫);有任一记录返回 True。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS(SELECT 1 FROM ingredient WHERE user_id=%s)"
                " OR EXISTS(SELECT 1 FROM dish WHERE user_id=%s)",
                (user_id, user_id),
            )
            return bool(cur.fetchone()[0])
    finally:
        conn.close()


def delete_user(user_id: int) -> bool:
    """按 id 硬删除一枚用户(调用方须先确认名下无内容);返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute("DELETE FROM user WHERE id=%s", (user_id,))
        conn.commit()
        return affected > 0
    finally:
        conn.close()


_DISH_FIELDS = (
    "name",
    "category",
    "main_ingredients",
    "extras",
    "steps",
    "calories",
    "benefits",
    "story",
    "caution",
    "style",
    "solar_terms",
    "remark",
)


def insert_dish(record: dict, user_id: int | None = None) -> None:
    """以待审核状态写入一道菜;user_id 非空时记录归属;name 冲突时抛 IntegrityError。"""
    fields = [f for f in _DISH_FIELDS if record.get(f) is not None]
    columns = ",".join(f"`{f}`" for f in fields + ["status"])
    placeholders = ",".join(["%s"] * (len(fields) + 1))
    values = [record[f] or None for f in fields] + ["待审核"]
    if user_id is not None:
        columns += ",`user_id`"
        placeholders += ",%s"
        values.append(user_id)

    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(f"INSERT INTO dish ({columns}) VALUES ({placeholders})", values)
        conn.commit()
    finally:
        conn.close()


def list_dishes() -> list[dict]:
    """返回全部菜品完整字段(含归属 user_id),待审核在前。"""
    fields = ", ".join(f"`{f}`" for f in ("id", "user_id", *_DISH_FIELDS, "status", "created_at"))
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT {fields} FROM dish "
                "ORDER BY FIELD(status,'待审核','已通过','已驳回'), id"
            )
            return list(cur.fetchall())
    finally:
        conn.close()


def update_dish_status(name: str, status: str) -> bool:
    """更新菜品审核状态;返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                "UPDATE dish SET status=%s WHERE name=%s", (status, name)
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


def list_dish_names_by_cuisine(cuisine: str, owner: int | None = None) -> list[str]:
    """返回可见范围内 style 菜系位为给定菜系的全部菜名(含所有审核状态,已驳回也避重)。"""
    vis, vis_params = _visible_where(owner)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT name FROM dish WHERE style LIKE %s AND {vis} ORDER BY id",
                [f"{cuisine},%", *vis_params],
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def find_dish_by_name(name: str, owner: int | None = None) -> dict | None:
    """按菜名查一枚可见菜品(任意审核状态),用于菜名模式入库预检;不命中返回 None。"""
    vis, vis_params = _visible_where(owner)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                f"SELECT id,name,user_id,category,status FROM dish WHERE name=%s AND {vis} LIMIT 1",
                [name, *vis_params],
            )
            return cur.fetchone()
    finally:
        conn.close()


def find_dish_by_name_any(name: str) -> dict | None:
    """按菜名查一枚(任意状态、任意归属),用于审核归属校验;不命中返回 None。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                "SELECT id,name,user_id,category,status FROM dish WHERE name=%s LIMIT 1",
                (name,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def find_ingredient_by_name(name: str) -> dict | None:
    """按食材名查一枚(任意状态,含归属),用于审核归属校验;不命中返回 None。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                "SELECT id,name,user_id,status FROM ingredient WHERE name=%s LIMIT 1",
                (name,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def update_dish_image(name: str, image: str | None) -> bool:
    """更新菜品图片 URL;image 传 None 清空。返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                "UPDATE dish SET image=%s WHERE name=%s", (image, name)
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


_DISH_WRITABLE = (*_DISH_FIELDS, "image")


def find_dish_by_id(dish_id: int) -> dict | None:
    """按 id 查一道菜完整档案(含归属、审核状态与图片);不命中返回 None。"""
    fields = ", ".join(f"`{f}`" for f in ("id", "user_id", *_DISH_WRITABLE, "status", "created_at"))
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(f"SELECT {fields} FROM dish WHERE id=%s LIMIT 1", (dish_id,))
            return cur.fetchone()
    finally:
        conn.close()


def update_dish(dish_id: int, fields: dict) -> bool:
    """按 id 更新菜品白名单字段(审核状态走 update_dish_status);返回是否命中。"""
    names = [f for f in _DISH_WRITABLE if f in fields]
    if not names:
        return False
    assignments = ",".join(f"`{f}`=%s" for f in names)
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                f"UPDATE dish SET {assignments} WHERE id=%s",
                [fields[f] for f in names] + [dish_id],
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()


def delete_dish(dish_id: int) -> bool:
    """按 id 硬删除一道菜(释放 uk_name 供重新生成);返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute("DELETE FROM dish WHERE id=%s", (dish_id,))
        conn.commit()
        return affected > 0
    finally:
        conn.close()
