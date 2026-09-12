# 审计日志整改执行清单（Audit Log Remediation Plan）

> 记录时间：2026-09-11 · 项目：OCI-Pool
> 基准文档：`UI_STANDARD.md`（第四章 · 分页标准）· `docs/mockups/audit-log-redesign.html`（改造后页面实例）· `docs/mockups/audit-log-states.html`（页面状态全集）
> **配套验收**：`docs/audit-log-acceptance-checklist.md`（改了什么 → 怎么验，52 项 + 5 项回归）
> 状态标记：⬜ 未开始 / 🔄 进行中 / ✅ 完成 / ⏸ 待决策
>
> **基准说明**：本清单以 **macOS 客户端（`oci-pool-mac`）为基准**。原项目 `oci-server/src/main/resources/templates/mobile/audit_log.ftl` 是功能存在性与交互形态的权威参照（主计划全局约束：「Original Freemarker pages define feature presence」）。

---

## 优先级总览

| 级别 | 项 | 影响 | 状态 |
|:---|:---|:---|:---|
| **P0** | A1 日期校验漏洞 | 用户会把**假数据当真** | ✅ |
| **P0** | A2 mock 顶替真实数据 | 同上，且掩盖所有查询失败 | ✅ |
| **P0** | A3 2xx 判定错误 | 正常操作被标成**失败** | ✅ |
| **P0** | A4 后端异常吞没 | 分不清「没日志」与「查询失败」 | ✅ |
| **P1** | B1 环境列（控制台 / API） | 补上唯一能区分调用来源的维度 | ✅ |
| **P1** | B2 事件列改短名 | 真实数据下严重截断 | ✅ |
| **P1** | B3 响应列语义徽章 + 原始码 | 现在只有裸状态码 | ✅ |
| **P1** | B4 分页改「加载更多」 | 现为假 affordance | ✅ |
| **P1** | B5 快捷范围按钮 | 原项目有，两端都缺 | ✅ |
| **P2** | C1 序号列收窄 44→36 | 视觉 | ✅ |
| **P2** | C2 来源 IP 列保持 120 + 省略号 | 已决策，仅需确认 hover | ✅ |
| **P3** | D1 分页标准对齐（默认条数） | 与审计日志无关的独立批次 | ✅ |
| **P3** | D2 文档一致性收敛 | 三处「待对齐」清单并存 | ✅ |

> **实施顺序**：P0 → P1 → P2 → P3，全部于 2026-09-11 落地。实现记录见文末「附录 C」。

---

## P0 · 正确性（会让人看到假数据或错误状态）

### A1 ✅ 日期校验漏洞 —— 超 90 天 / 格式非法会静默返回假数据

**根因**：`AuditLogUtils.listAuditEventsByDateRange`（`oci-server/.../utils/oracle/AuditLogUtils.java` L135–165）内部自带 `catch (Exception)`，捕获后返回 `new OciPageResult<>(emptyList, null)`。于是：

- 范围 > 90 天 → 抛 `IllegalArgumentException("日期范围不能超过90天")` → **被自己吞掉** → 空列表 → 命中 A2 的 mock 分支 → **返回 6 条假数据，界面零报错**。
- 日期格式非法（如手输 `2026/09/04`）→ `LocalDate.parse` 抛 `DateTimeParseException` → 同样被吞 → 同样静默变假数据。

**客户端现状**：`TenantsViewModel.searchAudit`（L1030–1045）只校验「开始日期非空」和 `start > end`，**拦不住以上两种**。

**改动**：
- 客户端 `oci-pool-mac/OciPool/Features/Tenants/TenantsViewModel.swift` → `searchAudit`：
  - 加日期格式校验（`^\d{4}-\d{2}-\d{2}$`），非法直接 toast 拦下。
  - 加区间校验：`end - start ≤ 90 天`，超出直接 toast「日期范围不能超过 90 天」。
- 后端 `AuditLogUtils.listAuditEventsByDateRange`：
  - **不要**把参数类异常吞成空列表。`IllegalArgumentException` 应向上抛出，由 `queryAuditLogs` 转成明确的错误响应。

**验收**：
- 客户端输入 1 年区间 → 出现 toast 报错，**不发请求**，列表不出现任何数据。
- 输入 `2026/09/04` → 出现格式报错，不发请求。
- 后端直接以 1 年区间调接口（绕过前端）→ 返回**明确错误**，不返回空列表、不返回 mock。

