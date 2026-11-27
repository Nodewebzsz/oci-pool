import SwiftUI
import AppKit

/// VPS 监控看板（对齐 Web `/vps/instances/list` · `vps_list.ftl`）
struct VpsListView: View {
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var model = VpsViewModel()
    @State private var hoveredCardId: String?

    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }

    var body: some View {
        Group {
            if let ssh = model.sshItem {
                InstanceSSHView(item: ssh, onBack: { model.closeSSH() })
            } else {
                mainBoard
            }
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear {
            FloatingMenuDismiss.all()
            model.start()
        }
        .onDisappear { model.teardown() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
        }
        .sheet(item: $model.historyContext) { ctx in
            NetworkQualityHistorySheet(context: ctx, baseURL: model.serverURL)
                .environmentObject(appearance)
        }
    }

    private var mainBoard: some View {
        PageScaffold(
            title: "资源列表",
            subtitle: "VPS 实例监控面板 · 跨云商聚合视图",
            systemImage: "server.rack",
            iconColor: Color(hex: "b484e8"),
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.danger)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.bottom, 12)
                    }
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            statsRow
                            controlBar
                            cardGrid
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        )
        .appLoading(model.isBusy || (model.isLoading && !model.cards.isEmpty))
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(
                title: "刷新",
                systemImage: "arrow.clockwise",
                kind: .secondary,
                isLoading: model.isLoading
            ) {
                Task { await model.reload() }
            }
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 14) {
            statCard(
                title: "服务器总数",
                value: "\(model.totalCount)",
                icon: "server.rack",
                accent: AppTheme.info,
                active: false,
                action: nil
            )
            statCard(
                title: "在线数量",
                value: "\(model.onlineCount)",
                icon: "wifi",
                accent: AppTheme.sidebarActive,
                valueColor: AppTheme.sidebarActive,
                active: false,
                action: nil
            )
            statCard(
                title: "离线数量",
                value: "\(model.offlineCount)",
                icon: "heart.slash",
                accent: AppTheme.danger,
                valueColor: AppTheme.danger,
                active: model.offlineOnly,
                action: { model.toggleOfflineFilter() }
            )
        }
    }

    /// Web 状态卡：label 11 fg-3 + 数值 26/700 语义色 + 右上角 40×40 软底图标；离线卡可点击筛选（danger-soft 底 + 徽章）
    private func statCard(
        title: String,
        value: String,
        icon: String,
        accent: Color,
        valueColor: Color? = nil,
        active: Bool,
        action: (() -> Void)?
    ) -> some View {
        let content = ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 5) {
                    Text(title)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(active ? AppTheme.danger : AppTheme.textTertiary(dark))
                    if active {
                        Text("筛选中")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(AppTheme.danger)
                            .cornerRadius(2)
                    }
                }
                Text(value)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(valueColor ?? AppTheme.navIcon(dark))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(accent.opacity(0.16))
                    .frame(width: 40, height: 40)
                Image(systemName: icon)
                    .font(.system(size: 19, weight: .medium))
                    .foregroundColor(accent)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 88, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(active ? AppTheme.dangerSoft(dark) : AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    active ? AppTheme.danger : AppTheme.border(dark),
                    lineWidth: 1
                )
        )
        .cornerRadius(8)

        return Group {
            if let action = action {
                Button(action: action) { content }
                    .buttonStyle(PlainButtonStyle())
            } else {
                content
            }
        }
    }

    // MARK: - Control bar

    private var controlBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(AppTheme.sidebarActive)
                Text("监控面板")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
            }
            Spacer(minLength: 8)
            SearchField(text: $model.searchText, placeholder: "搜索 IP、地区、租户...")
                .frame(width: 240)
            toolChip(
                title: model.showIP ? "隐藏 IP" : "显示 IP",
                systemImage: model.showIP ? "eye.slash" : "eye",
                active: model.showIP
            ) { model.toggleShowIP() }
            toolChip(
                title: model.showTenant ? "隐藏租户" : "显示租户",
                systemImage: model.showTenant ? "eye.slash" : "eye",
                active: model.showTenant
            ) { model.toggleShowTenant() }
            AppButton(
                title: model.isLatencyTesting ? "测试中…" : "延迟测试",
                systemImage: "bolt.fill",
                kind: .primary,
                isLoading: model.isLatencyTesting
            ) { model.runLatencyTest() }
            .disabled(model.isLatencyTesting)
            moreMenu
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.sidebarBg(dark).opacity(0.85))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.border(dark).opacity(0.45), lineWidth: 1)
        )
        .zIndex(2)
    }

    private func toolChip(
        title: String,
        systemImage: String,
        active: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let chipRadius: CGFloat = AppTheme.isClaude ? 8 : 5
        return Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .semibold))
                Text(title)
                    .font(.system(size: 12, weight: .medium))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .foregroundColor(active ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
            .background(
                RoundedRectangle(cornerRadius: chipRadius)
                    .fill(active
                          ? appearance.accent.accentSoft(dark)
                          : AppTheme.sidebarHover(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: chipRadius)
                    .stroke(active ? AppTheme.sidebarActive.opacity(0.45) : AppTheme.border(dark), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var moreMenu: some View {
        toolChip(title: "更多", systemImage: "gearshape", active: model.moreMenuOpen) {
            model.toggleMoreMenu()
        }
        .background(
            VpsMoreMenuFloatBridge(
                isOpen: model.moreMenuOpen,
                panelWidth: 186,
                onDismiss: { model.closeMoreMenu() }
            ) {
                moreMenuPanelContent
                    .environmentObject(appearance)
            }
        )
    }

    private var moreMenuPanelContent: some View {
        let menuRadius: CGFloat = AppTheme.isClaude ? 10 : 7
        return VStack(alignment: .leading, spacing: 2) {
            VpsMoreMenuItem(title: "开启自动 Ping", icon: "play.fill", iconColor: AppTheme.success, dark: dark) {
                model.enablePing()
            }
            VpsMoreMenuItem(title: "停止自动 Ping", icon: "stop.fill", iconColor: AppTheme.danger, dark: dark) {
                model.disablePing()
            }
            VpsMoreMenuItem(title: "手动 Ping 检测", icon: "scope", iconColor: AppTheme.info, dark: dark) {
                model.manualPing()
            }
            Rectangle()
                .fill(AppTheme.border(dark))
                .frame(height: 1)
                .padding(.vertical, 4)
            VpsMoreMenuItem(title: "刷新页面", icon: "arrow.clockwise", iconColor: AppTheme.textSecondary(dark), dark: dark) {
                model.closeMoreMenu()
                Task { await model.reload() }
            }
        }
        .padding(6)
        .frame(width: 186, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: menuRadius)
                .fill(AppTheme.sidebarBg(dark))
                .shadow(color: Color.black.opacity(dark ? 0.42 : 0.16), radius: 12, y: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: menuRadius)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .padding(14)
    }

    // MARK: - Grid

    private var cardGrid: some View {
        Group {
            if model.isLoading && model.cards.isEmpty {
                ProgressView("加载中…")
                    .frame(maxWidth: .infinity, minHeight: 220)
            } else if model.filteredCards.isEmpty {
                EmptyStateView(
                    icon: "desktopcomputer",
                    title: "暂无实例",
                    subtitle: model.searchText.isEmpty && !model.offlineOnly
                        ? "没有 VPS 实例数据"
                        : "无匹配结果",
                    actionTitle: "刷新",
                    action: { Task { await model.reload() } }
                )
                .frame(maxWidth: .infinity, minHeight: 220)
            } else {
                LazyVGrid(
                    columns: [
                        GridItem(.adaptive(minimum: 320, maximum: 420), spacing: 14)
                    ],
                    spacing: 14
                ) {
                    ForEach(model.filteredCards) { card in
                        VpsServerCard(
                            card: card,
                            showIP: model.showIP,
                            showTenant: model.showTenant,
                            dark: dark,
                            hovered: hoveredCardId == card.id,
                            onHover: { inside in
                                hoveredCardId = inside ? card.id : (hoveredCardId == card.id ? nil : hoveredCardId)
                            },
                            onCopyIP: { model.copyIP(card) },
                            onSSH: { model.openSSH(card) },
                            onInstall: { model.installMonitor(card) },
                            onUninstall: { model.uninstallMonitor(card) },
                            onOpenQualityHistory: { task in model.openQualityHistory(card: card, task: task) }
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Server card

private struct VpsServerCard: View {
    let card: VpsCardItem
    let showIP: Bool
    let showTenant: Bool
    let dark: Bool
    let hovered: Bool
    let onHover: (Bool) -> Void
    let onCopyIP: () -> Void
    let onSSH: () -> Void
    let onInstall: () -> Void
    let onUninstall: () -> Void
    let onOpenQualityHistory: (NetworkQualityTask) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardBody
            Divider().opacity(0.4)
            cardActions
        }
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(
                    card.monitorWarning
                        ? AppTheme.orange.opacity(0.75)
                        : (hovered ? AppTheme.sidebarActive.opacity(0.45) : AppTheme.border(dark).opacity(0.55)),
                    lineWidth: card.monitorWarning || hovered ? 1.5 : 1
                )
        )
        .shadow(color: Color.black.opacity(hovered ? (dark ? 0.28 : 0.08) : 0.04), radius: hovered ? 10 : 3, y: 2)
        .scaleEffect(hovered ? 1.01 : 1.0)
        .animation(.easeOut(duration: 0.15), value: hovered)
        .onHover(perform: onHover)
    }

    private var cardBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                cloudIcon
                VStack(alignment: .leading, spacing: 4) {
                    Button(action: onCopyIP) {
                        HStack(spacing: 6) {
                            Text(showIP ? card.displayIP : card.maskedIP)
                                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                                .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                                .lineLimit(1)
                            Image(systemName: showIP ? "eye" : "eye.slash")
                                .font(.system(size: 10))
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }
                    }
                    .buttonStyle(PlainButtonStyle())
                    .help("点击复制 IP")

                    if !card.item.displayName.isEmpty {
                        Text(card.item.displayName)
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.textTertiary(dark))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 4) {
                    StatusBadge(
                        text: card.isOnline ? "在线" : "离线",
                        tone: card.isOnline ? .success : .danger
                    )
                    StatusBadge(
                        text: card.qualityStatusLabel,
                        tone: card.qualityStatusTone
                    )
                }
            }
            tagsRow
            metricsBlock
            if !card.qualitySummaries.isEmpty {
                qualitySummaryRow
            }
        }
        .padding(14)
    }

    private var qualitySummaryRow: some View {
        let pillRadius: CGFloat = AppTheme.isClaude ? 6 : 4
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(card.qualitySummaries) { entry in
                    let tone = entry.sample?.statusTone ?? .neutral
                    Button(action: { onOpenQualityHistory(entry.task) }) {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(tone.color(dark: dark))
                                .frame(width: 5, height: 5)
                            Text(entry.task.name)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(AppTheme.navIcon(dark))
                                .lineLimit(1)
                            Text(entry.sample?.compactMetricText ?? "待采样")
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundColor(tone.color(dark: dark))
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: pillRadius).fill(tone.softBackground(dark: dark)))
                        .overlay(
                            RoundedRectangle(cornerRadius: pillRadius)
                                .stroke(tone.color(dark: dark).opacity(dark ? 0.3 : 0.22), lineWidth: 1)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                    .help("点击查看「\(entry.task.name)」历史延迟与丢包")
                }
            }
        }
    }

    private var cloudIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10)
                .fill(AppTheme.sidebarHover(dark).opacity(0.9))
                .frame(width: 40, height: 40)
            Image(systemName: cloudSF)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(AppTheme.sidebarActive)
        }
    }

    private var cloudSF: String {
        switch card.item.cloudType {
        case 2: return "g.circle.fill"
        case 4: return "cloud.fill"
        default: return "server.rack"
        }
    }

    private var tagsRow: some View {
        let tenantText = showTenant
            ? (card.item.tenancyName.isEmpty ? "—" : card.item.tenancyName)
            : card.item.maskedTenancyName
        return VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                tag(card.item.regionName.isEmpty ? "—" : card.item.regionName, icon: "mappin.and.ellipse")
                archTag.fixedSize()
                tag(card.specText, icon: nil).fixedSize()
                Spacer(minLength: 0)
            }
            HStack(spacing: 5) {
                tag(tenantText, icon: "person")
                if !card.metrics.uptime.isEmpty {
                    tag(card.metrics.uptime, icon: "clock").fixedSize()
                }
                if !card.metrics.load.isEmpty {
                    tag("负载 \(card.metrics.load)", icon: "gauge").fixedSize()
                }
                if card.isLatencyTesting {
                    tag("测速中", icon: "bolt").fixedSize()
                } else if let ms = card.latencyMs {
                    latencyTag(ms).fixedSize()
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var archTag: some View {
        let a = card.item.architecture.isEmpty ? "NONE" : card.item.architecture
        let pillRadius: CGFloat = AppTheme.isClaude ? 6 : 4
        let color: Color = {
            switch card.archClass {
            case "arm": return Color(hex: "b484e8")
            case "amd": return AppTheme.info
            default: return AppTheme.sidebarText(dark)
            }
        }()
        return Text(a)
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: pillRadius).fill(color.opacity(0.12)))
    }

    private func latencyTag(_ ms: Int) -> some View {
        let color: Color = {
            if ms < 0 { return AppTheme.danger }
            if ms < 150 { return AppTheme.sidebarActive }
            if ms < 300 { return AppTheme.orange }
            return AppTheme.danger
        }()
        return tag(VpsFormat.latencyLabel(ms), icon: "bolt.fill", color: color)
    }

    private func tag(_ text: String, icon: String?, color: Color? = nil) -> some View {
        let pillRadius: CGFloat = AppTheme.isClaude ? 6 : 4
        return HStack(spacing: 3) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 9))
            }
            Text(text)
                .font(.system(size: 10, weight: .medium))
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .foregroundColor(color ?? AppTheme.sidebarText(dark))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: pillRadius)
                .fill(dark ? Color.white.opacity(0.06) : Color.black.opacity(0.04))
        )
    }

    private var metricsBlock: some View {
        VStack(spacing: 8) {
            metricRow("CPU", card.metrics.cpuPercent, AppTheme.sidebarActive)
            metricRow("内存", card.metrics.memPercent, AppTheme.sidebarActive)
            metricRow(
                "硬盘\(card.metrics.diskTotalLabel.isEmpty ? "" : " (\(card.metrics.diskTotalLabel))")",
                card.metrics.diskPercent,
                Color(hex: "b484e8")
            )
            HStack(spacing: 14) {
                Label(card.metrics.netRx, systemImage: "arrow.down")
                    .foregroundColor(AppTheme.sidebarActive)
                Label(card.metrics.netTx, systemImage: "arrow.up")
                    .foregroundColor(AppTheme.orange)
                Spacer()
            }
            .font(.system(size: 11, weight: .medium, design: .monospaced))
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(dark ? Color.black.opacity(0.22) : Color(hex: "f3f4f6").opacity(0.9))
        )
    }

    private func metricRow(_ title: String, _ percent: Double, _ color: Color) -> some View {
        let p = min(100, max(0, percent))
        let barColor: Color = {
            if p > 90 { return AppTheme.danger }
            if p > 70 { return AppTheme.orange }
            return color
        }()
        return VStack(spacing: 3) {
            HStack {
                Text(title)
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Spacer()
                Text(String(format: "%.0f%%", p))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(dark ? Color.white.opacity(0.85) : Color.primary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(dark ? Color.white.opacity(0.08) : Color.black.opacity(0.06))
                    Capsule()
                        .fill(barColor)
                        .frame(width: max(4, geo.size.width * CGFloat(p / 100)))
                        .animation(.easeInOut(duration: 0.25), value: p)
                }
            }
            .frame(height: 6)
        }
    }

    private var cardActions: some View {
        HStack(spacing: 8) {
            AppButton(title: "SSH", systemImage: "terminal", kind: .secondary) { onSSH() }
            if card.needsProbeUpgrade {
                AppButton(title: "升级探针", systemImage: "arrow.up.circle", kind: .orange) { onInstall() }
            } else if !card.item.monitorInstalled {
                AppButton(title: "安装", systemImage: "arrow.down.circle", kind: .primary) { onInstall() }
            }
            AppButton(title: "卸载", systemImage: "trash", kind: .danger) { onUninstall() }
            Spacer()
            if card.monitorWarning {
                Text("探针超时")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(AppTheme.orange)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

// MARK: - Simple flow layout for tags

private struct FlowWrap<Content: View>: View {
    var spacing: CGFloat = 6
    @ViewBuilder var content: () -> Content

    var body: some View {
        // macOS 11+: use flexible wrapping via LazyVGrid single-line-ish
        // Prefer left-aligned chip wrap with PreferenceKey-free adaptive grid
        _FlowLayout(spacing: spacing, content: content)
    }
}

/// Lightweight wrap layout (macOS 12+ Layout protocol avoided for 11 compatibility)
private struct _FlowLayout<Content: View>: View {
    var spacing: CGFloat
    @ViewBuilder var content: () -> Content

    var body: some View {
        // Fallback: horizontal scroll if too many tags (smooth, no clip)
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: spacing) {
                content()
            }
        }
    }
}

// MARK: - Floating More Menu (NSPanel, never expands parent toolbar)

private struct VpsMoreMenuItem: View {
    let title: String
    let icon: String
    let iconColor: Color
    let dark: Bool
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        let itemRadius: CGFloat = AppTheme.isClaude ? 6 : 4
        return Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(iconColor)
                    .frame(width: 14)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.navIcon(dark))
                Spacer()
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: itemRadius)
                    .fill(hovering ? AppTheme.sidebarHover(dark) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering = $0 }
    }
}

