from pathlib import Path
import re
import secrets

from flask import Flask, g, jsonify, request, send_from_directory
from pymysql.err import IntegrityError

from llm.batch import IngredientBatchPipeline
from llm.cuisine_pipeline import CuisinePipeline
from llm.dish_pipeline import DishPipeline
from shike import repository
from shike.validate import ALL_FIELDS, validate_ingredient
from shike.vocab import load_vocab
from web import auth

STATUSES = ("待审核", "已通过", "已驳回")
VOCAB = load_vocab()

app = Flask(__name__, static_folder=None)


@app.after_request
def add_cors(response):
    """dev 联调:允许移动端 Web 预览(expo start --web)跨域拉取 API;带 Origin 才回加。"""
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE"
    return response


@app.get("/")
def index():
    return send_from_directory(Path(__file__).parent, "review.html")


@app.get("/api/terms")
def terms():
    return jsonify(list(VOCAB.solar_terms))


@app.get("/api/vocab")
def vocab():
    """全部封闭值域(移动端编辑表单的选项源):词表文件为唯一事实来源。"""
    return jsonify({
        "solar_terms": list(VOCAB.solar_terms),
        "categories": list(VOCAB.categories),
        "dish_categories": list(VOCAB.dish_categories),
        "cuisines": list(VOCAB.cuisines),
        "natures": list(VOCAB.natures),
        "flavors": list(VOCAB.flavors),
        "meridians": list(VOCAB.meridians),
        "benefits": VOCAB.benefits,
    })


# ---------- 图片上传(移动端「编辑菜谱/食材」封面):落盘 web/uploads/,返回相对 URL ----------
# URL 存 ingredient/dish 的 image 列(≤500 字),相对路径由移动端拼 API_BASE_URL。

UPLOAD_DIR = Path(__file__).parent / "uploads"
_UPLOAD_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
_UPLOAD_NAME_RE = re.compile(r"^[0-9a-f]{16}\.(jpg|jpeg|png|webp|gif)$")


@app.post("/api/uploads")
@auth.require_login
def upload_image():
    file = request.files.get("file")
    if file is None or not file.filename:
        return jsonify({"error": "缺少文件字段 file"}), 400
    ext = Path(file.filename).suffix.lower()
    if ext not in _UPLOAD_EXTS:
        return jsonify({"error": "仅支持 jpg/png/webp/gif 图片"}), 400
    blob = file.read()
    if not blob:
        return jsonify({"error": "文件为空"}), 400
    if len(blob) > _UPLOAD_MAX_BYTES:
        return jsonify({"error": "图片过大(>5MB)"}), 400
    UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    (UPLOAD_DIR / name).write_bytes(blob)
    return jsonify({"url": f"/uploads/{name}"}), 201


@app.get("/uploads/<name>")
def serve_upload(name: str):
    """仅放行随机名生成的文件,阻断路径拼接。"""
    if not _UPLOAD_NAME_RE.match(name):
        return jsonify({"error": "未找到文件"}), 404
    return send_from_directory(UPLOAD_DIR, name)


def _row_visible(row: dict) -> bool:
    """列表可见性:官方(user_id 为空)人人可见;个人内容仅本人;admin 超管可见全部。"""
    me = auth.current_user()
    if me is None:
        return row.get("user_id") is None
    return (
        row.get("user_id") is None
        or me.get("role") == "admin"
        or me.get("id") == row.get("user_id")
    )


def _grouped_visible(rows: list) -> dict:
    """按状态分组,组内官方(NULL)排前、其余按 id 升序。"""
    grouped = {s: [] for s in STATUSES}
    for row in rows:
        if _row_visible(row):
            grouped[row["status"]].append(row)
    for s in STATUSES:
        grouped[s].sort(key=lambda r: (r.get("user_id") is not None, r["id"]))
    return grouped


@app.get("/api/ingredients")
@auth.optional_login
def ingredients():
    return jsonify(_grouped_visible(repository.list_ingredients()))


