# macOS 客户端与 Web 前端统一跟踪

## 当前任务（2026-09-05）

Web 前端平板到 PC 的自适应布局优化已完成（见 recent commits），现进入 macOS 客户端统一阶段：

- 目标：让 macOS 客户端复用当前 React Modern UI，使浏览器与客户端共享同一套登录页与业务页。
- 优先方向：评估并实现 `WKWebView` 加载当前 Web 前端。
- 本任务启动前需确认本机 / 远程两种模式、认证流程、最小窗口尺寸与数据保留方案。

## 当前结论

macOS 客户端目前不是当前 React Modern UI 的桌面容器，而是一套独立维护的原生 SwiftUI 界面。

- 未登录时，`MainWindowController.rebuildContent()` 直接加载原生 `LoginView`。
- 登录后，`FeatureRouter` 将菜单路由到 `DashboardView`、`RegionsView`、`TenantsView` 等原生 SwiftUI 页面。
- `WebEmbedViewController` 虽然仍在仓库中，但当前没有调用点。
- 因此 Web 前端的登录页、布局和交互更新不会自动反映到 macOS 客户端。

## 已发现问题

- 客户端登录页与当前 Web 登录页的视觉、字段布局和交互流程不一致。
- 客户端其他原生页面也可能与当前 Web 前端存在功能和样式差异，不能视为完全复用当前前端。

## 处理顺序

1. ~~完成当前 React Modern UI 的自适应布局优化~~（已完成）。
2. 确定 macOS 客户端统一方案（当前任务，进行中）。
3. 完成客户端改造后，重新构建和验证 DMG。

## 后续方案方向

优先评估让 macOS 客户端使用 `WKWebView` 加载当前 React Modern UI，使登录页和登录后页面直接复用同一套前端。客户端仍需保留本机后端启动、远程服务器选择、窗口管理和首次启动等桌面能力。

需要重点处理：

- 本机模式：先启动内置后端，健康检查通过后再加载 Web 登录页。
- 远程模式：确认服务器地址后加载远程 Web 前端。
- 登录、注册、忘记密码、消息验证码、MFA 和 OAuth 流程与浏览器端一致。
- Cookie、会话失效、退出登录、外部链接和文件下载在 `WKWebView` 中正常工作。
- Web 前端在 macOS 客户端最小窗口尺寸下完整可用。
- 客户端升级后继续保留现有本地数据目录和服务端数据。

## 验收标准

- 同一版本下，浏览器和 macOS 客户端显示相同的登录页面与业务页面。
- Web 前端页面更新后，不再需要同步重写一套 SwiftUI 业务界面。
- 本机部署和远程部署两种模式均能完成登录及核心业务操作。
- DMG 安装、首次启动、应用图标和签名流程不受影响。


## 方案与实施状态（2026-09-05 更新）

### 确定方案
采用**方案 A（全窗 Web）**：整个窗口内容由 `WKWebView` 加载当前 React Modern UI，登录页与登录后的业务页直接复用前端。客户端仅保留本机 / 远程引导、后端启动、窗口生命周期与 Cookie 同步。

### 分阶段落地
- **PR1（已完成）· 远程模式打通 Web 登录与业务页**
  - 新增 `oci-pool-mac/OciPool/Embed/ModernWebViewController.swift`（全窗 WKWebView 容器，含刷新/后退/浏览器打开工具栏，Cookie 同步，登录态路由上报）。
  - `MainWindowController`：远程模式直接加载现代 SPA（`serverURL + "/"`），并监听 `deploymentMode` 切换，切回远程时重建内容区。
  - 已加入 `OciPool.xcodeproj`（新增文件引用与 Sources 编译项）。
  - 验证：`xcodebuild -project OciPool.xcodeproj -scheme OciPool -configuration Debug build` 通过；后端 9856 的 `GET /` 返回现代 SPA（200）。
- **PR2（已完成）· 本机模式 + 登录态桥接**
  - 先启动内置后端，健康检查通过后再加载 Web 登录页；登录态/退出桥接到 `AppSession`。
- **PR3（待做）· 菜单 / 主题 / 刷新 / 切换服务器作用于 WKWebView；清理不再使用的原生业务导航。**
- **PR4（待做）· DMG 重建、最小窗口与下载/外部链接回归、数据保留校验。**

### 说明 / 约定
- 默认只做本地提交，不推送；`dev` 推送不加 `[skip ci]`。
- 登录态上报当前基于 `location.hash` 启发式判断（`#/login` 之外视为已登录），PR2 会替换为 `satoken` Cookie / `/api/userInfo` 的可靠桥接。
- 本环境 `functions__exec` / `apply_patch` 工具不可用，本次文件写入改由 CUA 运行时 `node:fs` 完成；后续工具恢复后应回归 `apply_patch`。

### PR2 详情（已提交本地 dev）

- 本机模式：`MainWindowController` 在“已选部署方式”下，无论本机/远程都用 `ModernWebViewController` 加载现代 SPA。
- 本机模式会先启动内置后端（`BackendController.start()`），健康检查通过（`isReadyForLogin`，含 120 秒超时与失败提示）后再加载 Web 登录页。
- 登录态桥接：`ModernWebViewController` 依据 SPA 路由（`#/login`、`#/register`、`#/forgot-password` 视为未登录）上报登录态，并由 `AppSession.applyWebAuth(loggedIn:)` 同步到原生层；退出登录时清除 Cookie。
- “切换服务器”：`ModernWebViewController` 工具栏新增“切换服务器”，点击后 `AppSession.resetDeploymentChoice()` 回到原生引导/模式选择页。
- 未选部署方式时仍显示原生 `LoginView` 作为模式选择入口（后续 PR3 会替换/精简为极简 `WelcomeView`）。
