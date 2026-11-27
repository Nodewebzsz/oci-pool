import SwiftUI

/// 原生 Token 配置（对齐 Web `/system/apiTokens`）。
/// UI 标准：`ModuleSettingsCard` + `EqualHeightCardRow`（同质量管理页）。
struct ApiTokensView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = ApiTokensViewModel()

    private var dark: Bool { appearance.isDarkEffective }
    private let row1MinHeight: CGFloat = 240
    private let row2MinHeight: CGFloat = 180

    var body: some View {
        PageScaffold(
            title: "Token 配置",
            subtitle: "平台 REST API 的 Bearer Token 管理",
            systemImage: "key",
            iconColor: AppTheme.sidebarActive,
            toolbar: { toolbar },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let err = model.errorText, !err.isEmpty {
                            errorBanner(err)
                                .padding(.bottom, 12)
                        }
                        VStack(spacing: 14) {
                            EqualHeightCardRow(minHeight: row1MinHeight) {
                                statusCard
                            } second: {
                                configCard
                            }
                            EqualHeightCardRow(minHeight: row2MinHeight) {
                                docsCard
                            } second: {
                                usageCard
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
        }
        .sheet(isPresented: $model.showDocsSheet) {
            ApiDocsSheet(model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    private var toolbar: some View {
        AppButton(
            title: "刷新",
            systemImage: "arrow.clockwise",
            kind: .secondary,
            isLoading: model.isLoading
        ) {
            Task { await model.reload() }
        }
    }

    // MARK: - Status

    private var statusCard: some View {
        ModuleSettingsCard(
            title: "Token 状态",
            subtitle: model.tokenAvailability.label,
            systemImage: "info.circle",
            accent: model.tokenIsUsable ? AppTheme.sidebarActive : AppTheme.textSecondary(dark),
            enabled: nil,
            minHeight: row1MinHeight
        ) {
            infoRow("名称", model.status.tokenName.isEmpty ? "—" : model.status.tokenName)
            infoRow("状态", model.tokenAvailability.label)
            if !model.status.expiresAt.isEmpty {
                infoRow("过期时间", model.status.expiresAt)
                let days = model.status.daysUntilExpiration
                infoRow(
                    "剩余天数",
                    model.tokenAvailability == .expired ? "已过期" : "\(days) 天",
                    warn: days < 7 || model.status.isExpired
                )
            }
            infoRow("说明", model.status.description.isEmpty ? "—" : model.status.description)

            if model.status.hasToken, model.status.enabled, !model.displayToken.isEmpty {
                FormFieldRow(label: "当前 Token") {
                    HStack(spacing: 8) {
                        AppTextField(text: .constant(model.displayToken), placeholder: "—")
                            .disabled(true)
                        AppButton(title: "复制", systemImage: "doc.on.doc", kind: .secondary) {
                            model.copyToken()
                        }
                    }
                }
            }
        } footer: {
            StatusBadge(text: model.tokenAvailability.label, tone: model.tokenIsUsable ? .success : .warning)
        }
    }

    // MARK: - Config

    private var configCard: some View {
        ModuleSettingsCard(
            title: "Token 配置",
            subtitle: "生成或撤销 API 访问令牌",
            systemImage: "gearshape",
            accent: AppTheme.info,
            enabled: nil,
            minHeight: row1MinHeight
        ) {
            FormFieldRow(label: "Token 名称", required: true) {
                AppTextField(
                    text: $model.form.tokenName,
                    placeholder: "如：生产环境 API",
                    leadingSystemImage: "tag"
                )
            }
            FormFieldRow(label: "有效期") {
                SelectMenu(
                    options: model.expireOptions,
                    selection: Binding(
                        get: { "\(model.form.expirationDays)" },
                        set: { model.form.expirationDays = Int($0 ?? "30") ?? 30 }
                    ),
                    placeholder: "选择天数",
                    width: 140,
                    allowClear: false,
                    searchable: false
                )
            }
            FormFieldRow(label: "描述") {
                AppTextField(
                    text: $model.form.description,
                    placeholder: "可选说明"
                )
            }
            Text(L("生成新 Token 会使旧 Token 立即失效。"))
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        } footer: {
            HStack(spacing: 8) {
                AppButton(
                    title: "生成 Token",
                    systemImage: "key",
                    kind: .primary,
                    isLoading: model.savingKey == "generate"
                ) {
                    model.generate()
                }
                AppButton(
                    title: "撤销",
                    systemImage: "xmark.shield",
                    kind: .danger,
                    isLoading: model.savingKey == "revoke"
                ) {
                    model.revoke()
                }
            }
        }
    }

    // MARK: - Docs

    private var docsCard: some View {
        ModuleSettingsCard(
            title: "内置 API 交互文档",
            subtitle: "受保护 OpenAPI 3.0.3 · 在线调试与导出",
            systemImage: "book.closed",
            accent: AppTheme.violet,
            enabled: nil,
            minHeight: row2MinHeight
        ) {
            Text(L("匿名文档暴露面已收敛关闭。通过登录态保护的内建面板浏览全部开放接口、一键复制 Bearer cURL 命令或导出标准规范。"))
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 10) {
                docActionRow(
                    title: "打开内置交互文档",
                    detail: "AI / Storage 6 个开放接口",
                    icon: "doc.text.magnifyingglass",
                    trailingIcon: "chevron.right"
                ) {
                    model.openDocsSheet()
                }
                docActionRow(
                    title: "导出 OpenAPI 3.0.3 JSON",
                    detail: "oci-pool-openapi-3.0.3.json",
                    icon: "arrow.down.doc",
                    trailingIcon: "square.and.arrow.down"
                ) {
                    model.exportOpenApiSpec()
                }
            }
            .padding(.top, 4)
        } footer: {
            HStack(spacing: 8) {
                AppButton(title: "打开交互文档", systemImage: "book.closed", kind: .primary) {
                    model.openDocsSheet()
                }
                AppButton(title: "导出 JSON", systemImage: "arrow.down.doc", kind: .secondary) {
                    model.exportOpenApiSpec()
                }
            }
        }
    }

    // MARK: - Usage

    private var usageCard: some View {
        ModuleSettingsCard(
            title: "API 使用说明",
            subtitle: "请求头携带 Authorization",
            systemImage: "terminal",
            accent: AppTheme.orange,
            enabled: nil,
            minHeight: row2MinHeight
        ) {
            Text(L("所有 API 请求需在请求头中携带 Bearer Token 完成鉴权。示例："))
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))

            Text(L(authHeaderSample))
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(dark ? Color.black.opacity(0.25) : Color(hex: "f1f5f9"))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                )

            Text(L("示例路径：/oci-pool/open-api/v1/models"))
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        } footer: {
            AppButton(title: "复制请求头", systemImage: "doc.on.doc", kind: .secondary) {
                model.copyAuthHeader()
            }
        }
    }

    private var authHeaderSample: String {
        let token = model.tokenIsUsable ? model.displayToken : "{your_token}"
        return "Authorization: Bearer \(token)"
    }

    private func docActionRow(
        title: String,
        detail: String,
        icon: String,
        trailingIcon: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .foregroundColor(AppTheme.violet)
                    .frame(width: 18)
                Text(L(title))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                Spacer()
                Text(L(detail))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Image(systemName: trailingIcon)
                    .font(.system(size: 10))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.sidebarBg(dark).opacity(0.6))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.border(dark).opacity(0.6), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func infoRow(_ label: String, _ value: String, warn: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(L(label))
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))
                .frame(width: 72, alignment: .leading)
            Text(L(value))
                .font(.system(size: 12, weight: warn ? .semibold : .regular))
                .foregroundColor(
                    warn
                        ? AppTheme.orange
                        : (dark ? Color.white.opacity(0.9) : Color.primary)
                )
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.danger)
            Text(L(text)).font(.system(size: 12))
            Spacer()
            Button(L("重试")) { Task { await model.reload() } }
                .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Built-in Protected OpenAPI Docs Sheet

