# 用户与鉴权设计 —— user 表、JWT 双令牌、内容归属

日期:2026-11-10
状态:已与用户确认(两轮修正后定稿)

## 背景与目标

「食刻」前期功能(食材/菜品双流水线、审核台、健康厨师/美食大厨 Agent)已实现,尚无用户概念。本设计引入:

1. **user 表**:手机号+密码注册登录,角色分 `user`/`admin`(admin 本期零功能纯预留)
2. **JWT 鉴权**:双令牌(access+refresh)+ 装饰器,给将来的 App API 与移动端审核台铺地基
3. **内容归属**:用户可创建自己的食材、菜品,**用户之间内容不可见**;本期只落归属列,不建创建流程

原则:不过度设计——上锁范围最小、依赖最少、admin 与移动端审核台只预留不实现。

## 实体关系

```
user (1) ──< (N) ingredient   归属:ingredient.user_id
user (1) ──< (N) dish         归属:dish.user_id
```

### 归属语义(关键设计)

现有 `ingredient`/`dish` 表各加一列**可空 `user_id`**,以 NULL=官方库 表达双轨:

| user_id | 含义 | 可见性 |
|---|---|---|
| `NULL` | 官方库内容(流水线+审核台产出) | 对所有人可见,App 消费此库 |
| 非 NULL | 某用户私有内容 | 仅创建者可见,用户之间不可见 |

- **不加** `user_ingredient`/`user_dish` 关联表;将来做收藏/做菜记录时再加多对多表,与归属列互不冲突
- 审核台只呈现官方库(user_id IS NULL)内容;用户私有内容不进审核台
- 「审核台移动端化」预留:审核台将做成移动端界面,用户通过它审核自己范围的内容;本期审核台不加锁,JWT 的 role 设计已为此预留(`role=user` 亦可持令牌调审核接口,范围限自己可见内容——属下一期实现)

## 数据模型

### user 表(新增)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | 主键 |
| `phone` | VARCHAR(20) NOT NULL | 登录凭证,11 位手机号,UNIQUE |
| `password_hash` | VARCHAR(255) NOT NULL | werkzeug 哈希串(scrypt/pbkdf2 格式),不存明文 |
| `nickname` | VARCHAR(50) DEFAULT NULL | 展示名,可空,缺省以手机号掩码显示 |
| `role` | VARCHAR(10) NOT NULL DEFAULT 'user' | `user`/`admin`,CHECK 约束 |
| `status` | VARCHAR(10) NOT NULL DEFAULT '正常' | `正常`/`禁用`,禁用为封禁预留 |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME ... ON UPDATE | 更新时间 |

引擎/字符集与现有表一致(InnoDB + utf8mb4_unicode_ci)。

### ingredient / dish 表(各加一列)

```sql
`user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '归属用户,NULL=官方库',
KEY `idx_user_id` (`user_id`)
```

不设外键约束(与项目现有表同风格,靠应用层保证)。

### 迁移 SQL

`db/upgrade/2026-11-10-user-auth.sql`:CREATE TABLE user + 两表 ALTER(用户手动执行)。

## 鉴权方案

### 依赖

- `PyJWT`(唯一新依赖,纯 Python)
- 密码哈希:Flask 自带 werkzeug 的 `generate_password_hash` / `check_password_hash`,零新增

### 双令牌

| 令牌 | 有效期 | payload | 用途 |
|---|---|---|---|
| access | 2 小时 | `{sub: user_id, role, type:"access", iat, exp}` | 业务请求,`Authorization: Bearer <token>` |
| refresh | 30 天 | `{sub: user_id, type:"refresh", iat, exp}` | 仅用于换新令牌 |

- 算法 HS256;签名密钥 `SHIKE_JWT_SECRET`(.env,`openssl rand -hex 32` 生成;缺失时鉴权端点启动报错)
- **轮换式 refresh**:`POST /api/auth/refresh` 校验 refresh 令牌后签发**新的一对**(access+refresh),旧 refresh 不作废(无服务端状态,自然过期);`type` 字段防止 access 当 refresh 用、反之亦然
- 客户端约定:请求遇 401 → 用 refresh 换新 → 重试原请求;refresh 也失效 → 回登录页
- 有效期可配:`SHIKE_JWT_ACCESS_EXPIRE_HOURS`(默认 2)、`SHIKE_JWT_REFRESH_EXPIRE_DAYS`(默认 30)

### 模块与装饰器

新模块 `web/auth.py`(单一职责:鉴权):

- `require_login`:校验 Bearer 令牌,注入 `g.current_user`(查库确认 status=正常);失败返回 401
- `require_admin`:在 require_login 之上加 role==admin;本期无使用者,纯预留
- `current_user()`:取当前用户(无令牌返回 None)
- 令牌签发/解码、密码哈希封装也在本模块

### 端点(web/app.py)

| 端点 | 鉴权 | 行为 |
|---|---|---|
| `POST /api/auth/register` | 无 | 手机号(11 位校验+查重)+密码(≥6位)→ 创建 user,返回 token 对+用户信息 |
| `POST /api/auth/login` | 无 | 手机号+密码 → 校验 → token 对+用户信息;密码错/禁用 401 |
| `POST /api/auth/refresh` | refresh 令牌 | 换发新令牌对;type 不符/过期 401 |
| `GET /api/auth/me` | `@require_login` | 当前用户信息;**装饰器示范用法** |

### 上锁范围(本期决定)

- 现有 `/api/*`(食材/菜品/流水线/图片)**一律不加锁**,审核台保持开放
- 用户信息不进现有审核台数据;官方库内容对登录用户匿名一视同仁

## 仓储与校验

- `shike/repository.py` 加 `insert_user(record)` / `find_user_by_phone(phone)` / `find_user_by_id(id)`(仿现有函数风格:连接+try/finally)
- phone 查重靠 `uk_phone` 唯一键,注册捕获 IntegrityError → 409

## 测试要点(FakeJWT/FakeJSON 模式)

- register:成功/手机号格式错/重复手机号(409)/密码过短
- login:成功/密码错/禁用用户
- refresh:换新成功/type 混用拒绝/过期拒绝
- me:无令牌 401/合法令牌 200/伪造令牌 401
- 装饰器:require_login 注入 g.current_user、require_admin 角色拦截
- 归属列:迁移 SQL 正确性(列存在、NULL 默认、索引)

## 配置新增(.env.dev)

```
SHIKE_JWT_SECRET=<openssl rand -hex 32 生成>   # 必填(鉴权端点)
# SHIKE_JWT_ACCESS_EXPIRE_HOURS=2              # 可选
# SHIKE_JWT_REFRESH_EXPIRE_DAYS=30             # 可选
```

`.env.dev.example` 同步补充示例行。

## 本期明确不做

- refresh 令牌撤销/黑名单(轮换式无状态,接受「刷新令牌丢失最多用到其自然过期」的风险)
- 短信验证码登录、找回密码、第三方登录
- 收藏/做菜记录关联表
- 用户内容创建流程与私有内容的审核状态语义(下一期,列已预留)
- 审核台登录页与移动端审核界面(下一期方向,已在上文预留说明)
- admin 的任何功能