private struct VpsMoreMenuFloatBridge<MenuContent: View>: NSViewRepresentable {
    let isOpen: Bool
    let panelWidth: CGFloat
    let onDismiss: () -> Void
    @ViewBuilder let content: () -> MenuContent

    final class AnchorView: NSView {
        var panelWidth: CGFloat = 186
        var onDismiss: (() -> Void)?
        var contentBuilder: (() -> MenuContent)?
        private var popupPanel: NSPanel?
        private var mouseMonitor: Any?
        private var keyMonitor: Any?
        private let shadowPad: CGFloat = 14

        override var isFlipped: Bool { true }

        deinit {
            dismiss()
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if window == nil {
                dismiss()
            }
        }

        func present() {
            guard let window = window, let builder = contentBuilder else { return }
            if popupPanel == nil {
                let host = NSHostingView(rootView: builder())
                let panel = NSPanel(
                    contentRect: NSRect(x: 0, y: 0, width: panelWidth + shadowPad * 2, height: 120),
                    styleMask: [.borderless, .nonactivatingPanel],
                    backing: .buffered,
                    defer: false
                )
                panel.isFloatingPanel = true
                panel.level = .popUpMenu
                panel.hasShadow = false
                panel.backgroundColor = .clear
                panel.isOpaque = false
                panel.contentView = host
                popupPanel = panel
                window.addChildWindow(panel, ordered: .above)
            }
            layoutPanel()
            startMonitoring()
        }

