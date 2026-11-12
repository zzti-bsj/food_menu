# 食刻 v1 · 生产部署文档(IP:Port 直连,无域名)

> 适用版本:v1(tag `v1`)。架构:Android APK → `http://<服务器IP>:8787`(Flask)→ MySQL 8。
> 移动端直连服务端 IP,不经过域名/HTTPS/反向代理(v1 约定,风险见 §6)。

## 1. 服务器前提(Ubuntu/Debian 为例)

```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-pip mysql-server
```

- Python ≥ 3.10(代码使用 3.10 的 PEP 604 类型语法,3.10/3.11/3.12 均可);MySQL 8.0.13+(归属唯一索引用到功能索引)。
- 开放防火墙/安全组 **TCP 8787**(仅此一个对外端口;3306 不要对公网开放)。

## 2. 数据库初始化

```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS `shike`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'shike'@'localhost' IDENTIFIED BY '<强密码>';
GRANT ALL PRIVILEGES ON `shike`.* TO 'shike'@'localhost';
```

然后按**文件名日期顺序**执行建表与迁移(逐个 `source`,重复执行会因列已存在报错,报"Duplicate column"即说明该步已做过,跳过即可):

```sql
USE `shike`;
SOURCE db/schema.sql;                                  -- 三张基表
SOURCE db/upgrade/2026-11-09-dish-story-image.sql;     -- 菜品 story/image 列
SOURCE db/upgrade/2026-11-10-ingredient-image.sql;     -- 食材 image 列
SOURCE db/upgrade/2026-11-10-user-auth.sql;            -- 用户表 + 内容归属列
SOURCE db/upgrade/2026-11-12-owner-scoped-unique.sql;  -- 归属唯一索引(需 8.0.13+)
SOURCE db/upgrade/2026-11-12-user-avatar.sql;          -- 用户头像列
```

执行后校验:`SHOW COLUMNS FROM user LIKE 'avatar';` 应有一行。

## 3. 应用部署

```bash
sudo mkdir -p /srv/shike && sudo chown $USER /srv/shike
git clone https://github.com/zzti-bsj/food_menu.git /srv/shike && cd /srv/shike
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt gunicorn
```

**配置** `.env.prod`(生产环境读取 `.env.prod`,由 `SHIKE_ENV=prod` 决定,见 `shike/config.py`):

```bash
cp .env.dev.example .env.prod
openssl rand -hex 32          # 生成新 JWT 密钥,填入 SHIKE_JWT_SECRET(不要复用开发值)
```

必填项:`SHIKE_DB_*`(上面创建的 shike 账号)、`SHIKE_JWT_SECRET`、`SHIKE_LLM_GLM_API_KEY`。模型已配置 `SHIKE_LLM_GLM_MODEL=GLM-5.3-Flash`;若调用报"模型不存在",到智谱开放平台控制台核对模型编码大小写(如 `glm-5.3-flash`)后修正。

**启动**(前台验证):

```bash
SHIKE_ENV=prod .venv/bin/gunicorn -w 2 -b 0.0.0.0:8787 'web.app:app'
```

**常驻**(systemd,`/etc/systemd/system/shike.service`):

```ini
[Unit]
Description=Shike API (Flask/gunicorn)
After=network.target mysql.service

[Service]
User=<部署用户>
WorkingDirectory=/srv/shike
Environment=SHIKE_ENV=prod
ExecStart=/srv/shike/.venv/bin/gunicorn -w 2 -b 0.0.0.0:8787 'web.app:app'
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now shike
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/terms   # 期望 200
```

**上传目录**:`web/uploads/` 为图片落盘目录(首次上传自动创建)。备份/迁移必须连同该目录一起,数据库里只存相对路径。

## 4. 移动端(APK)

包构建时通过 `EXPO_PUBLIC_API_BASE_URL` 把服务端地址烧进包里(构建后不可改):

```bash
cd mobile
EXPO_PUBLIC_API_BASE_URL=http://<服务器IP>:8787 npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# 产物:android/app/build/outputs/apk/release/app-release.apk
```

v1 产物 `shike-v1.apk` 即以此方式打包(见 tag `v1`);服务器 IP 变更时改此地址重新构建。安装:传输到手机 → 允许"未知来源" → 安装。

**换服务器 IP = 重新构建 APK**(地址是构建期常量);文档第 5 节为完整构建环境要求。

## 5. (如需自行重新打包)构建机要求

- JDK 17(`brew install openjdk@17` / apt `openjdk-17-jdk`),`JAVA_HOME` 指向它;
- Android SDK:commandline-tools → `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"`,先 `yes | sdkmanager --licenses`;
- `ANDROID_HOME` 指向 SDK 根目录;签名:自建 keystore(`keytool -genkeypair -v -keystore shike-release.keystore -alias shike -keyalg RSA -keysize 2048 -validity 10000`),在 `android/app/build.gradle` 配置 `signingConfigs.release` 后 `assembleRelease`,否则产物为未签名 APK。

## 6. 安全注意(v1 明文直连的边界)

1. **HTTP 明文**:IP:Port 直连无 TLS,令牌与内容可被同网抓包。v1 接受此风险;后续上域名 + Caddy/Nginx + HTTPS 后,仅需改 `EXPO_PUBLIC_API_BASE_URL` 重新打包,服务端零改动。
2. **只开 8787**:MySQL 仅监听本机(`bind-address = 127.0.0.1`),不要对公网开放 3306。
3. **JWT 密钥**用生产新生成值;`.env.prod` 权限 600,不入库(`.gitignore` 已忽略)。
4. **LLM API Key** 是计费凭证,泄漏即被盗刷;泄露后立即在智谱控制台轮换。
5. 上线前建议把 `.env.prod` 里的 `SHIKE_LLM_ROLE_*` 角色分流核对一遍(当前 CUISINE_VERIFY 指向 deepseek 档案,该档案现与 glm 同值占位)。

## 7. 升级流程

```bash
cd /srv/shike && git fetch && git checkout <新tag>
.venv/bin/pip install -r requirements.txt
# 有新迁移时:mysql -u shike -p shike < db/upgrade/<新文件>.sql
sudo systemctl restart shike
```

移动端升级 = 用新 `EXPO_PUBLIC_API_BASE_URL` 重新打包分发新 APK。
