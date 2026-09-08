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
- `UI_STANDARD.md`：项目统一 UI 标准。第一章=数据表居中，第二章=操作弹窗，后续新增统一标准在此追加。
- 已对齐弹窗：开机 `BootActionMenu*`、实例 `InstanceActionMenu*`、租户 `TenantActionMenu*`。

## 待对齐（下一步）
- 数据表居中：存储/区域/邮件/AI/审计/子区域/用户/代理/CF/EdgeOne/VPS（对齐 `UI_STANDARD.md` 第一章）。

## 其它未完成（可选，按需）
- 部分列表页"居中"尚未全部覆盖（存储/区域/邮件/AI/审计/子区域/用户/代理/CF/EdgeOne/VPS）
- Web 端开机弹窗 header 去灰块已改（`page-grab.jsx`，dist v=20 已部署）

## 如何构建验证
- 客户端：`cd oci-pool-mac && xcodebuild -project OciPool.xcodeproj -scheme OciPool -configuration Release -derivedDataPath .build/DerivedData build`
- 后端：`cd oci-server/modern-ui-build && node build.mjs`，再 `mvn -pl oci-server -am package -DskipTests`，`cd deploy && docker compose build app && docker compose up -d app`
- 安装客户端：退出 OciPool → `rm -rf /Applications/OciPool.app` → `ditto .../OciPool.app /Applications/OciPool.app` → `xattr -cr` → `open`
