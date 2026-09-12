# 待优化事项（Pending Optimizations）

> 记录已识别但暂缓实施、不影响当前功能逻辑的优化点。实施前请先阅读「影响评估」，确认是否改变功能行为。

---

## 1. 磁盘管理弹窗数据加载耗时优化

**状态**：待优化（暂缓）
**日期**：2026-09-10
**涉及**：`oci-server` 后端

### 现象

打开「硬盘信息 / 磁盘管理」弹窗耗时较长（数秒级）。

### 根因

磁盘管理数据是**实时调用 OCI API**，无缓存。后端 `TenantServiceImpl.getAllBootVolumes(tenantId)`（`oci-server/src/main/java/com/doubledimple/ociserver/service/impl/TenantServiceImpl.java` 约 1816 行）的数据链路：

1. `OciUtils.getAllCompartmentIds(tenant)` —— 一次 OCI `listCompartments`（`compartmentIdInSubtree(true)`，递归列出所有子 compartment），返回「根 compartment + N 个子 compartment」。
2. `for (compartmentId : allCompartmentIds)` —— **串行**遍历每个 compartment，逐个调用 `listBootVolumes`。
3. 每个引导卷再逐条查本地 DB：`oracleInstanceDetailRepository.findByBootVolumeId(...).stream().findFirst()`（N 次单条查询）。

因此总耗时 ≈ 1 次列 compartment + N 次列引导卷，全部**串行跨公网**到 OCI，再叠加 N 次本地 DB 单条查询。compartment 数量越多越慢。

### 候选优化方案（按「是否改变功能逻辑」分类）

#### 不改变功能逻辑（推荐优先）

**方案 1：并行化 compartment 循环**
- 将 `for (compartmentId : allCompartmentIds)` 串行循环改为并行（线程池 / `parallelStream`）。
- 输入输出一致：仍是同一批 compartment、同样过滤（仅 `Available`）、同样映射。
- 注意点：
  - **OCI SDK client 线程安全**：`BlockstorageClient` 内部关键状态为 `final`/`volatile`，请求方法只读共享状态，**本身支持并发调用**。但它是 `AutoCloseable`，用 try-with-resources 管理。
  - **推荐实现**：共享一个 client、外层统一 `close()`，子线程只调用不 close：
    ```java
    try (BlockstorageClient client = BlockstorageClient.builder().build(provider)) {
        List<BootVolumeRes> all = allCompartmentIds.parallelStream()
            .map(cid -> client.listBootVolumes(ListBootVolumesRequest.builder()
                    .compartmentId(cid).build()))
            .flatMap(r -> r.getItems().stream())
            .filter(bv -> BootVolume.LifecycleState.Available.equals(bv.getLifecycleState()))
            .map(...)
            .collect(Collectors.toList());
    }
    ```
    （避免「每个任务各建一个 client」导致的 N 个线程池/连接池资源膨胀）
  - **provider 的 `privateKeySupplier` 每次须返回新的 InputStream**，否则并发签名会共用流出错。
  - 并行后结果**顺序可能与串行不同**；当前客户端与 Web 均未对磁盘列表排序，故不影响展示。

**方案 4：本地 DB 查询批量化**
- 将循环内逐条 `findByBootVolumeId` 改为先收集全部 bootVolumeId，一次 `IN (...)` 查询后在内存匹配。
- 语义等价：需保持「每个 bootVolumeId 取第一条（`findFirst`）」的行为不变。

#### 会改变功能逻辑（需业务确认后再实施）

**方案 2：结果缓存**（⚠️ 改变实时性）
- 对 `getAllBootVolumes` 结果加短期缓存（如 30–60s）。
- 影响：弹窗不再「打开即实时」，用户在 OCI 控制台或其他端修改后可能看到旧数据；需配合写操作（保存/删除 VPU）后主动失效。

**方案 3：减少 compartment 扫描**（⚠️ 可能漏数据）
- 若去掉 `compartmentIdInSubtree(true)` 或只查根 compartment，会**漏掉子 compartment 中的引导卷**，功能退化。仅在确认业务只需根 compartment 时可用。

### 建议实施顺序

1. 先加**计时日志**（分别记录「列 compartment」「逐 compartment 列引导卷」「DB 查询」各阶段耗时），实测确认瓶颈。
2. 优先实施方案 **1（并行化）**，若 DB 查询占比可观再叠加方案 **4**。
3. 方案 2 / 3 需先确认实时性/完整性要求，不应贸然实施。

### 验证要点

- 数据完整性：迁移前后同一租户返回的引导卷集合一致（数量与内容）。
- 性能：打开弹窗耗时下降（对比计时日志）。
- 功能不回归：保存 VPU、删除引导卷后 `reloadVolumes` 仍能拿到最新数据。
