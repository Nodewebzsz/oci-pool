import SwiftUI

// MARK: - Network Quality Workbench (P1.1)

struct NetworkQualityWorkbenchView: View {
    @ObservedObject var model: NetworkQualityViewModel
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    @State private var agentsCollapsed = false
    @State private var showAllAgents = false

    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }
    private var itemRadius: CGFloat { AppTheme.isClaude ? 8 : 5 }
    private var pillRadius: CGFloat { AppTheme.isClaude ? 6 : 4 }
    private let agentPreviewLimit = 6

    private var sortedAgents: [NetworkQualityAgent] {
        func rank(_ status: String) -> Int {
            switch status {
            case "online": return 0
            case "upgrade_required": return 1
            case "offline": return 2
            default: return 3
            }
        }
        return model.overview.agents.sorted { lhs, rhs in
            rank(lhs.qualityStatus) < rank(rhs.qualityStatus)
        }
    }

    private var visibleAgents: [NetworkQualityAgent] {
        let all = sortedAgents
        if showAllAgents || all.count <= agentPreviewLimit {
            return all
        }
        return Array(all.prefix(agentPreviewLimit))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let err = model.errorText, !err.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(AppTheme.danger)
                    Text(L(err)).font(.system(size: 12))
                    Spacer()
                    Button(L("重试")) { Task { await model.reload() } }
                        .buttonStyle(PlainButtonStyle())
                }
                .foregroundColor(AppTheme.danger)
                .padding(12)
                .background(AppTheme.dangerSoft(dark))
                .cornerRadius(8)
            }

            agentsSection
            tasksSection
        }
        .sheet(isPresented: $model.isEditorPresented) {
            NetworkQualityTaskEditorSheet(model: model)
                .environmentObject(appearance)
        }
        .sheet(item: $model.historyContext) { ctx in
            NetworkQualityHistorySheet(context: ctx, baseURL: model.serverURL)
                .environmentObject(appearance)
        }
    }

    // MARK: - Agents Bar

    private var agentsSection: some View {
        let allAgents = sortedAgents
        let shownAgents = visibleAgents
        let hiddenCount = max(0, allAgents.count - shownAgents.count)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.info)
                Text(L("VPS 探针节点"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                Text(L("远端 VPS 独立探针状态与一键部署"))
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                StatusBadge(
                    text: "在线 \(model.onlineAgentCount) / \(model.overview.agents.count)",
                    tone: model.onlineAgentCount > 0 ? .success : .neutral
                )
                if model.upgradeRequiredCount > 0 {
                    StatusBadge(text: "待升级 \(model.upgradeRequiredCount)", tone: .warning)
                }
                Spacer(minLength: 8)
                if !allAgents.isEmpty {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            agentsCollapsed.toggle()
                        }
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: agentsCollapsed ? "chevron.down" : "chevron.up")
                                .font(.system(size: 10, weight: .semibold))
                            Text(L(agentsCollapsed ? "展开节点" : "收起节点"))
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundColor(AppTheme.textSecondary(dark))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: pillRadius).fill(AppTheme.bg3(dark).opacity(dark ? 0.6 : 0.7)))
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AppTheme.sidebarHover(dark))
            .overlay(
                Rectangle()
                    .fill(agentsCollapsed ? Color.clear : AppTheme.border(dark))
                    .frame(height: 1),
                alignment: .bottom
            )

            if !agentsCollapsed {
                VStack(alignment: .leading, spacing: 10) {
                    if model.isLoading && allAgents.isEmpty {
                        HStack {
                            Spacer()
                            ProgressView(L("加载探针状态…")).padding(.vertical, 14)
                            Spacer()
                        }
                    } else if allAgents.isEmpty {
                        EmptyStateView(
                            icon: "cpu",
                            title: "暂无可管理的 VPS 实例",
                            subtitle: "请先在实例或 VPS 监控页面同步实例"
                        )
                        .frame(maxWidth: .infinity, minHeight: 130)
                    } else {
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 270, maximum: 380), spacing: 10)],
                            spacing: 10
                        ) {
                            ForEach(shownAgents) { agent in
                                agentCard(agent)
                            }
                        }
                        if allAgents.count > agentPreviewLimit {
                            HStack {
                                Spacer()
                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.16)) {
                                        showAllAgents.toggle()
                                    }
                                }) {
                                    HStack(spacing: 5) {
                                        Image(systemName: showAllAgents ? "chevron.up" : "chevron.down")
                                            .font(.system(size: 10, weight: .semibold))
                                        Text(L(showAllAgents
                                            ? "收起至前 \(agentPreviewLimit) 台"
                                            : "展开其余 \(hiddenCount) 台节点（共 \(allAgents.count) 台）"))
                                            .font(.system(size: 11, weight: .medium))
                                    }
                                    .foregroundColor(AppTheme.textSecondary(dark))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 5)
                                    .background(RoundedRectangle(cornerRadius: pillRadius).fill(AppTheme.sidebarHover(dark)))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: pillRadius)
                                            .stroke(AppTheme.border(dark), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                                Spacer()
                            }
                            .padding(.top, 2)
                        }
                    }
                }
                .padding(14)
            }
        }
        .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark)))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private func agentCard(_ agent: NetworkQualityAgent) -> some View {
        let busy = model.busyKey == "agent-\(agent.id)"
        let ipText = agent.publicIps.isEmpty ? "无公网 IP" : agent.publicIps
        let metaText = agent.regionName.isEmpty ? ipText : "\(ipText) · \(agent.regionName)"
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(L(agent.primaryLabel))
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(AppTheme.navIcon(dark))
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(L(metaText))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(AppTheme.textSecondary(dark))
                            .lineLimit(1)
                            .truncationMode(.tail)
                        if !agent.capabilities.isEmpty {
                            Text(L(agent.capabilities.uppercased()))
                                .font(.system(size: 9.5, weight: .medium, design: .monospaced))
                                .foregroundColor(AppTheme.textTertiary(dark))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(AppTheme.bg3(dark))
                                .cornerRadius(4)
                        }
                    }
                }
                Spacer(minLength: 4)
                StatusBadge(text: agent.statusLabel, tone: agent.statusTone)
            }

            HStack(alignment: .center, spacing: 6) {
                if agent.qualityStatus == "not_installed" {
                    AppButton(
                        title: "安装探针",
                        systemImage: "arrow.down.circle",
                        kind: .primary,
                        isLoading: busy
                    ) {
                        model.installOrUpgradeAgent(agent)
                    }
                } else if agent.qualityStatus == "upgrade_required" {
                    AppButton(
                        title: "升级探针",
                        systemImage: "arrow.up.circle",
                        kind: .orange,
                        isLoading: busy
                    ) {
                        model.installOrUpgradeAgent(agent)
                    }
                } else {
                    AppButton(
                        title: "重装/升级",
                        systemImage: "arrow.clockwise",
                        kind: .secondary,
                        isLoading: busy
                    ) {
                        model.installOrUpgradeAgent(agent)
                    }
                }

                if agent.monitorInstalled || agent.qualityStatus != "not_installed" {
                    AppButton(
                        title: "卸载",
                        systemImage: "trash",
                        kind: .danger,
                        isLoading: busy
                    ) {
                        model.uninstallAgent(agent)
                    }
                }
                Spacer(minLength: 0)
                if let seen = agent.lastSeen, seen > 0 {
                    Text(L(NetworkQualityJSON.formatEpochMs(seen, short: true)))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(1)
                }
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: itemRadius).fill(AppTheme.sidebarHover(dark)))
        .overlay(
            RoundedRectangle(cornerRadius: itemRadius)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
    }

    // MARK: - Tasks & Matrix

    private var tasksSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "network")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.sidebarActive)
                Text(L("网络质量探测任务"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                Text(L("点击任意节点胶囊查看 1h / 6h / 24h / 7d 历史趋势"))
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                StatusBadge(text: "\(model.overview.tasks.count) 个任务", tone: .info)
                Spacer(minLength: 8)

                AppButton(
                    title: "新建探测任务",
                    systemImage: "plus",
                    kind: .primary
                ) {
                    model.openCreateTask()
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AppTheme.sidebarHover(dark))
            .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)

            VStack(alignment: .leading, spacing: 12) {
                if model.isLoading && model.overview.tasks.isEmpty {
                    HStack {
                        Spacer()
                        ProgressView(L("加载探测任务…")).padding(.vertical, 20)
                        Spacer()
                    }
                } else if model.overview.tasks.isEmpty {
                    EmptyStateView(
                        icon: "antenna.radiowaves.left.and.right",
                        title: "暂无探测任务",
                        subtitle: "点击「新建探测任务」配置面向电信、联通、移动或自定义目标的定期探测",
                        actionTitle: "新建探测任务",
                        action: { model.openCreateTask() }
                    )
                    .frame(maxWidth: .infinity, minHeight: 170)
                } else {
                    VStack(spacing: 10) {
                        ForEach(model.overview.tasks) { task in
                            taskCard(task)
                        }
                    }
                }
            }
            .padding(14)
        }
        .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark)))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private func taskCard(_ task: NetworkQualityTask) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(L(task.name))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(AppTheme.navIcon(dark))
                        StatusBadge(
                            text: task.type.uppercased(),
                            tone: task.type == "http" ? .info : (task.type == "tcp" ? .warning : .success)
                        )
                        StatusBadge(
                            text: NetworkQualityOperator.label(for: task.operatorType),
                            tone: .neutral
                        )
                        if !task.region.isEmpty {
                            Text(L(task.region))
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.textSecondary(dark))
                        }
                        StatusBadge(
                            text: task.enabled ? "运行中" : "已暂停",
                            tone: task.enabled ? .success : .neutral
                        )
                    }

                    HStack(spacing: 10) {
                        Text(L(task.target))
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundColor(AppTheme.textSecondary(dark))
                        Text(L("每 \(task.intervalSeconds)s · 采样 \(task.sampleCount) 次 · 节点 \(task.instanceIds.count) 台"))
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                }

                Spacer(minLength: 8)

                HStack(spacing: 6) {
                    AppButton(
                        title: "立即探测",
                        systemImage: "play.fill",
                        kind: .info,
                        isLoading: model.busyKey == "run-\(task.id)"
                    ) {
                        model.runTaskNow(task)
                    }
                    AppButton(
                        title: task.enabled ? "暂停" : "启用",
                        systemImage: task.enabled ? "pause.fill" : "checkmark",
                        kind: .secondary,
                        isLoading: model.busyKey == "toggle-\(task.id)"
                    ) {
                        model.toggleTaskEnabled(task)
                    }
                    AppButton(
                        title: "编辑",
                        systemImage: "pencil",
                        kind: .secondary
                    ) {
                        model.openEditTask(task)
                    }
                    AppButton(
                        title: "删除",
                        systemImage: "trash",
                        kind: .danger,
                        isLoading: model.busyKey == "delete-\(task.id)"
                    ) {
                        model.deleteTask(task)
                    }
                }
            }

            // Per-VPS latest sample pills
            if !task.instanceIds.isEmpty {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 210, maximum: 320), spacing: 8)],
                    spacing: 8
                ) {
                    ForEach(task.instanceIds, id: \.self) { instId in
                        let agent = model.overview.agent(forInstanceId: instId)
                        let sample = model.overview.latestSample(instanceId: instId, taskId: task.id)
                        sampleMatrixPill(
                            agent: agent ?? NetworkQualityAgent(
                                id: instId,
                                instanceId: instId,
                                displayName: "实例 #\(instId)",
                                publicIps: "",
                                tenancyName: "",
                                regionName: "",
                                cloudType: 1,
                                monitorInstalled: false,
                                qualityStatus: "not_installed",
                                lastSeen: nil,
                                version: "",
                                capabilities: ""
                            ),
                            task: task,
                            sample: sample
                        )
                    }
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: itemRadius).fill(AppTheme.sidebarHover(dark)))
        .overlay(
            RoundedRectangle(cornerRadius: itemRadius)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
    }

    private func sampleMatrixPill(
        agent: NetworkQualityAgent,
        task: NetworkQualityTask,
        sample: NetworkQualitySample?
    ) -> some View {
        let tone: StatusTone = sample?.statusTone ?? .neutral
        return Button(action: {
            model.openHistory(agent: agent, task: task)
        }) {
            HStack(spacing: 8) {
                Circle()
                    .fill(tone.color(dark: dark))
                    .frame(width: 7, height: 7)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L(agent.primaryLabel))
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundColor(AppTheme.navIcon(dark))
                        .lineLimit(1)
                    Text(L(sample == nil ? "等待首次采样" : NetworkQualityJSON.formatEpochMs(sample?.updatedAt, short: true)))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Text(L(sample?.compactMetricText ?? "—"))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(tone.color(dark: dark))
                    .lineLimit(1)
                Image(systemName: "chart.xyaxis.line")
                    .font(.system(size: 10))
                    .foregroundColor(AppTheme.textTertiary(dark))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: pillRadius).fill(AppTheme.sidebarBg(dark)))
            .overlay(
                RoundedRectangle(cornerRadius: pillRadius)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .help(L("点击查看「\(agent.primaryLabel) → \(task.name)」历史延迟与丢包趋势"))
    }
}

