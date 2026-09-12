# UI 标准（UI Standard）

> **本文档是项目内表格、操作弹窗、下拉选择框、分页、表单校验与按钮禁用的统一标准。** 后续新增其它统一标准，按章节在本文件追加。
> 标准实现可对照：实例（`InstancesView.swift`）、开机管理（`BootView.swift`，**以此为准**）、租户管理（`TenantsView.swift`）；分页见 `Common/Components/PaginationBar.swift` + `Common/Models/PageState.swift`。
>
> 各章「已对齐」清单：已对齐的页面不必重做；新页面照对应章节对齐即可。

---

## 第一章 · 数据列表标准（表格布局 / 滚动 / 居中 / 行交互）

适用于所有数据列表页（实例、开机、租户、区域等）。标准实现以 `InstancesView.swift` 和 `TenantsView.swift` 为准。

### 1.1 列表滚动与表头固定结构（核心架构）

> ⚠️ **曾踩坑**：禁止使用单一的 `ScrollView([.horizontal, .vertical])` 同时包裹表头与数据，否则用户向下滚动数据时，**表头会被一起滚上去导致看不到列名**！

**标准架构**：
- **表头固定在顶部**（位于外层 `VStack` 顶部，不进入垂直 `ScrollView`）。
- **数据行独立垂直滚动**（仅数据包裹在 `ScrollView` + `LazyVStack` 内）。
- **按需横向滚动**：当计算出的总列宽 `totalW > geo.size.width` 时，外层仅套一层 `ScrollView(.horizontal)`。

```swift
GeometryReader { geo in
    let totalW = max(geo.size.width, baseFixedColsWidth)
    let needsHScroll = totalW > geo.size.width + 0.5

    let table = VStack(spacing: 0) {
        // 1. 表头固定在最顶部（不随数据垂直滚动）
        headerRow(cols: cols, width: totalW)

        // 2. 仅数据行进入垂直 ScrollView
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                    dataRow(index: idx, item: row, cols: cols, width: totalW)
                }
            }
        }
    }
    .frame(width: totalW, height: geo.size.height, alignment: .topLeading)

    // 3. 仅在列总宽超出屏幕时才包裹外层水平滚动
    Group {
        if needsHScroll {
            ScrollView(.horizontal, showsIndicators: true) { table }
                .frame(width: geo.size.width, height: geo.size.height)
        } else {
            table
        }
    }
}
```

---

### 1.2 表头 `colHeader`

表头必须默认水平居中，签名规范：

```swift
private func colHeader(_ title: String, _ width: CGFloat, align: Alignment = .center) -> some View {
    Text(title)
        .font(.system(size: 11, weight: .semibold))
        .foregroundColor(AppTheme.sidebarText(dark))
        .lineLimit(1)
        .frame(width: width, alignment: align)   // 默认 .center —— 禁止传 .leading
        .clipped()
}
```

**规则**：
- 所有列头默认 `.center`，操作列（如「操作」）也使用 `.center`。
- 弹性列（`colFlexible`）即使占满剩余宽度，文字也需在列内 `.center` 居中（避免偏左失衡）。

---

### 1.3 单元格 `cell` / `cellText`

```swift
private func cellText(_ text: String, _ width: CGFloat, muted: Bool = false) -> some View {
    Text(text)
        .font(.system(size: 12))
        .foregroundColor(
            muted
                ? AppTheme.sidebarText(dark)
                : (dark ? Color.white.opacity(0.9) : Color.primary)
        )
        .lineLimit(1)
        .truncationMode(.tail)
        .frame(width: width, alignment: .center)   // 必须 .center 居中
        .clipped()
        .help(text)                                 // hover 必须显示完整文本（对齐 Web tooltip）
}
```

**规则**：
- 单元格固定列宽 `.frame(width: width, alignment: .center)`，保证内容垂直与水平皆对齐表头。
- `.lineLimit(1)` + `.truncationMode(.tail)` 单行超长截断省略。
- `.help(text)` 补齐完整内容（防被截断看不全）。

---

### 1.4 操作列按钮居中与防拉伸规则

操作列中的「⋯」更多操作按钮：

```swift
actionBar(item)
    .frame(width: wAction, alignment: .center)   // 外层容器撑满列宽并居中
```

> ⚠️ **曾踩坑**：
> - 按钮本体必须**固定 28×28**，绝对不能被外层列宽拉伸！
> - 如果直接写 `.frame(width: max(colWidth, 28), ...)` 会把按钮本体撑成几十像素宽的长方形方块！
> - 正确方式：按钮内部固定 28×28（`NSViewRepresentable` 内外均设 28×28），外层用列宽 `wAction` 容器包裹并设置 `alignment: .center` 水平居中。

---

### 1.5 列表行 Hover 高亮与斑马纹叠加

列表行必须支持鼠标悬停高亮，且与斑马纹叠加：

```swift
let hovered = hoveredRowId == item.id

dataRow(...)
    .background(
        hovered
            ? AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08)  // 悬停时淡蓝/主题色高亮
            : ((index % 2 == 1)
               ? AppTheme.sidebarHover(dark).opacity(0.18)        // 非悬停时保留斑马纹
               : Color.clear)
    )
```

---

### 1.6 列表行 Hover 防操作弹窗穿透规则（重要防坑）

> ⚠️ **重大交互陷阱**：
> macOS SwiftUI 中，当操作弹窗（`NSHostingView`）浮层盖在列表上方时，用户在弹窗内悬停移动鼠标，**底层列表行的 `.onHover` 依然会被系统事件穿透触发**，导致操作弹窗浮层下方的列表行也跟着乱闪高亮！

**必须遵守的规避规范**：
所有数据列表行的 `.onHover` 内，**必须在第一行主动检查对应操作弹窗的打开状态**，弹窗开启时直接 `return` 拦截：

```swift
.onHover { inside in
    // 弹窗浮层打开时，直接拦截不响应列表行 hover，防止弹窗悬停时底层列表误高亮
    if XxxActionMenuPresenter.shared.isPresented { return }

    withAnimation(.easeInOut(duration: 0.12)) {
        hoveredRowId = inside ? item.id : (hoveredRowId == item.id ? nil : hoveredRowId)
    }
}
```

---

### 1.7 列表状态点标准（`MenuPulseDot`）

列表中（如实例名称列旁、开机任务状态列旁）的状态指示圆点：
- **禁止**使用裸的 `Circle()` 或任意 6pt/7pt 尺寸。
- **统一使用 `MenuPulseDot`**（位于 `Common/Components/StatusBadge.swift`）：
  - 尺寸统一固定为 **5pt**。
  - 运行中 / 活跃状态时 `pulse = true`（带 0.72~1.0 缩放、0.55~1.0 透明度呼吸脉冲动效，对齐 Web `StatusDot`）。
  - 停止 / 离线状态时 `pulse = false`（静态圆点）。

