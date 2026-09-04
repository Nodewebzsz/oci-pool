# OCI-Pool 全自动部署方案

## 目标

推送到 `master` 后自动构建、自动递增版本号、自动把镜像推到 `docker.io/zszken/oci-pool`，VPS 上拉取最新镜像即可完成更新。

## CI 流水线行为

工作流：[`.github/workflows/auto-deploy.yml`](../.github/workflows/auto-deploy.yml)

1. **触发**：`push` 到 `master`，或手动 `workflow_dispatch`（可指定版本号）。
2. **跳过标记**：提交信息含 `[skip ci]` / `[ci skip]` 时跳过，用于避免版本回写造成无限循环。
3. **版本号**：
   - 默认从根目录 `VERSION` 读取，`patch+1`。
   - 手动触发可填 `x.y.z`，则直接用该版本号。
   - 版本号同时写入 `oci-server/src/main/resources/application.yml` 的 `oci.version` / `oci.ssh-version`。
4. **回写**：以 `chore: bump version to x.y.z [skip ci]` 提交并推回 `master`。
5. **构建**：`mvn -pl oci-server -am package -DskipTests`。
6. **推送镜像**：`docker.io/zszken/oci-pool:{version}` + `docker.io/zszken/oci-pool:latest`，多平台 `linux/amd64,linux/arm64`。

## 需要在 GitHub 仓库配置的 Secrets

| Secret | 说明 |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub 用户名（`zszken`） |
| `DOCKERHUB_TOKEN` | Docker Hub 访问令牌（可用账号 Settings -> Security -> New Access Token） |
| `TELEGRAM_TO` | 可选，Telegram 部署通知接收者 |
| `TELEGRAM_TOKEN` | 可选，Telegram Bot Token（与 `TELEGRAM_TO` 配合） |

> 仓库必须存在 `zszken/oci-pool`，且推送账号对该仓库有写权限。

## VPS 部署（只拉取，不编译）

> 现在仓库里的 `deploy/docker-compose.yml` 是**本机/源码构建**用的（`app` 用 `build:`），它不会去拉 `zszken/oci-pool` 镜像。VPS 生产请务必用 **`deploy/docker-compose.pull.yml`**，否则 CI 推的新镜像不会被使用。

在 VPS 上放一份 `deploy/docker-compose.pull.yml` 和 `deploy/update.sh`，然后：

```bash
mkdir -p /opt/oci-pool && cd /opt/oci-pool
# 把 deploy/docker-compose.pull.yml 和 deploy/update.sh 上传到这里
chmod +x update.sh

# 首次部署：拉镜像并启动
docker compose -f docker-compose.pull.yml pull
docker compose -f docker-compose.pull.yml up -d
```

访问 `http://<VPS公网IP>:9856/`。

## 每次发版后的更新步骤（必做）

CI 推完 `zszken/oci-pool:{version}` / `:latest` 后，在 VPS 上执行：

```bash
cd /opt/oci-pool && ./update.sh
```

脚本会自动 `pull` 最新镜像、`up -d` 重建 `oci-pool-modern` 并等待健康检查通过。

## 自动更新（三选一）

### 方案 1：cron 定期拉取

```bash
crontab -e
```
添加：

```cron
*/10 * * * * cd /opt/oci-pool && ./update.sh >> /opt/oci-pool/update.log 2>&1
```

### 方案 2：Watchtower 自动更新

```bash
docker run -d \
  --name watchtower \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup --interval 600
```

Watchtower 会自动拉取并重建 `oci-pool-modern` 容器。

### 方案 3：systemd timer（推荐，日志更规范）

创建 `/etc/systemd/system/oci-pool-update.service`：

```ini
[Unit]
Description=OCI-Pool update
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/oci-pool
ExecStart=/opt/oci-pool/update.sh
```

创建 `/etc/systemd/system/oci-pool-update.timer`：

```ini
[Unit]
Description=Run OCI-Pool update every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Unit=oci-pool-update.service

[Install]
WantedBy=timers.target
```

启用：

```bash
systemctl daemon-reload
systemctl enable --now oci-pool-update.timer
```

## 版本展示

- 后端启动时从 `application.yml` 读取 `oci.version` 写入 `app_version` 表。
- 前端「关于」弹窗通过 `GET /api/version/check` 展示当前版本、最新版本、是否需要更新。
- 后端定时拉取 Docker Hub 最新版本标签，有更新时通过 Telegram 通知。

## 注意事项

- 每次版本回写会向 `master` 提交一个带 `[skip ci]` 的 commit，需要 Action 具备 `contents: write` 权限（工作流内已声明）。
- 本仓库 `origin` 是上游 `Nodewebzsz/oci-pool`。要在该仓库跑通流水线并回写版本，需要账号对该仓库有写权限，且该仓库须开启 GitHub Actions。
- `pom.xml` 的版本号与运行版本解耦（运行版本以 `application.yml` / `VERSION` 为准），因此 CI 不修改 Maven 版本，避免连锁改动所有子模块的 `<parent><version>`。