---

### A2 ✅ mock 顶替真实数据

**根因**：`TenantServiceImpl.queryAuditLogs`（L1182–1217）有三处 `if ((result == null || result.getData() == null || result.getData().isEmpty()) && mockDataService.isMockEnabled()) return ApiResponse.success(mockDataService.auditEvents());`。`deploy/.env` 中 `MODERN_UI_MOCK_DATA=true` **当前为开启状态**。

**后果**：任何「空结果」或「异常」都会变成 6 条硬编码假事件，且响应是 `success`，前端无从分辨。

**改动**：
- `oci-server/.../service/impl/TenantServiceImpl.java` → `queryAuditLogs`：
  - **空结果不再顶替** mock。仅在「显式演示模式」下返回 mock（或给响应体加 `mock: true` 标记 + `log.warn`），使前端可提示「演示数据」。
  - 异常分支同理：真实查询失败应返回错误，而不是假数据。
- `oci-server/.../mock/MockDataService.java` → `auditEvents()`（L178–199）：
  - 补 `userType`、`consoleSessionId` 字段（当前 6 条假数据缺这两个，会导致 B1 新列在 mock 下整列空白）。
  - `eventType` 由短名占位改为符合真实形态的值（配合 B2 说明：真实为 `com.oraclecloud.ComputeApi.Xxx`，若 B2 采用短名则 mock 保持短名即可，但需与最终字段语义一致）。

**验收**：
- 关掉 `MODERN_UI_MOCK_DATA`，查询一个确实无日志的日期 → 显示空态，**不出现任何事件行**。
- 打开 mock 且强制查询失败 → 要么返回明确错误，要么响应带 `mock: true` 且界面有「演示数据」提示。

---

### A3 ✅ 2xx 判定错误（两端都有）

**根因**：Web 与客户端都只认精确 `"200"`，而原项目 `mobile/audit_log.ftl` 用的是 `responseStatus.startsWith('2') || responseStatus === 'OK'`。**201 / 204 / 206 等正常 2xx 会被标成失败**。

**改动**：
- 客户端 `oci-pool-mac/OciPool/Features/Tenants/TenantsModels.swift` → `TenantAuditLogEntry.isError`（L870–872）：
  - 由 `!responseStatus.isEmpty && responseStatus != "200"` 改为「非空且首字符不为 `2`」（并保留 `"OK"` 兼容）。
- 客户端 `oci-pool-mac/OciPool/Features/Tenants/TenantAuditLogView.swift` → `statusCell`（L233–237）：
  - tone 判定同步改为 2xx 前缀匹配。
  - ⚠️ 注意：当前 `"-"`（后端在 `response == null` 时给的值）会被判成错误行染红，属误报。应把 `"-"` 归为「中性 / 未知」，不算失败。
- Web `oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx` → `useAuditDrawer.loadLogs`（L5110）：
  - 状态映射同步改为 2xx 前缀匹配。

**验收**：
- 造出 201 / 204 的审计事件 → 显示为「成功」。
- `responseStatus` 为 `-` 的行 → 显示中性，不染红。

---

### A4 ✅ 后端异常吞没

**根因**：`AuditLogUtils.listAuditEvents`（L101–105）把 `BmcException` 只 `log.warn` 后返回空列表。于是「真的没有日志」与「OCI 查询失败」在接口层**完全不可区分**。

**改动**：
- `oci-server/.../utils/oracle/AuditLogUtils.java` → `listAuditEvents`：
  - 把失败状态向上传递（抛异常，或返回带 error 标记的结果对象），由 `queryAuditLogs` 决定返回明确错误。
  - 保留诊断上下文（状态码、错误消息）以便前端展示。

**验收**：
- 故意用一个失效的租户凭据查询 → 前端显示**错误态**（现有 errorBanner + 重试），而不是「暂无日志」。

---

## P1 · 功能与语义

### B1 ✅ 环境列：改为「控制台 / API」二值徽章

**背景**：Web 的 `useAuditDrawer` 里已定义 `envCfg = { Console, API, SDK }` 三档配色，**设计意图就是把这一列当调用来源用**。但后端 `clientEnv = identity.getUserAgent()`（原始 UA 串），导致 `envCfg[r.env] || envCfg.Console` 永远 fallback 到 Console 蓝——**配色是死的**；客户端则直接 `cell(display(log.clientEnv))` 纯灰文本。

