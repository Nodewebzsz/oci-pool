import SwiftUI
import AppKit

/// 原生开机管理（对齐 Web `/boot/fullBootList` · `full_machine_list.ftl`）。
/// 列表视觉对齐实例列表：摘要 chip · 卡片表 · 行悬停 · 三点操作菜单 · 窗内两列菜单。
struct BootView: View {
    /// 租户详情 → 查看开机子页（对齐 Web page-tenant-grab：面包屑 + 租户上下文）
    var tenantSubPage: Bool = false
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = BootViewModel()

    @State private var hoveredRowId: Int64?

    private var dark: Bool { appearance.isDarkEffective }

    // 固定列宽；租户/备注/区域吃剩余宽度。操作列仅三点菜单。
    private let wIndex: CGFloat = 36
    private let wTenant: CGFloat = 108
    private let wRemark: CGFloat = 80
    private let wRegion: CGFloat = 84
    private let wArch: CGFloat = 52
    private let wStatus: CGFloat = 68
    private let wNum: CGFloat = 48
    private let wTime: CGFloat = 100
    private let wAction: CGFloat = 48
    private let hPad: CGFloat = 12
    private let minFlex: CGFloat = 72

    private var fixedColsWidth: CGFloat {
        wIndex + wTenant + wRemark + wRegion + wArch + wStatus
            + wNum * 7 + wTime + wAction + hPad * 2 + minFlex
    }

    private var activeCount: Int { model.rows.filter(\.openBootFlag).count }
    private var idleCount: Int { model.rows.count - activeCount }
    private var execSum: Int64 { model.rows.reduce(0) { $0 + $1.executingCount } }

