# 菜品流水线设计 —— 健康厨师 Agent 与校验 Agent

日期:2026-10-27
状态:已与用户逐节确认

## 背景与目标

「食刻」已有食材入库流水线(推荐→填充→校验→核验→入库待审核)。本设计新增第二条同构流水线:**菜品流水线**——丢入一个或多个食材,由「健康厨师」Agent 设计一道健康低卡的菜,经「校验 Agent」把关后入库待审核,进审核台人工终审。为后续「美食大厨」Agent(主流&家常菜系、各地区菜系厨师)预留扩展位。

实现路径:**同构独立**——完全仿照现有食材流水线的模式新建模块,零侵入已跑通的代码。

## 需求决策记录(共创结论)

| 决策点 | 结论 |
|---|---|
| 生成数量 | 一次只生成 **1 道菜**,Agent 专注于这一道,精细化设计(色香味、口感、味觉层次) |
| 多食材语义 | 传入食材是**候选池**:搭配合理可组合,不够搭配可弃置一部分,至少用一个,弃置须给原因 |
| 食材来源 | 审核台**自由输入 + 搜索/筛选选择库中食材**;选中库内食材时把其性味归经/功效/caution 注入提示词(pantry 机制) |
| 校验机制 | **三态判定(pass/fail/存疑)+ 修订轮(≤3)**,与食材流水线同构;存疑问题逐条写入 `remark` 字段落库 |
| 分类字段 | `category`,值域词表封闭管理,现有两值:**健康厨师**(本流水线)、**美食大厨**(未来) |
| 表设计 | **照 ingredient 表同构**:单表、全 VARCHAR、status 三态、菜名唯一;不搞 JSON 列、不搞双表 |
| 过程信息 | 传入食材名单、弃置及原因等只在流水线返回值/API 响应里**临时展示,不落库**;校验存疑问题持久化到 `remark` |
| 提示词哲学 | **底线是铁的,其余是方向**:相克/安全/如实报告是唯一硬约束;低卡、热量参考线等均为方向性偏好,不为凑指标扭曲菜品或弃置好搭配 |
| 定量 | 以「份」为单位,优先自然单位(一根/半根/1块/2瓣),合理且必要时可用克/毫升(盐 3g、生抽 10ml) |
| 步骤 | **最重的字段**:刀工、火候、时机、调味顺序、状态判断、去腥提鲜、出锅点睛,技巧写在对应步骤内,不单列小贴士字段 |
| 明确不做 | 风味简介、时长+难度、减脂小贴士独立字段(保持精简,将来可加) |

## 数据模型

新增到 `db/schema.sql`,与 `ingredient` 完全同构(单表、VARCHAR、status、uk_name):

```sql
CREATE TABLE IF NOT EXISTS `dish` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`         VARCHAR(100) NOT NULL COMMENT '菜名,唯一',
  `category`     VARCHAR(50)  NOT NULL COMMENT '出品厨师,单选,值域见词表-菜品分类:健康厨师/美食大厨',
  `main_ingredients` VARCHAR(500) NOT NULL COMMENT '主料,逗号分隔「食材 分量」,每份定量,如「白萝卜 半根,鸡胸肉 1块」',
  `extras`       VARCHAR(500) DEFAULT NULL COMMENT '辅料/调料,逗号分隔「名称 分量」,可空',
  `steps`        TEXT NOT NULL COMMENT '制作步骤,编号分行,火候与技巧写入步骤',
  `calories`     VARCHAR(50)  NOT NULL COMMENT '每份热量估算,如「约350千卡」',
  `benefits`     VARCHAR(500) NOT NULL COMMENT '养生好处,中医性味+现代营养多角度',
  `caution`      VARCHAR(500) DEFAULT NULL COMMENT '忌口提示,不适宜人群,可空',
  `style`        VARCHAR(100) NOT NULL COMMENT '菜系+烹饪方式,逗号分隔,如「日式,凉拌」',
  `solar_terms`  VARCHAR(100) NOT NULL COMMENT '时令节气,多选升序,值域同词表-节气',
  `remark`       VARCHAR(500) DEFAULT NULL COMMENT '备注,校验存疑问题逐条分行罗列;无问题为空',
  `status`       VARCHAR(10)  NOT NULL DEFAULT '待审核' COMMENT '审核状态:待审核/已通过/已驳回',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品表';
