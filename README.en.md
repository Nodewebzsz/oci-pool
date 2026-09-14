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

## About This Project & Acknowledgments

This project is a **secondary-development fork** based on the excellent open-source project **[doubleDimple/oci-start](https://github.com/doubleDimple/oci-start)**. While retaining the core capabilities of the original project, it brings a modern Web UI (React 18 SPA), native cross-platform desktop clients (macOS / Windows), enterprise-grade security hardening, and operational improvements.

### 🙏 Tribute to the Original Author

We would like to express our deepest gratitude and highest respect to the original author **[@doubleDimple](https://github.com/doubleDimple)** and all upstream contributors!

- 🌟 **Outstanding Foundation**: The original project `oci-start` laid an incredible groundwork with its deep Oracle Cloud (OCI) API integration, robust SDK encapsulation, multi-tenant snatching algorithms, and extensive troubleshooting on cloud infrastructure automation.
- 🤝 **Carrying Forward Open Source**: Without the author's selfless open-source spirit and visionary architecture, this project (OCI-Pool) would not have been possible. OCI-Pool aims to stand on the shoulders of giants, focusing on modern cross-platform experience, zero-exposure public security, and streamlined DevOps automation.
- ⭐ **Support the Original Work**: If you find OCI-Pool helpful, **we strongly encourage you to visit the original repository first and star ⭐ the upstream project to honor the original creation!**

> 💡 **Original Project**: <https://github.com/doubleDimple/oci-start>  
> 📦 **This Project Releases**: <https://github.com/Nodewebzsz/oci-pool/releases>  
> 📌 *Note: This fork tracks upstream enhancements, but does not guarantee 100% parity due to independent client and UI architectural evolutions. To experience upstream canonical features, please visit the original repository.*

---

## Features

OCI-Pool delivers comprehensive Oracle Cloud (OCI) resource lifecycle management, automated instance creation/grabbing, and intelligent DevOps capabilities from provisioning to monitoring.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             OCI-Pool Feature Matrix                        │
├───────────────────┬───────────────────┬───────────────────┬────────────────┤
│ 🚀 Boot & Snatch  │ 🖥️ Lifecycle & Ops│ 🏢 Multi-Tenant   │ 🛡️ Security    │
│ • Full Workbench  │ • Start/Stop/Sync │ • Unified Tenants │ • 100% Local DB│
│ • ARM 1:6 Ratio   │ • VNC/CloudShell  │ • Quota & Cost    │ • TOTP MFA Auth│
│ • Schedule Pill   │ • Rescue Mode     │ • Region Latency  │ • Adaptive 2FA │
│ • Smart Backoff   │ • IPv4/IPv6 Dual  │ • Restricted API  │ • Proxy Pool   │
├───────────────────┴───────────────────┴───────────────────┴────────────────┤
│ 📢 Ecosystem & Notifications          🤖 AI Assistant     💻 Modern Client │
│ • TG/DingTalk/Bark/Email/Webhook      • OCI Diagnostics   • React 18 SPA   │
│ • Cloudflare/EdgeOne DNS Auto-Bind    • Tuning Tips       • macOS/Win Apps │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1. ⚡ Dedicated Boot Workbench & Auto-Grabbing Engine
- **Dedicated Boot Workbench** (`/tenants/:id/boot-create`): Multi-region linking, real-time image availability probing with semantic descending version sort, read-only OCID with one-click copy.
- **Always-Free Guardrails**: Built-in ARM 1:6 golden ratio validation (1 OCPU : 6GB RAM), free-tier usage warning, and risk confirmation dialog to prevent accidental charges.
- **Scenario Schedule Selector**: Quick-choice schedule pills (24/7, daytime only, night stealth, etc.) with interlocking dropdowns and real-time human-readable feedback.
- **Automated Snatching Engine**: Multi-tenant, multi-region, and multi-shape asynchronous concurrent polling with smart capacity backoff.

### 2. 🖥️ Full Lifecycle Instance Operations
- **Lifecycle Control**: Instant launch, start, stop, restart, terminate, and batch asynchronous status synchronization.
- **Native VNC / CloudShell**: Integrated WebSocket dynamic port relay (`websockify`) to connect directly to the remote terminal without requiring a public IP.
- **Disaster Recovery**: One-click system Rescue Mode with network boot support and offline disk inspection.
- **Elastic Networking**: One-click secondary VNIC attachment, IPv4 / IPv6 dual-stack switching, and built-in IP quality detection (fraud score, streaming unlock, purity) with auto-replacement.
- **Storage & Object Storage**: Online boot volume expansion and elastic VPU performance tuning, plus OCI Object Storage file management.

### 3. 🏢 Multi-Tenant Hub & Resource Analytics
- **Unified Multi-Tenant Hub**: Centralized API credential management with custom aliases, health detection, and grouping tags.
- **Quota & Cost Insights**: Real-time tenant quota probing, visual ARM/AMD free-tier breakdown, and historical cost/billing forecast (Cost & Usage).
- **Region Management & Speed Test**: One-click subscription to new regions, live availability inspection, latency comparison, and optimal routing.
- **Security & Permissions**: One-click switch to Restricted API mode, API key rotation and certificate re-binding, visual security lists, and admin user delegation.

### 4. 🛡️ Enterprise Security & Privacy
- **100% Localized Storage**: Tenant private keys and credentials are encrypted in the local H2 database — **never uploaded to external servers**.
- **Adaptive Multi-Factor Authentication (MFA)**: Supports Google Authenticator (TOTP 6-digit codes) and adaptive 2FA message verification (Telegram, DingTalk, Bark).
- **Proxy Pool Protection**: Configurable HTTP / SOCKS5 proxy pool with health checking to isolate OCI API requests and avoid rate limits.

### 5. 📢 Omnichannel Notifications & Integrations
- **Instant Alerts**: Telegram Bot, DingTalk, Bark (iOS), WeChat Work, SMTP Email, and custom Webhooks for snatch results, node events, and quota alarms.
- **Automated DNS Binding**: Seamless integration with Cloudflare and Tencent Cloud EdgeOne to automatically update A / AAAA DNS records upon instance creation.
- **OpenAPI**: Standardized APIs for external automation and CI/CD integration.

### 6. 🤖 Built-in AI Assistant
- **AI Chat Hub**: Integrated LLM chat center supporting OpenAI, Claude, DeepSeek, and more.
- **OCI Diagnostics**: Automated diagnosis for common OCI errors (e.g. `Out of host capacity`, API rate limits, fingerprint mismatches).

### 7. 💻 Modern Multi-Platform Architecture
- **Modern Web SPA**: React 18 frontend with dark/light themes and full keyboard shortcuts.
- **Native Desktop Clients (macOS / Windows)**: Dedicated client applications aligned 100% with the web workbench, featuring background system tray execution.

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

| Variable | Default | Description |
| --- | --- | --- |
| `OCI_PORT` | `9856` | Backend application port |
| `OCI_WEB_PORT` | `9857` | Nginx unified entry port (browser access) |
| `MODERN_UI_ENABLED` | `true` | Enable React Modern UI |
| `DB_PASSWORD` | Auto-generated (24 chars) | **Critical Security**: H2 local database password protecting tenant API private keys |

> 🔒 **Security Notice (DB_PASSWORD)**:
> OCI-Pool stores API credentials locally in an H2 database and never uploads them. Fresh installations via `install.sh` automatically generate a strong 24-character alphanumeric password in `.env`. If deploying manually, **it is strongly recommended to set a high-strength password** to prevent offline database dumps if the VPS host is compromised.

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

#### FAQ: Boot Logs stuck on "Connecting..." in Remote mode

* **Cause**: Boot logs stream through SSE (Server-Sent Events). Reverse proxies (Nginx / NPM) enable **proxy buffering** by default, buffering live event data in memory and delaying HTTP response headers.
* **Quick Fix**:
  * **Nginx Proxy Manager (NPM)**:
    1. Proxy Host Details: **Turn OFF "Cache Assets"**, keep "Websockets Support" enabled.
    2. Advanced Tab ⚙️ (Custom Nginx Configuration): Paste these 5 lines:
       ```nginx
       proxy_buffering off;
       proxy_cache off;
       chunked_transfer_encoding on;
       proxy_read_timeout 86400s;
       proxy_send_timeout 86400s;
       ```
       *(Note: Websockets Support already injects `proxy_http_version 1.1`. Do not duplicate it here to avoid syntax conflict)*.
  * **Standard Nginx**: Add the above 5 `proxy_buffering off;` directives into `location /` or `location /system/streamLogs`.

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