    var body: some View {
        Group {
            if model.detailParent != nil {
                BootDetailView(model: model)
                    .environmentObject(appearance)
                    .environmentObject(session)
            } else {
                listPage
            }
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onDisappear { model.stopBootLogIfLeaving() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            if model.detailParent != nil {
                if let p = model.detailParent {
                    Task { await model.loadDetail(p) }
                }
                return
            }
            Task { await model.reload() }
        }
        .sheet(item: $model.activeSheet) { sheet in
            BootSheetHost(sheet: sheet, model: model)
                .environmentObject(appearance)
                .environmentObject(session)
        }
        .environmentObject(appearance)
    }

    private var listPage: some View {
        PageScaffold(
            title: "预开列表",
            subtitle: tenantSubPage ? tenantSubtitle : filterSubtitle,
            systemImage: "zap.fill",
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if tenantSubPage {
                        breadcrumbBar
                    }
                    filterBar
                    if let err = model.errorText, !err.isEmpty { errorBanner(err) }
                    summaryBar
                    listBody
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .appLoading(model.isLoading && !model.rows.isEmpty)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }

    /// 子页面包屑（对齐 Web：返回 + OCI 租户管理 > 详情 · 租户名 > 查看开机）
    private var tenantSubtitle: String {
        let name = NavigationState.shared.tenantSubPageName
        return name.isEmpty ? "租户开机任务" : "\(name) · 开机任务"
    }

    private var breadcrumbBar: some View {
        HStack(spacing: 8) {
            Button(action: { NavigationState.shared.closeTenantSubPage() }) {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold))
                    Text("返回").font(.system(size: 12, weight: .medium))
                }
                .foregroundColor(AppTheme.sidebarText(dark))
            }
            .buttonStyle(PlainButtonStyle())
            Text("›").font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark).opacity(0.5))
            Text("OCI 租户管理").font(.system(size: 12)).foregroundColor(AppTheme.sidebarText(dark))
            Text("›").font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark).opacity(0.5))
            Text("查看开机").font(.system(size: 12, weight: .medium)).foregroundColor(AppTheme.sidebarActive)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var filterSubtitle: String {
        if model.hasActiveFilter {
            return "已筛选 · 共 \(model.pageState.totalElements) 组抢机任务"
        }
        return "抢机任务 · 启停 / 详情 / 批量操作 · 共 \(model.pageState.totalElements) 组"
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            // Web：eye 图标按钮（脱敏切换）
            Button {
                withAnimation(.easeInOut(duration: 0.15)) {
                    model.namesHidden.toggle()
                }
            } label: {
                Image(systemName: model.namesHidden ? "eye" : "eye.slash")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.navIcon(dark))
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 5).fill(AppTheme.sidebarHover(dark)))
            }
            .buttonStyle(PlainButtonStyle())
            .help("显示/隐藏脱敏")

            // Web grab.action.create = 预开（primary）
            AppButton(title: "预开", systemImage: "play.circle", kind: .primary) {
                model.openCreateBlank()
            }
            AppButton(title: "批量停止", systemImage: "stop.circle", kind: .orange) {
                model.batchStop()
            }
            AppButton(title: "重置", systemImage: "arrow.counterclockwise", kind: .danger) {
                model.batchResetFail()
            }
        }
    }

    // MARK: - Filter

    private var filterBar: some View {
        FilterBar(
            leading: {
                HStack(spacing: 10) {
                    SelectMenu(
                        options: model.parentTenants.map {
                            SelectOption(id: $0.id, title: model.tenantLabel($0))
                        },
                        selection: Binding(
                            get: { model.selectedParentId.isEmpty ? nil : model.selectedParentId },
                            set: { model.onParentChanged($0) }
                        ),
                        placeholder: "请选择租户",
                        width: 160,
                        allowClear: true,
                        searchable: true
                    )
                    SelectMenu(
                        options: model.regions.map {
                            SelectOption(id: $0.id, title: model.regionLabel($0))
                        },
                        selection: Binding(
                            get: { model.selectedRegionId.isEmpty ? nil : model.selectedRegionId },
                            set: { model.onRegionChanged($0) }
                        ),
                        placeholder: "请选择区域",
                        width: 160,
                        enabled: !model.selectedParentId.isEmpty,
                        allowClear: true,
                        searchable: true
                    )
                }
            },
            trailing: {
                HStack(spacing: 8) {
                    if model.hasActiveFilter {
                        AppButton(title: "重置", systemImage: "xmark", kind: .secondary) {
                            model.resetFilter()
                        }
                    }
                    AppButton(
                        title: "搜索",
                        systemImage: "magnifyingglass",
                        kind: .primary,
                        enabled: model.canQuery || model.hasActiveFilter
                    ) {
                        model.applyFilter()
                    }
                }
            }
        )
    }

    // MARK: - Summary

    private var summaryBar: some View {
        HStack(spacing: 10) {
            summaryChip(icon: "square.stack.3d.up", title: "本页", value: "\(model.rows.count)", accent: AppTheme.sidebarActive)
            summaryChip(icon: "bolt.circle.fill", title: "有任务", value: "\(activeCount)", accent: AppTheme.sidebarActive)
            summaryChip(icon: "moon.circle", title: "无任务", value: "\(idleCount)", accent: AppTheme.sidebarText(dark))
            summaryChip(icon: "arrow.triangle.2.circlepath", title: "执行中", value: "\(execSum)", accent: AppTheme.orange)
            Spacer(minLength: 0)
            Text("快捷：启动 · 停止 · 详情 · 更多")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark).opacity(0.85))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func summaryChip(icon: String, title: String, value: String, accent: Color) -> some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(accent.opacity(0.15))
                    .frame(width: 28, height: 28)
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(accent)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Text(value)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1)
        )
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.reload() } }
                .buttonStyle(PlainButtonStyle())
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(10)
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    // MARK: - List

    @ViewBuilder
    private var listBody: some View {
        // Web 三段结构：卡片占满剩余高度，表格内部滚动，分页钉在卡片底部
        VStack(spacing: 0) {
            if model.isLoading && model.rows.isEmpty {
                VStack(spacing: 10) {
                    Spacer()
                    ProgressView()
                    Text("加载开机任务…")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.sidebarText(dark))
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.rows.isEmpty {
                EmptyStateView(
                    icon: "play.circle",
                    title: "暂无开机任务",
                    subtitle: model.hasActiveFilter
                        ? "当前筛选条件下没有抢机配置"
                        : "可在租户管理中创建抢机配置，或调整筛选后查询",
                    actionTitle: "刷新",
                    action: { Task { await model.reload() } }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                tableArea
            }

            PaginationBar(state: $model.pageState) {
                model.onPageChange()
            }
            .cornerRadius(8, corners: [.bottomLeft, .bottomRight])
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // 背景圆角单独画，避免 clipShape/cornerRadius 裁掉右侧操作按钮
        .background(tableCardBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1)
        )
    }

    private var tableArea: some View {
        GeometryReader { geo in
            let totalW = max(geo.size.width, fixedColsWidth)
            let flex = max(0, totalW - fixedColsWidth + minFlex)
            let wTenantFlex = wTenant + flex * 0.4
            let wRemarkFlex = wRemark + flex * 0.3
            let wRegionFlex = wRegion + flex * 0.3
            let needsHScroll = totalW > geo.size.width + 0.5

            let table = VStack(spacing: 0) {
                headerRow(
                    wTenant: wTenantFlex,
                    wRemark: wRemarkFlex,
                    wRegion: wRegionFlex,
                    width: totalW
                )
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, item in
                            dataRow(
                                index: idx,
                                item: item,
                                wTenant: wTenantFlex,
                                wRemark: wRemarkFlex,
                                wRegion: wRegionFlex,
                                width: totalW
                            )
                        }
                    }
                }
            }
            .frame(width: totalW, height: geo.size.height, alignment: .topLeading)

            Group {
                if needsHScroll {
                    ScrollView(.horizontal, showsIndicators: true) { table }
                        .frame(width: geo.size.width, height: geo.size.height)
                } else {
                    table
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var tableCardBackground: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(AppTheme.sidebarBg(dark))
    }

    private func headerRow(
        wTenant: CGFloat,
        wRemark: CGFloat,
        wRegion: CGFloat,
        width: CGFloat
    ) -> some View {
        HStack(spacing: 0) {
            Group {
                colHeader("序号", wIndex)
                colHeader("租户名称", wTenant)
                colHeader("备注名称", wRemark)
                colHeader("区域编码", wRegion)
            }
            Group {
                colHeader("任务状态", wStatus)
                colHeader("总任务数", wNum)
                colHeader("执行数量", wNum)
                colHeader("总抢机数", wNum)
                colHeader("昨日次数", wNum)
            }
            Group {
                colHeader("今日次数", wNum)
                colHeader("失败次数", wNum)
                colHeader("成功次数", wNum)
                colHeader("系统架构", wArch)
                colHeader("创建时间", wTime)
                colHeader("操作", wAction, align: .center)
            }
        }
        .padding(.horizontal, hPad)
        .padding(.vertical, 10)
        .frame(width: width, alignment: .leading)
        .background(AppTheme.sidebarHover(dark).opacity(0.65))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.5)),
            alignment: .bottom
        )
    }

    private func dataRow(
        index: Int,
        item: BootTaskItem,
        wTenant: CGFloat,
        wRemark: CGFloat,
        wRegion: CGFloat,
        width: CGFloat
    ) -> some View {
        let hovered = hoveredRowId == item.id
        return HStack(spacing: 0) {
            Group {
                cellText("\(model.pageState.page * model.pageState.size + index + 1)", wIndex, muted: true)
                tenantCell(item, width: wTenant)
                cellText(item.remarkText, wRemark)
                cellText(item.regionName.isEmpty ? "—" : item.regionName, wRegion)
            }
            Group {
                bootStatusCell(item)
                    .frame(width: wStatus, alignment: .leading)
                    .clipped()
                numCell(item.recordCount, wNum)
                numCell(item.executingCount, wNum, accent: item.executingCount > 0 ? AppTheme.sidebarActive : nil)
                numCell(item.totalCount, wNum)
                cellText(formatNum(Int64(item.yesterdayAttemptCount)), wNum, muted: true)
            }
            Group {
                cellText(formatNum(Int64(item.currentAttemptCount)), wNum, cyan: true)
                cellText(formatNum(Int64(item.failCount)), wNum, danger: true)
                successCell(item.successCount, wNum)
                archChip(item.archText)
                    .frame(width: wArch, alignment: .leading)
                    .clipped()
                cellText(item.createText, wTime, muted: true)
                actionBar(item)
                    .frame(width: wAction, alignment: .center)
                    .layoutPriority(1)
            }
        }
        .padding(.horizontal, hPad)
        .padding(.vertical, 10)
        .frame(width: width, alignment: .leading)
        .contentShape(Rectangle())
        .background(rowBackground(index: index, hovered: hovered))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.28)),
            alignment: .bottom
        )
        .onHover { inside in
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredRowId = inside ? item.id : (hoveredRowId == item.id ? nil : hoveredRowId)
            }
        }
        .onTapGesture {
            model.openDetail(item)
        }
    }

    private func rowBackground(index: Int, hovered: Bool) -> Color {
        if hovered {
            return AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08)
        }
        return index % 2 == 1
            ? AppTheme.border(dark).opacity(dark ? 0.05 : 0.07)
            : Color.clear
    }

    // MARK: - Cells

    private func colHeader(_ title: String, _ width: CGFloat, align: Alignment = .leading) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppTheme.sidebarText(dark))
            .lineLimit(1)
            .frame(width: width, alignment: align)
            .clipped()
    }

    private func cellText(_ text: String, _ width: CGFloat, muted: Bool = false, cyan: Bool = false, danger: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundColor(
                cyan ? Color(hex: "00b6be")
                : danger ? AppTheme.danger
                : muted
                    ? AppTheme.sidebarText(dark)
                    : (dark ? Color.white.opacity(0.9) : Color.primary)
            )
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(width: width, alignment: .leading)
            .clipped()
            .help(text)
    }

    /// Web 任务状态徽章：running=accent-soft+脉冲圆点「运行中」，idle=bg-3 灰「无任务」
    private func bootStatusCell(_ item: BootTaskItem) -> some View {
        HStack(spacing: 5) {
            if item.openBootFlag {
                BootPulseDot(color: AppTheme.sidebarActive)
            }
            Text(item.openBootFlag ? "运行中" : "无任务")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(item.openBootFlag ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(item.openBootFlag ? AppTheme.sidebarActive.opacity(0.14) : AppTheme.sidebarHover(dark).opacity(0.6))
        )
    }

    private func numCell(_ n: Int64, _ width: CGFloat, accent: Color? = nil) -> some View {
        Text(formatNum(n))
            .font(.system(size: 12, weight: accent != nil ? .semibold : .regular, design: .monospaced))
            .foregroundColor(
                accent ?? (dark ? Color.white.opacity(0.88) : Color.primary)
            )
            .lineLimit(1)
            .frame(width: width, alignment: .leading)
            .clipped()
    }

    private func successCell(_ n: Int, _ width: CGFloat) -> some View {
        Text(formatNum(Int64(n)))
            .font(.system(size: 12, weight: n > 0 ? .semibold : .regular, design: .monospaced))
            .foregroundColor(n > 0 ? AppTheme.sidebarActive : (dark ? Color.white.opacity(0.88) : Color.primary))
            .lineLimit(1)
            .frame(width: width, alignment: .leading)
            .clipped()
    }

    private func tenantCell(_ item: BootTaskItem, width: CGFloat) -> some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.15)) { model.namesHidden.toggle() }
        }) {
            Text(model.namesHidden ? item.maskedTenant : item.displayTenant)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: width, alignment: .leading)
                .clipped()
                .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .help(item.displayTenant + "\n点击切换名称显示")
    }

    private func archChip(_ text: String) -> some View {
        let t = text.isEmpty || text == "—" ? "—" : text
        let c = AppTheme.info
        return Text(t)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundColor(t == "—" ? AppTheme.sidebarText(dark) : c)
            .padding(.horizontal, t == "—" ? 0 : 7)
            .padding(.vertical, t == "—" ? 0 : 2)
            .background(
                Group {
                    if t != "—" {
                        Capsule().fill(c.opacity(0.14))
                    }
                }
            )
    }

    private func formatNum(_ n: Int64) -> String {
        if n >= 10_000 {
            let f = NumberFormatter()
            f.numberStyle = .decimal
            return f.string(from: NSNumber(value: n)) ?? "\(n)"
        }
        return "\(n)"
    }

    // MARK: - Row actions

    private func actionBar(_ item: BootTaskItem) -> some View {
        BootActionMoreButton(dark: dark, item: item, model: model)
            .environmentObject(appearance)
            .frame(width: 28, height: 26)
    }
}