```swift
MenuPulseDot(color: statusColor(item), pulse: item.isRunning)
```

---

### 1.8 数据列表加载态（Loading）与生命周期防闪烁铁律（杜绝全屏大遮罩与旧数据共存）

> ⚠️ **曾踩坑**：
> 1. **首屏切入抹除表头**：使用 `if isLoading && rows.isEmpty` 直接用空白转圈 View 替换整个表格卡片，导致**表头被整个抹掉**；数据加载出来时表头突然弹现，造成严重的**视觉跳动（Jitter）**！
> 2. **粗暴全局大遮罩**：在最外层容器（含筛选条、KPI 统计卡）挂载 `.appLoading(...)`，导致二次筛选时**整个屏幕 80% 区域（连带顶部筛选条和 KPI 卡）全部被厚重的半透明蒙层覆盖**，视觉极为突兀粗糙！
> 3. **原有数据与 Loading 双态共存（重大视觉混乱）**：点击「刷新」或切换租户时，旧数据依然留在列表上，底层挂着半透明或者浮动转圈框，形成“旧数据与 Loading 同时挂在屏幕上”的脏数据残留！
> 4. **幽灵空态闪现（Flash of Empty State）**：组件刚挂载第 1 帧由于异步请求尚未发出，误判 `rows.isEmpty` 瞬间闪现「暂无数据」，第 2 帧又跳成 Loading，形成“无数据 → Loading → 有数据”的时序倒挂！

**必须遵守的前后端统一 6 大铁律**：

1. **表头骨架永久置顶常驻（首屏切入零跳动）**：
   - 表头（Header Row）始终固定在表格卡片最顶端（原生端独立 HeaderRow 外置，Web 端 `thead { position: sticky, top: 0, zIndex: 1 }`）；
   - 无论是首屏切入、切换租户、还是原地刷新，**表头绝对不消失、不隐藏、不替换**。数据行到达后自然平滑填入表头下方，杜绝任何布局抖动。

2. **Loading 范围严格收敛在「表格内部」**：
   - 严禁在外层容器挂载全局 `.appLoading` 大蒙层；
   - 顶部的「筛选状态条」与「KPI 指标卡」属于页面元信息，在加载过程中必须**始终保持清晰可见，绝不被遮挡**。

3. **旧数据与 Loading 严禁共存原则（立即清空）**：
   - **核心规范**：无论是用户主动点击「刷新」按钮、切换筛选条件、还是切换租户/区域等主体，**在触发加载的第一行代码必须立即清空旧数据（`rows = []` / `setRows([])`）并开启 `loading = true`**；
   - 表体内**绝不允许残留上一屏的任何旧数据行**（杜绝半透明 0.6 旧行与转圈同时并存的视觉混乱）；
   - 表体必须呈现**整表高度垂直与水平居中的纯净专属 Loading 状态**（旋转指示器 + `正在加载...`）；数据请求成功返回后，再将新数据填入表体，干脆利落。

4. **杜绝首屏幽灵空态闪现（`hasLoadedOnce` 状态机守卫）**：
   - 在状态机中声明 `hasLoadedOnce = false`（首次真实请求完成置 `true`）；
   - 空状态（`EmptyStateView` / `<EmptyState />`）严格受守卫约束：**仅在 `hasLoadedOnce && !isLoading && rows.isEmpty` 时才允许展示**；
   - 首次加载完成前（`!hasLoadedOnce`）强制展示置顶表头 + 居中 Loading，严禁闪现空状态！

5. **切换父级筛选主体时即刻进入 Loading（杜绝拉取选项期间空态闪现）**：
   - 用户切换父级租户时，往往需要异步拉取子级区域列表（`listRegions`）。在发起子级请求的第一瞬间，**必须在清空旧数据（`rows = []` / `setRows([])`）的同时，同步执行 `isLoading = true`**；
   - 保证在拉取子级选项乃至发起真实数据请求的全周期中，表体始终处于 Loading 态，绝不给空态任何抢跑机会！

6. **错误横幅状态生命周期闭环（杜绝报错死锁滞留）**：
   - 在用户主动触发切换实体（如 `onTenantChanged`）、重新加载、点击刷新等方法头部，**第一时间执行 `errorText = nil / ''`**，绝不把上一个租户的错误残留在新租户界面上；
   - 数据成功返回后确保清空错误；错误横幅右侧除「重试」外，必须提供「关闭（`xmark`）」按钮，允许用户获知后主动关闭。

**标准实现模板**：
```swift
let table = VStack(spacing: 0) {
    // 1. 表头置顶常驻，无论加载还是空态始终可见，结构骨架稳定零抖动
    headerRow(cols: cols, width: totalW)

    // 2. 表体内容区（数据行 / 空态 / 加载态）
    ZStack {
        // 首次未加载完成或加载中且数据为空：直接展示居中 Loading，杜绝空态闪现
        if (!model.hasLoadedOnce || model.isLoading) && model.rows.isEmpty {
            VStack(spacing: 10) {
                Spacer()
                ProgressView()
                Text("正在加载实例数据…")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if model.rows.isEmpty {
            EmptyStateView(...)
        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                        dataRow(...)
                    }
                }
            }
            .opacity(model.isLoading ? 0.6 : 1.0)
        }

        // 原地翻页/刷新时：仅在表体中央浮现微型轻量指示器（绝不遮罩全局 KPI 和筛选栏）
        if model.isLoading && !model.rows.isEmpty {
            VStack(spacing: 8) {
                ProgressView().scaleEffect(0.9)
                Text("更新中…")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark).opacity(0.85)))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
            .shadow(color: Color.black.opacity(dark ? 0.3 : 0.08), radius: 6, y: 2)
        }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
}
```

---

### 1.9 筛选联动与单选项默认选中即查标准

> ⚠️ **曾踩坑**：用户选择租户后，接口返回该租户仅有 1 个可用区域（如仅有「凤凰城」）。代码自动将区域下拉框赋值为该区域，**却未触发任何数据查询**！导致下拉框显示已选，下方列表却依然展示全量实例，用户必须手动再点一次「查看实例」才能过滤，极不符合直觉。

**必须遵守的联动规范**：
1. **单选项自动触发查询**：
   - 当上级实体（如租户）改变，拉取下级选项（如区域）且判定 `options.count == 1` 时；
   - 下拉框自动选中唯一项的同时，**必须立即自动调用 `applyFilter()` / 发起查询**；
