# 审计日志改造 · 验收清单（Audit Log Acceptance Checklist）

> 记录时间：2026-09-11 · 项目：OCI-Pool v1.0.11
> 配套文档：`docs/audit-log-remediation-plan.md`（改了什么、为什么改）· `UI_STANDARD.md` 第四章（分页标准）· `docs/mockups/audit-log-states.html`（页面状态全集）
> 状态标记：⬜ 待验 / ✅ 通过 / ❌ 不通过 / ⏸ 受阻

---

## 0. 怎么用这份清单

改造已全部落地，但**只做过编译级验证**，没有任何一条走过真实界面。这份清单把 13 项改造拆成**可逐条打勾的验收卡**：每条写清「看哪里、怎么点、应该看到什么、什么算不通过」。

验收分三批，**能做的先做**：

| 批次 | 前提 | 覆盖项 | 现在能做吗 |
|:---|:---|:---|:---|
| **批次一** | `MODERN_UI_MOCK_DATA=true`（当前默认） | B1 B2 B3 B4 B5 C1 C2 D1 D2 + A3 的 mock 行覆盖 | ✅ **立即可做** |
| **批次二** | `MODERN_UI_MOCK_DATA=false` | A1 A2 A3 A4 | ⏸ **部分受阻**（见 §4） |
| **批次三** | 真实健康租户 + 真实审计数据 | A2 A3 B2 的「真实形态」确认 | ⏸ **受阻**（见 §4） |

> **核心原则**：批次一验的是**界面形态与交互**（mock 数据已刻意覆盖所有状态码与两种调用来源），批次二/三验的是**正确性语义**（真假数据的区分、错误路径）。两批不可互相替代。

---

## 1. 验收前置条件

### 1.0 ⚠️ 先把改动真正部署上去（**2026-09-11 实测踩到**）

**现象**：改造代码写完、`mvn compile` 通过，但界面上完全看不到新行为——因为**部署里跑的还是改造前的代码**。

**根因**：部署链路是「宿主机预构建 jar → 镜像只拷 jar」，而 `mvn compile` **不产出** `oci-pool-release.jar`（那是 `package` 阶段的产物）：

```
deploy/Dockerfile.deploy L16:  COPY oci-server/target/oci-pool-release.jar /oci-pool/oci-pool.jar
```

所以 `compile` 通过 ≠ 部署可用。实测证据：

| 对象 | 时间 | 含新代码 |
|:---|:---|:---|
| `oci-server/target/oci-pool-release.jar` | 2026-09-10 22:41 | ❌ 0 处 |
| 镜像 `oci-pool-modern-ui:latest` | 2026-09-10 13:33 | ❌ 0 处 |
| 容器内 jar / 静态资源 | 同上 | ❌ 0 处 |
| `src/.../modern-ui/dist/` | 2026-09-11 13:23 | ✅ 已含 |

**因此批次一执行前必须先重新部署**：

```bash
cd /Users/zszweb/Downloads/oci-start-modern-ui-v4

# 0) 先给当前镜像留回滚点（新版本起不来可秒退）
docker tag oci-pool-modern-ui:latest oci-pool-modern-ui:rollback-$(date +%Y%m%d)

# 1) 打包（dist/ 已是最新，跳过前端构建；JDK 必须是 17）
JAVA_HOME=/Library/Java/JavaVirtualMachines/jbrsdk_jcef-17.0.10-osx-aarch64-b1207.14/Contents/Home \
  mvn -pl oci-server -am package -DskipTests -Dskip.installnodenpm=true -Dskip.npm=true

# 2) 自检 jar 真的带上了改动（三项都应 > 0）
for s in consoleSessionId eventFullType mockAuditPage; do
  printf "%-18s " "$s"; unzip -p oci-server/target/oci-pool-release.jar | strings | grep -c "$s"
done

# 3) 重建镜像 + 重建容器
cd deploy && docker compose build app && docker compose up -d app
docker compose logs -f app | head -40   # 等到 "Application 'oci-pool' is running successfully!"

# 4) 自检容器内 jar 也带上了（应为 > 0，若为 0 说明镜像没重建成功）
docker exec oci-pool-modern sh -c 'unzip -p /oci-pool/oci-pool.jar | strings | grep -c consoleSessionId'
```

**回滚**（新版本起不来时）：

```bash
docker tag oci-pool-modern-ui:rollback-$(date +%Y%m%d) oci-pool-modern-ui:latest
cd deploy && docker compose up -d --force-recreate app
```

> 💡 跳过前端构建的前提是 `src/main/resources/static/modern-ui/dist/` 比 `src/` 下的 `.jsx` 新。若改过 `.jsx`，必须先 `cd oci-server/modern-ui-build && node build.mjs`（27 个文件）再打包，否则 jar 里带的是旧的转译产物。

### 1.1 开关与重启

```bash
cd deploy
# 批次一：确认 mock 开（当前就是 true）
grep MODERN_UI_MOCK_DATA .env          # 期望 MODERN_UI_MOCK_DATA=true

# 批次二：改成 false 后必须重建容器，改 .env 不会自动生效
sed -i '' 's/^MODERN_UI_MOCK_DATA=.*/MODERN_UI_MOCK_DATA=false/' .env
docker compose up -d --force-recreate app
docker compose logs -f app | head -40   # 等到 "Application 'oci-pool' is running successfully!"
```

