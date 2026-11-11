# 美食大厨流水线设计 —— 三模式厨师 Agent 与核验 Agent

日期:2026-11-09
状态:已与用户逐节确认

## 背景与目标

「食刻」菜品流水线(健康厨师/校验双 Agent)已跑通,设计文档预留了「美食大厨」扩展位。本设计把它变成现实:**美食大厨 Agent**——主流&家常菜系、各地区菜系的顶级厨师,目标是帮用户**认识菜**(story:风味与文化背景)并**训练做菜能力**(教学性步骤,每步讲为什么)。

与「健康厨师」的分工:健康厨师管减脂低卡线,美食大厨管正宗与教学线;两条流水线同构独立、零侵入,提示词文件完全独立新写。

三种任务入口:

| 模式 | 输入 | 产出 |
|---|---|---|
| cuisine | 菜系,**只能从词表选择**,单选 | 大厨从该菜系中选一道代表性经典菜,写可复刻的正宗做法 |
| name | 菜名,用户输入,**单个**,前端+流水线双重合法性校验 | 大厨写出该菜公认正宗、家常可复刻的做法 |
| ingredient | 食材,多个,候选池语义(可筛选弃置) | 大厨挑选合理组合,做一道有菜系功底的家常菜 |

菜系与菜名互斥(只能给一种);食材可多个。

## 需求决策记录(共创结论)

| 决策点 | 结论 |
|---|---|
| 实现路径 | **同构独立,零侵入**——仿照健康厨师流水线新建模块;不改造已跑通的 `DishChef`/`DishPipeline` |
| 提示词文件 | **全部独立新写**:厨师提示词按模式拆三个文件 + 一个共享段 include;核验提示词独立;不与健康厨师共用模板 |
| 菜系入口 | 菜系**不允许自由输入**,先建菜系词表闭环管理,审核台下拉选择 |
| 菜名入口 | 用户自由输入但限单个;不合法就地提示不发请求;库里已有同名直接 duplicate,不调 LLM |
| 防编造契约 | 菜名模式:菜不存在或无把握时输出 `{"not_found":true,"reason":...}`,**宁可承认不知道,不可编一道菜**;流水线识别后短路返回并记日志(内容缺口信号) |
| 字段扩展 | `dish` 表只加两个可空列:`story`(风味与文化背景)、`image`(菜品图片);难度/时长不做 |
| image 产出 | 流水线不产出(LLM 生成不了真实照片),审核台人工补录 URL;不做文件上传基础设施 |
| 核验机制 | 独立核验 Agent,输出契约与健康线一致(pass/fail/存疑 + problems),修订轮 ≤3,存疑写 `remark` 落库 |
| 核验哲学 | fail 仅限四类硬伤(相克/安全/造假/不可执行);简化魔改、不够地道、讲解不够细只提醒不否决;**无热量参考线** |
| style 校验 | 按 category 区分:美食大厨线 style 第一段受菜系词表闭环校验;健康厨师线保持自由格式不变 |
| 判否日志 | `entity="美食大厨"`,与健康线的「菜品」区分,便于按厨师线做缺口分析 |

## 数据模型

`db/schema.sql` 的 `dish` 表 CREATE TABLE 同步更新;现有库执行迁移:

```sql
ALTER TABLE `dish`
  ADD COLUMN `story` VARCHAR(500) DEFAULT NULL COMMENT '风味与文化背景,美食大厨出品' AFTER `benefits`,
  ADD COLUMN `image` VARCHAR(500) DEFAULT NULL COMMENT '菜品图片URL/路径' AFTER `story`;
```

- `story`:美食大厨产出;健康厨师恒 NULL
- `image`:人工维护;流水线入库时恒 NULL;`POST /api/dish/image` 补录
- 其余列不变;`uk_name` 全库唯一(含已驳回),菜名预检按任意状态判重

## 词表

新文件 `data/vocab/词表-菜系.md`(表格:词条+一句话说明),起始清单:

- **八大菜系**:鲁菜、川菜、粤菜、苏菜、闽菜、浙菜、湘菜、徽菜
- **家常与地方**:家常菜、东北菜、西北菜、云贵菜、潮汕菜、客家菜
- **主流外国**:日式、韩式、东南亚、西餐

