import SwiftUI

struct SidebarView: View {
    @EnvironmentObject private var navigation: NavigationState
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme

    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }
    private var collapsed: Bool { navigation.sidebarCollapsed }

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
            }

            ScrollView {
                LazyVStack(alignment: collapsed ? .center : .leading, spacing: collapsed ? 2 : 2) {
                    let catalog = NavigationCatalog.filtered(
                        search: navigation.searchText,
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
                            sectionHeader(section)
                            // 折叠:全部子项图标态;展开:手风琴(当前 section 或搜索命中时显示子项)
                            if collapsed
                                || navigation.isSectionExpanded(section)
                                || !navigation.searchText.isEmpty {
                                ForEach(items) { item in
                                    row(item)
                                }
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
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
    }

    // Web sidebar 顶部品牌区:logo mark + 名称 + tagline;折叠时仅居中 mark
    private var brandHeader: some View {
        HStack(spacing: 10) {
            SidebarBrandMark(size: 30, accent: AppTheme.sidebarActive, cyan: Color(hex: "2fd0cc"))
            if !collapsed {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.siteName)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(AppTheme.navIcon(dark))
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
        SearchField(
            text: $navigation.searchText,
            placeholder: "搜索菜单…",
            fillsWidth: true
        )
    }

    private func sectionHeader(_ section: NavSection) -> some View {
        Button(action: { navigation.toggleSection(section) }) {
            HStack(spacing: 8) {
                Image(systemName: section.systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 16)
                    .foregroundColor(sectionColor(section))
                if !collapsed {
                    Text(section.title)
                        .font(.system(size: 13.5, weight: .bold))
                    Spacer(minLength: 4)
                    Image(systemName: navigation.isSectionExpanded(section) ? "chevron.down" : "chevron.right")
                        .font(.system(size: 10, weight: .bold))
                        .opacity(0.75)
                }
            }
            .foregroundColor(collapsed ? AppTheme.navIcon(dark) : (dark ? Color.white.opacity(0.88) : AppTheme.sidebarText(dark)))
            .padding(.horizontal, collapsed ? 0 : 8)
            .padding(.vertical, collapsed ? 10 : 8)
            .frame(maxWidth: .infinity, alignment: collapsed ? .center : .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(collapsed)
        .padding(.top, collapsed ? 2 : 10)
    }

    private func row(_ item: NavigationItem) -> some View {
        let selected = navigation.selected == item.nav
        return Button(action: { navigation.select(item.nav) }) {
            ZStack(alignment: .leading) {
                HStack(spacing: 8) {
                    Image(systemName: item.systemImage)
                        .font(.system(size: collapsed ? 13 : 12))
                        .frame(width: 16)
                    if !collapsed {
                        Text(item.title)
                            .font(.system(size: 12.5, weight: selected ? .semibold : .medium))
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        if selected {
                            Circle()
                                .fill(Color(hex: "f59e0b"))
                                .frame(width: 6, height: 6)
                        }
                    }
                }
                .padding(.leading, collapsed ? 0 : (selected ? 20 : 10))
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
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.leading, collapsed ? 0 : 6)
        .onHover { hovering in
            _ = hovering
        }
    }

    // Web sidebar 底部状态:运行中 + 版本
    private var statusFooter: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle()
                    .fill(AppTheme.sidebarActive)
                    .frame(width: 6, height: 6)
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
        case .system: return Color(hex: "f59e0b")
        case .tools: return Color(hex: "3b82f6")
        case .devConfig: return Color(hex: "a78bfa")
        }
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
