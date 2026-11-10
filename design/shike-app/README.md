# 食刻 App · 页面设计 v1.3

> 2026-11-10 · 平台：Android / iOS（C 端用户 App + 数据工坊）
> 依据：现有数据层（`ingredient` / `dish` 表、节气词表、当前节气 ±2 当令推荐口径）+ 两条 LLM 流水线（食材批量、菜品健康厨师）+ 三态审核。
> 桌面端审核台（`web/review.html`）保留用于大批量作业；本套新增的「工坊」覆盖 App 内单件流转与快速处理。
> **v1.1**（"过于朴素"→ 封面级 Hero、朱砂印章、食签牌、热量环、悬浮 Dock）。
> **v1.2**（"青春活力"→ 粉彩渐变封面、贴纸、星光涂鸦、冬主色提亮青蓝）。
> **v1.3**（食材插画档案卡 + 工坊模块：手绘 SVG 食材插画替代纯文字卡；新增第 5 个 Tab「工坊」，覆盖食材流水线、菜品生成、审核台与审核详情；「我的」页删除编造数据）。

## 如何查看

浏览器打开 `index.html`（画廊，含全部画面缩略预览），点击任意画面进入可交互原型。
页面间链接可真实点击跳转（底部 4 Tab、首页 Hero → 全年节气、列表 → 详情）。
最佳观看宽度 390px+；窗口 ≤480px 时自动全屏（模拟真机）。

## 页面清单

| # | 文件 | 页面 | 层级 | 内容要点 |
|---|---|---|---|---|
| 0 | `index.html` | 设计画廊 | — | 全部画面缩略图 + 四季色卡 |
| 1 | `home.html` | 今日 | Tab 1 | 节气 Hero、当令带（±2 共 5 节气）、当令食材横滑（插画圆盘）、应季菜谱 |
| 2 | `terms.html` | 全年节气 | 二级 push | 24 节气四季粉彩横幅，「今」徽标（唯一深色焦点） |
| 3 | `recipes.html` | 菜谱库 | Tab 2 | 节气/做法筛选、粉彩横幅菜品卡 |
| 4 | `dish-detail.html` | 菜品详情 | 二级 push | 定量表、步骤时间线、白托盘热量环、养生/忌口、吸底「开始烹饪」 |
| 5 | `ingredients.html` | 食材百科 | Tab 3 | **双列插画档案卡**（手绘 SVG 食材 + 粉彩圆盘）、分类筛选、只看当令 |
| 6 | `ingredient-detail.html` | 食材详情 | 二级 push | 插画 Hero、性味归经、功效、当令节气带、典籍注脚 |
| 7 | `workshop.html` | **工坊** | Tab 4 | 食材流水线 + 菜品生成入口、最近批次状态、审核待办 |
| 8 | `pipeline.html` | 食材流水线 | 工坊 push | 节气选择、五步 stepper（推荐→填充→校验→核验→入库）、入库/存疑/失败分组 |
| 9 | `dish-generate.html` | 菜品生成 | 工坊 push | 候选池选择（库内注入档案）、生成结果、过程透明卡（弃置原因/三态/修订轮） |
| 10 | `review.html` | 审核台 | 工坊 push | 三态计数、食材/菜品分段、待审核队列、分页 |
| 11 | `review-ingredient.html` | 食材审核详情 | 工坊 push | 全字段 + 词表值域校验标记 + 通过/驳回操作栏 |
| 12 | `review-dish.html` | 菜品审核详情 | 工坊 push | 全字段 + remark 存疑列表 + 通过/驳回操作栏 |
| 13 | `mine.html` | 我的 | Tab 5 | 本地偏好（无账号）、入节提醒、数据说明（真实信息，无编造数字）、关于 |

## 导航结构

```
底部 5 Tab（一级）
├─ 今日 home.html
│   ├─ → 全年节气 terms.html（push）
│   ├─ → 食材详情 ingredient-detail.html（push）
│   └─ → 菜品详情 dish-detail.html（push）/ 菜谱库 recipes.html
├─ 菜谱 recipes.html
│   └─ → 菜品详情 dish-detail.html（push）
├─ 食材 ingredients.html
│   └─ → 食材详情 ingredient-detail.html（push）
├─ 工坊 workshop.html          ← v1.3 新增
│   ├─ → 食材流水线 pipeline.html（push）
│   ├─ → 菜品生成 dish-generate.html（push）→ 去审核 review-dish.html
│   └─ → 审核台 review.html（push）
│        ├─ → 食材审核 review-ingredient.html
│        └─ → 菜品审核 review-dish.html
└─ 我的 mine.html
```

- 工坊定位：数据基建的单件流转与快速处理；大批量作业仍走桌面端审核台（`web/review.html`）。
- 工坊与审核页均为 push 页；深链规划 `shike://dish/{name}`、`shike://ingredient/{name}`、`shike://term/{name}`、`shike://review/{id}`。
- **C 端只呈现「已通过」内容**；`status` 三态仅出现在工坊的审核模块。

## 工坊 ↔ 真实 API 映射（v1.3）

