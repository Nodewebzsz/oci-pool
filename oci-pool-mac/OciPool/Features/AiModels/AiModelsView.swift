import SwiftUI

/// 原生 OCI AI 管理（对齐 Web `/system/ai/models`）。
struct AiModelsView: View {
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = AiModelsViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    /// Web 4 KPI：可用模型(info cpu)/已配置(accent check-circle)/已启用(violet zap)/主区域(cyan globe)
    private var kpiGrid: some View {
        let enabledCount = model.configs.filter(\.enabled).count
        let region = model.configs.first(where: { !$0.region.isEmpty })?.region ?? "—"
        return HStack(alignment: .top, spacing: 12) {
            kpiCard(icon: "cpu", color: AppTheme.info, label: "可用模型", value: "\(model.models.count)")
            kpiCard(icon: "checkmark.circle", color: AppTheme.sidebarActive, label: "已配置", value: "\(model.configs.count)")
            kpiCard(icon: "zap.fill", color: Color(hex: "b484e8"), label: "已启用", value: "\(enabledCount)")
            kpiCard(icon: "globe", color: Color(hex: "00b6be"), label: "主区域", value: region)
        }
    }

    private func kpiCard(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// Web 分类徽章：embed→向量(violet)、vision→视觉(cyan)、其余→对话(info)
    private func categoryBadge(_ name: String) -> some View {
        let n = name.lowercased()
        let (label, color): (String, Color) = {
            if n.contains("embed") { return ("向量", Color(hex: "b484e8")) }
            if n.contains("vision") || n.contains("图像") { return ("视觉", Color(hex: "00b6be")) }
            return ("对话", AppTheme.info)
        }()
        return Text(label)
            .font(.system(size: 10, weight: .semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(RoundedRectangle(cornerRadius: 3).fill(color.opacity(0.14)))
            .foregroundColor(color)
    }

    var body: some View {
        PageScaffold(
            title: "OCI AI 管理",
            subtitle: "OCI Generative AI · 模型配置与对话管理",
            systemImage: "sparkles",
            iconColor: Color(hex: "b484e8"),
            toolbar: {
                HStack(spacing: 8) {
                    // 批量操作为页面级动作（后端 batchToggleTelegramAiConfigs 作用于全库配置），一手位直达
                    AppButton(title: "全部启用", kind: .secondary) { model.batchEnable(true) }
                    AppButton(title: "全部禁用", kind: .secondary) { model.batchEnable(false) }
                    AppButton(
                        title: "刷新",
                        systemImage: "arrow.clockwise",
                        kind: .secondary,
                        isLoading: model.isLoadingConfigs || model.isLoadingModels
                    ) { model.reload() }
                    // AI 对话快捷入口（跳转全屏对话工作台并预选租户）
                    AppButton(title: "AI 对话", systemImage: "message.square", kind: .secondary) {
                        if let tid = Int64(model.selectedTenantId) {
                            NavigationState.shared.openAiChat(tenantId: tid)
                        } else {
                            NavigationState.shared.select(.aiChat)
                        }
                    }
                }
            },
            content: {
                VStack(spacing: 0) {
                    if !model.selectedTenantId.isEmpty {
                        kpiGrid
                            .padding(.bottom, 12)
                    }
                    filterBar
                        .padding(.bottom, 12)
                    if let err = model.errorText, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.danger)
                            .padding(.bottom, 12)
                    }
                    HStack(alignment: .top, spacing: 12) {
                        availablePanel
                        configuredPanel
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .appLoading(model.isBusy)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            model.reload()
        }
    }

    private var filterBar: some View {
        HStack(spacing: 12) {
            Text("租户")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.sidebarText(dark))
            SelectMenu(
                // 对齐实例列表租户下拉：真实租户名 · 中文区域（如 flashzyxjay · 春川）
                options: model.tenants.map { SelectOption(id: $0.id, title: $0.safeTitle) },
                selection: Binding(
                    get: { model.selectedTenantId.isEmpty ? nil : model.selectedTenantId },
                    set: { model.onTenantChanged($0) }
                ),
                placeholder: model.isLoadingTenants ? "加载中…" : "请选择租户",
                width: 280,
                allowClear: true,
                searchable: model.tenants.count > 5
            )
            Spacer()
            Toggle(isOn: $model.linkTenantFilter) {
                Text("仅显示当前租户配置")
                    .font(.system(size: 12))
            }
            .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private var availablePanel: some View {
        panelCard(title: "可用 AI 模型", icon: "cpu") {
            if model.selectedTenantId.isEmpty {
                EmptyStateView(icon: "hand.point.up", title: "请先选择租户", subtitle: "选择支持 AI 的租户后查看模型")
                    .frame(maxHeight: .infinity)
            } else if model.isLoadingModels && model.models.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.models.isEmpty {
                EmptyStateView(icon: "sparkles", title: "暂无可用模型", subtitle: "该租户下没有可列出的模型")
                    .frame(maxHeight: .infinity)
            } else {
                // 对齐原项目：全量滚动列表，一屏纵览全部模型（无分页）
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(model.models) { m in
                            modelRow(m)
                        }
                    }
                    .padding(12)
                }
            }
        }
    }

    private var configuredPanel: some View {
        panelCard(title: "已配置的模型", icon: "gearshape") {
            if model.isLoadingConfigs && model.configs.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.visibleConfigs.isEmpty {
                EmptyStateView(icon: "tray", title: "暂无已配置的模型", subtitle: "从左侧模型列表点击「添加」")
                    .frame(maxHeight: .infinity)
            } else {
                // 对齐原项目：全量滚动列表（无分页）
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(model.visibleConfigs) { c in
                            configRow(c)
                        }
                    }
                    .padding(12)
                }
            }
        }
    }

    private func modelRow(_ m: AiAvailableModel) -> some View {
        let added = model.configuredModelIds.contains(m.id)
        return HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(m.name.isEmpty ? m.id : m.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                        .lineLimit(1)
                    categoryBadge(m.name)
                }
                Text(m.provider.isEmpty ? "OCI" : m.provider)
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
            Spacer(minLength: 0)
            if added {
                Text("已添加")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.sidebarActive)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(RoundedRectangle(cornerRadius: 6).fill(AppTheme.sidebarActive.opacity(0.14)))
            } else {
                AppButton(title: "添加", kind: .primary) { model.addModel(m) }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.sidebarBg(dark)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1))
    }

    /// 配置行归属租户显示（对齐租户下拉）：解析为 "租户名 · 中文区域"，找不到则回落原始 ID
    private func configTenantLabel(_ tenantId: String) -> String {
        if let t = model.tenants.first(where: { $0.id == tenantId }) {
            return t.dropdownLabel
        }
        return tenantId.isEmpty ? "—" : "租户 \(tenantId)"
    }

    private func configRow(_ c: AiConfigItem) -> some View {
        HStack(spacing: 10) {
            // Web：左侧 3px accent/灰 边条
            RoundedRectangle(cornerRadius: 2)
                .fill(c.enabled ? AppTheme.sidebarActive : AppTheme.sidebarText(dark).opacity(0.4))
                .frame(width: 3, height: 44)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(c.modelName.isEmpty ? c.modelId : c.modelName)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                    // Web 徽章：已启用=accent-soft / 已禁用=bg-3
                    Text(c.enabled ? "已启用" : "已禁用")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 3).fill(
                            c.enabled ? AppTheme.sidebarActive.opacity(0.14) : AppTheme.sidebarHover(dark)))
                        .foregroundColor(c.enabled ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
                }
                // 归属租户（对齐租户下拉显示：租户名 · 中文区域），多租户混排时辨明归属
                Text(configTenantLabel(c.tenantId))
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            // Web：enabled 态「禁用」用 orange
            AppButton(title: c.enabled ? "禁用" : "启用",
                      kind: c.enabled ? .orange : .primary) { model.toggle(c) }
            // 对齐原项目：红色文字「删除」按钮（语义明确，配合删除前确认弹窗）
            AppButton(title: "删除", kind: .danger) { model.delete(c) }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.sidebarBg(dark)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1))
        .opacity(c.enabled ? 1 : 0.6)
    }

    private func panelCard<Content: View>(title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(AppTheme.sidebarActive)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(AppTheme.sidebarHover(dark).opacity(0.55))
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark)))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1))
    }
}
