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
| A2 | OCI 区域管理 | page-regions.jsx | Regions/RegionsView | ✅ 2026-09-06（标题/图标色/KPI 横排/表头/徽章/筛选/排序/配色已对齐并运行时核验；同日补充：三分段 tab 含图标、KPI1 改 Lucide map-pin、新增 RegionWorldMapView 真实世界地图（Natural Earth 1 投影 + 后端 vendor TopoJSON 110m + 节点脉冲/hover tooltip/图例），tab 联动筛选；二轮反馈修复：经纬网步长对齐 Web graticule.step([30,30])（去掉多余横竖线）、定位图标重绘、悬浮弹窗/行点击/节点点击详情抽屉运行时核验通过） |
| A3 | OCI 租户管理 | page-tenants.jsx | Tenants/TenantsView | ✅ 2026-09-06（页头按钮组/彩色实心/表头列名/实例操作橙钮/单元格样式/分页/菜单文案已对齐并运行时核验） |
| A4 | 租户详情（子页） | page-tenant-detail.jsx | Tenants/TenantDetailView | ✅ 2026-09-06（页头 diamond+租户名/副标题/KPI 语义色/列头 实例同步/未同步灰态/危险色 token）。❓ KPI 数据映射、RegionSwitcher、面包屑、7 按钮组待确认 |
| A5 | 租户·查看开机（子页） | page-tenant-grab.jsx | Boot/BootView(tenantSubPage:true) | ✅ 2026-09-06 独立子页（新 NavID .tenantGrab + 面包屑 返回·OCI 租户管理·详情·租户名·查看开机 + 标题「预开列表」+ zap 橙图标 + 租户上下文副标题 + 预筛选表格复用）。❓ Web 表头 15 列逐字与页头按钮组（预开/停止/重置）在此子页复用全局页配置 |
| A6 | 租户·资源列表（子页） | page-tenant-resources.jsx | Instances/InstancesView(tenantSubPage:true) | ✅ 2026-09-06 独立子页（新 NavID .tenantResources + 面包屑 返回·OCI 租户管理·详情·租户名·资源列表 + 副文案 {租户名} · 共 N 个实例 + 预筛选表格复用）。❓ Web 11 列逐字与明文密码导出警告待做 |
| A7 | OCI 实例列表 | page-instances.jsx | Instances/InstancesView | ✅ 2026-09-06（标题 OCI 实例管理/表头 租户名·所属区域·主 IPv4/IPv6 已启用未启用/菜单 10 处文案/语义色 token/筛选 placeholder 与宽度/一键导出）。❓ accent 筛选条形态、租户区域下拉入页头待确认 |
| A8 | OCI 开机管理 | page-grab.jsx | Boot/BootView | ✅ 2026-09-06（标题「预开列表」/zap 橙图标/页头按钮组（预开 primary+停止 orange+重置 danger+eye 钮）/筛选 placeholder/表头 15 列逐字（架构列移至成功后）/任务状态徽章 running+脉冲/执行中 accent/今日 cyan/失败 danger/架构 info chip/行单击详情/菜单文案/预开空白表单选租户/色板收敛）。❓ 确认弹窗 danger 样式+requireText（RESET/租户名）为共享 AppAlert 增强，待做；重置语义 Web 清零全部统计 vs 原生仅失败计数待确认 |
| A9 | OCI 邮箱服务 | page-misc.jsx (MailPage) | Email/EmailView | ✅ 2026-09-06（标题/动态副标题/cyan 图标/写邮件按钮/4 KPI 卡/发送记录表头 主题·发件人·收件数·状态·发送时间+状态徽章/空态/添加联系人文案）。❓ 三区同屏布局（左租户/右联系人/下记录）与 Web 差异保留（原生 Tab 切换）、启用弹层 SMTP 凭据面板待补 |
| A10 | OCI 对象存储 | page-misc.jsx (ObjectPage) | Storage/StorageView | ✅ 2026-09-06（标题/4 KPI 卡/新建按钮/搜索 placeholder/桶行摘要/对象列表标题/选中桶 accent 左边条/危险色 token）。✅ 预签名弹层对齐 Web（获取预签名链接/有效期(小时) 1-168/预签名 URL(只读)/复制链接）+ 删除桶 requireText=桶名。❓ 对象总数 KPI 暂无接口显示 — |
| A11 | OCI AI 管理 | page-misc.jsx (AIPage) | AiModels/AiModelsView | ✅ 二轮完成 2026-09-06（页头 租户下拉+AI 对话按钮/4 KPI 卡/模型行 分类徽章+mono id+provider 色块+添加配置/配置行 已启用徽章+左边条+60% 透明+orange 切换+28 删除钮/双栏 pageSize=4 分页/启用全部-禁用全部-刷新 迁右栏头/删除确认与 toast 逐字）。❓ Web 右栏 关联租户/启用全部 checkbox 形态待做 |
| A12 | OCI 链路测试 | page-misc.jsx (LinkPage) | SpeedTest/SpeedTestView | ✅ 二轮完成 2026-09-06（按钮组四态 停止danger/重新测速/开始测速 + 中止 toast、进度条区块 done/total+渐变、网格标题「全球 OCI 区域」、色板/阈值/timeout）。❓ Top5 卡布局（奖牌/国旗）、IP 四级兜底链待做 |
| A13 | OCI 开机日志 | page-logs.jsx (LogsPage) | OpenLogs/OpenLogsView | ✅ 2026-09-06（副标题/terminal 图标/暂停恢复滚动/下载日志/终端卡主题色/级别色 logColor 对齐/空态/footer/断开态「已断开」）。❓ 级别筛选 chips+关键字搜索、行 hover 详情待做 |