> ⚠️ `MODERN_UI_MOCK_DATA` 是**容器启动时**读入的 `@Value`，改完 `.env` 必须 `--force-recreate`，只 `restart` 不生效。

### 1.2 验收用数据

**批次一不需要造数据**——mock 的 8 行已刻意覆盖全部形态：

| 行 | 事件 | 环境 | 状态码 | 用来验 |
|:---|:---|:---|:---|:---|
| 1 | LaunchInstance | 控制台（有 `consoleSessionId`） | 200 | 控制台徽章、超长 IP 串截断 |
| 2 | GetInstance | 控制台 | 200 | 同来源不同事件 |
| 3 | CreateVcn | API（无 `consoleSessionId`，UA=Terraform） | 200 | API 徽章、hover 看 UA |
| 4 | UpdateBootVolume | API（UA=oci-java-sdk） | **201** | **A3：2xx 非 200 必须判成功** |
| 5 | StopInstance | 控制台 | **204** | **A3：同上** |
| 6 | TerminateInstance | API（UA=oci-cli） | **404** | 失败徽章 |
| 7 | DeleteVolume | 控制台 | **500** | 失败徽章 |
| 8 | ListInstances | 控制台 | **`-`** | **A3：必须显示「未知」橙，不染红** |

> mock 的 `userType` **8 行全是 `natv`**——这是刻意的。它证明「用 `authType` 判来源」是错的（控制台行与 API 行同值），只有 `consoleSessionId` 能分开。

**批次二/三需要**：一个 OCI 侧凭证有效、能返回真实审计事件的租户。当前不满足（见 §4）。

### 1.3 已完成的验证（不必重做）

- ✅ `mvn -pl oci-server -am compile` → BUILD SUCCESS（自动跑 `modern-ui-build/build.mjs`，27 个 `.jsx` 全转译）
- ✅ `node build.mjs` 单独跑 → 27 files OK
- ✅ `xcodebuild -scheme OciPool -configuration Debug build` → BUILD SUCCEEDED
- ✅ `dist/` 产物已确认含新代码（`consoleSessionId` / `audit.envConsole` / `audit.loadMore` 均在；旧死配置 `envCfg.Console` 已消失）

---

## 2. 批次一 · UI 形态验收（mock 开，立即可做）

### 2.0 怎么打开审计抽屉（实测路径，2026-09-11 在部署机上验证过）

**Web 端**（入口 `http://<部署机>:9856/modern-ui/index.html`，登录后）：

1. 左侧栏 → **OCI 租户管理**（地址变为 `#/tenants?cloudType=1`）
2. 表格**最后一行「操作」列**的三点图标按钮（`title="操作"`，约 28×28）
3. 弹出菜单里点 **「审计日志」**

> 这一步是本轮唯一真正阻塞的环节：我为了不装浏览器，用 Chrome DevTools Protocol 驱动了本机 headless Chrome，
> 已经走到「菜单弹出、`审计日志` 按钮定位成功（坐标 1296,406）」，但没继续往下抓抽屉内的计算样式。
> 下面是**逐项目视 + DevTools 检查**的做法，照着过一遍即可。

**每项怎么看**：徽章颜色用 DevTools 的 Elements 面板选中元素看 `background-color` / `color`；
hover 类项目（M8 / M11 / M26）鼠标悬停看原生 tooltip；列宽在 Elements 里量 `getBoundingClientRect().width`。

> ⚠️ **应用默认是 dark 主题**（`index.html` 的 `OCI_TWEAK_DEFAULTS.theme = "dark"`）。
> 验徽章颜色时按深色底预期，别拿浅色底的对比度去判「看不清」——那是主题差异不是缺陷。

**客户端**：macOS App → 租户 → 审计日志（用于 M9 / M23 的三端一致性对照）。

### 2.1 环境准备自检

- [ ] **M1** 顶部出现橙色「当前显示的是演示数据」横幅，副文案含 `MODERN_UI_MOCK_DATA=true · 非真实审计记录，请勿据此判断租户状态`
  - 判定依据：Web `state.mock` ← 响应体 `mock:true`；客户端 `auditMock`
  - ❌ 不通过：mock 开着但没横幅（说明 `mock` 标记没透传到前端）

### 2.2 B5 · 快捷区间 chips

- [ ] **M2** 筛选栏左侧有 4 个 chip：近1天 / 近3天 / 近7天 / 近30天，默认高亮「近1天」
  - ❌ 不通过：默认高亮的是「近7天」（旧硬编码值，属偏离原项目）
- [ ] **M3** 点「近7天」→ 开始/结束日期自动填充为 7 天区间，且**立即发起查询**（不需要再点「查询」）
- [ ] **M4** 手动改日期 → 4 个 chip **全部取消高亮**，「自定义」变为激活态
  - 判定依据：chip 选中态由日期值反推（`isAuditQuickRangeActive`），不存独立状态
  - ❌ 不通过：手动改日期后 chip 仍高亮（说明选中态与实际区间脱钩）
- [ ] **M5** 「自定义」是**状态指示**，点了没反应（它不是按钮）
  - 这是刻意设计：日期字段始终可编辑，做成按钮就是无效控件

### 2.3 B1 · 环境列（控制台 / API）

