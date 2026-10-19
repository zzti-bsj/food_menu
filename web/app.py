from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from llm.batch import IngredientBatchPipeline
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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8787, threaded=True)