// MARK: - Action menu data

struct BootActionItem: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let isDanger: Bool
    let action: () -> Void
}

enum BootActionPanel {
    static func actions(for item: BootTaskItem, model: BootViewModel) -> [BootActionItem] {
        func run(_ body: @escaping @MainActor () -> Void) -> () -> Void {
            return {
                Task { @MainActor in body() }
            }
        }
        func make(
            _ id: String,
            _ title: String,
            _ icon: String,
            danger: Bool = false,
            _ body: @escaping @MainActor () -> Void
        ) -> BootActionItem {
            BootActionItem(
                id: id, title: title, systemImage: icon,
                isDanger: danger, action: run(body)
            )
        }
        return [
            make("clone", "克隆开机", "doc.on.doc") { model.confirmClone(item) },
            make("start", "开机启动", "play.fill") { model.confirmStart(item) },
            make("stop", "开机停止", "stop.fill") { model.confirmStop(item) },
            make("detail", "开机详情", "list.bullet.rectangle") { model.openDetail(item) },
            make("log", "开机日志", "text.alignleft") { model.openBootLog(for: item) },
            make("cfg", "开机配置", "settings") { model.openAddConfig(item) },
            make("manual", "手动开机", "hand.raised") { model.confirmManual(item) },
            make("del", "开机删除", "trash", danger: true) { model.confirmDelete(item) }
        ]
    }
}

