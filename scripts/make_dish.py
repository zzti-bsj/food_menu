import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.dish_pipeline import DishPipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="丢入食材,由健康厨师生成一道菜并入库待审核")
    parser.add_argument("ingredients", nargs="+", help="候选食材名,空格分隔,如:白萝卜 豆腐")
    args = parser.parse_args()

    result = DishPipeline().run(args.ingredients)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