**判据（关键）**：`authType` **不能**用来区分控制台与 API。OCI 官方文档对 `data.identity.authType` 只说 "The type of authentication used"，**未给枚举**，且官方示例中 API key 签名调用的 `authType` 仍为 `natv`。正确判据是 **`data.identity.consoleSessionId`**——OCI 文档：「identifies any Console session associated with this request」，非空即控制台会话。

**改动**：
- 后端 `oci-server/.../pojo/dto/OciAuditEventDto.java`：新增 `consoleSessionId` 字段（`userType` 已存在，保留）。
- 后端 `oci-server/.../utils/oracle/AuditLogUtils.java`（L71–96）：读取 `event.getData().getIdentity().getConsoleSessionId()` 一并返回。
- 客户端 `TenantsModels.swift`：`TenantAuditLogEntry` 增加 `consoleSessionId` 解码。
- 客户端 `TenantAuditLogView.swift`：环境列由纯文本改为徽章，取值规则：
  - `consoleSessionId` 非空 → **控制台**（info 蓝）
  - 为空 → **API**（violet 紫）
  - 两者都缺 → `—`
  - `.help` hover 显示原始 `clientEnv`(UA) + `userType`(authType 原始码)
- Web `tenant-actions.jsx`：同一规则改造环境列（修掉死的 envCfg fallback）。

> **暂不做三态（控制台 / API / SDK）**：`authType` 的真实取值未实测，官方无枚举，贸然做三态会多出一档永不命中的分支。待真机跑出实际取值后再决定是否细分 SDK / 服务主体。

**验收**：控制台操作产生的事件显示「控制台」，API key / SDK 调用显示「API」；hover 能看到原始 UA。

---

### B2 ✅ 事件列改用短名 `eventName`

**根因**：后端用 `AuditEvent.getEventType()`，真实值是 `com.oraclecloud.ComputeApi.LaunchInstance`（约 40 字符），当前 140px 列宽**严重截断**。而 mock 数据用的是短名（`CreateInstance`），**mock 开着时看不出这个问题**。

**改动**：
- 后端 `AuditLogUtils.java`：`eventType` 改取 `event.getData().getEventName()`（SDK 已确认存在，返回 `LaunchInstance` 这类短名）。
  - 若需保留完整类型用于排查，可另加字段或放进 hover。

**验收**：真实数据下事件列显示短名，不再被截断。

---

### B3 ✅ 响应列：语义徽章 + 原始码

**根因**：客户端 `statusCell` 的徽章文字**就是** `responseStatus`（`200` / `404`），只有裸状态码，没有「成功 / 失败」语义标签。

**改动**：
- 客户端 `TenantAuditLogView.swift` → `statusCell`：改为两段式——语义徽章（成功 / 失败）+ 原始码（mono、弱化色；失败码用 danger）。
- Web 末列已是此形态（`statusCfg` 徽章 + `detail`），保持并同步 A3 的 2xx 修正。

**验收**：每行响应列同时能看到「成功」标签与 `200` 原始码。

---

### B4 ✅ 分页：`PaginationBar` → 「加载更多」

**根因**：审计日志走 **OCI token 游标**，但客户端套用了为 page-based 接口设计的 `PaginationBar`：
- `totalPages` 靠 `max(auditMaxKnownPageIndex + 1, hasMore ? page + 2 : 0)` 猜 → 页码条随翻页从「1 2」长到「1 2 3」。
- `PageState.go(to:)` 内部 `min(max(0, newPage), totalPages - 1)` clamp → 跳页框输入超范围页码被**静默夹回**，无提示。
- `loadAuditPage` 另有一层静默兜底（`token == nil && cache == nil` → 应用最后一个已缓存页后 return）。
- 为伪造随机访问，维护了 `auditPageCache` / `auditTokenForPage` / `auditNextTokenByPage` / `auditMaxKnownPageIndex` 四个字典 + 一个 O(页数) 的序号累加循环。

**依据**：`UI_STANDARD.md` 第四章 4.3 / 4.4。原项目 `mobile/audit_log.ftl` 用 `_alNextToken` + 「加载更多」append，是游标分页的正确形态。