struct ApiDocsSheet: View {
    @ObservedObject var model: ApiTokensViewModel
    @EnvironmentObject private var appearance: AppearanceController

    @State private var expandedIds: Set<String> = []

    private var dark: Bool { appearance.isDarkEffective }
    private var groups: [(id: String, title: String)] {
        [
            ("ALL", "全部接口"),
            ("AI", "AI 对话与模型"),
            ("Storage", "OCI 对象存储")
        ]
    }

    var body: some View {
        AppSheetChrome(
            title: model.openApiSpec?.title ?? "内置 OpenAPI 交互文档",
            subtitle: "OpenAPI \(model.openApiSpec?.openapi ?? "3.0.3") · Bearer Token 鉴权保护",
            systemImage: "book.closed",
            iconColor: AppTheme.violet,
            width: 760,
            height: 600,
            onClose: { model.closeDocsSheet() },
            footer: {
                HStack(spacing: 10) {
                    StatusBadge(
                        text: model.tokenIsUsable ? "已自动带入当前 Token" : "Token \(model.tokenAvailability.label)",
                        tone: model.tokenIsUsable ? .success : .warning
                    )
                    Spacer()
                    AppButton(title: "导出 OpenAPI JSON", systemImage: "arrow.down.doc", kind: .secondary) {
                        model.exportOpenApiSpec()
                    }
                    AppButton(title: "关闭", kind: .primary) {
                        model.closeDocsSheet()
                    }
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 14) {
                    filterToolbar

                    if model.isSpecLoading && model.openApiSpec == nil {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text(L("正在加载受保护 OpenAPI 规范…"))
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.textSecondary(dark))
                        }
                        .frame(maxWidth: .infinity, minHeight: 160)
                    } else if let err = model.specErrorText, !err.isEmpty {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(AppTheme.danger)
                            Text(L(err))
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.danger)
                            Spacer()
                            AppButton(title: "重试", systemImage: "arrow.clockwise", kind: .secondary) {
                                Task { await model.loadOpenApiSpec() }
                            }
                        }
                        .padding(12)
                        .background(AppTheme.dangerSoft(dark))
                        .cornerRadius(8)
                    } else if model.filteredEndpoints.isEmpty {
                        Text(L("未找到匹配的开放接口"))
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.textTertiary(dark))
                            .frame(maxWidth: .infinity, minHeight: 120)
                    } else {
                        ForEach(["AI", "Storage"], id: \.self) { grp in
                            let groupItems = model.filteredEndpoints.filter {
                                $0.group.caseInsensitiveCompare(grp) == .orderedSame
                            }
                            if !groupItems.isEmpty {
                                groupSection(title: grp == "AI" ? "AI 接口分组" : "Storage 对象存储分组", items: groupItems)
                            }
                        }
                        let otherItems = model.filteredEndpoints.filter { ep in
                            ep.group.caseInsensitiveCompare("AI") != .orderedSame &&
                            ep.group.caseInsensitiveCompare("Storage") != .orderedSame
                        }
                        if !otherItems.isEmpty {
                            groupSection(title: "其他接口", items: otherItems)
                        }
                    }
                }
            }
        )
    }

    private var filterToolbar: some View {
        HStack(spacing: 8) {
            ForEach(groups, id: \.id) { g in
                let active = model.selectedDocsGroup == g.id
                Button(action: { model.selectedDocsGroup = g.id }) {
                    Text(L(g.title))
                        .font(.system(size: 11.5, weight: active ? .semibold : .regular))
                        .foregroundColor(active ? appearance.accent.accentFg(dark) : AppSheetSurface.primaryText(dark))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(active ? AppTheme.sidebarActive : AppSheetSurface.panelBg(dark))
                        )
                }
                .buttonStyle(PlainButtonStyle())
            }
            Spacer(minLength: 8)
            SearchField(text: $model.docsSearchText, placeholder: "搜索路径或说明…")
                .frame(width: 220)
        }
    }

    private func groupSection(title: String, items: [OpenApiEndpointItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(L(title))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppSheetSurface.primaryText(dark))
                Text(L("\(items.count)"))
                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                    .foregroundColor(AppTheme.violet)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.violet.opacity(0.14))
                    .cornerRadius(4)
            }
            ForEach(items) { ep in
                endpointCard(ep)
            }
        }
    }

    private func endpointCard(_ ep: OpenApiEndpointItem) -> some View {
        let isPost = ep.method.uppercased() == "POST"
        let methodColor = isPost ? AppTheme.sidebarActive : AppTheme.info
        let expanded = expandedIds.contains(ep.id) || model.previewResponses[ep.id] != nil

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text(L(ep.method.uppercased()))
                    .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                    .foregroundColor(methodColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(methodColor.opacity(0.15))
                    .cornerRadius(5)

                Text(L(ep.path))
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundColor(AppSheetSurface.primaryText(dark))
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer(minLength: 8)

                AppButton(title: "复制 cURL", systemImage: "doc.on.doc", kind: .secondary) {
                    model.copyCurl(for: ep)
                }
                AppButton(
                    title: "在线调试",
                    systemImage: "play.fill",
                    kind: .info,
                    isLoading: model.testingEndpointId == ep.id
                ) {
                    expandedIds.insert(ep.id)
                    model.runPreview(for: ep)
                }
                Button(action: {
                    if expandedIds.contains(ep.id) {
                        expandedIds.remove(ep.id)
                    } else {
                        expandedIds.insert(ep.id)
                    }
                }) {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppSheetSurface.mutedText(dark))
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(PlainButtonStyle())
            }

            Text(L(ep.summary))
                .font(.system(size: 11.5))
                .foregroundColor(AppSheetSurface.mutedText(dark))

            if expanded {
                VStack(alignment: .leading, spacing: 8) {
                    codeBlock(title: "Bearer cURL 示例", code: model.curlCommand(for: ep))
                    if let sample = ep.sampleBody, !sample.isEmpty {
                        codeBlock(title: "请求体示例 (JSON)", code: sample)
                    }
                    if let preview = model.previewResponses[ep.id], !preview.isEmpty {
                        codeBlock(title: "实时响应预览", code: preview)
                    }
                }
            }
        }
        .padding(12)
        .background(AppSheetSurface.surface2(dark))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
    }

    private func codeBlock(title: String, code: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(L(title))
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundColor(AppSheetSurface.mutedText(dark))
            Text(L(code))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(AppSheetSurface.primaryText(dark))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(AppSheetSurface.panelBg(dark))
                .cornerRadius(6)
        }
    }
}
