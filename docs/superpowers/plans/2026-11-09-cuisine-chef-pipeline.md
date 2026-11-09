# 美食大厨流水线实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地「美食大厨」三模式流水线(给菜系/给菜名/给食材)——独立提示词、独立核验 Agent、story/image 字段、审核台厨师切换,零侵入健康厨师线。

**Architecture:** 完全同构复制现有菜品流水线(chef→validate→verify→修订轮→入库待审核):新建 `cuisine_chef`/`cuisine_verify`/`cuisine_pipeline` 三个独立模块 + 四个提示词文件(共享段 include),`dish` 表加 story/image 可空列,审核台 API 加 `chef` 分发字段保持向后兼容。设计依据:`docs/superpowers/specs/2026-11-09-cuisine-chef-pipeline-design.md`。

**Tech Stack:** Python 3 + Flask + PyMySQL + Jinja2(模式模板用 `Environment(FileSystemLoader)` 以支持 include)+ OpenAI 兼容 Chat 客户端;pytest + FakeJSONClient 注入;MySQL(schema.sql + 手动升级 SQL)。

**测试命令:** 在项目根目录执行 `python3 -m pytest tests/ -v`。

---

### Task 1: 菜系词表与 vocab 加载

**Files:**
- Create: `data/vocab/词表-菜系.md`
- Modify: `shike/vocab.py`(Vocab 字段 + load_vocab)
- Modify: `data/vocab/词表-菜品分类.md`(定位说明「规划中」→「本期」)
- Test: `tests/test_vocab.py`

- [ ] **Step 1: 写失败测试**

在 `tests/test_vocab.py` 末尾追加:

```python
def test_parse_cuisines():
    cuisines = parse_categories(_read("词表-菜系.md"), header="菜系")
    assert len(cuisines) == 18
    assert cuisines[:8] == ["鲁菜", "川菜", "粤菜", "苏菜", "闽菜", "浙菜", "湘菜", "徽菜"]
    assert "家常菜" in cuisines and "东北菜" in cuisines
    assert "日式" in cuisines and "西餐" in cuisines


def test_load_vocab_includes_cuisines():
    assert VOCAB.cuisines[:2] == ("鲁菜", "川菜")
    assert "西餐" in VOCAB.cuisines
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_vocab.py -v`
Expected: FAIL —— `test_parse_cuisines` 因词表文件不存在报 `FileNotFoundError`;`test_load_vocab_includes_cuisines` 报 `AttributeError: 'Vocab' object has no attribute 'cuisines'`

- [ ] **Step 3: 创建词表文件**

创建 `data/vocab/词表-菜系.md`:

```markdown
# 词表 · 菜系

> 用途:美食大厨线的成菜菜系值域(`dish.style` 第一段)与审核台「给菜系」模式的封闭选项。**单选**。

| 菜系 | 说明 |
| --- | --- |
| 鲁菜 | 八大菜系之首,葱烧、爆炒见长,讲究火候与吊汤 |
| 川菜 | 一菜一格,百菜百味,麻辣鲜香但味型远不止麻辣 |
| 粤菜 | 清鲜嫩滑爽,重本味,白灼、煲汤、烧腊见长 |
| 苏菜 | 淮扬格调,浓而不腻、淡而不薄,刀工精细 |
| 闽菜 | 汤菜考究,红糟调味,佛跳墙为代表的醇厚鲜甜 |
| 浙菜 | 清鲜脆嫩,保持原味,杭帮菜为代表 |
| 湘菜 | 香辣酸腊,重油重色,煨炖出神 |
| 徽菜 | 重油重色重火功,擅烧炖,山珍河鲜 |
| 家常菜 | 各地家庭日常做法,不拘一系,好吃易做 |
| 东北菜 | 量大实在,炖菜酱香,锅包肉为代表 |
| 西北菜 | 面食牛羊肉为主,香粗豪放,孜然与醋香 |
| 云贵菜 | 酸辣鲜野,菌子与酸汤,民族风味 |
| 潮汕菜 | 精细鲜淡,卤水与生腌,工夫汤 |
| 客家菜 | 咸香肥实,盐焗酿菜,山居风味 |
| 日式 | 和风料理,出汁与旬之味,清淡鲜甜 |
| 韩式 | 韩式料理,发酵酱料与烤肉,辣中带甜 |
| 东南亚 | 酸辣香浓,椰浆香茅鱼露,泰越风味 |
| 西餐 | 欧美经典,煎烤焗,黄油奶油与香草 |
```

- [ ] **Step 4: 实现 vocab 加载**

`shike/vocab.py` 两处修改:

① `Vocab` dataclass 的 `dish_categories` 字段后加一行:

```python
    dish_categories: tuple[str, ...]
    cuisines: tuple[str, ...]
```

② `load_vocab` 的 `dish_categories=tuple(...)` 之后加:

```python
        cuisines=tuple(
            parse_categories((base / "词表-菜系.md").read_text(encoding="utf-8"), header="菜系")
        ),
```

并把 `data/vocab/词表-菜品分类.md` 中美食大厨行的「(规划中)」改为「(本期)」。

- [ ] **Step 5: 运行测试确认通过**

Run: `python3 -m pytest tests/test_vocab.py -v`
Expected: PASS(全部)

- [ ] **Step 6: 提交**

```bash
git add data/vocab/词表-菜系.md data/vocab/词表-菜品分类.md shike/vocab.py tests/test_vocab.py
git commit -m "feat: 菜系词表——18项封闭值域,vocab.cuisines加载

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: validate_dish 扩展(story 字段 + cuisines 参数)

**Files:**
- Modify: `shike/validate.py`
- Test: `tests/test_dish_validate.py`

- [ ] **Step 1: 写失败测试**

在 `tests/test_dish_validate.py` 末尾追加:

```python
STORY = "入口煳辣荔枝味,酸甜微辣平衡,鸡丁滑嫩、花生酥脆;相传自清代丁宝桢家厨,川菜味型的教科书。"


def test_story_is_optional_known_field_with_limit():
    record = {**VALID, "story": STORY}
    assert validate_dish(record, VOCAB) == []
    errors = validate_dish({**record, "story": "长" * 501}, VOCAB)
    assert any(e.startswith("story:") for e in errors)


def test_cuisines_param_checks_style_first_segment():
    cuisines = ("川菜", "粤菜", "家常菜")
    ok = validate_dish({**VALID, "style": "川菜,煳辣快炒", "story": STORY}, VOCAB, cuisines=cuisines)
    assert ok == []
    bad = validate_dish({**VALID, "style": "日式,炒", "story": STORY}, VOCAB, cuisines=cuisines)
    assert any("style" in e and "菜系词表" in e for e in bad)


def test_cuisines_param_default_keeps_style_free():
    record = {**VALID, "style": "随便写,炖"}
    assert validate_dish(record, VOCAB) == []
    assert validate_dish(record, VOCAB, cuisines=None) == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_dish_validate.py -v`
Expected: FAIL —— story 被判「未知字段」;`validate_dish() got an unexpected keyword argument 'cuisines'`

- [ ] **Step 3: 实现**

`shike/validate.py` 三处修改:

① 可选字段与长度上限:

```python
DISH_OPTIONAL_FIELDS = ("excluded", "extras", "caution", "story")
DISH_ALL_FIELDS = DISH_REQUIRED_FIELDS + DISH_OPTIONAL_FIELDS
DISH_TEXT_LIMITS = {"name": 100, "style": 100, "benefits": 500, "caution": 500, "story": 500}
```

② 签名加参数:

```python
def validate_dish(record: dict, vocab: Vocab, cuisines: tuple[str, ...] | None = None) -> list[str]:
    """校验菜谱记录的结构、词表值域与长度上限; cuisines 提供时校验 style 菜系位。"""
```

③ 函数体末尾(solar_terms 校验之后、`return errors` 之前)加:

```python
    if cuisines:
        style = record.get("style")
        if isinstance(style, str) and style.strip():
            first = style.split(",")[0].strip()
            if first not in set(cuisines):
                errors.append(f"style: 菜系位「{first}」不在菜系词表中")

    return errors
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python3 -m pytest tests/test_dish_validate.py tests/test_dish_pipeline.py -v`
Expected: PASS(新增测试 + 既有健康线测试全部不回归)

- [ ] **Step 5: 提交**

```bash
git add shike/validate.py tests/test_dish_validate.py
git commit -m "feat: validate_dish支持story字段与cuisines菜系位校验参数

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: schema/升级 SQL/仓储扩展