- [ ] **M6** 第 1、2、5、7、8 行「环境」列显示 **「控制台」蓝色徽章**
- [ ] **M7** 第 3、4、6 行显示 **「API」紫色徽章**（violet，与 Web `--violet` / Swift `AppTheme.violet` 同色）
- [ ] **M8** hover 任一环境徽章 → 显示 `authType=natv` + `UA=<原始 UserAgent>`；控制台行**额外**有 `consoleSessionId=ocid1.console.oc1..sess001`
  - ❌ 不通过：控制台行 hover 里没有 `consoleSessionId`（说明环境详情漏了关键判据）
  - ❌ 不通过：8 行全是「控制台」蓝色（说明还在按 `authType` 判来源——mock 里 8 行 `authType` 同值，必然全蓝）
- [ ] **M9** 三端颜色一致：Web 与 macOS 客户端的「控制台」都是蓝、「API」都是紫

### 2.4 B2 · 事件列短名 + 完整类型

- [ ] **M10** 事件列显示**短名**：`LaunchInstance` / `CreateVcn` / `StopInstance`……，**不出现** `com.oraclecloud.ComputeApi.` 前缀
- [ ] **M11** hover 事件列 → 显示**完整类型** `com.oraclecloud.ComputeApi.LaunchInstance`
  - 判定依据：后端 `eventType`=短名（`getEventName()`），`eventFullType`=完整类型（`getEventType()`）
- [ ] **M12** 事件列不换行、不撑高行高，超长以省略号收尾

### 2.5 B3 + A3 · 响应列语义徽章 + 原始码

- [ ] **M13** 第 1、2、3 行显示 **「成功」绿/accent 徽章 + `200` 弱化 mono 码**
- [ ] **M14** **第 4 行（201）显示「成功」** ← A3 关键项
- [ ] **M15** **第 5 行（204）显示「成功」** ← A3 关键项
- [ ] **M16** 第 6 行（404）、第 7 行（500）显示 **「失败」红色徽章 + 红色 mono 码**
- [ ] **M17** **第 8 行（`-`）显示「未知」橙色徽章**，原始码位置显示 `—` 或 `-`，**不染红** ← A3 关键项
  - ❌ 不通过（最常见）：201/204 被标成「失败」——说明 2xx 判定还是精确匹配 `"200"`
  - ❌ 不通过：`-` 行被染红——说明把「后端没返回 response」误当查询失败

### 2.6 B4 · 游标分页（「加载更多」）

- [ ] **M18** 底部**没有**页码条（`1 2 3`）、**没有**跳页输入框、**没有**「共 N 条」
  - 判定依据：OCI 审计接口不返回 total，且 `ListEventsRequest` **没有 `limit` 参数**（SDK 实测只有 `compartmentId/startTime/endTime/page/opcRequestId`），每页条数由服务端固定
  - ❌ 不通过：出现任何页码 / 跳页框 / 「共 N 条」
- [ ] **M19** 底部文案为 `已加载 N 条 · 还有更多`（或 `已加载 N 条 · 已达上限，请缩小时间范围`）
- [ ] **M20** 点「加载更多」→ 追加数据，**已有行不消失、序号连续递增**
  - ❌ 不通过：点完列表被整页替换（说明 append 变成了 replace）
- [ ] **M21** 加载更多过程中按钮进入 loading 态，不可重复点击
- [ ] **M22** 数据取尽后「加载更多」按钮消失，文案里的「还有更多」也消失
- [ ] **M23** 三端行为一致：Web 与客户端都是「加载更多」，都没有页码条

> mock 只有 8 行、单页返回，所以 M20–M22 需要**多于 1 页**的真实数据才能完整验证——mock 下只能确认「按钮/文案形态正确、单页时按钮不出现」。

### 2.7 C1 / C2 · 列宽

- [ ] **M24** 序号列窄（约 36px），4 位数不换行、不截断
- [ ] **M25** 来源 IP 列宽约 120px；第 1 行的 `10.0.2.9(内网地址)，252.49.125.199(中国广东省深圳市)`（40+ 字符）**不换行、不撑高行高**，右侧省略号收尾
- [ ] **M26** hover 来源 IP → 显示**完整**的「IP + 地理位置」串
- [ ] **M27** 表格总宽不因该列变化（IP 列宽度**没有**被收窄）

### 2.8 D1 · 分页默认条数（波及面，独立批次）

> ✅ **已补验完（2026-09-11，不需要浏览器）**：M28 ❌ / M29 ❌ / M30 ✅。
> 结论与证据见 §6.1，缺口分析见 §7.4。**不用再人工过这三项。**

这几项与审计日志无关，但同批改过，验收时顺手过一眼：

- [ ] **M28** 实例列表 / 租户列表 / 区域列表 / 代理配置：底部每页条数默认 **20**（原为 10）
- [ ] **M29** 邮件页 5 个列表（启用/禁用/联系人/记录/详情）：默认 **20**（原为 5 或 10）
- [ ] **M30** 每页条数下拉档位为 `10 / 20 / 50 / 100`，**不出现 5**
  - 判定依据：`UI_STANDARD.md` 第四章 4.1/4.2；`5` 不在 `sizeOptions` 内，属自相矛盾

### 2.9 D2 · 文档一致性

> ✅ **已补验完（2026-09-11）**：M31 ⚠️ / M32 ⚠️ / M33 ⚠️ —— 三项**形式上都做了、但都留了失真**，
> 已在本轮修正（`UI_STANDARD.md` §4.6 + `NEW_SESSION_CONTINUE.md`）。详见 §6.1 与 §7.4。

