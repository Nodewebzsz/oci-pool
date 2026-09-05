# macOS 客户端与 Web 前端统一跟踪

## 当前结论（2026-09-05 更新）

macOS 客户端采用 **原生 AppKit / SwiftUI** 方案，**不使用 WKWebView 内嵌**。
目标：按原项目的原生实现方式，将当前 React Modern UI **一比一复刻**为原生页面。

- 登录前：MainWindowController 加载原生 LoginView。
- 登录后：FeatureRouter 路由到原生 SwiftUI 业务页。
- 现有原生 Features 模块（AiChat / AiModels / ApiTokens / Boot / Cloudflare / Dashboard / EdgeOne / Email / Instances / IpQuality / KeyConfig / Login / Memo / MfaBackup / Migration / Notify / OpenLogs / ProxyConfig / Regions / SecuritySettings / SpeedTest / Storage / SystemLogs / Tenants / Vps 等）作为复刻骨架，逐页对齐当前 Web 前端。

## 方向（用户明确要求）

- 放弃方案 A（WKWebView 全窗内嵌），已通过提交 dfbd779 回退。
- 采用原项目的原生实现方式，将当前前端页面一比一复刻为原生页面。
- 前端源码基准：oci-server/src/main/resources/static/modern-ui/（React SPA：登录/注册/MFA + 20+ 页面）。
- 前端 Web 更新后，原生页面需人工同步，不通过 WKWebView 自动复用。

## 已发现问题

- 客户端登录页与当前 Web 登录页的视觉、字段布局和交互流程不一致。
- 客户端各原生页面与当前 Web 前端存在功能和样式差异。
- Web 前端更新不会自动反映到原生客户端。

## 处理顺序（分批）

1. 建立原生复刻基线：主题 / 布局 shell / 路由骨架。
2. 登录链路：登录、注册、忘记密码、消息验证码、MFA，对齐当前 Web。
3. 布局：侧边栏 / 顶栏 / 内容切换与当前 Web 一致。
4. 业务页逐个对齐（可按导航顺序）：
   - Dashboard / Monitor
   - Regions / Tenants / Tenant Detail / Instances
   - Storage / Proxy / AI / Tools 等
5. 保留桌面能力：本机/远程部署选择、窗口管理、首启、数据目录。
6. 每完成一批，重新构建并验证 DMG。

## 进度（2026-09-05）

- 登录页：主题色调已对齐 Web 绿色 oklch（34d399），hero 已重写为“地球核心 + 3 层同心环 + 45 区域点 + 盾牌 + 数据流线”，兼容 macOS 11（未用 Canvas/TimelineView）。
- 布局 shell：强调色改为 Web 绿色；顶栏高度 56 改为 52、侧栏宽度 196 改为 188，与 Web 的 topbar 52px / sidebar 188px 一致。
- 侧栏激活菜单改为 Web 样式：透明背景 + 绿色文字 + 左侧 3px 竖条 + 右侧橙色呼吸点。
- 顶栏用户菜单：云资产报告图标改默认色，账户等级徽章改绿色 accent，账户费用改青色。

### 待继续

- 登录页右侧表单微调（字段间距 / 字号 / 控件风格）。
- 顶栏与侧栏 hover、搜索框、logo 区细节。
- 业务页逐个对齐（Dashboard / Regions / Tenants / Instances / Storage / Proxy / AI 等），并清理各页面中残留的旧 1abc9c 强调色。
- 每批完成后重新构建并验证 DMG。

## 验收标准

- 同一版本下，浏览器与 macOS 客户端显示相同的登录页与业务页面（视觉 / 交互一致）。
- 原生页面与 Web 前端功能对齐。
- 本机与远程两种部署模式均可完成登录及核心业务操作。
- DMG 安装、首次启动、应用图标、签名流程不受影响。
