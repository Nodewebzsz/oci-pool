import SwiftUI
import AppKit

/// 原生实例列表（对齐 Web `/oci/list` · `oci_machine_list.ftl`）。
struct InstancesView: View {
    /// 租户详情 → 资源列表子页（对齐 Web page-tenant-resources：面包屑 + 租户上下文）
    var tenantSubPage: Bool = false
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = InstancesViewModel()

    @State private var hoveredRowId: String?

    private var dark: Bool { appearance.isDarkEffective }

    // 固定列宽；名称/IP/租户/区域/时间分剩余宽度（多列均匀分配）
    private let wIndex: CGFloat = 40
    private let wTenantBase: CGFloat = 108
    private let wRegionBase: CGFloat = 96
    private let wCpu: CGFloat = 64
    private let wArch: CGFloat = 68
    private let wVol: CGFloat = 86
    private let wIpv6: CGFloat = 52
    private let wTimeBase: CGFloat = 92
    private let wAction: CGFloat = 48
    private let hPad: CGFloat = 14
    private let minName: CGFloat = 120
    private let minIp: CGFloat = 100

    private var fixedColsWidth: CGFloat {
        wIndex + wTenantBase + wRegionBase + wCpu + wArch + wVol + wIpv6 + wTimeBase + wAction
            + minName + minIp + hPad * 2
    }

    var body: some View {
        Group {
            if let item = model.sshItem {
                InstanceSSHView(item: item, onBack: { model.closeSSH() })
                    .environmentObject(appearance)
                    .environmentObject(session)
            } else if let item = model.consoleItem {
                InstanceConsoleView(item: item, onBack: { model.closeConsole() })
                    .environmentObject(appearance)
                    .environmentObject(session)
            } else if let item = model.vnicItem {
                InstanceVnicView(item: item, onBack: { model.closeVnic() })
                    .environmentObject(appearance)
                    .environmentObject(session)
            } else {
                listPage
            }
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            if model.sshItem != nil || model.consoleItem != nil || model.vnicItem != nil { return }
            Task { await model.reload() }
        }
        .sheet(item: $model.activeSheet) { sheet in
            InstanceSheetHost(sheet: sheet, model: model)
                .environmentObject(appearance)
                .environmentObject(session)
        }
        .environmentObject(appearance)
    }

    private var pageTitle: String {
        if tenantSubPage {
            let name = NavigationState.shared.tenantSubPageName
            return name.isEmpty ? "租户实例列表" : "\(name) · 实例列表"
        }
        return "OCI 实例列表"
    }

