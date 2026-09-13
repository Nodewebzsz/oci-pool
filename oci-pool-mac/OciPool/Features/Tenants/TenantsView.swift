import SwiftUI
import AppKit

/// 原生租户管理（AppKit 壳 + SwiftUI 内容，与 Dashboard/Regions 同一路径）。
struct TenantsView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = TenantsViewModel()
    /// 列表行 hover 高亮（对齐实例列表：悬停行高亮；弹窗打开时不触发）。租户 id 为 Int64。
    @State private var hoveredRowId: Int64?

    private var dark: Bool { appearance.isDarkEffective }

    // 固定列（合计外的剩余宽度分给名称/自定义名/主区域）
    /// 代理绑定护盾列（对齐 Web：替换原 # 序号列）
    private let wProxy: CGFloat = 40
    private let wCost: CGFloat = 56
    private let wDays: CGFloat = 56
    private let wTask: CGFloat = 72
    private let wMulti: CGFloat = 56
    private let wType: CGFloat = 96
    private let wCreate: CGFloat = 68
    private let wTime: CGFloat = 128
    private let wStatus: CGFloat = 56
    private let wAction: CGFloat = 52
    private let hPad: CGFloat = 12
    private let minNameShownFloor: CGFloat = 128
    private let minDefShown: CGFloat = 120
    private let minRegionShown: CGFloat = 68

    /// 显示全名时压缩固定列，把宽度让给名称（单行不换行）
    private func colMetrics(namesHidden: Bool) -> (
        cost: CGFloat, days: CGFloat, task: CGFloat, multi: CGFloat,
        type: CGFloat, create: CGFloat, time: CGFloat,
        minName: CGFloat, minDef: CGFloat, minRegion: CGFloat
    ) {
        // 名称/自定义名/区域列宽不随脱敏切换变化（对齐 Web：固定列宽防抖动）
        // 名称列固定用完整名宽度；脱敏时内容省略但列宽恒定
        return (wCost, wDays, wTask, wMulti, wType, max(wCreate, 96), wTime,
                minNameShownFloor, minDefShown, minRegionShown)
    }

    /// 按最长租户名单行估算名称列宽（约 12pt 等宽字符）。
    /// 上限收紧到合理值，避免租户名列被最长租户名撑得远宽于自定义名称列（对齐 Web 租户名列固定较窄）。
    private func estimatedNameWidth(for items: [TenantItem], floor: CGFloat) -> CGFloat {
        let longest = items.map(\.displayName).max(by: { $0.count < $1.count }) ?? ""
        // 中文偏宽、英文偏窄，取折中系数
        let estimated = CGFloat(longest.count) * 8.0 + 12
        return max(floor, min(estimated, 150))
    }

    private func fixedColsWidth(m: (
        cost: CGFloat, days: CGFloat, task: CGFloat, multi: CGFloat,
        type: CGFloat, create: CGFloat, time: CGFloat,
        minName: CGFloat, minDef: CGFloat, minRegion: CGFloat
    )) -> CGFloat {
        wProxy + m.cost + m.days + m.task + m.multi + m.type + m.create + m.time
            + wStatus + wAction + m.minName + m.minDef + m.minRegion + hPad * 2
    }

    var body: some View {
        Group {
            if model.bootPageParent != nil {
                TenantBootCreateView(model: model)
            } else if model.detailParent != nil {
                // Web 整页：/tenants/regionList → 租户详情
                TenantDetailView(model: model)
            } else if model.trafficParent != nil {
                // Web 整页：/monitor/homePage → 实例流量监控
                TenantTrafficView(model: model)
            } else if model.auditParent != nil {
                // 审计日志：从弹框改为整页（对齐用户管理/流量查询）
                TenantAuditLogView(model: model)
            } else if model.costParent != nil {
                // Web 整页：/cost/costPage → 费用统计
                TenantCostView(model: model)
            } else if model.quotaParent != nil {
                // 账号配额：从弹框改为整页（对齐审计日志/费用统计）
                TenantQuotaView(model: model)
            } else {
                listPage
            }
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            if let p = model.userManageParent {
                Task { await model.loadUsersAndGroups(p) }
            } else if let p = model.regionSubParent {
                Task { await model.refreshRegionSub(p) }
            } else if model.detailParent != nil {
                Task { await model.reloadDetail() }
            } else if let t = model.trafficParent {
                Task { await model.queryTraffic(t) }
            } else if model.auditParent != nil {
                model.reloadAudit()
            } else if let t = model.costParent {
                Task { await model.queryCost(t) }
            } else if model.quotaParent != nil {
                // 账号配额不自动查询，需用户点击「查询」
            } else {
                Task { await model.reload() }
            }
        }
        .sheet(item: $model.activeSheet) { sheet in
            TenantSheetHost(sheet: sheet, model: model)
                .environmentObject(appearance)
                .environmentObject(session)
        }
        .environmentObject(appearance)
    }

    private var listPage: some View {
        PageScaffold(
            title: "租户管理",
            systemImage: "person.2",
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.bottom, 12)
                    }
                    // Web 表格卡：bg-1 · border · radius 8 · 表格内部滚动 + 分页钉卡底
                    VStack(spacing: 0) {
                        listBody
                        PaginationBar(state: $model.pageState) {
                            Task { await model.reload() }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.sidebarBg(dark))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppTheme.border(dark), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
    }

    // MARK: - Toolbar（对齐 Web page-tenants 页头：搜索 → 眼睛 → API 导入 → 导出 → 导入 → 检测）

    private var toolbar: some View {
        HStack(spacing: 8) {
            SearchField(
                text: $model.searchText,
                placeholder: "输入租户名或区域进行搜索...",
                maxWidth: 280
            )
            .onChange(of: model.searchText) { _ in model.onSearchChanged() }

            // Web：30px 图标按钮 · tooltip 显示/隐藏脱敏
            Button {
                model.namesHidden.toggle()
            } label: {
                Image(systemName: model.namesHidden ? "eye" : "eye.slash")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.navIcon(dark))
                    .frame(width: 30, height: 30)
                    .background(RoundedRectangle(cornerRadius: 5).fill(AppTheme.sidebarHover(dark)))
            }
            .buttonStyle(PlainButtonStyle())
            .help("显示/隐藏脱敏")

            AppButton(title: "API 导入", systemImage: "bolt.fill", kind: .primary) {
                model.openAdd()
            }
            AppButton(title: "导出租户数据", systemImage: "square.and.arrow.down", kind: .cyan) {
                model.openExportAll()
            }
            AppButton(title: "导入租户数据", systemImage: "square.and.arrow.up", kind: .info) {
                model.importJSON()
            }
            AppButton(title: "账号批量检测", systemImage: "checkmark.circle", kind: .orange) {
                model.startAccountCheck()
            }
        }
    }

    /// Web：danger-soft 底 + danger 边框 radius 6 · padding 10px 14px
    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 14))
            Text(text).font(.system(size: 12))
            Spacer()
            Button(action: { Task { await model.reload() } }) {
                Text("重试")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        RoundedRectangle(cornerRadius: 5)
                            .stroke(AppTheme.border(dark).opacity(1.6), lineWidth: 1)
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(AppTheme.danger)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(AppTheme.dangerSoft(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(AppTheme.danger, lineWidth: 1)
        )
        .cornerRadius(6)
    }

    // MARK: - List（铺满内容区）

    @ViewBuilder
    private var listBody: some View {
        GeometryReader { geo in
            let m = colMetrics(namesHidden: model.namesHidden)
            // 名称列始终按完整名估宽（脱敏切换不改变列宽，防抖动）
            let nameNeed: CGFloat = estimatedNameWidth(for: model.rows, floor: m.minName)
            // 固定列用压缩后的值；名称列至少吃到单行全名所需宽度
            let baseFixed = fixedColsWidth(m: m) - m.minName + nameNeed
            let totalW = max(geo.size.width, baseFixed)
            let flexPool = max(0, totalW - baseFixed)
            // 剩余宽度：遮罩时名称/自定义名/区域分；展开时优先名称
            // 对齐 Web：租户名列较窄、自定义名称列更宽
            let nameShare: CGFloat = 0.34
            let defShare: CGFloat = 0.46
            let regionShare: CGFloat = 1 - nameShare - defShare
            let wName = nameNeed + flexPool * nameShare
            let wDef = m.minDef + flexPool * defShare
            let wRegion = m.minRegion + flexPool * regionShare
            let cols = TenantColWidths(
                proxy: wProxy, name: wName, def: wDef, cost: m.cost, days: m.days,
                task: m.task, region: wRegion, multi: m.multi, type: m.type,
                create: m.create, time: m.time, status: wStatus, action: wAction, hPad: hPad
            )

            let needsHScroll = totalW > geo.size.width + 0.5
            // 对齐标准：表头置顶常驻 + 表体内部优雅承载 Loading / Empty / DataRow
            let table = VStack(spacing: 0) {
                // 1. 表头置顶常驻，无论加载还是空态始终可见，结构骨架稳定零抖动
                headerRow(cols: cols, width: totalW)

                // 2. 表体内容区（数据行 / 空态 / 加载态）
                ZStack {
                    if (!model.hasLoadedOnce || model.isLoading) && model.rows.isEmpty {
                        VStack(spacing: 10) {
                            Spacer()
                            ProgressView()
                            Text("正在加载租户数据…")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.sidebarText(dark))
                            Spacer()
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if model.rows.isEmpty {
                        EmptyStateView(
                            icon: "person.2",
                            title: "暂无租户",
                            subtitle: model.searchText.isEmpty ? "点击「API 导入」添加 OCI 凭据" : "无匹配结果",
                            actionTitle: model.searchText.isEmpty ? "API 导入" : "清除搜索",
                            action: {
                                if model.searchText.isEmpty { model.openAdd() }
                                else { model.searchText = ""; model.onSearchSubmit() }
                            }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                                    tenantRow(index: idx, item: row, cols: cols, width: totalW)
                                }
                            }
                        }
                        .opacity(model.isLoading ? 0.6 : 1.0)
                    }

                    // 原地刷新/分页加载时，轻量且优雅的卡片内微型指示器
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

    private func headerRow(cols: TenantColWidths, width: CGFloat) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                // 对齐 Web：盾牌图标表头（绑定代理）
                Image(systemName: "shield.fill")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark).opacity(0.55))
                    .frame(width: cols.proxy, alignment: .center)
                    .help("绑定代理")
                colHeader("租户名", cols.name)
                colHeader("自定义名称", cols.def)
                colHeader("账号成本", cols.cost)
                colHeader("存活天数", cols.days)
                colHeader("开机任务", cols.task)
                colHeader("主区域", cols.region)
            }
            HStack(spacing: 0) {
                colHeader("是否多区", cols.multi)
                colHeader("账号类型", cols.type)
                colHeader("实例操作", cols.create)
                colHeader("创建时间", cols.time)
                colHeader("账号状态", cols.status)
                colHeader("操作", cols.action, align: .center)
            }
        }
        .padding(.horizontal, cols.hPad)
        .padding(.vertical, 9)
        .frame(width: width, alignment: .leading)
        .background(AppTheme.sidebarHover(dark).opacity(0.65))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.5)),
            alignment: .bottom
        )
    }

    private func tenantRow(index: Int, item: TenantItem, cols: TenantColWidths, width: CGFloat) -> some View {
        let hovered = hoveredRowId == item.id
        return HStack(alignment: .center, spacing: 0) {
            HStack(alignment: .center, spacing: 0) {
                proxyShieldCell(item, width: cols.proxy)
                nameCell(item, width: cols.name)
                defNameCell(item, width: cols.def)
                costCell(item, width: cols.cost)
                activeDaysCell(item, width: cols.days)
                bootTaskCell(item, width: cols.task)
                cell(item.region.isEmpty ? "—" : item.region, cols.region)
            }
            HStack(alignment: .center, spacing: 0) {
                multiRegionCell(item, width: cols.multi)
                typeCell(item, width: cols.type)
                bootCell(item, width: cols.create)
                cell(item.createdAt.isEmpty ? "—" : item.createdAt, cols.time, muted: true)
                statusCell(item, width: cols.status)
                actionCell(item, width: cols.action)
            }
        }
        .padding(.horizontal, cols.hPad)
        .padding(.vertical, appearance.density.rowPadding)
        .frame(width: width, alignment: .leading)
        .contentShape(Rectangle())
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.3)),
            alignment: .bottom
        )
        .background(
            hovered
                ? AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08)
                : ((index % 2 == 1)
                   ? AppTheme.sidebarHover(dark).opacity(0.18)
                   : Color.clear)
        )
        .onHover { inside in
            // 弹窗浮层打开时不响应列表行 hover，避免悬停弹窗时底层列表误高亮
            if TenantActionMenuPresenter.shared.isPresented { return }
            withAnimation(.easeInOut(duration: 0.12)) {
                hoveredRowId = inside ? item.id : (hoveredRowId == item.id ? nil : hoveredRowId)
            }
        }
    }

    // MARK: - Cells

    /// 代理绑定护盾：橙=强制代理，绿=已绑定，灰=未绑定；点击快捷配置
    private func proxyShieldCell(_ item: TenantItem, width: CGFloat) -> some View {
        let color: Color
        let tip: String
        if item.proxyForce {
            color = Color(hex: dark ? "e67e22" : "d35400")
            tip = "强制代理已开启 · 点击配置"
        } else if item.proxyBound {
            color = AppTheme.sidebarActive
            tip = "已绑定专属代理 · 点击配置"
        } else {
            color = Color(hex: dark ? "8b949e" : "95a5a6").opacity(dark ? 0.55 : 0.65)
            tip = "未绑定专属代理 · 点击配置"
        }
        return Button(action: { model.openProxyQuick(item) }) {
            Image(systemName: "shield.fill")
                .font(.system(size: 13))
                .foregroundColor(color)
                .frame(width: width, height: 28, alignment: .center)
                .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .help(tip)
    }

    private func nameCell(_ item: TenantItem, width: CGFloat) -> some View {
        let shown = !model.namesHidden
        return Button(action: { model.namesHidden.toggle() }) {
            Text(shown ? item.displayName : item.maskedName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                // 始终单行；展开时靠加宽名称列完整显示，禁止换行
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: width, alignment: .center)
                .frame(height: 28, alignment: .center)
        }
        .buttonStyle(PlainButtonStyle())
        .help(item.displayName)
    }

    private func defNameCell(_ item: TenantItem, width: CGFloat) -> some View {
        Button(action: { model.openEditName(item) }) {
            Text(item.defNameText)
                .font(.system(size: 12))
                // Web：自定义名 fg-1，未设置为空白
                .foregroundColor(dark ? Color(hex: "ccd2d6") : Color(hex: "2d3439"))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: width, alignment: .center)
                .frame(minHeight: 20)
                .clipped()
        }
        .buttonStyle(PlainButtonStyle())
        .help(item.customAlias.isEmpty ? "" : item.customAlias)
    }

    /// Web：账号成本 0=accent 绿，>0=橙 + dashed 下划线
    private func costCell(_ item: TenantItem, width: CGFloat) -> some View {
        let nonZero = item.costText != "—" && Double(item.costText.replacingOccurrences(of: "$", with: "")) != 0
        return Button(action: { model.openEditCost(item) }) {
            Text(nonZero ? "$\(item.costText)" : item.costText)
                .font(.system(size: 12))
                .foregroundColor(item.costText == "—" ? RegionsMuted : (nonZero ? AppTheme.orange : AppTheme.sidebarActive))
                .underline(true, color: item.costText == "—" ? .clear : AppTheme.orange.opacity(0.6))
                .lineLimit(1)
                .frame(width: width, alignment: .center)
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var RegionsMuted: Color { dark ? Color(hex: "8d9398") : Color(hex: "5d646a") }

    /// Web：存活天数 info-soft 蓝色徽章
    private func activeDaysCell(_ item: TenantItem, width: CGFloat) -> some View {
        Text(item.activeDaysText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppTheme.info)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: 4).fill(AppTheme.info.opacity(0.14)))
            .frame(width: width, alignment: .center)
    }

    /// Web：有任务 = accent-soft + 脉冲圆点「进行中」，否则灰「无任务」
    private func bootTaskCell(_ item: TenantItem, width: CGFloat) -> some View {
        HStack(spacing: 5) {
            if item.openBootFlag {
                PulseDotSmall(color: AppTheme.sidebarActive)
            }
            Text(item.openTaskText)
                .font(.system(size: 11))
                .foregroundColor(item.openBootFlag ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: 999)
                .fill(item.openBootFlag ? AppTheme.sidebarActive.opacity(0.14) : Color.clear)
        )
        .frame(width: width, alignment: .center)
    }

    /// Web：多区域 = 圆点（有子区 accent）+ 是/否
    private func multiRegionCell(_ item: TenantItem, width: CGFloat) -> some View {
        HStack(spacing: 5) {
            if item.isMultiRegion {
                Circle().fill(AppTheme.sidebarActive).frame(width: 6, height: 6)
            }
            Text(item.multiRegionText)
        }
        .font(.system(size: 12))
        .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
        .frame(width: width, alignment: .center)
    }

    /// Web StatusPill：圆点 + 文字，active=accent-soft/accent
    private func statusCell(_ item: TenantItem, width: CGFloat) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(item.isActive ? AppTheme.sidebarActive : AppTheme.danger)
                .frame(width: 6, height: 6)
            Text(item.statusText)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(item.isActive ? AppTheme.sidebarActive : AppTheme.danger)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            Capsule().fill(
                item.isActive ? AppTheme.sidebarActive.opacity(0.14) : AppTheme.danger.opacity(0.14)
            )
        )
        .frame(width: width, alignment: .center)
    }

    @ViewBuilder
    private func typeCell(_ item: TenantItem, width: CGFloat) -> some View {
        if item.accountTypeName != "未知", !item.accountTypeName.isEmpty {
            Button(action: { model.activeSheet = .accountDetail(item) }) {
                // Web：trial=violet / official=cyan / 其他=orange 软底徽章
                Text(item.typeText)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(item.typeBadgeColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 4).fill(item.typeBadgeColor.opacity(0.14)))
                    .frame(width: width, alignment: .center)
            }
            .buttonStyle(PlainButtonStyle())
        } else {
            cell(item.typeText, width, muted: true)
        }
    }

    /// Web 实例操作：橙色 zap「创建实例」按钮（统一白色文字与图标，对齐 Web 端）
    @ViewBuilder
    private func bootCell(_ item: TenantItem, width: CGFloat) -> some View {
        if item.cloudType == 1 {
            Button(action: { model.openBoot(item) }) {
                HStack(spacing: 4) {
                    Image(systemName: "zap.fill").font(.system(size: 10, weight: .semibold))
                    Text("创建实例")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(AppTheme.orange)
                .cornerRadius(5)
            }
            .buttonStyle(PlainButtonStyle())
            .frame(width: width, alignment: .center)
        } else {
            cell("—", width, muted: true)
        }
    }

    /// AppKit 三点按钮 + 窗内浮层（不使用 NSPopover，避免超出应用窗口）
    private func actionCell(_ item: TenantItem, width: CGFloat) -> some View {
        // 按钮固定 28×28，外层 ZStack 按列宽展开并居中（不拉伸按钮本体）
        ZStack {
            TenantActionEllipsisButton(dark: dark, item: item, model: model)
                .environmentObject(appearance)
                .frame(width: 28, height: 28)
        }
        .frame(width: width, height: 28)
    }

    private func colHeader(_ title: String, _ w: CGFloat, align: Alignment = .center) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppTheme.sidebarText(dark))
            .frame(width: w, alignment: align)
    }

    private func cell(_ text: String, _ w: CGFloat, bold: Bool = false, muted: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 12, weight: bold ? .semibold : .regular))
            .foregroundColor(muted ? AppTheme.sidebarText(dark) : (dark ? Color.white.opacity(0.9) : Color.primary))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(width: w, alignment: .center)
            .clipped()
            .help(text)
    }
}