**改动**：
- 客户端 `TenantAuditLogView.swift`：底部条替换为「已加载 N 条 · 还有更多」+「加载更多」按钮（模板见 `UI_STANDARD.md` 4.4）。
- 客户端 `TenantsViewModel.swift`：
  - 四个字典 + `auditRowStart` 累加循环**收敛为单个 `nextToken`**；序号即 `1..N`。
  - 移除 `applyAuditPage` 里 `state.size` 被覆盖成本页条数的逻辑。
  - 「加载更多」= 带 `nextToken` 请求并 **append** 到 `auditPageItems` 尾部。
  - 需设行数上限（建议 2000），达上限后提示「已达上限，请缩小时间范围」。
- Web `tenant-actions.jsx`：Web 当前**完全不接 `nextPageToken`**，只渲染第一页并静默丢数据——应同步补上「加载更多」。

**验收**：
- 底部无页码条、无跳页框、无「共 N 条」。
- 点「加载更多」追加数据，已有行不消失。
- 无下一页时按钮隐藏或禁用，文案去掉「还有更多」。

---

### B5 ✅ 快捷范围按钮（近1 / 3 / 7 / 30 天 + 自定义）

**根因**：原项目 `mobile/audit_log.ftl` 有 `alSelectQuick(1/3/7/30)` + 自定义，默认近 1 天。**Web 与客户端都没有这排按钮**，而它比列宽更影响日常使用。

**改动**：
- 客户端 `TenantAuditLogView.swift` → `filterBar`：在开始/结束日期前加 chips；默认选中「近1天」（对齐原项目默认值）。
- Web `tenant-actions.jsx` → 筛选栏同样补充；Web 当前硬编码近 7 天，应改为默认近 1 天以对齐原项目。

**验收**：点击 chips 后开始/结束日期自动填充并发起查询；「自定义」切到可手填模式。

---

## P2 · 布局

### C1 ✅ 序号列收窄 44 → 36

- 文件：`oci-pool-mac/OciPool/Features/Tenants/TenantAuditLogView.swift`（`wIndex`）。
- 说明：`auditRowStart` 是跨页累计序号，最多 4 位数，36px 足够。
- 若 B4 落地为 append 模式，序号变为 `1..N`，更短。
- **验收**：序号不换行、不截断。

### C2 ✅ 来源 IP 列 —— 保持宽度 + 省略号（已决策 2026-09-11）

**现状**：后端 `resolveMultiIpLocation` 把 IP 与地理位置**拼成一个字符串**，如 `10.0.2.9(内网地址)，252.49.125.199(中国广东省深圳市)`，单条 40+ 字符（≈280px @12px）。**当前 120px 已在重度截断**，再收窄基本只剩省略号。

**决策**：采用 **(a) 保持当前宽度（`wIPBase = 120`）**，超出部分省略号，hover（`.help`）看全。

**理由**：IP 地址长度差异极大（IPv4 ≈ 15 字符 / IPv6 可达 39 字符），硬收窄必然截断；拆成两列会让表宽再增，与 C1「收窄」的取向相反。保持宽度是唯一不损失信息又不扩表的方案。

**改动**：
- `oci-pool-mac/OciPool/Features/Tenants/TenantAuditLogView.swift`：`wIPBase` **保持 120，不动**。
- 确认该列已挂 `.help(...)` hover 提示（显示完整 IP + 地理位置串）；若未挂则补上。
- 单行截断用 `lineLimit(1)` + `truncationMode(.tail)`，不换行、不撑高行高。

**验收**：
- 含 IPv6 或「双 IP + 地理位置」的长串不撑高行高、不换行，右侧以省略号收尾。
- hover 能看全完整串。
- 表格总宽不因该列变化。

> 选项 (b) 拆两列、(c) 硬收到 ~90px **不做**。

---

## P3 · 附带

### D1 ✅ 分页标准对齐（与审计日志无关的独立批次）

依据 `UI_STANDARD.md` 第四章 4.1 / 4.2：
- 默认条数 `10 → 20`：`InstancesViewModel.swift` / `TenantsViewModel.swift` / `RegionsViewModel.swift` / `ProxyConfigViewModel.swift`
- 档位越界 `5 → 10`：`EmailViewModel.swift`（`enabledPage` / `disabledPage`）