        func dismiss() {
            stopMonitoring()
            if let panel = popupPanel {
                panel.parent?.removeChildWindow(panel)
                panel.orderOut(nil)
                popupPanel = nil
            }
        }

        func layoutPanel() {
            guard let panel = popupPanel,
                  let window = window,
                  let host = panel.contentView as? NSHostingView<MenuContent> else { return }
            if let builder = contentBuilder {
                host.rootView = builder()
            }
            let fitting = host.fittingSize
            let totalW = panelWidth + shadowPad * 2
            let totalH = max(fitting.height > 20 ? fitting.height : 160, 60)

            let triggerWin = convert(bounds, to: nil)
            let triggerScreen = window.convertToScreen(triggerWin)

            var panelX = triggerScreen.maxX - panelWidth - shadowPad
            var panelY = triggerScreen.minY - 6 - (totalH - shadowPad)

            let screenFrame = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
            if panelY + shadowPad < screenFrame.minY + 4 {
                panelY = triggerScreen.maxY + 6 - shadowPad
            }
            if panelX + totalW - shadowPad > screenFrame.maxX - 4 {
                panelX = screenFrame.maxX - 4 - (totalW - shadowPad)
            }
            if panelX + shadowPad < screenFrame.minX + 4 {
                panelX = screenFrame.minX + 4 - shadowPad
            }

            panel.setFrame(NSRect(x: panelX, y: panelY, width: totalW, height: totalH), display: true)
        }

