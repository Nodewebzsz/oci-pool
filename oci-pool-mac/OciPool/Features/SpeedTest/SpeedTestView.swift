import SwiftUI

/// 全球链路监控（对齐 Web `speed_test.ftl`，UI 对齐 `IpQualityView` 基准）。
struct SpeedTestView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = SpeedTestViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    private let regionColumns = [
        GridItem(.adaptive(minimum: 220, maximum: 380), spacing: 12)
    ]

    var body: some View {
        PageScaffold(
            title: "OCI 链路测试",
            subtitle: "OCI Speed Test · 从当前网络测到全球 45 个 OCI 区域的延迟",
            systemImage: "wifi",
            toolbar: { toolbar },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let err = model.errorText, !err.isEmpty {
                            errorBanner(err)
                                .padding(.bottom, 12)
                        }

                        statsRow

                        if !model.top5.isEmpty {
                            rankSection
                        }

                        regionSection
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .appLoading(model.isLoadingRegions && model.regions.isEmpty)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.refresh() }
        }
        .environmentObject(appearance)
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            if model.hasCompleted && !model.isTesting {
                AppButton(
                    title: "重置",
                    systemImage: "arrow.counterclockwise",
                    kind: .secondary
                ) {
                    model.resetResults()
                }
            }
            AppButton(
                title: "刷新",
                systemImage: "arrow.clockwise",
                kind: .secondary,
                isLoading: model.isLoadingRegions && !model.isTesting
            ) {
                Task { await model.refresh() }
            }
            AppButton(
                title: model.isTesting ? "测速中…" : (model.hasCompleted ? "重新测速" : "开始测速"),
                systemImage: "bolt.fill",
                kind: .primary,
                isLoading: model.isTesting,
                enabled: !model.regions.isEmpty
            ) {
                Task { await model.runTest() }
            }
        }
    }

    // MARK: - Error

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
            Text(text)
                .font(.system(size: 12))
            Spacer(minLength: 8)
            AppButton(title: "重试", kind: .secondary) {
                Task { await model.refresh() }
            }
        }
        .foregroundColor(AppTheme.danger)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.danger.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Stats（对齐 Web 端 3 状态卡风格：分行排版 + 右侧半透明水印图标）

    private var statsRow: some View {
        HStack(alignment: .top, spacing: 12) {
            // 1. 当前 IP
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("当前 IP")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarText(dark))
                        .textCase(.uppercase)

                    Text(model.clientIP)
                        .font(.system(size: 17, weight: .bold, design: .monospaced))
                        .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .padding(.top, 2)

                    if !model.clientLocation.isEmpty {
                        Text(model.clientLocation)
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarText(dark))
                            .lineLimit(1)
                            .padding(.top, 1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "wifi")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(AppTheme.info.opacity(dark ? 0.35 : 0.25))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
            .background(AppTheme.sidebarBg(dark))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
            )

            // 2. 最优区域
            let hasBest = model.bestRegion != nil
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("最优区域")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarText(dark))
                        .textCase(.uppercase)

                    if let best = model.bestRegion {
                        HStack(spacing: 6) {
                            Text(best.flag)
                                .font(.system(size: 16))
                            Text(best.name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(dark ? Color.white.opacity(0.95) : Color.primary)
                                .lineLimit(1)
                        }
                        .padding(.top, 2)

                        HStack(spacing: 4) {
                            Text("\(best.ms) ms")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(AppTheme.sidebarActive)
                            Text("·")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.sidebarText(dark))
                            Text(best.code)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(AppTheme.sidebarText(dark))
                                .lineLimit(1)
                        }
                        .padding(.top, 1)
                    } else {
                        Text(model.isTesting ? "测试中…" : "--")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(AppTheme.sidebarText(dark))
                            .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "trophy.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarActive.opacity(hasBest ? (dark ? 0.45 : 0.3) : 0.15))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
            .background(
                hasBest
                    ? (dark ? Color(hex: "0e221b") : Color(hex: "f0fdf4"))
                    : AppTheme.sidebarBg(dark)
            )
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(
                        hasBest
                            ? AppTheme.sidebarActive
                            : AppTheme.border(dark).opacity(0.7),
                        lineWidth: hasBest ? 1.5 : 1
                    )
            )

            // 3. 平均延迟
            let hasAvg = model.avgLatencyMs != nil
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("平均延迟")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarText(dark))
                        .textCase(.uppercase)

                    if let avg = model.avgLatencyMs {
                        let tone = SpeedLatencyTone.from(ms: avg)
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text("\(avg)")
                                .font(.system(size: 18, weight: .bold, design: .monospaced))
                                .foregroundColor(SpeedTestTheme.toneColor(tone, dark: dark))
                            Text("ms")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }
                        .padding(.top, 2)

                        Text("基于 \(model.testedSuccessCount) / \(model.regions.count) 个区域")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarText(dark))
                            .padding(.top, 1)
                    } else {
                        Text("--")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(AppTheme.sidebarText(dark))
                            .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "gauge.with.needle")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(Color(hex: "00b6be").opacity(hasAvg ? (dark ? 0.45 : 0.3) : 0.15))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
            .background(AppTheme.sidebarBg(dark))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
            )
        }
    }

    // MARK: - Top5

    private var rankSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "award.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarActive)
                Text("Top 5 最优线路")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                Spacer(minLength: 0)
            }

            // Web：5 列奖牌卡（🥇🥈🥉4️⃣5️⃣ + 国旗 + 中文名 + code + ms），第 1 名浅绿高亮
            HStack(spacing: 10) {
                ForEach(Array(model.top5.enumerated().prefix(5)), id: \.element.id) { index, item in
                    top5Card(index: index, item: item)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
        )
    }

    private func top5Card(index: Int, item: SpeedRankItem) -> some View {
        let medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
        let medal = medals[min(index, medals.count - 1)]
        let tone = SpeedTestTheme.toneColor(SpeedLatencyTone.from(ms: item.ms), dark: dark)
        let isFirst = index == 0
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Text(medal).font(.system(size: 15))
                Text(item.flag).font(.system(size: 15))
            }
            Text(item.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                .lineLimit(1)
                .padding(.top, 2)
            Text(item.id)
                .font(.system(size: 9.5, design: .monospaced))
                .foregroundColor(AppTheme.sidebarText(dark))
                .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(item.ms)")
                    .font(.system(size: 15, weight: .bold, design: .monospaced))
                    .foregroundColor(tone)
                Text("ms")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(
                    isFirst
                        ? (dark ? Color(hex: "102820") : Color(hex: "f0fdf4"))
                        : (dark ? AppTheme.sidebarHover(dark) : Color(hex: "f8fafc"))
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    isFirst ? AppTheme.sidebarActive : AppTheme.border(dark).opacity(0.7),
                    lineWidth: 1
                )
        )
    }

    // MARK: - Regions

    private var regionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "globe")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Text("全球 OCI 区域 (\(model.regions.count))")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                Spacer(minLength: 8)

                // 色阶图例对齐 Web 端
                HStack(spacing: 12) {
                    legendItem(color: SpeedTestTheme.success, label: "≤ 80 ms")
                    legendItem(color: SpeedTestTheme.warning, label: "80-250 ms")
                    legendItem(color: SpeedTestTheme.danger, label: "> 250 ms")
                }
            }

            // Web：测速中整条进度条区块（info 边框 + done/total + info→cyan 渐变）
            if model.isTesting {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("正在测速中...")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.info)
                        Spacer()
                        Text("\(model.testedCount)/\(model.regions.count)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(AppTheme.sidebarText(dark))
                    }
                    GeometryReader { g in
                        let progress = model.regions.isEmpty ? 0 : Double(model.testedCount) / Double(model.regions.count)
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4).fill(AppTheme.sidebarHover(dark))
                            RoundedRectangle(cornerRadius: 4)
                                .fill(LinearGradient(colors: [AppTheme.info, Color(hex: "00b6be")],
                                                     startPoint: .leading, endPoint: .trailing))
                                .frame(width: g.size.width * progress)
                        }
                    }
                    .frame(height: 8)
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark)))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.info.opacity(0.45), lineWidth: 1))
            }

            if model.regions.isEmpty && !model.isLoadingRegions {
                EmptyStateView(
                    icon: "globe",
                    title: "暂无区域节点",
                    subtitle: "无法加载 Oracle 区域 endpoint，请检查后端连接",
                    actionTitle: "重新加载",
                    action: { Task { await model.refresh() } }
                )
                .frame(minHeight: 180)
                .background(AppTheme.sidebarBg(dark))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                )
            } else {
                LazyVGrid(columns: regionColumns, spacing: 12) {
                    ForEach(model.regions) { region in
                        regionCard(region)
                    }
                }
            }
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        }
    }

    private func regionCard(_ region: SpeedRegionEndpoint) -> some View {
        let state = model.latency[region.code] ?? .idle
        let tone: SpeedLatencyTone = {
            if case .ok(let ms) = state { return SpeedLatencyTone.from(ms: ms) }
            return .neutral
        }()
        let barFraction: CGFloat = {
            if case .ok(let ms) = state {
                if ms < 500 { return CGFloat(max(0.06, 1.0 - Double(ms) / 500.0)) }
                return 0.06
            }
            return 0
        }()
        let testing = state == .testing
        let isBest = model.bestRegion?.code == region.code

        return VStack(alignment: .leading, spacing: 6) {
            // 头部：国旗 + 中文名，右侧如果是最优显示 🏆
            HStack(spacing: 6) {
                Text(region.flag)
                    .font(.system(size: 14))
                Text(region.simpleName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if isBest {
                    Text("🏆")
                        .font(.system(size: 13))
                }
            }

            // 区域 Code 单独占一行，解决挤在右边胶囊被硬折三行的严重缺陷
            Text(region.code)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(AppTheme.sidebarText(dark))
                .lineLimit(1)
                .padding(.bottom, 2)

            // 大字延迟 + ms
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                if testing {
                    ProgressView()
                        .scaleEffect(0.65)
                        .frame(width: 20, height: 20)
                } else {
                    Text(state.displayText)
                        .font(Font.system(size: state == .timeout ? 15 : 22, weight: .bold).monospacedDigit())
                        .foregroundColor(
                            state == .timeout
                                ? AppTheme.sidebarText(dark)
                                : SpeedTestTheme.toneColor(tone, dark: dark)
                        )
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                if case .ok = state {
                    Text("ms")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppTheme.sidebarText(dark))
                }
                Spacer(minLength: 0)
            }
            .frame(height: 26, alignment: .bottomLeading)

            // 底部细进度条
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(SpeedTestTheme.progressTrack(dark))
                        .frame(height: 4)
                    Capsule()
                        .fill(barColor(tone: tone, testing: testing))
                        .frame(width: max(0, geo.size.width * barFraction), height: 4)
                        .animation(.easeOut(duration: 0.4), value: barFraction)
                }
            }
            .frame(height: 4)
        }
        .padding(12)
        .background(
            isBest
                ? (dark ? Color(hex: "102820") : Color(hex: "f0fdf4"))
                : AppTheme.sidebarBg(dark)
        )
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(
                    isBest
                        ? AppTheme.sidebarActive
                        : (testing ? AppTheme.info.opacity(0.7) : AppTheme.border(dark).opacity(0.7)),
                    lineWidth: (isBest || testing) ? 1.5 : 1
                )
        )
        .shadow(
            color: isBest
                ? AppTheme.sidebarActive.opacity(0.15)
                : Color.black.opacity(dark ? 0.18 : 0.04),
            radius: isBest ? 6 : 3,
            y: 1
        )
    }

    private func barColor(tone: SpeedLatencyTone, testing: Bool) -> Color {
        if testing { return AppTheme.sidebarActive.opacity(0.35) }
        switch tone {
        case .fast: return SpeedTestTheme.success
        case .mid: return SpeedTestTheme.warning
        case .slow: return SpeedTestTheme.danger
        case .neutral: return AppTheme.sidebarActive.opacity(0.35)
        }
    }
}