    private var listPage: some View {
        PageScaffold(
            title: pageTitle,
            subtitle: tenantSubPage ? tenantSubtitle : nil,
            systemImage: "server.rack",
            iconColor: AppTheme.cyan,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if tenantSubPage {
                        breadcrumbBar
                    }
                    if let err = model.errorText, !err.isEmpty { errorBanner(err) }
                    // Web：筛选状态条（accent-soft 底 + accent 边框 radius 6）
                    filterStatusBar
                        .padding(.bottom, 12)
                    // Web KPI：4 卡（总实例数/运行中/ARM 架构/覆盖区域）gap 12
                    kpiGrid
                        .padding(.bottom, 14)
                    listBody
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }

    /// 子页面包屑（对齐 Web：返回 + OCI 租户管理 > 租户详情 · 租户名 > 实例列表）
    private var tenantSubtitle: String {
        "共 \(model.pageState.totalElements) 个实例"
    }

    private var breadcrumbBar: some View {
        HStack(spacing: 8) {
            // 返回按钮：返回上一级（若来自租户详情则精准回到租户详情页）
            Button(action: { NavigationState.shared.closeTenantSubPage() }) {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold))
                    Text("返回").font(.system(size: 12, weight: .medium))
                }
                .foregroundColor(AppTheme.sidebarText(dark))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(AppTheme.sidebarBg(dark))
                .cornerRadius(5)
                .overlay(
                    RoundedRectangle(cornerRadius: 5)
                        .stroke(AppTheme.border(dark).opacity(0.8), lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
            .help("返回上一级")

            Text("›").font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark).opacity(0.5))

            // 第一级：OCI 租户管理（点击直接返回租户管理大列表）
            Button(action: { NavigationState.shared.closeToTenantsList() }) {
                Text("OCI 租户管理")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
            .buttonStyle(PlainButtonStyle())
            .help("回到租户列表")

            // 第二级：租户详情 · 租户名（若有上级租户详情上下文，点击即可返回该租户详情）
            let name = NavigationState.shared.tenantSubPageName
            Text("›").font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark).opacity(0.5))
            Button(action: { NavigationState.shared.closeTenantSubPage() }) {
                HStack(spacing: 4) {
                    Text("租户详情")
                    if !name.isEmpty {
                        Text("·")
                        Text(name)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    }
                }
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))
            }
            .buttonStyle(PlainButtonStyle())
            .help("回到该租户详情页")

            // 第三级：当前实例列表
            Text("›").font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark).opacity(0.5))
            Text("实例列表")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.sidebarActive)

            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.bottom, 4)
    }

    private var filterSubtitle: String {
        if model.hasActiveFilter {
            return "已筛选 · 共 \(model.pageState.totalElements) 台"
        }
        return "OCI 实例列表 · 共 \(model.pageState.totalElements) 台"
    }

    // MARK: - Toolbar

    /// Web 页头 actions：`请选择:` + 租户/区域 Select(160) + eye 图标钮 + 查看实例(primary) + 一键导出(orange)
    private var toolbar: some View {
        HStack(spacing: 8) {
            if !tenantSubPage {
                Text("请选择:")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.textTertiary(dark))
                SelectMenu(
                    options: model.parentTenants.map { SelectOption(id: $0.id, title: parentLabel($0)) },
                    selection: Binding(
                        get: { model.selectedParentId.isEmpty ? nil : model.selectedParentId },
                        set: { model.onParentChanged($0) }
                    ),
                    placeholder: "请选择租户",
                    width: 220,
                    allowClear: true,
                    searchable: model.parentTenants.count > 5
                )
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "globe")
                        .font(.system(size: 11))
                    Text("当前区域:")
                        .font(.system(size: 12))
                }
                .foregroundColor(AppTheme.textTertiary(dark))
            }
            SelectMenu(
                options: model.regions.map { SelectOption(id: $0.id, title: regionLabel($0)) },
                selection: Binding(
                    get: { model.selectedRegionId.isEmpty ? nil : model.selectedRegionId },
                    set: {
                        model.onRegionChanged($0)
                        if tenantSubPage && !($0 ?? "").isEmpty {
                            model.applyFilter()
                        }
                    }
                ),
                placeholder: "请选择区域",
                width: 200,
                enabled: !model.selectedParentId.isEmpty,
                allowClear: !tenantSubPage,
                searchable: true
            )
            Button {
                withAnimation(.easeInOut(duration: 0.15)) {
                    model.namesHidden.toggle()
                }
            } label: {
                Image(systemName: model.namesHidden ? "eye" : "eye.slash")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.navIcon(dark))
                    .frame(width: 30, height: 30)
                    .background(
                        RoundedRectangle(cornerRadius: 5)
                            .fill(AppTheme.sidebarHover(dark))
                            .overlay(RoundedRectangle(cornerRadius: 5).stroke(AppTheme.border(dark), lineWidth: 1))
                    )
            }
            .buttonStyle(PlainButtonStyle())
            .help(model.namesHidden ? "显示完整租户名" : "隐藏租户名")
            if !tenantSubPage {
                AppButton(title: "查看实例", systemImage: "magnifyingglass", kind: .primary,
                          enabled: !model.selectedRegionId.isEmpty) {
                    model.applyFilter()
                }
            }
            AppButton(title: "一键导出", systemImage: "square.and.arrow.down", kind: .orange) {
                model.exportInstances()
            }
        }
    }

    // MARK: - Filter

    /// Web 筛选状态条：accent-soft 底 + accent 45% 边框 · filter 图标 + 当前筛选: + 租户/区域 chips + 匹配 N 条 + 清除筛选
    private var filterStatusBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.sidebarActive)
            Text("当前筛选:")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.sidebarActive)
            filterChip(label: "租户", value: model.selectedParentId.isEmpty
                ? nil
                : (model.parentTenants.first(where: { $0.id == model.selectedParentId }).flatMap { parentAlias($0) } ?? model.selectedParentId))
            filterChip(label: "区域", value: model.selectedRegionId.isEmpty
                ? nil
                : (model.regions.first(where: { $0.id == model.selectedRegionId }).map { regionLabel($0) } ?? model.selectedRegionId))
            Text("· 匹配 \(model.pageState.totalElements) 条")
                .font(.system(size: 12))
                .foregroundColor(AppTheme.textSecondary(dark))
            if !tenantSubPage {
                Spacer(minLength: 12)
                AppButton(title: "清除筛选", systemImage: "arrow.counterclockwise", kind: .secondary,
                          enabled: model.hasActiveFilter) {
                    model.resetFilter()
                }
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(AppTheme.sidebarActive.opacity(0.14))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(AppTheme.sidebarActive.opacity(0.45), lineWidth: 1)
        )
        .cornerRadius(6)
    }

    /// 筛选 chip：`标签 值`（bg-1 底 radius 3；未选择时值=未选择）
    private func filterChip(label: String, value: String?) -> some View {
        HStack(spacing: 5) {
            Text(label)
                .font(.system(size: 10.5))
                .foregroundColor(AppTheme.textTertiary(dark))
            Text(value ?? "未选择")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(AppTheme.navIcon(dark))
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(3)
    }

    /// Web `parentLabel` 的短名（方案 B 优先真实租户名）
    private func parentAlias(_ t: TenantRegionOption) -> String {
        t.tenantPrimaryName
    }

    /// Web KPI：4 卡 gap 12（总实例数 cyan / 运行中 accent / ARM 架构 info / 覆盖区域 violet）
    private var kpiGrid: some View {
        HStack(alignment: .top, spacing: 12) {
            instanceKpiCard(icon: "server.rack", color: AppTheme.cyan, label: "总实例数",
                            value: "\(model.pageState.totalElements)")
            instanceKpiCard(icon: "play.circle", color: AppTheme.sidebarActive, label: "运行中",
                            value: "\(model.runningCount)")
            instanceKpiCard(icon: "cpu", color: AppTheme.info, label: "ARM 架构",
                            value: "\(model.armCount)")
            instanceKpiCard(icon: "globe", color: Color(hex: "b484e8"), label: "覆盖区域",
                            value: "\(model.regionsCount)")
        }
    }

    private func instanceKpiCard(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(AppTheme.navIcon(dark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// 对齐 Web `getTenantLabel`：自定义名(defName)优先 · 中文区域
    private func parentLabel(_ t: TenantRegionOption) -> String {
        t.label
    }

    private func regionLabel(_ r: TenantRegionOption) -> String {
        r.regionDropdownLabel
    }

    // MARK: - Summary

    private var summaryBar: some View {
        HStack(spacing: 10) {
            summaryChip(icon: "server.rack", title: "本页", value: "\(model.rows.count)", accent: AppTheme.sidebarActive)
            summaryChip(icon: "play.circle.fill", title: "运行中", value: "\(model.runningCount)", accent: AppTheme.sidebarActive)
            summaryChip(icon: "stop.circle.fill", title: "已停止", value: "\(model.stoppedCount)", accent: AppTheme.danger)
            if model.otherStateCount > 0 {
                summaryChip(icon: "ellipsis.circle", title: "其他", value: "\(model.otherStateCount)", accent: AppTheme.orange)
            }
            Spacer(minLength: 0)
            Text("快捷：启停 · 复制IP · SSH · 更多")
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

    // MARK: - Table

    @ViewBuilder
    private var listBody: some View {
        // Web 三段结构：卡片占满剩余高度，表格内部滚动，分页钉在卡片底部
        VStack(spacing: 0) {
            tableArea

            PaginationBar(state: $model.pageState) {
                model.onPageChange()
            }
            .cornerRadius(8, corners: [.bottomLeft, .bottomRight])
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(tableCardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1)
        )
    }

    private var tableArea: some View {
        GeometryReader { geo in
            let totalW = max(geo.size.width, fixedColsWidth)
            let flex = max(0, totalW - fixedColsWidth)
            // 多列均匀分配：内容较长的列分剩余宽度，短列保持固定
            let wName = minName + flex * 0.30
            let wIp = minIp + flex * 0.25
            let wTenant = wTenantBase + flex * 0.20
            let wRegion = wRegionBase + flex * 0.15
            let wTime = wTimeBase + flex * 0.10
            let needsHScroll = totalW > geo.size.width + 0.5

            let table = VStack(spacing: 0) {
                // 1. 表头置顶常驻，无论加载还是空态始终可见，结构骨架稳定零抖动
                headerRow(wName: wName, wIp: wIp, wTenant: wTenant, wRegion: wRegion, wTime: wTime, width: totalW)

                // 2. 表体内容区（数据行 / 空态 / 加载态）
                ZStack {
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
                        EmptyStateView(
                            icon: "server.rack",
                            title: model.selectedParentId.isEmpty ? "暂无实例" : (model.selectedRegionId.isEmpty ? "请选择区域" : "暂无实例"),
                            subtitle: model.selectedParentId.isEmpty
                                ? "可从租户同步实例，或调整筛选后查询"
                                : (model.selectedRegionId.isEmpty ? "当前租户包含多个可用区域，请在上方选择具体区域后查看实例" : "当前筛选条件下没有实例"),
                            actionTitle: model.selectedRegionId.isEmpty ? nil : "刷新",
                            action: { Task { await model.reload() } }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                                    dataRow(index: idx, item: row, wName: wName, wIp: wIp, wTenant: wTenant, wRegion: wRegion, wTime: wTime, width: totalW)
                                }
                            }
                        }
                        .opacity(model.isLoading ? 0.6 : 1.0)
                    }

                    // 二次加载/筛选加载时，轻量且优雅的卡片内指示器（绝不遮罩全局 KPI 和筛选栏）
                    if model.isLoading && !model.rows.isEmpty {
                        VStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.9)
                            Text("更新中…")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(AppTheme.sidebarBg(dark).opacity(0.85))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(AppTheme.border(dark), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(dark ? 0.3 : 0.08), radius: 6, y: 2)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
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

    private func headerRow(wName: CGFloat, wIp: CGFloat, wTenant: CGFloat, wRegion: CGFloat, wTime: CGFloat, width: CGFloat) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                colHeader("#", wIndex)
                colHeader("租户名", wTenant)
                colHeader("所属区域", wRegion)
                colHeader("实例名称", wName)
                colHeader("CPU/MEM", wCpu)
                colHeader("架构", wArch)
            }
            HStack(spacing: 0) {
                colHeader("磁盘/VPU", wVol)
                colHeader("主 IPv4", wIp)
                colHeader("IPv6", wIpv6, align: .center)
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

    private func dataRow(index: Int, item: InstanceItem, wName: CGFloat, wIp: CGFloat, wTenant: CGFloat, wRegion: CGFloat, wTime: CGFloat, width: CGFloat) -> some View {
        let grp = tenantGroupIndex(for: index)
        let hovered = hoveredRowId == item.id
        return HStack(spacing: 0) {
            HStack(spacing: 0) {
                cellText("\(model.pageState.page * model.pageState.size + index + 1)", wIndex, muted: true)
                tenantCell(item, width: wTenant)
                regionCell(item, width: wRegion)
                nameCell(item, width: wName)
                cellText(item.cpuAndMem, wCpu)
                archChip(item.architecture)
                    .frame(width: wArch, alignment: .center)
            }
            HStack(spacing: 0) {
                cellText(item.volumeText, wVol)
                ipCell(item, width: wIp)
                ipv6Cell(item, width: wIpv6)
                cellText(item.createDateText, wTime, muted: true)
                actionBar(item)
                    .frame(width: wAction, alignment: .center)
            }
        }
        .padding(.horizontal, hPad)
        .padding(.vertical, appearance.density.rowPadding)
        .frame(width: width, alignment: .leading)
        .contentShape(Rectangle())
        .background(rowBackground(group: grp, hovered: hovered))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.28)),
            alignment: .bottom
        )
        .onHover { inside in
            // 弹窗浮层打开时不响应列表行 hover，避免悬停弹窗时底层列表误高亮
            if InstanceActionMenuPresenter.shared.isPresented { return }
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredRowId = inside ? item.id : (hoveredRowId == item.id ? nil : hoveredRowId)
            }
        }
    }

    private func rowBackground(group: Int, hovered: Bool) -> Color {
        if hovered {
            return AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08)
        }
        return group % 2 == 1
            ? AppTheme.info.opacity(dark ? 0.05 : 0.07)
            : Color.clear
    }

    /// 同租户连续行分组（对齐 Web tgrp-a/b）
    private func tenantGroupIndex(for index: Int) -> Int {
        guard index < model.rows.count else { return 0 }
        var grp = 0
        var prev = model.rows[0].tenantId
        for i in 0...index {
            let tid = model.rows[i].tenantId
            if i > 0, tid != prev {
                grp += 1
                prev = tid
            }
        }
        return grp
    }

    // MARK: - Cells

    private func colHeader(_ title: String, _ width: CGFloat, align: Alignment = .center) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppTheme.sidebarText(dark))
            .frame(width: width, alignment: align)
    }

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
            .frame(width: width, alignment: .center)
            .clipped()
            .help(text)
    }

    /// 所属区域列：国旗 emoji + 中文区域名（对齐 Web RegionBadge）
    private func regionCell(_ item: InstanceItem, width: CGFloat) -> some View {
        let code = item.regionCode.isEmpty ? item.regionName : item.regionCode
        let flag = RegionFlag.emoji(code)
        return HStack(spacing: 6) {
            Text(flag.isEmpty ? "🌐" : flag)
                .font(.system(size: 14))
            Text(item.regionName.isEmpty ? "—" : item.regionName)
                .font(.system(size: 12))
                .foregroundColor(dark ? Color.white.opacity(0.88) : Color.primary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(width: width, alignment: .center)
        .help(item.regionName.isEmpty ? "—" : "\(item.regionName)（\(code)）")
    }

    /// 架构徽章：ARM=info蓝 / 其余=violet 紫（对齐 Web getInstanceArch）
    private func archChip(_ arch: String) -> some View {
        let isARM = arch.uppercased() == "ARM"
        return Text(arch.isEmpty ? "—" : arch)
            .font(.system(size: 10, weight: .semibold, design: .monospaced))
            .foregroundColor(isARM ? AppTheme.info : violetArch)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: 3)
                    .fill(isARM
                          ? AppTheme.info.opacity(0.14)
                          : violetArch.opacity(0.14))
            )
    }

    private var violetArch: Color { dark ? Color(hex: "a78bfa") : Color(hex: "7c3aed") }

    private func tenantCell(_ item: InstanceItem, width: CGFloat) -> some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.15)) { model.namesHidden.toggle() }
        }) {
            HStack(spacing: 6) {
                // 对齐 Web：bg-3 圆角脱敏名块 + link 图标
                Text(model.namesHidden ? item.maskedTenancyName : (item.tenancyName.isEmpty ? "—" : item.tenancyName))
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(dark ? Color(hex: "2f343b") : Color(hex: "eef1f5"))
                    )
                Image(systemName: "link")
                    .font(.system(size: 10))
                    .foregroundColor(AppTheme.sidebarText(dark).opacity(0.7))
            }
            .frame(width: width, alignment: .center)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .help(item.tenancyName.isEmpty ? "—" : item.tenancyName)
    }

    private func nameCell(_ item: InstanceItem, width: CGFloat) -> some View {
        let remark = item.remark.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasRemark = !remark.isEmpty && remark != "未设置" && remark != "—"
        // 对齐 Web：状态点 + 实例名称（单行）
        return HStack(spacing: 8) {
            // 统一 MenuPulseDot：5pt + 运行中呼吸动效（对齐实例弹窗 header / Web StatusDot）
            MenuPulseDot(color: statusColor(item), pulse: item.isRunning)
            Text(item.displayName.isEmpty ? "—" : item.displayName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(width: width, alignment: .center)
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            model.openUpdateName(item)
        }
        .help(hasRemark
              ? "\(item.displayName)\n备注：\(remark)\n双击修改名称"
              : "\(item.displayName)\n双击修改名称")
    }

    private func statusColor(_ item: InstanceItem) -> Color {
        StatusTone.fromState(item.state).color(dark: dark)
    }

    private func ipCell(_ item: InstanceItem, width: CGFloat) -> some View {
        let priv = item.privateIps.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasPriv = !priv.isEmpty && priv != "—" && priv != "-"
        return Button(action: { model.copyText(item.publicIps, label: "IPv4") }) {
            Text(item.publicIps.isEmpty ? "—" : item.publicIps)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(item.publicIps.isEmpty ? AppTheme.sidebarText(dark) : AppTheme.cyan)
                .lineLimit(1)
                .frame(width: width, alignment: .center)
                .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .help(
            item.publicIps.isEmpty
                ? (hasPriv ? "无公网 IP · 内网 \(priv)" : "无公网 IP")
                : (hasPriv ? "点击复制 IPv4 · 内网 \(priv)" : "点击复制 IPv4")
        )
    }

    private func ipv6Cell(_ item: InstanceItem, width: CGFloat) -> some View {
        Group {
            if item.hasIpv6 {
                Button(action: { model.copyText(item.ipv6Addresses, label: "IPv6") }) {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                        Text("已启用")
                            .font(.system(size: 11))
                    }
                    .foregroundColor(AppTheme.sidebarActive)
                    .contentShape(Rectangle())
                }
                .buttonStyle(PlainButtonStyle())
                .help("点击复制 IPv6：\(item.ipv6Addresses)")
            } else {
                Text("未启用")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
        }
        .frame(width: width, alignment: .center)
    }

    /// 行内操作：对齐 Web 单个"..."按钮（点击弹出完整操作菜单）
    private func actionBar(_ item: InstanceItem) -> some View {
        InstanceActionMoreButton(dark: dark, item: item, model: model)
            .environmentObject(appearance)
            .frame(width: 28, height: 28)
    }
}
// MARK: - Action menu data

struct InstanceActionItem: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let isDanger: Bool
    let tone: Tone
    let action: () -> Void

    enum Tone {
        case accent    // 启动/SSH/启用IPv6
        case orange    // 停止/重装
        case danger    // 终止/删除
        case info      // 复制/网络
        case gray      // VPU 等中性
        case `default` // 其余
    }
}