// MARK: - Column widths

private struct TenantColWidths {
    let proxy, name, def, cost, days, task, region, multi, type, create, time, status, action, hPad: CGFloat
}

// MARK: - AppKit ellipsis + 窗内浮层（绝不使用 NSPopover，保证在应用窗口内）

private enum TenantActionMenuLayout {
    static let width: CGFloat = 280
    static let vPad: CGFloat = 8
    static let titleH: CGFloat = 20
    static let gridGap: CGFloat = 1
    static let rowH: CGFloat = 30
    static let cols = 2
    static let margin: CGFloat = 10
    static let minHeight: CGFloat = 68
    static let gap: CGFloat = 6

    static func idealHeight(actionCount: Int) -> CGFloat {
        let rows = max(1, Int(ceil(Double(actionCount) / Double(cols))))
        // 外层 padding(上下 12) + header(高约 18) + 间距(8) + 网格行(每行约 30) + 行间距(6)
        return 24 + 18 + 8 + CGFloat(rows) * 30 + CGFloat(max(0, rows - 1)) * 6
    }

    /// 在屏幕坐标系内计算面板 frame，严格夹紧不越界。
    static func screenFrame(button: NSView, actionCount: Int, fittingHeight: CGFloat? = nil) -> NSRect {
        guard let window = button.window else { return .zero }
        let ideal = fittingHeight ?? idealHeight(actionCount: actionCount)
        let btnWin = button.convert(button.bounds, to: nil)
        let btnScreen = window.convertToScreen(btnWin)
        let screen = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)

