from pathlib import Path
import re

from flask import Flask, jsonify, request, send_from_directory
from pymysql.err import IntegrityError

from llm.batch import IngredientBatchPipeline
from llm.cuisine_pipeline import CuisinePipeline
from llm.dish_pipeline import DishPipeline
from shike import repository
from shike.vocab import load_vocab
from web import auth

STATUSES = ("待审核", "已通过", "已驳回")
VOCAB = load_vocab()

app = Flask(__name__, static_folder=None)
_last_batch = None


@app.get("/")
def index():
    return send_from_directory(Path(__file__).parent, "review.html")


@app.get("/api/terms")
def terms():
    return jsonify(list(VOCAB.solar_terms))


@app.get("/api/ingredients")
def ingredients():
    grouped = {s: [] for s in STATUSES}
    for row in repository.list_ingredients():
        grouped[row["status"]].append(row)
    return jsonify(grouped)


@app.post("/api/status")
def set_status():
    data = request.get_json(silent=True) or {}
    name, status = data.get("name"), data.get("status")
    if not name or status not in STATUSES:
        return jsonify({"error": "参数不合法"}), 400
    if not repository.update_ingredient_status(name, status):
        return jsonify({"error": f"未找到食材:{name}"}), 404
    return jsonify({"ok": True})


@app.post("/api/batch")
def run_batch():
    global _last_batch
    data = request.get_json(silent=True) or {}
    term = data.get("term", "")
    if term not in VOCAB.solar_term_index:
        return jsonify({"error": f"非法节气:{term}"}), 400
    _last_batch = IngredientBatchPipeline().run(term)
    return jsonify(_last_batch)


@app.get("/api/batch/last")
def last_batch():
    return jsonify(_last_batch)


@app.get("/api/dishes")
def dishes():
    grouped = {s: [] for s in STATUSES}
    for row in repository.list_dishes():
        grouped[row["status"]].append(row)
    return jsonify(grouped)


@app.get("/api/cuisines")
def cuisines():
    return jsonify(list(VOCAB.cuisines))


@app.post("/api/dishes")
def create_dish():
    data = request.get_json(silent=True) or {}
    if data.get("chef") == "cuisine":
        return jsonify(CuisinePipeline().run(data.get("mode") or "", data))
    ingredients = data.get("ingredients")
    if (
        not isinstance(ingredients, list)
        or not ingredients
        or not all(isinstance(i, str) and i.strip() for i in ingredients)
    ):
        return jsonify({"error": "ingredients 须为非空字符串数组"}), 400
    names = list(dict.fromkeys(i.strip() for i in ingredients))
    return jsonify(DishPipeline().run(names))


@app.post("/api/dish/status")
def set_dish_status():
    data = request.get_json(silent=True) or {}
    name, status = data.get("name"), data.get("status")
    if not name or status not in STATUSES:
        return jsonify({"error": "参数不合法"}), 400
    if not repository.update_dish_status(name, status):
        return jsonify({"error": f"未找到菜品:{name}"}), 404
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
_USER_VIEW_FIELDS = ("id", "phone", "nickname", "role", "status")


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8787, threaded=True)
