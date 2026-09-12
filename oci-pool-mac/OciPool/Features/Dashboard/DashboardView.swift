import SwiftUI

/// Web-parity 系统监控 page (`page-monitor.jsx`):
/// PageHeader 卡 + 5 KPI 网格 + 4 仪表卡 + 底部 抢机趋势(1.6fr)/实时活动(1fr)。
/// 颜色全部走 AppTheme 全局 token（Web CSS 变量），深浅色统一换肤。
struct DashboardView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = DashboardViewModel()

    private var dark: Bool { appearance.isDarkEffective }
    private let timeLabels = ["24h", "18h", "12h", "6h", "3h", "now"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                pageHeader
                if let err = model.errorText, !err.isEmpty {
                    errorBanner(err)
                }
                kpiGrid
                resourceGrid
                bottomGrid
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(AppTheme.pageBg(dark).ignoresSafeArea())
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.refreshAll() }
        }
    }

    // MARK: - PageHeader（Web ui.jsx PageHeader：bg-1 卡 / radius 8 / padding 14px 20px / marginBottom 14）

    private var pageHeader: some View {
        HStack(alignment: .center, spacing: 16) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.sidebarActive.opacity(0.18))
                        .frame(width: 32, height: 32)
                    // Web 页头图标为 Lucide activity 描边（SF Symbol 在部分系统上不渲染）
                    MenuGlyph(name: "activity", size: 17, color: AppTheme.sidebarActive)
                }
                Text("系统监控")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                    
            }
            Spacer()
            HStack(spacing: 8) {
                // 时间戳徽章：bg-2 圆角 6，脉冲点 6 + mono 时间 fg-1
                HStack(spacing: 6) {
                    Circle()
                        .fill(AppTheme.sidebarActive)
                        .frame(width: 6, height: 6)
                        .shadow(color: AppTheme.sidebarActive.opacity(0.5), radius: 3)
                    Text(model.lastUpdateText)
                        .font(.system(size: 11.5, design: .monospaced))
                        .foregroundColor(AppTheme.sidebarText(dark))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(AppTheme.sidebarHover(dark))
                )

                // outline 按钮：padding 5/12 · radius 5 · border-strong
                Button(action: { Task { await model.refreshAll() } }) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .medium))
                        Text("刷新")
                            .font(.system(size: 12.5, weight: .medium))
                    }
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: 5)
                            .stroke(AppTheme.border(dark).opacity(1.6), lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private func errorBanner(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundColor(AppTheme.danger)
    }

    // MARK: - KPI（5 列 · gap 12 · marginBottom 14）

    private var kpiGrid: some View {
        HStack(alignment: .top, spacing: 12) {
            kpiCard(icon: "list.bullet", iconColor: AppTheme.cyan, title: "总 API 数",
                    value: "\(model.stats.totalApiCalls)")
            kpiCard(icon: "server.rack", iconColor: AppTheme.sidebarActive, title: "总 BOOT 实例数",
                    value: "\(model.stats.totalBootInstances)")
            kpiCard(icon: "arrow.triangle.2.circlepath", iconColor: AppTheme.info, title: "总抢机次数",
                    value: "\(model.stats.totalAttempts)")
            kpiCard(icon: "checkmark.circle", iconColor: AppTheme.sidebarActive, title: "抢机成功次数",
                    value: "\(model.stats.successfulAttempts)")
            kpiCard(icon: "xmark.circle", iconColor: AppTheme.danger, title: "抢机失败次数",
                    value: "\(model.stats.failCounts)")
        }
    }

    /// Web KPICard：bg-1 卡 · radius 8 · padding 14px 16px · 图标 36(18% 底) · 标签 11 fg-3 / 数值 22·700 fg-0
    private func kpiCard(icon: String, iconColor: Color, title: String, value: String) -> some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(iconColor.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                    .truncationMode(.tail)
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
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    // MARK: - 资源仪表（4 列 · gap 14）

    private var resourceGrid: some View {
        HStack(alignment: .top, spacing: 14) {
            monitorCard(
                icon: "cpu", iconColor: AppTheme.sidebarActive,
                title: "CPU 信息",
                subtitle: model.metrics.cpuModel.isEmpty ? "处理器信息" : model.metrics.cpuModel,
                gauge: { gaugeSpec(color: AppTheme.sidebarActive, value: model.metrics.cpuUsage,
                                   label: "%", valueSize: 36) },
                rows: [
                    ("物理核心", "\(model.metrics.cpuPhysicalCount) C"),
                    ("逻辑核心", "\(model.metrics.cpuLogicalCount) C"),
                    ("CPU 温度", model.metrics.cpuTemperature > 0
                        ? String(format: "%.1f °C", model.metrics.cpuTemperature) : "N/A"),
                    ("主频", model.metrics.cpuFrequency > 0
                        ? String(format: "%.2f GHz", model.metrics.cpuFrequency) : "N/A")
                ]
            )

            monitorCard(
                icon: "rectangle.stack", iconColor: AppTheme.orange,
                title: "内存使用",
                subtitle: model.metrics.totalMemory > 0
                    ? String(format: "总内存: %.2f GB", model.metrics.totalMemory / 1024)
                    : "总内存: ",
                gauge: { gaugeSpec(color: AppTheme.orange, value: model.metrics.memoryUsage,
                                   label: "%", valueSize: 36) },
                rows: [
                    ("总内存", DashboardFormat.memoryMB(model.metrics.totalMemory)),
                    ("已用内存", DashboardFormat.memoryMB(model.metrics.usedMemory)),
                    ("可用内存", DashboardFormat.memoryMB(model.metrics.availableMemory)),
                    ("交换空间", String(format: "%.0fMB / %.0fMB",
                                       model.metrics.swapUsed, model.metrics.swapTotal))
                ]
            )

            monitorCard(
                icon: "externaldrive", iconColor: AppTheme.danger,
                title: "磁盘使用",
                subtitle: "存储状态监控",
                gauge: { gaugeSpec(color: AppTheme.danger, value: model.metrics.diskUsage,
                                   label: "%", valueSize: 36) },
                rows: [
                    ("总容量", DashboardFormat.size(model.metrics.diskTotal)),
                    ("已用空间", DashboardFormat.size(model.metrics.diskUsed)),
                    ("可用空间", DashboardFormat.size(model.metrics.diskFree)),
                    ("文件系统", "N/A（后端未提供）")
                ],
                mutedRows: [3]
            )

            monitorCard(
                icon: "server.rack", iconColor: AppTheme.sidebarActive,
                title: "系统信息",
                subtitle: model.metrics.hostname.isEmpty ? "—" : model.metrics.hostname,
                gauge: {
                    var s = gaugeSpec(color: AppTheme.sidebarActive,
                                      value: DashboardFormat.uptimeDaysNumber(model.metrics.systemUptime),
                                      label: "天在线", valueSize: 30)
                    s.maxValue = 90
                    s.showUnit = false
                    return s
                },
                rows: [
                    ("操作系统", model.metrics.osName.isEmpty ? "-" : model.metrics.osName),
                    ("系统架构", model.metrics.osArch.isEmpty ? "-" : model.metrics.osArch),
                    ("运行时间", DashboardFormat.uptime(model.metrics.systemUptime))
                ]
            )
        }
    }

    private func gaugeSpec(color: Color, value: Double, label: String, valueSize: CGFloat) -> GaugeSpec {
        GaugeSpec(color: color, value: value, unitLabel: label, valueSize: valueSize)
    }

    /// Web Card（bg-1 / radius 8）+ 头部（inset 10 · padding 12px 16px · 下边框）+ 内容 padding 16
    private func monitorCard(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        gauge: () -> GaugeSpec,
        rows: [(String, String)],
        mutedRows: Set<Int> = []
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // header（外层 margin 10 对齐 Web Card 头部的 margin:10）
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(iconColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppTheme.navIcon(dark))
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 10.5, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(AppTheme.sidebarBg(dark))
            .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)
            .padding(10)

            // gauge 居中（Web: padding 4px 0 8px，尺寸 clamp 144~180）
            spec(gauge())
                .padding(.top, 4)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity)

            // 详情行：上边框 + paddingTop 14 · 行距 10 · 无行分隔线
            VStack(spacing: 10) {
                Rectangle().fill(AppTheme.border(dark)).frame(height: 1)
                ForEach(Array(rows.enumerated()), id: \.offset) { idx, row in
                    HStack(alignment: .center, spacing: 12) {
                        Text(row.0)
                            .font(.system(size: 11.5))
                            .foregroundColor(AppTheme.textTertiary(dark))
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Text(row.1)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(mutedRows.contains(idx) ? AppTheme.textTertiary(dark) : AppTheme.navIcon(dark))
                            .multilineTextAlignment(.trailing)
                            .lineLimit(2)
                    }
                }
            }
            .padding(.top, 14)
            .padding(.bottom, 16)
            .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    @ViewBuilder
    private func spec(_ s: GaugeSpec) -> some View {
        DashboardGauge(
            value: s.value,
            maxValue: s.maxValue,
            color: s.color,
            unitLabel: s.showUnit ? s.unitLabel : "",
            belowLabel: s.showUnit ? nil : s.unitLabel,
            dark: dark,
            size: 168,
            thickness: 14,
            valueSize: s.valueSize
        )
    }

    // MARK: - 底部（1.6fr 抢机趋势 + 1fr 实时活动）

    private var bottomGrid: some View {
        HStack(alignment: .top, spacing: 14) {
            grabTrendCard
                .frame(maxWidth: .infinity)
                .layoutPriority(2)
            activityCard
                .frame(minWidth: 280, maxWidth: 400)
                .layoutPriority(1)
        }
    }

    private var grabTrendCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardHeader(icon: "chart.bar", iconColor: AppTheme.cyan,
                       title: "抢机趋势 · 过去 24 小时",
                       subtitle: "后端当前仅提供累计统计，未提供历史趋势接口") {
                HStack(spacing: 12) {
                    legendItem(color: AppTheme.cyan, shape: .square, label: "抢机尝试")
                    legendItem(color: AppTheme.sidebarActive, shape: .circle, label: "成功")
                }
            }

            EmptyBarChart(labels: timeLabels, dark: dark)
                .frame(height: 200)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
        }
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardHeader(icon: "dot.radiowaves.left.and.right", iconColor: AppTheme.sidebarActive,
                       title: "实时活动", subtitle: nil) {
                EmptyView()
            }

            ScrollView {
                VStack(spacing: 0) {
                    if model.activityLogs.isEmpty {
                        Text("暂无实时活动")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.textTertiary(dark))
                            .frame(maxWidth: .infinity, minHeight: 152)
                            .padding(20)
                    } else {
                        ForEach(Array(model.activityLogs.enumerated()), id: \.element.id) { idx, log in
                            activityRow(log, showDivider: idx < model.activityLogs.count - 1)
                        }
                    }
                }
            }
            .frame(maxHeight: 320)
        }
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    /// Web Card 头部：icon 16 + 标题 13/600 + 副标题 11 fg-3，下边框（含 inset 10）
    private func cardHeader<Action: View>(
        icon: String, iconColor: Color, title: String, subtitle: String?,
        @ViewBuilder action: () -> Action
    ) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(iconColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                    .lineLimit(1)
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 12)
            action()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(AppTheme.sidebarBg(dark))
        .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)
        .padding(10)
    }

    /// Web 活动行：padding 10px 16px · 时间 mono 10 fg-3 · 级别徽章(mono 9·700 · soft 底) · 消息 + 租户·区域
    private func activityRow(_ log: ActivityLog, showDivider: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(log.time)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(AppTheme.textTertiary(dark))
                .frame(width: 56, alignment: .leading)
                .padding(.top, 2)
            Text(log.level)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(levelColor(log.level).fg)
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(levelColor(log.level).bg)
                .cornerRadius(3)
                .frame(minWidth: 46, alignment: .center)
            VStack(alignment: .leading, spacing: 2) {
                Text(log.msg)
                    .font(.system(size: 11.5))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("\(log.tenant) · \(log.region)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .overlay(
            Rectangle().fill(AppTheme.border(dark)).frame(height: 1),
            alignment: .bottom
        )
        .opacity(showDivider ? 1 : 0.95)
    }

    /// Web logColor：INFO cyan / WARN orange / ERROR danger / SUCCESS accent / DEBUG bg-3（均 soft 底）
    private func levelColor(_ level: String) -> (bg: Color, fg: Color) {
        switch level {
        case "ERROR": return (AppTheme.dangerSoft(dark), AppTheme.danger)
        case "WARN": return (AppTheme.orangeSoft(dark), AppTheme.orange)
        case "SUCCESS": return (AppearanceController.shared.accent.accentSoft(dark), AppTheme.sidebarActive)
        case "DEBUG": return (AppTheme.bg3(dark), AppTheme.textSecondary(dark))
        default: return (AppTheme.cyanSoft(dark), AppTheme.cyan)
        }
    }

    private func legendItem(color: Color, shape: LegendShape, label: String) -> some View {
        HStack(spacing: 5) {
            legendDot(color, shape: shape)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textSecondary(dark))
        }
    }

    @ViewBuilder
    private func legendDot(_ color: Color, shape: LegendShape) -> some View {
        switch shape {
        case .square:
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 8, height: 8)
        case .circle:
            Circle().fill(color).frame(width: 8, height: 8)
        }
    }

    private enum LegendShape { case square, circle }
}

