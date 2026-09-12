import SwiftUI
import AppKit

/// 原生安全管理（对齐 Web `/system/settings` · `system_settings.ftl`）。
/// 布局遵循质量管理页 UI 标准：`ModuleSettingsCard` + `EqualHeightCardRow`。
struct SecuritySettingsView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = SecuritySettingsViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    // 各行按内容量分级等高，消除死板 500px 导致的巨大留白
    private let row1MinHeight: CGFloat = 380
    private let row2MinHeight: CGFloat = 300
    private let row3MinHeight: CGFloat = 190

    // MARK: - 校验属性（落实第五章表单按钮禁用规范）

    private var isLogoValid: Bool {
        let trimmed = model.siteLogoName.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= 15
    }

    private var isAccountValid: Bool {
        let hasCurr = !model.currentPassword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasNewUser = !model.newUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasNewPass = !model.newPassword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let passMatch = model.newPassword.isEmpty || (model.newPassword.count >= 8 && model.newPassword == model.confirmPassword)
        return hasCurr && (hasNewUser || hasNewPass) && passMatch
    }

    private var isGithubUserValid: Bool {
        !model.github.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var isGithubValid: Bool {
        let hasClientId = !model.github.clientId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasSecret = !model.github.clientSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasUri = !model.github.redirectUri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasClientId && hasSecret && hasUri
    }

    private var isGoogleValid: Bool {
        let hasEmail = !model.google.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasClientId = !model.google.clientId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasSecret = !model.google.clientSecret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasUri = !model.google.redirectUri.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasEmail && hasClientId && hasSecret && hasUri
    }

    private var isTurnstileValid: Bool {
        let hasSite = !model.turnstile.siteKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasSecret = !model.turnstile.secretKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasSite && hasSecret
    }

    private var isMfaValid: Bool {
        !model.mfa.issuer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func confirmSaveLogo() {
        let name = model.siteLogoName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isLogoValid else { return }
        let ok = AppAlert.confirm(
            title: "更新站点 Logo",
            message: "确认将站点名称更新为「\(name)」？",
            confirmTitle: "保存"
        )
        guard ok else { return }
        model.saveLogo()
    }

    private func copyToClipboard(_ text: String, label: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            ToastCenter.shared.warn("内容为空")
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(trimmed, forType: .string)
        ToastCenter.shared.success("已复制 \(label)")
    }

    var body: some View {
        PageScaffold(
            title: "系统设置",
            subtitle: "账号安全 · OAuth · MFA · 验证码 · 频道通知",
            systemImage: "gearshape",
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
                                accountCard
                            } second: {
                                githubCard
                            }
                            EqualHeightCardRow(minHeight: row2MinHeight) {
                                googleCard
                            } second: {
                                mfaCard
                            }
                            EqualHeightCardRow(minHeight: row3MinHeight) {
                                turnstileCard
                            } second: {
                                channelCard
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
        .sheet(isPresented: $model.isMfaSheetPresented) {
            MfaSetupSheet(model: model)
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

    // MARK: - Account

    private var accountCard: some View {
        ModuleSettingsCard(
            title: "账号安全",
            subtitle: "用户名 / 密码 / 站点 Logo",
            systemImage: "lock.shield",
            accent: AppTheme.info,
            enabled: nil,
            minHeight: row1MinHeight
        ) {
            FormFieldRow(label: "当前用户") {
                AppTextField(text: .constant(model.currentUsername), placeholder: "—")
                    .disabled(true)
                    .opacity(0.85)
            }
            FormFieldRow(label: "Logo") {
                HStack(spacing: 8) {
                    AppTextField(text: $model.siteLogoName, placeholder: "OCI-POOL")
                    AppButton(
                        title: "保存",
                        systemImage: "checkmark",
                        kind: .info,
                        isLoading: model.savingKey == "logo",
                        enabled: isLogoValid
                    ) {
                        confirmSaveLogo()
                    }
                }
            }
            FormFieldRow(label: "当前密码 *") {
                AppTextField(
                    text: $model.currentPassword,
                    placeholder: "验证当前密码",
                    secure: true,
                    leadingSystemImage: "key"
                )
            }
            FormFieldRow(label: "新用户名") {
                AppTextField(
                    text: $model.newUsername,
                    placeholder: "留空则不修改",
                    leadingSystemImage: "person"
                )
            }
            FormFieldRow(label: "新密码") {
                AppTextField(
                    text: $model.newPassword,
                    placeholder: "至少 8 位 · 留空则不修改",
                    secure: true,
                    leadingSystemImage: "lock"
                )
            }
            FormFieldRow(label: "确认新密码") {
                AppTextField(
                    text: $model.confirmPassword,
                    placeholder: "再次输入新密码",
                    secure: true,
                    leadingSystemImage: "lock"
                )
            }
        } footer: {
            AppButton(
                title: "保存修改",
                systemImage: "square.and.arrow.down",
                kind: .primary,
                isLoading: model.savingKey == "account",
                enabled: isAccountValid
            ) {
                model.updateAccount()
            }
        }
    }

    // MARK: - GitHub

    private var githubCard: some View {
        ModuleSettingsCard(
            title: "GitHub 登录",
            subtitle: "OAuth 第三方登录",
            systemImage: "chevron.left.slash.chevron.right",
            accent: Color(hex: "adbac7"),
            enabled: $model.github.enabled,
            minHeight: row1MinHeight
        ) {
            FormFieldRow(label: "GitHub 用户名") {
                HStack(spacing: 8) {
                    AppTextField(
                        text: $model.github.username,
                        placeholder: "GitHub 用户名",
                        leadingSystemImage: "person.crop.circle"
                    )
                    AppButton(
                        title: "获取 ID",
                        systemImage: "magnifyingglass",
                        kind: .info,
                        isLoading: model.savingKey == "githubFetch",
                        enabled: isGithubUserValid
                    ) {
                        model.fetchGithubId()
                    }
                }
            }
            FormFieldRow(label: "GitHub ID") {
                AppTextField(text: $model.github.githubId, placeholder: "自动获取")
                    .disabled(true)
                    .opacity(0.9)
            }
            FormFieldRow(label: "Client ID *") {
                AppTextField(text: $model.github.clientId, placeholder: "OAuth App Client ID")
            }
            FormFieldRow(label: "Client Secret *") {
                AppTextField(text: $model.github.clientSecret, placeholder: "Client Secret", secure: true)
            }
            FormFieldRow(label: "回调地址 *") {
                HStack(spacing: 8) {
                    AppTextField(
                        text: $model.github.redirectUri,
                        placeholder: "http(s)://your-domain/api/github/callback"
                    )
                    AppButton(
                        title: "复制",
                        systemImage: "doc.on.doc",
                        kind: .secondary
                    ) {
                        copyToClipboard(model.github.redirectUri, label: "GitHub 回调地址")
                    }
                }
            }
        } footer: {
            AppButton(
                title: "保存配置",
                systemImage: "square.and.arrow.down",
                kind: .primary,
                isLoading: model.savingKey == "github",
                enabled: isGithubValid
            ) {
                model.saveGithub()
            }
        }
    }

    // MARK: - Google

    private var googleCard: some View {
        ModuleSettingsCard(
            title: "Google 登录",
            subtitle: "Google OAuth 登录",
            systemImage: "g.circle",
            accent: Color(hex: "4285f4"),
            enabled: $model.google.enabled,
            minHeight: row2MinHeight
        ) {
            FormFieldRow(label: "Google 邮箱 *") {
                AppTextField(
                    text: $model.google.email,
                    placeholder: "允许登录的 Google 邮箱",
                    leadingSystemImage: "envelope"
                )
            }
            FormFieldRow(label: "Client ID *") {
                AppTextField(text: $model.google.clientId, placeholder: "Google Client ID")
            }
            FormFieldRow(label: "Client Secret *") {
                AppTextField(text: $model.google.clientSecret, placeholder: "Client Secret", secure: true)
            }
            FormFieldRow(label: "回调地址 *") {
                HStack(spacing: 8) {
                    AppTextField(
                        text: $model.google.redirectUri,
                        placeholder: "http(s)://your-domain/api/google/callback"
                    )
                    AppButton(
                        title: "复制",
                        systemImage: "doc.on.doc",
                        kind: .secondary
                    ) {
                        copyToClipboard(model.google.redirectUri, label: "Google 回调地址")
                    }
                }
            }
        } footer: {
            AppButton(
                title: "保存配置",
                systemImage: "square.and.arrow.down",
                kind: .primary,
                isLoading: model.savingKey == "google",
                enabled: isGoogleValid
            ) {
                model.saveGoogle()
            }
        }
    }

    // MARK: - MFA

    private var mfaCard: some View {
        let isMfaActivated = model.mfa.enabled && !model.mfa.secretKey.isEmpty

        return ModuleSettingsCard(
            title: "MFA 多因子认证",
            subtitle: "TOTP 多因子认证",
            systemImage: "iphone",
            accent: Color(hex: "1abc9c"),
            enabled: $model.mfa.enabled,
            minHeight: row2MinHeight
        ) {
            FormFieldRow(label: "应用名称 *") {
                AppTextField(
                    text: $model.mfa.issuer,
                    placeholder: "认证器中显示的名称"
                )
            }

            // 设备绑定状态（主卡片恒定展示，必须完成第三步动态码验证才算真正激活绑定）
            FormFieldRow(label: "设备绑定状态") {
                if isMfaActivated {
                    HStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 13))
                                .foregroundColor(AppTheme.sidebarActive)
                            Text("已绑定 TOTP 认证器")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(AppTheme.sidebarActive)
                        }
                        Spacer()
                        Text(model.mfa.secretKey.prefix(4) + "••••••••" + model.mfa.secretKey.suffix(4))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(AppTheme.textTertiary(dark))
                        AppButton(
                            title: "复制",
                            systemImage: "doc.on.doc",
                            kind: .secondary
                        ) {
                            model.copyMfaSecret()
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(AppTheme.sidebarActive.opacity(0.12))
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(AppTheme.sidebarActive.opacity(0.35), lineWidth: 1)
                    )
                } else {
                    HStack(spacing: 6) {
                        Image(systemName: "info.circle")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.textTertiary(dark))
                        Text("尚未完成动态验证绑定。点击下方「配置向导」扫码并在第三步完成验证以激活。")
                            .font(.system(size: 11.5))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.bg3(dark))
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(AppTheme.border(dark), lineWidth: 1)
                    )
                }
            }
        } footer: {
            HStack(spacing: 8) {
                if isMfaActivated {
                    AppButton(
                        title: "删除",
                        systemImage: "trash",
                        kind: .danger,
                        isLoading: model.savingKey == "mfaDelete"
                    ) {
                        model.deleteMfa()
                    }
                }

                AppButton(
                    title: isMfaActivated ? "重新配置" : "配置向导",
                    systemImage: isMfaActivated ? "arrow.clockwise" : "qrcode",
                    kind: .info,
                    isLoading: model.savingKey == "mfaRegen"
                ) {
                    model.openMfaWizard()
                }

                Spacer()

                AppButton(
                    title: "保存配置",
                    systemImage: "square.and.arrow.down",
                    kind: .primary,
                    isLoading: model.savingKey == "mfa",
                    enabled: isMfaValid
                ) {
                    model.saveMfa()
                }
            }
        }
    }

    // MARK: - Turnstile

    private var turnstileCard: some View {
        ModuleSettingsCard(
            title: "Cloudflare Turnstile 验证码",
            subtitle: "登录人机验证",
            systemImage: "shield.lefthalf.fill",
            accent: AppTheme.orange,
            enabled: $model.turnstile.enabled,
            minHeight: row3MinHeight
        ) {
            FormFieldRow(label: "Site Key *") {
                AppTextField(text: $model.turnstile.siteKey, placeholder: "公开 Site Key")
            }
            FormFieldRow(label: "Secret Key *") {
                AppTextField(
                    text: $model.turnstile.secretKey,
                    placeholder: "服务端 Secret Key",
                    secure: true
                )
            }
        } footer: {
            AppButton(
                title: "保存配置",
                systemImage: "square.and.arrow.down",
                kind: .primary,
                isLoading: model.savingKey == "turnstile",
                enabled: isTurnstileValid
            ) {
                model.saveTurnstile()
            }
        }
    }

    // MARK: - Channel notify

    private var channelCard: some View {
        ModuleSettingsCard(
            title: "开机频道通知",
            subtitle: "匿名上报机型与区域",
            systemImage: "antenna.radiowaves.left.and.right",
            accent: Color(hex: "9b59b6"),
            enabled: $model.channelNotifyEnabled,
            minHeight: row3MinHeight
        ) {
            Text("开启后，抢机成功会向公共频道上报实例类型与区域，不含账号与 IP 等隐私信息。")
                .font(.system(size: 11.5))
                .foregroundColor(AppTheme.textTertiary(dark))
                .fixedSize(horizontal: false, vertical: true)
            Text("采集：机型、区域。不采集：租户、密钥、IP、用户名。")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textTertiary(dark).opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        } footer: {
            AppButton(
                title: "保存配置",
                systemImage: "square.and.arrow.down",
                kind: .primary,
                isLoading: model.savingKey == "channelNotify"
            ) {
                model.saveChannelNotify()
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

// MARK: - MFA 绑定向导弹窗（方案 1：独立模态向导，保持主卡片紧凑等高）

struct MfaSetupSheet: View {
    @ObservedObject var model: SecuritySettingsViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        AppSheetChrome(
            title: "MFA 绑定向导",
            subtitle: "使用 Google Authenticator / 微软 Authenticator 扫码",
            systemImage: "smartphone",
            width: 480,
            height: 490,
            scrollableContent: true,
            onClose: { model.isMfaSheetPresented = false },
            footer: {
                HStack {
                    Text("提示：未完成步骤 3 动态码验证直接关闭不会激活 MFA")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                    Spacer()
                    AppButton(title: "关闭", kind: .secondary) {
                        model.isMfaSheetPresented = false
                    }
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 10) {
                    // 步骤 1：扫码绑定
                    VStack(alignment: .center, spacing: 6) {
                        Text("步骤 1：打开手机认证器 App 扫描二维码")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(dark ? Color.white.opacity(0.95) : Color.primary)

                        if let img = SecuritySettingsJSON.qrImage(from: model.mfa.qrCodeBase64) {
                            Image(nsImage: img)
                                .resizable()
                                .interpolation(.none)
                                .frame(width: 115, height: 115)
                                .cornerRadius(6)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(AppTheme.border(dark), lineWidth: 1)
                                )
                        } else {
                            ProgressView()
                                .frame(width: 115, height: 115)
                        }

                        Text("支持 Google Authenticator、Microsoft Authenticator、1Password 等")
                            .font(.system(size: 10.5))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(8)
                    .background(AppTheme.sidebarHover(dark))
                    .cornerRadius(8)

                    // 步骤 2：手动密钥复制
                    if !model.mfa.secretKey.isEmpty {
                        FormFieldRow(label: "步骤 2：若无法扫码，可手动复制密钥录入") {
                            HStack(spacing: 8) {
                                AppTextField(text: .constant(model.mfa.secretKey), placeholder: "—")
                                    .disabled(true)
                                AppButton(
                                    title: "复制",
                                    systemImage: "doc.on.doc",
                                    kind: .secondary
                                ) {
                                    model.copyMfaSecret()
                                }
                            }
                        }
                    }

                    // 步骤 3：验证并启用
                    FormFieldRow(label: "步骤 3：输入认证器显示的 6 位动态验证码完成激活") {
                        HStack(spacing: 8) {
                            AppTextField(
                                text: Binding(
                                    get: { model.mfa.verifyCode },
                                    set: { model.setMfaVerifyCode($0) }
                                ),
                                placeholder: "6 位数字",
                                leadingSystemImage: "number",
                                onCommit: { model.verifyMfa() }
                            )
                            AppButton(
                                title: "验证并启用",
                                systemImage: "checkmark",
                                kind: .info,
                                isLoading: model.savingKey == "mfaVerify",
                                enabled: model.mfa.verifyCode.trimmingCharacters(in: .whitespacesAndNewlines).count == 6
                            ) {
                                model.verifyMfa()
                            }
                        }
                    }
                }
            }
        )
    }
}