**Files:**
- Modify: `db/schema.sql`(dish 表 CREATE TABLE 加两列)
- Create: `db/upgrade/2026-11-09-dish-story-image.sql`(现有库迁移)
- Modify: `shike/repository.py`(story 入库 + 3 个新函数)

- [ ] **Step 1: 更新 schema.sql**

`db/schema.sql` 中 dish 表的 `benefits` 行后、`caution` 行前插入两行:

```sql
  `benefits`     VARCHAR(500) NOT NULL COMMENT '养生好处,中医性味+现代营养多角度',
  `story`        VARCHAR(500) DEFAULT NULL COMMENT '风味与文化背景,美食大厨出品',
  `image`        VARCHAR(500) DEFAULT NULL COMMENT '菜品图片URL/路径',
  `caution`      VARCHAR(500) DEFAULT NULL COMMENT '忌口提示,不适宜人群,可空',
```

- [ ] **Step 2: 创建升级 SQL**

创建 `db/upgrade/2026-11-09-dish-story-image.sql`(执行环境无 DB 连接,由用户在 MySQL 中手动执行):

```sql
USE `shike`;

ALTER TABLE `dish`
  ADD COLUMN `story` VARCHAR(500) DEFAULT NULL COMMENT '风味与文化背景,美食大厨出品' AFTER `benefits`,
  ADD COLUMN `image` VARCHAR(500) DEFAULT NULL COMMENT '菜品图片URL/路径' AFTER `story`;
```

- [ ] **Step 3: 扩展仓储**

`shike/repository.py` 三处修改:

① `_DISH_FIELDS` 加 `story`(insert_dish 按非空字段拼列,健康线不传则列不存在,零影响):

```python
_DISH_FIELDS = (
    "name",
    "category",
    "main_ingredients",
    "extras",
    "steps",
    "calories",
    "benefits",
    "story",
    "caution",
    "style",
    "solar_terms",
    "remark",
)
```

② `update_dish_status` 函数后追加三个函数:

```python
def list_dish_names_by_cuisine(cuisine: str) -> list[str]:
    """返回 style 菜系位为给定菜系的全部菜名(含所有审核状态,已驳回也避重),按 id 升序。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name FROM dish WHERE style LIKE %s ORDER BY id", (f"{cuisine},%",)
            )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def find_dish_by_name(name: str) -> dict | None:
    """按菜名查一枚菜品(任意审核状态),用于菜名模式入库预检;不命中返回 None。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(
                "SELECT id,name,category,status FROM dish WHERE name=%s LIMIT 1", (name,)
            )
            return cur.fetchone()
    finally:
        conn.close()


def update_dish_image(name: str, image: str | None) -> bool:
    """更新菜品图片 URL;image 传 None 清空。返回是否命中。"""
    conn = pymysql.connect(**db_config())
    try:
        with conn.cursor() as cur:
            affected = cur.execute(
                "UPDATE dish SET image=%s WHERE name=%s", (image, name)
            )
        conn.commit()
        return affected > 0
    finally:
        conn.close()
```

- [ ] **Step 4: 运行全量测试确认无回归**

Run: `python3 -m pytest tests/ -v`
Expected: PASS(仓储无单测,既有测试全部绿即可)

- [ ] **Step 5: 提交**

```bash
git add db/schema.sql db/upgrade/2026-11-09-dish-story-image.sql shike/repository.py
git commit -m "feat: dish表加story/image列与升级SQL,仓储加菜系名单/查名/补图函数

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 美食大厨提示词四文件

**Files:**
- Create: `prompts/cuisine_common.jinja2`
- Create: `prompts/cuisine_by_cuisine.jinja2`
- Create: `prompts/cuisine_by_name.jinja2`
- Create: `prompts/cuisine_by_ingredient.jinja2`

提示词是本流水线的核心资产,文案按下文逐字落地,不得随意缩水。本任务无独立测试,由 Task 5 的渲染断言验收。

- [ ] **Step 1: 创建共享段**

创建 `prompts/cuisine_common.jinja2`:

```jinja2
底线(绝对不可触碰,与任何其他目标都不可交换):
1. 禁止食物相克或搭配禁忌的组合(如柿蟹同食、萝卜与人参同炖等经典禁忌)
2. 禁止任何食品安全风险(未煮熟的四季豆/豆浆、易中毒而处理不当的食材等)
3. 不编造:正宗做法、典故、流派说法不确定时,如实写明「存在分歧」,禁止把不确定的内容当定论输出
4. 分量与做法如实交代,不表演性夸饰

方向(尽力优化即可,不过分、不较真):
1. 好吃第一:火候、调味、锅气都是为了让这道菜成立;不为省事阉割关键工序
2. 正宗为骨架,家常可复刻为血肉:在家庭灶台、常规厨具条件下能做出八九成风味;确实无法家庭化的关键步骤,如实说明并给出最接近的替代做法
3. 教学为魂:让照着步骤做的人,第一次就能做对

制作步骤是本菜谱最重的字段——训练做菜能力的核心:
- 每步不仅写「做什么」,还要写「为什么」:高温爆炒是为了锁住肉汁、小火慢炖是为了胶质溶出、起锅前才下盐是为了避免出水
- 刀工给规格(逆纹切约3mm、滚刀块约3cm),火候给状态判断(油七成热/筷子插入冒细密气泡/汤汁收至挂勺)
- 常见失败点与补救写在对应步骤内(如「若已粘锅,立即离火,不要加水」)
- 关键调味顺序、腌制与去腥预处理写清,让照做的人知其然也知其所以然

字段说明:
- name: 菜名,体现这道菜的卖点
- main_ingredients: 主料数组,每项 {"name":"食材名","amount":"每份定量"}
- extras: 辅料/调料数组,每项 {"name":"名称","amount":"定量"};无则空数组
- excluded: 弃置候选食材数组,每项 {"name":"食材名","reason":"弃置原因"};仅当任务给了候选食材池时才可能非空,否则恒为空数组
- steps: 制作步骤,字符串数组,按顺序;按上方教学要求写,每步聚焦一件事
- calories: 每份热量估算,整数,单位千卡,如实估报(本线没有低卡指标,不准虚报即可)
- benefits: 养生好处,一段话,中医性味与现代营养多角度,不夸大功效
- caution: 忌口提示,不适宜人群(如 脾胃虚寒者少食);无则 null
- story: 风味与文化背景,一段话:先画像(味型层次、口感、余味),再讲来历/流派/为何经典;≤200字
- style: 菜系+烹饪方式,半角逗号分隔、无空格,菜系必须取自下方封闭菜系清单,烹饪方式自由(如 "川菜,煳辣快炒"、"家常,炖")
- solar_terms: 这道菜最当令的节气,半角逗号分隔的字符串(不是数组)、无空格、按节气先后升序,如 "立冬,小雪";全年皆宜也要给出最当令的节气

封闭选项:
- 菜系(按序):{{ cuisines | join("、") }}
- 节气(按序):{{ solar_terms | join("、") }}

铁律:
1. 只输出一个 JSON 对象,不带 markdown 代码块标记、注释或任何额外文字
2. 不确定的内容宁可不写,不编造

{% if pantry %}
库内食材档案(以下候选食材已收录于食刻食材库,性味归经与功效以库内记载为准,benefits 优先据此展开):
{% for item in pantry %}
- {{ item.name }}:性味 {{ item.nature }}/{{ item.flavor }},归经 {{ item.meridian }},功效 {{ item.benefits or "无记载" }}{% if item.caution %},注意 {{ item.caution }}{% endif %}
{% endfor %}
{% endif %}

