from concurrent.futures import ThreadPoolExecutor

from llm.recommend import SolarTermIngredientRecommender
from llm.pipeline import IngredientPipeline
from shike import reject_log


class IngredientBatchPipeline:
    """节气级批量流水线:推荐食材名 → 并发执行填充/校验/核验 → 通过者入库(待审核)。"""

    def __init__(
        self,
        recommender: SolarTermIngredientRecommender | None = None,
        pipeline_factory=IngredientPipeline,
        max_workers: int = 3,
    ):
        self.recommender = recommender or SolarTermIngredientRecommender()
        self.pipeline_factory = pipeline_factory
        self.max_workers = max_workers

    def run(self, term: str, user_id: int | None = None) -> dict:
        """返回 {"term","recommended","inserted","failed"};failed 含 stage 与原因。
        user_id 非空时产出归属该用户,否则为官方(未归属)。"""
        names = list(dict.fromkeys(self.recommender.recommend(term, user_id=user_id)))
        if not names:
            return {
                "term": term,
                "recommended": [],
                "inserted": [],
                "doubts": {},
                "failed": [],
            }

        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            results = list(
                pool.map(lambda n: self.pipeline_factory().run(n, user_id=user_id), names)
            )

        for item in results:
            if item["stage"] in ("invalid", "rejected"):
                detail = item.get("errors") or item.get("problems") or []
                reject_log.log_reject(item["name"], item["stage"], detail)
            elif item.get("doubts"):
                reject_log.log_reject(item["name"], "存疑", item["doubts"])

        return {
            "term": term,
            "recommended": names,
            "inserted": [r["name"] for r in results if r["stage"] == "inserted"],
            "doubts": {r["name"]: r["doubts"] for r in results if r.get("doubts")},
            "failed": [r for r in results if r["stage"] != "inserted"],
        }