`shike/vocab.py`:`Vocab` 加 `cuisines: tuple[str, ...]`,`load_vocab` 加载(复用 `parse_categories` 取第一列,重复项加载期报错)。外国菜系是给 ingredient 模式留成菜风味余地。

`data/vocab/词表-菜品分类.md`:美食大厨定位说明「(规划中)」改为「(本期)」。

## 厨师 Agent

### 提示词文件结构

```
prompts/
├── cuisine_common.jinja2         # 共享段:人设、底线、教学性步骤要求、字段说明、铁律
├── cuisine_by_cuisine.jinja2     # 给菜系
├── cuisine_by_name.jinja2        # 给菜名
└── cuisine_by_ingredient.jinja2  # 给食材
```

模式文件 `{% include "cuisine_common.jinja2" %}` 引共享段;渲染用 `jinja2.Environment(FileSystemLoader(prompts 目录))`(现有 `Template(text)` 方式不支持 include)。

### 共享段要点

**人设**:你是「美食大厨」——行走于主流菜系与地方风味之间的顶级厨师,兼是一位好老师。信条:**一道好菜首先好吃,而好手艺必须讲得清、学得会。**

**底线**(铁,与任何目标不可交换):
1. 禁止食物相克或搭配禁忌的组合
2. 禁止任何食品安全风险
3. **不编造**——正宗做法、典故、流派说法不确定时如实说「有分歧」,禁止把不确定的内容当定论输出
4. 分量与做法如实,不表演性夸饰

**教学性步骤要求**(最重字段,「训练做菜」的核心):
- 每步不仅写「做什么」,还要写「为什么」:高温爆炒是为了锁汁、小火慢炖是为了胶质溶出、下盐时机如何影响出水
- 刀工给规格(逆纹 3mm、滚刀块大小),火候给状态判断(七成热/筷子插入细密气泡/收汁挂勺)
- **常见失败点与补救**写在对应步骤内(如「若糊锅立即离火不要加水」)

**字段说明**(在健康厨师字段集基础上):
- 新增 `story`:风味画像(味型层次、口感、余味)+ 来历/流派/为何经典,一段话 ≤200 字(列宽 500 留余量)
- `excluded` 仅 ingredient 模式输出,另两模式恒为空数组
- `calories` 如实估报,**无低卡参考线**;`solar_terms` 规则同健康线(全年皆宜也给最当令节气)
- 其余字段(name/main_ingredients/extras/steps/benefits/caution/style)同健康线

**铁律**:只输出一个 JSON 对象;不确定的内容宁可不写,不编造。

### 三份模式文件的差异段

| 文件 | 任务语句 | 模式专属规则 |
|---|---|---|
| by_cuisine | 从{{cuisine}}中选一道最能代表该菜系技艺与风味的经典菜,写出可复刻的正宗家常做法 | 注入已收录菜名名单{{known_names}}令其避重;选菜理由写进 story |
| by_name | 为指定菜名{{name}}写出公认正宗、家常条件下可复刻的做法 | **防编造契约**:菜名不存在或无把握时输出 `{"not_found":true,"reason":"..."}`;流派分歧选主流做法、分歧写进 story |
| by_ingredient | 从候选食材中挑选合理组合,做一道有菜系功底的家常菜,style 由你据成菜判定 | 弃置规则:至少用一个、弃置给原因(同健康厨师候选池语义) |

### 类接口

`llm/cuisine_chef.py` 类 `CuisineChef`(仿 `DishChef`):

```python
SYSTEM = "你是「美食大厨」——主流菜系与地方风味的顶级厨师兼烹饪教师,只输出 JSON。"

class CuisineChef:
    def __init__(self, client=None, vocab=None): ...
    def create(self, mode: str, payload: dict,
               feedback: list[str] | None = None,
               pantry: list[dict] | None = None,
               known_names: list[str] | None = None) -> dict:
        """按 mode 渲染对应模板并调用模型;原样返回解析后的 dict,含 not_found 时由流水线处理。"""
```

`MODE_PROMPTS = {"cuisine": ..., "name": ..., "ingredient": ...}` 映射模板文件;`payload` 按 mode 取 `cuisine`/`name`/`ingredients`。

## 核验 Agent

`llm/cuisine_verify.py` 类 `CuisineVerifier`——与 `dish_verify.py` **同构独立、零共享代码**(沿用 verify/dish_verify 各自独立的惯例),输出契约完全一致:`verify(record, mode, context) -> (verdict: pass/fail/存疑, problems)`;模型输出不合约定视为 fail。