@app.post("/api/status")
@auth.require_login
def set_status():
    """审核食材:仅归属人或 admin(超管);非可见一律 404 防探测。"""
    data = request.get_json(silent=True) or {}
    name, status = data.get("name"), data.get("status")
    if not name or status not in STATUSES:
        return jsonify({"error": "参数不合法"}), 400
    row = repository.find_ingredient_by_name(name)
    if row is None or not _can_write(row):
        return jsonify({"error": f"未找到食材:{name}"}), 404
    repository.update_ingredient_status(name, status)
    return jsonify({"ok": True})


@app.post("/api/batch")
@auth.optional_login
def run_batch():
    """跑食材批次;登录时产出归属当前用户,未登录归属官方(未归属)。"""
    data = request.get_json(silent=True) or {}
    term = data.get("term", "")
    if term not in VOCAB.solar_term_index:
        return jsonify({"error": f"非法节气:{term}"}), 400
    me = auth.current_user()
    user_id = me["id"] if me else None
    return jsonify(IngredientBatchPipeline().run(term, user_id=user_id))


@app.get("/api/dishes")
@auth.optional_login
def dishes():
    return jsonify(_grouped_visible(repository.list_dishes()))


@app.get("/api/cuisines")
def cuisines():
    return jsonify(list(VOCAB.cuisines))


@app.post("/api/dishes")
@auth.optional_login
def create_dish():
    me = auth.current_user()
    user_id = me["id"] if me else None
    data = request.get_json(silent=True) or {}
    if data.get("chef") == "cuisine":
        return jsonify(CuisinePipeline().run(data.get("mode") or "", data, user_id=user_id))
    ingredients = data.get("ingredients")
    if (
        not isinstance(ingredients, list)
        or not ingredients
        or not all(isinstance(i, str) and i.strip() for i in ingredients)
    ):
        return jsonify({"error": "ingredients 须为非空字符串数组"}), 400
    names = list(dict.fromkeys(i.strip() for i in ingredients))
    return jsonify(DishPipeline().run(names, user_id=user_id))


@app.post("/api/dish/status")
@auth.require_login
def set_dish_status():
    """审核菜品:仅归属人或 admin(超管);非可见一律 404 防探测。"""
    data = request.get_json(silent=True) or {}
    name, status = data.get("name"), data.get("status")
    if not name or status not in STATUSES:
        return jsonify({"error": "参数不合法"}), 400
    row = repository.find_dish_by_name_any(name)
    if row is None or not _can_write(row):
        return jsonify({"error": f"未找到菜品:{name}"}), 404
    repository.update_dish_status(name, status)
    return jsonify({"ok": True})


@app.post("/api/dish/image")
def set_dish_image():
    data = request.get_json(silent=True) or {}
    name, image = data.get("name"), data.get("image")
    if not name or image is None or not isinstance(image, str):
        return jsonify({"error": "参数不合法"}), 400
    image = image.strip()
    if len(image) > 500:
        return jsonify({"error": "图片URL过长(>500字)"}), 400
    if not repository.update_dish_image(name, image or None):
        return jsonify({"error": f"未找到菜品:{name}"}), 404
    return jsonify({"ok": True})


_PHONE_RE = re.compile(r"^1\d{10}$")
_USER_VIEW_FIELDS = ("id", "phone", "nickname", "avatar", "role", "status")


def _user_view(user: dict) -> dict:
    """对外的用户信息,永不携带 password_hash。"""
    return {k: user.get(k) for k in _USER_VIEW_FIELDS}


@app.post("/api/auth/register")
def auth_register():
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone") or "").strip()
    password = str(data.get("password") or "")
    if not _PHONE_RE.match(phone):
        return jsonify({"error": "手机号须为1开头的11位数字"}), 400
    if len(password) < 6:
        return jsonify({"error": "密码至少6位"}), 400
    try:
        repository.insert_user({
            "phone": phone,
            "password_hash": auth.hash_password(password),
        })
    except IntegrityError:
        return jsonify({"error": f"手机号已注册:{phone}"}), 409
    user = repository.find_user_by_phone(phone)
    return jsonify({**auth.issue_token_pair(user), "user": _user_view(user)}), 201


