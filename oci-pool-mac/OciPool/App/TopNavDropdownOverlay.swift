import SwiftUI

/// Full-window host for Web-style top-bar popovers.
struct TopNavDropdownOverlay: View {
    @ObservedObject var chrome: TopNavChromeState
    @ObservedObject var header: HeaderViewModel
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @EnvironmentObject private var navigation: NavigationState

    @State private var showLogoutConfirmation = false

    private let topBarHeight: CGFloat = 52
    private let trailingPad: CGFloat = 16
    private let controlGap: CGFloat = 10
    private let squareControlWidth: CGFloat = 30
    private let userControlWidth: CGFloat = 44

    private var dark: Bool { appearance.isDarkEffective }
    private var popupSurface: Color { AppTheme.isClaude ? AppTheme.sidebarBg(dark) : (dark ? Color(hex: "171b20") : Color.white) }
    private var popupSurface2: Color { AppTheme.isClaude ? AppTheme.sidebarHover(dark) : (dark ? Color(hex: "20252b") : Color(hex: "f5f7fa")) }
    private var popupBorder: Color { AppTheme.isClaude ? AppTheme.borderStrong(dark) : (dark ? Color.white.opacity(0.13) : Color.black.opacity(0.12)) }

    private var notificationTrailing: CGFloat {
        trailingPad + userControlWidth + controlGap
    }

    private var accentTrailing: CGFloat {
        notificationTrailing + squareControlWidth + controlGap + squareControlWidth + controlGap
    }

    private var themeTrailing: CGFloat {
        accentTrailing + squareControlWidth + controlGap
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topTrailing) {
                if chrome.open != .none {
                    Color.clear
                        .contentShape(Rectangle())
                        .frame(width: geo.size.width, height: geo.size.height)
                        .onTapGesture { closeAll() }
                }

                if chrome.open == .theme {
                    themePanel
                        .padding(.top, topBarHeight + 8)
                        .padding(.trailing, themeTrailing)
                        .transition(.opacity)
                }

                if chrome.open == .accent {
                    accentPanel
                        .padding(.top, topBarHeight + 8)
                        .padding(.trailing, accentTrailing)
                        .transition(.opacity)
                }

                if chrome.open == .notifications {
                    NotificationDropdownPanel(
                        header: header,
                        dark: dark,
                        surface: popupSurface,
                        surface2: popupSurface2,
                        border: popupBorder,
                        maxHeight: max(220, geo.size.height - topBarHeight - 16),
                        onOpenAll: {
                            closeAll()
                            navigation.select(.notify)
                        },
                        onOpenMessage: { message in
                            closeAll()
                            navigation.select(.notify)
                            Task { await header.openMessageDetail(message) }
                        }
                    )
                    .padding(.top, topBarHeight + 8)
                    .padding(.trailing, notificationTrailing)
                    .transition(.opacity)
                }

                if chrome.open == .user {
                    UserDropdownPanel(
                        dark: dark,
                        username: session.username,
                        levelTitle: header.levelBadgeTitle,
                        level: header.levelBadgeLevel,
                        cloudProvider: session.cloudProvider,
                        onAsset: {
                            closeAll()
                            header.openAssetAnalysis()
                        },
                        onCloud: { type, _ in
                            closeAll()
                            if type == 2 {
                                AppAlert.notice(title: "提示", message: "Google Cloud 模块正在开发中，敬请期待！")
                                return
                            }
                            session.setCloudProvider(type)
                            navigation.select(.tenants)
                        },
                        onAbout: {
                            closeAll()
                            header.showAbout = true
                        },
                        onLogout: {
                            closeAll()
                            showLogoutConfirmation = true
                        }
                    )
                    .padding(.top, topBarHeight + 8)
                    .padding(.trailing, trailingPad)
                    .shadow(color: Color.black.opacity(dark ? 0.45 : 0.18), radius: 16, y: 8)
                    .transition(.opacity)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topTrailing)
            .animation(.easeInOut(duration: 0.12), value: chrome.open)
        }
        .allowsHitTesting(chrome.open != .none || showLogoutConfirmation)
        .onExitCommand { closeAll() }
        .alert(isPresented: $showLogoutConfirmation) {
            Alert(
                title: Text(L("退出登录")),
                message: Text(L("确定要退出当前账号吗？")),
                primaryButton: .destructive(Text(L("退出登录"))) {
                    Task { await session.logout() }
                },
                secondaryButton: .cancel(Text(L("取消")))
            )
        }
    }

    private var themePanel: some View {
        AppearanceOptionsView(onSelect: closeAll)
        .frame(width: 196)
        .background(popupSurface)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(popupBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(dark ? 0.4 : 0.12), radius: 12, y: 6)
    }



    private var accentPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(L("强调色"))
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.6)
                    .foregroundColor(dark ? Color.white.opacity(0.5) : Color(hex: "6b7280"))
                Spacer()
                Text(L(appearance.accent.title))
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(dark ? Color.white.opacity(0.65) : Color(hex: "374151"))
            }
            .padding(.horizontal, 4)

            HStack(spacing: 8) {
                ForEach(AccentPreset.allCases) { preset in
                    AccentDot(
                        preset: preset,
                        selected: appearance.accent == preset,
                        dark: dark,
                        onSelect: {
                            appearance.accent = preset
                            closeAll()
                        }
                    )
                }
            }
            .padding(.horizontal, 4)

            Rectangle()
                .fill(popupBorder)
                .frame(height: 1)
                .padding(.top, 4)

            HStack {
                Text(L("hue \(appearance.accent.hue)°"))
                Spacer()
                Text(L("ESC 关闭"))
            }
            .font(.system(size: 9.5, design: .monospaced))
            .foregroundColor(dark ? Color.white.opacity(0.45) : Color(hex: "6b7280"))
            .padding(.horizontal, 4)
        }
        .padding(10)
        .frame(width: 258, alignment: .leading)
        .background(popupSurface)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(popupBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(dark ? 0.4 : 0.12), radius: 12, y: 6)
    }

    private func closeAll() {
        chrome.close()
        header.closeMessages()
    }
}