enum InstanceActionPanel {
    /// 扁平操作列表（每行两个，无模块分区）
    static func actions(for row: InstanceItem, model: InstancesViewModel) -> [InstanceActionItem] {
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
            tone: InstanceActionItem.Tone = .default,
            _ body: @escaping @MainActor () -> Void
        ) -> InstanceActionItem {
            InstanceActionItem(
                id: id, title: title, systemImage: icon,
                isDanger: danger, tone: danger ? .danger : tone, action: run(body)
            )
        }

        var items: [InstanceActionItem] = []
        if row.isStopped {
            items.append(make("start", "启动实例", "play.fill", tone: .accent) { model.confirmStart(row) })
        } else if row.isRunning {
            items.append(make("stop", "停止实例", "stop.fill", tone: .orange) { model.confirmStop(row) })
        }
        items.append(contentsOf: [
            make("remark", "修改备注", "note.text") { model.openUpdateRemark(row) },
            make("name", "编辑名称", "tag") { model.openUpdateName(row) },
            make("cfg", "修改配置", "cpu") { model.openUpdateConfig(row) },
            make("boot", "调整磁盘", "externaldrive") { model.openUpdateBoot(row) },
            make("vpu", "调整 VPU", "slider.horizontal.3", tone: .gray) { model.openUpdateVpu(row) },
            make("copy4", "复制 IPv4", "doc.on.doc", tone: .info) {
                model.copyText(row.publicIps, label: "IPv4")
            },
            make("chgip", "切换IPv4", "arrow.triangle.2.circlepath") {
                model.openChangeIp(row)
            }
        ])
        if row.hasIpv6 {
            items.append(make("copy6", "复制 IPv6", "doc.on.doc", tone: .info) {
                model.copyText(row.ipv6Addresses, label: "IPv6")
            })
            items.append(make("mg6", "管理 IPv6", "globe") {
                model.enableIpv6(row)
            })
        } else {
            items.append(make("en6", "开启 IPv6", "plus.circle", tone: .accent) {
                model.enableIpv6(row)
            })
        }
        if !row.privateIps.isEmpty, row.privateIps != "—", row.privateIps != "-" {
            items.append(make("copypriv", "复制内网 IP", "network", tone: .info) {
                model.copyText(row.privateIps, label: "内网 IP")
            })
        }
        items.append(contentsOf: [
            make("ssh", "终端连接", "terminal", tone: .accent) { model.openSSH(row) },
            make("console", "控制终端", "tv") { model.openConsole(row) },
            make("vnic", "网络管理", "network") { model.openVnic(row) },
            make("dd", "系统重置", "arrow.counterclockwise", tone: .orange) { model.openOsReset(row) },
            make("term", "终止实例", "xmark.octagon", danger: true) {
                model.openTerminate(row)
            },
            make("del", "删除记录", "trash", danger: true) {
                model.confirmDeleteRecord(row)
            }
        ])
        return items
    }
}