{% if feedback %}
修订要求:上一版未通过,原因如下,请逐条修正后重新输出完整 JSON:
{% for item in feedback %}
- {{ item }}
{% endfor %}
{% endif %}
```

- [ ] **Step 2: 创建给菜系模板**

创建 `prompts/cuisine_by_cuisine.jinja2`:

```jinja2
你是「美食大厨」——行走于主流菜系与地方风味之间的顶级厨师,兼是一位好老师,只输出 JSON。
本次任务:从「{{ cuisine }}」中选一道最能代表该菜系技艺与风味的经典菜,写出可复刻的正宗家常做法;选它的理由(技艺与风味的代表性)写进 story。
style 的菜系位必须为「{{ cuisine }}」。

{% include "cuisine_common.jinja2" %}

{% if known_names %}
以下菜品已收录于食刻菜谱库,本次不得重复,请另择该菜系的经典:
{% for name in known_names %}
- {{ name }}
{% endfor %}
{% endif %}
```

- [ ] **Step 3: 创建给菜名模板**

创建 `prompts/cuisine_by_name.jinja2`:

```jinja2
你是「美食大厨」——行走于主流菜系与地方风味之间的顶级厨师,兼是一位好老师,只输出 JSON。
本次任务:为菜名「{{ name }}」写出公认正宗、家常条件下可复刻的做法。
- 若存在流派分歧,选流传最广的主流做法,分歧本身写进 story
- 防编造契约(与任何目标不可交换):若这道菜不存在、或你对它没有把握,不要硬编——改输出 {"not_found": true, "reason": "一句话说明为何无法确认这道菜"},此外不输出任何其他内容

{% include "cuisine_common.jinja2" %}
```

- [ ] **Step 4: 创建给食材模板**

创建 `prompts/cuisine_by_ingredient.jinja2`:

```jinja2
你是「美食大厨」——行走于主流菜系与地方风味之间的顶级厨师,兼是一位好老师,只输出 JSON。
本次任务:从给定候选食材中挑选搭配最合理的组合,做一道有菜系功底的家常菜。
- 候选食材是池子而非清单:至少用一个;不够搭配的可弃置,但必须给出原因,不得无理由乱弃
- 菜系由你据成菜风格判定,写入 style(仍须取自下方封闭菜系清单)

{% include "cuisine_common.jinja2" %}

候选食材:{{ ingredients | join("、") }}
```

- [ ] **Step 5: 提交**

```bash
git add prompts/cuisine_common.jinja2 prompts/cuisine_by_cuisine.jinja2 prompts/cuisine_by_name.jinja2 prompts/cuisine_by_ingredient.jinja2
git commit -m "feat: 美食大厨提示词——共享段(人设/底线/教学步骤/字段/铁律)与三模式模板

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: CuisineChef Agent

**Files:**
- Create: `llm/cuisine_chef.py`
- Test: `tests/test_cuisine_chef.py`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_cuisine_chef.py`:

```python
import json

from llm.cuisine_chef import CuisineChef
from tests.fakes import FakeJSONClient

PANTRY = [
    {
        "name": "白萝卜",
        "nature": "凉",
        "flavor": "辛,甘",
        "meridian": "肺,胃",
        "benefits": "下气消食",
        "caution": "脾胃虚寒者少食",
    }
]


def make_chef(response="{}"):
    return CuisineChef(client=FakeJSONClient(response))


def test_cuisine_mode_renders_cuisine_template():
    chef = make_chef()
    chef.create("cuisine", {"cuisine": "川菜"}, known_names=["麻婆豆腐", "回锅肉"])
    user = chef.client.last_user
    assert "美食大厨" in user
    assert "从「川菜」中选一道" in user
    assert "不得重复" in user and "回锅肉" in user
    assert "川菜" in user.split("封闭选项")[1], "封闭选项应含菜系清单"
    assert "候选食材:" not in user and "not_found" not in user


def test_name_mode_renders_name_template():
    chef = make_chef()
    chef.create("name", {"name": "宫保鸡丁"})
    user = chef.client.last_user
    assert "为菜名「宫保鸡丁」" in user
    assert "not_found" in user, "菜名模式必须带防编造契约"
    assert "候选食材:" not in user and "不得重复" not in user


def test_ingredient_mode_renders_ingredient_template():
    chef = make_chef()
    chef.create("ingredient", {"ingredients": ["白萝卜", "鸡胸肉"]})
    user = chef.client.last_user
    assert "候选食材:白萝卜、鸡胸肉" in user
    assert "not_found" not in user


def test_prompt_contains_teaching_and_story_requirements():
    chef = make_chef()
    chef.create("cuisine", {"cuisine": "川菜"})
    user = chef.client.last_user
    assert "为什么" in user and "失败点" in user, "教学性步骤要求必须在共享段"
    assert "story" in user and "≤200字" in user


def test_prompt_contains_pantry_and_feedback():
    chef = make_chef()
    chef.create(
        "ingredient",
        {"ingredients": ["白萝卜"]},
        feedback=["story 超长"],
        pantry=PANTRY,
    )
    user = chef.client.last_user
    assert "库内食材档案" in user and "脾胃虚寒者少食" in user
    assert "修订要求" in user and "story 超长" in user


def test_create_returns_parsed_record():
    chef = CuisineChef(
        client=FakeJSONClient(json.dumps({"name": "宫保鸡丁", "story": "经典川味"}, ensure_ascii=False))
    )
    record = chef.create("name", {"name": "宫保鸡丁"})
    assert record["name"] == "宫保鸡丁"


def test_create_passthrough_not_found():
    chef = CuisineChef(client=FakeJSONClient('{"not_found": true, "reason": "查无此菜"}'))
    record = chef.create("name", {"name": "不存在的菜"})
    assert record == {"not_found": True, "reason": "查无此菜"}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_cuisine_chef.py -v`
Expected: FAIL —— `ModuleNotFoundError: No module named 'llm.cuisine_chef'`

- [ ] **Step 3: 实现**

创建 `llm/cuisine_chef.py`:

```python
from jinja2 import Environment, FileSystemLoader

from llm.client import LLMClient
from shike.vocab import Vocab, load_vocab

PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"
MODE_PROMPTS = {
    "cuisine": "cuisine_by_cuisine.jinja2",
    "name": "cuisine_by_name.jinja2",
    "ingredient": "cuisine_by_ingredient.jinja2",
}
SYSTEM = "你是「美食大厨」——主流菜系与地方风味的顶级厨师兼烹饪教师,只输出 JSON。"
_ENV = Environment(loader=FileSystemLoader(PROMPT_DIR))


class CuisineChef:
    """按三种模式(给菜系/给菜名/给食材)生成可复刻的菜谱 JSON,不校验内容。"""

    def __init__(self, client: LLMClient | None = None, vocab: Vocab | None = None):
        self.client = client or LLMClient.for_role("cuisine_chef")
        self.vocab = vocab or load_vocab()

    def create(
        self,
        mode: str,
        payload: dict,
        feedback: list[str] | None = None,
        pantry: list[dict] | None = None,
        known_names: list[str] | None = None,
    ) -> dict:
        """按模式渲染提示词并调用模型;payload 按 mode 取 cuisine/name/ingredients。"""
        template = _ENV.get_template(MODE_PROMPTS[mode])
        user = template.render(
            solar_terms=self.vocab.solar_terms,
            cuisines=self.vocab.cuisines,
            feedback=feedback,
            pantry=pantry or [],
            known_names=known_names or [],
            **payload,
        )
        return self.client.chat_json(SYSTEM, user)
```

文件顶部 import 区需补 `from pathlib import Path`:

```python
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python3 -m pytest tests/test_cuisine_chef.py -v`
Expected: PASS(全部)

- [ ] **Step 5: 提交**

```bash
git add llm/cuisine_chef.py tests/test_cuisine_chef.py
git commit -m "feat: 美食大厨Agent——三模式模板渲染,FileSystemLoader支持共享段include

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 美食大厨核验 Agent

**Files:**
- Create: `prompts/cuisine_verify.jinja2`
- Create: `llm/cuisine_verify.py`
- Test: `tests/test_cuisine_verify.py`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_cuisine_verify.py`:

```python
import json

from llm.cuisine_verify import CuisineVerifier
from tests.fakes import FakeJSONClient

PASS = '{"verdict":"pass","problems":[]}'
DOUBT = '{"verdict":"存疑","problems":["关键步骤未讲明为什么","story 典派说法存疑"]}'


