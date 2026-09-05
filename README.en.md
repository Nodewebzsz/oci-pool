<div align="center">

# OCI-Pool

**A powerful system for creating and managing Oracle Cloud instances via API integration (a secondary-development fork of OCI-Start)**

[![Stars](https://img.shields.io/github/stars/Nodewebzsz/oci-pool?style=flat-square&logo=github&color=yellow)](https://github.com/Nodewebzsz/oci-pool/stargazers)
[![License](https://img.shields.io/github/license/Nodewebzsz/oci-pool?style=flat-square&color=blue)](LICENSE)
[![Issues](https://img.shields.io/github/issues/Nodewebzsz/oci-pool?style=flat-square&color=orange)](https://github.com/Nodewebzsz/oci-pool/issues)
[![Java](https://img.shields.io/badge/Java-8+-ED8B00?style=flat-square&logo=java&logoColor=white)](https://www.java.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

[简体中文](./README.md) · [Quick Start](#quick-start) · [Deployment](#deployment) · [Configuration](#configuration) · [Screenshots](#screenshots)

</div>

---

> ⚠️ **Important Notice**
> This project is fully open source. Please respect basic developer ethics — **do not** fork this repository to modify its functionality and trick others into deploying it for the purpose of stealing their account credentials. Do no harm, however small.

---

## About This Project

This project is a **secondary-development fork** of the open-source project [doubleDimple/oci-start](https://github.com/doubleDimple/oci-start). It keeps the core capabilities of the original project and adds a modern web UI (React) plus usability improvements.

This fork tracks upstream updates, but it is **not guaranteed to be fully feature-synced** with the original project. If you want to experience the **latest features** from the original project, please visit:

> 💡 **Original project**: <https://github.com/doubleDimple/oci-start>

> 📦 **This project Releases**: <https://github.com/Nodewebzsz/oci-pool/releases>

---

## Features

OCI-Pool provides end-to-end lifecycle management for Oracle Cloud instances, covering creation, configuration, monitoring, and termination.

### Instance Management
- Concurrent boot across multiple APIs and instances
- Start / stop / sync / terminate operations
- Real-time traffic monitoring
- One-click rescue mode

### Network & Storage
- Create secondary VNICs with a single click
- Boot volume rename and VPU adjustment
- Toggle between IPv4 and IPv6
- Automatic IP quality detection and switching

### Account & Security
- Multi-tenant API management
- Region subscription and switching
- Visual security rule management
- Admin user lookup and creation

### System
- API private keys stored locally in H2 database — **never uploaded**
- Telegram bot used only for snatch notifications; no account data retained
- Clean web-based dashboard for all operations

---

## Quick Start

### Requirements

| Component | Version |
|-----------|---------|
| Java | 8 or higher |
| OS | Linux (Debian / Ubuntu recommended) |
| Docker | Optional, for containerized deployment |

Install JDK on Debian / Ubuntu:

```bash
sudo apt update
sudo apt install default-jdk
```

---

## Deployment

Several deployment methods are available — pick whichever suits your environment.

### Option 1: Docker Compose (Recommended)

The in-repo `deploy/` installer builds the backend image and starts Redis and the app for you.

```bash
cd deploy
./install.sh
```

Once running, open `http://your-ip:9856` and register an admin account. The default port is `9856`; override it with an environment variable:

```bash
OCI_PORT=9860 ./install.sh
```

Container operations:

```bash
cd deploy
docker compose build      # Build
docker compose up -d      # Start
docker compose logs -f    # Follow logs
docker compose down       # Stop
./uninstall.sh            # Uninstall (removes data folders)
```

### Option 2: Manual Build (JDK 17 + Maven 3.9 + Redis)

```bash
mvn -pl oci-server -am package -DskipTests
java -jar oci-server/target/oci-pool-release.jar
```

---

## Configuration

### Basic

The default port is `9856`. To change it:

```yaml
server:
  port: 9856
```

### Nginx Reverse Proxy

To expose the dashboard via a domain, Nginx must forward WebSocket traffic (used by the VNC console):

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

> When upgrading from older versions, remove the `security` block entirely. All other configuration entries can be kept as-is.

---

## Screenshots

<div align="center">

### System Monitor
<img width="900" alt="System Monitor" src="screenshots/dashboard.png" />

### Instance Management
<img width="900" alt="Instance Management" src="screenshots/instances.png" />

### Tenants
<img width="900" alt="Tenants" src="screenshots/tenants.png" />

### System Settings
<img width="900" alt="System Settings" src="screenshots/system-config.png" />

<details>
<summary><b>More screenshots</b></summary>

<br>

<img width="900" alt="IP Quality Management" src="screenshots/ip-quality.png" />
<img width="900" alt="Resource List" src="screenshots/resources.png" />

</details>

</div>

---

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, branch naming, and commit conventions before submitting.

<a href="https://github.com/Nodewebzsz/oci-pool/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Nodewebzsz/oci-pool" />
</a>

---

## Sponsors

Special thanks to the following organizations for their ongoing support:

<table>
  <tr>
    <td align="center" width="33%">
      <a href="https://yxvm.com/aff.php?aff=762">
        <b>YxVM</b><br>
        <sub>Server resources</sub>
      </a>
    </td>
    <td align="center" width="33%">
      <a href="https://github.com/NodeSeekDev/NodeSupport">
        <b>NodeSeek</b><br>
        <sub>Community & infrastructure</sub>
      </a>
    </td>
    <td align="center" width="33%">
      <a href="https://dartnode.com">
        <b>DartNode</b><br>
        <sub>Free VPS for open source</sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="3">
      <a href="https://edgeone.ai/?from=github">
        <img src="https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png" width="280" alt="Tencent EdgeOne"/>
      </a>
      <br>
      <sub>CDN acceleration and security provided by <b>Tencent EdgeOne</b></sub>
    </td>
  </tr>
</table>

---

## Donations

Thanks to everyone who has supported this project. The donation QR code is available in the **About** page inside the app. If you'd like your name added to the list below, reach out to the maintainer after donating.

<details>
<summary><b>Donation history (click to expand)</b></summary>

<br>

| Donor | Amount / Item | Date |
|:------|:--------------|:-----|
| 柯南 | GCP account | 2025-07-15 |
| Riva Milne | GCP account | 2025-07-15 |
| Ja3pez | ¥30 | 2025-07-15 |
| Anonymous | ¥50 | 2025-07-15 |
| Anonymous | ¥215 | 2025-07-14 |
| Anonymous | Cloud account | 2025-04-13 |
| Anonymous | Cloud account | 2025-04-13 |
| xdfaka | ¥68 | 2025-04-13 |
| Anonymous | Cloud account | 2025-04-07 |
| Anonymous | ¥50 | 2025-04-06 |
| Anonymous | ¥9.9 | 2025-04-01 |
| Anonymous | ¥10 | 2025-04-01 |
| Anonymous | Cloud account | 2025-03-25 |
| 柯南 | Cloud account | 2025-03-15 |
| Anonymous | Cloud account (upgrade) | 2025-03-08 |
| Anonymous | ¥9.9 | 2025-03-06 |
| 柯南 | ¥100 | 2025-03-01 |
| Anonymous | ¥200 | 2025-02-15 |
| Anonymous | ¥50 | 2024-11-05 |

</details>

---

## Star History

<div align="center">

[![Star History Chart](https://star-history.dera.page/svg?repos=Nodewebzsz/oci-pool&type=Date)](https://star-history.dera.page/#Nodewebzsz/oci-pool&type=Date)

</div>

---

## Disclaimer

- This project and all related scripts are intended **strictly for testing, learning, and research**. Commercial use is prohibited.
- No guarantee is made regarding the legality, accuracy, completeness, or effectiveness of any content. Use at your own discretion.
- Users must comply with the laws and regulations of their jurisdiction. All consequences arising from use are the sole responsibility of the user.
- The maintainer is **not liable** for any issues caused by the scripts, including but not limited to data loss or damage.
- If any party believes this project infringes on their rights, please provide proof of identity and ownership. Relevant content will be removed upon verification.
- Viewing this project, in any way, or using any of its scripts — directly or indirectly — constitutes acceptance of this disclaimer.
- The maintainer reserves the right to modify or supplement this disclaimer at any time.
- You must completely delete the contents within **24 hours** of downloading.

---

<div align="center">

**Made with care by [@nodewebzsz](https://github.com/nodewebzsz)**

If this project helps you, consider giving it a Star ⭐

</div>