// MARK: - 窗内操作菜单（对齐实例列表，扁平两列 + 悬停）

private enum BootActionMenuLayout {
    static let width: CGFloat = 300
    static let vPad: CGFloat = 12
    static let titleH: CGFloat = 18
    static let gridGap: CGFloat = 8
    static let rowH: CGFloat = 36
    static let cols = 2
    static let margin: CGFloat = 10
    static let minHeight: CGFloat = 140
    static let gap: CGFloat = 6

    static func idealHeight(itemCount: Int) -> CGFloat {
        let rows = max(1, Int(ceil(Double(itemCount) / Double(cols))))
        return vPad * 2 + titleH + 8
            + CGFloat(rows) * rowH + CGFloat(max(0, rows - 1)) * gridGap
    }

    static func panelFrame(button: NSView, in container: NSView, itemCount: Int) -> NSRect {
        let ideal = idealHeight(itemCount: itemCount)
        let btn = button.convert(button.bounds, to: container)
        let bounds = container.bounds.insetBy(dx: margin, dy: margin)
        var h = min(ideal, bounds.height)
        h = max(minHeight, h)

        var x = btn.minX - width - gap
        if x < bounds.minX { x = btn.maxX + gap }
        if x + width > bounds.maxX { x = bounds.maxX - width }
        x = max(bounds.minX, x)

        var y = btn.midY - h / 2
        if y < bounds.minY { y = bounds.minY }
        if y + h > bounds.maxY { y = bounds.maxY - h }
        return NSRect(x: x, y: y, width: width, height: h)
    }
}