`context` 按 mode:菜系名 / 菜名 / 候选食材列表。提示词 `prompts/cuisine_verify.jinja2` 全新撰写。

**判定哲学:底线是铁的,其余是方向。**

- **fail 仅限四类硬伤**:①相克/搭配禁忌 ②食品安全风险 ③**造假**(美食线扩展:把不确定的做法/典故/流派当定论、步骤编造不存在的效果、story 编造来历)④步骤明显不可执行
- **方向性问题只提醒不否决**:简化魔改、不够地道、教学讲解不够细不构成 fail;只有「把魔改冒充正宗」「编造」才 fail;无充分把握判 存疑,不轻易 fail
- **无热量参考线**;calories 与分量明显不符(虚报)仍属造假

核查维度(按优先级):
1. 食物相克与搭配禁忌
2. 食品安全(生熟火候给足、致敏提示)
3. **正宗性与技法**:技法是否符合该菜系通行做法;流派分歧是否选主流并如实标注;story 典故有无常识依据
4. 步骤可执行性(顺序、火候时机、份量自洽)
5. 教学完整性(关键步骤讲没讲为什么、失败点提示是否有常识依据)——弱项归入存疑提醒,不否决
6. 字段一致性(style 与成菜匹配、solar_terms 当令、excluded 理由、caution 遗漏)

输出铁律同健康线:`{"verdict":"pass"|"fail"|"存疑","problems":[...]}`,pass 时 problems 为空数组。

## 流水线

`llm/cuisine_pipeline.py` 类 `CuisinePipeline`(仿 `DishPipeline`),`CATEGORY = "美食大厨"`:

```python
class CuisinePipeline:
    def __init__(self, chef=None, verifier=None, max_revisions=3): ...
    def run(self, mode: str, payload: dict) -> dict:
        """stage 取值:inserted / rejected / invalid / duplicate / invalid_input / not_found"""
```

**模式前置检查**(进 LLM 之前):

| 模式 | 前置动作 |
|---|---|
| cuisine | `repository.list_dish_names_by_cuisine(cuisine)` → 已收录名单注入提示词避重 |
| name | ①输入合法性校验:strip 后非空、≤100 字、不含分隔符(半角逗号 `,`、中文逗号 `，`、顿号 `、`、斜杠 `/`、竖线 `|`)→ 不合法直接 `{"stage":"invalid_input","reason":...}`;②`repository.find_dish_by_name(name)` 命中 → 直接 `duplicate`,不调 LLM |
| ingredient | 候选去重 + `repository.find_ingredients_by_names` pantry 档案注入(与健康线同机制) |

**主循环**(1+3 修订轮):

```
chef.create(mode, payload, feedback, pantry, known_names) → record
  record.get("not_found") → 短路 {"stage":"not_found","reason":...} + 判否日志
record["category"] = CATEGORY
errors = validate_dish(record, vocab, cuisines=词表菜系)
  cuisine 模式附加检查:style 第一段 == 所选菜系(不符 → 反馈重写)
  非 ingredient 模式 excluded 非空 → 反馈重写
verdict, problems = verifier.verify(record, mode, context)
  pass  → _insert(record, remark=None)
  存疑  → _insert(record, remark=problems 换行) + doubts + 判否日志
  fail  → feedback=problems,继续修订
耗尽 → {"stage":"rejected"} + 判否日志
```

- `_insert`:平铺转换(同 `to_db_record` 逻辑)+ `story` + `category="美食大厨"` 写死注入 + `image=None`;`IntegrityError → duplicate`
- 平铺转换:main_ingredients/extras join「名称 分量」、steps 编号分行、calories `约N千卡`、story 原文
- 返回值携带过程信息(选用主料、excluded、problems/errors、story),供审核台即时展示
- 判否/存疑/not_found 写 `logs/reject_log.jsonl`,`entity="美食大厨"`

## 结构校验

`shike/validate.py` 的 `validate_dish` 加可选参数:

```python
def validate_dish(record: dict, vocab: Vocab, cuisines: tuple[str, ...] | None = None) -> list[str]
```