2. **下拉项变更即选即查**：
   - 手动在下拉菜单中切换具体选项时，同样应即刻触发过滤查询；
3. **清空上级筛选时自动重置**：
   - 清除租户选择时，自动置空过滤条件并重置为全量数据加载。

```swift
func onParentChanged(_ parentId: String?) {
    selectedParentId = parentId ?? ""
    selectedRegionId = ""
    regions = []
    if selectedParentId.isEmpty {
        filterTenantId = nil
        pageState.page = 0
        rows = []                          // 1. 立即清空，避免残留旧数据
        isLoading = true                   // 同步置为 loading，防空态闪现
        Task { await reload() }
        return
    }
    rows = []                              // 2. 切换主体即刻卸载旧数据
    pageState.page = 0
    isLoading = true                       // 关键！在拉取子级选项前同步进入 loading 态
    Task {
        do {
            let list = try await service.listRegions(parentId: selectedParentId)
            regions = list.sorted { ... }
            // 3. 仅一个选项时自动选中并联动触发筛选查询
            if regions.count == 1 {
                selectedRegionId = regions[0].id
                applyFilter()              // 立即联动查询！
            } else {
                isLoading = false
            }
        } catch {
            isLoading = false
        }
    }
}
```

---

### 1.10 已对齐页面清单

> **范围说明**：本清单只覆盖**第一章**（表格布局 / 滚动 / 居中 / 行交互 / Loading 与联动）的落实情况。
> 分页相关的对齐状态见 **4.6**；两处清单职责不同，不要互相引用。
> 全项目「已对齐 / 待对齐」的**唯一权威**是 `UI_STANDARD.md` 本身，其它文档只引用、不复制。

- 实例列表（`InstancesView.swift`，已落实 1.1~1.9 全部标准，表头置顶常驻 + 表体纯净 loading + 单区域自动联动筛选）
- 开机管理（`BootView.swift`，已落实 1.1~1.9 全部标准，表头置顶常驻 + 表体纯净 loading + 解除全屏大遮罩 + 单区域自动联动筛选）
- 租户管理（`TenantsView.swift`，已落实 1.1~1.9 全部标准，表头置顶常驻 + 表体纯净 loading + 搜索即刻清空旧数据 + 杜绝幽灵空态）
- 区域管理（`RegionsView.swift`，已落实 1.1~1.9 全部标准，表头置顶常驻 + 居中 Loading + 杜绝幽灵空态）
- 对象存储（`StorageView.swift`，已落实 1.1~1.9 全部标准，解除全屏大遮罩 + 桶与对象独立表头置顶 + 表体纯净 loading + 错误生命周期闭环）
- 邮箱服务（`EmailView.swift`，已落实 1.1~1.9 全部标准，解除全局大遮罩 + 子列表平滑切换 + 杜绝幽灵空态）
- 代理配置（`ProxyConfigView.swift`，已落实 1.1~1.9 全部标准，解除卡片遮罩 + 居中 loading + 错误支持关闭）
- Cloudflare（`CloudflareView.swift`，已落实 1.1~1.9 全部标准，全量拉取全类型记录 + 列宽居中严格对齐 + 记录类型筛选 + 解除卡片遮罩）
- EdgeOne（`EdgeOneView.swift`，已落实 1.1~1.9 全部标准，解除卡片遮罩 + 双列表表体纯净 loading + 错误支持关闭）
- 审计日志（`TenantAuditLogView.swift`，已落实 1.1~1.9 全部标准，全列居中 + 表头置顶常驻 + 游标加载更多）
- 费用统计（`TenantCostView.swift`，已落实 1.1~1.9 全部标准，标准面包屑 + 消除底部空白 + 统一 Loading 动效 + 杜绝空态闪现）
- 账号配额（`TenantQuotaView.swift`，已落实 1.1~1.9 全部标准，标准面包屑 + 标准数据大卡片 + 固定表头 + 解除全屏遮罩 + 独立滚动 + 行 hover + 分页底栏）
- 用户管理（`TenantUserManageView.swift`，全列与操作列居中）
- 区域订阅（`TenantRegionSubView.swift`，全列居中）
- 共享组件：`DataListColumnHeader` 默认居中覆盖所有 DataList 页面；`AppSheetTableHeader` 默认居中覆盖所有租户弹窗内表格。

---

## 第二章 · 操作弹窗标准（Action Menu Standard）

> 开机管理（`BootActionMenu*`）是**标准实现**，实例（`InstanceActionMenu*`）、租户（`TenantActionMenu*`，含租户详情）已对齐本标准。
>
> **标准依据**：Content 以 **Boot Swift 端 `BootActionMenuContent` 为准**（它已把 Web `RowActionMenu` 的视觉翻译成 Swift `AppTheme` token 体系）。不直接用 Web DOM 的数值（Web hover=`var(--bg-2)` 灰，Boot 落地为 `sidebarActive` 绿等，属正常 token 化差异）。

标准实现文件：
- 开机：`oci-pool-mac/OciPool/Features/Boot/BootView.swift`（**以此为准**）

### 2.1 操作按钮（"..." 按钮）

| 项 | 值 |
|----|----|
| 尺寸 | **28 × 28** |
| 图标 | `ellipsis`（横三点，SF Symbol） |
| 圆角 | **4**（`layer.cornerRadius = 4`） |
| 背景 | 深色 `NSColor(0.17,0.19,0.21)` / 浅色 `NSColor(0.93,0.95,0.96)`（`layer.backgroundColor`） |
| 边框 | 1px（深色 `white 0.12` / 浅色 `black 0.08`） |
| 图标色 | 深色 `white 0.9` / 浅色 `labelColor`（`contentTintColor`） |
| bezel | `.shadowlessSquare`；`isBordered=false`；`setButtonType(.momentaryChange)` |

按钮是 `struct XxxActionMoreButton: NSViewRepresentable`，`makeNSView` 按上表构造 `NSButton`。

### 2.2 点击之后的背景色（重点）

打开弹窗时按钮背景**变主题绿**；关闭时恢复原背景。
用 `@MainActor` 的 `Presenter` 保存 `activeButton` + `activeDark`，方法：

```swift
private func setButtonHighlight(_ button: NSButton, highlighted: Bool, dark: Bool) {
    guard let layer = button.layer else { return }
    let accent = NSColor(AppTheme.sidebarActive)   // 主题绿（跟随主题）
    if highlighted {
        layer.backgroundColor = accent.cgColor
        button.contentTintColor = .white
    } else {
        layer.backgroundColor = (dark
            ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
            : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
        button.contentTintColor = dark ? NSColor.white.withAlphaComponent(0.9) : NSColor.labelColor
    }
}
```

