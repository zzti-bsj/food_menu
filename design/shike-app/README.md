# 食刻 App · 页面设计 v1.4.3

> 2026-11-10 · 平台：Android / iOS（C 端用户 App + 数据工坊）
> 依据：现有数据层（`ingredient` / `dish` 表、节气词表、菜系词表、当前节气 ±2 当令推荐口径）+ 三条 LLM 流水线（食材批量、菜品健康厨师、菜品美食大厨）+ 三态审核。
> 桌面端审核台（`web/review.html`）保留用于大批量作业；本套新增的「工坊」覆盖 App 内单件流转与快速处理。
> **v1.1**（"过于朴素"→ 封面级 Hero、朱砂印章、食签牌、热量环、悬浮 Dock）。
> **v1.2**（"青春活力"→ 粉彩渐变封面、贴纸、星光涂鸦、冬主色提亮青蓝）。
> **v1.3**（工坊模块：新增第 5 个 Tab「工坊」，覆盖食材流水线、菜品生成、审核台与审核详情；「我的」页删除编造数据）。
> **v1.3.1**（食材默认占位图 + 上传替换；删除「用它的菜谱」；菜品生成页按 `POST /api/dishes` 四态返回重排）。
> **v1.3.2**（美食大厨流水线已上线 → 新增 cuisine-generate.html 真实实现三模式生成；story/图片字段入列；菜品生成页双厨师互切；菜谱库加美食大厨示例卡）。
> **v1.4**（账号体系页面：login.html、my-content.html、admin-users.html；私有内容可见性规则全链路标注）。
> **v1.4.1**（菜品生成合并为双厨师单入口：工坊一张卡，页内点选厨师切换表单与结果；美食大厨按菜系/按菜名/按食材三模式输入面板全部设计并可用 JS 真实切换；移除独立 cuisine-generate.html）。
> **v1.4.3**（「我的」重构为主流范式：资料头部点按 → 新增 edit-profile.html（头像/昵称）；退出登录移入新增 settings.html；修改密码移至登录页「忘记密码」（重置接口待补）；小节标题全局降级为组标签；设置页极简——仅入节提醒（预留定时任务）+ 退出登录，口味忌口/关于按要求移除）。

## 如何查看

浏览器打开 `index.html`（画廊，含全部画面缩略预览），点击任意画面进入可交互原型。
页面间链接可真实点击跳转（底部 5 Tab、首页 Hero → 全年节气、列表 → 详情）。
最佳观看宽度 390px+；窗口 ≤480px 时自动全屏（模拟真机）。

## 页面清单

