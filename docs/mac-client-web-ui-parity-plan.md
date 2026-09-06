# 原生客户端逐页对接计划（对照 Web Modern UI）

> 目标：oci-pool-mac 原生页面对照 `oci-server/src/main/resources/static/modern-ui/`（React SPA）
> 的 UI / 交互 / 组件一比一对齐。流程：**差异审计 → 修复 → 构建安装 → 运行时核验 → 标记**。
> 基准文件：`src/page-*.jsx` + `index.html` + `i18n.jsx` + `layout.jsx`。
> 状态标记：⬜ 未开始 / 🔄 进行中 / ✅ 完成 / ❓ 有疑问待确认。

## 统一规则（每页都适用）

- 页头：图标 tile + 标题 + 副标题 + 右侧操作按钮（样式对齐各 Web 页 SettingsCard/KPI 头部）。
- 表格：表头列、行 padding 随密度 9/12、状态徽章色、分页条（每页 N 条/跳转/Go）。
- 强调色统一 `AppTheme.sidebarActive`，禁止硬编码旧 teal（页面级刻意保留的除外，如 MFA 卡）。
- 交互：hover 背景、按钮 help、Toast、确认弹窗（ConfirmShell 风格）、ESC/回车键盘行为。
- 文案：逐字对齐 `i18n.jsx`（含半角标点）。
- 输入框：点击编辑区外自动失焦（AppDelegate 全局监听器已覆盖）。

## 批次 A · 服务管理（10 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| A1 | 系统资源监控 | page-monitor.jsx | Dashboard/DashboardView | ✅ 已完成（含页头 Lucide 图标） |
| A2 | OCI 区域管理 | page-regions.jsx | Regions/RegionsView | ✅ 2026-09-06（标题/图标色/KPI 横排/表头/徽章/筛选/排序/配色已对齐并运行时核验） |
| A3 | OCI 租户管理 | page-tenants.jsx | Tenants/TenantsView | ✅ 2026-09-06（页头按钮组/彩色实心/表头列名/实例操作橙钮/单元格样式/分页/菜单文案已对齐并运行时核验） |
| A4 | 租户详情（子页） | page-tenant-detail.jsx | Tenants/TenantDetailView | ⬜ |
| A5 | 租户·查看开机（子页） | page-tenant-grab.jsx | Tenants/TenantGrabView | ⬜ |
| A6 | 租户·资源列表（子页） | page-tenant-resources.jsx | Tenants/TenantRegionSubView | ⬜ |
| A7 | OCI 实例列表 | page-instances.jsx | Instances/InstancesView | ⬜ |
| A8 | OCI 开机管理 | page-grab.jsx | Boot/BootView | ⬜ |
| A9 | OCI 邮箱服务 | page-misc.jsx (MailPage) | Email/EmailView | ⬜ |
| A10 | OCI 对象存储 | page-misc.jsx (ObjectPage) | Storage/StorageView | ⬜ |
| A11 | OCI AI 管理 | page-misc.jsx (AIPage) | AiModels/AiModelsView | ⬜ |
| A12 | OCI 链路测试 | page-misc.jsx (LinkPage) | SpeedTest/SpeedTestView | ⬜ |
| A13 | OCI 开机日志 | page-logs.jsx (LogsPage) | OpenLogs/OpenLogsView | ⬜ |

## 批次 B · 代理管理（3 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| B1 | 秘钥配置（域名服务商） | page-proxy.jsx | KeyConfig/KeyConfigView | ⬜ |
| B2 | CF 管理 | page-proxy.jsx | Cloudflare/CloudflareView | ⬜ |
| B3 | EO 管理 | page-proxy.jsx | EdgeOne/EdgeOneView | ⬜ |

## 批次 C · 资源管理（1 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| C1 | 资源列表（VPS 监控看板） | misc/resList 相关 | Vps/VpsView | ⬜ |

## 批次 D · 系统管理（4 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| D1 | IP 质量管理 | page-misc.jsx (SysIpQualityPage) | IpQuality/IpQualityView | ⬜ |
| D2 | 系统日志 | page-logs.jsx (SysLogsPage) | SystemLogs/SystemLogsView | ⬜ |
| D3 | 安全管理 | page-misc.jsx (SysSettingPage) | SecuritySettings/SecuritySettingsView | ⬜ |
| D4 | 代理配置 | page-proxy.jsx (SysVpnProxyPage) | ProxyConfig/ProxyConfigView | ⬜ |

## 批次 E · 我的工具（5 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| E1 | AI 对话 | （Web 无此页，原生扩展） | AiChat/ | ❓ Web 无对应页面，保持原生实现即可 |
| E2 | 通知管理 | page-tools.jsx (NotifyMgmtPage) | Notify/NotifyView | ⬜ |
| E3 | 笔记管理 | page-tools.jsx (MemPage) | Memo/MemoView | ⬜ |
| E4 | 数据迁移 | page-tools.jsx (MigPage) | Migration/MigrationView | ⬜ |
| E5 | MFA 备份 | page-tools.jsx (MfaBackupPage) | MfaBackup/ | ⬜ |

## 批次 F · 开发配置（1 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| F1 | Token 配置 | page-tools.jsx (KeyConfigPage) | ApiTokens/ApiTokensView | ⬜ |

## 疑问/待确认清单

- ❓ 原生侧栏多出「AI 对话」与多云条目（GCP/Azure/AWS），Web `buildNav` 无此条目——按 native 扩展保留。
- ❓ OAuth：Web 固定展示 GitHub/Google 按钮（点击弹 toast），原生走真实浏览器跳转且按服务端开关显示——保留 native 差异。
- ❓ 通知中心：Web 为硬编码演示数据，原生接真实后端消息——保留 native 差异。
- ❓ 忘记密码：Web 为内联三步视图，原生为模态弹窗（语义等价）——待用户决定是否重构。
- ❓ 部分页面 Web 有 Leaflet 地图（区域管理），原生以状态板替代——保留 native 差异。

## 执行记录

- 2026-09-06：计划建立；A1 系统资源监控此前已完成对齐并运行时核验（KPI/仪表卡/页头图标/抢机趋势/操作动态）。

## 执行记录（续）

- 2026-09-06：A2/A3 完成审计→修复→构建→运行时核验（详见上方标记）。
  - A3 修复要点：页头按钮文案全称+cyan/info/orange 彩色实心（AppButton 扩展 kind）、眼睛图标钮、移除刷新/副标题、表头列名对齐、「实例操作」橙底 zap「创建实例」、单元格样式（费用橙+$/存活天数 info 徽章/进行中+脉冲/类型软底徽章/状态 pill）、分页（每页显示/上一页下一页文字/共 n 条 page/totalPages/跳至+页/sizeOptions 10,20,50,100）、菜单文案（添加开机/账号花费/账号更新/删除租户）。
  - 状态徽章 StatusTone 全局收敛主题色（success=accent/warning=orange/danger=danger/info=info）。