        let h = min(ideal, screen.height - margin * 2)

        // 对齐实例/Web：菜单右缘对齐按钮右缘；下方 6px 缝隙；下方放不下翻到上方。
        var x = btnScreen.maxX - width
        if x + width > screen.maxX - margin { x = screen.maxX - margin - width }
        if x < screen.minX + margin { x = screen.minX + margin }

        let spaceBelow = btnScreen.minY - screen.minY
        let spaceAbove = screen.maxY - btnScreen.maxY
        var y: CGFloat
        if spaceBelow >= h + gap {
            y = btnScreen.minY - gap - h
        } else if spaceAbove >= h + gap {
            y = btnScreen.maxY + gap
        } else {
            y = max(screen.minY + margin, btnScreen.minY - gap - h)
        }
        y = max(screen.minY + margin, y)
        if y + h > screen.maxY - margin { y = screen.maxY - margin - h }

        return NSRect(x: x, y: y, width: width, height: h)
    }
}

/// 全局单例：浮层操作菜单（列表页 / 租户详情页 / Sheet 弹窗等全站共用）。
/// 使用轻量 NSPanel (.popUpMenu 级别) 挂载到按钮所在窗口作为 childWindow，
/// 完美兼容主窗口、Sheet 模态窗口及任意层级，无视层叠上下文和滚动遮挡，点外部自动关闭。
@MainActor
final class TenantActionMenuPresenter {
    static let shared = TenantActionMenuPresenter()

