# 功能优化验收记录 · 2026-11-18

## 结论与范围

本轮完成可用开发环境下的构建、专项测试及 Web / Mac 主窗口外观验收。本轮专项测试通过；全量测试仍存在既有失败，不能标记为全量通过。真实租户、实例、开机任务及 DNS 记录相关操作尚待有数据后补验。

开发服务已使用当前 JAR 重建并启动，app、redis 健康，Web 入口为 http://127.0.0.1:19857/。Mac 使用独立 bundle ID `com.nodewebzsz.ocipool.ui-dev` 的预览副本。

## 自动化与构建

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Web 外观与本轮功能专项 Node 测试 | 13 / 13 通过 | `/tmp/oci-target-tests.log` |
| 全量 Node 测试 | 163 项，137 通过，26 失败 | `/tmp/oci-ui-tests.log` |
| 未修改 HEAD 的 Node 对照测试 | 156 项，130 通过，26 失败；失败名称与当前完全一致 | `/tmp/oci-baseline-tests.log` |
| 后端 API 文档、消息、Quartz、Cloudflare、租户画像专项 | 7 / 7 通过 | `/tmp/oci-backend-target.log`、Surefire reports |
| 后端全量测试 | 32 项，31 通过，1 失败 | `oci-server/target/surefire-reports/` |
| Web 静态产物构建 | 通过 | `npm --prefix oci-server/modern-ui-build run build` |
| Maven 打包 | 通过，使用 `-DskipTests`，与测试结果分别记录 | `/tmp/oci-package.log` |
| Mac Debug 构建及隔离预览 | BUILD SUCCEEDED，已启动预览 | `/tmp/oci-ui-build.log` |
| diff 空白检查 | 通过 | `git diff --check` |

专项 Node 覆盖 appearance、API docs、boot pricing、Cloudflare IPs、drawer migration、message/social、regions layer、tenant portrait。后端专项测试类为 `ApiDocsControllerTest`、`SystemMessageControllerTest`、`QuartzConfigTest`、`CloudflareOfficialIpsTest`、`TenantPortraitServiceTest`。

后端全量失败为 `PasswordPolicyResourceTest.modernUiPasswordPolicyAllowsZeroTo365DaysAndDefaultsTo120Days`：断言要求源码包含 `expiryDays == null ? 120 : Number(p.expiryDays)`。核对 HEAD 中的 `tenant-actions.jsx` 同样不存在该字面量，故记录为既有源码断言问题；未将打包成功视作全量测试通过。

## 实际界面验收

| 平台 / 页面 | 已完成检查 | 边界 |
| --- | --- | --- |
| Web 主窗口 | Claude 浅 / 深、经典浅 / 深，检查配色、排版与视口溢出 | 未穷举全部页面及强调色 |
| Mac 主窗口 | 四种外观实际切换，检查背景、侧栏、标题、状态色 | 使用隔离预览版本 |
| Web API 文档抽屉 | 四种外观截图检查；实际加载 6 个接口；820px 宽布局无横向溢出 | 未生成 Token 或执行接口调试请求 |
| Mac API 文档面板 | 实际加载 6 个接口；AI 分组筛选后显示 3 个接口 | 未执行 API 请求 |
| Web 区域地图 | 实际加载 45 个区域；呈现关联数 0、有货未覆盖数 39 及菱形标记 | 未验证有租户关联时的标签状态 |
| Web Cloudflare 回源工具 | 实际官方请求返回 remote 来源，15 段 IPv4、7 段 IPv6；Nginx 配置展示正常 | 未验证剪贴板读取及配置落地 |
| 租户画像 | 无租户状态可渲染，聚合逻辑专项测试通过 | 真实租户分布与图表待补验 |

本轮 Web 截图位于本机临时目录：`/tmp/oci-web-{claude,classic}-{light,dark}.png`、`/tmp/oci-docs-{claude,classic}-{light,dark}.png`、`/tmp/oci-docs-tablet.png`、`/tmp/oci-regions-map.png`、`/tmp/oci-cloudflare-tool.png`。这些为临时证据，不作为长期仓库附件。

## 后补清单

- 有真实租户后验证画像统计、区域关联标签、规格整数校验、恢复模板与费用联动；实例创建等云写操作在最终确认前停止。
- 有真实 DNS 记录后验证公网 IP 汇总、过滤、去重和批量复制。
- 有真实实例及开机任务后补验相关抽屉、分页保持和字段展示，沿用根目录 `DEFERRED_ACCEPTANCE_CHECKLIST.md`。
- 消息批量清理、社交登录跳转及所有迁移抽屉目前有专项源码/单元测试覆盖，尚未逐项完成真实数据点击验收。
- 全量 Node 的 26 项既有失败、后端密码策略的既有断言失败另行修复；本轮未扩大修改范围。

本轮未提交、推送或发布代码，开发容器保留运行供预览。

## 后续修正：Mac 服务器地址格式

- 占位符改为 `https://example.com`；按用户要求仅通过占位符展示示例，输入框下方不增加说明文字。
- 地址统一去除外层空白、页面路径、查询和片段，补全缺省 HTTP 协议，规范协议与主机名大小写；历史 `localhost.` 规范为 `localhost`。
- 连接前拒绝无效协议、空主机、空白主机、带账号密码的 URL 及越界端口；输入框回显使用规范化后的地址。
- 本机模式仅识别 HTTP 回环地址的内置端口 9856，19857 开发入口不再被误切换成内置服务。
- `node --test tools/mac-server-url.test.mjs`：通过，实际执行 Swift 地址函数，覆盖 19 个地址用例；修改前已复现尾点地址断言失败。
- Mac 地址修正构建成功（`/tmp/oci-address-build.log`），隔离预览已更新。实际启动窗口显示 `http://localhost:19857` 及新占位符；本项未重新验证登录提交。随后按用户要求移除输入框下方的格式说明。

## 后续修正：切换本机时连接失败

- 根因：Xcode Debug 预览未包含 JRE，且 9856 无服务；`BackendController.start()` 在缺少 JRE/JAR 时仍标记 `.ready`，导致登录继续请求不可达地址。
- 修正：仅探测到服务响应才允许复用外部本机后端；缺少运行组件且端口不可达时显示启动失败，阻止登录请求。
- 新增 `bash oci-pool-mac/prepare-ui-preview.sh`：在完成 ui-dev 构建和后端打包后，向预览包注入缓存 JRE、当前后端 JAR，设置独立 bundle ID 并签名。后续更新预览应执行该脚本，避免遗漏运行组件。
- 预览使用 `.build/ui-preview/data` 独立本机数据库，正式版仍使用 `~/.ocipool`；预览不自动带入正式版账号和任务。本次没有验证账号密码登录。
- `node --test tools/mac-backend-start.test.mjs tools/mac-server-url.test.mjs`：2 / 2 通过；缺少运行组件的测试已先在旧实现复现失败。
- Mac 构建通过（`/tmp/oci-local-start-build.log`）；实际启动日志记录 `ready after 17s`，原生窗口显示“本机服务已就绪，请登录”。
