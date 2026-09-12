import SwiftUI
import AppKit

/// 原生开机日志（对齐 Web `/system/openLogs` · `open_boot_log.ftl`）。
/// 终端风格：历史 JSON + SSE 实时尾随。
struct OpenLogsView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = OpenLogsViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "开机日志",
            subtitle: "实时抢机日志流",
            systemImage: "terminal",
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.bottom, 10)
                    }
                    filterBar
                    terminalCard
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            model.reloadHistory()
        }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            connectionBadge
            // Web logs.action.pause/resume：暂停时断开 SSE 并切徽章
            AppButton(
                title: model.paused ? "恢复滚动" : "暂停滚动",
                systemImage: model.paused ? "play" : "pause",
                kind: .secondary
            ) {
                model.paused.toggle()
            }
            // Web logs.action.download：导出日志文件
            AppButton(title: "下载日志", systemImage: "arrow.down", kind: .secondary) {
                model.exportLogs()
            }
            AppButton(title: "清空", systemImage: "trash", kind: .secondary) {
                model.clearLogs()
            }
        }
    }

    private var connectionBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(connectionColor)
                .frame(width: 8, height: 8)
            Text(model.connection.label)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(dark ? Color.white.opacity(0.75) : Color(hex: "374a61"))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(dark ? Color(hex: "2c3136") : Color(hex: "eef2f6"))
        )
    }

    private var connectionColor: Color {
        switch model.connection {
        case .connected: return AppTheme.sidebarActive
        case .connecting: return AccentPreset.orange.color
        case .disconnected: return Color(hex: "f05653")
        }
    }

    // MARK: - Filter bar

    private var filterBar: some View {
        HStack(spacing: 10) {
            // 级别切换胶囊（全部、INFO、WARN、ERROR、SUCCESS）
            HStack(spacing: 4) {
                ForEach(OpenLogFilterLevel.allCases) { lvl in
                    filterLevelButton(lvl)
                }
            }

            // 关键字搜索框
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
                TextField("关键字过滤", text: $model.keyword)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 11.5))
                if !model.keyword.isEmpty {
                    Button(action: { model.keyword = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarText(dark))
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .frame(width: 180)
            .background(dark ? Color(hex: "181c20") : Color(hex: "edf2f7"))
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppTheme.border(dark).opacity(0.8), lineWidth: 1)
            )

            Spacer()

            // 过滤条数统计：共 M / N 条
            HStack(spacing: 2) {
                Text("共")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Text("\(model.filteredEntries.count)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarActive)
                Text(" / \(model.entries.count) 条")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
        )
        .padding(.bottom, 10)
    }

    private func filterLevelButton(_ lvl: OpenLogFilterLevel) -> some View {
        let isSelected = model.filterLevel == lvl
        let count = model.count(for: lvl)
        let color = lvl.activeColor

        return Button(action: { model.filterLevel = lvl }) {
            HStack(spacing: 4) {
                Text(lvl.rawValue)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .medium))
                Text("\(count)")
                    .font(.system(size: 9.5, weight: .regular, design: .monospaced))
                    .opacity(isSelected ? 0.9 : 0.6)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(isSelected ? color.opacity(dark ? 0.22 : 0.12) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(isSelected ? color.opacity(0.8) : AppTheme.border(dark).opacity(0.6), lineWidth: 1)
            )
            .foregroundColor(isSelected ? color : AppTheme.sidebarText(dark))
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Terminal

    private var terminalCard: some View {
        VStack(spacing: 0) {
            terminalHeader
            terminalBody
            terminalFooter
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(6)
        .shadow(color: Color.black.opacity(dark ? 0.35 : 0.12), radius: 8, x: 0, y: 2)
    }

    private var terminalHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: "desktopcomputer")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.sidebarActive)
            Text("OCI 开机日志")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(AppTheme.sidebarActive)
            // Blinking cursor affordance
            Text("▌")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(AppTheme.sidebarActive.opacity(0.7))
            Spacer()
            HStack(spacing: 6) {
                Circle()
                    .fill(connectionColor)
                    .frame(width: 7, height: 7)
                Text(model.connection.label)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.65))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(hex: "0a0a0a"))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.border(dark).opacity(0.5)),
            alignment: .bottom
        )
    }

    private var terminalBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    if model.entries.isEmpty && !model.isLoadingHistory {
                        Text("// 暂无日志 — 等待抢机任务输出…")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Color.white.opacity(0.35))
                            .padding(.vertical, 8)
                            .id("empty")
                    } else if model.filteredEntries.isEmpty {
                        Text("没有匹配的日志")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Color.white.opacity(0.35))
                            .padding(.vertical, 8)
                            .id("no-match")
                    }
                    ForEach(model.filteredEntries) { entry in
                        Text(entry.text)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(entry.level.color)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .id(entry.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.black)
            .onChange(of: model.scrollToken) { _ in
                guard model.autoScroll else { return }
                withAnimation(.easeOut(duration: 0.15)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
            .onAppear {
                if model.autoScroll {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var terminalFooter: some View {
        HStack(spacing: 16) {
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 10))
                Text(model.clockText.isEmpty ? "--:--:--" : model.clockText)
                    .font(.system(size: 11, design: .monospaced))
            }
            .foregroundColor(Color.white.opacity(0.55))

            HStack(spacing: 6) {
                Image(systemName: "list.bullet")
                    .font(.system(size: 10))
                if model.filteredEntries.count == model.entries.count {
                    Text("共 \(model.entries.count) 条")
                        .font(.system(size: 11, design: .monospaced))
                } else {
                    Text("显示 \(model.filteredEntries.count) / 共 \(model.entries.count) 条")
                        .font(.system(size: 11, design: .monospaced))
                }
            }
            .foregroundColor(Color.white.opacity(0.55))

            Spacer()

            Toggle(isOn: $model.autoScroll) {
                Text("自动滚动")
                    .font(.system(size: 11))
                    .foregroundColor(Color.white.opacity(0.7))
            }
            .toggleStyle(CheckboxToggleStyle())
            .foregroundColor(Color.white.opacity(0.7))

            Text(model.paused ? "已暂停接收" : "实时接收中")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.white.opacity(0.45))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color(hex: "0a0a0a"))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.sidebarActive.opacity(0.15)),
            alignment: .top
        )
    }

    // MARK: - Error

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.orange)
            Text(text)
                .font(.system(size: 12))
                .foregroundColor(dark ? Color.white.opacity(0.85) : Color(hex: "1e2f42"))
                .lineLimit(2)
            Spacer()
            Button("重试") { model.reconnectNow() }
                .buttonStyle(PlainButtonStyle())
                .foregroundColor(AppTheme.sidebarActive)
                .font(.system(size: 12, weight: .semibold))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.orange.opacity(0.12))
        )
        .padding(.bottom, 8)
    }
}

// MARK: - Checkbox (macOS 11)

private struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button(action: { configuration.isOn.toggle() }) {
            HStack(spacing: 6) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .font(.system(size: 12))
                    .foregroundColor(configuration.isOn ? AppTheme.sidebarActive : Color.white.opacity(0.45))
                configuration.label
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}