def test_verify_prompt_contains_mode_context_and_dish():
    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verdict, problems = verifier.verify(
        {"name": "宫保鸡丁", "style": "川菜,炒"}, "cuisine", "川菜"
    )
    assert verdict == "pass" and problems == []
    user = verifier.client.last_user
    assert "按菜系生成" in user and "川菜" in user and "宫保鸡丁" in user

    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "ingredient", ["白萝卜", "鸡胸肉"])
    assert "候选食材:白萝卜、鸡胸肉" in verifier.client.last_user

    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "name", "宫保鸡丁")
    assert "按菜名生成" in verifier.client.last_user


def test_verify_prompt_contains_no_calorie_line_philosophy():
    verifier = CuisineVerifier(client=FakeJSONClient(PASS))
    verifier.verify({"name": "汤"}, "name", "汤")
    user = verifier.client.last_user
    assert "没有低卡指标" in user and "造假" in user


def test_verify_treats_bad_output_as_fail():
    verifier = CuisineVerifier(client=FakeJSONClient("不是 JSON"))
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "fail" and problems


def test_verify_returns_doubt_verdict():
    verifier = CuisineVerifier(client=FakeJSONClient(DOUBT))
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "存疑" and len(problems) == 2


def test_verify_rejects_illegal_verdict():
    verifier = CuisineVerifier(
        client=FakeJSONClient(json.dumps({"verdict": "还行", "problems": []}, ensure_ascii=False))
    )
    verdict, problems = verifier.verify({"name": "汤"}, "name", "汤")
    assert verdict == "fail" and problems == ["验证 LLM verdict 不合法"]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_cuisine_verify.py -v`
Expected: FAIL —— `ModuleNotFoundError: No module named 'llm.cuisine_verify'`

- [ ] **Step 3: 创建核验提示词**

创建 `prompts/cuisine_verify.jinja2`:

```jinja2
你将核验一道菜的结构化菜谱 JSON(它已通过结构与词表校验),它出自「美食大厨」——主流菜系与地方风味、正宗与教学线。请为它把关。

判定哲学:底线是铁的,其余是方向。
- 判 fail 仅限四类硬伤:①食物相克或搭配禁忌 ②食品安全风险 ③造假 ④步骤明显不可执行
- 「造假」在本线包含:把不确定的正宗做法/典故/流派当定论输出、步骤编造不存在的效果、story 编造来历、calories 与食材分量明显不符(疑似虚报)
- 简化魔改、不够地道、讲解不够细,只是方向瑕疵,不构成否决;无充分把握判 存疑,不轻易 fail
- 本线没有低卡指标,热量高低本身不是问题

核查维度(按优先级):
1. 食物相克与搭配禁忌:主料之间、主料与常见药食(人参、蜂蜜等)是否存在经典禁忌组合
2. 食品安全:必须彻底煮熟的食材(四季豆、豆浆等)步骤是否给足火候;生食风险、易致敏食材是否在 caution 有提示
3. 正宗性与技法:技法(火候/刀工/调味)是否符合该菜系通行做法;涉及流派分歧的,是否选了主流做法并如实标注;story 的典故是否有常识依据、有无张冠李戴
4. 步骤可执行性:顺序合理、火候时机可操作、份量与步骤自洽、照做能成菜
5. 教学完整性:关键步骤是否讲出「为什么」、失败点提示是否有常识依据——缺失归入 存疑 提醒,编造的效果才归入 fail
6. 字段一致性:style 菜系位与成菜是否相符;solar_terms 与主料当令是否匹配;excluded 弃置理由是否成立;该提示的忌口人群是否遗漏

铁律:
1. 三态判定:存在四类硬伤之一判 fail;常识或文献存在分歧、或你无充分把握判 存疑;其余判 pass
2. problems 只列导致 fail 或 存疑 的具体条目,逐条写清位置与理由,禁止写「此项无误」之类的核对评注
3. 只输出 JSON:{"verdict":"pass"|"fail"|"存疑","problems":["问题描述",...]};verdict 为 pass 时 problems 为空数组;不要输出任何其他文字

任务模式:{{ mode_label }}
核验上下文:{{ context }}

待核验菜谱:
{{ dish_json }}
```

- [ ] **Step 4: 实现 CuisineVerifier**

创建 `llm/cuisine_verify.py`(与 dish_verify.py 同构独立,输出契约一致):

```python
import json
from pathlib import Path

from jinja2 import Template

from llm.client import LLMClient

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "cuisine_verify.jinja2"
SYSTEM = "你是深谙各菜系正宗技法的菜谱审校专家,兼通中医食疗,只输出 JSON。"
_MODE_LABELS = {
    "cuisine": "按菜系生成",
    "name": "按菜名生成",
    "ingredient": "按候选食材生成",
}


class CuisineVerifier:
    """对已通过结构与词表校验的美食大厨菜谱做正宗/安全/造假/可执行核验。"""

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient.for_role("cuisine_verify")

    def verify(self, record: dict, mode: str, context) -> tuple[str, list[str]]:
        """返回 (verdict: pass/fail/存疑, 问题列表);模型输出不合约定视为 fail。"""
        if isinstance(context, list):
            context = "候选食材:" + "、".join(str(c) for c in context)
        template = Template(PROMPT_FILE.read_text(encoding="utf-8"))
        user = template.render(
            mode_label=_MODE_LABELS.get(mode, mode),
            context=context,
            dish_json=json.dumps(record, ensure_ascii=False, indent=2),
        )
        try:
            result = self.client.chat_json(SYSTEM, user)
        except ValueError:
            return "fail", ["验证 LLM 输出不是合法 JSON"]

        problems = result.get("problems")
        if not isinstance(problems, list):
            problems = [str(problems)] if problems else []
        verdict = result.get("verdict")
        if verdict not in ("pass", "fail", "存疑"):
            return "fail", ["验证 LLM verdict 不合法"]
        return verdict, [str(p) for p in problems]
```

- [ ] **Step 5: 运行测试确认通过**

Run: `python3 -m pytest tests/test_cuisine_verify.py -v`
Expected: PASS(全部)

- [ ] **Step 6: 提交**

```bash
git add prompts/cuisine_verify.jinja2 llm/cuisine_verify.py tests/test_cuisine_verify.py
git commit -m "feat: 美食大厨核验Agent——四类硬伤含正宗性造假,无低卡线,三态契约与健康线一致

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: 三模式流水线 CuisinePipeline

**Files:**
- Create: `llm/cuisine_pipeline.py`
- Test: `tests/test_cuisine_pipeline.py`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_cuisine_pipeline.py`:

```python
import json

import pytest

from llm.cuisine_chef import CuisineChef
from llm.cuisine_pipeline import CuisinePipeline
from llm.cuisine_verify import CuisineVerifier
from shike import reject_log, repository
from tests.fakes import FakeJSONClient

STORY = "入口煳辣荔枝味,酸甜微辣平衡,鸡丁滑嫩、花生酥脆;相传自清代丁宝桢家厨,川菜味型的教科书。"

CREATED = json.dumps(
    {
        "name": "宫保鸡丁",
        "main_ingredients": [
            {"name": "鸡胸肉", "amount": "1块"},
            {"name": "花生米", "amount": "1把"},
        ],
        "excluded": [],
        "extras": [{"name": "干辣椒", "amount": "8根"}, {"name": "花椒", "amount": "20粒"}],
        "steps": [
            "鸡胸肉逆纹切1.5cm丁,加盐料酒蛋清抓匀——逆纹切断肌纤维才嫩",
            "油七成热下干辣椒花椒爆香,约10秒出香即下鸡丁,晚则煳",
            "大火快炒1分钟至鸡丁变色,烹入碗汁,收至挂勺",
        ],
        "calories": 380,
        "benefits": "鸡胸肉高蛋白低脂,花椒温中散寒",
        "caution": None,
        "story": STORY,
        "style": "川菜,煳辣快炒",
        "solar_terms": "立冬,小雪",
    },
    ensure_ascii=False,
)
NAME_CREATED = json.dumps({**json.loads(CREATED), "excluded": []}, ensure_ascii=False)
PASS = '{"verdict":"pass","problems":[]}'
DOUBT = '{"verdict":"存疑","problems":["关键步骤未讲明为什么"]}'