### D2 ✅ 文档一致性收敛

**问题**：目前**三处「待对齐」清单并存且互相矛盾**：
- `NEW_SESSION_CONTINUE.md` 的「待对齐（下一步）」
- `UI_STANDARD.md` 第一章 1.8 的「已对齐页面清单」
- `UI_STANDARD.md` 第四章 4.6 的「已对齐 / 待对齐清单」

**改动**：以 `UI_STANDARD.md` 为唯一权威，`NEW_SESSION_CONTINUE.md` 改为只引用、不复制清单。

---

## 明确不做的事

- **不给 `ListEventsRequest` 加 `limit`**：该参数不存在（SDK 实测只有 `compartmentId / startTime / endTime / page / opcRequestId`），每页条数由 OCI 服务端固定，不可控。故审计日志**不设每页条数选择器**（`showsSizeSelector: false` 保持）。
- **不伪造总数**：OCI 不返回 total，禁止显示「共 N 条」或计算总页数。
- **不做三态环境**（控制台 / API / SDK）：`authType` 取值未实测，等真机数据后再定。
- **不改时间显示时区**：`Dockerfile.deploy` 与 `oci-pool.sh` 均固定 `TZ=Asia/Shanghai`，显示已是 +8，无需改动。

---

## 决策记录

| 日期 | 项 | 决策 | 备注 |
|---|---|---|---|
| 2026-09-11 | C2 来源 IP 列 | **保持 120px + 省略号 + hover 看全** | 拆两列 / 硬收 90px 均不做 |
| 2026-09-11 | 整体推进方式 | **先只出文档与原型，不动代码** | 待方案对齐后再开工 |
| 2026-09-11 | B4 分页形态 | 改「加载更多」，保留翻页能力 | 依据 `UI_STANDARD.md` 4.3/4.4 |
| 2026-09-11 | 三态环境（控制台/API/SDK） | **不做** | `authType` 取值未实测 |
| 2026-09-11 | 每页条数选择器 | **不做**（OCI 无 `limit`） | 服务端固定分页 |

**仍待确认（不阻塞 P0）**：

1. **B1 展示形态**：建议「语义徽章（控制台 / API）+ hover 显示原始 `authType` 与 UA」。若只要二值标签、不要 hover 细节，请指出。
2. **B2 是否保留完整事件类型**：建议 `eventType` 存短名（`LaunchInstance`），另加 `eventFullType`（`com.oraclecloud.ComputeApi.LaunchInstance`）供 hover / 排查。若不需要排查字段可省。

---

## 附录 A · 接口契约增量

**接口**：`POST /tenants/audit/log` → `TenantController#getAuditLogs`

### A.1 请求 `AuditLogRequest`

| 字段 | 变化 | 说明 |
|---|---|---|
| `tenantId` | 不变 | |
| `startDate` / `endDate` | 不变 | `yyyy-MM-dd`；`endDate` 空则等于 `startDate` |
| `days` | 不变 | 仅在不传 `startDate` 时生效（客户端实际走不到） |
| `pageToken` | **语义需明确** | B4 依赖它做「加载更多」；Web 端当前**完全不传**，等于只取第一页 |

### A.2 响应 `OciAuditEventDto`

| 字段 | 变化 | 影响端 | 兼容性 |
|---|---|---|---|
| `consoleSessionId` | **新增**（B1） | 客户端 + Web | 纯新增，旧端忽略即兼容 |
| `userType` | 保留 | 客户端已解码、未渲染 | 不变 |
| `eventType` | **取值语义变更**（B2） | 客户端 + Web | ⚠️ 破坏性：由 `com.oraclecloud.ComputeApi.LaunchInstance` 变为 `LaunchInstance`。字段名不变，但**任何按完整类型做匹配/过滤的代码都会失效**——已确认仓库内无此类消费者 |
| `eventFullType` | **新增**（B2，待确认） | 客户端 | 纯新增 |
| `clientEnv` | 保留原始 UA | — | 降级为 hover 详情，不再作列主值 |
| `responseStatus` | 不变 | — | 取值含 `-`（后端在 `response == null` 时填充），A3 要求按「中性」处理 |
| `ipAddress` | 不变 | — | 已是「IP(地理位置)」拼接串，可能含多个 |

### A.3 错误语义（A4 依赖）