/// 开机管理操作菜单。不用全窗 ClickCatcher 吞事件，避免 dismiss 失败后整页点不动。
@MainActor
final class BootActionMenuPresenter {
    static let shared = BootActionMenuPresenter()
    private var panelHost: NSView?
    private var keyMonitor: Any?
    private var mouseMonitor: Any?
    private init() {}

    var isPresented: Bool { panelHost != nil }

    func dismiss() {
        if let monitor = keyMonitor {
            NSEvent.removeMonitor(monitor)
            keyMonitor = nil
        }
        if let monitor = mouseMonitor {
            NSEvent.removeMonitor(monitor)
            mouseMonitor = nil
        }
        panelHost?.removeFromSuperview()
        panelHost = nil
    }

    func toggle(
        from button: NSButton,
        item: BootTaskItem,
        model: BootViewModel,
        appearance: AppearanceController,
        dark: Bool
    ) {
        if isPresented {
            dismiss()
            return
        }
        guard let window = button.window, let content = window.contentView else { return }
        dismiss()

        let actions = BootActionPanel.actions(for: item, model: model)
        let frame = BootActionMenuLayout.panelFrame(
            button: button,
            in: content,
            itemCount: actions.count
        )
        let root = BootActionMenuContent(
            title: item.displayTenant,
            dark: dark,
            panelHeight: frame.height,
            actions: actions,
            onDismiss: { [weak self] in self?.dismiss() }
        )
        .environmentObject(appearance)

        let host = NSHostingView(rootView: root)
        host.frame = frame
        host.wantsLayer = true
        if let layer = host.layer {
            layer.cornerRadius = 12
            layer.masksToBounds = false
            layer.borderWidth = 1
            layer.borderColor = (dark
                ? NSColor(calibratedWhite: 1, alpha: 0.12)
                : NSColor(calibratedWhite: 0, alpha: 0.10)).cgColor
            layer.shadowColor = NSColor.black.cgColor
            layer.shadowOpacity = Float(dark ? 0.45 : 0.18)
            layer.shadowRadius = 14
            layer.shadowOffset = CGSize(width: 0, height: -3)
        }

        content.addSubview(host)
        panelHost = host

        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 {
                self?.dismiss()
                return nil
            }
            return event
        }
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self = self, let host = self.panelHost else { return event }
            let loc = event.locationInWindow
            let frameInWindow = host.convert(host.bounds, to: nil)
            if !frameInWindow.contains(loc) {
                DispatchQueue.main.async { self.dismiss() }
            }
            return event
        }
    }
}

struct BootActionMenuContent: View {
    var title: String = ""
    let dark: Bool
    var panelHeight: CGFloat = 280
    let actions: [BootActionItem]
    let onDismiss: () -> Void