| # | 文件 | 页面 | 层级 | 内容要点 |
|---|---|---|---|---|
| 0 | `index.html` | 设计画廊 | — | 全部画面缩略图 + 四季色卡 |
| 1 | `home.html` | 今日 | Tab 1 | 节气 Hero、当令带（±2 共 5 节气）、当令食材横滑（默认图圆盘）、应季菜谱 |
| 2 | `terms.html` | 全年节气 | 二级 push | 24 节气四季粉彩横幅，「今」徽标（唯一深色焦点） |
| 3 | `recipes.html` | 菜谱库 | Tab 2 | 节气/做法筛选、粉彩横幅菜品卡 |
| 4 | `dish-detail.html` | 菜品详情 | 二级 push | 定量表、步骤时间线、白托盘热量环、养生/忌口、吸底「开始烹饪」 |
| 5 | `ingredients.html` | 食材百科 | Tab 3 | **双列档案卡**（默认占位图，可上传替换）、分类筛选、只看当令 |
| 6 | `ingredient-detail.html` | 食材详情 | 二级 push | 默认图 Hero、性味归经、功效、当令节气带、典籍注脚 |
| 7 | `workshop.html` | **工坊** | Tab 4 | 食材流水线、菜品生成（健康厨师 + 美食大厨入口）最近批次状态、审核待办 |
| 8 | `pipeline.html` | 食材流水线 | 工坊 push | 节气选择（GET /api/terms 全集可任选）、五步 stepper（推荐→填充→校验→核验→入库）、入库/存疑/失败分组 |
| 9 | `dish-generate.html` | 菜品生成（双厨师单入口，页内可切换） | 工坊 push | 出品厨师点选切换：健康厨师（ingredients 数组去重/400 校验、四态）｜美食大厨（三模式全设计可切换、六 stage 含 invalid_input / not_found、story 味字卡、style 菜系位对齐、excluded 必空）；dish 落库字段预览随厨师切换 |
| 10 | `review.html` | 审核台 | 工坊 push | 三态计数、食材/菜品分段、待审核队列、分页 |
| 11 | `review-ingredient.html` | 食材审核详情 | 工坊 push | 全字段（含图片行，PATCH /api/ingredients/{id}）+ 词表值域校验标记 + 通过/驳回操作栏 |
| 12 | `review-dish.html` | 菜品审核详情 | 工坊 push | 全字段（含 story / 图片行，POST /api/dish/image）+ remark 存疑列表 + 通过/驳回操作栏 |
| 13 | `mine.html` | 我的 | Tab 5 | 主流范式：资料头部（头像/昵称/角色，点按 → 编辑资料）+ 入口列表（我的私有食单 / 官方库审核 / 用户管理 admin / 设置）；右上角齿轮直达设置 |
| 14 | `edit-profile.html` | 编辑资料 | 登录 push | 头像更换（字段规划中，接口待补）+ 昵称 1–50 字（PATCH /api/auth/me，计数器/错误文案对齐）+ 手机号/角色只读 |
| 15 | `settings.html` | 设置 | 登录 push | 极简两块：入节提醒开关（后续可扩展定时任务）+ 退出登录（danger + 确认弹层示意）；口味忌口/关于已按要求移除 |
| 16 | `login.html` | 登录 / 注册 | 未登录 push | 手机号+密码双 Tab 表单（1 开头 11 位 / ≥6 位）、「忘记密码？」链接（重置接口待补）、接口对齐错误态（409 已注册、401 不正确/已禁用）、未登录可浏览官方库 |
| 17 | `my-content.html` | 我的私有食单 | 登录 push | 私有内容（user_id 非空）菜品/食材分段、三态徽标、查看/编辑/删除（DELETE 确认说明）、可见性规则（他人 404 防探测） |
| 18 | `admin-users.html` | 用户管理 | admin push | 用户列表（role/status 徽章）、启停/设角色/删除；硬规则（不能禁用或降级自己、不能删自己、名下有内容 409） |

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
│   ├─ → 菜品生成 dish-generate.html（push，双厨师单入口 · 厨师/模式页内切换）→ 去审核 review-dish.html
│   └─ → 审核台 review.html（push）
│        ├─ → 食材审核 review-ingredient.html
│        └─ → 菜品审核 review-dish.html
├─ 登录/注册 login.html            ← v1.4 新增（未登录 push；含忘记密码 · 登录成功 → 今日）
└─ 我的 mine.html                  ← v1.4.3 重构（资料头部 + 入口列表）
    ├─ → 编辑资料 edit-profile.html（登录 push · 头像/昵称）
    ├─ → 我的私有食单 my-content.html（登录 push）
    ├─ → 用户管理 admin-users.html（admin push）
    └─ → 设置 settings.html（登录 push · 通用/关于/退出登录）
```

- 工坊定位：数据基建的单件流转与快速处理；大批量作业仍走桌面端审核台（`web/review.html`）。
- 工坊与审核页均为 push 页；深链规划 `shike://dish/{name}`、`shike://ingredient/{name}`、`shike://term/{name}`、`shike://review/{id}`。
- **C 端只呈现「已通过」内容**；`status` 三态仅出现在工坊的审核模块。

## 工坊 ↔ 真实 API 映射（v1.4.1）

