import SwiftUI

/// 原生 IP 质量管理（对齐 Web `/system/ipSettings` · `ip_settings.ftl`）。
///
/// **Mac 原生 UI 基准页**：后续设置/配置类页面布局与模块卡片样式以此为准。
/// 规范见 `tasks/macos-ui-standard.md`；组件见 `ModuleSettingsCard` / `EqualHeightCardRow`。
struct IpQualityView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = IpQualityViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    private let cardMinHeight: CGFloat = 380

    var body: some View {
        PageScaffold(
            title: "IP 质量管理",
            subtitle: "IP 质量检测与运营商链路配置 · 保障新分配 IP 的可用性",
            systemImage: "shield",
            iconColor: AppTheme.info,
            toolbar: { toolbar },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let err = model.errorText, !err.isEmpty {
                            errorBanner(err)
                                .padding(.bottom, 4)
                        }
                        // 1 + 3 优雅排版：顶部通栏策略配置 + 底部三大运营商探针并排
                        ipCheckCard
                        carriersRow
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
        .environmentObject(appearance)
    }

    // MARK: - Toolbar

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

    // MARK: - IP check card (通栏全局策略配置)

    private var ipCheckCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 头部：图标 + 标题 + 状态胶囊 + 开关
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.info.opacity(0.14))
                        .frame(width: 32, height: 32)
                    Image(systemName: "shield.checkerboard")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppTheme.info)
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text("IP 质量检测全局配置")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(dark ? Color.white.opacity(0.95) : Color.primary)
                        Text(model.ipCheckEnabled ? "已启用" : "未启用")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(model.ipCheckEnabled ? AppTheme.sidebarActive : AppTheme.textTertiary(dark))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(model.ipCheckEnabled ? AppTheme.sidebarActive.opacity(0.15) : AppTheme.bg3(dark))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(model.ipCheckEnabled ? AppTheme.sidebarActive.opacity(0.35) : AppTheme.border(dark).opacity(0.8), lineWidth: 1)
                            )
                    }
                    Text("定期检测所有实例的公网 IP 质量，确保链路通畅可用")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                }

                Spacer()

                Toggle("", isOn: $model.ipCheckEnabled)
                    .labelsHidden()
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
            }

            Divider()
                .background(AppTheme.border(dark).opacity(0.6))

            // 核心参数：检测周期 + 业务提示 + 保存按钮
            HStack(alignment: .center, spacing: 16) {
                HStack(spacing: 8) {
                    Text("检测周期:")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(dark ? Color.white.opacity(0.85) : Color.primary)

                    SelectMenu(
                        options: model.intervalOptions,
                        selection: Binding(
                            get: { "\(model.checkInterval)" },
                            set: { model.checkInterval = Int($0 ?? "6") ?? 6 }
                        ),
                        placeholder: "选择周期",
                        width: 130,
                        allowClear: false,
                        searchable: false
                    )
                }

                HStack(spacing: 6) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                    Text("按设定小时周期自动执行检测；当所有启用的运营商探针均检测不可达时，系统将自动分配更换新公网 IP。")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .lineLimit(2)
                }

                Spacer(minLength: 12)

                AppButton(
                    title: "保存全局配置",
                    systemImage: "square.and.arrow.down",
                    kind: .primary,
                    isLoading: model.savingKey == "ipCheck"
                ) {
                    model.saveIpCheck()
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border(dark).opacity(0.8), lineWidth: 1)
        )
    }

    // MARK: - Carriers row (三大运营商并排)

    private var carriersRow: some View {
        HStack(alignment: .top, spacing: 12) {
            vpsCard(.telecom)
            vpsCard(.unicom)
            vpsCard(.mobile)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - VPS card

    private func vpsCard(_ carrier: IpCarrier) -> some View {
        let binding = model.binding(for: carrier)
        let hasHost = !binding.serverIp.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasUser = !binding.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let canSubmit = hasHost && hasUser

        let accent: Color = {
            switch carrier {
            case .telecom: return AppTheme.sidebarActive // 绿色
            case .unicom: return AppTheme.orange        // 橙色
            case .mobile: return AppTheme.danger        // 红色
            }
        }()

        return ModuleSettingsCard(
            title: carrier.title,
            subtitle: carrier.subtitle,
            systemImage: carrier.systemImage,
            accent: accent,
            enabled: Binding(
                get: { model.binding(for: carrier).enabled },
                set: { newVal in
                    var v = model.binding(for: carrier)
                    v.enabled = newVal
                    model.update(carrier, v)
                }
            ),
            minHeight: 330
        ) {
            FormFieldRow(label: "服务器地址 *") {
                AppTextField(
                    text: Binding(
                        get: { model.binding(for: carrier).serverIp },
                        set: { newVal in
                            var v = model.binding(for: carrier)
                            v.serverIp = newVal
                            model.update(carrier, v)
                        }
                    ),
                    placeholder: "IP 或域名",
                    leadingSystemImage: "server.rack"
                )
            }
            HStack(spacing: 10) {
                FormFieldRow(label: "用户名 *") {
                    AppTextField(
                        text: Binding(
                            get: { model.binding(for: carrier).username },
                            set: { newVal in
                                var v = model.binding(for: carrier)
                                v.username = newVal
                                model.update(carrier, v)
                            }
                        ),
                        placeholder: "root",
                        leadingSystemImage: "person"
                    )
                }
                FormFieldRow(label: "SSH 端口") {
                    AppTextField(
                        text: Binding(
                            get: { "\(model.binding(for: carrier).sshPort)" },
                            set: { newVal in
                                var v = model.binding(for: carrier)
                                let digits = newVal.filter { $0.isNumber }
                                let port = Int(digits) ?? 0
                                v.sshPort = min(max(port == 0 && digits.isEmpty ? 22 : port, 0), 65535)
                                if v.sshPort == 0 { v.sshPort = 22 }
                                model.update(carrier, v)
                            }
                        ),
                        placeholder: "22",
                        leadingSystemImage: "number"
                    )
                }
            }
            FormFieldRow(label: "SSH 密码") {
                AppTextField(
                    text: Binding(
                        get: { model.binding(for: carrier).password },
                        set: { newVal in
                            var v = model.binding(for: carrier)
                            v.password = newVal
                            model.update(carrier, v)
                        }
                    ),
                    placeholder: "留空使用密钥认证",
                    secure: true,
                    leadingSystemImage: "key"
                )
            }
        } footer: {
            HStack(spacing: 8) {
                AppButton(
                    title: "测试连接",
                    systemImage: "zap",
                    kind: .secondary,
                    isLoading: model.savingKey == "test-\(carrier.rawValue)",
                    enabled: canSubmit
                ) {
                    model.testVPS(carrier)
                }
                AppButton(
                    title: "保存配置",
                    systemImage: "square.and.arrow.down",
                    kind: .primary,
                    isLoading: model.savingKey == carrier.rawValue,
                    enabled: canSubmit
                ) {
                    model.saveVPS(carrier)
                }
            }
        }
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.danger)
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.reload() } }
                .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(8)
    }
}
