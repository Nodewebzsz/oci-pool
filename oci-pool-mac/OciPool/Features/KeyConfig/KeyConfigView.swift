import SwiftUI

/// 原生密钥配置（对齐 Web `/system/domainSettings` · `ProxyKeyConfigPage`）。
/// 结构：PageHeader(图标 key · orange) → 分组容器「域名服务商配置」→ 3 卡网格（CF / EO / 更多服务商占位）。
struct KeyConfigView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = KeyConfigViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "Token 配置",
            subtitle: "域名服务商配置 · 管理 DNS/CDN 服务商的 API 秘钥",
            systemImage: "key",
            iconColor: AppTheme.orange,
            toolbar: { toolbar },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        if let err = model.errorText, !err.isEmpty {
                            errorBanner(err)
                        }
                        providerGroup
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .appLoading(model.isLoading)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
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

    // MARK: - 分组容器（Web：bg-1 · border · radius 8 · padding 16 · 组标题 globe info）

    private var providerGroup: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(AppTheme.info)
                Text("域名服务商配置")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
            }
            // 3 卡并排：CF + EO + 占位（Web .provider-grid: repeat(3,1fr) gap 12）
            HStack(alignment: .top, spacing: 12) {
                providerCard(
                    name: "Cloudflare",
                    icon: "cloud",
                    iconColor: AppTheme.orange,
                    enabled: $model.cloudflare.enabled,
                    fields: {
                        secretField(
                            label: "API Key",
                            text: $model.cloudflare.apiToken,
                            placeholder: "输入 Cloudflare API Key",
                            hint: "在 Cloudflare Dashboard > My Profile > API Keys 中创建"
                        )
                        inputField(
                            label: "邮箱地址",
                            text: $model.cloudflare.email,
                            placeholder: "your@email.com",
                            hint: "用于某些 API 操作的身份验证",
                            mono: true
                        )
                    },
                    footer: {
                        AppButton(title: "测试连接", systemImage: "bolt", kind: .info,
                                  isLoading: model.savingKey == "cf-test") {
                            model.testCloudflare()
                        }
                        AppButton(title: "保存配置", systemImage: "square.and.arrow.down", kind: .primary,
                                  isLoading: model.savingKey == "cf-save") {
                            model.saveCloudflare()
                        }
                    }
                )
                providerCard(
                    name: "腾讯云 EdgeOne",
                    icon: "drop.fill",
                    iconColor: AppTheme.info,
                    enabled: $model.edgeOne.enabled,
                    fields: {
                        secretField(
                            label: "SecretId",
                            text: $model.edgeOne.secretId,
                            placeholder: "输入腾讯云 SecretId",
                            hint: "在腾讯云控制台 > 访问管理 > API 密钥管理中获取"
                        )
                        secretField(
                            label: "SecretKey",
                            text: $model.edgeOne.secretKey,
                            placeholder: "输入腾讯云 SecretKey",
                            hint: "SecretKey 用于 API 签名，请妥善保管"
                        )
                    },
                    footer: {
                        AppButton(title: "测试连接", systemImage: "bolt", kind: .info,
                                  isLoading: model.savingKey == "eo-test") {
                            model.testEdgeOne()
                        }
                        AppButton(title: "保存配置", systemImage: "square.and.arrow.down", kind: .primary,
                                  isLoading: model.savingKey == "eo-save") {
                            model.saveEdgeOne()
                        }
                    }
                )
                comingSoonCard
            }
        }
        .padding(16)
        .background(AppTheme.sidebarBg(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
    }

    // MARK: - 服务商卡（Web ProviderHeader + 表单体 + footer 右对齐按钮）

    private func providerCard<Fields: View, Footer: View>(
        name: String,
        icon: String,
        iconColor: Color,
        enabled: Binding<Bool>,
        @ViewBuilder fields: () -> Fields,
        @ViewBuilder footer: () -> Footer
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // ProviderHeader：icon 26(22% 底) + 名称 + 连接徽章 + 启用开关
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 5)
                        .fill(iconColor.opacity(0.22))
                        .frame(width: 26, height: 26)
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(iconColor)
                }
                Text(name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                connectedBadge(connected: enabled.wrappedValue)
                Spacer(minLength: 8)
                Toggle("", isOn: enabled)
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
                    .labelsHidden()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)

            VStack(alignment: .leading, spacing: 12) {
                fields()
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            // footer：上边框 bg-1 · 按钮右对齐
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                footer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AppTheme.sidebarBg(dark))
            .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .top)
        }
        .frame(maxWidth: .infinity, minHeight: 340, alignment: .top)
        .background(AppTheme.sidebarHover(dark))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
        .cornerRadius(8)
        .opacity(enabled.wrappedValue ? 1 : 0.6)
        .animation(.easeInOut(duration: 0.2), value: enabled.wrappedValue)
    }

    /// 连接徽章：accent-soft/danger-soft 底 + 描边 + 圆点
    private func connectedBadge(connected: Bool) -> some View {
        let color = connected ? AppTheme.sidebarActive : AppTheme.danger
        return HStack(spacing: 4) {
            Circle().fill(color).frame(width: 5, height: 5)
            Text(connected ? "已连接" : "未连接")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundColor(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(
            Capsule().fill(connected ? AppearanceController.shared.accent.accentSoft(dark) : AppTheme.dangerSoft(dark))
        )
        .overlay(Capsule().stroke(color, lineWidth: 1))
    }

    /// 密码型字段：label(12 fg-1)+红* → 安全输入 + 复制钮 → hint(10.5 fg-3)
    private func secretField(label: String, text: Binding<String>, placeholder: String, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Text("*")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.danger)
            }
            HStack(spacing: 8) {
                AppTextField(text: text, placeholder: placeholder, secure: true)
                Button {
                    model.copy(text.wrappedValue, label: label)
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarActive)
                        .frame(width: 30, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.sidebarActive.opacity(0.12))
                        )
                }
                .buttonStyle(PlainButtonStyle())
                .help("复制")
            }
            Text(hint)
                .font(.system(size: 10.5))
                .foregroundColor(AppTheme.textTertiary(dark))
        }
    }

    /// 普通输入字段（Web 邮箱输入为 mono）
    private func inputField(label: String, text: Binding<String>, placeholder: String, hint: String, mono: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
                Text("*")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.danger)
            }
            AppTextField(text: text, placeholder: placeholder)
            Text(hint)
                .font(.system(size: 10.5))
                .foregroundColor(AppTheme.textTertiary(dark))
        }
    }

    /// 占位卡：虚线边框 + 圆形加号 + 更多服务商/敬请期待...
    private var comingSoonCard: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(AppTheme.bg3(dark))
                    .frame(width: 44, height: 44)
                Text("+")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundColor(AppTheme.textTertiary(dark))
            }
            Text("更多服务商")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(AppTheme.textSecondary(dark))
            Text("敬请期待...")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textTertiary(dark))
        }
        .frame(maxWidth: .infinity, minHeight: 340, maxHeight: .infinity, alignment: .center)
        .padding(40)
        .background(AppTheme.sidebarHover(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark).opacity(1.6), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
        )
        .cornerRadius(8)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 14))
            Text(text).font(.system(size: 12))
            Spacer()
        }
        .foregroundColor(AppTheme.danger)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(AppTheme.dangerSoft(dark))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.danger, lineWidth: 1))
        .cornerRadius(6)
    }
}