@app.post("/api/auth/login")
def auth_login():
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone") or "").strip()
    password = str(data.get("password") or "")
    user = repository.find_user_by_phone(phone) if phone else None
    if user is None or not auth.verify_password(password, user["password_hash"]):
        return jsonify({"error": "手机号或密码不正确"}), 401
    if user.get("status") != "正常":
        return jsonify({"error": "账号已禁用"}), 401
    return jsonify({**auth.issue_token_pair(user), "user": _user_view(user)})


@app.post("/api/auth/refresh")
def auth_refresh():
    token = auth.bearer_token()
    payload = auth.decode_token(token, "refresh") if token else None
    if payload is None:
        return jsonify({"error": "refresh 令牌无效或已过期"}), 401
    user = repository.find_user_by_id(payload["sub"])
    if user is None or user.get("status") != "正常":
        return jsonify({"error": "用户不存在或已禁用"}), 401
    return jsonify({**auth.issue_token_pair(user), "user": _user_view(user)})


@app.get("/api/auth/me")
@auth.require_login
def auth_me():
    return jsonify({"user": _user_view(auth.current_user())})


# ---------- 内容按 id 的详情/通用字段更新/硬删除 ----------
# 官方库(user_id 为 NULL)内容写操作仅 admin;私有内容本人或 admin。审核状态不在此列,
# 仍走 /api/status 与 /api/dish/status。

_DISH_PATCH_FIELDS = (
    "name", "category", "main_ingredients", "extras", "steps", "calories",
    "benefits", "story", "image", "caution", "style", "solar_terms", "remark",
)
_DISH_PATCH_LIMITS = {
    "name": 100, "category": 50, "main_ingredients": 500, "extras": 500,
    "calories": 50, "benefits": 500, "story": 500, "image": 500,
    "caution": 500, "style": 100, "solar_terms": 100, "remark": 500,
}


def _can_write(row: dict) -> bool:
    """官方库仅 admin 可写;私有内容仅本人或 admin 可写。"""
    user = auth.current_user()
    return user is not None and (
        user.get("role") == "admin" or user.get("id") == row.get("user_id")
    )


def _visible(row: dict) -> bool:
    """官方内容人人可见;私有内容仅本人或 admin 可见(他人一律 404 防探测)。"""
    return row.get("user_id") is None or _can_write(row)


def _load_writable(repo_find, entity_id: int, label: str):
    """取可写实体;不可写时返回 (None, (响应, 状态码)):官方库内容非 admin 写 403,他人私有内容 404。"""
    row = repo_find(entity_id)
    if row is None:
        return None, (jsonify({"error": f"未找到{label}:{entity_id}"}), 404)
    if not _can_write(row):
        if row.get("user_id") is None:
            return None, (jsonify({"error": f"官方库内容需要管理员权限:{entity_id}"}), 403)
        return None, (jsonify({"error": f"未找到{label}:{entity_id}"}), 404)
    return row, None


def _patch_body() -> dict | None:
    """取非空 JSON 对象请求体;不合法返回 None。"""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) and data else None


@app.get("/api/ingredients/<int:ingredient_id>")
@auth.optional_login
def ingredient_detail(ingredient_id: int):
    row = repository.find_ingredient_by_id(ingredient_id)
    if row is None or not _visible(row):
        return jsonify({"error": f"未找到食材:{ingredient_id}"}), 404
    return jsonify(row)


