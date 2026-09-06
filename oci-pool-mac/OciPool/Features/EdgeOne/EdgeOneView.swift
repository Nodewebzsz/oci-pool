import SwiftUI

/// 原生腾讯云 EdgeOne 管理（对齐 Web `/dns/edgeone` · `eo_manage.ftl`）。
struct EdgeOneView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = EdgeOneViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "EO 管理",
            subtitle: "Tencent EdgeOne · DNS 记录管理与加速域名",
            systemImage: "globe",
            iconColor: AppTheme.info,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                    modePicker
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 12)
                    searchBar
                        .padding(.horizontal, 16)
                        .padding(.bottom, 12)
                    listBody
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .appLoading((model.isLoading || model.isZonesLoading) && model.zones.isEmpty)
            },
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.loadZones(selectFirst: false); await model.reloadRecords() }
        }
        .onChange(of: model.searchName) { _ in model.onSearchChanged() }
        .onChange(of: model.searchContent) { _ in model.onSearchChanged() }
        .sheet(item: $model.dnsForm) { _ in
            EdgeOneDnsSheet(model: model)
                .environmentObject(appearance)
        }
        .sheet(item: $model.configForm) { _ in
            EdgeOneConfigSheet(model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    // MARK: - Toolbar

    private var hasZone: Bool { !(model.selectedZoneId ?? "").isEmpty }

    /// Web 页头 actions：域名: label + zone 下拉 220 + 秘钥配置(orange) + 添加记录 + 同步(primary) + 刷新
    private var toolbar: some View {
        HStack(spacing: 8) {
            Text("域名:")
                .font(.system(size: 12))
                .foregroundColor(AppTheme.textTertiary(dark))
            SelectMenu(
                options: model.zoneOptions,
                selection: Binding(
                    get: { model.selectedZoneId },
                    set: { model.onZoneChange($0) }
                ),
                placeholder: "请选择域名",
                width: 220,
                allowClear: true,
                searchable: true
            )
            AppButton(title: "秘钥配置", systemImage: "key", kind: .orange) {
                model.openConfig()
            }
            if model.mode == .dns {
                AppButton(title: "添加记录", systemImage: "plus", kind: .primary, enabled: hasZone) {
                    model.openAdd()
                }
            }
            AppButton(
                title: model.mode == .dns ? "同步DNS记录" : "同步域名",
                systemImage: "arrow.triangle.2.circlepath",
                kind: .primary,
                isLoading: model.isSyncing,
                enabled: hasZone
            ) {
                model.sync()
            }
            AppButton(
                title: "刷新",
                systemImage: "arrow.clockwise",
                kind: .secondary,
                isLoading: model.isLoading
            ) {
                Task { await model.reloadRecords() }
            }
        }
    }

    // MARK: - Mode picker (pill)

    private var modePicker: some View {
        HStack(spacing: 0) {
            ForEach(EdgeOneMode.allCases) { m in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        model.switchMode(m)
                    }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: m.systemImage)
                            .font(.system(size: 11, weight: .medium))
                        Text(m.title)
                            .font(.system(size: 12, weight: model.mode == m ? .semibold : .regular))
                    }
                    .foregroundColor(model.mode == m
                                     ? AppearanceController.shared.accent.accentFg(dark)
                                     : AppTheme.sidebarText(dark))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(model.mode == m
                                  ? AppTheme.sidebarActive
                                  : Color.clear)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
            Spacer()
        }
        .padding(3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
    }

    // MARK: - Filter

    /// Web 搜索卡（bg-1 border radius 8 padding 10）：dns=按名称/按值 + 清除搜索；domain=域名输入 + 状态下拉 + 清除搜索
    private var searchBar: some View {
        HStack(spacing: 10) {
            if model.mode == .dns {
                Text("按名称:")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                SearchField(text: $model.searchName, placeholder: "e.g. www")
                Text("按值:")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                SearchField(text: $model.searchContent, placeholder: "e.g. 129.146")
            } else {
                Text("域名:")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                SearchField(text: $model.searchName, placeholder: "e.g. www.example.com")
            }
            AppButton(title: "清除搜索", systemImage: "xmark", kind: .secondary,
                      enabled: !model.searchName.isEmpty || !model.searchContent.isEmpty) {
                model.clearSearch()
            }
        }
        .padding(10)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    /// Web 表格卡标题条：bg-2 · 图标 + 标题 + 计数
    private func listTitleStrip(icon: String, title: String, count: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.textSecondary(dark))
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.navIcon(dark))
            Text("(\(count))")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(AppTheme.textTertiary(dark))
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(AppTheme.sidebarHover(dark))
        .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)
    }

    // MARK: - List

    private var listBody: some View {
        Group {
            if model.selectedZoneId == nil || model.selectedZoneId?.isEmpty == true {
                EmptyStateView(
                    icon: "globe",
                    title: model.zones.isEmpty ? "暂无可用域名" : "请选择域名",
                    subtitle: model.zones.isEmpty
                        ? "请先配置腾讯云 SecretId / SecretKey"
                        : "从上方下拉选择 EdgeOne 站点",
                    actionTitle: "密钥配置",
                    action: { model.openConfig() }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.mode == .dns {
                dnsList
            } else {
                domainList
            }
        }
    }

    private var dnsList: some View {
        Group {
            if model.pagedDns.isEmpty && !model.isLoading {
                EmptyStateView(
                    icon: "list.bullet.rectangle",
                    title: model.filteredDns.isEmpty && !model.dnsRecords.isEmpty
                        ? "无匹配结果"
                        : "暂无 DNS 记录",
                    subtitle: model.dnsRecords.isEmpty
                        ? "点击「添加记录」或「同步记录」"
                        : "试试其他关键词",
                    actionTitle: model.dnsRecords.isEmpty ? "添加记录" : nil,
                    action: model.dnsRecords.isEmpty ? { model.openAdd() } : nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 0) {
                    listTitleStrip(icon: "list.bullet", title: "DNS 记录",
                                   count: "\(model.filteredDns.count)")
                    DataList {
                        DataListColumnHeader(title: "类型", width: 80)
                        DataListColumnHeader(title: "记录名", width: 180)
                        DataListColumnHeader(title: "记录值", width: nil)
                        DataListColumnHeader(title: "TTL", width: 100)
                        DataListColumnHeader(title: "优先级", width: 90)
                        DataListColumnHeader(title: "操作", width: 100)
                    } content: {
                        ForEach(model.filteredDns) { item in
                            DataListRow {
                                dnsRow(item)
                            }
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
                .appLoading(model.isLoading)
            }
        }
    }

    private var domainList: some View {
        Group {
            if model.pagedDomains.isEmpty && !model.isLoading {
                EmptyStateView(
                    icon: "zap",
                    title: model.filteredDomains.isEmpty && !model.accelDomains.isEmpty
                        ? "无匹配结果"
                        : "暂无加速域名",
                    subtitle: model.accelDomains.isEmpty
                        ? "点击「同步域名」从腾讯云拉取"
                        : "试试其他关键词",
                    actionTitle: model.accelDomains.isEmpty ? "同步域名" : nil,
                    action: model.accelDomains.isEmpty ? { model.sync() } : nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 0) {
                    listTitleStrip(icon: "bolt", title: "加速域名",
                                   count: "\(model.filteredDomains.count)")
                    DataList {
                        DataListColumnHeader(title: "域名", width: nil)
                        DataListColumnHeader(title: "状态", width: 100)
                        DataListColumnHeader(title: "CNAME", width: nil)
                        DataListColumnHeader(title: "协议", width: 130)
                        DataListColumnHeader(title: "操作", width: 100)
                    } content: {
                        ForEach(model.filteredDomains) { item in
                            DataListRow {
                                domainRow(item)
                            }
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
                .appLoading(model.isLoading)
            }
        }
    }

    private func dnsRow(_ item: EoDnsRecord) -> some View {
        HStack(spacing: 0) {
            typeChip(item.type)
                .frame(width: 80, alignment: .center)
            cell(item.name, width: 180)
            cell(item.content, width: nil)
            cell(EdgeOneJSON.formatTTL(item.ttl), width: 100)
            cell(item.priority.map { "\($0)" } ?? "—", width: 90)
            HStack(spacing: 6) {
                Spacer(minLength: 0)
                actionBtn("pencil", color: AppTheme.sidebarActive, tip: "编辑") {
                    model.openEdit(item)
                }
                actionBtn("trash", color: AppTheme.danger, tip: "删除") {
                    model.deleteDns(item)
                }
            }
            .frame(width: 100)
        }
    }

    private func domainRow(_ item: EoAccelDomain) -> some View {
        HStack(spacing: 0) {
            cell(item.domainName, width: nil)
            HStack(spacing: 0) {
                Spacer(minLength: 0)
                StatusBadge(
                    text: item.statusLabel,
                    tone: item.statusTone
                )
                Spacer(minLength: 0)
            }
            .frame(width: 100)
            cell(item.cname.isEmpty ? "—" : item.cname, width: nil)
            cell(item.protocolLabel, width: 130)
            HStack {
                Spacer(minLength: 0)
                actionBtn("trash", color: AppTheme.danger, tip: "删除") {
                    model.deleteDomain(item)
                }
            }
            .frame(width: 100)
        }
    }

    private func typeChip(_ type: String) -> some View {
        let c = EdgeOneJSON.typeColor(type)
        return Text(type)
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .foregroundColor(c)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(c.opacity(0.15))
            .cornerRadius(6)
    }

    private func cell(_ text: String, width: CGFloat?) -> some View {
        Text(text.isEmpty ? "—" : text)
            .font(.system(size: 12))
            .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
            .lineLimit(1)
            .truncationMode(.middle)
            .frame(width: width, alignment: .leading)
            .frame(maxWidth: width == nil ? .infinity : width, alignment: .leading)
            .help(text)
    }

    private func actionBtn(_ icon: String, color: Color, tip: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(color)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: 6).fill(color.opacity(0.12)))
        }
        .buttonStyle(PlainButtonStyle())
        .help(tip)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.danger)
            Text(text).font(.system(size: 12))
            Spacer()
            Button("密钥配置") { model.openConfig() }
                .buttonStyle(PlainButtonStyle())
            Button("重试") {
                Task { await model.loadZones(selectFirst: true) }
            }
            .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(8)
    }
}