调用点：
- `toggle()` 里：`activeButton = button; activeDark = dark; setButtonHighlight(button, highlighted: true, dark: dark)`
- `dismiss()` 里：`if let btn = activeButton { setButtonHighlight(btn, highlighted: false, dark: activeDark); activeButton = nil }`

### 2.3 弹窗位置（panelFrame，对齐 Web）

```swift
static func panelFrame(button: NSView, in container: NSView, itemCount: Int) -> NSRect {
    let ideal = idealHeight(itemCount: itemCount)
    let btn = button.convert(button.bounds, to: container)
    let bounds = container.bounds
    var h = min(ideal, bounds.height)
    h = max(minHeight, h)

    // 菜单右缘对齐按钮右缘；下方 6px 缝隙；下方放不下翻到上方。
    var x = btn.maxX - width
    if x < bounds.minX { x = bounds.minX + margin }
    if x + width > bounds.maxX { x = bounds.maxX - width - margin }

    let spaceBelow = btn.minY - bounds.minY      // 非 flipped，小 y 为下
    let spaceAbove = bounds.maxY - btn.maxY
    var y: CGFloat
    if spaceBelow >= h + gap { y = btn.minY - gap - h }
    else if spaceAbove >= h + gap { y = btn.maxY + gap }
    else { y = max(bounds.minY + margin, btn.minY - gap - h) }
    y = max(bounds.minY + margin, y)
    if y + h > bounds.maxY - margin { y = bounds.maxY - margin - h }

    return NSRect(x: x, y: y, width: width, height: h)
}
```

### 2.4 弹窗布局常量（`XxxActionMenuLayout`）

| 常量 | 值 |
|------|----|
| `width` | **280** |
| `vPad` | 8 |
| `titleH` | 20 |
| `gridGap` | **1**（2 列小间距） |
| `rowH` | 30 |
| `cols` | 2 |
| `margin` | 10 |
| `minHeight` | 140 |
| `gap` | 6 |

### 2.5 弹窗内容（`XxxActionMenuContent`）

**header**（顶部；**统一：状态点 + 名称，无项数、无 mono 徽章、无灰块**）：
```swift
HStack(spacing: 6) {
    // 状态点统一用 MenuPulseDot（size 5 + 视觉脉冲动效；激活态 pulse=true，非激活态静态）：
    //   开机 running？sidebarActive：sidebarText
    //   实例 itemStateColor（随状态色）
    //   租户 isActive？sidebarActive：sidebarText
    MenuPulseDot(color: running ? AppTheme.sidebarActive : AppTheme.sidebarText(dark), pulse: running)
    Text(title)                               // 名称（mono，随主题色）
        .font(.system(size: 12, weight: .medium, design: .monospaced))
        .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
        .lineLimit(1).truncationMode(.tail)
    Spacer(minLength: 0)
}
.padding(.horizontal, 2).padding(.bottom, 2)
```

> ⚠️ **状态点统一 `MenuPulseDot`**（`Common/Components/StatusBadge.swift`）：所有操作弹窗 header 的状态点**大小（5pt）与脉冲动效统一**，激活/运行/有效态 `pulse=true`（呼吸动效），非激活态 `pulse=false`（静态）。禁止各自用裸 `Circle()`；命名规避 SidebarView 已有的 `private PulseDot`(6pt)。

> ⚠️ **header 统一无项数、无 mono 徽章**：不要渲染「N 项」，不做脱敏名 mono 徽章变体。各页面 header 统一为 `状态点 + 名称` 一种形式。

**item 列表（2 列 + 可滚动）**：
```swift
ScrollView {
    LazyVGrid(columns:[GridItem(.flexible(), spacing: gridGap), GridItem(.flexible(), spacing: gridGap)], spacing: 8) {
        ForEach(actions) { act in actionButton(act) }
    }.padding(.top, 2)
}
外层 .frame(width: 280, height: panelHeight, alignment: .topLeading)  // 固定高度，内容可滚动
     .background(AppTheme.pageBg(dark)).cornerRadius(12)
```

**item（actionButton）**：图标 + 文字，**按类型上色**，padding 水平 10 垂直 5，圆角 8，hover 用 `buttonFill`，`foregroundColor(toneColor(...))`。

### 2.6 item 按类型上色（tone → 颜色，随主题）

```swift
enum Tone {
    case accent    // 主操作（开机启动/手动开机）→ 绿
    case danger    // 删除 → 红
    case info      // 已抢实例 → 青
    case orange    // 手动开机 → 橙
    case gray      // 中性（租户可选，如 VPU 等）→ 灰
    case `default`
}

func toneColor(_ tone: Tone) -> Color {
    switch tone {
    case .accent: return AppTheme.sidebarActive
    case .danger: return AppTheme.danger
    case .info:   return AppTheme.cyan
    case .orange: return AppTheme.orange
    case .gray:   return AppTheme.sidebarText(dark).opacity(0.75)
    case .default: return dark ? Color.white.opacity(0.92) : Color.primary
    }
}
```

`make(...)` 里 `let t = danger ? Tone.danger : tone`，`BootActionItem(tone: t, ...)`。
渲染时若 `act.isDanger` 为真，需**强制**用 `.danger` tone（不信任调用方传的 `tone`），即
`let effTone = act.isDanger ? Tone.danger : act.tone`，确保危险项图标+文字都是红色。

### 2.7 颜色全部随主题

弹窗背景 `AppTheme.pageBg(dark)`、边框 `AppTheme.border`、文字 `dark ? ... : ...`、tone 色（sidebarActive/cyan/orange/danger）——**全部随深/浅主题**。
不使用硬编码色值（除上述具体色号已在系统主题变量里）。

### 2.8 明确禁用

- **无小三角箭头**（已移除 DiamondArrow/ArrowTriangle）。
- **无窗内 section 标题**（扁平 2 列）。
- item 数量多时**允许弹窗内滚动**（ScrollView + 固定 panelHeight）。

### 2.9 对齐步骤（通用；实例/开机/租户均已对齐）