def make_pipeline(create_response=CREATED, verify_response=PASS):
    chef = CuisineChef(client=FakeJSONClient(create_response))
    verifier = CuisineVerifier(client=FakeJSONClient(verify_response))
    return CuisinePipeline(chef=chef, verifier=verifier), chef


@pytest.fixture(autouse=True)
def _stub_repository(monkeypatch):
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: [])
    monkeypatch.setattr(repository, "list_dish_names_by_cuisine", lambda cuisine: [])
    monkeypatch.setattr(repository, "find_dish_by_name", lambda name: None)
    monkeypatch.setattr(repository, "insert_dish", lambda r: None)


def test_name_mode_invalid_input_short_circuits():
    pipeline, chef = make_pipeline()
    for bad in ("", "  ", "宫保鸡丁,麻婆豆腐", "宫保鸡丁、回锅肉", "A" * 101, None):
        result = pipeline.run("name", {"name": bad})
        assert result["stage"] == "invalid_input", f"{bad!r} 应不合法"
    assert chef.client.calls == 0


def test_name_mode_duplicate_precheck_skips_llm(monkeypatch):
    monkeypatch.setattr(repository, "find_dish_by_name", lambda name: {"name": name})
    pipeline, chef = make_pipeline()
    result = pipeline.run("name", {"name": "宫保鸡丁"})
    assert result["stage"] == "duplicate" and result["name"] == "宫保鸡丁"
    assert chef.client.calls == 0


def test_name_mode_not_found_short_circuits_and_logs(monkeypatch):
    logged = []
    monkeypatch.setattr(
        reject_log, "log_reject",
        lambda name, stage, detail, entity="食材": logged.append((name, stage, entity)),
    )
    pipeline, chef = make_pipeline(create_response='{"not_found": true, "reason": "查无此菜"}')
    result = pipeline.run("name", {"name": "不存在的菜"})
    assert result["stage"] == "not_found" and result["reason"] == "查无此菜"
    assert chef.client.calls == 1
    assert logged == [("不存在的菜", "not_found", "美食大厨")]


def test_cuisine_mode_pass_inserts_with_known_names_and_story(monkeypatch):
    monkeypatch.setattr(repository, "list_dish_names_by_cuisine", lambda c: ["麻婆豆腐"])
    pipeline, chef = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted" and result["name"] == "宫保鸡丁"
    user = chef.client.last_user
    assert "不得重复" in user and "麻婆豆腐" in user
    db = result["dish"]
    assert db["category"] == "美食大厨"
    assert db["story"] == STORY
    assert db["main_ingredients"] == "鸡胸肉 1块,花生米 1把"
    assert db["calories"] == "约380千卡"
    assert db["steps"].startswith("1. ")
    assert db["remark"] is None


def test_cuisine_mode_style_mismatch_feeds_back(monkeypatch):
    bad = json.dumps({**json.loads(CREATED), "style": "粤菜,炒"}, ensure_ascii=False)
    pipeline, chef = make_pipeline(create_response=[bad, CREATED])
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "菜系位须为「川菜」" in chef.client.last_user
    assert chef.client.calls == 2


def test_name_mode_rejects_nonempty_excluded(monkeypatch):
    with_excluded = json.dumps(
        {**json.loads(CREATED), "excluded": [{"name": "菠菜", "reason": "不搭"}]},
        ensure_ascii=False,
    )
    pipeline, chef = make_pipeline(create_response=with_excluded)
    result = pipeline.run("name", {"name": "宫保鸡丁"})
    assert result["stage"] == "invalid"
    assert "本模式不应弃置食材" in " ".join(result["errors"])
    assert chef.client.calls == 4


def test_ingredient_mode_happy_path_with_pantry_and_excluded(monkeypatch):
    pantry = [{"name": "白萝卜", "nature": "凉", "flavor": "辛,甘",
               "meridian": "肺,胃", "benefits": "下气消食", "caution": None}]
    monkeypatch.setattr(repository, "find_ingredients_by_names", lambda names: pantry)
    pipeline, chef = make_pipeline()
    result = pipeline.run("ingredient", {"ingredients": ["白萝卜", "鸡胸肉", "白萝卜"]})
    assert result["stage"] == "inserted"
    assert "库内食材档案" in chef.client.last_user
    assert "候选食材:白萝卜、鸡胸肉" in chef.client.last_user


def test_ingredient_mode_requires_nonempty_ingredients():
    pipeline, chef = make_pipeline()
    for bad in ([], ["  "], "白萝卜"):
        result = pipeline.run("ingredient", {"ingredients": bad})
        assert result["stage"] == "invalid_input"
    assert chef.client.calls == 0


def test_cuisine_mode_rejects_cuisine_outside_vocab():
    pipeline, chef = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "黑暗料理"})
    assert result["stage"] == "invalid_input"
    assert chef.client.calls == 0


def test_doubt_inserts_with_remark(monkeypatch):
    pipeline, _ = make_pipeline(verify_response=DOUBT)
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert result["doubts"] == ["关键步骤未讲明为什么"]
    assert result["dish"]["remark"] == "关键步骤未讲明为什么"


def test_fail_revision_then_pass():
    pipeline, chef = make_pipeline(
        verify_response=['{"verdict":"fail","problems":["步骤缺少火候"]}', PASS]
    )
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "修订要求" in chef.client.last_user and "步骤缺少火候" in chef.client.last_user


def test_revision_cap_logs_reject_with_entity(monkeypatch):
    logged = []
    monkeypatch.setattr(
        reject_log, "log_reject",
        lambda name, stage, detail, entity="食材": logged.append((name, stage, entity)),
    )
    pipeline, chef = make_pipeline(verify_response='{"verdict":"fail","problems":["相克"]}')
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "rejected" and result["problems"] == ["相克"]
    assert chef.client.calls == 4
    assert logged == [("宫保鸡丁", "rejected", "美食大厨")]


def test_story_required_feedback():
    no_story = json.dumps({k: v for k, v in json.loads(CREATED).items() if k != "story"},
                          ensure_ascii=False)
    pipeline, chef = make_pipeline(create_response=[no_story, CREATED])
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "inserted"
    assert "story: 必填" in chef.client.last_user


def test_duplicate_on_insert_race(monkeypatch):
    from pymysql.err import IntegrityError

    def raise_duplicate(record):
        raise IntegrityError(1062, "Duplicate entry")

    monkeypatch.setattr(repository, "insert_dish", raise_duplicate)
    pipeline, _ = make_pipeline()
    result = pipeline.run("cuisine", {"cuisine": "川菜"})
    assert result["stage"] == "duplicate"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_cuisine_pipeline.py -v`
Expected: FAIL —— `ModuleNotFoundError: No module named 'llm.cuisine_pipeline'`

- [ ] **Step 3: 实现**

创建 `llm/cuisine_pipeline.py`:

```python
from pymysql.err import IntegrityError

from llm.cuisine_chef import CuisineChef
from llm.cuisine_verify import CuisineVerifier
from shike import reject_log, repository
from shike.validate import validate_dish

CATEGORY = "美食大厨"
MODES = ("cuisine", "name", "ingredient")
_NAME_SEPARATORS = (",", "，", "、", "/", "|")


def validate_name_input(name) -> str | None:
    """菜名输入合法性校验,返回错误说明;None 即合法。"""
    cleaned = str(name or "").strip()
    if not cleaned:
        return "菜名不能为空"
    if len(cleaned) > 100:
        return "菜名过长(>100字)"
    if any(sep in cleaned for sep in _NAME_SEPARATORS):
        return "菜名只能是单个菜名,不能包含逗号、顿号、斜杠等分隔符"
    return None


