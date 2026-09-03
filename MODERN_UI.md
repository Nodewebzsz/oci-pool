# OCI Pool Manager · Modern UI Fork (v4)

> **v4 update (2026-08-31)**: 退出登录使用 React setState 无刷新方案 · 5ms 丝滑体验 · 150ms watchdog 兑底。

**Drop-in React frontend for [doubleDimple/oci-start](https://github.com/doubleDimple/oci-start)** · [中文](#-中文) · [English](#-english)

---

## v4 changelog (相对 v2)

- ➕ **新增登录 / 注册 / MFA / 忘记密码页** (`static/modern-ui/src/page-auth.jsx` · 900+ 行) — 左右分栏 + 自绘 hero SVG (45 个区域点绕轨) + 4 种字体视图
- ➕ **登录验证方式自适应——对齐原项目 `LoginController.validateAdditionalFactors`**
  - Telegram / DingTalk / Bark 任一开 → 弹出“消息验证码” + 发送按钮 + 60s 倒计时
  - MFA 开 → 弹出“双因素认证” 6 格输入
  - 两者都开 → tab 切换 (对齐 `verificationChoice`)
  - 都关 → 直接进主界面
- ➕ **退出登录**接入右上角头像菜单（使用 `localStorage.removeItem('ocip-authed')` + 重新渲染）
- ➕ `src/data.jsx` 新增 `window.getAuthConfig()` / `setAuthConfigFlag()` helpers
- ➕ i18n 新增 40+ 条中英双语翻译
- ➕ 通知管理页保存 Telegram/DingTalk/Bark 时 + 安全管理页切换 MFA 时自动同步 auth config

> ✅ **登录已接真实后端**（`LoginView.submit` → `POST /perform_login`，密码明文经 `RsaDecryptionFilter` 明文回退校验）。
> 因子开关由服务端 `GET /api/config/{message,mfa}-enabled` 驱动；发送消息验证码 `POST /api/send-verification-code`；退出登录 `POST /perform_logout`。
> 首次使用需先通过注册页创建管理员账号（服务端已存在用户时注册接口返回 `System already initialized`）。

---

## 📘 English

### Fork changes vs upstream (delta)

| File | Type | Purpose |
|---|---|---|
| `oci-server/src/main/resources/static/modern-ui/` | **NEW** — 29 files | React SPA (login/register/verify + 20 pages + vendor libs) |
| `.../controller/ModernUiController.java` | **NEW** | Forwards `/` → SPA index |
| `.../controller/DelayTestController.java` | **NEW** | Extracted from HomeController |
| `.../controller/HomeController.java` | **PATCHED** | Guarded by `@ConditionalOnProperty(name="modern-ui.enabled", havingValue="false")` |
| `.../config/SaTokenConfig.java` | **PATCHED** | Added `/` and `/modern-ui/**` to excludePathPatterns |
| `oci-server/.../application.yml` | **APPENDED** 6 lines | `modern-ui.enabled: true` config block |
| `Dockerfile.modern-ui` | **NEW** | Multi-stage Maven → JRE 17 build |
| `deploy/` | **NEW** | docker-compose + install/uninstall scripts |
| `MODERN_UI.md` | **NEW** | This doc |

### Quick start

```bash
cd deploy && ./install.sh
# → http://localhost:9856/
```

Requires Docker 20.10+ with compose v2. First build ~5 min.

### Manual build (JDK 17 + Maven 3.9 + Redis)

```bash
mvn -pl oci-server -am package -DskipTests
java -jar oci-server/target/oci-pool-release.jar
```

### Rollback to legacy Freemarker UI

Edit `oci-server/src/main/resources/application.yml`:
```yaml
modern-ui:
  enabled: false
```
Rebuild & restart.

### Real backend login (current behaviour)

`LoginView.submit` → `POST /perform_login`. Password is sent in plaintext; `RsaDecryptionFilter` falls back
to plaintext verification when there is no session RSA private key (SPA is served at `/`, not `/login`).
Factor flow is server-driven via `GET /api/config/{message,mfa}-enabled`:
- Both off → login succeeds directly
- Message code required → server returns `请提供消息验证码` → UI switches to the verify view → resubmit with `verificationCode`
- MFA required → UI shows a 6-digit MFA input → resubmit with `mfaCode`
- Both on → tab switch

`POST /api/send-verification-code` sends the message code; `POST /perform_logout` invalidates the sa-token session.
First run: create the admin account via the register page (`POST /api/register-first-user`).

### ⚠ Manual checks (unchanged from v2)

1. Ambiguous mapping on `GET /` — the `@ConditionalOnProperty` guard should prevent this.
2. JAR name assumed `oci-pool-release.jar` — adjust `Dockerfile.modern-ui` if your `<finalName>` differs.
3. If `/modern-ui/**` returns 404: some custom `WebMvcConfigurer` might override `addResourceHandlers`, add:
   ```java
   registry.addResourceHandler("/modern-ui/**").addResourceLocations("classpath:/static/modern-ui/");
   ```

### Sync with upstream

```bash
git remote add upstream https://github.com/doubleDimple/oci-start
git fetch upstream && git merge upstream/master
# Conflicts only in: HomeController.java, SaTokenConfig.java, application.yml
```

---

## 📕 中文

### 相对上游的改动

| 文件 | 改动 | 用途 |
|---|---|---|
| `oci-server/src/main/resources/static/modern-ui/` | **新增** — 29 文件 | React SPA （登录/注册/验证 + 20 个页面 + vendor） |
| `.../controller/ModernUiController.java` | **新增** | `/` 转发到 SPA 入口 |
| `.../controller/DelayTestController.java` | **新增** | 从 HomeController 抽出 |
| `.../controller/HomeController.java` | **补丁** | 加 `@ConditionalOnProperty` 守卫 |
| `.../config/SaTokenConfig.java` | **补丁** | sa-token 白名单加 `/` 和 `/modern-ui/**` |
| `oci-server/.../application.yml` | **追加** 6 行 | `modern-ui.enabled: true` |
| `Dockerfile.modern-ui` | **新增** | 多阶段 Maven → JRE 17 构建 |
| `deploy/` | **新增** | docker-compose + 安装/卸载脚本 |
| `MODERN_UI.md` | **新增** | 本文档 |

### 快速开始

```bash
cd deploy && ./install.sh
# → http://localhost:9856/
```

需 Docker 20.10+ 和 compose v2 插件。首次构建约 5 分钟。

### 手动构建（JDK 17 + Maven 3.9 + Redis）

```bash
mvn -pl oci-server -am package -DskipTests
java -jar oci-server/target/oci-pool-release.jar
```

### 回退到原始 Freemarker UI

编辑 `oci-server/src/main/resources/application.yml`:
```yaml
modern-ui:
  enabled: false
```
重构 + 重启。

### 真实后端登录（当前行为）

`LoginView.submit` → `POST /perform_login`。密码明文传输，`RsaDecryptionFilter` 在无会话 RSA 私钥时自动回退明文校验（SPA 在 `/` 提供，非 `/login`）。
因子流程由服务端 `GET /api/config/{message,mfa}-enabled` 驱动：
- 都关 → 直接登录成功
- 需消息验证码 → 服务端返回“请提供消息验证码”→ 前端切到验证视图 → 带 `verificationCode` 重提
- 需 MFA → 显示 6 位 MFA 输入 → 带 `mfaCode` 重提
- 都开 → tab 切换

`POST /api/send-verification-code` 发送消息验证码；`POST /perform_logout` 失效 sa-token 会话。
首次使用：通过注册页创建管理员账号（`POST /api/register-first-user`）。

### ⚠ 你需要手动验证的地方（同 v2）

1. `GET /` 重复映射 — `@ConditionalOnProperty` 守卫应阻止。
2. JAR 名字 — 假设为 `oci-pool-release.jar`，若 `<finalName>` 不同改 `Dockerfile.modern-ui`。
3. 自定义 `WebMvcConfigurer` — 若 `/modern-ui/**` 404，添加:
   ```java
   registry.addResourceHandler("/modern-ui/**").addResourceLocations("classpath:/static/modern-ui/");
   ```

### 同步上游

```bash
git remote add upstream https://github.com/doubleDimple/oci-start
git fetch upstream && git merge upstream/master
# 冲突只在: HomeController.java 、 SaTokenConfig.java 、 application.yml
```

---

## License

Apache-2.0 (matching upstream).