1. `XxxActionMenuLayout` 常量改为上表。
2. `XxxActionMenuLayout.panelFrame` 改为 2.3 逻辑。
3. 操作按钮 `XxxActionMoreButton` 改为 28×28 圆角 4。
4. `XxxActionMenuPresenter` 加 `activeButton/activeDark` + `setButtonHighlight`（2.2）。
5. `XxxActionMenuContent` header 改为**状态点+名称（无项数/无徽章）**；item 用 tone 上色；背景用 `AppTheme.pageBg(dark)`；圆角 12 / padding 12 / 按钮 10×5 圆角 8 / hover 变绿（见 2.5 / 2.6）。
6. 弹窗固定 `panelHeight` + ScrollView（允许滚动）。

> ⚠️ 按钮 **固定 28×28，绝不随操作列宽拉伸**。渲染处的 `.frame(width: max(colWidth, 28), ...)` 会把按钮撑成宽方块（曾踩坑）——必须写死 `.frame(width: 28, height: 28)`，且用列宽 frame 居中。

> 已对齐：开机 `BootActionMenu*`、实例 `InstanceActionMenu*`、租户 `TenantActionMenu*`（列表 + 租户详情 `TenantDetailActionButton`，均在 `TenantsView.swift` / `TenantDetailView.swift`）。

---

## 第三章 · 下拉选择框标准（单选 SelectMenu / 多选 MultiSelect / 视觉层级 / 零抖动）

适用于全站表单、筛选栏、监控大盘中的下拉选择组件（单选如代理类型、强制开关；多选如流量监控区域筛选等）。标准实现以 `SelectMenu.swift` 与 `TenantTrafficView.swift` 为准。

### 3.1 核心架构：独立浮层避免父级高度抖动与裁剪（核心原则）

> ⚠️ **曾踩坑**：
> 1. **严禁在父级卡片内部流式展开（In-flow Layout）**：直接在 `VStack` 中渲染展开列表，会导致父级卡片物理高度瞬间从 `36px` 暴增到 `200px+`，推搡下方所有组件产生剧烈跳动！
> 2. **严禁依赖局部普通 `.overlay` 偏移展开**：当外层卡片带有 `.cornerRadius(...)` 或外层被 `ScrollView` 包裹时，底层 CALayer 会对超出 bounds 的区域施加硬件裁剪（`masksToBounds: true`），导致下拉选项被齐刷刷切掉大半截！
> 3. **多选组件避免使用系统级 `SwiftUI.Menu`**：系统级 `Menu` 每次点击单项会自动强行收起，无法满足用户勾选多个区域的连续多选交互诉求。

**标准实现架构**：
采用轻量级 **`NSPanel (.popUpMenu)` 窗口桥接模式（`NSViewRepresentable` AnchorView）**：
- 下拉选项列表作为独立无边框浮层（`childWindow`）挂载到当前窗口；
- 物理尺寸脱离普通文档流，触发按钮与父卡片**高度恒定零抖动**；
- 层级设为 `.popUpMenu`，永远漂浮在所有 `ScrollView`、模态弹窗与复杂图层树的最顶层，**绝无裁剪风险**；
- 面板内部支持连续点击复选框切换状态而不收起，点击页面任意外部区域或按下 `ESC` 即时平滑关闭。

---

### 3.2 双主题视觉层级与颜色规范（解决混叠与扁平感）

下拉面板与触发输入框、页面底层卡片必须形成**清晰、舒适的「三层立体明暗阶梯」**：

| 元素 | 深色主题 (Dark Mode) | 浅色主题 (Light Mode) | 说明 |
|:---|:---|:---|:---|
| **页面底层底板** | 基础暗色 `#0f1117` / `#161820` | 微灰底色 `#f1f5f9` / `#f3f6fa` | 最底层页面底板 |
| **触发输入框** | 局部深色 `#161820` / `var(--bg-2)` | 微灰质感色 `#f8fafc` | 与纯白浮层形成第一道明暗差 |
| **展开下拉面板背景** | **明朗浮层色 `#252a36`** | **纯净雪白色 `#ffffff`** | 关键！绝不与底层同色，形成清晰前景层 |
| **面板外轮廓边框** | 柔和冷灰 `#3a4152`（1px） | 质感 Slate 灰 `#cbd5e1`（1px） | 告别模糊，提供清晰精确的外轮廓定义 |
| **立体悬浮投影** | `shadow(color: black.opacity(0.65), radius: 14, y: 6)` | `shadow(color: black.opacity(0.22), radius: 14, y: 6)` | 柔和自然的系统级下投影，产生真实的纵深感 |

---

### 3.3 选项行与复选框交互规范

1. **多选控制行（顶部操作栏）**：
   - 顶部提供「全选 / 取消全选」便捷按钮（根据当前是否已全选动态切换文案）；
   - 下方紧跟细分割线 `Divider()`。
2. **选项行高与内边距**：
   - 选项行高 `36px`，左右内边距 `12px`；
   - 选中态：展示饱满的主题绿选中方块（`checkmark.square.fill`，颜色 `AppTheme.sidebarActive`）；
   - 未选态：中性浅灰复选框（`square`，颜色 `secondaryText`）；
   - 鼠标悬停（Hover）：整行背景平滑变为浅强调悬停色（深色 `#2c3240`，浅色 `#f1f5f9`），圆角 `4px`。
3. **滚动容器限制**：
   - 选项超过 5 项时，使用内部 `ScrollView` 约束最大高度（`maxHeight: 200~240`），避免面板超出屏幕视口。

---

### 3.4 示例标准代码结构模板（多选下拉框）

```swift
// 1. 浮动面板视图
private struct MultiSelectDropdownPanel: View {
    let selectedIds: Set<String>
    let options: [SelectOption]
    let dark: Bool
    let onToggle: (String) -> Void
    let onSelectAll: () -> Void
    let onClearAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 全选操作
            let isAll = selectedIds.count == options.count && !options.isEmpty
            Button(action: { isAll ? onClearAll() : onSelectAll() }) {
                HStack {
                    Text(isAll ? "取消全选" : "全选所有")
                        .font(.system(size: 13, weight: .medium))
                    Spacer()
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())

            Divider().background(dark ? Color(hex: "3a4152") : Color(hex: "e2e8f0"))

            // 滚动选项列表
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(options) { opt in
                        let sel = selectedIds.contains(opt.id)
                        Button(action: { onToggle(opt.id) }) {
                            HStack(spacing: 8) {
                                Image(systemName: sel ? "checkmark.square.fill" : "square")
                                    .font(.system(size: 13))
                                    .foregroundColor(sel ? AppTheme.sidebarActive : Color.gray)
                                Text(opt.title)
                                    .font(.system(size: 13))
                                    .lineLimit(1)
                                Spacer()
                            }
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
            .frame(maxHeight: 200)
        }
        .frame(width: 240)
        // 遵循 3.2 双主题视觉层级标准
        .background(dark ? Color(hex: "252a36") : Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(dark ? Color(hex: "3a4152") : Color(hex: "cbd5e1"), lineWidth: 1)
        )
        .cornerRadius(6)
        .shadow(color: Color.black.opacity(dark ? 0.65 : 0.22), radius: 14, x: 0, y: 6)
    }
}
```