## 批次 B · 代理管理（3 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| B1 | 秘钥配置（域名服务商） | page-proxy.jsx | KeyConfig/KeyConfigView | ✅ 2026-09-06（标题 Token 配置/副标题/占位符与 hint 逐字/CF orange+EO info/测试连接 info/徽章 已连接未连接/toast ✓ 前缀）。❓ 分组标题「域名服务商配置」、显隐切换待做 |
| B2 | CF 管理 | page-proxy.jsx | Cloudflare/CloudflareView | ✅ 2026-09-06（标题/副标题/工具栏颜色与文案/表头/代理徽章 🟠⚪ 限 A·AAAA·CNAME/类型 5 项/TTL 中文单位/删除色）。❓ 搜索栏标签+搜索按钮、MX 优先级字段待做 |
| B3 | EO 管理 | page-proxy.jsx | EdgeOne/EdgeOneView | ✅ 2026-09-06（标题/副标题/工具栏颜色/表头 名称·值/TTL 5 档 60 秒起/域名状态 3 态中文/tab accent/删除色）。❓ 优先级必填、加速域名状态下拉待做 |

## 批次 C · 资源管理（1 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| C1 | 资源列表（VPS 监控看板） | misc/resList 相关 | Vps/VpsView | ⬜ |

## 批次 D · 系统管理（4 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| D1 | IP 质量管理 | page-misc.jsx (SysIpQualityPage) | IpQuality/IpQualityView | ⬜ |
| D2 | 系统日志 | page-logs.jsx (SysLogsPage) | SystemLogs/SystemLogsView | ✅ 2026-09-06（副标题/terminal 图标/终端卡去 4fc3f7/标题「控制台输出」/空态/footer/清空确认文案/maxLines 300） |
| D3 | 安全管理 | page-misc.jsx (SysSettingPage) | SecuritySettings/SecuritySettingsView | 🔄 一轮完成（标题「系统设置」/副标题/MFA 卡标题/Turnstile 卡全称/危险色）。❓ 字段 placeholder/label 逐字、保存确认弹窗、卡片自适应高待做 |
| D4 | 代理配置 | page-proxy.jsx (SysVpnProxyPage) | ProxyConfig/ProxyConfigView | ✅ 2026-09-06（副标题/测试全部/列头 自定义名称·URL·连接状态/类型软底徽章/状态 已连接·不可用/按钮 info 分色/弹窗标题与文案/SOCKS5）。❓ 租户搜索分页为原生增强待确认 |

