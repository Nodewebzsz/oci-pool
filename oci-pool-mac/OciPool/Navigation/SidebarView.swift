import SwiftUI

struct SidebarView: View {
    @EnvironmentObject private var navigation: NavigationState
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme

    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }
    private var collapsed: Bool { navigation.sidebarCollapsed }

    @State private var hoveredSection: NavSection?
    @State private var hoveredItem: NavID?
    @State private var searchCursor = 0
    @State private var searchFieldFocused = false
    @State private var escMonitor: Any?

    var body: some View {
        VStack(spacing: 0) {
            brandHeader
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(AppTheme.sidebarBg(dark))
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(AppTheme.border(dark).opacity(0.7)),
                    alignment: .bottom
                )

            if !collapsed {
                searchBar
                    .padding(.horizontal, 10)
                    .padding(.top, 10)
                    .padding(.bottom, 4)
                    // 下拉面板要盖住后面的 ScrollView 兄弟节点
                    .zIndex(10)
            }

            ScrollView {
                VStack(alignment: collapsed ? .center : .leading, spacing: 2) {
                    // Web: 搜索走下拉结果面板，侧栏列表本身不做内联过滤
                    let catalog = NavigationCatalog.filtered(
                        search: "",
                        cloudType: session.cloudProvider
                    )
                    if catalog.isEmpty {
                        Text("无匹配菜单")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarText(dark).opacity(0.7))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 24)
                    } else {
                        ForEach(catalog, id: \.0) { section, items in
                            sectionHeader(section, firstItem: items.first)
                            // 折叠:全部子项图标态;展开:手风琴(当前 section 或搜索命中时显示子项)
                            // 平滑撑开高度 + 渐隐(对齐 Web grid-template-rows/opacity)
                            let show = collapsed
                                || navigation.isSectionExpanded(section)
                                || !navigation.searchText.isEmpty
                            VStack(alignment: collapsed ? .center : .leading, spacing: 2) {
                                ForEach(items) { item in
                                    row(item)
                                }
                            }
                            .opacity(show ? 1 : 0)
                            .frame(maxHeight: show ? nil : 0, alignment: .top)
                            .clipped()
                            .animation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.24), value: show)
                        }
                    }
                }
                .padding(.vertical, 6)
                .padding(.horizontal, collapsed ? 6 : 8)
            }

            if !collapsed {
                statusFooter
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(AppTheme.sidebarBg(dark))
                    .overlay(
                        Rectangle()
                            .frame(height: 1)
                            .foregroundColor(AppTheme.border(dark).opacity(0.7)),
                        alignment: .top
                    )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.sidebarBg(dark))
        // 聚焦期间装载事件监听器：ESC 清空 + 点击搜索框以外区域失焦
        .onChange(of: searchFieldFocused) { focused in
            if focused {
                installEscMonitor()
            } else {
                removeEscMonitor()
            }
        }
        .onDisappear { removeEscMonitor() }
    }

    // Web sidebar 顶部品牌区:logo mark + 名称 + tagline;折叠时仅居中 mark
    private var brandHeader: some View {
        HStack(spacing: 10) {
            SidebarBrandMark(size: 30, accent: AppTheme.sidebarActive, cyan: Color(hex: "2fd0cc"))
            if !collapsed {
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.siteName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(AppTheme.navIcon(dark))
                        .tracking(-0.1)
                        .lineLimit(1)
                    Text("多租户池化管理")
                        .font(.system(size: 10))
                        .foregroundColor(AppTheme.sidebarText(dark))
                        .tracking(0.4)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, collapsed ? 0 : 16)
        .frame(maxWidth: .infinity, alignment: collapsed ? .center : .leading)
    }

    private var searchBar: some View {
        ZStack(alignment: .topLeading) {
            SearchField(
                text: $navigation.searchText,
                placeholder: "搜索菜单...",
                // Web MenuSearch 键盘行为：↵ 跳转光标项 · ↑↓ 移动光标 · ESC 清空关闭
                onSubmit: {
                    let results = searchResults
                    guard !results.isEmpty else { return }
                    commitSearch(results[min(searchCursor, results.count - 1)])
                },
                onEscape: { navigation.searchText = "" },
                onMoveUp: { searchCursor = max(searchCursor - 1, 0) },
                onMoveDown: {
                    let last = max(searchResults.count - 1, 0)
                    searchCursor = min(searchCursor + 1, last)
                },
                fillsWidth: true,
                compact: true,
                onFocusChange: { searchFieldFocused = $0 }
            )
            .onChange(of: navigation.searchText) { _ in searchCursor = 0 }

            if searchDropdownVisible {
                searchDropdown
                    .offset(y: 34)
                    .zIndex(50)
            }
        }
    }

    // MARK: - 搜索下拉结果面板（Web MenuSearch）

    private var searchDropdownVisible: Bool {
        searchFieldFocused && !navigation.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// 模糊匹配（对齐 Web）：label 开头 > label 包含 > section 包含 > id 包含，取前 12。
    private var searchResults: [NavigationItem] {
        let q = navigation.searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return [] }
        var scored: [(NavigationItem, Int)] = []
        for (section, items) in NavigationCatalog.sections {
            for it in items {
                let label = it.title.lowercased()
                let sec = section.title.lowercased()
                let id = it.nav.rawValue.lowercased()
                var score = 0
                if label.hasPrefix(q) { score = 100 }
                else if label.contains(q) { score = 70 }
                else if sec.contains(q) { score = 40 }
                else if id.contains(q) { score = 30 }
                if score > 0 { scored.append((it, score)) }
            }
        }
        return scored.sorted { $0.1 > $1.1 }.prefix(12).map { $0.0 }
    }

    private var searchPanelBg: Color { Color(hex: dark ? "0d1216" : "ffffff") }
    private var searchPanelBorder: Color { Color(hex: dark ? "363e45" : "bfc5ca") }
    private var searchHoverBg: Color { AppTheme.sidebarHover(dark) }

    private var searchDropdown: some View {
        VStack(spacing: 0) {
            let results = searchResults
            if results.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Color(hex: dark ? "5d646a" : "81878c").opacity(0.5))
                    Text("没有找到匹配的菜单")
                        .font(.system(size: 11.5))
                        .foregroundColor(Color(hex: dark ? "5d646a" : "81878c"))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            } else {
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(Array(results.enumerated()), id: \.element.nav) { idx, item in
                            searchResultRow(item, active: idx == searchCursor)
                        }
                    }
                    .padding(4)
                }
                // 高度自适应内容（Web maxHeight 320 只是滚动上限）
                .frame(height: min(CGFloat(results.count) * 44 + 8, 320))

                Divider()
                    .overlay(AppTheme.border(dark))

                HStack(spacing: 6) {
                    Text("\(results.count) 项")
                        .lineLimit(1)
                        .fixedSize()
                    Spacer(minLength: 4)
                    Text("↑↓选择 ↵跳转 ESC关闭")
                        .lineLimit(1)
                        .fixedSize()
                }
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(Color(hex: dark ? "5d646a" : "81878c"))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
            }
        }
        .background(searchPanelBg)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(searchPanelBorder, lineWidth: 1))
        .shadow(color: Color.black.opacity(dark ? 0.4 : 0.08), radius: 10, y: 6)
    }

    private func searchResultRow(_ item: NavigationItem, active: Bool) -> some View {
        let section = NavigationCatalog.section(for: item.nav)
        let color = section.map { sectionColor($0) } ?? AppTheme.sidebarText(dark)
        return Button(action: { commitSearch(item) }) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 999)
                    .fill(color)
                    .frame(width: 3)
                MenuGlyph(name: item.nav.lucideIcon, size: 13, color: color)
                    .frame(width: 16)
                VStack(alignment: .leading, spacing: 1) {
                    highlightedTitle(item.title)
                        .font(.system(size: 12, weight: active ? .semibold : .medium))
                        .foregroundColor(Color(hex: dark ? "f6f9fb" : "0c1217"))
                        .lineLimit(1)
                    Text(section?.title ?? "")
                        .font(.system(size: 10))
                        .foregroundColor(Color(hex: dark ? "5d646a" : "81878c"))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if active {
                    // Web 活动行右侧的 ↵ 徽章（mono / 边框 / bg-1 底）
                    Text("↵")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(Color(hex: dark ? "5d646a" : "81878c"))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Color(hex: dark ? "0d1216" : "ffffff"))
                        .overlay(RoundedRectangle(cornerRadius: 3).stroke(AppTheme.border(dark), lineWidth: 1))
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 5)
                    .fill(active ? searchHoverBg : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            if hovering, let idx = searchResults.firstIndex(where: { $0.nav == item.nav }) {
                searchCursor = idx
            }
        }
    }

    /// 命中片段高亮（Web mark：accent + semibold）。
    private func highlightedTitle(_ text: String) -> Text {
        let q = navigation.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, let range = text.range(of: q, options: .caseInsensitive) else {
            return Text(text)
        }
        return Text(text[text.startIndex..<range.lowerBound])
            + Text(text[range]).foregroundColor(AppTheme.sidebarActive).fontWeight(.semibold)
            + Text(text[range.upperBound...])
    }

    private func commitSearch(_ item: NavigationItem) {
        withAnimation(.easeInOut(duration: 0.18)) {
            navigation.select(item.nav)
            navigation.searchText = ""
        }
    }

    private func installEscMonitor() {
        guard escMonitor == nil else { return }
        let nav = navigation
        // ESC 清空（点击失焦由 AppDelegate 全局监听器统一处理）
        escMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.keyCode == 53 {
                DispatchQueue.main.async { nav.searchText = "" }
                return nil
            }
            return event
        }
    }

    private func removeEscMonitor() {
        if let monitor = escMonitor {
            NSEvent.removeMonitor(monitor)
            escMonitor = nil
        }
    }

    private func sectionHeader(_ section: NavSection, firstItem: NavigationItem?) -> some View {
        Button(action: {
            let wasExpanded = navigation.isSectionExpanded(section)
            withAnimation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.24)) {
                navigation.toggleSection(section)
            }
            // Web: 点击未展开的母菜单 → 展开并自动选中第一个子菜单(其余分组随之折叠)
            if !wasExpanded, let first = firstItem {
                withAnimation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.24)) {
                    navigation.select(first.nav)
                }
            }
        }) {
            HStack(spacing: 8) {
                MenuGlyph(name: section.lucideIcon, size: 15, color: sectionColor(section))
                    .frame(width: 16)
                if !collapsed {
                    Text(section.title)
                        .font(.system(size: 12.5, weight: .semibold))
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarText(dark).opacity(0.7))
                        .rotationEffect(.degrees(navigation.isSectionExpanded(section) ? 0 : -90))
                }
            }
            .foregroundColor(AppTheme.navIcon(dark))
            .padding(.horizontal, collapsed ? 0 : 10)
            .padding(.vertical, collapsed ? 10 : 8)
            .frame(maxWidth: .infinity, alignment: collapsed ? .center : .leading)
            .background(
                // Web: .sidebar-section-hoverable:hover { background: var(--bg-2) }
                RoundedRectangle(cornerRadius: 6)
                    .fill(hoveredSection == section ? AppTheme.sidebarHover(dark) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(collapsed)
        .onHover { hovering in
            hoveredSection = hovering ? section : nil
        }
        .padding(.bottom, 4)
    }

    private func row(_ item: NavigationItem) -> some View {
        let selected = navigation.sidebarActiveID == item.nav
        return Button(action: { navigation.select(item.nav) }) {
            ZStack(alignment: .leading) {
                HStack(spacing: 10) {
                    MenuGlyph(
                        name: item.nav.lucideIcon,
                        size: 14,
                        color: selected ? AppTheme.sidebarActive : AppTheme.sidebarText(dark)
                    )
                        .frame(width: 16)
                    if !collapsed {
                        Text(item.title)
                            .font(.system(size: 12.5, weight: selected ? .semibold : .regular))
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        if selected {
                            PulseDot(color: AppTheme.orange)
                        }
                    }
                }
                .padding(.leading, collapsed ? 0 : 20)
                .padding(.trailing, collapsed ? 0 : 10)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: collapsed ? .center : .leading)
                .foregroundColor(selected ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))

                if selected && !collapsed {
                    RoundedRectangle(cornerRadius: 999)
                        .fill(AppTheme.sidebarActive)
                        .frame(width: 3)
                        .frame(maxHeight: .infinity)
                        .padding(.vertical, 8)
                        .padding(.leading, 8)
                }
            }
            .background(
                // Web: .sidebar-item:not(.active):hover { background: var(--bg-2) }
                RoundedRectangle(cornerRadius: 6)
                    .fill(hoveredItem == item.nav && !selected ? AppTheme.sidebarHover(dark) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.leading, collapsed ? 0 : 6)
        .onHover { hovering in
            hoveredItem = hovering ? item.nav : nil
        }
    }

    // Web sidebar 底部状态:运行中 + 版本
    private var statusFooter: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                PulseDot(color: AppTheme.sidebarActive)
                Text("后端服务运行中")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.navIcon(dark))
            }
            if let v = appVersion, !v.isEmpty {
                Text("v\(v)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var appVersion: String? {
        let s = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return s?.replacingOccurrences(of: "^[vV]-?", with: "", options: .regularExpression)
    }

    // Web sidebar 各分部图标色:服务=accent 代理=cyan 资源=violet 系统=orange 工具=info 开发=violet
    private func sectionColor(_ section: NavSection) -> Color {
        switch section {
        case .service: return AppTheme.sidebarActive
        case .proxy: return Color(hex: "2fd0cc")
        case .resource: return Color(hex: "a78bfa")
        case .system: return AppTheme.orange
        case .tools: return Color(hex: "3b82f6")
        case .devConfig: return Color(hex: "a78bfa")
        }
    }
}