private struct GaugeSpec {
    var color: Color
    var value: Double
    var unitLabel: String
    var valueSize: CGFloat
    var maxValue: Double = 100
    var showUnit: Bool = true
}

// MARK: - Empty bar chart (web BarChart with no data)

struct EmptyBarChart: View {
    let labels: [String]
    let dark: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let left: CGFloat = 40
            let bottom: CGFloat = 24
            let top: CGFloat = 16
            let plotW = max(0, w - left - 12)
            let plotH = max(0, h - top - bottom)
            let maxY: Double = 120

            ZStack {
                // horizontal grid lines + y labels
                ForEach(0...4, id: \.self) { i in
                    let y = top + plotH - (plotH * CGFloat(i) / 4)
                    let tick = maxY / 4 * Double(i)
                    Path { p in p.move(to: CGPoint(x: left, y: y)); p.addLine(to: CGPoint(x: left + plotW, y: y)) }
                        .stroke(AppTheme.border(dark), style: StrokeStyle(lineWidth: 1, dash: i == 0 ? [] : [2, 4]))
                    Text(String(format: "%.0f", tick))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .frame(width: 30, alignment: .trailing)
                        .position(x: 18, y: y)
                }

                // x labels
                ForEach(Array(labels.enumerated()), id: \.offset) { i, label in
                    let x = left + (CGFloat(i) / CGFloat(max(1, labels.count))) * plotW + (plotW / CGFloat(max(1, labels.count))) / 2
                    Text(label)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .position(x: x, y: h - 8)
                }

                Text("暂无数据")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .position(x: left + plotW / 2, y: top + plotH / 2)
            }
        }
        .clipped()
    }
}

