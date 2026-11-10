import re
from dataclasses import dataclass
from pathlib import Path

VOCAB_DIR = Path(__file__).resolve().parents[1] / "data" / "vocab"

_NFM_SECTIONS = {"四气": "natures", "五味": "flavors", "归经": "meridians"}


def _parse_table_rows(text: str) -> list[list[str]]:
    """提取 Markdown 表格数据行(跳过表头分隔行)。"""
    rows: list[list[str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if cells and all(c and set(c) <= {"-", ":", " "} for c in cells):
            continue
        rows.append(cells)
    return rows


def _strip_star(s: str) -> str:
    """去掉词条中的 ★ 新增标记。"""
    return s.replace("★", "").strip()


def _reject_dups(what: str, values: list[str]) -> None:
    """词表项重复说明文件被改坏,加载期直接报错。"""
    seen: set[str] = set()
    for v in values:
        if v in seen:
            raise ValueError(f"{what}词表存在重复项: {v}")
        seen.add(v)


def parse_solar_terms(text: str) -> list[str]:
    """解析节气表,返回按序号排列的节气名。"""
    terms = [r[1] for r in _parse_table_rows(text) if r[0] != "序号"]
    _reject_dups("节气", terms)
    return terms


def parse_categories(text: str, header: str = "大类") -> list[str]:
    """解析分类表,返回首列词条列表(跳过表头行)。"""
    cats = [r[0] for r in _parse_table_rows(text) if r[0] != header]
    _reject_dups("分类", cats)
    return cats


def parse_nature_flavor_meridian(text: str) -> dict[str, list[str]]:
    """按「## 标题」分节解析反引号词项,返回 natures/flavors/meridians 三键。"""
    result: dict[str, list[str]] = {}
    for section in re.split(r"^##\s+", text, flags=re.M):
        if not section.strip():
            continue
        heading = section.splitlines()[0]
        key = next((v for k, v in _NFM_SECTIONS.items() if heading.startswith(k)), None)
        if key is None:
            continue
        tokens = [t.strip() for t in re.findall(r"`([^`]+)`", section)]
        _reject_dups(heading, tokens)
        result[key] = tokens
    missing = set(_NFM_SECTIONS.values()) - set(result)
    if missing:
        raise ValueError(f"性味归经词表缺少小节: {missing}")
    return result


def parse_benefits(text: str) -> dict[str, str]:
    """解析功效表,返回 词条→白话 映射(合并全部纲,词条已去 ★)。"""
    benefits: dict[str, str] = {}
    for row in _parse_table_rows(text):
        if len(row) < 2 or row[0] == "词条":
            continue
        term = _strip_star(row[0])
        if term in benefits:
            raise ValueError(f"功效词条重复: {term}")
        benefits[term] = row[1]
    return benefits


@dataclass(frozen=True)
class Vocab:
    """六份词表聚合后的封闭值域。"""

    solar_terms: tuple[str, ...]
    categories: tuple[str, ...]
    dish_categories: tuple[str, ...]
    cuisines: tuple[str, ...]
    natures: tuple[str, ...]
    flavors: tuple[str, ...]
    meridians: tuple[str, ...]
    benefits: dict[str, str]

    @property
    def solar_term_index(self) -> dict[str, int]:
        """节气名 → 0 基序号,用于校验 solar_terms 升序。"""
        return {t: i for i, t in enumerate(self.solar_terms)}


def load_vocab(vocab_dir: Path | None = None) -> Vocab:
    """加载 data/vocab/ 下六份词表,任一文件缺失或格式损坏则抛错。"""
    base = vocab_dir or VOCAB_DIR
    nfm = parse_nature_flavor_meridian((base / "词表-性味归经.md").read_text(encoding="utf-8"))
    return Vocab(
        solar_terms=tuple(parse_solar_terms((base / "词表-节气.md").read_text(encoding="utf-8"))),
        categories=tuple(parse_categories((base / "词表-分类.md").read_text(encoding="utf-8"))),
        dish_categories=tuple(
            parse_categories(
                (base / "词表-菜品分类.md").read_text(encoding="utf-8"), header="厨师"
            )
        ),
        cuisines=tuple(
            parse_categories((base / "词表-菜系.md").read_text(encoding="utf-8"), header="菜系")
        ),
        natures=tuple(nfm["natures"]),
        flavors=tuple(nfm["flavors"]),
        meridians=tuple(nfm["meridians"]),
        benefits=parse_benefits((base / "词表-功效.md").read_text(encoding="utf-8")),
    )
