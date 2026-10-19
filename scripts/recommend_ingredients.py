import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm.recommend import SolarTermIngredientRecommender


def main() -> int:
    parser = argparse.ArgumentParser(description="按节气推荐未收录的当令食材")
    parser.add_argument("term", help="节气名,如 白露")
    args = parser.parse_args()

    names = SolarTermIngredientRecommender().recommend(args.term)
    print("\n".join(names) if names else "已穷尽该节气的食材")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