def to_db_record(record: dict, remark: str | None) -> dict:
    """把模型输出的嵌套菜谱 JSON 拼平为 dish 表的纯文本字段。"""
    mains = ",".join(f"{i['name']} {i['amount']}" for i in record["main_ingredients"])
    extras = ",".join(f"{i['name']} {i['amount']}" for i in record.get("extras") or [])
    steps = "\n".join(f"{n}. {s}" for n, s in enumerate(record["steps"], 1))
    return {
        "name": record["name"],
        "category": CATEGORY,
        "main_ingredients": mains,
        "extras": extras or None,
        "steps": steps,
        "calories": f"约{record['calories']}千卡",
        "benefits": record["benefits"],
        "caution": record.get("caution"),
        "story": record.get("story"),
        "style": record["style"],
        "solar_terms": record["solar_terms"],
        "remark": remark,
    }


class CuisinePipeline:
    """美食大厨入库流水线:三模式生成 → 结构与值域校验 → 正宗/安全核验 → 入库(待审核);未过可带反馈修订重试。"""

    def __init__(
        self,
        chef: CuisineChef | None = None,
        verifier: CuisineVerifier | None = None,
        max_revisions: int = 3,
    ):
        self.chef = chef or CuisineChef()
        self.verifier = verifier or CuisineVerifier()
        self.max_revisions = max_revisions

    def run(self, mode: str, payload: dict) -> dict:
        """跑完整流程;stage 取值 inserted/rejected/invalid/duplicate/invalid_input/not_found。"""
        if mode not in MODES:
            return {"stage": "invalid_input", "reason": f"未知模式:{mode}"}

        if mode == "name":
            reason = validate_name_input(payload.get("name"))
            if reason:
                return {"stage": "invalid_input", "reason": reason}
            name = str(payload["name"]).strip()
            if repository.find_dish_by_name(name):
                return {"stage": "duplicate", "name": name}
            payload = {"name": name}
        elif mode == "cuisine":
            cuisine = str(payload.get("cuisine") or "").strip()
            if cuisine not in self.chef.vocab.cuisines:
                return {"stage": "invalid_input", "reason": f"菜系「{cuisine}」不在菜系词表中"}
            payload = {"cuisine": cuisine}
        else:
            raw = payload.get("ingredients")
            if (
                not isinstance(raw, list)
                or not raw
                or not all(isinstance(i, str) and i.strip() for i in raw)
            ):
                return {"stage": "invalid_input", "reason": "ingredients 须为非空字符串数组"}
            payload = {"ingredients": list(dict.fromkeys(i.strip() for i in raw))}

        ingredients = payload.get("ingredients", [])
        pantry = repository.find_ingredients_by_names(ingredients) if ingredients else []
        known_names = (
            repository.list_dish_names_by_cuisine(payload["cuisine"])
            if mode == "cuisine"
            else None
        )
        context = payload.get("cuisine") or payload.get("name") or ingredients
        feedback = None
        last: dict = {"stage": "invalid", "errors": ["流水线未产出结果"]}

        for _ in range(1 + self.max_revisions):
            try:
                record = self.chef.create(
                    mode, payload, feedback=feedback, pantry=pantry, known_names=known_names
                )
            except ValueError as exc:
                feedback = [str(exc)]
                last = {"stage": "invalid", "errors": feedback}
                continue

            if record.get("not_found"):
                reason = str(record.get("reason") or "无法确认这道菜")
                reject_log.log_reject(
                    payload.get("name") or record.get("name") or "?",
                    "not_found", [reason], entity="美食大厨",
                )
                return {"stage": "not_found", "reason": reason,
                        "name": payload.get("name") or record.get("name")}

            record["category"] = CATEGORY
            errors = validate_dish(record, self.chef.vocab, cuisines=self.chef.vocab.cuisines)
            if not str(record.get("story") or "").strip():
                errors.append("story: 必填(风味与文化背景)")
            if mode == "cuisine":
                first = str(record.get("style") or "").split(",")[0].strip()
                if first != payload["cuisine"]:
                    errors.append(f"style: 菜系位须为「{payload['cuisine']}」,当前「{first}」")
            if mode != "ingredient" and record.get("excluded"):
                errors.append("excluded: 本模式不应弃置食材,须为空数组")
            if errors:
                feedback = errors
                last = {"stage": "invalid", "errors": errors,
                        "name": record.get("name"), "excluded": record.get("excluded", [])}
                continue

            verdict, problems = self.verifier.verify(record, mode, context)
            if verdict == "pass":
                return self._insert(mode, record, None)
            if verdict == "存疑":
                result = self._insert(mode, record, "\n".join(problems))
                if result["stage"] == "inserted":
                    result["doubts"] = problems
                    reject_log.log_reject(record["name"], "存疑", problems, entity="美食大厨")
                return result
            feedback = problems
            last = {"stage": "rejected", "problems": problems,
                    "name": record.get("name"), "excluded": record.get("excluded", [])}

        last["ingredients"] = ingredients
        last["mode"] = mode
        name_for_log = (
            last.get("name")
            or payload.get("name")
            or payload.get("cuisine")
            or ",".join(payload.get("ingredients", []))
        )
        reject_log.log_reject(
            name_for_log,
            last["stage"],
            last.get("errors") or last.get("problems") or [],
            entity="美食大厨",
        )
        return last

    def _insert(self, mode: str, record: dict, remark: str | None) -> dict:
        db = to_db_record(record, remark)
        try:
            repository.insert_dish(db)
        except IntegrityError:
            return {"stage": "duplicate", "name": record.get("name")}
        return {
            "mode": mode,
            "stage": "inserted",
            "name": record["name"],
            "dish": db,
            "excluded": record.get("excluded", []),
            "story": record.get("story"),
        }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python3 -m pytest tests/test_cuisine_pipeline.py -v`
Expected: PASS(全部;若 `test_duplicate_on_insert_race` 因模块属性替换与 fixture 冲突,改用 monkeypatch 写法)

- [ ] **Step 5: 运行全量测试确认健康线无回归**

Run: `python3 -m pytest tests/ -v`
Expected: PASS(全部)

- [ ] **Step 6: 提交**

```bash
git add llm/cuisine_pipeline.py tests/test_cuisine_pipeline.py
git commit -m "feat: 美食大厨三模式流水线——前置校验/避重名单/not_found短路/菜系位检查/修订轮/美食大厨判否日志

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 命令行脚本 make_cuisine_dish.py

**Files:**
- Create: `scripts/make_cuisine_dish.py`

- [ ] **Step 1: 实现脚本**

创建 `scripts/make_cuisine_dish.py`(对齐 `make_dish.py` 风格):

```python
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
```

- [ ] **Step 2: 冒烟验证参数解析(不调 LLM 的分支)**

Run: `python3 scripts/make_cuisine_dish.py --mode name --name "宫保鸡丁,回锅肉"`
Expected: 输出 JSON,`stage` 为 `invalid_input`(分隔符不合法,证明前置校验生效;不产生 LLM 调用)

- [ ] **Step 3: 提交**

```bash
git add scripts/make_cuisine_dish.py
git commit -m "feat: 美食大厨命令行脚本——mode+cuisine/name/ingredients三模式入口

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Web API(chef 分发 / cuisines / 图片)

**Files:**
- Modify: `web/app.py`
- Test: `tests/test_web.py`

- [ ] **Step 1: 写失败测试**

在 `tests/test_web.py` 末尾追加:

```python
def test_cuisines_endpoint(client):
    cuisines = client.get("/api/cuisines").get_json()
    assert "川菜" in cuisines and "家常菜" in cuisines and "西餐" in cuisines
    assert len(cuisines) == 18


def test_create_dish_chef_cuisine_dispatch(monkeypatch, client):
    calls = []

    class FakeCuisinePipeline:
        def run(self, mode, payload):
            calls.append((mode, payload))
            return {"stage": "inserted", "name": "宫保鸡丁", "dish": {}, "excluded": []}

    monkeypatch.setattr(web_app, "CuisinePipeline", FakeCuisinePipeline)
    res = client.post("/api/dishes", json={"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"})
    assert res.status_code == 200
    assert res.get_json()["stage"] == "inserted"
    assert calls == [("name", {"chef": "cuisine", "mode": "name", "name": "宫保鸡丁"})]


def test_create_dish_health_path_unchanged(monkeypatch, client):
    class FakeDishPipeline:
        def __init__(self):
            pass

        def run(self, ingredients):
            return {"stage": "inserted", "name": "汤", "dish": {}, "excluded": []}

    monkeypatch.setattr(web_app, "DishPipeline", FakeDishPipeline)
    res = client.post("/api/dishes", json={"ingredients": ["白萝卜"]})
    assert res.get_json()["stage"] == "inserted"