    /// 浮层面板
    private var popupPanel: NSPanel?
    private var keyMonitor: Any?
    private var mouseMonitor: Any?
    /// 打开菜单的按钮（dismiss 时恢复高亮，对齐 Boot 操作规范）
    private var activeButton: NSButton?
    private var activeDark = false

    private init() {}

    var isPresented: Bool { popupPanel != nil }

    func dismiss() {
        if let monitor = keyMonitor {
            NSEvent.removeMonitor(monitor)
            keyMonitor = nil
        }
        if let monitor = mouseMonitor {
            NSEvent.removeMonitor(monitor)
            mouseMonitor = nil
        }
        if let panel = popupPanel {
            panel.parent?.removeChildWindow(panel)
            panel.orderOut(nil)
            popupPanel = nil
        }
        if let btn = activeButton {
            setButtonHighlight(btn, highlighted: false, dark: activeDark)
            activeButton = nil
        }
    }

    /// 打开菜单时按钮变主题色高亮，关闭时恢复（对齐 Boot `menuFor` accent）
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

    /// 租户列表行菜单
    func toggle(
        from button: NSButton,
        item: TenantItem,
        model: TenantsViewModel,
        appearance: AppearanceController,
        dark: Bool
    ) {
        present(
            from: button,
            title: item.displayName,
            isActive: item.isActive,
            dark: dark,
            appearance: appearance,
            actions: TenantActionPanel.actions(for: item, model: model)
        )
    }

