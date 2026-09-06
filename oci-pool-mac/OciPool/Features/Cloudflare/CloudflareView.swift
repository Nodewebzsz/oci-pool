import SwiftUI

/// 原生 Cloudflare DNS 管理（对齐 Web `/dns/cloudflare` · `cf_manage.ftl`）。
struct CloudflareView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = CloudflareViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "CF 管理",
            subtitle: "Cloudflare · DNS 记录管理与代理配置",
            systemImage: "globe",
            iconColor: AppTheme.orange,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                    searchBar
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 12)
                    listBody
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .appLoading((model.isLoading || model.isZonesLoading) && model.records.isEmpty && model.zones.isEmpty)
            },
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.loadZones(selectFirst: false); await model.reloadRecords() }
        }
        .sheet(item: $model.dnsForm) { _ in
            CloudflareDnsSheet(model: model)
                .environmentObject(appearance)
        }
        .sheet(item: $model.configForm) { _ in
            CloudflareConfigSheet(model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    // MARK: - Toolbar

    private var hasZone: Bool { !(model.selectedZoneId ?? "").isEmpty }

    /// Web 页头 actions：域名: label + zone 下拉 220 + 秘钥配置(orange) + 添加记录(primary) + 同步记录(info) + 刷新列表(outline)
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
            AppButton(title: "添加记录", systemImage: "plus", kind: .primary, enabled: hasZone) {
                model.openAdd()
            }
            AppButton(
                title: "同步记录",
                systemImage: "arrow.triangle.2.circlepath",
                kind: .info,
                isLoading: model.isSyncing,
                enabled: hasZone
            ) {
                model.syncRecords()
            }
            AppButton(
                title: "刷新列表",
                systemImage: "arrow.counterclockwise",
                kind: .secondary,
                isLoading: model.isLoading
            ) {
                Task { await model.reloadRecords() }
            }
        }
    }

    // MARK: - Filter

    /// Web 搜索卡（bg-1 border radius 8 padding 10）：按名称: 输入 + 按值: 输入 + 搜索(info) + 清除(danger-soft)
    private var searchBar: some View {
        HStack(spacing: 10) {
            Text("按名称:")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textTertiary(dark))
            SearchField(text: $model.searchName, placeholder: "e.g. www")
            Text("按值:")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textTertiary(dark))
            SearchField(text: $model.searchContent, placeholder: "e.g. 192.9")
            AppButton(title: "搜索", systemImage: "magnifyingglass", kind: .info) {
                ToastCenter.shared.show("匹配 \(model.filteredRecords.count) 条", style: .info)
            }
            AppButton(title: "清除", systemImage: "xmark", kind: .danger,
                      enabled: !model.searchName.isEmpty || !model.searchContent.isEmpty) {
                model.clearSearch()
            }
        }
        .padding(10)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    // MARK: - List

    private var listBody: some View {
        Group {
            if model.selectedZoneId == nil || model.selectedZoneId?.isEmpty == true {
                EmptyStateView(
                    icon: "cloud",
                    title: model.zones.isEmpty ? "暂无可用域名" : "请选择域名",
                    subtitle: model.zones.isEmpty
                        ? "请先在「密钥配置」中填写 Cloudflare API Key，或点击「密钥配置」"
                        : "从上方下拉选择要管理的 Zone",
                    actionTitle: "密钥配置",
                    action: { model.openConfig() }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.filteredRecords.isEmpty && !model.isLoading {
                EmptyStateView(
                    icon: "list.bullet.rectangle",
                    title: model.records.isEmpty ? "暂无 DNS 记录" : "无匹配结果",
                    subtitle: model.records.isEmpty ? "点击「添加记录」创建解析" : "试试其他关键词（仅过滤当前页）",
                    actionTitle: model.records.isEmpty ? "添加记录" : nil,
                    action: model.records.isEmpty ? { model.openAdd() } : nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 0) {
                    // Web 标题条：bg-2 · list 图标 + DNS 记录 + (filtered/total)
                    HStack(spacing: 6) {
                        Image(systemName: "list.bullet")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.textSecondary(dark))
                        Text("DNS 记录")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppTheme.navIcon(dark))
                        Text("(\(model.filteredRecords.count)/\(model.records.count))")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(AppTheme.textTertiary(dark))
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(AppTheme.sidebarHover(dark))
                    .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)

                    DataList {
                        DataListColumnHeader(title: "类型", width: 80)
                        DataListColumnHeader(title: "记录名", width: 200)
                        DataListColumnHeader(title: "记录值", width: nil)
                        DataListColumnHeader(title: "TTL", width: 100)
                        DataListColumnHeader(title: "代理状态", width: 110)
                        DataListColumnHeader(title: "操作", width: 100)
                    } content: {
                        ForEach(model.filteredRecords) { item in
                            DataListRow {
                                row(item)
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

    /// Web 代理状态徽章：仅 A/AAAA/CNAME 显示（🟠 已代理 = orange-soft / ⚪ 仅 DNS = 灰），其他类型「—」
    @ViewBuilder
    private func proxyBadge(_ item: CfDnsRecord) -> some View {
        let badgeTypes = ["A", "AAAA", "CNAME"]
        if badgeTypes.contains(item.type.uppercased()) {
            HStack(spacing: 4) {
                Circle()
                    .fill(item.proxied ? AppTheme.orange : AppTheme.sidebarText(dark).opacity(0.5))
                    .frame(width: 5, height: 5)
                Text(item.proxied ? "已代理" : "仅 DNS")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(item.proxied ? AppTheme.orange : AppTheme.sidebarText(dark))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(item.proxied ? AppTheme.orange.opacity(0.14) : AppTheme.sidebarHover(dark).opacity(0.6))
            )
        } else {
            Text("—")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        }
    }

    private func row(_ item: CfDnsRecord) -> some View {
        HStack(spacing: 0) {
            typeChip(item.type)
                .frame(width: 72, alignment: .leading)
            cell(item.name, width: nil)
            cell(item.content, width: nil)
            cell(CloudflareJSON.formatTTL(item.ttl), width: 72)
            proxyBadge(item)
                .frame(width: 80, alignment: .leading)
            HStack(spacing: 6) {
                Spacer(minLength: 0)
                actionBtn("pencil", color: AppTheme.sidebarActive, tip: "编辑") {
                    model.openEdit(item)
                }
                actionBtn("trash", color: AppTheme.danger, tip: "删除") {
                    model.delete(item)
                }
            }
            .frame(width: 88)
        }
    }

    private func typeChip(_ type: String) -> some View {
        let c = CloudflareJSON.typeColor(type)
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
