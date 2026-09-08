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
    private let wIndex: CGFloat = 28
    private let wTenant: CGFloat = 72
    private let wRemark: CGFloat = 70
    private let wRegion: CGFloat = 58
    private let wArch: CGFloat = 72
    private let wStatus: CGFloat = 66
    private let wNum: CGFloat = 58
    private let wTime: CGFloat = 140
    private let wAction: CGFloat = 48
    private let hPad: CGFloat = 12
    private let minFlex: CGFloat = 12

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
            subtitle: tenantSubPage ? tenantSubtitle : nil,
            systemImage: "bolt.fill",
            iconColor: AppTheme.orange,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if tenantSubPage {
                        breadcrumbBar
                    }
                    if let err = model.errorText, !err.isEmpty { errorBanner(err) }
                    statsStrip
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 14)
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

    /// Web 页头 actions：租户/区域 Select 160 + 搜索(primary) + eye 图标钮 + 预开(primary) + 批量停止(orange) + 重置(danger)
    private var toolbar: some View {
        HStack(spacing: 8) {
            SelectMenu(
                options: model.parentTenants.map {
                    SelectOption(id: $0.id, title: model.tenantLabel($0))
                },
                selection: Binding(
                    get: { model.selectedParentId.isEmpty ? nil : model.selectedParentId },
                    set: { model.onParentChanged($0) }
                ),
                placeholder: "请选择租户",
                width: 220,
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
                width: 200,
                enabled: !model.selectedParentId.isEmpty,
                allowClear: true,
                searchable: true
            )
            AppButton(title: "搜索", systemImage: "magnifyingglass", kind: .primary) {
                ToastCenter.shared.show("筛选结果 \(model.pageState.totalElements) 条", style: .info)
            }
            // eye 图标按钮：脱敏切换（显示完整时 accent 激活态）
            Button {
                withAnimation(.easeInOut(duration: 0.15)) {
                    model.namesHidden.toggle()
                }
            } label: {
                Image(systemName: model.namesHidden ? "eye" : "eye.slash")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(model.namesHidden ? AppTheme.navIcon(dark) : AppTheme.sidebarActive)
                    .frame(width: 30, height: 30)
                    .background(
                        RoundedRectangle(cornerRadius: 5)
                            .fill(model.namesHidden ? AppTheme.sidebarHover(dark) : AppTheme.sidebarActive.opacity(0.14))
                            .overlay(
                                RoundedRectangle(cornerRadius: 5)
                                    .stroke(model.namesHidden ? AppTheme.border(dark) : AppTheme.sidebarActive, lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(PlainButtonStyle())
            .help("显示/隐藏脱敏")

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

    // MARK: - Stats strip（Web：7 列小卡 · icon 13 彩色 + label 10.5 + 数值 20/700 语义色）

    private var statsStrip: some View {
        let totalAttempts = model.rows.reduce(0) { $0 + $1.totalCount }
        let yesterday = model.rows.reduce(0) { $0 + $1.yesterdayAttemptCount }
        let today = model.rows.reduce(0) { $0 + $1.currentAttemptCount }
        let failed = model.rows.reduce(0) { $0 + $1.failCount }
        let success = model.rows.reduce(0) { $0 + $1.successCount }
        return HStack(spacing: 10) {
            grabStatCard(icon: "checklist", color: AppTheme.cyan, label: "总任务数",
                         value: "\(model.pageState.totalElements)", pulse: false)
            grabStatCard(icon: "hourglass", color: AppTheme.orange, label: "执行数量",
                         value: "\(execSum)", pulse: execSum > 0)
            grabStatCard(icon: "arrow.triangle.2.circlepath", color: AppTheme.info, label: "总抢机数",
                         value: "\(totalAttempts)", pulse: false)
            grabStatCard(icon: "clock", color: AppTheme.textSecondary(dark), label: "昨日次数",
                         value: "\(yesterday)", pulse: false)
            grabStatCard(icon: "chart.line.uptrend.xyaxis", color: AppTheme.cyan, label: "今日次数",
                         value: "\(today)", pulse: false)
            grabStatCard(icon: "xmark.octagon", color: AppTheme.danger, label: "失败次数",
                         value: "\(failed)", pulse: false)
            grabStatCard(icon: "checkmark.circle", color: AppTheme.sidebarActive, label: "成功次数",
                         value: "\(success)", pulse: false)
        }
    }

    private func grabStatCard(icon: String, color: Color, label: String, value: String, pulse: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(color)
                Text(label)
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if pulse {
                    Circle()
                        .fill(AppTheme.sidebarActive)
                        .frame(width: 5, height: 5)
                        .shadow(color: AppTheme.sidebarActive.opacity(0.6), radius: 2)
                }
            }
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
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
                        width: 220,
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
                        width: 200,
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
            // 多列均匀分配（对齐租户管理方案）：租户/自定义名称/区域/架构/时间分剩余，数值列固定
            let wTenantFlex = wTenant + flex * 0.21
            let wRemarkFlex = wRemark + flex * 0.24
            let wRegionFlex = wRegion + flex * 0.18
            let wArchFlex = wArch + flex * 0.11
            let wTimeFlex = wTime + flex * 0.26
            let needsHScroll = totalW > geo.size.width + 0.5

            let table = VStack(spacing: 0) {
                headerRow(
                    wTenant: wTenantFlex,
                    wRemark: wRemarkFlex,
                    wRegion: wRegionFlex,
                    wArch: wArchFlex,
                    wTime: wTimeFlex,
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
                                wArch: wArchFlex,
                                wTime: wTimeFlex,
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
        wArch: CGFloat,
        wTime: CGFloat,
        width: CGFloat
    ) -> some View {
        HStack(spacing: 0) {
            Group {
                colHeader("序号", wIndex)
                colHeader("租户名称", wTenant)
                colHeader("自定义名称", wRemark)
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
        wArch: CGFloat,
        wTime: CGFloat,
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
                    .frame(width: wStatus, alignment: .center)
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
                    .frame(width: wArch, alignment: .center)
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
            // 弹窗浮层打开时不响应列表行 hover，避免悬停弹窗时底层列表误高亮
            if BootActionMenuPresenter.shared.isPresented { return }
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

    private func colHeader(_ title: String, _ width: CGFloat, align: Alignment = .center) -> some View {
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
            .frame(width: width, alignment: .center)
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
                .lineLimit(1)
                .fixedSize()
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
            .frame(width: width, alignment: .center)
            .clipped()
    }

    private func successCell(_ n: Int, _ width: CGFloat) -> some View {
        Text(formatNum(Int64(n)))
            .font(.system(size: 12, weight: n > 0 ? .semibold : .regular, design: .monospaced))
            .foregroundColor(n > 0 ? AppTheme.sidebarActive : (dark ? Color.white.opacity(0.88) : Color.primary))
            .lineLimit(1)
            .frame(width: width, alignment: .center)
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
                .frame(width: width, alignment: .center)
                .clipped()
                .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .help(item.displayTenant + "\n点击切换名称显示")
    }

    private func archChip(_ text: String) -> some View {
        let t = text.isEmpty || text == "—" ? "—" : text
        // 对齐 Web：ARM=info 蓝 / AMD 等=violet 紫（区分颜色）
        let isARM = t.uppercased() == "ARM"
        let fg = isARM ? AppTheme.info : violetArch
        return Text(t)
            .font(.system(size: 10, weight: .semibold, design: .monospaced))
            .foregroundColor(t == "—" ? AppTheme.sidebarText(dark) : fg)
            .padding(.horizontal, t == "—" ? 0 : 6)
            .padding(.vertical, t == "—" ? 0 : 2)
            .background(
                Group {
                    if t != "—" {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(isARM
                                  ? AppTheme.info.opacity(0.14)
                                  : violetArch.opacity(0.14))
                    }
                }
            )
    }

    private var violetArch: Color { dark ? Color(hex: "a78bfa") : Color(hex: "7c3aed") }

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
    var disabled: Bool = false
    let tone: Tone
    let action: () -> Void

    enum Tone {
        case accent    // 开机启动/手动开机（绿）
        case danger    // 开机删除（红）
        case info      // 已抢实例（青）
        case orange    // 手动开机（橙）
        case `default`
    }
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
            disabled: Bool = false,
            tone: BootActionItem.Tone = .default,
            _ body: @escaping @MainActor () -> Void
        ) -> BootActionItem {
            let t = danger ? BootActionItem.Tone.danger : tone
            return BootActionItem(
                id: id, title: title, systemImage: icon,
                isDanger: danger, disabled: disabled, tone: t, action: run(body)
            )
        }
        // 任务状态（对齐原项目 BootInstanceStatusEnum：0未开机/1开机中/2已开机）
        //   开机启动：仅 status == 0（未开机）可点
        //   开机停止：仅 status == 1（开机中正在循环）可点
        //   手动开机：status == 0 或 1 均可单次尝试（原项目不限制）；仅 status == 2（已开机成功）禁用防多开
        let isNotStarted = item.status == 0
        let isOpened = item.status == 2
        return [
            make("clone", "克隆开机", "doc.on.doc") { model.confirmClone(item) },
            make("start", "开机启动", "play.fill", disabled: !isNotStarted, tone: .accent) { model.confirmStart(item) },
            make("stop", "开机停止", "stop.fill", disabled: isNotStarted || isOpened) { model.confirmStop(item) },
            make("detail", "开机详情", "info.circle") { model.openDetail(item) },
            make("cfg", "开机配置", "gearshape") { model.openAddConfig(item) },
            make("instances", "已抢实例 (\(item.successCount))", "server.rack", tone: .info) { model.openDetail(item) },
            make("manual", "手动开机", "bolt.fill", disabled: isOpened, tone: .orange) { model.confirmManual(item) },
            make("del", "开机删除", "trash", danger: true) { model.confirmDelete(item) }
        ]
    }
}

// MARK: - 窗内操作菜单（对齐实例列表，扁平两列 + 悬停）

private enum BootActionMenuLayout {
    static let width: CGFloat = 280
    static let vPad: CGFloat = 8
    static let titleH: CGFloat = 20
    static let gridGap: CGFloat = 1
    static let rowH: CGFloat = 30
    static let cols = 2
    static let margin: CGFloat = 10
    static let minHeight: CGFloat = 140
    static let gap: CGFloat = 6

    static func idealHeight(itemCount: Int) -> CGFloat {
        let rows = max(1, Int(ceil(Double(itemCount) / Double(cols))))
        // 对齐 BootActionMenuContent：LazyVGrid spacing 8；每行 rowH 精确，给足 8 项展示、消除底部多余空隙。
        return vPad * 2 + titleH + 4
            + CGFloat(rows) * rowH
            + CGFloat(max(0, rows - 1)) * 8
    }

    static func panelFrame(button: NSView, in container: NSView, itemCount: Int) -> NSRect {
        let ideal = idealHeight(itemCount: itemCount)
        let btn = button.convert(button.bounds, to: container)
        let bounds = container.bounds
        var h = min(ideal, bounds.height)
        h = max(minHeight, h)

        // 对齐实例/Web：菜单右缘对齐按钮右缘；下方 6px 缝隙；下方放不下翻到上方。
        var x = btn.maxX - width
        if x < bounds.minX { x = bounds.minX + margin }
        if x + width > bounds.maxX { x = bounds.maxX - width - margin }

        let spaceBelow = btn.minY - bounds.minY
        let spaceAbove = bounds.maxY - btn.maxY
        var y: CGFloat
        if spaceBelow >= h + gap {
            y = btn.minY - gap - h
        } else if spaceAbove >= h + gap {
            y = btn.maxY + gap
        } else {
            y = max(bounds.minY + margin, btn.minY - gap - h)
        }
        y = max(bounds.minY + margin, y)
        if y + h > bounds.maxY - margin { y = bounds.maxY - margin - h }

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
    private var activeButton: NSButton?
    private var activeDark = false
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
        if let btn = activeButton {
            setButtonHighlight(btn, highlighted: false, dark: activeDark)
            activeButton = nil
        }
    }

    private func setButtonHighlight(_ button: NSButton, highlighted: Bool, dark: Bool) {
        guard let layer = button.layer else { return }
        let accent = NSColor(AppTheme.sidebarActive)
        if highlighted {
            layer.backgroundColor = accent.cgColor
            button.contentTintColor = .white
        } else {
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            button.contentTintColor = dark
                ? NSColor.white.withAlphaComponent(0.9)
                : NSColor.labelColor
        }
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

        // 打开菜单时按钮高亮为主题色（对齐实例列表操作规范）
        activeButton = button
        activeDark = dark
        setButtonHighlight(button, highlighted: true, dark: dark)

        let actions = BootActionPanel.actions(for: item, model: model)
        let frame = BootActionMenuLayout.panelFrame(
            button: button,
            in: content,
            itemCount: actions.count
        )
        let root = BootActionMenuContent(
            title: item.displayTenant,
            running: item.openBootFlag,
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
        // 用 panelFrame 计算的高度（容纳内容，超屏时 content 内滚动）；add 后仅重定位
        let realHeight = frame.height
        var r = frame
        r.size.height = realHeight
        host.frame = r
        // 重定位：保证贴紧按钮下方/上方且不出界
        let btnRect2 = button.convert(button.bounds, to: content)
        let bounds2 = content.bounds
        let gap2 = BootActionMenuLayout.gap
        let belowSpace = btnRect2.minY - bounds2.minY
        let aboveSpace = bounds2.maxY - btnRect2.maxY
        if belowSpace >= realHeight + gap2 {
            r.origin.y = btnRect2.minY - gap2 - realHeight
        } else if aboveSpace >= realHeight + gap2 {
            r.origin.y = btnRect2.maxY + gap2
        } else {
            r.origin.y = max(bounds2.minY + 12, btnRect2.minY - gap2 - realHeight)
        }
        r.origin.y = max(bounds2.minY + 12, r.origin.y)
        if r.origin.y + realHeight > bounds2.maxY - 12 { r.origin.y = bounds2.maxY - 12 - realHeight }
        host.frame = r
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
            // 点击再次点击"..."按钮本体时交给按钮 toggle 处理（关闭），不在此 dismiss —— 避免多击状态错乱
            if let btn = self.activeButton {
                let btnFrame = btn.convert(btn.bounds, to: nil)
                if btnFrame.contains(loc) { return event }
            }
            if !frameInWindow.contains(loc) {
                DispatchQueue.main.async { self.dismiss() }
            }
            return event
        }
    }
}

struct BootActionMenuContent: View {
    var title: String = ""
    var running: Bool = false
    let dark: Bool
    var panelHeight: CGFloat = 280
    let actions: [BootActionItem]
    let onDismiss: () -> Void

    @EnvironmentObject private var appearance: AppearanceController
    @State private var hoveredId: String?

    private let columns = [
        GridItem(.flexible(), spacing: BootActionMenuLayout.gridGap),
        GridItem(.flexible(), spacing: BootActionMenuLayout.gridGap)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 对齐 Web header：状态点 + 租户名（无重复灰块）
            HStack(spacing: 6) {
                // 运行中：任务状态同款脉冲动效原点；非运行：静态弱灰（统一 PulseDot，对齐 Web StatusDot pulse）
                MenuPulseDot(color: running ? AppTheme.sidebarActive : AppTheme.sidebarText(dark), pulse: running)
                Text(title)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 2)
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(actions) { act in
                        actionButton(act)
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(12)
        .frame(width: BootActionMenuLayout.width, height: panelHeight, alignment: .topLeading)
        .background(AppTheme.pageBg(dark))
        .cornerRadius(12)
    }

    private func actionButton(_ act: BootActionItem) -> some View {
        let hovered = hoveredId == act.id && !act.disabled
        return Button(action: {
            if act.disabled { return }
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
            .foregroundColor(act.disabled ? AppTheme.sidebarText(dark).opacity(0.35) : toneColor(act.tone))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
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
            // 禁用项不产生 hover 高亮
            if act.disabled { return }
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredId = inside ? act.id : (hoveredId == act.id ? nil : hoveredId)
            }
        }
        .help(disabledHelp(act))
    }

    /// 禁用项 hover 提示原因（非禁用返回空）
    private func disabledHelp(_ act: BootActionItem) -> String {
        guard act.disabled else { return "" }
        switch act.id {
        case "start":  return "任务正在运行或已完成，无需重复启动"
        case "stop":   return "未在运行中，暂无可停止的任务"
        case "manual": return "该任务已开机成功，无需手动抢机"
        default:       return "当前不可用"
        }
    }

    private func toneColor(_ tone: BootActionItem.Tone) -> Color {
        switch tone {
        case .accent: return AppTheme.sidebarActive
        case .danger: return AppTheme.danger
        case .info:   return AppTheme.cyan
        case .orange: return AppTheme.orange
        case .default: return dark ? Color.white.opacity(0.92) : Color.primary
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
        let b = NSButton(frame: NSRect(x: 0, y: 0, width: 28, height: 28))
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
            layer.cornerRadius = 4
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