---

## 第四章 · 分页标准（默认条数 / 档位 / 两种分页形态）

适用于所有数据列表页（实例、租户、开机、区域、存储、邮件、审计日志等）。

标准实现可对照：
- **页码分页**（Spring `Page` 接口）：`Common/Components/PaginationBar.swift` + `Common/Models/PageState.swift`
- **游标分页**（OCI token 接口）：原项目 `oci-server/src/main/resources/templates/mobile/audit_log.ftl` 的「加载更多」形态

### 4.1 默认每页条数 = 20

所有数据列表页的 `PageState` 初始值统一为 **`PageState(page: 0, size: 20)`**。

```swift
@Published var pageState = PageState(page: 0, size: 20)
```

**理由**：10 条太碎，稍长的列表就要频繁翻页；50 / 100 首屏请求与渲染都偏重。20 是折中值。

> ⚠️ **曾踩坑**：各页默认值不统一——实例 / 租户 / 区域 / 代理配置为 `10`，开机 / Cloudflare / EdgeOne / 费用统计为 `20`，邮件服务为 `5`。**10 的那批需统一改为 20。**

### 4.2 每页条数只允许 `sizeOptions` 内的档位

`PageState.sizeOptions = [10, 20, 50, 100]`。**禁止**给 `PageState` 赋该列表以外的值。

> ⚠️ **曾踩坑**：`EmailViewModel` 用了 `size: 5`，而 5 不在 `sizeOptions` 里 → 每页条数选择器显示的值**不在自己的选项列表中**，用户改过之后再也选不回 5，属自相矛盾。

**规则**：确需非标准档位时，先把该值加进 `sizeOptions`，再使用。

### 4.3 分页控件与接口形态必须匹配（核心原则）

分页接口分两类，**控件形态不可互换**：

| 接口形态 | 特征 | 必须使用的控件 |
|:---|:---|:---|
| **页码分页** | Spring `Page`，返回 `totalElements` / `totalPages`，支持任意页跳转 | `PaginationBar`（页码条 + 上下页 + 跳页 + 每页条数） |
| **游标分页** | OCI `opc-next-page` / `nextPageToken`，**无总数、不支持随机访问** | **「加载更多」按钮**（append 到列表尾部） |

### 4.4 游标分页：明确禁用页码条与跳页框

游标接口**不提供总数**，也**只能向前链式推进**，因此：

- **禁止**使用带页码数字条的 `PaginationBar`（页码总数只能靠猜，且会随探索不断增长）。
- **禁止**提供「跳至 __ 页」输入框（无法随机访问，超出范围的输入会被静默夹回）。
- **禁止**显示「共 N 条」（总数拿不到）。
- 必须 `showsSizeSelector: false`（每页条数由服务端固定，既不可设也不可读）。
- 文案用「已加载 N 条 · 还有更多」，以「还有更多」表达总数未知。

```swift
// 游标分页标准形态（底部条）
HStack(spacing: 12) {
    Text("已加载 \(rows.count) 条\(hasMore ? " · 还有更多" : "")")
        .font(.system(size: 12))
        .foregroundColor(AppTheme.sidebarText(dark))
    Spacer()
    if hasMore {
        AppButton(title: "加载更多", systemImage: "chevron.down", kind: .secondary) {
            model.loadNextPage()          // 带 pageToken 追加到 rows 尾部
        }
    }
}
.padding(.horizontal, 12).padding(.vertical, 10)
```

**参考实现**：原项目 `mobile/audit_log.ftl`（`_alNextToken` + `loadNextPage()` append）。这是游标分页的正确形态。

> ⚠️ **曾踩坑（审计日志）**：
> 1. OCI Audit 的 `ListEventsRequest` 实测只有 `compartmentId / startTime / endTime / page / opcRequestId`，**没有 `limit`** —— 每页条数既不可设也不可读。
> 2. 客户端曾把 `PaginationBar` 套在游标接口上：`totalPages` 靠 `max(已知最大页+1, 当前页+2)` 猜，页码条随翻页从「1 2」长到「1 2 3」；而 `PageState.go(to:)` 内部有 `min(max(0, newPage), totalPages - 1)` 的 clamp，跳页框输入超范围页码会被**静默夹回且无任何提示**。
> 3. 为伪造随机访问，客户端维护了 `auditPageCache` / `auditTokenForPage` / `auditNextTokenByPage` / `auditMaxKnownPageIndex` 四个字典 + 一个 O(页数) 的序号累加循环。改用「加载更多」后可全部收敛为单个 `nextToken`，序号即 `1..N`。

### 4.5 页码换算（Web）

- 浏览器路由 query `page` 为 **1-based**；Spring Controller 的 `page` 为 **0-based**。
- 换算只允许在领域服务里做**一次**，禁止在页面内散落 `-1` / `+1`。

### 4.6 已对齐 / 待对齐清单

> **本清单是本项目分页标准的唯一权威来源。** 其它文档（如 `NEW_SESSION_CONTINUE.md`）只引用、不复制，避免多处清单互相矛盾。

**已对齐 / 待对齐（按端分别核对，2026-09-11 复核）**：

> ⚠️ **原表只覆盖 macOS 客户端，却写成「全量核对通过」，与 Web / Windows 实际状态不符。**
> 2026-09-11 验收时实测发现：**Web 端 4 处仍是 10、邮件页是硬编码 6/8/8、CF/EO 无分页；Windows 端 2 处仍是 10。**
> 下表已拆成三端分别列，未对齐的一律标 ⬜。

**macOS 客户端 —— 已对齐 ✅**

| 页面 | 默认条数 | 控件形态 | 状态 |
|:---|:---|:---|:---|
| 开机管理 `BootViewModel` | 20 | `PaginationBar` | ✅ |
| Cloudflare `CloudflareViewModel` | 20 | `PaginationBar` | ✅ |
| EdgeOne `EdgeOneViewModel` | 20 | `PaginationBar` | ✅ |
| 租户费用统计 `TenantsViewModel.costPageState` | 20 | `PaginationBar` | ✅ |
| 实例管理 `InstancesViewModel` | 20 | `PaginationBar` | ✅ |
| 租户管理 `TenantsViewModel` | 20 | `PaginationBar` | ✅ |
| 区域管理 `RegionsViewModel` | 20 | `PaginationBar` | ✅ |
| 代理配置 `ProxyConfigViewModel` | 20 | `PaginationBar` | ✅ |
| 邮件服务 `EmailViewModel`（5 个列表） | 20 | `PaginationBar` | ✅ |
| 审计日志 `TenantAuditLogView` | 服务端固定 | **「加载更多」**（游标） | ✅ |