- [ ] **M31** `UI_STANDARD.md` §4.6 是「已对齐 / 待对齐」的**唯一权威**表
- [ ] **M32** `NEW_SESSION_CONTINUE.md` 里**没有**复制的清单，只有指向 `UI_STANDARD.md` 的引用
- [ ] **M33** 全仓库搜索「待对齐」，只在 `UI_STANDARD.md` 里出现清单（`docs/audit-log-remediation-plan.md` 的优先级表是「状态」不是「待对齐」）

---

## 3. 批次二 · 正确性验收（mock 关）

前置：`MODERN_UI_MOCK_DATA=false` + 重建容器 + 顶部橙色演示横幅**消失**。

### 3.1 A1 · 日期校验（前端部分不需后端，可立即验）

**Web 端**（审计抽屉内手输日期）：

- [ ] **M34** 开始日期输 `2026/09/04` → 点「查询」→ toast `日期格式不正确，应为 yyyy-MM-dd`
- [ ] **M35** 承上，DevTools Network 面板**没有** `POST /tenants/audit/log` 请求发出
  - ❌ 不通过：请求发出去了（说明只做了提示没做拦截，后端仍会被打）
- [ ] **M36** 开始 `2025-01-01`、结束 `2026-09-11` → toast `日期范围不能超过 90 天（当前 N 天）`，无请求
- [ ] **M37** 开始 `2026-09-11`、结束 `2026-09-01` → toast `开始日期不能晚于结束日期`，无请求
- [ ] **M38** 输 `2026-02-31`（格式对但日期不存在）→ 被拦下，无请求
  - 判定依据：Web `validateRange()`；客户端 `isValidAuditDate()`（正则 + 实际可解析）
- [ ] **M39** 客户端（macOS）重复 M34 / M36 / M37 → 出现 toast，**不发请求**
  - 客户端文案：`日期范围不能超过 90 天（当前 N 天）`

**后端绕过前端直验**（需带登录态 cookie）：

```bash
curl -s -X POST 'http://127.0.0.1:9856/tenants/audit/log' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <sa-token>' \
  -d '{"tenantId":<id>,"startDate":"2025-01-01","endDate":"2026-09-11"}'
```

- [ ] **M40** 返回 `success:false`、`code:400`、`message` 含「日期范围不能超过 90 天（当前 N 天）」
- [ ] **M41** 换 `startDate":"2026/09/04"` → 返回 `code:400`、`message` 为「日期格式不正确，应为 yyyy-MM-dd」
- [ ] **M42** 换 `startDate":"2026-09-11","endDate":"2026-09-01"` → `code:400`、「结束日期不能早于开始日期」
  - ❌ **关键不通过**：以上三种任一返回 `success:true` 或返回**演示数据行** —— 说明参数异常仍被吞成「空结果」再被 mock 顶替，A1/A2/A4 的修复未生效
  - 判定依据：`AuditLogUtils.listAuditEventsByDateRange` L170–182 抛 `IllegalArgumentException`；`TenantServiceImpl.queryAuditLogs` 的 `IllegalArgumentException` 分支返回 `ApiResponse.error(400, msg)` 且**绝不回退 mock**
- [ ] **M53** 90 天边界与前端口径一致（§7.1 修复项）：以 `endDate=2026-09-11` 为基准

  | startDate | 闭区间天数 | 后端期望 |
  |:---|:---|:---|
  | `2026-06-14` | 90 | ✅ 放行 |
  | `2026-06-13` | 91 | ❌ 拒绝，文案「当前 91 天」 |

  - ❌ 不通过：`2026-06-13`（91 天）被放行 —— 说明 off-by-one 未修复
  - ⚠️ 注意：响应体里的 `code:400` 是业务码，**HTTP 状态码仍是 200**（项目 `ApiResponse` 约定，全局如此），别按 HTTP 状态判失败

> 注：`ApiResponse` 一律返回 HTTP 200，业务成败看响应体的 `success` / `code`。上面 M40–M42 / M53 的「400」都是**业务码**。

### 3.2 A2 · mock 不再顶替真实数据

- [ ] **M43** mock 关闭后，查询一个**确实没有审计事件**的日期区间 → 显示空态「该时间范围内没有审计事件」，**不出现任何事件行**
  - ❌ 不通过：出现 8 行演示数据（说明空结果仍在顶替 mock）
- [ ] **M44** mock 关闭后，顶部橙色演示横幅**不出现**
- [ ] **M45** mock 打开时，查询一个无日志区间 → 出现演示数据 + 橙色横幅（**这是预期行为**，属显式演示模式）
- [ ] **M46** 后端日志出现 `审计日志查询结果为空，返回演示数据（MODERN_UI_MOCK_DATA=true）` 的 WARN（mock 开时）
  - 判定依据：`TenantServiceImpl.queryAuditLogs` 空结果分支

### 3.3 A4 · 后端异常不再被吞

- [ ] **M47** 用一个**凭证失效**的租户查询审计日志 → 显示**错误横幅**（含标题 + 详情 + 重试按钮），**不是**「暂无日志」空态
  - 当前环境**天然满足**这个条件：所有 OCI 调用都返回 401（见 §4），所以 mock 一关就能直接验这一条
- [ ] **M48** 点错误横幅上的「重试」→ 重新发起查询
- [ ] **M49** 后端日志出现 `查询审计日志失败: 状态码=401, 错误=...`（WARN），**且**接口返回 `success:false`
  - ❌ 不通过：接口返回 `success:true` + 空数组（说明异常仍被吞成空结果）