    /// 租户详情页行菜单（对齐 Web region_list dropdown）
    func toggleDetail(
        from button: NSButton,
        item: TenantItem,
        model: TenantsViewModel,
        appearance: AppearanceController,
        dark: Bool
    ) {
        present(
            from: button,
            title: item.displayName,
            isActive: item.isActive,
            dark: dark,
            appearance: appearance,
            actions: TenantActionPanel.detailActions(for: item, model: model)
        )
    }

    func present(
        from button: NSButton,
        title: String,
        isActive: Bool,
        dark: Bool,
        appearance: AppearanceController,
        actions: [TenantActionItem]
    ) {
        if isPresented {
            dismiss()
            return
        }
        guard let window = button.window else { return }
        dismiss()

        // 打开菜单时按钮高亮为主题色（对齐 Boot 操作规范）
        activeButton = button
        activeDark = dark
        setButtonHighlight(button, highlighted: true, dark: dark)

        let root = TenantActionMenuContent(
            displayName: title,
            isActive: isActive,
            dark: dark,
            actions: actions,
            onDismiss: { [weak self] in self?.dismiss() }
        )
        .environmentObject(appearance)

        let host = NSHostingView(rootView: root)
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

        // 使用视图的真实自适应高度计算精确屏幕 Frame
        let fittingH = host.fittingSize.height
        let exactHeight = fittingH > 30 ? fittingH : TenantActionMenuLayout.idealHeight(actionCount: actions.count)
        let screenFrame = TenantActionMenuLayout.screenFrame(
            button: button,
            actionCount: actions.count,
            fittingHeight: exactHeight
        )

        let panel = NSPanel(
            contentRect: screenFrame,
            styleMask: [.nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .popUpMenu
        panel.hasShadow = false
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.contentView = host

        window.addChildWindow(panel, ordered: .above)
        panel.orderFront(nil)
        popupPanel = panel

        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 {
                self?.dismiss()
                return nil
            }
            return event
        }

        // 监视全局点击：点击菜单外部时自动关闭菜单；若点击触发按钮本体，由按钮自身的点击回调处理
        mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self = self, let panel = self.popupPanel else { return event }
            let mouseLoc = NSEvent.mouseLocation
            if let btn = self.activeButton, let btnWin = btn.window {
                let btnWinFrame = btn.convert(btn.bounds, to: nil)
                let btnScreenRect = btnWin.convertToScreen(btnWinFrame)
                if btnScreenRect.contains(mouseLoc) { return event }
            }
            if !panel.frame.contains(mouseLoc) {
                DispatchQueue.main.async { self.dismiss() }
            }
            return event
        }
    }
}