| 页面 | 后端对应 | 页面呈现 |
|---|---|---|
| pipeline.html | `POST /api/batch` → `{term, recommended, inserted, doubts, failed}` | 五步 stepper + 入库/存疑/失败分组（doubts 与 failed 原因逐条展示） |
| dish-generate.html | `POST /api/dishes` → `{stage, name, dish, excluded, doubts}` | 候选池、弃置原因、三态判定、修订轮 ≤3、库内档案（pantry）注入说明 |
| review.html | `GET /api/ingredients`、`GET /api/dishes`（按状态分组）+ 分页 | 三态计数、分段队列、分页器 |
| review-ingredient.html | `POST /api/status` `{name, status}` | 全字段 + 词表值域校验标记 + 通过/驳回 |
| review-dish.html | `POST /api/dish/status` `{name, status}` | 全字段 + remark 存疑列表 + 通过/驳回 |

## 设计系统速览

完整规范见 [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)。核心一句话：**新中式 × 青春活力 —— 亮纸底、墨色字、四季明彩、粉彩渐变面板、手绘食材插画、贴纸星光点缀**。

- **中性层**：亮纸 `#FAF6ED` / 墨 `#26231C`（13.7:1）/ 次级 `#5B564A`（6.4:1）/ 辅助 `#6E6858`（仅 ≥13px）
- **四季明彩**（accent 随当前节气季节切换，原型为冬·青蓝 `#35759F`）：春绿 `#2E8C55` · 夏朱 `#C14F32` · 秋琥珀 `#B7791A` · 冬青蓝 `#35759F`，各配深档与淡底；填充白字全部 ≥4.5:1
- **粉彩面板 `.panel-pop`**：蓝→青瓷→奶油渐变，封面/Hero/身份卡/横幅统一明底墨字（4.8–14.6:1）
- **食材插画（v1.3）**：48×48 手绘扁平 SVG（萝卜/山药/莲藕/梨/百合/栗子等），置于粉彩圆盘上，作为食材卡的视觉锚点；装饰性 `aria-hidden`
- **活力元件**：朱砂印章（斜贴）、高饱和食签牌（彩影）、贴纸徽章（每屏 ≤2 枚）、星光/波浪涂鸦（reduced-motion 停用）、白托盘热量环、悬浮毛玻璃 Dock
- **四气徽章**（功能信息色+字双编码）：寒→热 七档冷/中/暖色阶；五味为中性描边 chip
- **字体**：Noto Serif SC / Songti SC（节气名、菜名、典籍引文）× PingFang SC / Noto Sans SC（正文），热量/分量用 tabular-nums

## 与后端功能的映射

| 现有功能/字段 | App 呈现 |
|---|---|
| 节气词表（24）+ 当前 ±2 推荐口径 | 今日 Hero 当令带、菜谱/食材默认筛选、全年节气页 |
| `ingredient`（四气/五味/归经/功效/季节/caution/classic_note） | 食材百科 + 食材详情（徽章、归经行、引文卡） |
| `dish`（category/主料定量/steps/calories/benefits/caution/style/solar_terms） | 菜谱库 + 菜品详情（定量表、时间线、双角度好处、忌口） |
| 「健康厨师」出品标识 | 菜品卡/详情的「健康厨师」徽章（为「美食大厨」预留同位徽章） |
| 词表封闭值域 | 全部筛选 chip 的取值即词表值，不自造 |

## 声明与后续

- **示例数据**：原型中的食材档案、菜谱、典籍引文、审核队列与计数均为设计占位，值域对齐词表与真实 API 但未经考据审定；上线内容以流水线 + 审核台产出为准。食材插画与真实档案暂无逐一对应关系，需为全量食材补齐插画或改配照片。
- **v1 不做**：暗色模式（Token 已预留映射方案）、账号体系、社区/评论、视频步骤。
- **预留扩展**：「美食大厨」菜品徽章、菜品详情「开始烹饪」全屏步骤模式、入节提醒推送、偏好参与菜谱排序、工坊内流水的实时运行态（当前展示为完成态示例）。

## 预交付自检（2026-11-10 · v1.2 复检）

- [x] 文字对比（脚本实测）：墨字/粉彩面板 13.6–14.6:1、次级 6.4:1、辅助 ≥13px 配 4.8:1；四季填充白字 4.5–5.0:1；主按钮渐变两端 5.0/7.8:1；四季横幅深字 5.1–6.7:1；贴纸墨字 8.4–11.4:1；热量环弧/白托盘 4.3:1（图形 ≥3 ✓）
- [x] 触控目标：Dock 项、返回钮、chip ≥36px 高（chip 为筛选态展示，实现期热区扩至 ≥44 含 padding）；行点击热区整行
- [x] 不依赖颜色单独传义：四气徽章色+文字；忌口=图标+文字；节气 Tag 文字
- [x] 语义标题 h1→h2 顺序；图标按钮均有 `aria-label`；签牌/印章/贴纸/涂鸦全部 `aria-hidden`（信息由相邻文字承载）
- [x] `prefers-reduced-motion` 全局降级（星光缓浮动画停用）；`:focus-visible` 可见焦点
- [x] 单一图标族（线性 1.8px SVG Sprite + 手绘涂鸦例外），无 emoji 图标
- [x] 内容区底部预留 Dock/操作条下垫空间（122px/130px），无遮挡；无头 Chrome 逐页渲染验收