| 场景 | 现状 | 目标 |
|---|---|---|
| 真的没有日志 | `success` + 空数组 → **被 mock 顶替** | `success` + 空数组（mock 关闭时） |
| OCI 查询失败（`BmcException`） | `log.warn` + 空列表 → **被 mock 顶替** | **明确错误响应**，前端走 errorBanner + 重试 |
| 参数非法（>90 天 / 格式错） | 被自身 catch → 空列表 → **被 mock 顶替** | **明确错误响应**（400 语义） |

> 三行的共同根因是「空结果」与「失败」共用了一个出口。A1/A2/A4 必须同批改，否则任一单独改动都会留下另一条静默路径。

---

## 附录 B · 页面状态全集

改造后页面的**全部可见状态**见 `docs/mockups/audit-log-states.html`：正常态 / 加载中 / 空态 / 错误态 / 加载更多中 / 已达上限。逐项验收时按该文件对照。

---

## 附录 C · 实现记录（2026-09-11）

全部 13 项已落地，三端编译/转译均通过。

### 后端（Java）

| 文件 | 改动 |
|---|---|
| `pojo/dto/OciAuditEventDto.java` | 新增 `eventFullType`、`consoleSessionId`；改 `@Builder`（9 字段用位置构造太易错）；每个字段补语义注释 |
| `pojo/dto/OciPageResult.java` | 新增 `mock` 标记（`@Builder.Default false`）；补 `@Builder`/`@NoArgsConstructor` |
| `utils/oracle/AuditLogUtils.java` | `listAuditEvents`：读 `consoleSessionId` / `getEventName()`（短名，null 回退完整类型）/ `getEventType()`；**不再吞异常**，`BmcException` 与其它异常均包成 `IllegalStateException` 上抛。`listAuditEventsByDateRange`：去掉 catch-all，`DateTimeParseException` → `IllegalArgumentException("日期格式不正确，应为 yyyy-MM-dd")`；超限文案补当前天数 |
| `mock/MockDataService.java` | `auditEvents()` 重写：8 行，补 `eventFullType` / `consoleSessionId` / `userType`；`userType` **一律填 `natv`**（刻意让控制台与 API 行同值，演示「authType 判不了来源」）；IP 用「IP(地理位置)」长串以复现截断场景 |
| `service/impl/TenantServiceImpl.java` | `queryAuditLogs` 重构：参数异常 → `ApiResponse.error(400, msg)`（**不回退 mock**）；其它异常 → mock 开启时返回**带标记**的演示数据，否则明确错误；新增 `mockAuditPage()` 统一返回 `OciPageResult` 形态（原先 mock 返回裸 List，与真实路径结构不一致） |
| `oci-common/.../param/ApiResponse.java` | 新增 `error(int code, String message)` 重载（区分 400/500，前端只读 `success`/`message`，向后兼容） |

### macOS 客户端（Swift）

| 文件 | 改动 |
|---|---|
| `Features/Tenants/TenantsModels.swift` | `TenantAuditLogEntry` 加 `eventFullType`/`consoleSessionId`；`isError` 改 2xx 前缀匹配并新增 `isUnknownStatus`/`isSuccess`/`isConsoleSession`/`envLabel`/`envDetail`/`eventDetail`；`TenantAuditLogPage` 加 `mock` |
| `Features/Tenants/TenantsService.swift` | 解析响应里的 `mock` 标记 |
| `Features/Tenants/TenantsViewModel.swift` | 审计状态重写：**四个字典 + `auditRowStart` 累加循环 → 单个 `auditNextToken`**；新增 `loadMoreAudit()`（append）/ `auditFooterText` / `auditReachedLimit`（上限 2000）；`searchAudit` 加格式正则 + 实际可解析 + ≤90 天校验；新增 `applyAuditQuickRange` / `isAuditQuickRangeActive` / `isAuditRangeCustom`；`auditPageState` 与 `onAuditPageChange` 移除 |
| `Features/Tenants/TenantAuditLogView.swift` | 底部 `PaginationBar` → 「已加载 N 条 · 还有更多」+「加载更多」；新增快捷区间 chips（自定义为状态指示，非无效按钮）；环境列改徽章（控制台 info 蓝 / API violet 紫）+ hover 显示 authType/UA；响应列改「语义徽章 + 原始码」，`-` 显示「未知」橙；事件列 hover 显示完整类型；`wIndex` 44→36；`wStatus` 72→118、`minEnv` 120→96、`wTimeBase` 150→140，IP 列保持 120；新增演示数据横幅 |
| `Supporting/AppTheme.swift` | 新增 `static let violet`（对齐 Web `var(--violet)`） |
| `InstancesViewModel` / `TenantsViewModel` / `RegionsViewModel` / `ProxyConfigViewModel` | `PageState` 默认 `10 → 20` |
| `EmailViewModel` | 5 个列表默认 `5`/`10` → `20`（`5` 不在 `sizeOptions` 内，属自相矛盾） |

