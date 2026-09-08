# UI 标准（UI Standard）

> **本文档是项目内表格 + 操作弹窗的统一标准。** 后续新增其它统一标准，按章节在本文件追加。
> 标准实现可对照：实例（`InstancesView.swift`）、开机管理（`BootView.swift`，**以此为准**）、租户管理（`TenantsView.swift`）。
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

### 1.8 已对齐页面清单

- 实例列表（`InstancesView.swift`，已落实 1.1~1.7 全部标准）
- 开机管理（`BootView.swift`，已落实 1.1~1.7 全部标准）
- 租户管理（`TenantsView.swift`，已落实 1.1~1.7 全部标准，表头固定 + 独立滚动 + 行 hover + 防穿透）
- 区域管理（`RegionsView.swift`，全列与弹性列居中）
- 对象存储（`StorageView.swift`，全列与操作列居中）
- 审计日志（`TenantAuditLogView.swift`，全列居中）
- 费用统计（`TenantCostView.swift`，全列与金额居中）
- 用户管理（`TenantUserManageView.swift`，全列与操作列居中）
- 区域订阅（`TenantRegionSubView.swift`，全列居中）
- 代理配置（`ProxyConfigView.swift`，全列居中）
- Cloudflare（`CloudflareView.swift`，全列居中）
- EdgeOne（`EdgeOneView.swift`，全列居中）
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

## 附：新增统一标准的方式

后续新增其它统一标准时：
- 在本文件按「第 N 章」追加，保持「规则 + 代码模板 + 已对齐/待对齐清单 + 踩坑提示」结构。
- 标准实现优先写真实文件路径（如 `BootView.swift`），并在头部「标准实现可对照」加一行。