private struct TenantActionEllipsisButton: NSViewRepresentable {
    let dark: Bool
    let item: TenantItem
    @ObservedObject var model: TenantsViewModel
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
        b.action = #selector(Coordinator.toggleMenu(_:))
        b.setButtonType(.momentaryChange)
        b.toolTip = "更多操作"
        context.coordinator.button = b
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
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
    }

    final class Coordinator: NSObject {
        var item: TenantItem
        var model: TenantsViewModel
        var appearance: AppearanceController
        var dark: Bool
        weak var button: NSButton?

        init(item: TenantItem, model: TenantsViewModel, appearance: AppearanceController, dark: Bool) {
            self.item = item
            self.model = model
            self.appearance = appearance
            self.dark = dark
        }

        @objc func toggleMenu(_ sender: NSButton) {
            let btn = sender
            let it = item
            let m = model
            let ap = appearance
            let d = dark
            DispatchQueue.main.async {
                TenantActionMenuPresenter.shared.toggle(
                    from: btn, item: it, model: m, appearance: ap, dark: d
                )
            }
        }
    }
}

// MARK: - 操作菜单数据 / UI

struct TenantActionItem: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let isDanger: Bool
    var tone: Tone = .default
    let action: () -> Void

    enum Tone {
        case accent    // 配额/强调动作（Web color: var(--accent)）
        case orange    // 橙色主题动作
        case danger    // 删除/危险动作
        case info      // 信息/复制
        case gray      // 中性
        case `default` // 其余（对齐 Web var(--fg-1) 灰）
    }
}