@app.patch("/api/ingredients/<int:ingredient_id>")
@auth.require_login
def patch_ingredient(ingredient_id: int):
    row, err = _load_writable(repository.find_ingredient_by_id, ingredient_id, "食材")
    if err:
        return err
    data = _patch_body()
    if data is None:
        return jsonify({"error": "请求体须为非空 JSON 对象"}), 400
    unknown = set(data) - set(ALL_FIELDS) - {"image"}
    if unknown:
        return jsonify({"error": f"未知字段: {','.join(sorted(unknown))}"}), 400
    merged = {f: data.get(f, row[f]) for f in ALL_FIELDS}
    errors = validate_ingredient(merged, VOCAB)
    if "image" in data and data["image"] is not None and (
        not isinstance(data["image"], str) or len(data["image"]) > 500
    ):
        errors.append("image: 应为不超过500字的字符串或 null")
    if errors:
        return jsonify({"error": "校验未通过", "details": errors}), 400
    fields = dict(data)
    if "image" in fields:
        image = fields["image"].strip() if fields["image"] is not None else None
        fields["image"] = image or None  # 空串视为清空
    try:
        updated = repository.update_ingredient(ingredient_id, fields)
    except IntegrityError:
        return jsonify({"error": f"名称已存在:{data.get('name')}"}), 409
    if not updated:
        return jsonify({"error": f"未找到食材:{ingredient_id}"}), 404
    return jsonify(repository.find_ingredient_by_id(ingredient_id))


@app.delete("/api/ingredients/<int:ingredient_id>")
@auth.require_login
def delete_ingredient(ingredient_id: int):
    row, err = _load_writable(repository.find_ingredient_by_id, ingredient_id, "食材")
    if err:
        return err
    repository.delete_ingredient(ingredient_id)
    return jsonify({"ok": True})


def _dish_patch_errors(data: dict) -> list[str]:
    """PATCH 菜品的轻校验:字符串类型、列宽上限、封闭值域(category/solar_terms)。"""
    errors: list[str] = []
    for field, value in data.items():
        if value is None:
            continue
        if not isinstance(value, str):
            errors.append(f"{field}: 应为字符串或 null")
            continue
        limit = _DISH_PATCH_LIMITS.get(field)
        if limit and len(value) > limit:
            errors.append(f"{field}: 超长(>{limit}字)")
    if "name" in data and not str(data.get("name") or "").strip():
        errors.append("name: 必填")
    category = data.get("category")
    if category is not None and category not in VOCAB.dish_categories:
        errors.append(f"category: {category} 不在词表中")
    terms = data.get("solar_terms")
    if isinstance(terms, str) and terms.strip():
        values = [t.strip() for t in terms.split(",") if t.strip()]
        bad = [v for v in values if v not in set(VOCAB.solar_terms)]
        if bad:
            errors.append(f"solar_terms: {'、'.join(bad)} 不在词表中")
        elif values != sorted(values, key=VOCAB.solar_term_index.get):
            errors.append("solar_terms: 未按节气先后顺序升序")
    return errors


@app.get("/api/dishes/<int:dish_id>")
@auth.optional_login
def dish_detail(dish_id: int):
    row = repository.find_dish_by_id(dish_id)
    if row is None or not _visible(row):
        return jsonify({"error": f"未找到菜品:{dish_id}"}), 404
    return jsonify(row)


@app.patch("/api/dishes/<int:dish_id>")
@auth.require_login
def patch_dish(dish_id: int):
    row, err = _load_writable(repository.find_dish_by_id, dish_id, "菜品")
    if err:
        return err
    data = _patch_body()
    if data is None:
        return jsonify({"error": "请求体须为非空 JSON 对象"}), 400
    unknown = set(data) - set(_DISH_PATCH_FIELDS)
    if unknown:
        return jsonify({"error": f"未知字段: {','.join(sorted(unknown))}"}), 400
    errors = _dish_patch_errors(data)
    if errors:
        return jsonify({"error": "校验未通过", "details": errors}), 400
    try:
        updated = repository.update_dish(dish_id, data)
    except IntegrityError:
        return jsonify({"error": f"菜名已存在:{data.get('name')}"}), 409
    if not updated:
        return jsonify({"error": f"未找到菜品:{dish_id}"}), 404
    return jsonify(repository.find_dish_by_id(dish_id))


@app.delete("/api/dishes/<int:dish_id>")
@auth.require_login
def delete_dish(dish_id: int):
    row, err = _load_writable(repository.find_dish_by_id, dish_id, "菜品")
    if err:
        return err
    repository.delete_dish(dish_id)
    return jsonify({"ok": True})


