import SwiftUI

// MARK: - Add / Edit DNS

struct CloudflareDnsSheet: View {
    @ObservedObject var model: CloudflareViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }
    private var isEdit: Bool { model.dnsForm?.isEditing == true }

    var body: some View {
        AppSheetChrome(
            title: isEdit ? "编辑 DNS 记录" : "添加 DNS 记录",
            systemImage: isEdit ? "pencil" : "plus.circle",
            width: 480,
            height: isEdit ? 410 : 440,
            scrollableContent: false,
            onClose: { model.closeDnsForm() },
            footer: {
                HStack {
                    Spacer()
                    AppButton(title: "取消", kind: .secondary) { model.closeDnsForm() }
                    AppButton(
                        title: isEdit ? "保存" : "添加",
                        systemImage: "square.and.arrow.down",
                        kind: .primary,
                        isLoading: model.isSaving
                    ) {
                        model.saveDnsForm()
                    }
                }
            },
            content: {
                if model.dnsForm != nil {
                    VStack(alignment: .leading, spacing: 14) {
                        FormFieldRow(label: "类型", required: true) {
                            if isEdit {
                                AppTextField(
                                    text: .constant(model.dnsForm?.type ?? ""),
                                    placeholder: "类型"
                                )
                                .disabled(true)
                            } else {
                                SelectMenu(
                                    options: CloudflareJSON.typeOptions,
                                    selection: Binding(
                                        get: { model.dnsForm?.type },
                                        set: { val in
                                            guard var f = model.dnsForm else { return }
                                            f.type = val ?? "A"
                                            if !["A", "AAAA", "CNAME"].contains(f.type) {
                                                f.proxied = false
                                            }
                                            model.dnsForm = f
                                        }
                                    ),
                                    placeholder: "选择类型",
                                    width: 200,
                                    allowClear: false,
                                    searchable: false
                                )
                            }
                        }

                        FormFieldRow(label: "记录名", required: true) {
                            AppTextField(
                                text: Binding(
                                    get: { model.dnsForm?.name ?? "" },
                                    set: { val in
                                        guard var f = model.dnsForm else { return }
                                        f.name = val
                                        model.dnsForm = f
                                    }
                                ),
                                placeholder: "@ / www / mail",
                                leadingSystemImage: "textformat"
                            )
                            .disabled(isEdit)
                        }
                        if !isEdit {
                            Text(L("根域名使用 @"))
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }

                        FormFieldRow(label: "记录值", required: true) {
                            AppTextField(
                                text: Binding(
                                    get: { model.dnsForm?.content ?? "" },
                                    set: { val in
                                        guard var f = model.dnsForm else { return }
                                        f.content = val
                                        model.dnsForm = f
                                    }
                                ),
                                placeholder: "IP 或域名",
                                leadingSystemImage: "link"
                            )
                        }

                        HStack(alignment: .top, spacing: 24) {
                            FormFieldRow(label: "TTL") {
                                SelectMenu(
                                    options: CloudflareJSON.ttlOptions,
                                    selection: Binding(
                                        get: { "\(model.dnsForm?.ttl ?? 1)" },
                                        set: { val in
                                            guard var f = model.dnsForm else { return }
                                            f.ttl = Int(val ?? "1") ?? 1
                                            model.dnsForm = f
                                        }
                                    ),
                                    placeholder: "TTL",
                                    width: 140,
                                    allowClear: false,
                                    searchable: false
                                )
                            }

                            if canProxy {
                                FormFieldRow(label: "Cloudflare 代理") {
                                    HStack(spacing: 8) {
                                        Toggle("", isOn: Binding(
                                            get: { model.dnsForm?.proxied ?? false },
                                            set: { val in
                                                guard var f = model.dnsForm else { return }
                                                f.proxied = val
                                                model.dnsForm = f
                                            }
                                        ))
                                        .toggleStyle(SwitchToggleStyle(tint: Color(hex: "f38020")))
                                        .labelsHidden()

                                        Text(L("橙云代理可隐藏源站 IP"))
                                            .font(.system(size: 11))
                                            .foregroundColor(AppTheme.sidebarText(dark))
                                    }
                                    .frame(height: AppInputStyle.height)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            }
        )
        .environmentObject(appearance)
    }

    private var canProxy: Bool {
        let t = (model.dnsForm?.type ?? "A").uppercased()
        return ["A", "AAAA", "CNAME"].contains(t)
    }
}

// MARK: - Secret config

struct CloudflareConfigSheet: View {
    @ObservedObject var model: CloudflareViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        AppSheetChrome(
            title: "Cloudflare 密钥配置",
            systemImage: "key.fill",
            width: 460,
            height: 360,
            onClose: { model.closeConfig() },
            footer: {
                HStack {
                    AppButton(
                        title: "测试连接",
                        systemImage: "bolt.horizontal.circle",
                        kind: .secondary,
                        isLoading: model.isConfigSaving
                    ) {
                        model.testConfig()
                    }
                    Spacer()
                    AppButton(title: "取消", kind: .secondary) { model.closeConfig() }
                    AppButton(
                        title: "保存",
                        systemImage: "square.and.arrow.down",
                        kind: .primary,
                        isLoading: model.isConfigSaving
                    ) {
                        model.saveConfig()
                    }
                }
            },
            content: {
                if model.configForm != nil {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text(L("启用 Cloudflare"))
                                .font(.system(size: 13, weight: .medium))
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { model.configForm?.enabled ?? false },
                                set: { val in
                                    guard var f = model.configForm else { return }
                                    f.enabled = val
                                    model.configForm = f
                                }
                            ))
                            .labelsHidden()
                            .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
                        }

                        FormFieldRow(label: "API Key", required: true) {
                            AppTextField(
                                text: Binding(
                                    get: { model.configForm?.apiToken ?? "" },
                                    set: { val in
                                        guard var f = model.configForm else { return }
                                        f.apiToken = val
                                        model.configForm = f
                                    }
                                ),
                                placeholder: "Global API Key",
                                secure: true,
                                leadingSystemImage: "key"
                            )
                        }
                        Text("My Profile → API Tokens → Global API Key")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarText(dark))

                        FormFieldRow(label: "账户邮箱", required: true) {
                            AppTextField(
                                text: Binding(
                                    get: { model.configForm?.email ?? "" },
                                    set: { val in
                                        guard var f = model.configForm else { return }
                                        f.email = val
                                        model.configForm = f
                                    }
                                ),
                                placeholder: "Cloudflare 账户邮箱",
                                leadingSystemImage: "envelope"
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        )
        .environmentObject(appearance)
    }
}

// MARK: - Official Origin CIDR & Nginx real_ip Sheet

struct CloudflareOfficialIpsSheet: View {
    @ObservedObject var model: CloudflareViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        let info = model.officialIpsForm ?? CfOfficialIpRanges()
        let isRemote = info.source.lowercased() == "remote"

        AppSheetChrome(
            title: "Cloudflare 回源 IP 与 Nginx 配置",
            subtitle: "自动生成 CF-Connecting-IP 真实访客还原片段",
            systemImage: "lock.shield",
            iconColor: AppTheme.orange,
            width: 680,
            height: 580,
            onClose: { model.closeOfficialIps() },
            footer: {
                AdaptivePageToolbar {
                    StatusBadge(
                        text: isRemote ? "实时官方网段 (remote)" : "内置兜底网段 (fallback)",
                        tone: isRemote ? .success : .warning
                    )
                    if !info.fetchedAt.isEmpty {
                        Text(L("更新：\(info.displayFetchedAt)"))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(AppSheetSurface.mutedText(dark))
                            .lineLimit(1)
                            .help(L(info.fetchedAt))
                    }
                    AppButton(
                        title: "刷新网段",
                        systemImage: "arrow.clockwise",
                        kind: .secondary,
                        isLoading: model.isOfficialIpsLoading
                    ) {
                        Task { await model.reloadOfficialIps() }
                    }
                    AppButton(
                        title: "复制 Nginx 配置",
                        systemImage: "doc.on.doc",
                        kind: .primary
                    ) {
                        model.copyToPasteboard(info.nginxRealIpSnippet, successNotice: "Nginx real_ip 配置已复制")
                    }
                    AppButton(title: "关闭", kind: .secondary) {
                        model.closeOfficialIps()
                    }
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 14) {
                    AppSheetInfoBox(
                        text: "源站安全与真实访客 IP 还原指引",
                        lines: [
                            "开启橙云代理后，将以下配置放入 Nginx http {} 或 server {} 块即可通过 CF-Connecting-IP 获取真实客户端 IP。",
                            "生产环境建议配合源站防火墙仅放行下列 Cloudflare 官方 IPv4 / IPv6 回源网段。"
                        ]
                    )

                    HStack(alignment: .top, spacing: 12) {
                        cidrColumn(
                            title: "IPv4 回源网段",
                            cidrs: info.ipv4Cidrs,
                            copyNotice: "已复制 \(info.ipv4Cidrs.count) 条 IPv4 网段"
                        )
                        cidrColumn(
                            title: "IPv6 回源网段",
                            cidrs: info.ipv6Cidrs,
                            copyNotice: "已复制 \(info.ipv6Cidrs.count) 条 IPv6 网段"
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(L("Nginx ngx_http_realip_module 配置片段"))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(AppSheetSurface.primaryText(dark))
                            Spacer()
                            AppButton(title: "一键复制片段", systemImage: "doc.on.doc", kind: .secondary) {
                                model.copyToPasteboard(info.nginxRealIpSnippet, successNotice: "Nginx real_ip 配置已复制")
                            }
                        }
                        Text(L(info.nginxRealIpSnippet))
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundColor(AppSheetSurface.primaryText(dark))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(AppSheetSurface.panelBg(dark))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                            )
                    }
                }
            }
        )
    }

    private func cidrColumn(title: String, cidrs: [String], copyNotice: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L(title))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppSheetSurface.primaryText(dark))
                StatusBadge(text: "\(cidrs.count)", tone: .info)
                Spacer()
                AppButton(title: "复制", systemImage: "doc.on.doc", kind: .secondary, enabled: !cidrs.isEmpty) {
                    model.copyToPasteboard(cidrs.joined(separator: "\n"), successNotice: copyNotice)
                }
            }
            Text(L(cidrs.isEmpty ? "—" : cidrs.joined(separator: "\n")))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(AppSheetSurface.primaryText(dark))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(AppSheetSurface.panelBg(dark))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                )
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