// Web 选中项/运行状态圆点:持续脉冲 (pulse-dot 1.8s)
private struct PulseDot: View {
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

// Web PoolBrandMark 近似:渐变圆角方块 + 池化节点图形(云环 + 三节点)
private struct SidebarBrandMark: View {
    var size: CGFloat
    var accent: Color
    var cyan: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28)
                .fill(LinearGradient(gradient: Gradient(colors: [accent, cyan]),
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: size, height: size)
            PoolBrandGlyphStroke()
                .stroke(Color(hex: "0e2a22"),
                        style: StrokeStyle(lineWidth: size * 0.055, lineCap: .round, lineJoin: .round))
            PoolBrandGlyphDots()
                .fill(Color(hex: "0e2a22"))
        }
        .frame(width: size, height: size)
    }
}

// 与 Web 36x36 viewBox 坐标一致的云环轮廓 + 底部三条短线(仅描边)
private struct PoolBrandGlyphStroke: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 36
        let sy = rect.height / 36
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }
        var path = Path()
        path.move(to: p(10, 20.4))
        path.addCurve(to: p(12.6, 12.9), control1: p(10, 16.6), control2: p(10.6, 14.5))
        path.addCurve(to: p(24.2, 13.9), control1: p(16.6, 10.2), control2: p(21.4, 10.9))
        path.addCurve(to: p(24.9, 21.4), control1: p(26.6, 15.8), control2: p(26.2, 18.8))
        path.addLine(to: p(11.4, 21.4))
        for x in [13.0, 18.0, 23.0] {
            path.move(to: p(x, 23.9))
            path.addLine(to: p(x, 21.4))
        }
        return path
    }
}

// 底部三个填充节点圆点
private struct PoolBrandGlyphDots: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 36
        let sy = rect.height / 36
        var path = Path()
        for x in [13.0, 18.0, 23.0] {
            let r = 1.9
            let cx = rect.minX + x * sx
            let cy = rect.minY + 25.5 * sy
            path.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
        }
        return path
    }
}