def test_set_dish_image(monkeypatch, client):
    calls = []
    monkeypatch.setattr(
        repository, "update_dish_image", lambda n, i: calls.append((n, i)) or True
    )
    ok = client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": "https://x/1.jpg"})
    assert ok.status_code == 200
    assert calls[-1] == ("宫保鸡丁", "https://x/1.jpg")
    clear = client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": ""})
    assert clear.status_code == 200
    assert calls[-1] == ("宫保鸡丁", None)


def test_set_dish_image_rejects_bad_params(monkeypatch, client):
    monkeypatch.setattr(repository, "update_dish_image", lambda n, i: False)
    assert client.post("/api/dish/image", json={"image": "x"}).status_code == 400
    assert client.post("/api/dish/image", json={"name": "宫保鸡丁", "image": 1}).status_code == 400
    miss = client.post("/api/dish/image", json={"name": "不存在", "image": "x"})
    assert miss.status_code == 404
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python3 -m pytest tests/test_web.py -v`
Expected: FAIL —— `/api/cuisines` 404;`FakeCuisinePipeline` 分发未实现走健康线报错;`/api/dish/image` 404

- [ ] **Step 3: 实现 API**

`web/app.py` 修改:

① import 区加:

```python
from llm.cuisine_pipeline import CuisinePipeline
```

② `dishes()` 端点后加 cuisines 端点:

```python
@app.get("/api/cuisines")
def cuisines():
    return jsonify(list(VOCAB.cuisines))
```

③ `create_dish()` 函数体开头加分发:

```python
@app.post("/api/dishes")
def create_dish():
    data = request.get_json(silent=True) or {}
    if data.get("chef") == "cuisine":
        return jsonify(CuisinePipeline().run(data.get("mode") or "", data))
    ingredients = data.get("ingredients")
    # ……其余保持原样
```

④ `set_dish_status()` 后加图片端点:

```python
@app.post("/api/dish/image")
def set_dish_image():
    data = request.get_json(silent=True) or {}
    name, image = data.get("name"), data.get("image")
    if not name or not isinstance(image, str):
        return jsonify({"error": "参数不合法"}), 400
    if not repository.update_dish_image(name, image.strip() or None):
        return jsonify({"error": f"未找到菜品:{name}"}), 404
    return jsonify({"ok": True})
```

注意:`update_dish_image` monkeypatch 测试里 `calls[-1]` 断言空串 → `None`,与 `image.strip() or None` 一致。

- [ ] **Step 4: 运行测试确认通过**

Run: `python3 -m pytest tests/test_web.py -v`
Expected: PASS(新增 + 既有全部)

- [ ] **Step 5: 提交**

```bash
git add web/app.py tests/test_web.py
git commit -m "feat: 审核台API——chef=cuisine分发、GET /api/cuisines、POST /api/dish/image补图

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: 审核台前端(厨师切换 + 三模式表单 + 卡片 story/图片)

**Files:**
- Modify: `web/review.html`

- [ ] **Step 1: 加 CSS**

`<style>` 内 `.doubt-list` 规则后追加:

```css
  .chef-switch, .mode-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .chef-btn, .mode-btn {
    font: inherit; font-size: 14px; padding: 4px 16px; cursor: pointer;
    border: 1px solid var(--line); border-radius: 16px; background: var(--card); color: var(--muted);
  }
  .chef-btn.active { background: var(--ink); border-color: var(--ink); color: #fff; }
  .mode-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .thumb { max-height: 130px; max-width: 100%; border-radius: 8px; display: block; margin: 4px 0 8px; }
  .img-row { display: flex; gap: 8px; margin-top: 10px; }
  .img-row input[type="text"] { flex: 1; min-width: 0; font-size: 13px; padding: 3px 10px; }
  .img-row button { padding: 3px 12px; font-size: 13px; }
```

- [ ] **Step 2: 改菜品生成面板 HTML**

把 `#page-dishes` 内 `<section class="panel">…</section>` 的面板体整体替换为:

```html
    <section class="panel">
      <h2>生成菜品</h2>
      <div class="chef-switch">
        <button class="chef-btn active" id="chef-health" onclick="showChef('health')">健康厨师</button>
        <button class="chef-btn" id="chef-cuisine" onclick="showChef('cuisine')">美食大厨</button>
      </div>
      <div id="form-health">
        <div class="run-row">
          <input type="text" id="dish-input" list="ingredient-names"
                 placeholder="候选食材,逗号分隔,如:白萝卜、豆腐、菠菜(库内食材有输入提示)">
          <datalist id="ingredient-names"></datalist>
          <button id="dish-btn">生成一道菜</button>
          <span class="run-note" id="dish-note">一次专注一道;多食材不够搭配会被弃置并说明原因</span>
        </div>
      </div>
      <div id="form-cuisine" style="display:none">
        <div class="mode-tabs">
          <button class="mode-btn active" id="mode-ingredient" onclick="showMode('ingredient')">给食材</button>
          <button class="mode-btn" id="mode-cuisine" onclick="showMode('cuisine')">给菜系</button>
          <button class="mode-btn" id="mode-name" onclick="showMode('name')">给菜名</button>
        </div>
        <div class="run-row" id="row-ingredient">
          <input type="text" id="cuisine-ingredient-input" list="ingredient-names"
                 placeholder="候选食材,逗号分隔,如:白萝卜、鸡胸肉(库内食材有输入提示)">
          <button id="cuisine-ingredient-btn">生成一道菜</button>
          <span class="run-note" id="cuisine-ingredient-note">从候选池选合理组合;不够搭配会弃置并说明原因</span>
        </div>
        <div class="run-row" id="row-cuisine" style="display:none">
          <select id="cuisine-select"></select>
          <button id="cuisine-btn">生成一道经典菜</button>
          <span class="run-note" id="cuisine-note">从该菜系选一道代表性经典菜;已收录的会自动避开</span>
        </div>
        <div class="run-row" id="row-name" style="display:none">
          <input type="text" id="name-input" placeholder="单个菜名,如:宫保鸡丁">
          <button id="name-btn">写这道菜的正宗做法</button>
          <span class="run-note" id="name-note">菜名须单个且不含分隔符;大厨不认识的菜会如实相告,不会硬编</span>
        </div>
      </div>
      <div id="dish-result"></div>
    </section>
```

- [ ] **Step 3: 加 JS(厨师/模式切换 + 菜系下拉 + 名字校验)**

`<script>` 内,`showPage` 函数后追加:

```js
let currentChef = "health";
let currentMode = "ingredient";

function showChef(chef) {
  currentChef = chef;
  document.getElementById("form-health").style.display = chef === "health" ? "" : "none";
  document.getElementById("form-cuisine").style.display = chef === "cuisine" ? "" : "none";
  document.getElementById("chef-health").classList.toggle("active", chef === "health");
  document.getElementById("chef-cuisine").classList.toggle("active", chef === "cuisine");
}

function showMode(mode) {
  currentMode = mode;
  for (const m of ["ingredient", "cuisine", "name"]) {
    document.getElementById(`row-${m}`).style.display = m === mode ? "" : "none";
    document.getElementById(`mode-${m}`).classList.toggle("active", m === mode);
  }
}

async function loadCuisines() {
  const cuisines = await fetchJSON("/api/cuisines");
  document.getElementById("cuisine-select").innerHTML =
    cuisines.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}

function validDishName(raw) {
  const name = raw.trim();
  if (!name) return "请先输入菜名";
  if (name.length > 100) return "菜名过长(>100字)";
  if (/[,，、/|]/.test(name)) return "菜名只能是单个菜名,不能包含逗号、顿号、斜杠等分隔符";
  return null;
}
```

页面加载区(`fillDatalist()` 之后)加:

```js
loadCuisines().catch(() => {});
```

- [ ] **Step 4: 扩展结果渲染与美食大厨提交函数**

`renderDishResult(result)` 中,`if (result.stage === "inserted")` 分支里在 `${excludedBlock}${doubtBlock}` 前插入 story 块——把 inserted 分支改为:

