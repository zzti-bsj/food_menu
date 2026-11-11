# CRUD 补齐设计 —— 按 id 的详情/更新/硬删除、用户管理、自助资料

日期:2026-11-10
状态:已与用户确认(硬删除、本人或管理员两决策定稿)

## 背景与目标

前期实现的仓储与接口围绕「LLM 生成 → 人工审核」流水线:创建只有管道插入,读取只有全量列表,更新只有审核状态窄更新(`status`/`image`),删除完全没有。本期补齐三实体(`ingredient`/`dish`/`user`)的标准 CRUD 缺口:

1. **按 id 定位**的单查、通用字段更新、硬删除(食材/菜品)
2. **用户管理**(admin):列表、改状态/角色、删除
3. **自助资料**:改昵称、改密码

原则:**既有接口与审核台契约一律不动**(`review.html` 依赖的 name 定位接口原样保留),新端点全部按 id 定位;`status` 不进通用更新,审核状态仍走 `/api/status` 与 `/api/dish/status` 专用流。

## 已确认决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 删除语义 | **硬删除** | 无需迁移;`已驳回` 状态已承担「保留记录但不用」语义;删除定位为清理垃圾数据,并释放 `uk_name` 唯一名供重新收录/生成 |
| 内容写权限 | **本人或管理员** | 官方库(`user_id IS NULL`)仅 admin 可写;私有内容本人或 admin。现阶段所有内容均为官方库,行为等同仅 admin,为下一期用户内容铺路 |
| 写身份要求 | 新端点一律 `require_login` | 既有 `/api/*` 按上期决议保持不加锁不动 |

## 权限与可见性模型

| 操作 | 匿名 | `user` | `admin` |
|---|---|---|---|
| GET 详情(官方内容) | ✅ | ✅ | ✅ |
| GET 详情(他人私有内容) | 404 | 404(防探测) | ✅ |
| GET 详情(自己私有内容) | 404 | ✅ | ✅ |
| PATCH / DELETE 官方内容 | 401 | 403 | ✅ |
| PATCH / DELETE 自己私有内容 | 401 | ✅ | ✅ |
| PATCH / DELETE 他人私有内容 | 401 | 404(防探测) | ✅ |
| `GET/PATCH/DELETE /api/users/*` | 401 | 403 | ✅ |
| `PATCH /api/auth/me` | 401 | ✅ | ✅ |

实现:`web/auth.py` 新增 `optional_login`(带有效令牌则注入 `g.current_user`,否则匿名放行)供公开读接口判定私有可见性;`web/app.py` 以 `_can_write`/`_visible`/`_load_writable` 三个辅助统一判定。

## 端点契约

### 食材/菜品(对称,示例以食材为准)

| 端点 | 说明 |
|---|---|
| `GET /api/ingredients/<id>` | 单查,含 `id/user_id/status` 全字段,见权限表 |
| `PATCH /api/ingredients/<id>` | 部分更新。白名单=业务字段+`image`(拒绝未知字段与 `status`);业务字段合并现有行后整体跑 `validate_ingredient`(校验器天然吃数据库行形状),`image` 单独轻校验(≤500 字字符串或 null,空串视为清空);校验失败 400 返回 `{error, details[]}`;改 `name` 撞唯一键 409;成功返回更新后完整行 |
| `DELETE /api/ingredients/<id>` | 硬删除,`{ok: true}`;未命中/无权见权限表 |

菜品差异:白名单为 `_DISH_PATCH_FIELDS`(13 业务字段 + `image`,不含 `status`/`user_id`);校验为轻校验 `_dish_patch_errors`——字符串类型、按列宽限长(`steps` 为 TEXT 不限)、`category` ∈ 菜品分类词表、`solar_terms` ∈ 节气词表且升序。注意菜品存储形状是数据库行(逗号串/文本),不是管道的列表形状,所以不复用 `validate_dish`。

### 用户管理(admin)

| 端点 | 说明 |
|---|---|
| `GET /api/users` | 全量列表按 id 升序,`_user_view` 脱敏(永不携 `password_hash`) |
| `PATCH /api/users/<id>` | 白名单 `nickname/status/role`(手机号不可改);值域校验(`正常/禁用`、`user/admin`、昵称 1-50 字);**禁止管理员禁用自己或把自己降级为 user**(400);成功返回脱敏 user |
| `DELETE /api/users/<id>` | **不能删自己**(400);名下仍有食材/菜品则 409(提示改用禁用),否则硬删除 |

### 自助资料

`PATCH /api/auth/me`(require_login):
- `nickname`:1-50 字,strip 后写入
- `password`:≥6 位,**必须携带 `current_password` 并验证通过**,否则 403;成功后旧令牌仍有效(令牌不含密码版本,本期不做全端下线)
- 请求体只含 `current_password` 而无实际修改项 → 400;成功返回脱敏 user

## 仓储层新增(`shike/repository.py`)

`find_ingredient_by_id`、`update_ingredient(id, fields)`、`delete_ingredient(id)`、`find_dish_by_id`、`update_dish(id, fields)`、`delete_dish(id)`、`list_users`、`update_user(id, fields)`、`user_owns_content(id)`、`delete_user(id)`。沿用「connect + try/finally + DictCursor + 白名单动态拼接」既有风格;更新函数只吃各自白名单(`_INGREDIENT_FIELDS` / `_DISH_FIELDS`+`image` / `nickname,role,status,password_hash`),返回是否命中。

## 边界与不做

- 删除机制本身**无 schema 变更**(硬删除,不加 `deleted_at`);食材图片列见 `db/upgrade/2026-11-10-ingredient-image.sql`(`ingredient.image VARCHAR(500)`,与菜品 `image` 同构)
- 既有 name 定位接口、`review.html`、两条生成管道完全不动
- 用户内容创建流程、审核状态语义(私有内容)仍留下一期
- admin 重置他人密码、改他人手机号不做(改密走自助,手机号是登录身份不开放)
- 改密后旧 access/refresh 令牌不失效(无令牌版本号机制,按需下期加)

## 测试

- `tests/test_web_crud.py`(11 例):公开读/私有 404、owner/admin 可见、401/403/404、校验 400 矩阵、改名 409、硬删除生效、菜品轻校验(类型/词表/图片字段)
- `tests/test_web_users.py`(8 例):401/403、列表脱敏、状态/角色修改与自禁/自降守卫、删号三守卫(自己/名下有内容/不存在)、自助昵称与改密(错/缺当前密码 403,成功后新密码可登录)

仓储函数按既有惯例 `monkeypatch.setattr(repository, ...)` 逐函数打桩,无真实 DB 依赖。