- `cuisines=None`(缺省):行为与现状完全一致(健康线零变化)
- `cuisines` 提供:style 第一段(半角逗号分隔)必须 ∈ 菜系词表;`story` 若存在 ≤500 字(列宽)
- 必填/长度校验沿用现有规则;calories 正整数、solar_terms 词表+升序

## 仓储

`shike/repository.py` 加 3 个函数:

```python
list_dish_names_by_cuisine(cuisine) -> list[str]  # style LIKE '{cuisine},%',含全部审核状态(已驳回也避重,防重名)
find_dish_by_name(name) -> dict | None            # name 模式查重预检,任意状态命中即 duplicate
update_dish_image(name, image) -> bool            # 审核台补图;image 传 null 清空
```

`insert_dish` 写入 `story`(image 恒不入库值)。

## 判否日志

`log_reject` 已支持 `entity` 参数,流水线传 `entity="美食大厨"`,无需改动 `shike/reject_log.py`。

## Web 审核台

### API(web/app.py)

- `POST /api/dishes`:请求体加 `chef` 字段——缺省/`"health"` → 现有健康流水线(**完全向后兼容**);`"cuisine"` → 按 `mode` 分发,请求体 `{chef:"cuisine", mode:"cuisine"|"name"|"ingredient", cuisine?|name?|ingredients?}`;响应带过程信息,仅展示不落库
- `GET /api/cuisines` → `{cuisines:[...]}`(词表-菜系值,前端下拉数据源,不自造)
- `POST /api/dish/image` `{name, image}` → `update_dish_image`;前端通过/驳回不变
- 食材多选继续复用 `GET /api/ingredients` + 前端本地过滤

### 前端(review.html)

- 菜品页顶栏加厨师切换分段控件:**健康厨师 / 美食大厨**;健康表单原样不动
- 美食大厨表单:三模式 Tab
  - 给菜系:词表下拉(数据来自 `/api/cuisines`)
  - 给菜名:单行输入;前端校验非空、单个、无分隔符,不合法就地提示不发请求
  - 给食材:复用现有食材搜索多选组件
- 结果区按模式渲染:not_found(大厨承认不认识,展示 reason)、invalid_input、duplicate、存疑/失败原因、选用主料与 excluded、story 预览
- 菜品卡片:增加 story 展示位、有 image 显示缩略图;操作区保持通过/驳回,加图片 URL 小输入框 + 保存(调 `/api/dish/image`)
- 分组、分页、状态切换 JS 沿用现有泛化逻辑,卡片字段映射独立

## 配置与脚本

- LLM 角色新增 `cuisine_chef`、`cuisine_verify`(`profile_for` 回落 default;`.env` 可加 `SHIKE_LLM_ROLE_CUISINE_CHEF=档案名` 给大厨配更强模型)
- 新脚本 `scripts/make_cuisine_dish.py`(argparse,对齐现有 scripts 风格):
  - `--mode cuisine --cuisine 川菜`
  - `--mode name --name 宫保鸡丁`
  - `--mode ingredient --ingredients "白萝卜,鸡胸肉"`

## 测试(对齐现有 tests/ 模式,FakeLLM 注入)

| 文件 | 覆盖 |
|---|---|
| test_vocab.py 扩展 | cuisines 加载、重复项报错 |
| test_cuisine_chef.py | 三模板各自渲染与模式差异段、feedback/pantry/known_names 注入、not_found 透传 |
| test_cuisine_verify.py | 三态解析、problems 归一化、非法 JSON → fail |
| test_dish_validate.py 扩展 | cuisines 参数分支:style∈词表、story≤500、缺省行为不变 |
| test_cuisine_pipeline.py | 三模式 happy path、invalid_input、duplicate 预检、not_found 短路+日志、避重名单注入、cuisine 模式 style 校验、非 ingredient 模式 excluded 拒绝、修订轮、story 平铺、category 注入 |
| test_web.py 扩展 | /api/dishes chef=cuisine 各模式与向后兼容、/api/cuisines、/api/dish/image |
| 既有全部测试 | 保持绿——健康线零变化 |

## 未来扩展(不在本期)

- App 消费:菜品详情「风味与文化」卡(story)、菜品图片(image);美食大厨徽章(App 设计稿已预留同位)
- 菜品图片文件上传与对象存储;LLM 生图占位
- 用户做菜记录与学习轨迹(训练能力的下一步);按口味偏好参与推荐排序
- 菜名模式输入联想(基于已收录菜名)