// MARK: - 窗内操作菜单（不使用 NSMenu/NSPopover，保证在应用窗口内）

private enum InstanceActionMenuLayout {
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
        // 对齐 Web：外层 padding(左右4) + header + 项目行，去掉多余空隙
        return vPad * 2 + titleH + 4
            + CGFloat(rows) * rowH + CGFloat(max(0, rows - 1)) * gridGap
    }

    static func panelFrame(button: NSView, in container: NSView, itemCount: Int) -> NSRect {
        let ideal = idealHeight(itemCount: itemCount)
        let btn = button.convert(button.bounds, to: container)
        let bounds = container.bounds

        var h = min(ideal, bounds.height)
        h = max(minHeight, h)

        // 对齐 Web：菜单右缘对齐按钮右缘；下方 6px 缝隙；下方放不下翻到上方。
        var x = btn.maxX - width
        if x < bounds.minX { x = bounds.minX + margin }
        if x + width > bounds.maxX { x = bounds.maxX - width - margin }

        let spaceBelow = btn.minY - bounds.minY   // 按钮下方剩余（非 flipped，小 y 为下）
        let spaceAbove = bounds.maxY - btn.maxY   // 按钮上方剩余
        var y: CGFloat

        if spaceBelow >= h + gap {
            // 放得下：紧贴按钮下方（y = 按钮底 - gap - 高）
            y = btn.minY - gap - h
        } else if spaceAbove >= h + gap {
            // 翻到按钮上方
            y = btn.maxY + gap
        } else {
            // 两侧都放不下：优先填满下方，否则贴边
            y = max(bounds.minY + margin, btn.minY - gap - h)
        }
        y = max(bounds.minY + margin, y)
        if y + h > bounds.maxY - margin { y = bounds.maxY - margin - h }

        return NSRect(x: x, y: y, width: width, height: h)
    }
}

