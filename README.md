# 食刻 · Shike

二十四节气 × 顺时饮食:当令食材百科、AI 生成时令菜谱、工坊流水线与审核闭环。
RN(Expo 58) Android APK 直连 `http://IP:8787` Flask + MySQL;LLM = 智谱 GLM-5.3-Flash。

```
mobile/   Expo 移动端        web/      Flask 入口(web/app.py)
shike/    领域层(DB/校验/词表) llm/      三条 LLM 流水线
db/       schema + 增量迁移   docs/     文档(部署细节见 docs/DEPLOY-v1.md)
```

## 本地开发

```bash
# 服务端(仓库根,Python ≥3.10)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.dev.example .env.dev        # 填 MySQL / 智谱 Key / JWT 密钥
.venv/bin/python -m flask --app web.app run --port 8787

# 移动端
cd mobile && npm install
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787 npx expo start
```

## 部署(服务器 IP 直连,无域名)

### 服务端

```bash
git clone https://github.com/zzti-bsj/food_menu.git /srv/shike && cd /srv/shike
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt gunicorn

# 1. MySQL:建库 shike(utf8mb4)+ 专用账号,然后按文件名顺序执行迁移
mysql -u <user> -p shike < db/schema.sql
for f in db/upgrade/*.sql; do mysql -u <user> -p shike < "$f"; done   # Duplicate column = 已执行,跳过

# 2. 配置(SHIKE_ENV=prod 时读取 .env.prod)
cp .env.dev.example .env.prod       # 填 DB / JWT 密钥(openssl rand -hex 32)/ 智谱 Key

# 3. 启动(systemd 常驻,单元文件样例见 docs/DEPLOY-v1.md)
SHIKE_ENV=prod .venv/bin/gunicorn -w 2 -b 0.0.0.0:8787 'web.app:app'

# 4. 验证 + 防火墙
curl http://127.0.0.1:8787/api/terms      # 24 节气 JSON
# 安全组/ufw 只放行 TCP 8787;3306 不对公网
```

图片落盘 `web/uploads/`,备份 DB 时连目录一起备(库内只存相对路径)。

### 移动端 APK

服务端地址是构建期常量,换 IP 就重打:

```bash
cd mobile
EXPO_PUBLIC_API_BASE_URL=http://<IP>:8787 npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# 产物 android/app/build/outputs/apk/release/app-release.apk
# 构建机需 JDK 17 + Android SDK(platforms/build-tools),详见 docs/DEPLOY-v1.md
```

### 升级

```bash
cd /srv/shike && git fetch && git checkout <新tag>
.venv/bin/pip install -r requirements.txt
mysql -u <user> -p shike < db/upgrade/<新迁移>.sql   # 如有
sudo systemctl restart shike
```

## v1 安全边界

- HTTP 明文直连,接受同网抓包风险;上域名后改 `EXPO_PUBLIC_API_BASE_URL` 重打包即可,服务端零改动
- 私有内容仅本人/admin 可见,他人一律 404
- `.env.*` 不入库;生产用新生成的 JWT 密钥与 API Key
