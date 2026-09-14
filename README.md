<div align="center">

# OCI-Pool

**基于 API 集成的 Oracle Cloud 实例创建与管理系统(基于 OCI-Start 的二次开发分支)**

[![Stars](https://img.shields.io/github/stars/Nodewebzsz/oci-pool?style=flat-square&logo=github&color=yellow)](https://github.com/Nodewebzsz/oci-pool/stargazers)
[![License](https://img.shields.io/github/license/Nodewebzsz/oci-pool?style=flat-square&color=blue)](LICENSE)
[![Issues](https://img.shields.io/github/issues/Nodewebzsz/oci-pool?style=flat-square&color=orange)](https://github.com/Nodewebzsz/oci-pool/issues)
[![Java](https://img.shields.io/badge/Java-8+-ED8B00?style=flat-square&logo=java&logoColor=white)](https://www.java.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

[English](./README.en.md) · [快速开始](#快速开始) · [部署](#部署) · [配置](#配置) · [截图](#截图)

</div>

---

> ⚠️ **使用须知**
> 本项目完全开源,请各位开发者遵守基本操守。**严禁** 修改功能后引导他人部署以盗取账号信息。勿以恶小而为之,勿以善小而不为。

---

## 关于本项目与致谢

本项目是基于开源项目 **[doubleDimple/oci-start](https://github.com/doubleDimple/oci-start)** 的**二次开发分支**。在保留原项目核心能力的基础上，重构提供了现代化的 Web 交互界面（React 18 SPA）、跨平台桌面原生客户端（macOS / Windows）以及更完备的公网生产部署安全加固与易用性改进。

### 🙏 致敬原作者（Acknowledgments）

在此，向原项目作者 **[@doubleDimple](https://github.com/doubleDimple)** 及其团队致以最诚挚的感谢与崇高的开源敬意！

- 🌟 **卓越的基石**：原项目 `oci-start` 在 Oracle Cloud (OCI) API 深度集成、底层 SDK 封装、多租户轮询抢机调度以及复杂网络架构适配上倾注了大量心血，攻克了诸多云平台底层难题，为云上资源自动化运维探索出了一条极具开创性的优秀路径。
- 🤝 **开源精神的传承**：正是因为原作者无私的代码开源与前瞻性的设计思想，才使得本项目（OCI-Pool）的孵化与演进成为可能。本项目立足于上游坚实的底座，专注在现代化双端体验、公网安全加固与零心智自动化运维上做出探索与延伸。
- ⭐ **饮水思源**：如果您觉得本项目对您有所帮助，**强烈建议您首先前往原项目仓库为原作者点亮一颗珍贵的 Star ⭐ 支持原创与开源探索者！**

> 💡 **原项目仓库**：<https://github.com/doubleDimple/oci-start>  
> 📦 **本项目 Releases**：<https://github.com/Nodewebzsz/oci-pool/releases>  
> 📌 *注：本分支会持续跟踪上游更新，但因前端架构与桌面客户端深度重构，不保证与原项目功能完全同步。若需体验上游纯正原生特性，推荐优先体验原项目。*

---

## 功能特性

OCI-Pool 提供完整的 Oracle Cloud (OCI) 资源生命周期管理、自动化抢机与智能运维能力，涵盖从资源开通、配置、网络调优到监控预警的全流程。

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             OCI-Pool 全景功能矩阵                           │
├───────────────────┬───────────────────┬───────────────────┬────────────────┤
│   🚀 开机与抢机    │   🖥️ 实例与运维   │   🏢 租户与大盘   │  🛡️ 安全与防护  │
│ • 独立整页开机工作台│ • 启停/同步/终止  │ • 多租户/多区域中枢│ • 私钥 100% 本地化│
│ • ARM 1:6 黄金配比│ • 原生 VNC/CloudShell│ • 实时配额与成本分析│ • TOTP MFA 双因素 │
│ • 场景快捷时段胶囊 │ • 一键救援模式(Rescue)│ • 区域健康与时延测速│ • 消息验证自适应 │
│ • 智能避让与重试引擎│ • IPv4/IPv6/弹性IP│ • 一键切换受限 API │ • 代理池多节点防封│
├───────────────────┴───────────────────┴───────────────────┴────────────────┤
│   📢 开放生态与通知                    🤖 AI 运维助手     💻 现代双端架构   │
│ • TG/钉钉/Bark/企微/邮件/Webhook      • OCI 故障智能诊断  • React 18 Modern UI │
│ • Cloudflare/EdgeOne DNS 自动绑定      • 开机配置优化建议  • macOS/Win 原生客户端 │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1. ⚡ 独立开机工作台与智能抢机引擎
- **独立整页开机工作台**（`/tenants/:id/boot-create`）：深度整合多区域联动、真实可用镜像动态探测与版本语义化倒序排列；镜像 OCID 只读防误改并支持一键复制。
- **免费层防呆与风控守卫**：内置 ARM 1:6 黄金配比校验（1 OCPU : 6GB 内存）、免费额度超限智能预警、API 开机风控二次确认弹窗，杜绝误操作产生扣费。
- **场景化时段调度**：支持抢机时段快捷胶囊（全天无休、日间模式、夜间防封等）+ 起止防呆联动下拉 + 实时大白话反馈条，直观易用。
- **自动化抢机引擎**：支持多租户、多区域、多规格全并发异步轮询；内置容量不足（Out of capacity）智能避让与阶梯重试退避机制，大幅提升抢机成功率。

### 2. 🖥️ 实例全生命周期与高级运维
- **全生命周期管控**：支持实例秒级启动、停止、重启、终止及批量状态异步同步。
- **原生 VNC / CloudShell 直连**：集成 WebSocket 动态端口中继（websockify），无需实例公网 IP，即可在浏览器中直连远程终端与救援控制台。
- **急救与故障恢复**：一键触发系统救援模式（Rescue Mode），支持网络引导挂载与离线系统修复。
- **弹性网络与质量检测**：支持一键创建/解绑附属 VNIC、IPv4 / IPv6 灵活切换；内置原生 IP 质量检测（纯净度/流媒体解锁/欺诈分），支持坏 IP 自动释放换新。
- **存储与对象存储**：支持在线扩容引导卷与性能 VPU 弹性无缝调节；集成 OCI 对象存储（Object Storage）文件便捷管理。

### 3. 🏢 多租户全景大盘与精细化运营
- **统一多租户中枢**：多租户 API 统一汇聚管理，支持别名、健康探测与分组标签管理。
- **资源配额与成本分析**：租户配额（Quota）实时查询探测、ARM / AMD 免费额度占用大盘，以及历史成本与计费趋势预测（Cost & Usage）。
- **多区域管理与测速**：一键订阅新区域、全区域可用性实时探测、跨区域网络延迟对比测速与最优调度。
- **安全管理与权限下发**：支持一键切换为受限 API（仅保留开机与运维必要权限，隔离高危接口）、API 密钥轮换与证书换绑、安全规则组可视化配置、Admin 用户查询与权限管理。

### 4. 🛡️ 军工级数据安全与多因子防护
- **敏感数据 100% 本地化**：租户 API 私钥与配置全部加密存储于本地 H2 数据库，**绝不上传任何外部服务器**。
- **自适应多因子认证 (MFA)**：支持 Google Authenticator (TOTP 动态密码) 与消息二次验证（Telegram / 钉钉 / Bark 自适应二阶段验证，开箱即用）。
- **代理池防封与隔离**：支持 HTTP / SOCKS5 代理池配置与连通性健康检测，隔离 OCI API 请求，有效防止官方 IP 封禁。

### 5. 📢 全渠道智能通知与生态联动
- **多通道即时推送**：支持 Telegram Bot、钉钉群机器人、Bark (iOS)、企业微信、邮件 (SMTP) 以及自定义 Webhook，抢机成功、实例异常或配额告警秒级触达。
- **自动化 DNS 联动**：深度集成 Cloudflare 与腾讯云 EdgeOne API，实例开机或更换 IP 成功后，自动同步更新域名 A / AAAA 解析记录。
- **开放 API**：提供标准化 API 接口，便于集成外部自动化脚本与第三方运维系统。

### 6. 🤖 内置 AI 运维助手
- **AI 智能对话**：内置 AI 对话中枢（支持 OpenAI、Claude、DeepSeek 等大模型接入）。
- **错误码与故障自愈诊断**：智能识别 OCI API 报错（如 `Out of host capacity`、API 限流、公钥指纹不匹配等）并给出修复建议。

### 7. 💻 现代双端架构与极致体验
- **Modern Web SPA**：基于 React 18 打造的现代化控制台，支持暗黑/明亮主题自适应与全键盘快捷操作，彻底摆脱传统老旧模板。
- **跨平台原生客户端 (macOS / Windows)**：专属客户端支持，与 Web 端工作台 100% 深度对齐，支持系统原生托盘后台静默运行。

---

## 快速开始

### 环境要求

| 组件 | 版本 |
|------|------|
| Java | 8 或更高 |
| 系统 | Linux (推荐 Debian / Ubuntu) |
| Docker | 可选,用于容器化部署 |

Debian / Ubuntu 安装 JDK:

```bash
sudo apt update
sudo apt install default-jdk
```

---

## 部署

提供两种部署方式,任选其一。

### 方式一:脚本部署(本地)

无需 Docker,在一台装有 JDK 的 Linux/macOS 机器上直接运行服务端 jar。脚本会自动检测/安装 JDK 17 与 Redis,并从 GitHub Release 下载最新的 `oci-pool-release.jar`(或使用源码本地构建)。

```bash
# 1. 创建工作目录
mkdir -p oci-pool && cd oci-pool

# 2. 下载部署脚本
wget -O oci-pool.sh https://raw.githubusercontent.com/Nodewebzsz/oci-pool/master/deploy/oci-pool.sh
chmod +x oci-pool.sh

# 3. 一键安装并启动
./oci-pool.sh start
```

常用命令:

```bash
./oci-pool.sh start      # 启动
./oci-pool.sh stop       # 停止
./oci-pool.sh restart    # 重启
./oci-pool.sh status     # 查看状态
./oci-pool.sh update     # 升级(拉取源码重打包/重新下载 release jar)
./oci-pool.sh uninstall  # 卸载(停止并清理数据)
```

启动后浏览器访问 `http://your-ip:9856`,注册管理员账号即可登录。默认端口 `9856`,可通过环境变量覆盖:

```bash
OCI_PORT=9860 ./oci-pool.sh start
```

> 新版本脚本会自动检测/安装 Redis,如本机已部署 Redis 请先评估冲突。

### 方式二:Docker Compose 部署(推荐,VPS 公网)

需要 Docker 与 Docker Compose v2（全新机器未安装时，`install.sh` 脚本会自动尝试为您安装并启动）。

#### 一键安装(下载脚本)

```bash
mkdir -p oci-pool && cd oci-pool
wget -O install.sh https://raw.githubusercontent.com/Nodewebzsz/oci-pool/master/deploy/install.sh
wget -O update.sh  https://raw.githubusercontent.com/Nodewebzsz/oci-pool/master/deploy/update.sh
chmod +x install.sh update.sh
./install.sh
```

脚本会自动拉取 `zszken/oci-pool` 最新镜像并启动 Redis + 应用,无需在服务器上编译。启动后浏览器访问 `http://your-ip:9856`,注册管理员账号即可登录。

#### 端口与环境变量

在 `oci-pool/` 下创建 `.env`(参考 `.env.example`,`install.sh` 会自动下载到该目录):

```bash
cd oci-pool
cp .env.example .env
```

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `OCI_PORT` | `9856` | 后端应用对外端口 |
| `OCI_WEB_PORT` | `9857` | Nginx 统一入口对外端口(浏览器访问入口) |
| `TZ` | `Asia/Shanghai` | 容器时区（默认北京时间 UTC+8；海外服务器或境外用户可设为 `America/New_York`、`UTC` 等） |
| `MODERN_UI_ENABLED` | `true` | 是否启用 React Modern UI |
| `DB_PASSWORD` | 自动生成 24 位强密码 | **核心安全项**：H2 本地数据库密码，保护租户 API 私钥防脱库 |

> 🔒 **数据安全强烈建议（DB_PASSWORD）**：
> OCI-Pool 采用本地 H2 数据库保存租户配置与私钥，**绝不上传云端**。
> - 使用 `install.sh` 全新安装时，脚本会自动生成 24 位高强度字母数字随机密码写入 `.env`；
> - 若手动配置部署，**强烈建议务必设置 16 位以上的高强度随机密码**（包含大小写字母与数字），严禁留空！这能确保即使 VPS 宿主机发生意外泄露，数据库文件（`vps_db.mv.db`）依然处于密码加密保护之下。

临时覆盖:

```bash
OCI_PORT=9860 ./install.sh
```

#### 日常运维

安装脚本已自动创建软链接，可直接使用原生 Docker Compose 命令：

```bash
cd oci-pool
docker compose ps       # 查看容器状态
docker compose logs -f  # 实时查看日志
docker compose restart  # 重启服务
docker compose down     # 停止(保留 data/ logs/ redis-data/ 数据)
./update.sh             # 更新到最新镜像
```

#### 更新

```bash
cd oci-pool && ./update.sh
```

#### 卸载

```bash
cd oci-pool && ./uninstall.sh   # 停止并删除 data/ logs/ redis-data/ 数据文件夹
```

#### 本地/源码构建(可选)

克隆整个仓库后在 `deploy/`,会同时构建 Nginx 统一入口(含 VNC WebSocket):

```bash
cd deploy
docker compose build
docker compose up -d
```

- 应用入口:`http://localhost:9856/`
- 统一入口(Nginx 反代,含 VNC WebSocket):`http://localhost:9857/`
- 健康检查:`http://localhost:9856/actuator/health`

> `deploy/docker-compose.yml` 是**源码构建**用的(本地/开发);`deploy/docker-compose.pull.yml` 是 **VPS 生产拉镜像**用的。`install.sh`/`update.sh` 被单独下载时默认走拉镜像模式。

---

## 配置

### 基础配置

默认端口为 `9856`,如需修改:

```yaml
server:
  port: 9856
```

### 环境变量

服务端从环境变量读取以下敏感配置,真实值不写入仓库。Docker 部署请在 `deploy/.env` 中填写(参考 `.env.example`);本地脚本部署请 `export` 或在启动环境里注入。

| 变量 | 说明 |
| --- | --- |
| `DB_PASSWORD` | H2 数据库密码。**旧实例升级务必与原有 H2 密码保持一致**,否则无法打开已有 `data/vps_db` |

示例 `deploy/.env`:

```bash
DB_PASSWORD=your-own-h2-pass
```

> Telegram 通知的 Bot Token / Chat ID / Chat Name 在「通知通道」页面维护，已存入数据库 `system_config`，无需在此配置环境变量。

### Nginx 反向代理

如需通过域名访问,Nginx 需配置 WebSocket 转发(用于 VNC 控制台):

```nginx
location ~ ^/websockify/(\d+)$ {
    proxy_pass http://your-backend-ip:$1;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
}
```

#### 常见问题：客户端 Remote 模式下「开机日志」一直显示「连接中…」

* **原因**：开机日志采用 SSE（Server-Sent Events）流式长连接。反向代理（如 Nginx / NPM）默认开启了**代理缓冲（proxy_buffering）**，将服务端的实时流数据卡在内存缓冲区中，导致客户端迟迟无法收到响应头。
* **快速解决**：
  * **Nginx Proxy Manager (NPM) 用户**：
    1. 代理详情页：**关闭「缓存资源 (Cache Assets)」**，保持开启「Websockets 支持」；
    2. 高级配置 ⚙️（Custom Nginx Configuration）：填入以下 5 行防缓冲指令并保存：
       ```nginx
       proxy_buffering off;
       proxy_cache off;
       chunked_transfer_encoding on;
       proxy_read_timeout 86400s;
       proxy_send_timeout 86400s;
       ```
       *(注：开启 Websockets 支持后已内置 http 1.1，切勿在此重复写入 `proxy_http_version`，避免触发 Nginx 冲突报错)*。
  * **原生 Nginx 配置文件用户**：在对应的 `location /` 或 `/system/streamLogs` 中加入上述 5 行 `proxy_buffering off;` 等指令即可。

> 旧版本升级时,除 `security` 配置需完全删除外,其他配置项保持不变即可。

---

## 截图

<div align="center">

### 系统监控
<img width="900" alt="系统监控" src="screenshots/dashboard.png" />

### 实例管理
<img width="900" alt="实例管理" src="screenshots/instances.png" />

### 租户管理
<img width="900" alt="租户管理" src="screenshots/tenants.png" />

### 系统设置
<img width="900" alt="系统设置" src="screenshots/system-config.png" />

<details>
<summary><b>查看更多截图</b></summary>

<br>

<img width="900" alt="IP 质量管理" src="screenshots/ip-quality.png" />
<img width="900" alt="资源列表" src="screenshots/resources.png" />

</details>

</div>

---

## 贡献

欢迎提交 Issue 与 Pull Request。提交前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发流程、分支规范与 Commit 约定。

<a href="https://github.com/Nodewebzsz/oci-pool/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Nodewebzsz/oci-pool" />
</a>

---



## 捐赠

感谢每一位支持本项目的捐赠者。捐赠二维码可在程序"关于"页面查看,捐赠后如需上榜请联系维护者。

<details>
<summary><b>捐赠记录(展开查看)</b></summary>

<br>

| 捐赠者 | 金额 / 物品 | 日期 |
|:------|:-----------|:-----|


</details>

---

## Star 趋势

<div align="center">

[![Star History Chart](https://star-history.dera.page/svg?repos=Nodewebzsz/oci-pool&type=Date)](https://star-history.dera.page/#Nodewebzsz/oci-pool&type=Date)

</div>

---

## 免责声明

- 本项目及相关脚本**仅用于测试、学习与研究**,严禁用于商业用途。
- 不保证内容的合法性、准确性、完整性与有效性,使用前请自行判断。
- 使用者需先遵守所在地区法律法规,一切使用后果由使用者自行承担。
- 维护者对脚本可能引发的任何问题(包括但不限于数据损失)**概不负责**。
- 如任何单位或个人认为本项目侵犯其权利,请提供身份与权属证明,核实后将及时删除相关内容。
- 任何方式查看本项目或使用相关脚本的行为,均视为已仔细阅读并接受本声明。
- 维护者保留随时变更或补充本声明的权利。
- 下载后请于 **24 小时内** 完全删除相关内容。

---

<div align="center">

**Made with care by [@nodewebzsz](https://github.com/nodewebzsz)**

如果这个项目对你有帮助,欢迎点一个 Star ⭐

</div>