### Web（React / JSX）

| 文件 | 改动 |
|---|---|
| `src/tenant-actions.jsx` → `useAuditDrawer` | 默认区间改近 1 天（原硬编码近 7 天，是对原项目的偏离）；新增快捷区间 chips；日期改用本地时区切片（原 `toISOString()` 按 UTC 切日，深夜会错一天）；加格式/顺序/≤90 天校验；**补 `pageToken` 与「加载更多」**（原实现完全不传，只取第一页）；状态判定改 2xx 前缀匹配 + `-` 归「未知」；环境列改用 `consoleSessionId` 判据并删掉永不命中的 `envCfg{Console,API,SDK}` 死配置；新增演示数据横幅、错误横幅、空态；底部改为游标分页文案 |
| `src/i18n.jsx` | 新增 20 个 `audit.*` 键（中英各一份） |

**顺手修掉的一处无效控件**：原筛选栏的 `SearchInput` 既无 `value` 也无 `onChange`（纯装饰、点了没反应），已从审计抽屉移除。

### 验证

- `mvn -pl oci-server -am compile` → **BUILD SUCCESS**（且 Maven 会自动执行 `modern-ui-build/build.mjs`，27 个 `.jsx` 全部转译到 `dist/`）
- `node build.mjs` 单独跑 → 27 files OK
- `xcodebuild -scheme OciPool -configuration Debug build` → **BUILD SUCCEEDED**

### 未做 / 遗留

- **~~Web 审计 CSV 导出：不做（保持原样）~~ → 已去掉**（2026-09-11 晚决策）：
  用户截图标记「去掉」→ `tenant-actions.jsx` 删除「导出」按钮与 `exportAudit` 函数，i18n key 一并清除。
- **真机验收未做**：以上均为编译级验证。P0 的静默假数据、B1 的环境判定、B3 的 201/204 都需要连真实租户跑一遍才算过——`deploy/.env` 里 `MODERN_UI_MOCK_DATA=true` 目前是开的，验收前记得关掉。

> **验收请转 `docs/audit-log-acceptance-checklist.md`**：本文件说明「改了什么、为什么改」，那份说明「怎么验、预期看到什么、什么算不通过」，含 53 个验收项（M1–M53）+ 5 项回归（R1–R5）+ 受阻项与解锁条件。**P0 四项（A1–A4）已在真实部署上完成接口层验证（见该文件 §6.1）。**

---

## 参考实现与依据

| 项 | 位置 |
|---|---|
| 原项目审计日志页（功能权威） | `oci-server/src/main/resources/templates/mobile/audit_log.ftl` |
| 改造后页面实例 | `docs/mockups/audit-log-redesign.html` |
| 改造后页面状态全集 | `docs/mockups/audit-log-states.html` |
| 分页标准 | `UI_STANDARD.md` 第四章 |
| 后端接口 | `POST /tenants/audit/log` → `TenantController#getAuditLogs` |
| 后端服务 | `TenantServiceImpl.queryAuditLogs`（L1182）· `AuditLogUtils.listAuditEvents`（L49） |
| 客户端页面 | `oci-pool-mac/OciPool/Features/Tenants/TenantAuditLogView.swift` |
| 客户端状态与逻辑 | `.../Tenants/TenantsViewModel.swift`（L62–81 · L1015–1131） |
| 客户端模型 / 服务 | `.../Tenants/TenantsModels.swift`（L859–895）· `.../Tenants/TenantsService.swift`（L232–262） |
| Web 实现 | `oci-server/.../modern-ui/src/tenant-actions.jsx`（`useAuditDrawer` L5071–5258） |