- [ ] **M50** mock 打开时，同一失效租户 → 返回带 `mock:true` 的演示数据（而非错误）
  - 这是刻意的：演示模式优先，但要**带标记**，不能伪装成真实数据

### 3.4 A3 · 真实 2xx 判定

- [ ] **M51** 真实数据里出现 201 / 204 事件 → 显示「成功」
- [ ] **M52** 真实数据里 `responseStatus` 为 `-` 或空 → 显示「未知」橙，不染红
  - 依赖真实数据；mock 下已由 M14/M15/M17 覆盖同等逻辑

---

## 4. 受阻项与解锁条件

### 4.1 当前阻塞：所有 OCI 调用返回 401

`deploy/logs/application-2026-09-10.0.log` 里 **373 次 `(401, NotAuthenticated)`，且这是唯一的错误码**（400/403/404/409/429/5xx 全为 0），跨 Identity / VirtualNetwork / Blockstorage / Audit 所有服务。

**这意味着**：

- 批次二的 M43（空态）**无法验**——查任何区间都是错误，拿不到「成功 + 空数组」
- 批次三**全部受阻**
- 但 **M47–M50（A4 错误态）反而可以立即验**——401 就是现成的失败样本

**已排除的原因**（都是实测，别再重复查）：

| 假设 | 结论 | 证据 |
|:---|:---|:---|
| 密钥文件与库里 fingerprint 错配 | ❌ 排除 | `openssl pkey -pubout -outform DER \| md5` 反推指纹，与 `TENANT.FINGERPRINT` **5/5 完全一致** |
| 密钥文件路径错 | ❌ 排除 | `KEY_FILE` 存 `./data/upload/*.pem`，容器工作目录 `/oci-pool`，正好落在 bind mount `./data:/oci-pool/data` 上 |
| 是权限问题不是凭证问题 | ❌ 排除 | 权限问题会返回 `404 NotAuthorizedOrNotFound`，日志里 **0 次 404** |
| 坏密钥文件导致 | ❌ 排除 | `deploy/data/upload/3ba8df89-..._key.pem` 只有 58 字节（无密钥体）确实是坏文件，但**没有任何租户引用它** |

**待查方向**（未做）：用私钥按 OCI HTTP Signature 规范签名后直连 `identity.<region>.oraclecloud.com` 打只读接口，区分「密钥在 OCI 侧已失效/被删」与「应用侧签名有 bug」。验收机就是部署机（出口公网 IP `168.110.110.153`，与日志里打印的 `Public Access` 同址），可直接在本机验证。

**解锁条件**：至少一个租户的 OCI 调用恢复 2xx。恢复后：批次二剩余项 → 批次三。

### 4.2 附带发现：应用反复重启

`application-2026-09-10.0.log` 里 `Started OciServerApplication` 出现 **40 次**（00:09 起，21:00–23:00 最密集）。建议单独排查是否为崩溃重启循环——它会让「改了 `.env` 但行为没变」这类问题难以定位。

---

## 5. 回归面（改动可能波及的地方）

> 标 ✅ 的是**静态可查、已补验**的；标 ⬜ 的必须人工点。

- [x] **R1** ✅ **静态通过** —— `downloadCsv(filename, columns, rows)`（`tenant-actions.jsx:28`）签名未变，
  租户费用统计导出调用点完好（L4706）。**审计导出已随「去掉」按钮一同删除**，`downloadCsv` 本身不受影响。
- [ ] **R2** ⬜ 其它走 `PageState` 的列表翻页/跳页正常（D1 只改了默认条数，未动逻辑）—— 需人工翻页
- [x] **R3** ⚠️ **静态部分通过** —— 邮件页 3 个列表的翻页 handler 齐全（`page-misc.jsx` L533/537 租户、
  L615/619 联系人、L724/727 记录，各含 `‹` / `›`）。**但**：只有租户列表有搜索框（`tenantSearch`），
  联系人/记录**没有筛选**；且三者的每页条数硬编码 6/8/8（见 §7.4）。翻页本身需人工点一下。
- [ ] **R4** ⬜ 租户列表页本身正常（本次未动，但 D1 的默认条数会影响它的首屏行数）—— 需人工看
- [ ] **R5** ⬜ 浏览器控制台 **0 error**（Web 各页）；Xcode 控制台无新增 warning —— 需人工看

---

## 6. 验收结果记录表

### 6.1 已完成（2026-09-11 · 接口层实测，验收人：阿枢）

> 方式：在部署机上用现有登录态直接调 `POST /tenants/audit/log`，逐项比对响应体。**UI 点击层未验**（需人工过 M1–M27）。
> M28–M33 是静态可验项，已在本节补验（见下方第二张表）。