```js
  if (result.stage === "inserted") {
    const doubts = result.doubts || [];
    const doubtBlock = doubts.length
      ? `<div class="fail-item">存疑(已写入备注):<ul>${doubts.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>` : "";
    const storyBlock = result.story
      ? `<div class="meta-line">风味与文化:${esc(result.story)}</div>` : "";
    host.innerHTML = `
      <div class="ok-line">✓ ${esc(result.name)} 已入库(待审核)</div>
      ${storyBlock}${excludedBlock}${doubtBlock}`;
  } else if (result.stage === "not_found") {
    host.innerHTML = `<div class="meta-line">◌ 大厨如实相告:无法确认「${esc(result.name || "")}」——${esc(result.reason || "查无此菜")}(已记入缺口日志)</div>`;
  } else if (result.stage === "invalid_input") {
    host.innerHTML = `<div class="fail-item">✗ 输入不合法:${esc(result.reason || "")}</div>`;
  } else {
    const reasons = [...(result.errors || []), ...(result.problems || [])];
    const list = reasons.length
      ? `<ul>${reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : "";
    host.innerHTML = `<div class="fail-item">✗ ${esc(result.name || "未产出")} [${esc(result.stage)}]${list}</div>`;
  }
```

`createDish` 函数后追加美食大厨提交函数:

```js
const CUISINE_BTN_IDS = { ingredient: "cuisine-ingredient-btn", cuisine: "cuisine-btn", name: "name-btn" };
const CUISINE_NOTE_IDS = { ingredient: "cuisine-ingredient-note", cuisine: "cuisine-note", name: "name-note" };

async function createCuisineDish() {
  const body = { chef: "cuisine", mode: currentMode };
  if (currentMode === "ingredient") {
    const raw = document.getElementById("cuisine-ingredient-input").value;
    const ingredients = raw.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    if (!ingredients.length) { alert("请先输入至少一个候选食材"); return; }
    body.ingredients = ingredients;
  } else if (currentMode === "cuisine") {
    body.cuisine = document.getElementById("cuisine-select").value;
  } else {
    const err = validDishName(document.getElementById("name-input").value);
    if (err) { document.getElementById("name-note").textContent = err; return; }
    body.name = document.getElementById("name-input").value.trim();
  }
  const btn = document.getElementById(CUISINE_BTN_IDS[currentMode]);
  const note = document.getElementById(CUISINE_NOTE_IDS[currentMode]);
  btn.disabled = true;
  note.textContent = "美食大厨设计 + 核验把关中,约需一两分钟…";
  try {
    renderDishResult(await fetchJSON("/api/dishes", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    }));
    await loadEntity("dish");
    note.textContent = currentMode === "name"
      ? "菜名须单个且不含分隔符;大厨不认识的菜会如实相告,不会硬编"
      : currentMode === "cuisine"
        ? "从该菜系选一道代表性经典菜;已收录的会自动避开"
        : "从候选池选合理组合;不够搭配会弃置并说明原因";
  } catch (err) {
    note.textContent = err.message;
  } finally { btn.disabled = false; }
}

document.getElementById("cuisine-ingredient-btn").addEventListener("click", createCuisineDish);
document.getElementById("cuisine-btn").addEventListener("click", createCuisineDish);
document.getElementById("name-btn").addEventListener("click", createCuisineDish);
```

- [ ] **Step 5: 菜品卡片加 story/图片展示与图片补录**

① `DISH_LONG_LABELS` 改为(卡片自动展示 story,健康线菜品无该字段不受影响):

```js
const DISH_LONG_LABELS = [["benefits", "养生好处"], ["story", "风味与文化"], ["caution", "忌口"]];
```

② `cardHTML` 的 dish 分支中,`extra` 拼接前加图片与补录行——把 dish 分支改为:

```js
  if (entity === "dish") {
    const thumb = row.image
      ? `<img class="thumb" src="${esc(row.image)}" alt="${esc(row.name)}">` : "";
    const longFields = DISH_LONG_LABELS
      .filter(([key]) => row[key])
      .map(([key, label]) => `<p class="block-title">${label}</p><p class="steps-block">${esc(row[key])}</p>`)
      .join("");
    const steps = `<p class="block-title">制作步骤</p><p class="steps-block">${esc(row.steps)}</p>`;
    const remark = row.remark
      ? `<p class="block-title">备注(校验存疑)</p><p class="remark-block">${esc(row.remark)}</p>` : "";
    const imgRow = `<div class="img-row">
      <input type="text" id="img-${row.id}" placeholder="图片 URL(留空清除)" value="${esc(row.image || "")}">
      <button onclick="saveImage(${row.id})">存图</button></div>`;
    extra = thumb + longFields + steps + remark + imgRow;
  }
```

③ 追加 saveImage 函数(用 id 定位行,避开菜名字符转义问题):

```js
async function saveImage(rowId) {
  const row = STATUSES.flatMap(s => ENTITIES.dish.data[s] || []).find(r => r.id === rowId);
  if (!row) return;
  const value = document.getElementById(`img-${rowId}`).value.trim();
  try {
    await fetchJSON("/api/dish/image", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: row.name, image: value}),
    });
    await loadEntity("dish");
  } catch (err) { alert(err.message); }
}
```

- [ ] **Step 6: 手工冒烟验收**

Run: `python3 -m web/app.py`(或 `python3 -m web.app`),浏览器开 `http://127.0.0.1:8787/`

检查清单:
- [ ] 食材页原样正常(健康线零回归)
- [ ] 菜品页:厨师切换两个按钮互斥生效
- [ ] 美食大厨:三模式 Tab 切换,行输入框/下拉/文本框显隐正确
- [ ] 菜名模式输入「宫保鸡丁,回锅肉」点生成:不发请求,就地提示不合法
- [ ] 菜系下拉有 18 项
- [ ] 菜品卡片:无图不显示缩略图;图片 URL 输入与存图按钮可用(需 DB 有菜)

- [ ] **Step 7: 提交**

```bash
git add web/review.html
git commit -m "feat: 审核台菜品页——健康/美食大厨切换、三模式表单、not_found如实提示、卡片story与图片补录

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 全量回归与收尾

**Files:** 无新文件

- [ ] **Step 1: 全量测试**

Run: `python3 -m pytest tests/ -v`
Expected: PASS(全部,含既有健康线测试零回归)

- [ ] **Step 2: 冒烟一次真实流水线(可选,需 .env 配置了 LLM 与 MySQL)**

Run: `python3 scripts/make_cuisine_dish.py --mode name --name 宫保鸡丁`
Expected: `stage` 为 `inserted`(或已存在时 `duplicate`),菜谱含 story,入库待审核;`logs/reject_log.jsonl` 无新增 fail 行

- [ ] **Step 3: 提醒用户执行数据库升级 SQL**

`db/upgrade/2026-11-09-dish-story-image.sql` 需要用户在 MySQL 中手动执行(执行环境无 DB 连接)。未执行前,入库含 story 的菜会因列不存在报错。

---

## 自检记录(writing-plans Self-Review)

1. **Spec 覆盖**:词表(Task 1)、story/cuisines 校验(Task 2)、schema+仓储(Task 3)、四提示词文件(Task 4)、厨师 Agent(Task 5)、核验 Agent(Task 6)、三模式流水线含前置检查/not_found/避重/菜系位/判否日志(Task 7)、脚本(Task 8)、API 向后兼容+cuisines+图片(Task 9)、审核台前端(Task 10)、迁移 SQL 提醒(Task 11)——spec 各节均有对应任务;「词表-菜品分类.md 规划中→本期」在 Task 1 Step 4。
2. **占位符扫描**:所有代码步骤均给出完整代码与完整文案,无 TBD/TODO。
3. **类型一致性**:`CuisineChef.create(mode, payload, feedback, pantry, known_names)`、`CuisineVerifier.verify(record, mode, context)`、`CuisinePipeline.run(mode, payload) -> dict`、repository 三函数签名、API 请求体 `{chef, mode, cuisine?|name?|ingredients?}`、stage 取值集合,在测试与实现间逐一对照一致。