    @EnvironmentObject private var appearance: AppearanceController
    @State private var hoveredId: String?

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !title.isEmpty {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(1)
                    .padding(.horizontal, 2)
            }
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(actions) { act in
                        actionButton(act)
                    }
                }
            }
        }
        .padding(12)
        .frame(width: BootActionMenuLayout.width, height: panelHeight, alignment: .topLeading)
        .background(AppTheme.pageBg(dark))
        .cornerRadius(12)
    }

    private func actionButton(_ act: BootActionItem) -> some View {
        let hovered = hoveredId == act.id
        return Button(action: {
            let run = act.action
            onDismiss()
            DispatchQueue.main.async { run() }
        }) {
            HStack(spacing: 6) {
                Image(systemName: act.systemImage)
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 14)
                Text(act.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .foregroundColor(
                act.isDanger
                    ? AppTheme.danger
                    : (dark ? Color.white.opacity(0.92) : Color.primary)
            )
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(buttonFill(act: act, hovered: hovered))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        hovered
                            ? (act.isDanger
                               ? AppTheme.danger.opacity(0.45)
                               : AppTheme.sidebarActive.opacity(0.45))
                            : AppTheme.border(dark).opacity(0.4),
                        lineWidth: 1
                    )
            )
            .animation(.easeInOut(duration: 0.12), value: hovered)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { inside in
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredId = inside ? act.id : (hoveredId == act.id ? nil : hoveredId)
            }
        }
    }

    private func buttonFill(act: BootActionItem, hovered: Bool) -> Color {
        if hovered {
            if act.isDanger {
                return AppTheme.danger.opacity(dark ? 0.22 : 0.16)
            }
            return AppTheme.sidebarActive.opacity(dark ? 0.22 : 0.14)
        }
        if act.isDanger {
            return AppTheme.danger.opacity(0.06)
        }
        return dark ? Color.white.opacity(0.04) : Color.black.opacity(0.03)
    }
}

private struct BootActionMoreButton: NSViewRepresentable {
    let dark: Bool
    let item: BootTaskItem
    @ObservedObject var model: BootViewModel
    @EnvironmentObject var appearance: AppearanceController

    func makeCoordinator() -> Coordinator {
        Coordinator(item: item, model: model, appearance: appearance, dark: dark)
    }

    func makeNSView(context: Context) -> NSButton {
        let b = NSButton(frame: NSRect(x: 0, y: 0, width: 30, height: 26))
        b.bezelStyle = .shadowlessSquare
        b.isBordered = false
        b.title = ""
        b.image = NSImage(systemSymbolName: "ellipsis", accessibilityDescription: "更多")
        b.imagePosition = .imageOnly
        b.imageScaling = .scaleProportionallyDown
        b.contentTintColor = dark
            ? NSColor.white.withAlphaComponent(0.9)
            : NSColor.labelColor
        b.wantsLayer = true
        if let layer = b.layer {
            layer.cornerRadius = 7
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            layer.borderWidth = 1
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
        b.target = context.coordinator
        b.action = #selector(Coordinator.toggle(_:))
        b.setButtonType(.momentaryChange)
        b.toolTip = "更多操作"
        return b
    }

    func updateNSView(_ nsView: NSButton, context: Context) {
        context.coordinator.item = item
        context.coordinator.model = model
        context.coordinator.appearance = appearance
        context.coordinator.dark = dark
        nsView.contentTintColor = dark
            ? NSColor.white.withAlphaComponent(0.9)
            : NSColor.labelColor
        if let layer = nsView.layer {
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
    }

    final class Coordinator: NSObject {
        var item: BootTaskItem
        var model: BootViewModel
        var appearance: AppearanceController
        var dark: Bool

        init(item: BootTaskItem, model: BootViewModel, appearance: AppearanceController, dark: Bool) {
            self.item = item
            self.model = model
            self.appearance = appearance
            self.dark = dark
        }

        @objc func toggle(_ sender: NSButton) {
            let btn = sender
            let it = item
            let m = model
            let ap = appearance
            let d = dark
            DispatchQueue.main.async {
                BootActionMenuPresenter.shared.toggle(
                    from: btn, item: it, model: m, appearance: ap, dark: d
                )
            }
        }
    }
}

/// 任务状态「运行中」的脉冲圆点（对齐 Web StatusDot running pulse）。
private struct BootPulseDot: View {
    var color: Color
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 5, height: 5)
            .scaleEffect(pulse ? 1.0 : 0.72)
            .opacity(pulse ? 1.0 : 0.55)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}
