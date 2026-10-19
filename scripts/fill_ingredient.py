import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.pipeline import IngredientPipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="食材入库流水线:填充→校验→核验→入库(待审核)")
    parser.add_argument("name", help="食材名,如 山药")
    args = parser.parse_args()

    result = IngredientPipeline().run(args.name)
    if result["stage"] == "inserted":
        print(f"{result['name']} 已入库,状态:待审核")
        return 0
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