/// 实例行操作菜单（窗内浮层）。
/// 注意：禁止用全窗口 ClickCatcher NSView 吞鼠标——若 dismiss 失败会整窗假死（进控制台后按钮全无响应）。
@MainActor
final class InstanceActionMenuPresenter {
    static let shared = InstanceActionMenuPresenter()

    /// 强引用直到 dismiss，避免 weak 丢失后浮层残留
    private var panelHost: NSView?
    private var keyMonitor: Any?
    private var mouseMonitor: Any?
    /// 打开菜单的按钮（dismiss 时恢复高亮）
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

    /// 打开菜单时按钮变主题色高亮，关闭时恢复（对齐 Web menuFor accent）
    private func setButtonHighlight(_ button: NSButton, highlighted: Bool, dark: Bool) {
        guard let layer = button.layer else { return }
        let accent = NSColor(AppTheme.sidebarActive)
        if highlighted {
            layer.backgroundColor = accent.cgColor
            button.contentTintColor = .white
        } else {
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.16, green: 0.18, blue: 0.20, alpha: 1)
                : NSColor(calibratedRed: 0.96, green: 0.97, blue: 0.98, alpha: 1)).cgColor
            button.contentTintColor = dark
                ? NSColor.white.withAlphaComponent(0.9)
                : NSColor.labelColor
        }
    }

    func toggle(
        from button: NSButton,
        item: InstanceItem,
        model: InstancesViewModel,
        appearance: AppearanceController,
        dark: Bool
    ) {
        if isPresented {
            dismiss()
            return
        }
        guard let window = button.window, let content = window.contentView else { return }
        // 先清掉可能残留的浮层
        dismiss()

        let actions = InstanceActionPanel.actions(for: item, model: model)
        let frame = InstanceActionMenuLayout.panelFrame(
            button: button,
            in: content,
            itemCount: actions.count
        )

        // 打开菜单时按钮高亮为主题色（对齐标准 activeButton 变绿）
        activeButton = button
        activeDark = dark
        setButtonHighlight(button, highlighted: true, dark: dark)

        let root = InstanceActionMenuContent(
            item: item,
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
        let gap2 = InstanceActionMenuLayout.gap
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

        // Esc 关闭
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 {
                self?.dismiss()
                return nil
            }
            return event
        }

        // 点击菜单外关闭：只监视、不吞事件，避免挡死顶栏/侧栏/返回按钮
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self = self, let host = self.panelHost else { return event }
            let loc = event.locationInWindow
            let frameInWindow = host.convert(host.bounds, to: nil)
            // 点击再次点击"..."按钮本体时交给按钮 toggle 处理（关闭），不在此 dismiss
            if let btn = self.activeButton {
                let btnFrame = btn.convert(btn.bounds, to: nil)
                if btnFrame.contains(loc) { return event }
            }
            if !frameInWindow.contains(loc) {
                // 异步 dismiss，让本次点击继续落到下层控件
                DispatchQueue.main.async { self.dismiss() }
            }
            return event
        }
    }
}