private struct NotificationDropdownPanel: View {
    @ObservedObject var header: HeaderViewModel
    let dark: Bool
    let surface: Color
    let surface2: Color
    let border: Color
    let maxHeight: CGFloat
    let onOpenAll: () -> Void
    let onOpenMessage: (SysMessageItem) -> Void

    private var textPrimary: Color { dark ? Color.white.opacity(0.92) : Color(hex: "111827") }
    private var textSecondary: Color { dark ? Color.white.opacity(0.64) : Color(hex: "4b5563") }
    private var textMuted: Color { dark ? Color.white.opacity(0.42) : Color(hex: "6b7280") }
    private var visibleMessages: [SysMessageItem] { Array(header.messagePage.content.prefix(20)) }
    private var totalCount: Int { max(header.messagePage.totalElements, visibleMessages.count) }
    private var selectedVisibleCount: Int {
        visibleMessages.filter { header.selectedMessageIds.contains($0.id) }.count
    }
    private var allVisibleSelected: Bool {
        !visibleMessages.isEmpty && selectedVisibleCount == visibleMessages.count
    }
    private var desiredHeight: CGFloat {
        visibleMessages.isEmpty ? 166 : min(420, 112 + CGFloat(visibleMessages.count) * 58)
    }

    var body: some View {
        VStack(spacing: 0) {
            panelHeader
            if !visibleMessages.isEmpty {
                batchToolbar
            }
            messageList
            panelFooter
        }
        .frame(width: 380)
        .frame(height: min(maxHeight, desiredHeight))
        .background(surface)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(dark ? 0.4 : 0.12), radius: 12, y: 6)
    }

    private var panelHeader: some View {
        HStack(spacing: 8) {
            Image(systemName: "bell")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.orange)
            Text(L("通知中心"))
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(textPrimary)
            Text(L("\(totalCount) 条"))
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(textSecondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 3)
                        .fill(dark ? Color.white.opacity(0.06) : Color.black.opacity(0.05))
                )
            Spacer(minLength: 0)
            Button(L("全部已读")) {
                Task { await header.markAllRead() }
            }
            .buttonStyle(PlainButtonStyle())
            .font(.system(size: 10.5, weight: .medium))
            .foregroundColor(AppTheme.info)
            .disabled(header.unreadCount == 0 || header.messagesMutating)
            .opacity(header.unreadCount == 0 ? 0.55 : 1)

            Button(L("清空全部")) {
                Task { await header.clearAllMessages() }
            }
            .buttonStyle(PlainButtonStyle())
            .font(.system(size: 10.5, weight: .medium))
            .foregroundColor(AppTheme.danger)
            .disabled(totalCount == 0 || header.messagesMutating)
            .opacity(totalCount == 0 ? 0.45 : 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(surface2)
        .overlay(Rectangle().fill(border).frame(height: 1), alignment: .bottom)
    }

    private var batchToolbar: some View {
        HStack(spacing: 8) {
            Button(action: { header.toggleSelectAllMessages(in: visibleMessages) }) {
                HStack(spacing: 5) {
                    Image(systemName: allVisibleSelected ? "checkmark.square.fill" : (selectedVisibleCount > 0 ? "minus.square.fill" : "square"))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(selectedVisibleCount > 0 ? AppTheme.sidebarActive : textMuted)
                    Text(L(selectedVisibleCount > 0 ? "已选 \(selectedVisibleCount) 条" : "全选"))
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundColor(textSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())

            Spacer(minLength: 0)

            if selectedVisibleCount > 0 {
                Button(action: {
                    Task { await header.deleteSelectedMessages() }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                            .font(.system(size: 10, weight: .semibold))
                        Text(L("删除所选 (\(selectedVisibleCount))"))
                            .font(.system(size: 10.5, weight: .semibold))
                    }
                    .foregroundColor(AppTheme.danger)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppTheme.dangerSoft(dark))
                    .cornerRadius(4)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(header.messagesMutating)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(surface)
        .overlay(Rectangle().fill(border).frame(height: 1), alignment: .bottom)
    }

    private var messageList: some View {
        Group {
            if header.messagesLoading && visibleMessages.isEmpty {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(L("加载通知…"))
                        .font(.system(size: 11))
                        .foregroundColor(textMuted)
                }
                .frame(maxWidth: .infinity, minHeight: 88)
            } else if visibleMessages.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.system(size: 20, weight: .light))
                    Text(L("暂无通知"))
                        .font(.system(size: 11.5, weight: .medium))
                }
                .foregroundColor(textMuted)
                .frame(maxWidth: .infinity, minHeight: 100)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(visibleMessages.enumerated()), id: \.element.id) { index, message in
                            messageRow(message)
                            if index < visibleMessages.count - 1 {
                                Rectangle().fill(border).frame(height: 1)
                            }
                        }
                    }
                }
            }
        }
    }

    private func messageRow(_ message: SysMessageItem) -> some View {
        let style = notificationStyle(message)
        let isSelected = header.selectedMessageIds.contains(message.id)
        return HStack(alignment: .top, spacing: 8) {
            Button(action: { header.toggleMessageSelection(message) }) {
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundColor(isSelected ? AppTheme.sidebarActive : textMuted)
                    .frame(width: 20, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())

            Button(action: { onOpenMessage(message) }) {
                HStack(alignment: .top, spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(style.color.opacity(dark ? 0.17 : 0.12))
                            .frame(width: 24, height: 24)
                        Image(systemName: style.icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(style.color)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            if message.isUnread {
                                Circle()
                                    .fill(AppTheme.orange)
                                    .frame(width: 5, height: 5)
                            }
                            Text(L(message.subject.isEmpty ? "通知" : message.subject))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(textPrimary)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            Text(L(relativeTime(message.createTime)))
                                .font(.system(size: 10))
                                .foregroundColor(textMuted)
                                .lineLimit(1)
                        }
                        Text(L(summaryText(message)))
                            .font(.system(size: 11))
                            .foregroundColor(textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(isSelected ? AppTheme.sidebarActive.opacity(dark ? 0.10 : 0.06) : Color.clear)
    }

    private var panelFooter: some View {
        Button(action: onOpenAll) {
            HStack(spacing: 4) {
                Text(L("查看全部"))
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(surface2)
        .overlay(Rectangle().fill(border).frame(height: 1), alignment: .top)
    }

    private func notificationStyle(_ message: SysMessageItem) -> (color: Color, icon: String) {
        let text = "\(message.subject) \(message.messageType)".lowercased()
        if text.contains("成功") || text.contains("success") {
            return (AppTheme.sidebarActive, "checkmark.circle")
        }
        if text.contains("预警") || text.contains("提醒") || text.contains("warning") {
            return (AppTheme.orange, "exclamationmark.triangle")
        }
        if text.contains("异常") || text.contains("失败") || text.contains("error") || text.contains("failed") {
            return (Color(hex: "ef4444"), "exclamationmark.octagon")
        }
        return (AppTheme.info, "info.circle")
    }

    private func relativeTime(_ raw: String) -> String {
        guard let date = Self.dateFormatter.date(from: raw) else { return raw }
        let seconds = max(0, Int(Date().timeIntervalSince(date)))
        if seconds < 60 { return "刚刚" }
        if seconds < 3600 { return "\(seconds / 60) 分钟前" }
        if seconds < 86_400 { return "\(seconds / 3600) 小时前" }
        if seconds < 172_800 { return "昨天" }
        return "\(seconds / 86_400) 天前"
    }

    private func summaryText(_ message: SysMessageItem) -> String {
        let raw = message.content.isEmpty ? message.messageType : message.content
        let collapsed = raw
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { token in
                !token.isEmpty && !token.allSatisfy { $0 == "-" || $0 == "—" }
            }
            .joined(separator: " ")
            .replacingOccurrences(of: "————", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if collapsed.hasPrefix(message.subject) {
            let start = collapsed.index(collapsed.startIndex, offsetBy: message.subject.count)
            return String(collapsed[start...]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return collapsed
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return formatter
    }()
}

// Web AccentSwitcher 圆点：30×30 命中区，26 圆点；
// 选中 = 2px var(--fg-0) 外圈 + 同色光晕 + 深色勾，hover 放大 1.1。
private struct AccentDot: View {
    var preset: AccentPreset
    var selected: Bool
    var dark: Bool
    var onSelect: () -> Void

    @State private var hovering = false

    private var fg0: Color { Color(hex: dark ? "f6f9fb" : "0c1217") }

    var body: some View {
        Button(action: onSelect) {
            ZStack {
                Circle()
                    .fill(preset.color)
                    .frame(width: 26, height: 26)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(preset.accentFg(dark))
                }
            }
            .frame(width: 30, height: 30)
            .overlay(
                Circle()
                    .stroke(selected ? fg0 : Color.clear, lineWidth: 2)
            )
            .shadow(color: selected ? preset.color.opacity(0.55) : .clear, radius: 8)
            .scaleEffect(hovering ? 1.1 : 1.0)
            .animation(.easeOut(duration: 0.12), value: hovering)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering = $0 }
        .help(L(preset.title))
    }
}
