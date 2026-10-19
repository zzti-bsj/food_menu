import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.batch import IngredientBatchPipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="节气批量入库:推荐→并发填充/校验/核验→入库")
    parser.add_argument("term", help="节气名,如 白露")
    args = parser.parse_args()

    result = IngredientBatchPipeline().run(args.term)
    print(
        f"节气 {result['term']}:推荐 {len(result['recommended'])} 枚,"
        f"入库 {len(result['inserted'])} 枚,未过 {len(result['failed'])} 枚\n"
    )
    for name in result["inserted"]:
        print(f"  ✓ {name} 已入库(待审核)")
        for doubt in result["doubts"].get(name, []):
            print(f"      ⚠ 存疑:{doubt}")
    for item in result["failed"]:
        detail = json.dumps(item, ensure_ascii=False)
        print(f"  ✗ {item['name']} [{item['stage']}] {detail}")
    return 0 if result["inserted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