| 编号 | 项 | 结果 | 实测证据 |
|:---|:---|:---|:---|
| — | **部署链自检**（§1.0） | ✅ | 部署前 jar/镜像均为 09-10 旧物；`mvn package` + 重建后容器内 jar 哈希与宿主机一致，`consoleSessionId` 命中 4 个类 |
| M43 / M45 / M46 | A2 mock 标记与形态 | ✅ | 响应 `data` 为 `OciPageResult` 形态（非裸数组），`mock:true`，8 行；日志有「审计日志查询结果为空，返回演示数据」 |
| A3 覆盖（M14/M15/M17 的数据侧） | 2xx / `-` 判定数据 | ✅ | 8 行状态码 = 200/200/200/**201**/**204**/404/500/**`-`**，覆盖全部判定分支 |
| B1（M6/M7 的数据侧） | 环境判据 | ✅ | 按 `consoleSessionId` 正确分为 5 行控制台 / 3 行 API；8 行 `userType` 全为 `natv`（证明 authType 判不了来源） |
| B2（M10/M11 的数据侧） | 短名 + 完整类型 | ✅ | `eventType` 为短名、`eventFullType` 为完整类型，两字段并存 |
| M40 | A1 超 90 天 | ✅ | `success:false` / `code:400` /「日期范围不能超过 90 天（当前 619 天）」，**未回退 mock** |
| M41 | A1 格式非法 | ✅ | `code:400` /「日期格式不正确，应为 yyyy-MM-dd」 |
| M42 | A1 顺序颠倒 | ✅ | `code:400` /「结束日期不能早于开始日期」 |
| — | A1 不存在的日期 `2026-02-31` | ✅ | `code:400` /「日期格式不正确，应为 yyyy-MM-dd」 |
| M47 / M49 | A4 异常不再被吞 | ✅ | mock 关后同一 401 返回 `success:false` / `code:500` /「审计日志查询失败：查询审计日志失败（OCI 返回 401）：…」；日志有 `IllegalStateException` 栈 |
| M53 | 90 天边界（§7.1 修复） | ✅ | 闭区间 90 天放行（走到 OCI 调用）、**91 天拒绝**「当前 91 天」——与两端口径一致 |
| M8（hover 内容） | 环境 hover 三段结构 | ✅ | 见 §7.2：**已修**（原 Web 少 `consoleSessionId`），修后控制台行带、API 行不带，与客户端一致 |
| — | **i18n key 完整性** | ✅ | 审计抽屉引用的 **36 个 `tr()` key 在 zh / en 块中全部存在**（缺 key 会直接渲染成 `audit.xxx` 字面量） |
| — | **行派生逻辑（真实代码跑真实响应）** | ✅ | 从源码**逐字抽出** `loadLogs` 里的 `list.map` 派生块，在 Node 里对真实响应执行：8 行的 `env` / `envKind` / `status` / `code` **与预期逐项一致**（201/204→成功、`-`→未知、envKind 按 `consoleSessionId` 分流） |

**批次一 · 静态可验项（M28–M33，不需要浏览器，2026-09-11 补验）**

| 编号 | 项 | 结果 | 实测证据 |
|:---|:---|:---|:---|
| M30 | 每页条数档位 `10/20/50/100`，不出现 5 | ✅ | 共享 `Pagination` 组件（`ui.jsx:326`）`options={[10, 20, 50, 100]}`，无 `5` |
| M31 | `UI_STANDARD.md` §4.6 是唯一权威表 | ⚠️ | 形式通过（L571/L179 均声明唯一权威），**但内容失真**——原表写「全量核对通过」却只覆盖 macOS，见 §7.4 |
| M32 | `NEW_SESSION_CONTINUE.md` 不复制清单，只引用 | ⚠️ | 已去掉复制的清单表，**但仍在复述结论**（原 L32「12 个已对齐页面 + 2 个共享组件」、原 L33「4.6 已全量对齐」）——且 L33 是错的。已改为禁止复述，见 §7.4 |
| M33 | 全仓库「待对齐」只在 `UI_STANDARD.md` 出现清单 | ⚠️ | `NEW_SESSION_CONTINUE.md` 原 L26 仍是「## 待对齐（下一步）」**标题**（不是引用）。已改名为「对齐进度（不在此处维护清单）」 |
| **M28** | 实例/租户/区域/代理配置默认 **20** | ❌ **不通过** | Web 端 `InstancesPage` / `TenantsPage` / `RegionsPage` / `SysVpnProxyPage` **全部仍是 10**（另 `CFManagePage` / `EOManagePage` 干脆没有分页控件）；Windows 端 `TenantsView.cs:24` / `InstancesView.cs:36` 是 `PageSize = 10`。**D1 只改了 macOS 的 4 个 Swift ViewModel** |
| **M29** | 邮件页 5 个列表默认 **20** | ❌ **不通过（且比预期严重）** | `page-misc.jsx:124-126` 是**硬编码常量** `tenantPageSize = 6` / `contactPageSize = 8` / `recordPageSize = 8`——既不是 20，也不在 `sizeOptions` 内（违反 §4.2），且是 `const` 不是 state，用户**根本改不了**；该页还自绘 `‹ ›` 分页，不用共享 `Pagination` 组件 |

> **M28 / M29 小结**：**是真实缺陷，且不是审计日志改造引入的**——属 D1「分页标准对齐」只落了 macOS 一端。
> M31–M33 三项是**文档失真**，已在本轮修正。缺口全貌与选项见 §7.4。

**截图触发的新改动（2026-09-11 晚，已部署）**

| 编号 | 项 | 结果 | 实测证据 |
|:---|:---|:---|:---|
| — | **去掉「导出」按钮** | ✅ | `tenant-actions.jsx` 删除按钮与 `exportAudit`；i18n key `55405e`/`5680a4` 已清；部署后 curl 验证 served `tenant-actions.js` 无 `exportAudit` |
| — | **副标题优化**（`租户 · Audit Log · domain` → `租户 · 区域`） | ✅ | `tenant-actions.jsx` subtitle 改为 `<tenantLabel> · <auditRegion || '—'>`，与 macOS `TenantAuditLogView` 的 `displayName · region` 同构；`domain` 折进 hover title；部署后 verified |

**结论（审计日志改造本身）**：P0 四项（A1–A4）在接口层**全部验证通过**，且**全部在真实部署上跑的**，不是本地编译推断。**喂给渲染的派生逻辑也已用真实数据验证过**，所以剩下未验的只有「像素层」（颜色/hover 弹出/列宽/chips 高亮）——那是纯 CSS 与交互，风险低得多。

> **B1 的一个附带证据**：8 行数据的 `authType` **全是 `natv`**，而环境徽章分成「控制台 5 / API 3」。这正好用数据本身证明——**拿 `authType` 判调用来源是错的，只有 `consoleSessionId` 能分**。

### 6.2 待人工验收（2026-09-11 决策：老大自己过）

> 剩下的一律是**像素层 / 交互层**（颜色、hover 弹出、列宽、chips 高亮、按钮 loading），
> 数据与派生逻辑已在接口层验完（见 §6.1）。打开路径见 §2.0。

| 编号 | 项 | 批次 | 结果 | 备注 |
|:---|:---|:---|:---|:---|
| M1–M27 | 批次一 · UI 形态（B1–B5 / C1 C2 / A3 徽章） | 一 | ⬜ | 数据侧已验，**界面渲染需人工过**（徽章颜色 / hover / chips / 加载更多 / 列宽） |
| M34–M39 | A1 前端拦截（不发请求） | 一 | ⬜ | 后端侧已验（M40–M42），前端拦截需人工看 Network 面板 |
| M44 | mock 关时无演示横幅 | 二 | ⬜ | 需人工看界面 |
| M48 | 错误横幅「重试」按钮 | 二 | ⬜ | 需人工点击 |
| M50 | mock 开 + 失效租户 → 带标记演示数据 | 二 | ⬜ | 需人工看界面 |
| M51–M52 | A3 真实数据 2xx | 三 | ⏸ | 受阻于 401 |
| R1–R5 | 回归面 | 一 | ⬜ | 需人工过 |

> M28–M33（静态可验）**已补验完**，结论见 §6.1；其中 M28 / M29 判为真实缺陷，见 §7.4。

> **M20–M22 提醒**：mock 只有 8 行、单页返回，「加载更多」的追加行为需要多于 1 页的真实数据才能完整验（受 401 阻塞）。
> mock 下只能确认按钮/文案形态正确、单页时按钮不出现。

---

## 7. 验收中已发现、待你定夺的问题

### 7.1 ✅ 90 天上限 off-by-one —— 已修复（2026-09-11 决策：选 (a)）

**问题**：前后端对「90 天」的计数口径不一致。

- **前端**（Web `validateRange` + 客户端 `searchAudit`）：按**闭区间天数**算，`days = 日期差 + 1`，要求 `days ≤ 90`
- **后端**（`AuditLogUtils`）：按**日期差**算，`diffDays > 90` 才拒 → 实际允许闭区间 91 天

**实测边界**（修复前，`tenantId=2097153853430558720`）：

| 闭区间天数 | 前端 | 后端（修复前） |
|:---|:---|:---|
| 90 天（日期差 89） | ✅ 放行 | ✅ 放行 |
| **91 天（日期差 90）** | ❌ 拦下 | ✅ **放行** ← 差这一天 |
| 92 天（日期差 91） | ❌ 拦下 | ❌ 拦下，文案「当前 92 天」 |

后端文案用的是闭区间计数（`diffDays + 1`），而阈值判的是日期差——**文案与阈值不同源**。

**决策 (a)**：后端改成 `diffDays + 1 > 90`，与两端前端、以及后端自己的文案统一为「闭区间天数」。

**改动**：`oci-server/.../utils/oracle/AuditLogUtils.java` L176–186，`if (diffDays > 90)` → `if (diffDays + 1 > 90)`，并补注释说明口径。

**为什么选 (a)**：闭区间计数对用户更直观——选 1 月 1 日到 1 月 1 日是 1 天，不是 0 天。且前端无需改动，`days = 日期差 + 1` 的算法本身就是对的。

**修复后预期**：闭区间 90 天放行、91 天拒绝，前后端一致（详见 M36 / M53）。

### 7.2 ✅ 环境 hover 详情三端不一致 —— 已修（2026-09-11 验收中发现）

**问题**：环境列的 hover 详情，macOS 客户端是三段，Web 只有两段。

| | macOS 客户端 `TenantAuditLogEntry.envDetail` | Web（修复前） |
|:---|:---|:---|
| `authType=` | ✅ | ✅ |
| `UA=` | ✅ | ✅ |
| `consoleSessionId=` | ✅ | ❌ **缺** |

**为什么是缺陷**：环境徽章**就是靠 `consoleSessionId` 非空判出来的**。hover 里不显示这个判据，用户看到一个「控制台」徽章却找不到证据，说不通；而且两端 hover 内容不同，属三端对齐缺口。

**改动**：`static/modern-ui/src/tenant-actions.jsx` 的 `loadLogs` 派生块，`envDetail` 补第三段，顺序与客户端一致（authType → UA → consoleSessionId）。

**验证**：抽出改后的派生代码跑真实响应 —— 控制台行都带 `consoleSessionId=`、API 行都不带，8/8 符合。

### 7.3 已明确不做的事（验收时不要当缺陷报）

- **不给 `ListEventsRequest` 加 `limit`**：该参数不存在，每页条数由 OCI 服务端固定 → 审计日志**不设**每页条数选择器
- **不显示「共 N 条」/ 总页数**：OCI 不返回 total，禁止伪造
- **不做三态环境（控制台 / API / SDK）**：`authType` 取值未实测，官方无枚举，做三态会多出一档永不命中的分支
- **不改时间显示时区**：`Dockerfile.deploy` 与 `oci-pool.sh` 均固定 `TZ=Asia/Shanghai`，显示已是 +8
- **~~Web 审计 CSV 导出：不改造，保持原实现~~ → 已去掉**（2026-09-11 晚决策）：
  用户截图标记「去掉」→ `tenant-actions.jsx` 删除「导出」按钮、`exportAudit` 函数、对应 i18n key（`tenant.55405e`/`tenant.5680a4`）。
  macOS 客户端本就没有此功能，**现在两端一致都没有**。

### 7.4 ✅ D1 分页标准只落了一端 + 权威文档失真 —— 决策选 (d)，在案记录（2026-09-11 决策）

**这不是审计日志改造引入的**，是验收 M28–M33 时顺带挖出来的跨端缺口。

**事实**（都是代码实测，不是推断）：

| 端 | 实例 | 租户 | 区域 | 代理配置 | 邮件服务 | CF / EO |
|:---|:---|:---|:---|:---|:---|:---|
| macOS | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ |
| **Windows** | **10** ❌ | **10** ❌ | — | — | — | — |
| **Web** | **10** ❌ | **10** ❌ | **10** ❌ | **10** ❌ | **硬编码 6/8/8** ❌ | **无分页**（固定拉 100） ⬜ |

- macOS：`InstancesViewModel.swift` 等 8 处全是 `PageState(page: 0, size: 20)`
- Windows：`TenantsView.cs:24` / `InstancesView.cs:36` 是 `private const int PageSize = 10`
- Web：`InstancesPage` / `TenantsPage` / `RegionsPage` / `SysVpnProxyPage` 全是 10；
  `MailPage` 更严重——`tenantPageSize = 6` / `contactPageSize = 8` / `recordPageSize = 8` 是**硬编码 `const`**，
  既越界（不在 `[10,20,50,100]`）又不可调，且该页自绘 `‹ ›` 分页、不走共享 `Pagination`；
  `CFManagePage` / `EOManagePage` **根本没有分页控件**（直接 `{page:1, size:100}` 拉一批）

> 注：`page-proxy.jsx` 的 `ProxyPage` 未接入路由表，属遗留容器，不计入。

**根因**：`docs/audit-log-remediation-plan.md` 的 D1 实现记录只列了 4 个 **Swift** ViewModel
（`InstancesViewModel.swift` / `TenantsViewModel.swift` / `RegionsViewModel.swift` / `ProxyConfigViewModel.swift`），
**从没把 Web / Windows 纳入范围**；但 `UI_STANDARD.md` §4.6 当时写的是「**全量核对通过**」，
`NEW_SESSION_CONTINUE.md` 也跟着复述「4.6 已全量对齐」——**文档比实现走得远**。

**决策定夺：选择 (d) —— 先不动代码，缺口严格在案记录**：
- 零代码变更风险，不在本轮审计日志主线上横生枝节；
- 缺口已明确登记在 `UI_STANDARD.md` §4.6 权威表中（Web 标记 ⬜、Windows 标记 ⬜），后续单开批次按规范推进。

**已做（文档纠真已固化）**：
- `UI_STANDARD.md` §4.6：拆成 **macOS / Web / Windows 三张表**分别标状态，真实反映实际情况；
- `NEW_SESSION_CONTINUE.md`：禁止复述任何失真的「已全量对齐」结论，统一以 `UI_STANDARD.md` 为准。

### 7.5 ✅ 审计导出 —— 已去掉（2026-09-11 晚决策）

用户截图标记「去掉」→ Web 端「导出」按钮、`exportAudit`、对应 i18n key 全部删除。
macOS 客户端本就没有此功能。**现在两端一致都没有**。

| 端 | 审计日志导出 | 状态 |
|:---|:---|:---|
| Web | ❌ 没有 | `tenant-actions.jsx` 已删除按钮与函数；i18n key `55405e`/`5680a4` 已清 |
| macOS | ❌ 没有 | `TenantAuditLogView.swift` 从未实现 |

> **为什么去掉**：Web 的导出只能覆盖「当前已加载页」（审计接口是游标分页、拿不到全量），
> 容易被当成完整审计记录；不如不做，两端一致反而干净。
> `downloadCsv` 仍被租户费用统计导出复用，保留不动。

---

## 附：验收用的关键代码位置

| 项 | 位置 |
|:---|:---|
| 日期校验（后端） | `oci-server/.../utils/oracle/AuditLogUtils.java` L170–182 |
| 异常不吞（后端） | 同文件 L119–127；`TenantServiceImpl.queryAuditLogs` 的 catch 分支 |
| mock 标记（后端） | `TenantServiceImpl.mockAuditPage()`；`OciPageResult.mock` |
| 日期校验（Web） | `tenant-actions.jsx` → `useAuditDrawer.validateRange()` |
| 环境判据（Web） | 同文件 `loadLogs` 内 `consoleSession` → `envKind` |
| 日期校验（客户端） | `TenantsViewModel.swift` L1062–1090、`isValidAuditDate` L1179 |
| 环境判据（客户端） | `TenantsModels.swift` `isConsoleSession` / `envLabel` / `envDetail`（L895–914） |
| 页面状态全集 | `docs/mockups/audit-log-states.html` |