# ---------- 用户管理(admin)与自助资料 ----------

_USER_PATCH_FIELDS = ("nickname", "status", "role")


@app.get("/api/users")
@auth.require_admin
def list_users():
    return jsonify([_user_view(u) for u in repository.list_users()])


@app.patch("/api/users/<int:user_id>")
@auth.require_admin
def patch_user(user_id: int):
    data = _patch_body()
    if data is None:
        return jsonify({"error": "请求体须为非空 JSON 对象"}), 400
    unknown = set(data) - set(_USER_PATCH_FIELDS)
    if unknown:
        return jsonify({"error": f"未知字段: {','.join(sorted(unknown))}"}), 400
    if data.get("status") is not None and data["status"] not in ("正常", "禁用"):
        return jsonify({"error": "status 须为 正常/禁用"}), 400
    if data.get("role") is not None and data["role"] not in ("user", "admin"):
        return jsonify({"error": "role 须为 user/admin"}), 400
    nickname = data.get("nickname")
    if nickname is not None and (
        not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 50
    ):
        return jsonify({"error": "nickname 须为1-50字"}), 400
    target = repository.find_user_by_id(user_id)
    if target is None:
        return jsonify({"error": f"未找到用户:{user_id}"}), 404
    me = auth.current_user()
    if target["id"] == me["id"] and (
        data.get("status") == "禁用" or data.get("role") == "user"
    ):
        return jsonify({"error": "不能禁用自己或将角色降级为 user"}), 400
    fields = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in data.items()
        if v is not None
    }
    if not repository.update_user(user_id, fields):
        return jsonify({"error": f"未找到用户:{user_id}"}), 404
    return jsonify({"user": _user_view(repository.find_user_by_id(user_id))})


@app.delete("/api/users/<int:user_id>")
@auth.require_admin
def delete_user(user_id: int):
    target = repository.find_user_by_id(user_id)
    if target is None:
        return jsonify({"error": f"未找到用户:{user_id}"}), 404
    if target["id"] == auth.current_user()["id"]:
        return jsonify({"error": "不能删除自己"}), 400
    if repository.user_owns_content(user_id):
        return jsonify({"error": "该用户名下仍有食材或菜品,请先转移或清理,或改用禁用"}), 409
    repository.delete_user(user_id)
    return jsonify({"ok": True})


@app.patch("/api/auth/me")
@auth.require_login
def auth_update_me():
    data = _patch_body()
    if data is None:
        return jsonify({"error": "请求体须为非空 JSON 对象"}), 400
    unknown = set(data) - {"nickname", "avatar", "password", "current_password"}
    if unknown:
        return jsonify({"error": f"未知字段: {','.join(sorted(unknown))}"}), 400
    me = auth.current_user()
    fields: dict = {}
    if "nickname" in data:
        nickname = str(data.get("nickname") or "").strip()
        if not 1 <= len(nickname) <= 50:
            return jsonify({"error": "nickname 须为1-50字"}), 400
        fields["nickname"] = nickname
    if "avatar" in data:
        avatar = data.get("avatar")
        if avatar is not None and (not isinstance(avatar, str) or len(avatar.strip()) > 500):
            return jsonify({"error": "avatar 应为不超过500字的 URL 或 null"}), 400
        # 空串视为清空(回退昵称印章)
        fields["avatar"] = (avatar.strip() or None) if isinstance(avatar, str) else None
    if "password" in data:
        new_password = str(data.get("password") or "")
        if len(new_password) < 6:
            return jsonify({"error": "新密码至少6位"}), 400
        current = str(data.get("current_password") or "")
        if not auth.verify_password(current, me["password_hash"]):
            return jsonify({"error": "当前密码不正确"}), 403
        fields["password_hash"] = auth.hash_password(new_password)
    if not fields:
        return jsonify({"error": "须提供 nickname、avatar 或 password"}), 400
    if not repository.update_user(me["id"], fields):
        return jsonify({"error": "用户不存在"}), 404
    return jsonify({"user": _user_view(repository.find_user_by_id(me["id"]))})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8787, threaded=True)