// MARK: - DNS Public IP Batch Extractor Sheet

struct CloudflarePublicIpExtractSheet: View {
    @ObservedObject var model: CloudflareViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    private let typeFilterOptions: [(id: String, title: String)] = [
        ("ALL", "全部 (A + AAAA)"),
        ("A", "仅 IPv4 (A)"),
        ("AAAA", "仅 IPv6 (AAAA)")
    ]

    private let proxyFilterOptions: [(id: String, title: String)] = [
        ("ALL", "全部代理状态"),
        ("PROXIED", "仅橙云代理"),
        ("DNS_ONLY", "仅灰云直连")
    ]

    var body: some View {
        let ips = model.extractedPublicIps

        AppSheetChrome(
            title: "提取解析公网 IP",
            subtitle: model.selectedZoneName.isEmpty ? "从已加载 A / AAAA 记录聚合去重" : "\(model.selectedZoneName) · 当前已加载 \(model.records.count) 条记录",
            systemImage: "doc.on.clipboard",
            iconColor: AppTheme.cyan,
            width: 600,
            height: 500,
            onClose: { model.closePublicIpExtract() },
            footer: {
                HStack(spacing: 10) {
                    StatusBadge(text: "去重后共 \(ips.count) 个公网 IP", tone: ips.isEmpty ? .neutral : .success)
                    Spacer()
                    AppButton(
                        title: "按逗号复制",
                        systemImage: "doc.on.doc",
                        kind: .secondary,
                        enabled: !ips.isEmpty
                    ) {
                        model.copyToPasteboard(ips.joined(separator: ", "), successNotice: "已按逗号分隔复制 \(ips.count) 个 IP")
                    }
                    AppButton(
                        title: "按换行复制",
                        systemImage: "doc.on.clipboard",
                        kind: .primary,
                        enabled: !ips.isEmpty
                    ) {
                        model.copyToPasteboard(ips.joined(separator: "\n"), successNotice: "已按换行分隔复制 \(ips.count) 个 IP")
                    }
                    AppButton(title: "关闭", kind: .secondary) {
                        model.closePublicIpExtract()
                    }
                }
            },
            content: {
                if model.publicIpExtractForm != nil {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(L("记录类型"))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(AppSheetSurface.primaryText(dark))
                            HStack(spacing: 8) {
                                ForEach(typeFilterOptions, id: \.id) { opt in
                                    filterPill(
                                        title: opt.title,
                                        active: model.publicIpExtractForm?.typeFilter == opt.id
                                    ) {
                                        model.publicIpExtractForm?.typeFilter = opt.id
                                    }
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text(L("Cloudflare 代理状态"))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(AppSheetSurface.primaryText(dark))
                            HStack(spacing: 8) {
                                ForEach(proxyFilterOptions, id: \.id) { opt in
                                    filterPill(
                                        title: opt.title,
                                        active: model.publicIpExtractForm?.proxyFilter == opt.id
                                    ) {
                                        model.publicIpExtractForm?.proxyFilter = opt.id
                                    }
                                }
                            }
                        }

                        FormFieldRow(label: "关键字过滤") {
                            SearchField(
                                text: Binding(
                                    get: { model.publicIpExtractForm?.keyword ?? "" },
                                    set: { model.publicIpExtractForm?.keyword = $0 }
                                ),
                                placeholder: "按子域名前缀或 IP 片段过滤…",
                                fillsWidth: true
                            )
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text(L("提取结果预览（保持记录顺序自动去重）"))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(AppSheetSurface.primaryText(dark))

                            if ips.isEmpty {
                                Text(L("当前筛选条件下没有匹配的 A / AAAA 公网 IP 记录"))
                                    .font(.system(size: 12))
                                    .foregroundColor(AppSheetSurface.mutedText(dark))
                                    .frame(maxWidth: .infinity, minHeight: 120)
                                    .background(AppSheetSurface.panelBg(dark))
                                    .cornerRadius(8)
                            } else {
                                Text(L(ips.joined(separator: "\n")))
                                    .font(.system(size: 12, design: .monospaced))
                                    .foregroundColor(AppSheetSurface.primaryText(dark))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(12)
                                    .background(AppSheetSurface.panelBg(dark))
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(AppSheetSurface.border(dark), lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
            }
        )
    }

    private func filterPill(title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(L(title))
                .font(.system(size: 11.5, weight: active ? .semibold : .regular))
                .foregroundColor(active ? appearance.accent.accentFg(dark) : AppSheetSurface.primaryText(dark))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(active ? AppTheme.sidebarActive : AppSheetSurface.panelBg(dark))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(active ? AppTheme.sidebarActive : AppSheetSurface.border(dark), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
}
