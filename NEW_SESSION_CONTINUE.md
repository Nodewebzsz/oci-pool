# 新会话接续指令（打开会话先读本文件）

> 本文件是给下一个 ZCode 会话的**接续指引**。请先读本文件 + `UI_STANDARD.md`，再执行任务。

## 背景
当前项目是 OCI-POOL（macOS SwiftUI 客户端 `oci-pool-mac` + React Web `oci-server/.../modern-ui` + Java Spring 后端）。
上一位会话已完成大部分工作，因 token 预算耗尽而暂停。新会话从以下状态继续。

## 当前任务（未完成）
**把"租户管理"页的操作按钮 + 弹窗，完全对齐 `UI_STANDARD.md` 第二章（操作弹窗标准）**。已全部对齐。
标准实现可参考：开机管理（`oci-pool-mac/OciPool/Features/Boot/BootView.swift` 的 `BootActionMenu*`）——它已完全对齐，是模板。

## 已完成（不要重做）
- 开机管理弹窗完整对齐（按钮 28×28 圆角4 / 点击变主题绿 / 弹窗位置右缘对齐+下方6px+翻上 / header 状态点+租户名无灰块 / item 按类型上色 tone / 宽280紧凑2列 / 允许滚动 / 无小三角 / 随主题色）
- 实例列表弹窗同标准（`InstancesView.swift` 的 `InstanceActionMenu*`）
- 开机+实例+租户列表列文本居中
- 后端大量 mock（实例/开机/区域/存储/AI/CF/EdgeOne/代理/邮件/费用/审计/子区域/用户），开关 `modern-ui.mock-data`（compose 里 `MODERN_UI_MOCK_DATA=true` 已开启）

## 租户弹窗已改（已完成）
`TenantsView.swift` → `TenantActionMoreButton`（28×28 圆角4 ellipsis 图标）、`TenantActionMenuPresenter`（+activeButton/activeDark + setButtonHighlight 变绿）、`TenantActionMenuContent`（header 状态点+租户名、item 按类型上色、AppTheme.pageBg）、`panelHeight` 固定 + ScrollView、`panelFrame`（右缘+下方6px+翻上）、操作列按钮列宽 frame 居中 —— **已全部对齐 `UI_STANDARD.md` 第二章**。

## 统一标准文档
- `UI_STANDARD.md`：项目统一 UI 标准的**唯一权威**。第一章=数据表居中，第二章=操作弹窗，第三章=下拉选择框，第四章=分页。
- 已对齐弹窗：开机 `BootActionMenu*`、实例 `InstanceActionMenu*`、租户 `TenantActionMenu*`。

## 对齐进度（不在此处维护清单）

> ⚠️ **本文件不再复制「已对齐 / 待对齐」清单。** 之前多处清单并存且互相矛盾（本文件与 `UI_STANDARD.md` 1.8 / 4.6 说法不一致），已收敛。
> **唯一权威：`UI_STANDARD.md`** —— 第一章看 1.8，第四章看 4.6。新增/勾掉条目一律改那里。

> ⚠️ **不要在本文件复述任何「已对齐 / 已全量核对」结论**——包括页数、条数、百分比。
> 这类复述会随标准文档变动而失真（2026-09-11 就发生过：本文件曾写「第四章 4.6 已全量对齐」，
> 而实测 Web 端 5 处、Windows 端 2 处仍是 10）。要看状态就去读 `UI_STANDARD.md`。

## 审计日志改造：待验收

> 代码已全部落地并通过编译级验证，**但没有一条走过真实界面**。
> **验收清单：`docs/audit-log-acceptance-checklist.md`** —— 53 个验收项（M1–M53）+ 5 项回归（R1–R5），分三批（mock 开可立即验 UI 形态 / mock 关验正确性 / 真实数据验语义），含受阻项与解锁条件。
> **进度（2026-09-11）**：P0 四项（A1–A4）**已在真实部署上完成接口层验证**（§6.1）；UI 点击层（M1–M33 等）待人工过。**注意**：改造此前从未部署过——`mvn compile` 不产出 Dockerfile 要拷的 `oci-pool-release.jar`，必须先 `mvn package`（详见验收清单 §1.0）。
> 改造说明：`docs/audit-log-remediation-plan.md`。页面状态全集：`docs/mockups/audit-log-states.html`。

**当前阻塞**：部署环境所有 OCI 调用返回 401（日志里 373 次，唯一错误码），批次二/三受阻；已排除密钥错配、路径错、权限问题（详见验收清单 §4）。批次一不受影响，可立即执行。

## 其它未完成（可选，按需）
- Web 端开机弹窗 header 去灰块已改（`page-grab.jsx`，dist v=20 已部署）
- ~~Web 审计抽屉 CSV 导出：不改造，保持原实现~~ → **已去掉**（2026-09-11 晚决策）：
  用户截图标记「去掉」→ 删除按钮、`exportAudit` 函数、i18n key（`tenant.55405e`/`tenant.5680a4`）。
  macOS 客户端本就没有此功能，现在两端一致都没有。

## 如何构建验证
- 客户端：`cd oci-pool-mac && xcodebuild -project OciPool.xcodeproj -scheme OciPool -configuration Release -derivedDataPath .build/DerivedData build`
- 后端：`cd oci-server/modern-ui-build && node build.mjs`，再 `mvn -pl oci-server -am package -DskipTests`，`cd deploy && docker compose build app && docker compose up -d app`
- 安装客户端：退出 OciPool → `rm -rf /Applications/OciPool.app` → `ditto .../OciPool.app /Applications/OciPool.app` → `xattr -cr` → `open`
