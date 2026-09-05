import SwiftUI

/// Web-parity 系统监控 page (`page-monitor.jsx`):
/// 5 横向 KPI 卡 + 4 仪表卡(CPU/内存/磁盘/系统)同一行 + 底部抢机趋势与活动流。
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
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(DashboardTheme.bg(dark).ignoresSafeArea())
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.refreshAll() }
        }
    }

    // MARK: - Header

    private var pageHeader: some View {
        HStack(alignment: .center) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(DashboardTheme.green(dark).opacity(0.14))
                        .frame(width: 40, height: 40)
                    Image(systemName: "activity")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(DashboardTheme.green(dark))
                }
                Text("系统监控")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(DashboardTheme.text(dark))
            }
            Spacer()
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(DashboardTheme.green(dark))
                        .frame(width: 6, height: 6)
                    Text(model.lastUpdateText)
                        .font(.system(size: 11.5, design: .monospaced))
                        .foregroundColor(DashboardTheme.muted(dark))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(DashboardTheme.surface(dark))
                        .overlay(Capsule().stroke(DashboardTheme.border(dark), lineWidth: 1))
                )

                Button(action: { Task { await model.refreshAll() } }) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .medium))
                        Text("刷新")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundColor(DashboardTheme.text(dark))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(DashboardTheme.surface(dark))
                            .overlay(Capsule().stroke(DashboardTheme.border(dark), lineWidth: 1))
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.bottom, 6)
        .overlay(
            Rectangle()
                .fill(DashboardTheme.border(dark))
                .frame(height: 1),
            alignment: .bottom
        )
        .padding(.bottom, 10)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text)
                .font(.system(size: 12))
            Spacer()
            Button("重试") {
                Task { await model.refreshAll() }
            }
            .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(DashboardTheme.red(dark))
        .padding(12)
        .background(DashboardTheme.red(dark).opacity(0.1))
        .cornerRadius(10)
    }

    // MARK: - KPI (5 horizontal tool-style cards)

    private var kpiGrid: some View {
        HStack(alignment: .top, spacing: 12) {
            kpiCard(icon: "list.bullet", iconColor: DashboardTheme.cyan(dark), title: "总API数",
                    value: "\(model.stats.totalApiCalls)")
            kpiCard(icon: "server.rack", iconColor: DashboardTheme.green(dark), title: "总Boot实例数",
                    value: "\(model.stats.totalBootInstances)")
            kpiCard(icon: "arrow.triangle.2.circlepath", iconColor: DashboardTheme.info(dark), title: "总抢机次数",
                    value: "\(model.stats.totalAttempts)")
            kpiCard(icon: "checkmark.circle.fill", iconColor: DashboardTheme.green(dark), title: "抢机成功次数",
                    value: "\(model.stats.successfulAttempts)")
            kpiCard(icon: "xmark.circle.fill", iconColor: DashboardTheme.red(dark), title: "抢机失败次数",
                    value: "\(model.stats.failCounts)")
        }
    }

    private func kpiCard(icon: String, iconColor: Color, title: String, value: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(iconColor.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(DashboardTheme.muted(dark))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(DashboardTheme.text(dark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DashboardTheme.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(DashboardTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    // MARK: - Resource gauges (4 in a row)

    private var resourceGrid: some View {
        HStack(alignment: .top, spacing: 14) {
            gaugeCard(
                icon: "cpu",
                iconColor: DashboardTheme.green(dark),
                title: "CPU信息",
                subtitle: model.metrics.cpuModel.isEmpty ? "加载中..." : model.metrics.cpuModel,
                gaugeColor: DashboardTheme.green(dark),
                gaugeValue: model.metrics.cpuUsage,
                gaugeLabel: "\(Int(model.metrics.cpuUsage.rounded()))%",
                details: [
                    ("物理核心", "\(model.metrics.cpuPhysicalCount) C"),
                    ("逻辑核心", "\(model.metrics.cpuLogicalCount) C"),
                    ("CPU温度", model.metrics.cpuTemperature > 0
                        ? String(format: "%.1f°C", model.metrics.cpuTemperature) : "N/A"),
                    ("主频", model.metrics.cpuFrequency > 0
                        ? String(format: "%.2f GHz", model.metrics.cpuFrequency) : "N/A")
                ]
            )

            gaugeCard(
                icon: "rectangle.stack.fill",
                iconColor: DashboardTheme.orange(dark),
                title: "内存使用",
                subtitle: model.metrics.totalMemory > 0
                    ? String(format: "总内存: %.1f GB", model.metrics.totalMemory / 1024)
                    : "加载中...",
                gaugeColor: DashboardTheme.orange(dark),
                gaugeValue: model.metrics.memoryUsage,
                gaugeLabel: "\(Int(model.metrics.memoryUsage.rounded()))%",
                details: [
                    ("总内存", DashboardFormat.memoryMB(model.metrics.totalMemory)),
                    ("已用内存", DashboardFormat.memoryMB(model.metrics.usedMemory)),
                    ("可用内存", DashboardFormat.memoryMB(model.metrics.availableMemory)),
                    ("交换空间", String(format: "%.0fMB / %.0fMB",
                                       model.metrics.swapUsed, model.metrics.swapTotal))
                ]
            )

            gaugeCard(
                icon: "externaldrive.fill",
                iconColor: DashboardTheme.red(dark),
                title: "磁盘使用",
                subtitle: "存储状态监控",
                gaugeColor: DashboardTheme.red(dark),
                gaugeValue: model.metrics.diskUsage,
                gaugeLabel: "\(Int(model.metrics.diskUsage.rounded()))%",
                details: [
                    ("总容量", DashboardFormat.size(model.metrics.diskTotal)),
                    ("已用空间", DashboardFormat.size(model.metrics.diskUsed)),
                    ("可用空间", DashboardFormat.size(model.metrics.diskFree)),
                    ("文件系统", "-")
                ]
            )

            gaugeCard(
                icon: "server.rack",
                iconColor: DashboardTheme.green(dark),
                title: "系统信息",
                subtitle: model.metrics.hostname.isEmpty ? "加载中..." : model.metrics.hostname,
                gaugeColor: DashboardTheme.green(dark),
                gaugeValue: DashboardFormat.uptimeDaysNumber(model.metrics.systemUptime),
                gaugeLabel: "\(DashboardFormat.uptimeDays(model.metrics.systemUptime))",
                details: [
                    ("操作系统", model.metrics.osName.isEmpty ? "-" : model.metrics.osName),
                    ("系统架构", model.metrics.osArch.isEmpty ? "-" : model.metrics.osArch),
                    ("运行时间", DashboardFormat.uptime(model.metrics.systemUptime)),
                    ("主机名", model.metrics.hostname.isEmpty ? "-" : model.metrics.hostname)
                ]
            )
        }
    }

    private func gaugeCard(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        gaugeColor: Color,
        gaugeValue: Double,
        gaugeLabel: String,
        details: [(String, String)]
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            cardHeader(icon: icon, iconColor: iconColor, title: title, subtitle: subtitle)
            DashboardGauge(value: gaugeValue, label: gaugeLabel, dark: dark, color: gaugeColor, size: 152, thickness: 13)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 12)
            detailRows(details, fixedRows: 4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(DashboardTheme.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(DashboardTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(10)
    }

    private func cardHeader(icon: String, iconColor: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(iconColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(DashboardTheme.text(dark))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(DashboardTheme.muted(dark))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Spacer(minLength: 0)
        }
        .padding(.bottom, 12)
    }

    private func detailRows(_ items: [(String, String)], fixedRows: Int = 4) -> some View {
        let rowH: CGFloat = 32
        var rows = items
        while rows.count < fixedRows { rows.append(("", "")) }
        if rows.count > fixedRows { rows = Array(rows.prefix(fixedRows)) }
        return VStack(spacing: 0) {
            Rectangle().fill(DashboardTheme.border(dark)).frame(height: 1)
            ForEach(Array(rows.enumerated()), id: \.offset) { idx, item in
                HStack(alignment: .center) {
                    Text(item.0.isEmpty ? " " : item.0)
                        .font(.system(size: 11.5))
                        .foregroundColor(DashboardTheme.muted(dark))
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(item.1.isEmpty ? " " : item.1)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(DashboardTheme.text(dark))
                        .multilineTextAlignment(.trailing)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .frame(height: rowH)
                .opacity(item.0.isEmpty && item.1.isEmpty ? 0 : 1)
                if idx < rows.count - 1 {
                    Rectangle().fill(DashboardTheme.border(dark)).frame(height: 1)
                }
            }
        }
        .frame(height: 1 + CGFloat(fixedRows) * rowH + CGFloat(fixedRows - 1) * 1)
    }

    // MARK: - Bottom (grab trend + activity)

    private var bottomGrid: some View {
        HStack(alignment: .top, spacing: 14) {
            grabTrendCard
                .frame(maxWidth: .infinity)
                .layoutPriority(2)
            activityCard
                .frame(minWidth: 300, maxWidth: 380)
                .layoutPriority(1)
        }
    }

    private var grabTrendCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                HStack(spacing: 12) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(DashboardTheme.cyan(dark))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("抢机趋势")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(DashboardTheme.text(dark))
                        Text("近 24 小时租户实例开机情况")
                            .font(.system(size: 11))
                            .foregroundColor(DashboardTheme.muted(dark))
                    }
                }
                Spacer()
                HStack(spacing: 12) {
                    legendItem(color: DashboardTheme.cyan(dark), shape: .square, label: "总抢机")
                    legendItem(color: DashboardTheme.green(dark), shape: .circle, label: "成功")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .overlay(Rectangle().fill(DashboardTheme.border(dark)).frame(height: 1), alignment: .bottom)

            EmptyBarChart(labels: timeLabels, dark: dark)
                .frame(height: 220)
                .padding(.horizontal, 8)
                .padding(.vertical, 12)
        }
        .background(DashboardTheme.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(DashboardTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(10)
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "dot.radiowaves.left.and.right")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(DashboardTheme.green(dark))
                Text("操作动态")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(DashboardTheme.text(dark))
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .overlay(Rectangle().fill(DashboardTheme.border(dark)).frame(height: 1), alignment: .bottom)

            if model.activityLogs.isEmpty {
                VStack {
                    Text("暂无操作动态")
                        .font(.system(size: 12))
                        .foregroundColor(DashboardTheme.muted(dark))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .frame(minHeight: 200)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.activityLogs.enumerated()), id: \.element.id) { idx, log in
                        activityRow(log, showDivider: idx < model.activityLogs.count - 1)
                    }
                }
            }
        }
        .frame(maxHeight: .infinity)
        .background(DashboardTheme.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(DashboardTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(10)
    }

    private func activityRow(_ log: ActivityLog, showDivider: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(log.time)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(DashboardTheme.muted(dark))
                .frame(width: 56, alignment: .leading)
                .padding(.top, 1)
            Text(log.level)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(levelColor(log.level).fg)
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(levelColor(log.level).bg)
                .cornerRadius(3)
                .frame(minWidth: 46, alignment: .center)
            Text(log.msg)
                .font(.system(size: 11.5))
                .foregroundColor(DashboardTheme.text(dark))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .overlay(
            Rectangle().fill(DashboardTheme.border(dark)).frame(height: 1),
            alignment: .bottom
        )
        .opacity(showDivider ? 1 : 0.95)
    }

    private func levelColor(_ level: String) -> (bg: Color, fg: Color) {
        switch level {
        case "ERROR": return (DashboardTheme.red(dark).opacity(0.18), DashboardTheme.red(dark))
        case "WARN": return (DashboardTheme.orange(dark).opacity(0.18), DashboardTheme.orange(dark))
        case "SUCCESS": return (DashboardTheme.green(dark).opacity(0.18), DashboardTheme.green(dark))
        case "DEBUG": return (DashboardTheme.border(dark), DashboardTheme.muted(dark))
        default: return (DashboardTheme.cyan(dark).opacity(0.18), DashboardTheme.cyan(dark))
        }
    }

    private func legendItem(color: Color, shape: LegendShape, label: String) -> some View {
        HStack(spacing: 5) {
            legendDot(color, shape: shape)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(DashboardTheme.muted(dark))
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
                        .stroke(DashboardTheme.border(dark), style: StrokeStyle(lineWidth: 1, dash: i == 0 ? [] : [2, 4]))
                    Text(String(format: "%.0f", tick))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(DashboardTheme.muted(dark))
                        .frame(width: 30, alignment: .trailing)
                        .position(x: 18, y: y)
                }

                // x labels
                ForEach(Array(labels.enumerated()), id: \.offset) { i, label in
                    let x = left + (CGFloat(i) / CGFloat(max(1, labels.count))) * plotW + (plotW / CGFloat(max(1, labels.count))) / 2
                    Text(label)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(DashboardTheme.muted(dark))
                        .position(x: x, y: h - 8)
                }

                Text("暂无数据")
                    .font(.system(size: 11))
                    .foregroundColor(DashboardTheme.muted(dark))
                    .position(x: left + plotW / 2, y: top + plotH / 2)
            }
        }
        .clipped()
    }
}

// MARK: - Gauge (web conic-gradient style)

struct DashboardGauge: View {
    let value: Double
    let label: String
    let dark: Bool
    var color: Color? = nil
    var size: CGFloat = 160
    var thickness: CGFloat = 14

    private var clamped: Double { min(100, max(0, value)) }

    private var accent: Color {
        if let color = color { return color }
        if clamped <= 60 { return Color(hex: "22c55e") }
        if clamped <= 80 { return Color(hex: "f97316") }
        return Color(hex: "ef4444")
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(DashboardTheme.gaugeTrack(dark), lineWidth: thickness)
            Circle()
                .trim(from: 0, to: CGFloat(clamped / 100))
                .stroke(accent, style: StrokeStyle(lineWidth: thickness, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Circle()
                .fill(DashboardTheme.gaugeCenter(dark))
                .padding(thickness + 2)
                .shadow(color: Color.black.opacity(dark ? 0.4 : 0.08), radius: 5, y: 2)
            Text(label)
                .font(.system(size: size * 0.13, weight: .bold))
                .foregroundColor(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(.horizontal, size * 0.16)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Theme tokens (aligned to Web oklch accent)

enum DashboardTheme {
    static func bg(_ dark: Bool) -> Color { dark ? Color(hex: "1a1d21") : Color(hex: "f0f4f8") }
    static func surface(_ dark: Bool) -> Color { dark ? Color(hex: "23262c") : Color.white }
    static func border(_ dark: Bool) -> Color { dark ? Color(hex: "383c42") : Color(hex: "dde3ec") }
    static func text(_ dark: Bool) -> Color { dark ? Color(hex: "fafbfd") : Color(hex: "1a202c") }
    static func muted(_ dark: Bool) -> Color { dark ? Color(hex: "a2a5ab") : Color(hex: "64748b") }
    static func green(_ dark: Bool) -> Color { AppTheme.sidebarActive }
    static func cyan(_ dark: Bool) -> Color { dark ? Color(hex: "2ed3cc") : Color(hex: "0891b2") }
    static func orange(_ dark: Bool) -> Color { dark ? Color(hex: "f59e0b") : Color(hex: "d97706") }
    static func red(_ dark: Bool) -> Color { dark ? Color(hex: "f0524f") : Color(hex: "dc2626") }
    static func info(_ dark: Bool) -> Color { dark ? Color(hex: "7d8df0") : Color(hex: "4f6ef0") }
    static func gaugeTrack(_ dark: Bool) -> Color { dark ? Color(hex: "252a30") : Color(hex: "e8edf3") }
    static func gaugeCenter(_ dark: Bool) -> Color { dark ? Color(hex: "23262c") : Color.white }
}