        private func startMonitoring() {
            stopMonitoring()
            mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .scrollWheel]) { [weak self] event in
                guard let self = self, let panel = self.popupPanel else { return event }
                if event.type == .scrollWheel {
                    self.triggerDismiss()
                    return event
                }
                let loc = NSEvent.mouseLocation
                let visiblePanelRect = panel.frame.insetBy(dx: self.shadowPad - 2, dy: self.shadowPad - 2)
                if visiblePanelRect.contains(loc) {
                    return event
                }
                if let win = self.window {
                    let triggerRect = win.convertToScreen(self.convert(self.bounds, to: nil))
                    if triggerRect.contains(loc) {
                        return event
                    }
                }
                self.triggerDismiss()
                return event
            }
            keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                if event.keyCode == 53 {
                    self?.triggerDismiss()
                    return nil
                }
                return event
            }
        }

        private func stopMonitoring() {
            if let m = mouseMonitor {
                NSEvent.removeMonitor(m)
                mouseMonitor = nil
            }
            if let k = keyMonitor {
                NSEvent.removeMonitor(k)
                keyMonitor = nil
            }
        }

        private func triggerDismiss() {
            DispatchQueue.main.async { [weak self] in
                self?.onDismiss?()
            }
        }
    }

    func makeNSView(context: Context) -> AnchorView {
        let view = AnchorView()
        view.panelWidth = panelWidth
        view.onDismiss = onDismiss
        view.contentBuilder = content
        return view
    }

    func updateNSView(_ nsView: AnchorView, context: Context) {
        nsView.panelWidth = panelWidth
        nsView.onDismiss = onDismiss
        nsView.contentBuilder = content
        if isOpen {
            DispatchQueue.main.async {
                nsView.present()
            }
        } else {
            nsView.dismiss()
        }
    }

    static func dismantleNSView(_ nsView: AnchorView, coordinator: ()) {
        nsView.dismiss()
    }
}