**Web 端（`modern-ui`）—— 全部已对齐 ✅**

| 页面 | 组件 | 默认条数 | 状态 |
|:---|:---|:---|:---|
| 开机管理 | `GrabPage` | 20 | ✅ |
| 租户抢机 | `TenantGrabPage` | 20 | ✅ |
| 实例管理 | `InstancesPage` | 20 | ✅ |
| 租户管理 | `TenantsPage`（`initSize`） | 20 | ✅ |
| 区域管理 | `RegionsPage` | 20 | ✅ |
| 系统管理·代理配置 | `SysVpnProxyPage` | 20 | ✅ |
| 邮件服务 | `MailPage` | 20 | ✅ |
| 账号配额 | `TenantQuotaPage` | 20 | ✅ |
| 费用统计 | `TenantCostPage` | 20 | ✅ |
| 审计日志整页 | `TenantAuditPage` | 游标加载更多 | ✅ |
| 实例流量监控 | `TenantTrafficPage` | 图表+实例列表 | ✅ |

> - `MailPage` 的 6/8/8 是 `const` 常量而非 state，且该页**自绘 `‹ ›` 分页**、不使用共享 `Pagination` 组件 —— 所以既改不了、也违反 4.2（档位越界）。
> - `CFManagePage` 直接拉 100 条、**没有分页控件**；`EOManagePage` 同样。与 macOS 端「`PaginationBar` + 20」形态不一致，**是否补齐待定**。
> - `page-proxy.jsx` 里的 `ProxyPage` 虽挂在 `window` 上，但**未接入路由表**（`app.jsx` 只映射了 `proxyKeyConfig` / `cfManage` / `eoManage`），属遗留容器，不计入本清单。

**Windows 端（`oci-pool-win`）—— 部分未对齐 ⬜**

| 页面 | 文件 | 默认条数 | 应改 | 状态 |
|:---|:---|:---|:---|:---|
| 租户管理 | `TenantsView.cs` | **10** | 20 | ⬜ |
| 实例管理 | `InstancesView.cs` | **10** | 20 | ⬜ |
| GCP 实例 | `GcpInstancesView.cs` | 20 | — | ✅ |

**踩坑记录**：
- **「只改了一端就写全量对齐」**（2026-09-11 验收实测）：D1 的实现记录只列了 4 个 Swift ViewModel，但本表当时写的是「全量核对通过」。**核对标准时必须逐端点名，不能只核一端。**
- 曾出现各页默认值不统一（实例/租户/区域/代理配置为 `10`，邮件服务为 `5`）。**macOS 端已于 2026-09-11 统一为 `20`；Web / Windows 端待改。**
- 邮件服务的 `size: 5` 不在 `PageState.sizeOptions = [10, 20, 50, 100]` 内，导致每页条数选择器显示的值不在自己的选项列表中。**macOS 端已修正为 `20`；Web 端是硬编码 6/8/8，同样越界且不可调，待改。**
- 审计日志曾套用 `PaginationBar`（页码条 + 跳页框），而接口是 OCI token 游标：页码总数只能靠 `max(已探明+1, page+2)` 猜、会随翻页增长，跳页框超范围输入被静默夹回。已改为「加载更多」append 形态（两端均已改）。

---

## 第五章 · 配置卡片表单与操作按钮禁用标准（Form Validation & Button Disabled Standard）

适用于所有配置类卡片、表单组件及操作弹窗（如 IP 质量管理、密钥配置、DNS 记录弹窗、代理配置等）。标准实现以 `IpQualityView.swift` / `page-misc.jsx (SysIpQualityPage)` 为准。

### 5.1 核心设计原则

> ⚠️ **曾踩坑**：在必填项未填写时保持按钮高亮可点击，依赖用户点击后弹 Toast 报错。这种方式体验滞后、视觉没有前置约束，且容易产生无效的网络或本地验证请求。

**标准规则**：
1. **前置防御性校验**：只要卡片或弹窗内的**必填项（带红星 `*` 字段）为空或全为空格**，底部的操作按钮（如「测试连接」、「保存配置」、「确定」）**必须实时进入 Disabled 禁用状态**。
2. **必填显式标识**：所有参与禁用校验的输入项，Label 必须直观带红星 `*`（如 `服务器地址 *`、`用户名 *`、`API Key *`）。
3. **按钮联动反馈**：
   - 禁用态：置灰或淡色半透明，禁止点击与指针交互；
   - 激活态：当所有必填项满足校验规则后，按钮毫秒级恢复高亮与可点击态。
4. **禁用态色彩对比度规范（主题色弱化态与文字反转 · 方案 B）**：
   - ⚠️ **曾踩坑**：严禁在禁用时直接对 Primary 等实心按钮粗暴施加全局 `opacity: 0.5`！在浅色模式的白色背景上，这会导致“半透明白字”浮在“泛白浅绿底”上，对比度暴跌至 1.2:1，文字完全看不清。
   - **正确做法（方案 B · 主题色弱化态）**：
     - **禁用背景**：采用对应强调色软底（`accentSoft`，深色 `opacity 0.20`，浅色 `opacity 0.12`）；
     - **禁用文字与图标**：**严禁使用白色**！必须反转为对应的深强调色（`accent.opacity(0.65 ~ 0.8)`）；
     - **禁用边框**：保留微弱主题色轮廓细边框（`accent.opacity(0.25 ~ 0.35)`）；
     - **效果**：既鲜明保留了主按钮的色彩归属倾向（如绿色保存、蓝色操作），又确保在浅白底上文字清晰锐利、对比度达标（>= 4.5:1）。

---

### 5.2 代码规范与模板

#### 1. macOS 客户端（SwiftUI）标准模板
```swift
// 1. 计算必填项有效性
let binding = model.binding(for: carrier)
let hasHost = !binding.serverIp.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
let hasUser = !binding.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
let canSubmit = hasHost && hasUser

// 2. 字段 Label 明确标注红星
FormFieldRow(label: "服务器地址 *") { ... }
FormFieldRow(label: "用户名 *") { ... }

// 3. 按钮显式绑定 enabled 参数
AppButton(
    title: "测试连接",
    systemImage: "zap",
    kind: .secondary,
    isLoading: isTesting,
    enabled: canSubmit
) {
    model.testVPS(carrier)
}

AppButton(
    title: "保存",
    systemImage: "square.and.arrow.down",
    kind: .primary,
    isLoading: isSaving,
    enabled: canSubmit
) {
    model.saveVPS(carrier)
}
```

