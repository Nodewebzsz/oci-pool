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

## 关于本项目

本项目是基于开源项目 [doubleDimple/oci-start](https://github.com/doubleDimple/oci-start) 的**二次开发分支**,在保留原项目核心能力的基础上,提供了现代化的 Web 界面(React)与更多易用性改进。

本分支会持续跟踪上游更新,但**不保证与原项目功能完全同步**。如果你想体验原项目的**最新功能**,请前往原项目:

> 💡 **原项目**:<https://github.com/doubleDimple/oci-start>

---

## 功能特性

OCI-Pool 提供完整的 Oracle Cloud 实例生命周期管理能力,涵盖创建、配置、监控到回收的全流程。

### 实例管理
- 多 API 多实例并发开机
- 实例启动 / 停止 / 同步 / 终止
- 实例流量实时监控
- 系统救援模式一键触发

### 网络与存储
- 一键创建附属 VNIC
- 引导卷名称及 VPU 修改
- IPv4 / IPv6 一键切换
- IP 质量自动检测与切换

### 账户与安全
- 多租户 API 管理
- 区域订阅与切换
- 安全规则可视化管理
- Admin 用户查询与添加

### 系统特性
- 私钥本地 H2 数据库存储,**不上传任何远端**
- Telegram 机器人仅推送抢机通知,不留存账号数据
- Web 可视化面板,直观操作

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

提供以下部署方式,任选其一。

### 方式一:Docker Compose(推荐)

仓库内置 `deploy/` 安装脚本,会自动构建后端镜像并启动 Redis 与应用。

```bash
cd deploy
./install.sh
```

服务启动后,浏览器访问 `http://your-ip:9856`,注册管理员账号即可登录。默认端口为 `9856`,可通过环境变量覆盖:

```bash
OCI_PORT=9860 ./install.sh
```

容器运维:

```bash
cd deploy
docker compose build      # 构建
docker compose up -d      # 启动
docker compose logs -f    # 实时查看日志
docker compose down       # 停止
./uninstall.sh            # 卸载(含数据卷)
```

### 方式二:手动构建(JDK 17 + Maven 3.9 + Redis)

```bash
mvn -pl oci-server -am package -DskipTests
java -jar oci-server/target/oci-pool-release.jar
```

---

## 配置

### 基础配置

默认端口为 `9856`,如需修改:

```yaml
server:
  port: 9856
```

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

## 赞助商

感谢以下机构对本项目的持续支持:

<table>
  <tr>
    <td align="center" width="25%">
      <a href="https://sponsorship.forztn.com/github/doubleDimple/oci-start ">
        <b>ForZTN</b><br>
        <sub>赞助商-ForZTN</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="https://yxvm.com/aff.php?aff=762">
        <b>YxVM</b><br>
        <sub>服务器资源</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="https://github.com/NodeSeekDev/NodeSupport">
        <b>NodeSeek</b><br>
        <sub>社区论坛</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="https://dartnode.com">
        <b>DartNode</b><br>
        <sub>VPS提供商</sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="4">
      <a href="https://edgeone.ai/zh?from=github">
        <img src="https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png" width="280" alt="Tencent EdgeOne"/>
      </a>
      <br>
      <sub>CDN 加速与安全防护由 <b>Tencent EdgeOne</b> 提供</sub>
    </td>
  </tr>
</table>

---

## 捐赠

感谢每一位支持本项目的捐赠者。捐赠二维码可在程序"关于"页面查看,捐赠后如需上榜请联系维护者。

<details>
<summary><b>捐赠记录(展开查看)</b></summary>

<br>

| 捐赠者 | 金额 / 物品 | 日期 |
|:------|:-----------|:-----|
| 柯南 | GCP 账号 | 2025-07-15 |
| Riva Milne | GCP 账号 | 2025-07-15 |
| Ja3pez | ¥30 | 2025-07-15 |
| 匿名用户 | ¥50 | 2025-07-15 |
| 匿名用户 | ¥215 | 2025-07-14 |
| 匿名用户 | 云账号 | 2025-04-13 |
| 匿名用户 | 云账号 | 2025-04-13 |
| xdfaka | ¥68 | 2025-04-13 |
| 匿名用户 | 云账号 | 2025-04-07 |
| 匿名用户 | ¥50 | 2025-04-06 |
| 匿名用户 | ¥9.9 | 2025-04-01 |
| 匿名用户 | ¥10 | 2025-04-01 |
| 匿名用户 | 云账号 | 2025-03-25 |
| 柯南 | 云账号 | 2025-03-15 |
| 匿名用户 | 云账号(升级) | 2025-03-08 |
| 匿名用户 | ¥9.9 | 2025-03-06 |
| 柯南 | ¥100 | 2025-03-01 |
| 匿名用户 | ¥200 | 2025-02-15 |
| 匿名用户 | ¥50 | 2024-11-05 |

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