@MainActor
enum TenantActionPanel {
    /// 租户列表操作栏
    static func actions(for item: TenantItem, model: TenantsViewModel) -> [TenantActionItem] {
        var list: [TenantActionItem] = []
        if item.cloudType == 1, !item.isTransferred {
            if item.supportAI == 1 {
                list.append(TenantActionItem(id: "ai", title: "AI", systemImage: "sparkles", isDanger: false) {
                    model.openAI(item)
                })
            }
            list.append(contentsOf: [
                TenantActionItem(id: "boot", title: "添加开机", systemImage: "plus.circle", isDanger: false) { model.openBoot(item) },
                TenantActionItem(id: "upd", title: "账号更新", systemImage: "arrow.clockwise", isDanger: false) { model.updateTenantSSE(item) },
                TenantActionItem(id: "region", title: "租户详情", systemImage: "info.circle", isDanger: false) { model.openRegionList(item) },
                TenantActionItem(id: "sub", title: "区域订阅", systemImage: "globe", isDanger: false) { model.openRegionSub(item) },
                TenantActionItem(id: "users", title: "用户管理", systemImage: "person.2", isDanger: false) { model.openUsers(item) },
                TenantActionItem(id: "restricted", title: "切换为受限 API", systemImage: "shield.checkerboard", isDanger: false, tone: .accent) { model.openRestrictedApi(item) },
                TenantActionItem(id: "traffic", title: "流量预警", systemImage: "bell", isDanger: false) { model.openTraffic(item) },
                TenantActionItem(id: "tsearch", title: "流量查询", systemImage: "chart.bar", isDanger: false) { model.openTrafficPage(item) },
                TenantActionItem(id: "audit", title: "审计日志", systemImage: "doc.text", isDanger: false) { model.openAudit(item) },
                TenantActionItem(id: "cost", title: "账号花费", systemImage: "creditcard", isDanger: false) {
                    model.openCost(item)
                },
                TenantActionItem(id: "export", title: "导出租户", systemImage: "square.and.arrow.down", isDanger: false) { model.openExportOne(item) },
                TenantActionItem(id: "email", title: "邮箱服务", systemImage: "envelope", isDanger: false) { model.openEmail(item) },
                TenantActionItem(id: "social", title: "社媒配置", systemImage: "link", isDanger: false) { model.openSocial(item) },
                TenantActionItem(id: "quota", title: "查看配额", systemImage: "chart.bar", isDanger: false, tone: .accent) { model.openQuota(item) }
            ])
        } else if item.cloudType == 2 {
            list.append(TenantActionItem(id: "detail", title: "租户详情", systemImage: "info.circle", isDanger: false) {
                model.openRegionList(item)
            })
        }
        list.append(TenantActionItem(id: "del", title: "删除租户", systemImage: "trash", isDanger: true) {
            model.confirmDelete(item)
        })
        return list
    }

