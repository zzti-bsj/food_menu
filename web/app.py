from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from llm.batch import IngredientBatchPipeline
from llm.cuisine_pipeline import CuisinePipeline
from llm.dish_pipeline import DishPipeline
from shike import repository
from shike.vocab import load_vocab

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
    if not name or not isinstance(image, str):
        return jsonify({"error": "参数不合法"}), 400
    if not repository.update_dish_image(name, image.strip() or None):
        return jsonify({"error": f"未找到菜品:{name}"}), 404
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8787, threaded=True)
