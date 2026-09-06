import SwiftUI

/// 原生 OCI AI 管理（对齐 Web `/system/ai/models`）。
struct AiModelsView: View {
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = AiModelsViewModel()

    private var dark: Bool { appearance.isDarkEffective }
    @State private var availablePage = 0
    @State private var configuredPage = 0
    private let panelPageSize = 4

    /// Web 4 KPI：可用模型(info cpu)/已配置(accent check-circle)/已启用(violet zap)/主区域(cyan globe)
    private var kpiGrid: some View {
        let enabledCount = model.configs.filter(\.enabled).count
        let region = model.configs.first(where: { !$0.region.isEmpty })?.region ?? "—"
        return HStack(spacing: 14) {
            kpiCard(icon: "cpu", color: AppTheme.info, label: "可用模型", value: "\(model.models.count)")
            kpiCard(icon: "checkmark.circle", color: AppTheme.sidebarActive, label: "已配置", value: "\(model.configs.count)")
            kpiCard(icon: "zap.fill", color: Color(hex: "b484e8"), label: "已启用", value: "\(enabledCount)")
            kpiCard(icon: "globe", color: Color(hex: "00b6be"), label: "主区域", value: region)
        }
    }

    private func kpiCard(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(color)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.system(size: 11)).foregroundColor(AppTheme.sidebarText(dark))
                Text(value).font(.system(size: 20, weight: .bold)).foregroundColor(dark ? Color.white.opacity(0.92) : Color.primary).lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarBg(dark)))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
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

    /// Web provider 色块：Cohere=cyan / Meta=info / Anthropic=orange
    private func providerBadge(_ provider: String) -> some View {
        let p = provider.lowercased()
        let color: Color = p.contains("cohere") ? Color(hex: "00b6be")
            : p.contains("meta") ? AppTheme.info
            : p.contains("anthropic") ? AppTheme.orange
            : AppTheme.sidebarText(dark)
        return Circle().fill(color).frame(width: 8, height: 8)
    }

    var body: some View {
        PageScaffold(
            title: "OCI AI 管理",
            subtitle: "OCI Generative AI · 模型配置与对话管理",
            systemImage: "sparkles",
            toolbar: {
                HStack(spacing: 8) {
                    SelectMenu(
                        options: model.tenants.map { SelectOption(id: $0.id, title: $0.name) },
                        selection: Binding(
                            get: { model.selectedTenantId.isEmpty ? nil : model.selectedTenantId },
                            set: { model.onTenantChanged($0) }
                        ),
                        placeholder: "-- 请选择租户 --",
                        width: 240,
                        allowClear: true,
                        searchable: true
                    )
                    // Web：AI 对话紫色按钮（跳转 AI 对话页并预选租户）
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
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                    filterBar
                    if let err = model.errorText, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.danger)
                            .padding(.horizontal, 16)
                            .padding(.top, 8)
                    }
                    HStack(alignment: .top, spacing: 14) {
                        availablePanel
                        configuredPanel
                    }
                    .padding(16)
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
        FilterBar(
            leading: {
                HStack(spacing: 10) {
                    Text("租户")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.sidebarText(dark))
                    SelectMenu(
                        options: model.tenants.map { SelectOption(id: $0.id, title: $0.name) },
                        selection: Binding(
                            get: { model.selectedTenantId.isEmpty ? nil : model.selectedTenantId },
                            set: { model.onTenantChanged($0) }
                        ),
                        placeholder: model.isLoadingTenants ? "加载中…" : "选择支持 AI 的租户…",
                        width: 280,
                        allowClear: true,
                        searchable: true
                    )
                }
            },
            trailing: {
                Toggle(isOn: $model.linkTenantFilter) {
                    Text("关联租户")
                        .font(.system(size: 12))
                }
                .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
            }
        )
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
                let pageModels = Array(model.models.dropFirst(availablePage * panelPageSize).prefix(panelPageSize))
                let totalPages = max(1, Int(ceil(Double(model.models.count) / Double(panelPageSize))))
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(pageModels) { m in
                            modelRow(m)
                        }
                    }
                    .padding(12)
                }
                HStack(spacing: 8) {
                    Spacer()
                    Button(action: { if availablePage > 0 { availablePage -= 1 } }) {
                        Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(availablePage == 0)
                    .opacity(availablePage == 0 ? 0.35 : 1)
                    Text("\(availablePage + 1) / \(totalPages)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(AppTheme.sidebarText(dark))
                    Button(action: { if availablePage < totalPages - 1 { availablePage += 1 } }) {
                        Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(availablePage >= totalPages - 1)
                    .opacity(availablePage >= totalPages - 1 ? 0.35 : 1)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
        }
    }

    private var configuredPanel: some View {
        panelCard(title: "已配置的模型", icon: "gearshape") {
            if model.isLoadingConfigs && model.configs.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.visibleConfigs.isEmpty {
                EmptyStateView(icon: "tray", title: "暂无已配置的模型", subtitle: "从左侧模型列表点击「添加配置」")
                    .frame(maxHeight: .infinity)
            } else {
                let pageConfigs = Array(model.visibleConfigs.dropFirst(configuredPage * panelPageSize).prefix(panelPageSize))
                let totalPages = max(1, Int(ceil(Double(model.visibleConfigs.count) / Double(panelPageSize))))
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(pageConfigs) { c in
                            configRow(c)
                        }
                    }
                    .padding(12)
                }
                HStack(spacing: 8) {
                    AppButton(title: "启用全部", kind: .secondary) { model.batchEnable(true) }
                    AppButton(title: "禁用全部", kind: .secondary) { model.batchEnable(false) }
                    Spacer()
                    Button(action: { model.reload() }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.navIcon(dark))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .help("刷新")
                    Button(action: { if configuredPage > 0 { configuredPage -= 1 } }) {
                        Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(configuredPage == 0)
                    .opacity(configuredPage == 0 ? 0.35 : 1)
                    Text("\(configuredPage + 1) / \(totalPages)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(AppTheme.sidebarText(dark))
                    Button(action: { if configuredPage < totalPages - 1 { configuredPage += 1 } }) {
                        Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(configuredPage >= totalPages - 1)
                    .opacity(configuredPage >= totalPages - 1 ? 0.35 : 1)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
        }
    }

    private func modelRow(_ m: AiAvailableModel) -> some View {
        let added = model.configuredModelIds.contains(m.id)
        return HStack(alignment: .top, spacing: 10) {
            providerBadge(m.provider)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(m.name.isEmpty ? m.id : m.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                        .lineLimit(1)
                    categoryBadge(m.name)
                }
                Text(m.id)
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(1)
                if !m.description.isEmpty {
                    Text(m.description)
                        .font(.system(size: 10.5))
                        .foregroundColor(AppTheme.sidebarText(dark).opacity(0.8))
                        .lineLimit(2)
                }
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
                AppButton(title: "添加配置", kind: .primary) { model.addModel(m) }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.sidebarBg(dark)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1))
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
                Text("\(c.modelId) · \(c.provider.isEmpty ? "OCI" : c.provider)")
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(1)
                if !c.region.isEmpty {
                    Text("区域 \(c.region)")
                        .font(.system(size: 10.5))
                        .foregroundColor(AppTheme.sidebarText(dark).opacity(0.8))
                }
            }
            Spacer(minLength: 0)
            // Web：enabled 态「禁用」用 orange
            AppButton(title: c.enabled ? "禁用" : "启用",
                      kind: c.enabled ? .orange : .primary) { model.toggle(c) }
            Button(action: { model.delete(c) }) {
                Image(systemName: "trash")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .frame(width: 28, height: 28)
                    .background(RoundedRectangle(cornerRadius: 5).fill(AppTheme.sidebarHover(dark)))
            }
            .buttonStyle(PlainButtonStyle())
            .help("删除")
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