| 页面 | 后端对应 | 页面呈现 |
|---|---|---|
| pipeline.html | `GET /api/terms`（节气全集）+ `POST /api/batch` → `{term, recommended, inserted, doubts, failed}` | 节气任选（默认当前 ±2）+ 五步 stepper + 入库/存疑/失败分组（doubts 与 failed 原因逐条展示） |
| dish-generate.html（双厨师） | `POST /api/dishes`（同一接口）：默认分支传 ingredients 数组（去重保序，空/非法 400）→ 四 stage；`{"chef":"cuisine","mode":"cuisine/name/ingredient"}` → 六 stage（含 invalid_input/not_found）；`GET /api/cuisines`（菜系 18 项）；美食大厨 story 必填、cuisine 模式 excluded 必空、style 首段须为所选菜系、按菜系注入已收录菜名防重、按菜名预检 duplicate | 出品厨师点选切换（页内 JS）；健康厨师：候选池+四态+excluded；美食大厨：三模式面板（按菜系/按菜名/按食材）+ story 味字卡 + dish 字段预览 + 六 stage 规则卡 |
| review.html | `GET /api/ingredients`、`GET /api/dishes`（按状态分组整表） | 三态计数、分段队列、分页（端内行为） |
| review-ingredient.html | `POST /api/status` `{name, status}` | 全字段 + 词表值域校验标记 + 通过/驳回 |
| review-dish.html | `POST /api/dish/status` `{name, status}` | 全字段 + remark 存疑列表 + 通过/驳回 |
| login.html | `POST /api/auth/register`（phone 1 开头 11 位 / password ≥6，409 已注册）、`POST /api/auth/login`（401 不正确 / 401 已禁用）→ `{token(access 2h), refresh_token(30天), user}` | 双 Tab 表单、密码可见切换、接口对齐错误态、未登录可浏览官方库 |
| mine.html | `GET /api/auth/me` | 资料头部（昵称/手机掩码/角色徽章）+ 入口列表（私有食单/审核/用户管理/设置） |
| edit-profile.html | `PATCH /api/auth/me`（nickname 1–50 字） | 头像更换（user.avatar 规划中，接口待补）+ 昵称编辑（计数器、错误文案对齐）；手机号/角色只读 |
| settings.html | 退出登录（清除本机令牌）；入节提醒为本地开关，后续可扩展定时任务 | 极简两块：入节提醒开关 + 退出登录（danger + 确认弹层示意）；口味忌口/关于按用户要求移除 |
| login.html 补充 | 密码修改：后端现仅支持登录态 `PATCH /api/auth/me`（需 current_password）；未登录找回/重置接口待补 | 登录页「忘记密码？」链接 + 待补标注 |
| my-content.html | `GET /api/dishes/{id}` 等（optional_login + 可见性：官方库人人可见，私有仅本人/admin，他人 404）、`PATCH`（全字段轻校验）、`DELETE` | 私有内容分段列表、三态徽标、查看/编辑/删除、删除确认说明；「创建私有内容」接口待补 |
| admin-users.html | `GET /api/users`、`PATCH /api/users/{id}`（nickname/status/role；不能禁用或降级自己）、`DELETE /api/users/{id}`（不能删自己；名下有内容 409） | 用户列表卡（role/status 徽章）、操作按钮按规则置灰、规则提示卡 |

## 设计系统速览

完整规范见 [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)。核心一句话：**新中式 × 青春活力 —— 亮纸底、墨色字、四季明彩、粉彩渐变面板、贴纸星光点缀**。

- **中性层**：亮纸 `#FAF6ED` / 墨 `#26231C`（13.7:1）/ 次级 `#5B564A`（6.4:1）/ 辅助 `#6E6858`（仅 ≥13px）
- **四季明彩**（accent 随当前节气季节切换，原型为冬·青蓝 `#35759F`）：春绿 `#2E8C55` · 夏朱 `#C14F32` · 秋琥珀 `#B7791A` · 冬青蓝 `#35759F`，各配深档与淡底；填充白字全部 ≥4.5:1
- **粉彩面板 `.panel-pop`**：蓝→青瓷→奶油渐变，封面/Hero/身份卡/横幅统一明底墨字（4.8–14.6:1）
- **食材默认图（v1.3.1）**：不做手绘插画，统一默认占位图（虚线圆盘 + 叶形 glyph）+「默认图」角标；工坊审核详情页提供「上传 / 替换图片」——菜品 `POST /api/dish/image`、食材 `PATCH /api/ingredients/{id}`（image ≤500 字），接口均已实现
- **活力元件**：朱砂印章（斜贴）、高饱和食签牌（彩影）、贴纸徽章（每屏 ≤2 枚）、星光/波浪涂鸦（reduced-motion 停用）、白托盘热量环、悬浮 Dock（白色吃掉区：内容下滑被白色导航区无感吞没）
- **四气徽章**（功能信息色+字双编码）：寒→热 七档冷/中/暖色阶；五味为中性描边 chip
- **字体**：Noto Serif SC / Songti SC（节气名、菜名、典籍引文）× PingFang SC / Noto Sans SC（正文），热量/分量用 tabular-nums