struct InstanceActionMenuContent: View {
    var item: InstanceItem
    let dark: Bool
    var panelHeight: CGFloat = 280
    let actions: [InstanceActionItem]
    let onDismiss: () -> Void

    @EnvironmentObject private var appearance: AppearanceController
    @State private var hoveredId: String?

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: InstanceActionMenuLayout.gridGap),
         GridItem(.flexible(), spacing: InstanceActionMenuLayout.gridGap)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 对齐标准 header：状态点（运行中脉冲动效）+ 实例名（无重复灰块/项数）
            HStack(spacing: 6) {
                MenuPulseDot(color: itemStateColor, pulse: item.isRunning)
                Text(item.displayName.isEmpty ? "—" : item.displayName)
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
        .frame(width: InstanceActionMenuLayout.width, height: panelHeight, alignment: .topLeading)
        .background(AppTheme.pageBg(dark))
        .cornerRadius(12)
    }

    private var itemStateColor: Color {
        StatusTone.fromState(item.state).color(dark: dark)
    }

    private func actionButton(_ act: InstanceActionItem) -> some View {
        let hovered = hoveredId == act.id
        let effTone: InstanceActionItem.Tone = act.isDanger ? .danger : act.tone
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
            .foregroundColor(toneColor(effTone))
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
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredId = inside ? act.id : (hoveredId == act.id ? nil : hoveredId)
            }
        }
    }

    private func toneColor(_ tone: InstanceActionItem.Tone) -> Color {
        switch tone {
        case .accent: return AppTheme.sidebarActive
        case .orange: return AppTheme.orange
        case .danger: return AppTheme.danger
        case .info:   return AppTheme.cyan
        case .gray:   return AppTheme.sidebarText(dark).opacity(0.75)
        case .default: return dark ? Color.white.opacity(0.9) : Color.primary
        }
    }

    private func buttonFill(act: InstanceActionItem, hovered: Bool) -> Color {
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

private struct InstanceActionMoreButton: NSViewRepresentable {
    let dark: Bool
    let item: InstanceItem
    @ObservedObject var model: InstancesViewModel
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
                ? NSColor(calibratedRed: 0.16, green: 0.18, blue: 0.20, alpha: 1)
                : NSColor(calibratedRed: 0.96, green: 0.97, blue: 0.98, alpha: 1)).cgColor
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
            layer.cornerRadius = 4
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.16, green: 0.18, blue: 0.20, alpha: 1)
                : NSColor(calibratedRed: 0.96, green: 0.97, blue: 0.98, alpha: 1)).cgColor
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
    }

    final class Coordinator: NSObject {
        var item: InstanceItem
        var model: InstancesViewModel
        var appearance: AppearanceController
        var dark: Bool

        init(item: InstanceItem, model: InstancesViewModel, appearance: AppearanceController, dark: Bool) {
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
                InstanceActionMenuPresenter.shared.toggle(
                    from: btn, item: it, model: m, appearance: ap, dark: d
                )
            }
        }
    }
}