```

### LLM 输出 → 落库转换

LLM 输出嵌套 JSON(便于校验与前端展示),入库前由流水线拼平,与纯文本列对齐:

| LLM 字段 | 落库 |
|---|---|
| `main_ingredients: [{"name","amount"}]` | join 为 `「食材 分量」` 逗号分隔字符串 |
| `extras: [{"name","amount"}]` | 同上;空数组 → null |
| `steps: ["...","..."]` | 编号分行文本:`1. xxx\n2. xxx` |
| `calories: 350`(整数) | `约350千卡` |
| `excluded: [{"name","reason"}]` | **不落库**,只在流水线返回值/审核响应中临时展示 |

`category="健康厨师"` 由流水线写死注入,不劳模型输出(未来美食大厨 Agent 换此常量)。

## 厨师 Agent

`llm/chef.py` 类 `DishChef`(仿 `IngredientFiller`),提示词 `prompts/dish_create.jinja2`(已写好):

- `create(ingredients: list[str], feedback: list[str] | None, pantry: list[dict] | None) -> dict`
- **pantry 机制**:传入食材中已在 `ingredient` 表的,流水线先查库,把性味/归经/功效/caution 注入提示词;`benefits` 优先据库内记载展开
- 提示词分层:**【底线】**相克/安全/如实估报——与任何目标不可交换;**【方向】**低卡手法(蒸/煮/炖/凉拌/少油快炒)、自然单位定量、色香味口感、养生好处——尽力优化、不过分即可
- 步骤精细化置顶为最重字段

## 校验 Agent

`llm/dish_verify.py` 类 `DishVerifier`(仿 `IngredientVerifier`),提示词 `prompts/dish_verify.jinja2`(已写好):

- `verify(record: dict, ingredients: list[str]) -> tuple[str, list[str]]`,返回 (verdict, problems)
- **fail 仅限四类硬伤**:①相克/搭配禁忌 ②食品安全风险 ③造假(热量与分量明显不符、步骤编造效果)④步骤明显不可执行
- 热量超参考线**不算问题**,疑似虚报才是问题;搭配欠优雅、还能更低卡不构成否决
- 核查维度:相克禁忌 > 食品安全 > 伪健康与造假 > 步骤可执行性 > 弃置合理性 > 字段一致性(benefits 与主料相符、忌口人群遗漏、solar_terms 与主料当令匹配)

## 流水线

`llm/dish_pipeline.py` 类 `DishPipeline`(仿 `IngredientPipeline`),修订轮 ≤3:

```
run(ingredients: list[str]) -> dict:
  pantry = repository.find_ingredients_by_names(ingredients)   # 库内交集
  循环(1+3 轮):
    record = chef.create(ingredients, feedback, pantry)
    errors = validate_dish(record, vocab)          # 结构+词表校验,不过→反馈重写
    verdict, problems = verifier.verify(record, ingredients)
    pass   → _insert(转换后的菜谱, remark=null)
    存疑   → _insert(菜谱, remark=problems 逐条换行罗列)
    fail   → feedback=problems;继续重写
  耗尽 → {"stage":"rejected"},记判否日志(entity="菜品")
```

- `_insert`:拼平转换 + `category="健康厨师"` + status 待审核;`IntegrityError` → `duplicate`
- 返回值携带过程信息(选用的主料、excluded、problems/errors),供审核台 API 响应即时展示
- 判否/存疑写 `logs/reject_log.jsonl`

## 结构校验

`validate_dish(record, vocab)` 加入 `shike/validate.py`:

- 必填:name、main_ingredients、steps、calories、benefits、style、solar_terms
- main_ingredients 非空数组且每项 name/amount 非空;steps 非空数组且每步非空字符串
- calories 正整数;category 在词表-菜品分类;solar_terms 词表+升序
- 长度上限与列宽匹配(style≤100、benefits/caution≤500、name≤100)

## 词表

- 新文件 `data/vocab/词表-菜品分类.md`:表格(词条+一句话说明),值:`健康厨师`、`美食大厨`
- `shike/vocab.py`:`Vocab` 加 `dish_categories: tuple[str, ...]`,`load_vocab` 加载新文件(复用 `parse_categories` 取第一列,重复项加载期报错)

## 仓储

`shike/repository.py` 加 4 个函数:

```python
find_ingredients_by_names(names)   # pantry 查询:name/nature/flavor/meridian/benefits/caution
insert_dish(record)                # 待审核写入;name 冲突抛 IntegrityError
list_dishes()                      # 全量,待审核在前(与 list_ingredients 同构)
update_dish_status(name, status)   # 审核状态切换,返回是否命中
```

## 判否日志

`shike/reject_log.py` 的 `log_reject` 加 `entity: str = "食材"` 参数(默认值向后兼容),日志行增加 `entity` 字段;菜品流水线传 `"菜品"`。

## Web 审核台

### API(web/app.py,3 个新端点)

- `GET /api/dishes` → 按状态分组 `{待审核:[],已通过:[],已驳回:[]}`
- `POST /api/dishes` `{ingredients:[...]}` → 跑 `DishPipeline`;响应带过程信息(主料、excluded、存疑/失败原因),仅展示不落库
- `POST /api/dish/status` `{name,status}` → 审核切换
- 食材选择复用现有 `GET /api/ingredients` 全量 + 前端本地搜索过滤,不加新端点

### 前端(review.html)

- 顶栏「食材 / 菜品」两个 Tab;食材页原样不动
- 菜品页:生成表单(自由输入 + 库内食材搜索多选)+ 生成结果区(菜名、选用主料、弃置及原因、存疑问题/失败原因)+ 三列分组卡片(主料/辅料/热量/好处/忌口/风格/节气/备注,步骤全文;通过/驳回按钮)
- 分组、分页、状态切换 JS 泛化复用现有逻辑,菜品卡片字段映射独立

## 配置与脚本

- LLM 角色新增 `chef`、`dish_verify`(`profile_for` 回落 default,不配也能跑;`.env` 可加 `SHIKE_LLM_ROLE_CHEF=档案名` 给厨师换更强模型)
- 新脚本 `scripts/make_dish.py`:命令行生成,对齐现有 scripts 风格

## 测试(对齐现有 tests/ 模式,FakeLLM 注入)

| 文件 | 覆盖 |
|---|---|
| test_vocab.py 扩展 | dish_categories 加载与重复项报错 |
| test_chef.py | 提示词渲染(pantry/feedback 段)、JSON 解析失败 |
| test_dish_validate.py | 结构校验各分支 |
| test_dish_pipeline.py | pass/存疑写 remark/fail 修订轮/duplicate/category 注入/落库转换(拼平、编号、热量格式化) |
| test_web.py 扩展 | 三个菜品端点 |

## 未来扩展(不在本期)

- **美食大厨 Agent**(主流&家常菜系、各地区菜系厨师,帮用户认识菜、训练做菜能力):同构复制本流水线,`category` 换 `"美食大厨"`,新写一对提示词;表、审核台、校验器全复用
- 菜品的节气推荐、菜谱对消费端的菜单视图投影
