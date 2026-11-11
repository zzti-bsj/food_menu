import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.cuisine_pipeline import CuisinePipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="丢入菜系/菜名/食材,由美食大厨生成一道菜并入库待审核")
    parser.add_argument("--mode", required=True, choices=("cuisine", "name", "ingredient"), help="任务模式")
    parser.add_argument("--cuisine", help="菜系(mode=cuisine 时必填,须在菜系词表内),如:川菜")
    parser.add_argument("--name", help="菜名(mode=name 时必填,单个),如:宫保鸡丁")
    parser.add_argument("--ingredients", help="候选食材,逗号分隔(mode=ingredient 时必填),如:白萝卜,鸡胸肉")
    args = parser.parse_args()

    payload = {}
    if args.mode == "cuisine":
        payload["cuisine"] = args.cuisine or ""
    elif args.mode == "name":
        payload["name"] = args.name or ""
    else:
        payload["ingredients"] = [
            s.strip() for s in (args.ingredients or "").replace("，", ",").replace("、", ",").split(",") if s.strip()
        ]

    result = CuisinePipeline().run(args.mode, payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