// MARK: - Task Editor Sheet

struct NetworkQualityTaskEditorSheet: View {
    @ObservedObject var model: NetworkQualityViewModel
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme

    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }
    private var controlRadius: CGFloat { AppTheme.isClaude ? 8 : 5 }
    private var segmentRadius: CGFloat { AppTheme.isClaude ? 6 : 4 }

    var body: some View {
        AppSheetChrome(
            title: model.draft.isEditing ? "编辑探测任务" : "新建探测任务",
            subtitle: "目标仅由远端已认证探针执行，服务端不直接发起探测",
            systemImage: model.draft.isEditing ? "pencil.circle.fill" : "plus.circle.fill",
            iconColor: AppTheme.sidebarActive,
            width: 640,
            height: 560,
            onClose: { model.isEditorPresented = false },
            footer: {
                AppButton(title: "取消", kind: .secondary) {
                    model.isEditorPresented = false
                }
                AppButton(
                    title: model.draft.isEditing ? "保存修改" : "创建任务",
                    systemImage: "checkmark",
                    kind: .primary,
                    isLoading: model.busyKey == "saveTask"
                ) {
                    model.saveDraft()
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        FormFieldRow(label: "任务名称 *") {
                            AppTextField(text: $model.draft.name, placeholder: "例如：电信广州测速")
                        }
                        FormFieldRow(label: "区域备注") {
                            AppTextField(text: $model.draft.region, placeholder: "例如：广东广州 / 东京")
                        }
                    }

                    HStack(spacing: 12) {
                        FormFieldRow(label: "运营商") {
                            HStack(spacing: 4) {
                                ForEach(NetworkQualityOperator.allCases) { op in
                                    let active = model.draft.operatorType == op
                                    Button(action: { model.draft.operatorType = op }) {
                                        Text(L(op.label))
                                            .font(.system(size: 11.5, weight: active ? .semibold : .medium))
                                            .foregroundColor(active ? appearance.accent.accentFg(dark) : AppSheetSurface.mutedText(dark))
                                            .padding(.horizontal, 9)
                                            .padding(.vertical, 6)
                                            .background(
                                                RoundedRectangle(cornerRadius: segmentRadius)
                                                    .fill(active ? AppTheme.sidebarActive : AppSheetSurface.panelBg(dark))
                                            )
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                        }

                        FormFieldRow(label: "探测协议") {
                            HStack(spacing: 4) {
                                ForEach(NetworkQualityProbeType.allCases) { pt in
                                    let active = model.draft.type == pt
                                    Button(action: { model.draft.type = pt }) {
                                        Text(L(pt.label))
                                            .font(.system(size: 11.5, weight: active ? .semibold : .medium))
                                            .foregroundColor(active ? appearance.accent.accentFg(dark) : AppSheetSurface.mutedText(dark))
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(
                                                RoundedRectangle(cornerRadius: segmentRadius)
                                                    .fill(active ? AppTheme.sidebarActive : AppSheetSurface.panelBg(dark))
                                            )
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                        }
                    }

                    FormFieldRow(label: "探测目标 *") {
                        AppTextField(
                            text: $model.draft.target,
                            placeholder: model.draft.type.targetPlaceholder,
                            leadingSystemImage: "scope"
                        )
                    }

                    HStack(spacing: 12) {
                        FormFieldRow(label: "探测间隔（秒，30~86400）") {
                            AppTextField(text: $model.draft.intervalSeconds, placeholder: "60")
                        }
                        FormFieldRow(label: "单次采样次数（1~10）") {
                            AppTextField(text: $model.draft.sampleCount, placeholder: "3")
                        }
                        FormFieldRow(label: "启用状态") {
                            HStack {
                                Toggle(L(model.draft.enabled ? "已启用" : "已暂停"), isOn: $model.draft.enabled)
                                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
                                Spacer()
                            }
                            .padding(.top, 4)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(L("执行探测的 VPS 节点 *（已选 \(model.draft.instanceIds.count) 台）"))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(AppSheetSurface.mutedText(dark))
                            Spacer()
                            Button(L("全选在线")) {
                                model.draft.instanceIds = Set(model.overview.agents.filter { $0.qualityStatus == "online" }.map(\.id))
                            }
                            .buttonStyle(PlainButtonStyle())
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.info)

                            Button(L("全选全部")) {
                                model.draft.instanceIds = Set(model.overview.agents.map(\.id))
                            }
                            .buttonStyle(PlainButtonStyle())
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.sidebarActive)

                            Button(L("清空")) {
                                model.draft.instanceIds = []
                            }
                            .buttonStyle(PlainButtonStyle())
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppSheetSurface.mutedText(dark))
                        }

                        if model.overview.agents.isEmpty {
                            Text(L("暂无可选 VPS 节点"))
                                .font(.system(size: 12))
                                .foregroundColor(AppSheetSurface.mutedText(dark))
                                .padding(10)
                        } else {
                            VStack(spacing: 4) {
                                ForEach(model.overview.agents) { agent in
                                    let checked = model.draft.instanceIds.contains(agent.id)
                                    Button(action: {
                                        if checked {
                                            model.draft.instanceIds.remove(agent.id)
                                        } else {
                                            model.draft.instanceIds.insert(agent.id)
                                        }
                                    }) {
                                        HStack(spacing: 8) {
                                            Image(systemName: checked ? "checkmark.square.fill" : "square")
                                                .font(.system(size: 13))
                                                .foregroundColor(checked ? AppTheme.sidebarActive : AppSheetSurface.mutedText(dark))
                                            Text(L(agent.primaryLabel))
                                                .font(.system(size: 12, weight: .medium))
                                                .foregroundColor(AppSheetSurface.primaryText(dark))
                                            Text(L(agent.publicIps))
                                                .font(.system(size: 11, design: .monospaced))
                                                .foregroundColor(AppSheetSurface.mutedText(dark))
                                            Spacer()
                                            StatusBadge(text: agent.statusLabel, tone: agent.statusTone)
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(
                                            RoundedRectangle(cornerRadius: segmentRadius)
                                                .fill(checked ? appearance.accent.accentSoft(dark) : Color.clear)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: segmentRadius)
                                                .stroke(checked ? AppTheme.sidebarActive.opacity(0.45) : Color.clear, lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: controlRadius).fill(AppSheetSurface.surface2(dark)))
                            .overlay(
                                RoundedRectangle(cornerRadius: controlRadius)
                                    .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                            )
                        }
                    }
                }
            }
        )
    }
}

// MARK: - Reusable History Sheet (1h / 6h / 24h / 7d + Line Chart + Table)

struct NetworkQualityHistorySheet: View {
    let context: NetworkQualityHistoryContext
    let baseURL: String

    @Environment(\.presentationMode) private var presentationMode
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme

    @State private var selectedWindow: NetworkQualityWindow = .hour24
    @State private var history = NetworkQualityHistory()
    @State private var isLoading = false
    @State private var errorText: String?

    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }
    private var controlRadius: CGFloat { AppTheme.isClaude ? 8 : 5 }
    private var segmentRadius: CGFloat { AppTheme.isClaude ? 6 : 4 }

    var body: some View {
        AppSheetChrome(
            title: "\(context.instanceName) → \(context.taskName)",
            subtitle: "\(context.type.uppercased()) · \(context.target)" + (context.region.isEmpty ? "" : " · \(context.region)"),
            systemImage: "chart.xyaxis.line",
            iconColor: AppTheme.sidebarActive,
            width: 760,
            height: 600,
            footer: {
                AppButton(
                    title: "刷新",
                    systemImage: "arrow.clockwise",
                    kind: .secondary,
                    isLoading: isLoading
                ) {
                    loadHistory()
                }
                AppButton(title: "关闭", kind: .secondary) {
                    presentationMode.wrappedValue.dismiss()
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            ForEach(NetworkQualityWindow.allCases) { w in
                                let active = selectedWindow == w
                                Button(action: {
                                    selectedWindow = w
                                    loadHistory()
                                }) {
                                    Text(L(w.label))
                                        .font(.system(size: 11.5, weight: active ? .semibold : .medium))
                                        .foregroundColor(active ? appearance.accent.accentFg(dark) : AppSheetSurface.mutedText(dark))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(
                                            RoundedRectangle(cornerRadius: segmentRadius)
                                                .fill(active ? AppTheme.sidebarActive : Color.clear)
                                        )
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(3)
                        .background(RoundedRectangle(cornerRadius: controlRadius).fill(AppSheetSurface.surface2(dark)))
                        .overlay(
                            RoundedRectangle(cornerRadius: controlRadius)
                                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                        )

                        Spacer()
                        StatusBadge(text: context.type.uppercased(), tone: .info)
                        StatusBadge(text: NetworkQualityOperator.label(for: context.operatorType), tone: .neutral)
                    }

                    if let err = errorText, !err.isEmpty {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(L(err)).font(.system(size: 12))
                            Spacer()
                        }
                        .foregroundColor(AppTheme.danger)
                        .padding(10)
                        .background(AppTheme.dangerSoft(dark))
                        .cornerRadius(controlRadius)
                    }

                    // KPI cards
                    HStack(spacing: 10) {
                        kpiCard("平均延迟", NetworkQualityJSON.formatMs(history.stats.avgMs), AppTheme.sidebarActive)
                        kpiCard(
                            "最小 / 最大",
                            "\(NetworkQualityJSON.formatMs(history.stats.minMs)) / \(NetworkQualityJSON.formatMs(history.stats.maxMs))",
                            AppTheme.info
                        )
                        kpiCard(
                            "丢包率",
                            NetworkQualityJSON.formatLoss(history.stats.lossPercent),
                            (history.stats.lossPercent ?? 0) > 5 ? AppTheme.danger : AppTheme.success
                        )
                        kpiCard(
                            "采样次数",
                            "\(history.stats.count)（成功 \(history.stats.successCount)）",
                            AppSheetSurface.primaryText(dark)
                        )
                    }

                    // Trend Chart
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(L("延迟趋势（ms）"))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(AppSheetSurface.primaryText(dark))
                            Spacer()
                            if history.truncated {
                                Text(L("仅展示最近 \(history.points.count) / \(history.totalPoints) 条"))
                                    .font(.system(size: 10.5))
                                    .foregroundColor(AppSheetSurface.mutedText(dark))
                            }
                        }

                        NetworkQualityLatencyChart(points: history.points, dark: dark)
                            .frame(height: 170)
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 8).fill(AppSheetSurface.surface2(dark)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                    )

                    // Recent Samples Table
                    VStack(alignment: .leading, spacing: 6) {
                        Text(L("采样明细（最新在前）"))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppSheetSurface.primaryText(dark))

                        if history.points.isEmpty {
                            Text(L(isLoading ? "加载中…" : "当前时间窗口内暂无采样记录"))
                                .font(.system(size: 12))
                                .foregroundColor(AppSheetSurface.mutedText(dark))
                                .padding(.vertical, 16)
                                .frame(maxWidth: .infinity)
                        } else {
                            VStack(spacing: 0) {
                                HStack(spacing: 8) {
                                    Text(L("时间")).frame(width: 120, alignment: .leading)
                                    Text(L("状态")).frame(width: 72, alignment: .leading)
                                    Text(L("平均延迟")).frame(width: 82, alignment: .trailing)
                                    Text(L("最小 / 最大")).frame(width: 118, alignment: .trailing)
                                    Text(L("成功/尝试")).frame(width: 68, alignment: .trailing)
                                    Text(L("详情")).frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundColor(AppSheetSurface.mutedText(dark))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(AppSheetSurface.panelBg(dark))

                                ForEach(Array(history.points.reversed().prefix(80).enumerated()), id: \.element.id) { idx, point in
                                    Rectangle().fill(AppSheetSurface.border(dark)).frame(height: 1)
                                    HStack(spacing: 8) {
                                        Text(L(NetworkQualityJSON.formatEpochMs(point.updatedAt)))
                                            .font(.system(size: 11, design: .monospaced))
                                            .foregroundColor(AppSheetSurface.mutedText(dark))
                                            .frame(width: 120, alignment: .leading)
                                        StatusBadge(text: point.statusLabel, tone: point.statusTone)
                                            .frame(width: 72, alignment: .leading)
                                        Text(L(NetworkQualityJSON.formatMs(point.avgMs)))
                                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                            .foregroundColor(AppSheetSurface.primaryText(dark))
                                            .frame(width: 82, alignment: .trailing)
                                        Text(L("\(NetworkQualityJSON.formatMs(point.minMs)) / \(NetworkQualityJSON.formatMs(point.maxMs))"))
                                            .font(.system(size: 10.5, design: .monospaced))
                                            .foregroundColor(AppSheetSurface.mutedText(dark))
                                            .frame(width: 118, alignment: .trailing)
                                        Text(L("\(point.successful)/\(point.attempts)"))
                                            .font(.system(size: 11, design: .monospaced))
                                            .foregroundColor(AppSheetSurface.mutedText(dark))
                                            .frame(width: 68, alignment: .trailing)
                                        Text(L(sampleDetailText(point)))
                                            .font(.system(size: 11))
                                            .foregroundColor(AppSheetSurface.mutedText(dark))
                                            .lineLimit(1)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, max(6, appearance.density.rowPadding - 2))
                                    .background(idx % 2 == 1 ? AppSheetSurface.surface2(dark).opacity(0.6) : Color.clear)
                                }
                            }
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                            )
                        }
                    }
                }
            }
        )
        .onAppear { loadHistory() }
    }

    private func kpiCard(_ title: String, _ value: String, _ accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(L(title))
                .font(.system(size: 10.5, weight: .medium))
                .foregroundColor(AppSheetSurface.mutedText(dark))
            Text(L(value))
                .font(.system(size: 13.5, weight: .bold, design: .monospaced))
                .foregroundColor(accent)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 8).fill(AppSheetSurface.surface2(dark)))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
    }

    private func sampleDetailText(_ sample: NetworkQualitySample) -> String {
        if let http = sample.httpStatus {
            return sample.errorMessage.isEmpty ? "HTTP \(http)" : "HTTP \(http) · \(sample.errorMessage)"
        }
        return sample.errorMessage.isEmpty ? "—" : sample.errorMessage
    }

    private func loadHistory() {
        Task { @MainActor in
            isLoading = true
            errorText = nil
            defer { isLoading = false }
            do {
                let svc = NetworkQualityService(baseURL: baseURL)
                history = try await svc.fetchHistory(
                    instanceId: context.instanceId,
                    taskId: context.taskId,
                    revision: context.revision,
                    hours: selectedWindow.rawValue
                )
            } catch {
                errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}

// MARK: - macOS 11+ SwiftUI Path Latency Trend Chart

private struct NetworkQualityLatencyChart: View {
    @ObservedObject private var i18n = AppI18n.shared
    let points: [NetworkQualitySample]
    let dark: Bool

    private var validPoints: [(index: Int, value: Double, sample: NetworkQualitySample)] {
        points.enumerated().compactMap { idx, item in
            guard let avg = item.avgMs else { return nil }
            return (idx, avg, item)
        }
    }

    var body: some View {
        if validPoints.isEmpty {
            VStack(spacing: 6) {
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 18))
                    .foregroundColor(AppTheme.textTertiary(dark))
                Text(L("暂无有效延迟数据点"))
                    .font(.system(size: 11.5))
                    .foregroundColor(AppTheme.textTertiary(dark))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            let minVal = max(0, (validPoints.map(\.value).min() ?? 0) * 0.9)
            let rawMax = validPoints.map(\.value).max() ?? 10
            let maxVal = max(rawMax * 1.1, minVal + 5)
            let span = max(1, maxVal - minVal)
            let totalCount = max(1, points.count - 1)

            GeometryReader { geo in
                let padLeft: CGFloat = 46
                let padRight: CGFloat = 12
                let padTop: CGFloat = 10
                let padBottom: CGFloat = 22
                let width = max(1, geo.size.width - padLeft - padRight)
                let height = max(1, geo.size.height - padTop - padBottom)

                ZStack(alignment: .topLeading) {
                    // Horizontal grid lines + Y labels
                    ForEach(0..<4, id: \.self) { step in
                        let ratio = CGFloat(step) / 3.0
                        let y = padTop + height * ratio
                        let val = maxVal - span * Double(ratio)
                        Path { path in
                            path.move(to: CGPoint(x: padLeft, y: y))
                            path.addLine(to: CGPoint(x: padLeft + width, y: y))
                        }
                        .stroke(AppTheme.border(dark).opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))

                        Text(L(String(format: "%.0f", val)))
                            .font(.system(size: 9.5, design: .monospaced))
                            .foregroundColor(AppTheme.textTertiary(dark))
                            .frame(width: padLeft - 6, alignment: .trailing)
                            .position(x: (padLeft - 6) / 2, y: y)
                    }

                    // Area fill
                    if validPoints.count >= 2 {
                        Path { path in
                            for (offset, pt) in validPoints.enumerated() {
                                let x = padLeft + width * CGFloat(pt.index) / CGFloat(totalCount)
                                let y = padTop + height * CGFloat(1.0 - (pt.value - minVal) / span)
                                if offset == 0 {
                                    path.move(to: CGPoint(x: x, y: padTop + height))
                                    path.addLine(to: CGPoint(x: x, y: y))
                                } else {
                                    path.addLine(to: CGPoint(x: x, y: y))
                                }
                            }
                            if let last = validPoints.last {
                                let lastX = padLeft + width * CGFloat(last.index) / CGFloat(totalCount)
                                path.addLine(to: CGPoint(x: lastX, y: padTop + height))
                            }
                            path.closeSubpath()
                        }
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    AppTheme.sidebarActive.opacity(dark ? 0.28 : 0.22),
                                    AppTheme.sidebarActive.opacity(0.02)
                                ]),
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    }

                    // Trend line
                    Path { path in
                        for (offset, pt) in validPoints.enumerated() {
                            let x = padLeft + width * CGFloat(pt.index) / CGFloat(totalCount)
                            let y = padTop + height * CGFloat(1.0 - (pt.value - minVal) / span)
                            if offset == 0 {
                                path.move(to: CGPoint(x: x, y: y))
                            } else {
                                path.addLine(to: CGPoint(x: x, y: y))
                            }
                        }
                    }
                    .stroke(AppTheme.sidebarActive, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

                    // Data dots (downsampled if many)
                    let strideStep = max(1, validPoints.count / 40)
                    ForEach(Array(validPoints.enumerated()), id: \.offset) { offset, pt in
                        if offset % strideStep == 0 || offset == validPoints.count - 1 {
                            let x = padLeft + width * CGFloat(pt.index) / CGFloat(totalCount)
                            let y = padTop + height * CGFloat(1.0 - (pt.value - minVal) / span)
                            Circle()
                                .fill(pt.sample.status == "partial" ? AppTheme.orange : AppTheme.sidebarActive)
                                .frame(width: 5, height: 5)
                                .position(x: x, y: y)
                        }
                    }

                    // X-axis start & end timestamps
                    if let first = points.first, let last = points.last {
                        HStack {
                            Text(L(NetworkQualityJSON.formatEpochMs(first.updatedAt, short: true)))
                            Spacer()
                            Text(L(NetworkQualityJSON.formatEpochMs(last.updatedAt, short: true)))
                        }
                        .font(.system(size: 9.5, design: .monospaced))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .frame(width: width)
                        .position(x: padLeft + width / 2, y: padTop + height + 12)
                    }
                }
            }
        }
    }
}
