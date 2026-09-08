import SwiftUI

/// Web-parity page for `/resource/list` (`arm_records.ftl` + `arm_records.js`).
/// Title on web: 开机区域监控（侧栏「OCI区域管理」/ Mac「区域订阅」）.
struct RegionsView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = RegionsViewModel()
    @StateObject private var worldMap = WorldMapData()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        // Web：整页 flex column，卡片占满剩余高度（minHeight:0），分页钉在卡片底部
        VStack(alignment: .leading, spacing: 20) {
            header
            if let err = model.errorText, !err.isEmpty {
                errorBanner(err)
            }
            statsGrid
            tabsCard
            if model.mapMode == .map {
                ScrollView {
                    mapCard
                }
                .frame(maxHeight: .infinity, alignment: .top)
            } else {
                listCard
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RegionsTheme.bg(dark).ignoresSafeArea())
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear {
            model.start()
            worldMap.load(baseURL: session.serverURL)
        }
        .onDisappear { model.stop() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.refresh() }
        }
        .sheet(item: $model.detailRegion) { row in
            RegionDetailSheet(row: row, model: model, dark: dark) {
                model.closeRegionDetail()
            }
        }
        .environmentObject(appearance)
    }

    // MARK: - Header

    /// Web PageHeader：bg-1 卡 radius 8 padding 14px 20px · icon 32(18% info 底) · 标题 17/600
    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.info.opacity(0.18))
                        .frame(width: 32, height: 32)
                    Image(systemName: "globe")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.info)
                }
                Text("区域管理")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(RegionsTheme.text(dark))
                    .tracking(-0.2)
            }
            Spacer()
            HStack(spacing: 6) {
                RegionsPulseDot(color: AppTheme.sidebarActive)
                Text(model.lastUpdateText)
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundColor(RegionsTheme.text(dark).opacity(0.86))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(RegionsTheme.surface2(dark))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(RegionsTheme.border(dark), lineWidth: 1))
            )
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(RegionsTheme.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(RegionsTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.refresh() } }
                .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(RegionsTheme.red(dark))
        .padding(12)
        .background(RegionsTheme.red(dark).opacity(0.1))
        .cornerRadius(10)
    }

    // MARK: - Stats

    private var statsGrid: some View {
        HStack(spacing: 14) {
            // Web icon=map-pin（Lucide 泪滴定位针，SF mappin 形状不符）
            statCard(lucide: "map-pin", color: AppTheme.info,
                     title: "总区域数", value: "\(model.totalRegions)")
            statCard(icon: "checkmark.circle", color: AppTheme.sidebarActive,
                     title: "已开 ARM 架构区域数", value: "\(model.openArmCount)")
            statCard(icon: "bell.fill",
                     color: model.todayNewCount > 0 ? RegionsTheme.orange(dark) : RegionsTheme.muted(dark),
                     title: "今日新开机区域数", value: "\(model.todayNewCount)")
        }
    }

    /// Web KPICard 布局：图标 36×36（18% 软底）+ 右侧「上标签 11 / 下数值 22·700」
    private func statCard(icon: String? = nil, lucide: String? = nil, color: Color, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.18))
                    .frame(width: 36, height: 36)
                if let lucide = lucide {
                    MenuGlyph(name: lucide, size: 16, color: color)
                } else if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(color)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(RegionsTheme.muted(dark))
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(RegionsTheme.text(dark))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RegionsTheme.surface(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RegionsTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// Web：数量 + 三分段 tab（check-circle-2 / user-check / map）的独立卡片
    private var tabsCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(AppTheme.infoSoft(dark))
                    .frame(width: 28, height: 28)
                Image(systemName: "globe")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppTheme.info)
            }
            HStack(spacing: 4) {
                Text("数量:")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(RegionsTheme.text(dark).opacity(0.86))
                Text("\(model.filteredRows.count)")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarActive)
            }

            Spacer(minLength: 8)

            HStack(spacing: 4) {
                tabSegment(Image(systemName: "checkmark.circle.fill"), "ARM 放货区域", mode: .arm)
                tabSegment(Image(systemName: "person.fill.checkmark"), "我的区域", mode: .mine)
                tabSegment(
                    AnyView(MenuGlyph(
                        name: "map",
                        size: 12,
                        color: model.mapMode == .map ? .white : RegionsTheme.text(dark).opacity(0.85)
                    )),
                    "显示地图", mode: .map
                )
            }
            .padding(3)
            .background(RegionsTheme.surface2(dark))
            .cornerRadius(6)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(RegionsTheme.border(dark), lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(RegionsTheme.surface(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RegionsTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// 三分段 tab：激活 = info 实心白字（对齐 Web page-regions.jsx:318-319）
    private func tabSegment<I: View>(_ icon: I, _ title: String, mode: RegionsMapViewMode) -> some View {
        let active = model.mapMode == mode
        return Button(action: { model.mapMode = mode }) {
            HStack(spacing: 6) {
                icon.font(.system(size: 12, weight: .medium))
                Text(title)
                    .font(.system(size: 12, weight: active ? .medium : .regular))
                    .fixedSize()
            }
            .foregroundColor(active ? .white : RegionsTheme.text(dark).opacity(0.85))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 4).fill(active ? AppTheme.info : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Map card（Web 地图 tab）

    /// Web 地图 tab：全球放货地图 Card（headerIcon map/info + 世界地图 + 图例）
    private var mapCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(AppTheme.info.opacity(0.12))
                        .frame(width: 38, height: 38)
                    MenuGlyph(name: "map", size: 16, color: AppTheme.info)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("全球放货地图")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(RegionsTheme.text(dark))
                    Text("节点大小表示历史开机次数;橙色节点表示今日新增放货")
                        .font(.system(size: 11))
                        .foregroundColor(RegionsTheme.muted(dark))
                }
            }

            RegionWorldMapView(
                world: worldMap,
                nodes: mapNodes,
                dark: dark,
                onNodeTap: { node in
                    if let row = model.filteredRows.first(where: { $0.regionCode == node.code }) {
                        model.openRegionDetail(row)
                    }
                }
            )
            .aspectRatio(2, contentMode: .fit)

            // Web 图例：已放货=accent 光晕 · 今日新放货=orange 光环 · 未放货=fg-3 小点
            HStack(spacing: 20) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(AppTheme.sidebarActive)
                        .frame(width: 10, height: 10)
                        .shadow(color: AppTheme.sidebarActive, radius: 4)
                    Text("已放货区域").font(.system(size: 11)).foregroundColor(RegionsTheme.text(dark).opacity(0.75))
                }
                HStack(spacing: 6) {
                    Circle()
                        .fill(AppTheme.orange)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(AppTheme.orange.opacity(0.25), lineWidth: 4))
                    Text("今日新放货").font(.system(size: 11)).foregroundColor(RegionsTheme.text(dark).opacity(0.75))
                }
                HStack(spacing: 6) {
                    Circle().fill(RegionsTheme.muted(dark)).frame(width: 5, height: 5)
                    Text("未放货区域").font(.system(size: 11)).foregroundColor(RegionsTheme.text(dark).opacity(0.75))
                }
                Spacer(minLength: 8)
                Text("悬停节点查看详情 · 节点半径 ∝ √(历史开机数)")
                    .font(.system(size: 10.5))
                    .foregroundColor(RegionsTheme.muted(dark))
            }
            .padding(.top, 12)
            .overlay(Rectangle().fill(RegionsTheme.border(dark)).frame(height: 1), alignment: .top)
        }
        .padding(20)
        .background(RegionsTheme.surface(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RegionsTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// Web：地图节点来自筛选后的行（搜索/大洲/状态联动）
    private var mapNodes: [RegionMapNode] {
        model.filteredRows.compactMap { row in
            guard let ll = RegionLngLat.table[row.regionCode] else { return nil }
            return RegionMapNode(
                code: row.regionCode,
                name: row.name,
                arch: row.architectureType,
                released: row.isOpen,
                totalGrabs: row.openCount,
                todayGrabs: row.todayGrabs,
                firstAt: row.openTime ?? "—",
                lng: ll[0],
                lat: ll[1]
            )
        }
    }

    private var listCard: some View {
        // Web 结构：卡片 = flex column（占满剩余高度）— 筛选栏固定 / 表格区 flex:1 内部滚动 / 分页 flexShrink:0 钉底
        // ZStack so filter dropdown can float above the table without pushing rows.
        ZStack(alignment: .topLeading) {
            // Table block (full card content, with top inset for the filter row)
            VStack(alignment: .leading, spacing: 0) {
                // Spacer matching filter row height（筛选栏自带 10/16 内边距）
                Color.clear
                    .frame(height: AppInputStyle.height + 20)
                    .overlay(Rectangle().fill(RegionsTheme.border(dark)).frame(height: 1), alignment: .bottom)

                HStack(spacing: 0) {
                    col("状态", 80)
                    colFlexible("区域编码")
                    colFlexible("区域名称")
                    col("架构类型", 90)
                    colFlexible("开机时间")
                    col("总开机数量", 90)
                    col("本月开机数量", 100)
                    colFlexible("最近开机时间")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                .padding(.horizontal, 8)
                .background(RegionsTheme.surface(dark))
                .overlay(Rectangle().fill(RegionsTheme.border(dark)).frame(height: 1), alignment: .bottom)

                // 表格区 — 占剩余空间，内部滚动（Web: flex:1 + overflow auto）
                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: 0) {
                        if model.pageRows.isEmpty {
                            Text(model.isLoading ? "加载中..." : "没有找到匹配的区域")
                                .font(.system(size: 13))
                                .foregroundColor(RegionsTheme.muted(dark))
                                .frame(maxWidth: .infinity)
                                .padding(40)
                        } else {
                            ForEach(model.pageRows) { row in
                                regionRow(row)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .frame(maxHeight: .infinity, alignment: .top)

                // 分页 — 固定卡片底部（Web: flexShrink 0 + borderTop，PaginationBar 自带分隔线）
                PaginationBar(state: $model.pageState) {
                    model.goPage { _ in }
                }
            }

            // Filter row on top layer — SelectMenu panel floats over the table
            HStack(alignment: .top, spacing: 10) {
                SearchField(
                    text: $model.searchText,
                    placeholder: "搜索区域…",
                    maxWidth: 280
                )

                SelectMenu(
                    options: continentOptions,
                    selection: continentSelection,
                    placeholder: "全部大洲",
                    width: 132,
                    allowClear: false
                )
                SelectMenu(
                    options: statusOptions,
                    selection: statusSelection,
                    placeholder: "全部状态",
                    width: 120,
                    allowClear: false
                )

                Spacer(minLength: 0)
                if model.isLoading {
                    ProgressView().scaleEffect(0.7)
                        .frame(width: 20, height: AppInputStyle.height)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .zIndex(50)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Web：卡片自身无 padding，筛选/表格/分页通铺到卡片边缘
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(RegionsTheme.surface(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(RegionsTheme.border(dark), lineWidth: 1)
        )
    }

    private var continentOptions: [SelectOption] {
        RegionContinent.allCases.map { SelectOption(id: $0.rawValue, title: $0.title) }
    }

    private var statusOptions: [SelectOption] {
        RegionStatusFilter.allCases.map { SelectOption(id: $0.rawValue, title: $0.title) }
    }

    private var continentSelection: Binding<String?> {
        Binding(
            get: { model.continent.rawValue },
            set: { raw in
                if let raw = raw, let c = RegionContinent(rawValue: raw) {
                    model.continent = c
                } else {
                    model.continent = .all
                }
            }
        )
    }

    private var statusSelection: Binding<String?> {
        Binding(
            get: { model.statusFilter.rawValue },
            set: { raw in
                if let raw = raw, let s = RegionStatusFilter(rawValue: raw) {
                    model.statusFilter = s
                } else {
                    model.statusFilter = .all
                }
            }
        )
    }

    // Web 行：状态徽章（accent-soft+脉冲）· 代码列 mono accent · 数量分级变色 · 架构徽章 · 本月橙色
    @State private var hoveredRegion: String?

    private func regionRow(_ row: RegionRow) -> some View {
        HStack(spacing: 0) {
            regionBadge(open: row.isOpen)
                .frame(width: 80, alignment: .center)
            monoCellFlexible(row.regionCode, color: AppTheme.sidebarActive, size: 11.5)
            cellFlexible(row.name)
            archBadge(row.architectureType)
                .frame(width: 90, alignment: .center)
            monoCellFlexible(Self.fmt(row.openTime), color: RegionsTheme.text(dark).opacity(0.72))
            grabCountCell(row.openCount, width: 90)
            monthlyCell(row.monthlyOpenCount)
                .frame(width: 100, alignment: .center)
            monoCellFlexible(Self.fmt(row.lastNotifyTime), color: RegionsTheme.text(dark).opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, appearance.density.rowPadding)
        .padding(.horizontal, 8)
        .background(
            // Web ui.jsx Table 行 hover：var(--bg-2)
            Rectangle().fill(hoveredRegion == row.regionCode ? AppTheme.sidebarHover(dark) : Color.clear)
        )
        .overlay(Rectangle().fill(RegionsTheme.border(dark).opacity(0.6)).frame(height: 1), alignment: .bottom)
        .contentShape(Rectangle())
        .onTapGesture { model.openRegionDetail(row) }
        .onHover { hoveredRegion = $0 ? row.regionCode : nil }
    }

    /// Web StatusDot running pulse + accent-soft 底徽章（圆角 4）
    private func regionBadge(open: Bool) -> some View {
        HStack(spacing: 5) {
            if open {
                RegionsPulseDot(color: AppTheme.sidebarActive, size: 5)
            } else {
                Circle().fill(RegionsTheme.muted(dark).opacity(0.6)).frame(width: 5, height: 5)
            }
            Text(open ? "已放货" : "未放货")
                .font(.system(size: 11))
                .foregroundColor(open ? AppTheme.sidebarActive : RegionsTheme.muted(dark))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(open ? AppTheme.sidebarActive.opacity(0.14) : RegionsTheme.muted(dark).opacity(0.12))
        )
    }

    /// Web：info-soft 底 + info 色 mono 徽章
    private func archBadge(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .foregroundColor(AppTheme.info)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(AppTheme.info.opacity(0.14))
            )
    }

    /// Web 总开机数量分级：>100 accent · >20 fg-0 · >0 fg-1 · 0 fg-3
    private func grabCountCell(_ count: Int, width: CGFloat) -> some View {
        let color: Color = count > 100
            ? AppTheme.sidebarActive
            : (count > 20 ? RegionsTheme.text(dark) : (count > 0 ? RegionsTheme.text(dark).opacity(0.85) : RegionsTheme.muted(dark)))
        return Text("\(count)")
            .font(.system(size: 12, weight: count > 0 ? .semibold : .regular))
            .foregroundColor(color)
            .lineLimit(1)
            .frame(width: width, alignment: .center)
    }

    /// Web 本月开机数量：>0 orange 加粗，0 fg-3
    private func monthlyCell(_ count: Int) -> some View {
        Text("\(count)")
            .font(.system(size: 12, weight: count > 0 ? .semibold : .regular))
            .foregroundColor(count > 0 ? RegionsTheme.orange(dark) : RegionsTheme.muted(dark))
            .lineLimit(1)
    }

    /// 弹性列头（占满剩余宽度，让内容更长的列吸收多余空间；内容居中，与固定列统一）
    private func colFlexible(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(RegionsTheme.muted(dark))
            .frame(maxWidth: .infinity, alignment: .center)
    }

    /// 固定宽列头（短内容列，如状态/架构/数量）
    private func col(_ title: String, _ w: CGFloat) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(RegionsTheme.muted(dark))
            .frame(width: w, alignment: .center)
    }

    /// 弹性单元格（占满剩余空间，居中，截断 + hover 显示完整）
    private func cellFlexible(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundColor(RegionsTheme.text(dark))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .center)
            .clipped()
            .help(text)
    }

    /// 弹性等宽字体单元格（占满剩余空间，居中，截断 + hover 显示完整）
    private func monoCellFlexible(_ text: String,
                                  color: Color? = nil,
                                  size: CGFloat = 12) -> some View {
        Text(text)
            .font(.system(size: size, design: .monospaced))
            .foregroundColor(color ?? RegionsTheme.text(dark).opacity(0.72))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .center)
            .clipped()
            .help(text)
    }

    private static func fmt(_ s: String?) -> String {
        guard let s = s, !s.isEmpty else { return "—" }
        return s
    }

    private static func isToday(_ s: String?) -> Bool {
        guard let s = s, let d = parseDate(s) else { return false }
        return Calendar.current.isDateInToday(d)
    }

    private static func parseDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }
}

/// Web StatusDot 的 pulse 动画圆点。
private struct RegionsPulseDot: View {
    var color: Color
    var size: CGFloat = 6
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .scaleEffect(pulse ? 1.0 : 0.72)
            .opacity(pulse ? 1.0 : 0.55)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}

// MARK: - Theme（对齐 Web index.html oklch CSS 变量）

enum RegionsTheme {
    static func bg(_ dark: Bool) -> Color { dark ? Color(hex: "060a0d") : Color(hex: "f8fafd") }
    static func surface(_ dark: Bool) -> Color { dark ? Color(hex: "0d1216") : Color.white }
    static func surface2(_ dark: Bool) -> Color { dark ? Color(hex: "151c21") : Color(hex: "f1f4f6") }
    static func border(_ dark: Bool) -> Color { dark ? Color(hex: "232a2f") : Color(hex: "d9dfe3") }
    static func text(_ dark: Bool) -> Color { dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217") }
    static func muted(_ dark: Bool) -> Color { dark ? Color(hex: "5d646a") : Color(hex: "81878c") }
    static func orange(_ dark: Bool) -> Color { Color(hex: "ef852e") }
    static func red(_ dark: Bool) -> Color { Color(hex: "f05653") }
}