    /// 租户详情页行菜单（Web tenant_region_list dropdown）
    static func detailActions(for item: TenantItem, model: TenantsViewModel) -> [TenantActionItem] {
        var list: [TenantActionItem] = []
        if item.cloudType == 1 {
            if item.supportAI == 1 {
                list.append(TenantActionItem(id: "ai", title: "AI", systemImage: "sparkles", isDanger: false) {
                    model.openAI(item)
                })
            }
            list.append(contentsOf: [
                TenantActionItem(id: "sync", title: "同步", systemImage: "arrow.2.circlepath", isDanger: false) {
                    model.syncDetailRow(item)
                },
                TenantActionItem(id: "boot", title: "添加开机", systemImage: "plus.circle", isDanger: false) {
                    model.openBoot(item)
                },
                TenantActionItem(id: "findboot", title: "抢机任务", systemImage: "play.circle", isDanger: false) {
                    model.openBootTaskList(item)
                },
                TenantActionItem(id: "vol", title: "磁盘管理", systemImage: "externaldrive", isDanger: false) {
                    model.openVolumes(item)
                },
                TenantActionItem(id: "rules", title: "安全规则", systemImage: "shield", isDanger: false) {
                    model.openSecurityRules(item)
                },
                TenantActionItem(id: "ins", title: "实例列表", systemImage: "desktopcomputer", isDanger: false) {
                    model.openInstancesList(item)
                },
                TenantActionItem(id: "mysql", title: "数据库", systemImage: "cylinder", isDanger: false) {
                    model.openMysql(item)
                }
            ])
        } else if item.cloudType == 2 {
            list.append(contentsOf: [
                TenantActionItem(id: "boot", title: "添加开机", systemImage: "plus.circle", isDanger: false) {
                    model.openBoot(item)
                },
                TenantActionItem(id: "sync", title: "同步", systemImage: "arrow.2.circlepath", isDanger: false) {
                    model.syncDetailRow(item)
                }
            ])
        }
        return list
    }
}

/// 窗内菜单内容（对齐开机管理操作规范：扁平两列 + 悬停变绿）。
struct TenantActionMenuContent: View {
    var displayName: String = ""
    var isActive: Bool = true
    let dark: Bool
    let actions: [TenantActionItem]
    let onDismiss: () -> Void

    @EnvironmentObject private var appearance: AppearanceController
    @State private var hoveredId: String?

    private let columns = [
        GridItem(.flexible(), spacing: 6),
        GridItem(.flexible(), spacing: 6)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 对齐 Boot header：状态点（有效脉冲动效）+ 租户名/用户名
            HStack(spacing: 6) {
                MenuPulseDot(color: isActive ? AppTheme.sidebarActive : AppTheme.sidebarText(dark), pulse: isActive)
                Text(displayName.isEmpty ? "—" : displayName)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 2)

            // 操作网格：>8 项时滚动，<=8 项时自然高度平铺
            if actions.count > 8 {
                ScrollView {
                    actionGrid
                        .padding(.top, 2)
                }
                .frame(maxHeight: 250)
            } else {
                actionGrid
                    .padding(.top, 2)
            }
        }
        .padding(12)
        .frame(width: TenantActionMenuLayout.width, alignment: .topLeading)
        .background(AppTheme.pageBg(dark))
        .cornerRadius(12)
    }

    private var actionGrid: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(actions) { act in
                actionButton(act)
            }
        }
    }

    private func actionButton(_ act: TenantActionItem) -> some View {
        let hovered = hoveredId == act.id
        let effTone: TenantActionItem.Tone = act.isDanger ? .danger : act.tone
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

    private func toneColor(_ tone: TenantActionItem.Tone) -> Color {
        switch tone {
        case .accent: return AppTheme.sidebarActive
        case .danger: return AppTheme.danger
        case .info:   return AppTheme.cyan
        case .orange: return AppTheme.orange
        case .gray:   return AppTheme.sidebarText(dark).opacity(0.75)
        case .default: return dark ? Color.white.opacity(0.92) : Color.primary
        }
    }

    private func buttonFill(act: TenantActionItem, hovered: Bool) -> Color {
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

/// 小号脉冲圆点（开机任务「进行中」等场景）。
private struct PulseDotSmall: View {
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
