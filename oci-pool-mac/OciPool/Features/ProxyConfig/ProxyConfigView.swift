import SwiftUI

/// 原生代理池（一级菜单，对齐 Web `SysVpnProxyPage`）。
struct ProxyConfigView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = ProxyConfigViewModel()
    /// Row ids currently showing plaintext password (click-to-reveal, align Web).

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "代理池",
            subtitle: "OCI API 出站代理池。出口顺序：专属节点 → 强制节点 → 代理池；没有可用节点时阻止直连，避免暴露真实 IP。",
            systemImage: "shuffle",
            iconColor: AppTheme.cyan,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.bottom, 12)
                    }
                    kpiGrid
                        .padding(.bottom, 14)
                    VStack(spacing: 0) {
                        listBody
                        if model.pageState.totalElements > Int64(model.pageState.size) {
                            PaginationBar(state: $model.pageState) {
                                model.onPageChange()
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppTheme.sidebarBg(dark))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppTheme.border(dark), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
        }
        .sheet(item: $model.activeForm) { _ in
            ProxyConfigSheet(model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(
                title: "测试全部",
                systemImage: "wifi",
                kind: .secondary,
                isLoading: model.isTestingAll
            ) {
                model.testAll()
            }
            .disabled(model.isTestingAll || model.items.isEmpty)
            AppButton(title: "添加代理", systemImage: "plus", kind: .primary) {
                model.openAdd()
            }
            AppButton(
                title: "刷新",
                systemImage: "arrow.clockwise",
                kind: .secondary,
                isLoading: model.isLoading
            ) {
                Task { await model.reload() }
            }
        }
    }

    // MARK: - KPI（对齐 Web 代理池 4 卡）

    private var kpiGrid: some View {
        let healthy = model.items.filter { $0.health == .healthy }.count
        let bound = Set(model.items.flatMap { $0.boundTenantIds }).count
        let latencies = model.items.compactMap { $0.latency }.filter { $0 > 0 }
        let avg = latencies.isEmpty ? "—" : "\(latencies.reduce(0, +) / latencies.count) ms"
        return HStack(spacing: 12) {
            kpiCard(icon: "shuffle", color: AppTheme.cyan, label: "总代理数",
                    value: "\(max(Int(model.pageState.totalElements), model.items.count))", valueColor: nil)
            kpiCard(icon: "checkmark.circle", color: AppTheme.success, label: "健康节点",
                    value: "\(healthy)", valueColor: AppTheme.success)
            kpiCard(icon: "gauge", color: AppTheme.orange, label: "平均延时",
                    value: avg, valueColor: AppTheme.orange, mono: true)
            kpiCard(icon: "person.2", color: AppTheme.info, label: "已绑定租户",
                    value: "\(bound)", valueColor: nil)
        }
    }

    private func kpiCard(icon: String, color: Color, label: String, value: String,
                         valueColor: Color?, mono: Bool = false) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: mono ? .monospaced : .default))
                    .foregroundColor(valueColor ?? AppTheme.navIcon(dark))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            Spacer(minLength: 0)
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(color)
            }
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

    // MARK: - List

    private var listBody: some View {
        DataList {
            DataListColumnHeader(title: "序号", width: 44)
            DataListColumnHeader(title: "名称", width: nil, alignment: .leading)
            DataListColumnHeader(title: "协议类型", width: 76, alignment: .leading)
            DataListColumnHeader(title: "端点地址", width: 200, alignment: .leading)
            DataListColumnHeader(title: "代理归属地", width: 110, alignment: .leading)
            DataListColumnHeader(title: "关联租户", width: 64)
            DataListColumnHeader(title: "延时", width: 70, alignment: .leading)
            DataListColumnHeader(title: "状态", width: 96)
            DataListColumnHeader(title: "操作", width: 160)
        } content: {
            if (!model.hasLoadedOnce || model.isLoading) && model.items.isEmpty {
                VStack(spacing: 10) {
                    Spacer()
                    ProgressView()
                    Text("加载代理列表中…")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.sidebarText(dark))
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 260)
            } else if model.items.isEmpty {
                EmptyStateView(
                    icon: "shuffle",
                    title: "暂无代理",
                    subtitle: "点击右上角「添加代理」开始配置",
                    actionTitle: "添加代理",
                    action: { model.openAdd() }
                )
                .frame(maxWidth: .infinity, minHeight: 260)
            } else {
                ForEach(Array(model.items.enumerated()), id: \.element.id) { index, item in
                    DataListRow {
                        row(item, index: model.pageState.page * model.pageState.size + index + 1)
                    }
                }
                .opacity(model.isLoading ? 0.6 : 1.0)
            }
        }
    }

    private func healthColor(_ h: ProxyHealth) -> Color {
        switch h {
        case .testing: return AppTheme.info
        case .healthy: return AppTheme.success
        case .error: return AppTheme.danger
        case .stale: return AppTheme.orange
        case .unchecked: return AppTheme.textTertiary(dark)
        }
    }

    private func latencyColor(_ ms: Int) -> Color {
        ms < 300 ? AppTheme.success : (ms < 800 ? AppTheme.orange : AppTheme.danger)
    }

    private var primaryText: Color { dark ? Color.white.opacity(0.88) : Color(hex: "1e2f42") }

    private func row(_ item: VpnProxyItem, index: Int) -> some View {
        let health = item.health
        let tone = healthColor(health)
        let proto = item.proxyType.uppercased()
        let protoColor = proto == "SOCKS5" ? AppTheme.sidebarActive : AppTheme.info
        return HStack(spacing: 0) {
            Text("\(index)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(AppTheme.textTertiary(dark))
                .frame(width: 44)
            HStack(spacing: 7) {
                Circle().fill(tone).frame(width: 8, height: 8).help(item.healthHelp)
                Text(item.customName.isEmpty ? item.proxyHost : item.customName)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                if item.isForce {
                    Text("强制")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(AppTheme.danger)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(RoundedRectangle(cornerRadius: 4).fill(AppTheme.danger.opacity(0.12)))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(AppTheme.danger.opacity(0.25), lineWidth: 1))
                        .help("强制代理：节点不可用时拒绝请求")
                        .fixedSize()
                }
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(proto.isEmpty ? "—" : proto)
                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                .foregroundColor(protoColor)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 4).fill(protoColor.opacity(0.14)))
                .frame(width: 76, alignment: .leading)
            Text(item.endpoint)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(AppTheme.cyan)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(width: 200, alignment: .leading)
                .help(item.endpoint)
            locationCell(item)
            Button(action: { model.openEdit(item) }) {
                Text("\(item.boundTenantIds.count)")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(item.boundTenantIds.isEmpty ? AppTheme.textTertiary(dark) : primaryText)
                    .frame(minWidth: 26, minHeight: 22)
                    .padding(.horizontal, 4)
                    .background(Capsule().fill(AppTheme.bg3(dark)))
            }
            .buttonStyle(PlainButtonStyle())
            .help(item.tenantName.isEmpty ? "点击管理该代理关联的租户" : "点击管理该代理关联的租户\n\(item.tenantName)")
            .frame(width: 64)
            Group {
                if let ms = item.latency {
                    Text("\(ms) ms")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(latencyColor(ms))
                } else {
                    Text("—").font(.system(size: 12)).foregroundColor(AppTheme.textTertiary(dark))
                }
            }
            .frame(width: 70, alignment: .leading)
            VStack(spacing: 3) {
                HStack(spacing: 4) {
                    if health == .testing {
                        ProgressView().scaleEffect(0.45).frame(width: 10, height: 10)
                    }
                    Text(health.label)
                        .font(.system(size: 11.5, weight: .medium))
                }
                .foregroundColor(health == .unchecked ? AppTheme.textSecondary(dark) : tone)
                .padding(.horizontal, 10)
                .padding(.vertical, 2)
                .background(Capsule().fill(tone.opacity(0.08)))
                .overlay(Capsule().stroke(AppTheme.border(dark), lineWidth: 1))
                if health != .testing, !item.checkedText.isEmpty {
                    Text(item.checkedText)
                        .font(.system(size: 9.5))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(1)
                }
            }
            .help(item.healthHelp)
            .frame(width: 96)
            HStack(spacing: 2) {
                actionButton(icon: "wifi", help: "检测连通性", hover: AppTheme.sidebarActive,
                             loading: item.isTesting) { model.testConnection(item) }
                    .disabled(item.isTesting || model.isTestingAll)
                actionButton(icon: item.isForce ? "checkmark.shield.fill" : "shield",
                             help: item.isForce ? "关闭强制：节点不可用时回退到代理池其他节点" : "开启强制：节点不可用时拒绝请求",
                             hover: AppTheme.danger,
                             tint: item.isForce ? AppTheme.danger : nil) { model.toggleForce(item) }
                actionButton(icon: "pencil", help: "编辑代理与关联租户", hover: primaryText) { model.openEdit(item) }
                actionButton(icon: "doc.on.doc", help: "复制连接地址（不含密码）", hover: AppTheme.info) { copyEndpoint(item) }
                actionButton(icon: "trash", help: "删除代理", hover: AppTheme.danger) { model.delete(item) }
            }
            .frame(width: 160)
        }
    }

    private func copyEndpoint(_ item: VpnProxyItem) {
        let text = "\(item.proxyType.lowercased())://\(item.endpoint)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        ToastCenter.shared.success("已复制连接地址 · \(text)")
    }

    private func actionButton(icon: String, help: String, hover: Color, tint: Color? = nil,
                              loading: Bool = false, action: @escaping () -> Void) -> some View {
        ProxyActionButton(icon: icon, help: help, hover: hover, tint: tint, loading: loading,
                          dark: dark, action: action)
    }

    private func locationCell(_ item: VpnProxyItem) -> some View {
        HStack(spacing: 4) {
            if item.isTesting {
                ProgressView()
                    .scaleEffect(0.55)
                    .frame(width: 12, height: 12)
                Text("检测中…")
                    .font(.system(size: 11.5))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
            } else if !item.location.isEmpty {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 10))
                    .foregroundColor(AppTheme.sidebarActive)
                Text(item.location)
                    .font(.system(size: 12))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
            } else {
                Text("—")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.textTertiary(dark))
            }
        }
        .frame(width: 110, alignment: .leading)
        .help(item.location.isEmpty ? "未解析" : item.location)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.danger)
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.reload() } }
                .buttonStyle(PlainButtonStyle())
            Button(action: { model.clearError() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppTheme.danger.opacity(0.8))
                    .padding(4)
            }
            .buttonStyle(PlainButtonStyle())
            .help("关闭提示")
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(8)
    }
}

private struct ProxyActionButton: View {
    let icon: String
    let help: String
    let hover: Color
    var tint: Color? = nil
    var loading: Bool = false
    let dark: Bool
    let action: () -> Void
    @State private var hovering = false
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading {
                    ProgressView().scaleEffect(0.5)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 12.5, weight: .medium))
                }
            }
            .foregroundColor(hovering && isEnabled ? hover : (tint ?? AppTheme.textSecondary(dark)))
            .frame(width: 28, height: 28)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(hovering && isEnabled ? AppTheme.bg3(dark) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .opacity(isEnabled ? 1 : 0.45)
        .onHover { hovering = $0 }
        .help(help)
    }
}