// MARK: - Gauge（Web CircularGauge：轨道 bg-3 · 圆头进度 · 中央数值 + 下方标签，无内圆底）

struct DashboardGauge: View {
    let value: Double
    var maxValue: Double = 100
    var color: Color = AppTheme.sidebarActive
    var unitLabel: String = "%"
    var belowLabel: String? = nil
    let dark: Bool
    var size: CGFloat = 180
    var thickness: CGFloat = 14
    var valueSize: CGFloat = 36

    private var clamped: Double { Swift.min(maxValue, Swift.max(0, value)) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(AppTheme.bg3(dark), lineWidth: thickness)
            Circle()
                .trim(from: 0, to: CGFloat(clamped / maxValue))
                .stroke(color, style: StrokeStyle(lineWidth: thickness, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 6) {
                if belowLabel == nil {
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text("\(Int(clamped.rounded()))")
                            .font(.system(size: valueSize, weight: .bold))
                            .foregroundColor(color)
                        Text(unitLabel)
                            .font(.system(size: valueSize * 0.45, weight: .bold))
                            .foregroundColor(color)
                    }
                                    } else {
                    Text("\(Int(clamped.rounded()))")
                        .font(.system(size: valueSize, weight: .bold))
                        .foregroundColor(color)
                                            Text(belowLabel ?? "")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                }
            }
        }
        .frame(width: size, height: size)
    }
}