## 与后端功能的映射

| 现有功能/字段 | App 呈现 |
|---|---|
| 节气词表（24）+ 当前 ±2 推荐口径 | 今日 Hero 当令带、菜谱/食材默认筛选、全年节气页 |
| `GET /api/batch/last` | 工坊首页「最近批次」 |
| `ingredient`（四气/五味/归经/功效/季节/caution/classic_note） | 食材百科 + 食材详情（徽章、归经行、引文卡） |
| `dish`（category/主料定量/steps/calories/benefits/caution/style/solar_terms） | 菜谱库 + 菜品详情（定量表、时间线、双角度好处、忌口） |
| 「健康厨师」/「美食大厨」出品标识 | 菜品卡/详情徽章：健康厨师=朱砂红、美食大厨=琥珀（两流水线均已上线，词表双值） |
| `dish.story`（风味与文化背景，美食大厨必填） | 生成结果「味」字卡；C 端菜品详情规划「风味与文化」卡（美食大厨出品显示） |
| `dish.image` / `ingredient.image`（图片 URL ≤500 字） | 默认占位图 + 工坊上传/替换：菜品走 POST /api/dish/image，食材走 PATCH /api/ingredients/{id} |
| `dish.category` 词表双值（健康厨师/美食大厨，均已上线） | 工坊单入口（菜品生成）+ 页内出品厨师点选切换；美食大厨三模式输入面板（按菜系/按菜名/按食材）页内可切换 |
| 词表封闭值域 | 全部筛选 chip 的取值即词表值，不自造 |

## 声明与后续

- **示例数据**：原型中的食材档案、菜谱、典籍引文、审核队列与计数均为设计占位，值域对齐词表与真实 API 但未经考据审定；上线内容以流水线 + 审核台产出为准。美食大厨示例菜「豉汁蒸排骨」的 story 与字段为设计占位。
- **v1 不做**：暗色模式（Token 已预留映射方案）、社区/评论、视频步骤、第三方登录（后端仅手机号+密码）。
- **预留扩展**：菜品详情「开始烹饪」全屏步骤模式、入节提醒推送、偏好参与菜谱排序、工坊内流水的实时运行态（当前展示为完成态示例）。
- **认证与私有内容已设计（v1.4）**：登录/注册、我的（登录态）、我的私有食单、用户管理四页；refresh 令牌续期与令牌失效态（401 → 回登录页）为交互层行为，原型以说明标注。

## 预交付自检（2026-11-10 · v1.2 复检）

- [x] 文字对比（脚本实测）：墨字/粉彩面板 13.6–14.6:1、次级 6.4:1、辅助 ≥13px 配 4.8:1；四季填充白字 4.5–5.0:1；主按钮渐变两端 5.0/7.8:1；四季横幅深字 5.1–6.7:1；贴纸墨字 8.4–11.4:1；热量环弧/白托盘 4.3:1（图形 ≥3 ✓）
- [x] 触控目标：Dock 项、返回钮、chip ≥36px 高（chip 为筛选态展示，实现期热区扩至 ≥44 含 padding）；行点击热区整行
- [x] 不依赖颜色单独传义：四气徽章色+文字；忌口=图标+文字；节气 Tag 文字
- [x] 语义标题 h1→h2 顺序；图标按钮均有 `aria-label`；签牌/印章/贴纸/涂鸦全部 `aria-hidden`（信息由相邻文字承载）
- [x] `prefers-reduced-motion` 全局降级（星光缓浮动画停用）；`:focus-visible` 可见焦点
- [x] 单一图标族（线性 1.8px SVG Sprite + 手绘涂鸦例外），无 emoji 图标
- [x] 内容区底部预留 Dock/操作条下垫空间（122px/130px），无遮挡；无头 Chrome 逐页渲染验收