#### 2. Web 端（React Modern UI）标准模板
```jsx
// 1. 纯函数或变量推导校验状态
const canSubmit = Boolean(config.host?.trim() && config.username?.trim());

// 2. 表单行标注 required
<FormRow label="服务器地址" required> ... </FormRow>
<FormRow label="用户名" required> ... </FormRow>

// 3. 按钮直接设置 disabled 属性
<Button
  variant="outline"
  size="sm"
  icon="zap"
  loading={config.testing}
  disabled={!canSubmit}
  onClick={onTest}
>
  测试连接
</Button>

<Button
  variant="primary"
  size="sm"
  icon="save"
  disabled={!canSubmit}
  onClick={onSave}
>
  保存配置
</Button>
```

---

### 5.3 已对齐页面清单

| 页面 | 涉及卡片 / 弹窗 | 依赖必填项 | macOS 端 | Web 端 |
|:---|:---|:---|:---:|:---:|
| IP 质量管理 | 三大运营商 VPS 探针卡片 | 服务器地址 + 用户名 | ✅ | ✅ |
| Token / 密钥配置 | Cloudflare 配置卡片 | API Key + 邮箱地址 | ✅ | ✅ |
| Token / 密钥配置 | EdgeOne 配置卡片 | SecretId + SecretKey | ✅ | ✅ |
| EO 管理 | DNS 记录添加/编辑弹窗 | 记录名 + 记录值 | ✅ | ✅ |

---

## 第六章 · 文本与密码输入框一键清空标准（Input Clear Button & Visibility Toggle Standard）

适用于全站所有单行输入框、密码输入框及搜索框（如 `TextInput`、`PasswordInput`、`ToolInput`、`SearchInput` 及 macOS 的 `AppTextField`）。标准实现以 Web 端 `shell.jsx`、`ui.jsx`、`page-tools.jsx` 与 macOS 端 `FormFields.swift` 为准。

### 6.1 核心设计原则

> ⚠️ **曾踩坑**：
> 1. Web 端输入框在用户键入内容后无法一键清空，用户必须连按退格键或全选删除，与 macOS 桌面原生操作习惯割裂。
> 2. 点击清空按钮时默认触发失去焦点（Blur），导致光标脱离输入框，用户清空后想重新输入必须再次点击输入框。
> 3. 密码框右侧原本有眼睛显隐按钮，若清空按钮直接绝对定位到最右侧，会与眼睛按钮严重重叠或覆盖。

**标准规则**：
1. **有内容时即时显现**：
   - 当输入框内有有效字符且组件处于可编辑状态（非 `disabled`、非 `readOnly`）时，输入框内右侧立即渲染一键清空圆形图标（Web 端 Lucide `x-circle`，macOS 端 SF Symbol `xmark.circle.fill`）；
   - 内容为空时自动隐藏，不占多余视觉权重。
2. **免失焦清空体验**：
   - 清空按钮必须拦截 `onMouseDown` 事件并执行 `e.preventDefault()`，保证点击清空时输入框**始终保持光标聚焦（Focus）**，清空后可立即直接打字。
3. **密码框双操作布局**：
   - 普通文本框：右侧预留清空按钮（`paddingRight: 30px`，清空图标定位 `right: 5px`）；
   - 密码框：右侧并排布局「一键清空 + 明文眼睛」双图标（`paddingRight: 54px`，眼睛固定在 `right: 4px`，清空按钮位于 `right: 28px`），各司其职互不打架。
4. **搜索框非空清空与联动**：
   - 搜索输入框（`SearchInput`）在包含关键词时右侧显示一键清空图标，点击即可瞬间重置为全量无过滤状态，且不引起页面几何高度抖动。

---

### 6.2 代码规范与模板

#### 1. Web 端通用组件模板（React Modern UI）
```jsx
// shell.jsx / ui.jsx 标准实现
<div style={{ position: 'relative', width: '100%' }}>
  <input
    type={effType}
    value={value ?? ''}
    onChange={e => onChange && onChange(e.target.value)}
    style={{
      width: '100%',
      padding: isPass ? '7px 54px 7px 10px' : (hasVal ? '7px 30px 7px 10px' : '7px 10px'),
      ...
    }}
  />
  {hasVal && (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()} // 保持输入焦点
      onClick={() => onChange && onChange('')}
      tabIndex={-1}
      title={tr('logs.action.clear') || 'Clear'}
      style={{
        position: 'absolute', right: isPass ? 28 : 5, top: '50%', transform: 'translateY(-50%)',
        width: 22, height: 22, border: 'none', background: 'transparent',
        cursor: 'pointer', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <Icon name="x-circle" size={13} />
    </button>
  )}
  {isPass && (
    <button type="button" onClick={() => setReveal(!reveal)} style={{ position: 'absolute', right: 4, ... }}>
      <Icon name={reveal ? 'eye-off' : 'eye'} size={13} />
    </button>
  )}
</div>
```

---

### 6.3 已对齐组件清单

| 组件 / 控件名 | 所在文件 | 支持一键清空 | 密码眼睛协同 | 保持光标不失焦 |
|:---|:---|:---:|:---:|:---:|
| `TextInput` 通用文本框 | `shell.jsx` | ✅ (`x-circle`) | ✅ (`right: 28`) | ✅ (`preventDefault`) |
| `PasswordInput` 密码框 | `shell.jsx` | ✅ (`x-circle`) | ✅ (`right: 28`) | ✅ (`preventDefault`) |
| `ToolInput` 工具输入框 | `page-tools.jsx` | ✅ (`x-circle`) | ✅ (`right: 28`) | ✅ (`preventDefault`) |
| `SearchInput` 通用搜索框 | `ui.jsx` | ✅ (`x-circle`) | — | ✅ (`preventDefault`) |
| `AppTextField` 原生输入框 | `FormFields.swift` | ✅ (`xmark.circle.fill`) | ✅ (同轴切换) | ✅ (原生 NSTextField) |

---

## 附：新增统一标准的方式

后续新增其它统一标准时：
- 在本文件按「第 N 章」追加，保持「规则 + 代码模板 + 已对齐/待对齐清单 + 踩坑提示」结构。
- 标准实现优先写真实文件路径（如 `BootView.swift`），并在头部「标准实现可对照」加一行。
