# 待真实数据后补做的验收清单（Deferred Acceptance Checklist）

> 记录时间：2026-09-03 · 项目：Modern UI 迁移（主实施计划 `docs/superpowers/plans/2026-09-01-modern-ui-migration-master-plan.md`）
> 状态：方案 1 —— **不伪造后端数据**，把依赖真实 OCI 实例/开机任务的点击验收如实标记为 `blocked`，待有真实数据后补做。

---

## 为什么会有这份清单

当前前端迁移在**不依赖真实 OCI 实例/开机任务**的范围内已经闭环：

- Task 1–5、8、9 已完成并验收。
- Task 6/7 的代码、接口、字段、路由、Mock 清理均已通过（137/137 Node、Maven 5/5、方式 1 部署）。
- Task 10 的 mock 清理、全量 gates、方式 1 部署、逐路由加载/空态/错误态验收、契约 273 全 `connected` 均已通过。

**唯一无法完成**的是：几个必须在**真实后端返回的实例/开机任务记录**上才能成立的“真实数据点击验收”。由于当前后端 `/oci/list/json` 返回 0 条实例、开机任务列表返回 0 条，且用户确认当前无法提供真实 OCI 数据，因此**不伪造数据**（伪造会造成 SSH/SFTP/VNC/启停/终止触发真实 OCI 调用，甚至让抢机调度对真实 OCI 账号发起会产生费用的创建实例，同时违背 Task 10 清理未验证数据的目标）。

---

## 何时可以补做

当满足下列任一条件时，回到这份清单逐项补跑：

1. 后端真实存在 OCI 实例记录（`/oci/list/json` 能返回行）。
2. 后端真实存在 `BootInstance` 开机任务记录（开机任务列表能返回行）。

> 注意：不要用停应用 + 直接改 H2 库伪造记录来“凑数据”；这会触发真实云操作，也拿不到真实字段/状态，不属于有效验收。

---

## 补做验收清单

### Task 6：实例列表与操作（真实实例行）

**前提**：`/#/instances`（或 `/#/instances?tenantId=<id>&regionId=<id>`）能加载出真实实例行。

- [ ] 实例列表：真实行渲染，`CPU/内存` 来自后端 `cpuAndMem`、`创建时间` 格式为 `yyyy-MM-dd`、列字段（租户名、区域、状态、公网 IP、架构等）来自后端字段。
- [ ] 分页：`page/size` 由路由携带，深链刷新/Back/Forward 保持。
- [ ] 租户/区域级联：选择父租户后区域下拉才根据真实子租户出现，区域 id 作为 `tenantId` 查询；多区域时出现快速搜索框。
- [ ] 当前筛选标签：未选筛选时固定在顶部，匹配条数来自后端。
- [ ] 实例操作菜单逐项：备注、名称、配置、引导卷、VPU、快速 DD、系统备份、IPv6、切换 IP、SSH、SFTP、VNC、启动/停止、终止、导出。
- [ ] SSH 终端：配置加载 (`/oci/ssh/config/{instanceId}`)，成功配置后连 `/ws/ssh`，输入/调整大小走真实通道。
- [ ] SFTP：上传 `/oci/sftp/upload`、下载 `/oci/sftp/download`（含 `Content-Disposition` 文件名）。
- [ ] VNC：`/ws/console` 建连带 `connectionType: vnc`、30s heartbeat、关闭时 `disconnect`。
- [ ] 破坏性操作：启动/停止/终止/删除等**到最终确认弹窗为止**（确认前不真实执行）。
- [ ] 控制台 error 0。

### Task 7：开机/区域/监控/日志（真实开机任务行）

**前提**：开机任务列表能返回真实 `BootInstance` 行。

- [ ] `/#/grab` 与租户开机页：真实任务行渲染，字段（租户、区域、shape、磁盘、架构、抢机次数/成功/失败、状态）来自后端。
- [ ] 任务详情：打开详情抽屉，加载真实字段/状态。
- [ ] 任务操作：编辑、克隆、单次执行、启停、删除 —— 到最终确认弹窗为止。
- [ ] `/#/regions` 区域监控：按 `lastNotifyTime`（最近开机时间）从近到远排序，未知时间（—）固定最后；总区域/ARM 区域/今日新开机来自后端。
- [ ] `/#/monitor` 与 `/#/boot-logs`：真实后端指标/日志/SSE，不显示打包模拟数据或定时器伪成功。
- [ ] 控制台 error 0。

### Task 10：真实数据破坏性点击（发布闸门）

- [ ] 在补完 Task 6/7 的真实数据点击验收后，将 Task 10“逐路由验收中真实数据破坏性点击”从 `blocked` 解锁。
- [ ] 重新确认契约矩阵无 `mock/unknown-field/unverified-id/unverified/manual-review` 行（当前已有，273 全 `connected`）。
- [ ] 走 Task 10 发布确认 → Task 11 旧前端下线（需先完成 `docs/modern-ui-legacy-decommission-matrix.md` 等）。

---

## 已完成、无需重做（供参考，避免重复验证）

- ✅ Node 套件 `137/137` 通过。
- ✅ Maven `mvn -pl oci-server -am test` → 5/5；`package -DskipTests` → BUILD SUCCESS。
- ✅ 方式 1（docker cp + restart）部署成功，`oci-pool-modern` healthy。
- ✅ 逐路由加载/空态/错误态浏览器验收（monitor/tenants/instances/regions/grab/notifications/security/proxy/keys/developer/tokens/ai/cloudflare/edgeone/system-proxy/object-storage/mail/memos/boot-logs/login）全部渲染、控制台 error 0。
- ✅ Mock 清理：`data.jsx` 已移除全部业务 fixture，仅保留 `REGIONS/REGION_MAP` 与字段访问器/认证 helper；`index.html` 缓存版本 `data.jsx?v=10`。
- ✅ 契约清单 `modernRequestCount=31`、`modernRequestCountAll=273`、statusSummary 全 `connected`。

---

## 主实施计划状态（已记录）

| Task | 状态 |
|---|---|
| 1–5、8、9 | ✅ completed |
| 6 | ⏸ in_progress / 真实数据点击验收 `blocked` |
| 7 | ⏸ in_progress / 真实数据点击验收 `blocked` |
| 10 | 🔄 in_progress（其余 gates 通过，发布闸门被 Task 6/7 真实数据点击验收阻塞） |
| 11 | ⬜ pending |

