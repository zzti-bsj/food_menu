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

# 3. systemd 常驻:写单元文件(/etc/systemd/system/shike.service)
sudo tee /etc/systemd/system/shike.service >/dev/null <<'EOF'
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
EOF

# 4. 启动与日常操作
sudo systemctl daemon-reload        # 新建/改动 unit 文件后必须执行
sudo systemctl enable --now shike   # 开机自启 + 立即启动
sudo systemctl restart shike        # 升级 / 改 .env.prod 后重启
sudo systemctl status shike         # 查看是否 active (running)

# 5. 验证 + 防火墙
curl http://127.0.0.1:8787/api/terms      # 24 节气 JSON
# 安全组/ufw 只放行 TCP 8787;3306 不对公网
```

图片落盘 `web/uploads/`,备份 DB 时连目录一起备(库内只存相对路径)。

### 服务端日志与排查

日志由 systemd 收进 journald(不落文件):

```bash
sudo journalctl -u shike -n 100 --no-pager   # 最近 100 行
sudo journalctl -u shike -f                  # 实时跟踪(类似 tail -f)
sudo journalctl -u shike --since today       # 今天以来的
```

`curl -s` 会把连接错误一并吞掉,接口"没返回"时先去掉 `-s` 看真实报错:

```bash
curl -v http://<IP>:8787/api/terms
```

- **Connection refused**:服务器上没有进程监听 8787,即服务没起来或启动失败。先 `systemctl status shike`;若 unit 不存在,按上面第 3 步安装;若 failed,用 journalctl 看根因(常见见下两条)
- **journalctl 出现 `status=217/USER`**:unit 文件里 `User=` 的账号在服务器上不存在(典型:照抄了 `<部署用户>` 占位符)。改成实际存在的用户(root 直装就填 root),然后 `daemon-reload` + `restart`
- **启动失败但 journalctl 显示 Python 报错**:`.env.prod` 漏配 / DB 账号密码错 / gunicorn 没装进 venv,按报错行处理
- **长时间无响应(超时)**:云安全组 / ufw 没放行 TCP 8787
- **服务器本机 `curl 127.0.0.1:8787` 通、外网不通**:同样是安全组问题

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
