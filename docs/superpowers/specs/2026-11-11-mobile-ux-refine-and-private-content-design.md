# 移动端体验修订与私有内容闭环 —— 设计文档

> 2026-11-11 · 依据用户五点反馈 + CRUD 补齐决策（选型：生成即归属 + 编辑，不做手动从零创建表单）

## 背景

移动端（Expo/RN）对 design/shike-app 设计稿的还原已到位，但存在五类问题：输入框全局单一样式且无浮动标签质感；开发者视角文案外漏；「最近批次」卡片价值低；「我的」页暴露运营职能入口；私有内容创建链路缺失导致「我的私有食单」永远为空。后端 RUD 接口与权限守卫已齐（web/app.py），唯一缺口是「创建」不落个人归属。

## ① 输入框：新建 `components/ui/field.tsx` 组件族

**问题**：当前 login/edit-profile/dish-generate 三处输入框为复制粘贴的同一套样式（常显 label + 48px 圆角框 + 框内 placeholder），label 与 placeholder 双文字冗余，无聚焦动画，无场景分化。

**设计**：

- 单组件 `Field`，props：`label`、`value`、`onChangeText`、`variant: 'outline' | 'filled'`、`error?`、`helper?`、`secure?`（密码可见切换）、以及 TextInput 原生 props 透传。
- **真浮动标签**：空值失焦时 label 沉在框内作占位文字（ink3 色、16px）；聚焦或有值时动画上浮至框内顶部（12px、四季 accent 色）。用 RN 内置 `Animated`（timing 160ms，ease-out），不引新依赖。
- **variant 分化**：
  - `outline`（login、edit-profile）：1.5px `lineStrong` 描边、surface 底、14px 圆角；聚焦描边过渡为当季 accent；错误态描边 + 错误图标 + 朱砂文案（沿用现有逐字对齐后端的规则）。
  - `filled`（dish-generate 菜名与自由输入）：`surface2` 填充底、无描边；聚焦时浮出 1px accent 描边；整体观感更轻，匹配生成流程。
- 密码可见切换、`keyboardType`/`textContentType`/`autoComplete`、失焦校验时序、`maxLength` 等既有行为全部保留。
- 三个页面接入后删除各自的内联输入样式。

## ② 文案清理（开发者视角 → 用户视角）

| 位置 | 现状 | 改为 |
|---|---|---|
| workshop.tsx 入口卡副标题 | 「推荐 → 填充 → 校验 → 核验 → 入库待审核」「生成 → 校验 → 核验 → 入库待审核」 | 一句话利益点：「选节气，一键生成时令食材档案」「点食材，生成一道专属菜」 |
| workshop.tsx 底部 hint | 「最近批次对应 GET /api/batch/last;…桌面端审核台」 | 删除 |
| pipeline.tsx STEPS | 五步各带 desc（LLM 推荐候选/逐字段生成…） | 步骤条保留（执行进度），desc 删除 |
| my-content.tsx 顶部提示 | 「仅本人与管理员可见;他人访问详情一律 404(防探测)」 | 「仅自己与管理员可见」 |
| my-content.tsx 空态 | 「暂无私有菜品(创建接口待补)」 | 「还没有内容，去工坊生成第一道菜」＋跳转入口 |
| dish-generate.tsx 失败态标签 | 「事实核验驳回」「结构校验未通过」 | 「内容核验未通过，请调整后重试」 |
| review*.tsx、其余页面 | 全量扫一遍同类 API 名/内部流程词 | 同原则替换 |

## ③ 移除「最近批次」卡片

workshop.tsx 删卡片与空态文案；`getLastBatch` 及 `workshop-api.ts` 中仅服务于它的代码删除；后端 `/api/batch/last` 保留（桌面审核台在用，不动后端）。

## ④ 审核入口收敛为 admin 可见

- mine.tsx「官方库审核」行：`user.role === 'admin'` 才渲染，与「用户管理」同组。
- workshop.tsx「审核待办」卡片：同样 admin 可见（普通用户不显示审核统计）。
- 已知问题（本批不改，单独记录）：`/api/dish/status`、`/api/status`、`/api/dish/image`、`/api/batch` 等写接口无登录鉴权，桌面 review.html 直连；后续应加 require_admin 并给 review.html 配令牌。

## ⑤ 私有内容闭环：生成即归属 + 编辑

**后端**（web/app.py、llm/*、shike/repository.py）：

- `POST /api/dishes`（菜品生成）、`POST /api/batch`（食材流水线）改为**可选归属**：请求携带有效 access token → pipeline 落库写入 `user_id = 当前用户`，状态仍「待审核」；无 token/无效 → 维持现状 `user_id = NULL`（官方库）。
- 选「可选归属」而非强制 `require_login` 的原因：review.html 桌面审核台 HTTP 直连这两个端点（无令牌），强制登录会打断它；且匿名可写本就是现状，本方案只做增量收紧（登录→私有），鉴权加固另列已知问题。`scripts/*.py` 桌面脚本为 Python 直接 import 流水线，不受影响。
- 实现：`DishPipeline/CuisinePipeline/IngredientPipeline.run()` 增加 `user_id` 参数传入 `insert_dish/insert_ingredient`（repository insert 按白名单拼列，补 user_id 即可）；端点对 Authorization 头做可选解析（decode 成功取 user，失败/缺失静默置 None）。

**移动端**：

- dish-generate.tsx、pipeline.tsx 请求带 token（apiFetch 已支持 `auth: true`）；工坊两个生成入口对未登录用户点击时引导去登录（保证移动端产出皆有归属，匿名官方库路径留给桌面台）。
- 生成成功提示语指向「我的私有食单」；my-content 空态提供跳转。
- **编辑入口**：`dish/[id].tsx`、`ingredient/[id].tsx` 详情页，当 `user_id === user.id` 或 admin 时显示「编辑」按钮 → 新增 `edit-dish/[id].tsx`、`edit-ingredient/[id].tsx` 两个表单页，预填现值，提交走已有 `PATCH /api/dishes|ingredients/<id>`，字段校验失败/409 重名逐字呈现；成功后返回详情并刷新。
- 编辑表单全部使用新 `Field` 组件（含多行 steps 用 filled 多行变体）；词表字段（四气/五味/归经/功效/节气）用现有 filter-chip 多选模式。

## 权限与可见性（不变，复述以自检）

官方库（user_id NULL）写操作仅 admin；私有内容本人或 admin；他人私有详情 404；C 端列表只见「已通过」+ 本人三态。

## 错误处理

- 表单：失焦校验（前端）+ 提交后端 400 `details` 逐字展示 + 409 重名提示，沿用 login.tsx 既有模式。
- 生成归属：token 过期按现有 apiFetch 刷新逻辑，不额外处理。

## 测试

- 后端 pytest：生成带 token → 落库 user_id 正确、状态待审核；无 token → user_id 为 NULL（官方库路径不回归）。repository.insert_dish/insert_ingredient 含 user_id 列断言。
- 移动端：`npx expo lint`、`npx tsc --noEmit`；Field 组件与编辑页交互用现有 jest 配置补基础测试（浮动标签状态切换、提交调用）。
- 手工验证清单：登录后生成→「我的私有食单」出现→详情编辑→保存→删除；普通用户「我的」/工坊不见审核入口。

## 不做（明确出栈）

- 手动从零创建菜品/食材表单（用户已选不做）
- review.html 桌面端登录改造、写接口鉴权加固（记录为已知问题）
- 审核流程 UI 改版（仅入口可见性调整）
- 后端 `/api/batch/last` 移除