## 批次 E · 我的工具（5 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| E1 | AI 对话 | （Web 无此页，原生扩展） | AiChat/ | ❓ Web 无对应页面，保持原生实现即可 |
| E2 | 通知管理 | page-tools.jsx (NotifyMgmtPage) | Notify/NotifyView | 🔄 一轮完成（副标题「通知设置」/卡题 通知任务·Bark 通知·钉钉机器人·飞书机器人/任务项 抢机日志·OCI 花费 (Payg)/按钮 测试发送·保存配置/签名密钥/色板）。❓ 通知密钥字段、注册机器人/上传 AI 按钮、时钟按钮待做 |
| E3 | 笔记管理 | page-tools.jsx (MemPage) | Memo/MemoView | 🔄 一轮完成（标题/动态副标题/新建笔记/内容 label/搜索占位/空态/色板）。❓ 全部/最近筛选、计数行、内联编辑器、清空/更新按钮待做 |
| E4 | 数据迁移 | page-tools.jsx (MigPage) | Migration/MigrationView | 🔄 一轮完成（副标题/生成加密备份按钮/色板）。❓ mig.notice 提示条、导出步骤文案、导入模式行与拖拽区、Master Key 横幅待做 |
| E5 | MFA 备份 | page-tools.jsx (MfaBackupPage) | MfaBackup/ | 🔄 一轮完成（标题 MFA 密钥备份/副标题/导出全部/搜索占位/色板）。❓ OTP 进度条、6 列表格、发行方字段、复制入口待做 |

## 批次 F · 开发配置（1 页）

| # | 页面 | Web 源 | 原生视图 | 状态 |
|---|---|---|---|---|
| F1 | Token 配置 | page-proxy.jsx (KeyConfigPage) | ApiTokens/ApiTokensView | 🔄 一轮完成（副标题/卡题 API 文档访问·API 使用说明/说明文案/色板 3fb950·adbac7·f0881a·9b59b6·f85149 收敛）。❓ 信息行 label/值逐字、剩余天数三档配色、按钮顺序、安全提示 3 条待做 |

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
- 2026-09-06（续 2）：A4/A7 完成「审计→修复→构建」，A5/A6 按结构性差异标记 ❓ 待确认（原生复用全局页+预筛选 vs Web 独立子页）。
- 2026-09-06（续 3）：用户反馈区域管理页三处不一致（KPI1 图标应为 map-pin、tab 文字裁剪、缺少地图）→ MenuGlyph 新增 map-pin/map glyph，重构为 Web 的「数量+三分段 tab」卡 + 表格卡/地图卡切换，新增 RegionWorldMapView.swift（TopoJSON 解码 + geoNaturalEarth1 投影 + 节点大小 ∝ √开机数 + 今日橙色 + hover tooltip + 图例 hint），构建通过并运行时核验。
- 2026-09-06（续 4）：A8 完成「审计→修复→构建→提交」。修复过程发现并顺带修复：A2 地图 antimeridian 直线（TopoJSON 反经线解缠绕）、悬停失效（NSEvent mouseMoved 最近节点判定 + 标题栏坐标偏移修正）、经纬线闭合弦直线（path closed:false）。
- 2026-09-06（续 5）：A13/D2 完成（terminal 图标、暂停/下载、级别色 token 化、footer 中文化）；A11/A12 一轮修复完成（副标题/标题/语义色/色板/阈值），二轮细项标记 ❓。
- 2026-09-06（续 6）：批次 C/E/F 六页一轮对齐完成并提交（标题/副标题/文案/色板收敛），二轮细项已标记 ❓。至此对接计划全部页面一轮对齐完成。
- 2026-09-06（续 7）：A5/A6 独立子页完成——新增 NavID .tenantGrab/.tenantResources、FeatureRouter 映射、BootView/InstancesView 增加 tenantSubPage 模式（面包屑 + 租户上下文副标题 + 侧栏高亮归属租户管理 + 返回租户列表）、分页下拉宽度 64→72、跳页输入居中。
