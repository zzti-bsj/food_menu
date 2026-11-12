# 食刻 · Shike

二十四节气 × 顺时饮食的移动应用:当令食材百科、AI 生成时令菜谱、工坊流水线(食材批量 / 健康厨师 / 美食大厨)与内容审核闭环。

- **移动端**:React Native(Expo SDK 58)+ Expo Router,Android APK 直连服务端 IP:Port(v1 不使用域名/HTTPS)
- **服务端**:Python Flask + MySQL 8,JWT 鉴权(手机号 + 密码),LLM 对接智谱 GLM(GLM-5.3-Flash)
- **v1 部署文档**:见本 README「部署」章节;详细运维说明见 [`docs/DEPLOY-v1.md`](docs/DEPLOY-v1.md)

## 目录结构

```
mobile/            Expo 移动端(pnpm/npm 脚本见 mobile/package.json)
web/               Flask 应用入口(web/app.py)与审核台静态页
shike/             领域层:repository(MySQL)/validate/vocab/config
llm/               LLM 流水线:食材批量、健康厨师、美食大厨、推荐
db/                schema.sql 与 db/upgrade/*.sql 增量迁移(按日期顺序执行)
data/vocab/        词表(节气/分类/四气五味归经/功效/菜系),封闭值域唯一事实来源
docs/              文档(部署、设计)
```

## 本地开发

```bash
# 服务端(仓库根目录)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.dev.example .env.dev        # 填 MySQL / 智谱 API Key / JWT 密钥
.venv/bin/python -m flask --app web.app run --port 8787

# 移动端
cd mobile && npm install
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787 npx expo start
```

## 部署(v1 · IP:Port 直连)

生产环境 = 一台服务器(IP 直连,不配域名/HTTPS)+ 本仓库 + MySQL。完整步骤见 [`docs/DEPLOY-v1.md`](docs/DEPLOY-v1.md),摘要如下。

### 服务端

```bash
git clone https://github.com/zzti-bsj/food_menu.git /srv/shike && cd /srv/shike
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt gunicorn
```

1. **MySQL**:建库 `shike`(utf8mb4),创建专用账号;按顺序执行 `db/schema.sql` 与 `db/upgrade/*.sql`(按文件名日期排序,已执行过的会报 Duplicate column,跳过即可);
2. **配置** `cp .env.dev.example .env.prod`,填入数据库账号、`SHIKE_JWT_SECRET`(生产用 `openssl rand -hex 32` 新生成)、智谱 API Key;`SHIKE_ENV=prod` 时加载此文件;
3. **启动**:`SHIKE_ENV=prod .venv/bin/gunicorn -w 2 -b 0.0.0.0:8787 'web.app:app'`,常驻用 systemd(单元文件样例见部署文档);
4. **验证**:`curl http://127.0.0.1:8787/api/terms` 返回 24 节气 JSON;
5. **防火墙**:仅对公网开放 TCP 8787;MySQL 只监听本机。

> 图片上传落盘在 `web/uploads/`(首次上传自动创建)。**备份数据库时必须连同该目录一起**,库内只存相对路径。

### 移动端(APK)

服务端地址是**构建期常量**,打包时烧录:

```bash
cd mobile
EXPO_PUBLIC_API_BASE_URL=http://<服务器IP>:8787 npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# 产物:android/app/build/outputs/apk/release/app-release.apk
```

服务器 IP 变更 = 改地址重新构建分发新 APK。构建机需要 JDK 17 + Android SDK(platforms/build-tools),详见部署文档第 5 节。

### 升级

```bash
cd /srv/shike && git fetch && git checkout <新tag>
.venv/bin/pip install -r requirements.txt
# 有新迁移: mysql -u shike -p shike < db/upgrade/<新文件>.sql
sudo systemctl restart shike
```

## 安全边界(v1)

- **明文 HTTP**:IP 直连无 TLS,令牌与内容可被同网抓包,v1 接受此风险;后续上域名后仅需改 `EXPO_PUBLIC_API_BASE_URL` 重新打包,服务端零改动;
- 私有内容(用户生成的菜谱/食材)仅本人与管理员可见,他人访问一律 404 防探测;
- `.env.*` 含密钥与密码,已被 `.gitignore` 忽略,永不入库;生产部署前轮换 JWT 密钥与 API Key。
