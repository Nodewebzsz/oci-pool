import SwiftUI
import AppKit

/// Right form panel — mirrors web AuthPage right side (welcome + form card).
/// Keeps native desktop extras (deployment mode + status) compact so the login
/// page still matches the web layout while fitting the client window height.
struct LoginRightPanel: View {
    @ObservedObject var model: LoginFormModel
    var dark: Bool
    @ObservedObject var backend: BackendController
    var onLogin: () -> Void
    var onRegister: () -> Void
    var onSendCode: () -> Void
    var onOAuth: (String) -> Void
    var onServerCommit: () -> Void = {}
    var onDeploymentMode: (DeploymentMode) -> Void = { _ in }
    var onForgotPassword: () -> Void = {}
    var onLocale: (AppLocale) -> Void = { _ in }

    @State private var backendVersion = ""
    @State private var pageLoadToken = 0

    private var formReady: Bool {
        guard model.modeActivated else { return false }
        if model.isRemoteServer { return true }
        return backend.isReadyForLogin
    }

    /// Only after user picks「本机使用」and backend is still coming up.
    private var showBootLoading: Bool {
        guard model.isLocalActivated else { return false }
        switch backend.state {
        case .idle, .starting: return true
        default: return false
        }
    }

    private var localBootFailed: String? {
        guard model.isLocalActivated else { return nil }
        if case .failed(let m) = backend.state { return m }
        return nil
    }

    private var infoColor: Color { Color(hex: dark ? "818cf8" : "4f46e5") }
    private var dangerColor: Color { Color(hex: "ef4444") }
    private var formFieldEnabled: Bool { formReady && !model.isLoadingMeta && !model.isSubmitting }

    var body: some View {
        ZStack {
            if showBootLoading {
                bootLoadingView
                    .transition(.opacity)
            } else if let fail = localBootFailed {
                bootFailedView(fail)
                    .transition(.opacity)
            } else {
                mainContent
                    .transition(.opacity.combined(with: .offset(y: 6)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LoginPalette.bg(dark))
        .animation(.easeInOut(duration: 0.28), value: showBootLoading)
        .animation(.easeInOut(duration: 0.28), value: localBootFailed != nil)
        .animation(.easeInOut(duration: 0.22), value: model.modeActivated)
        .onAppear { routeLoadVersion() }
        .onChange(of: model.metaLoadedURL) { _ in routeLoadVersion() }
    }

    // MARK: - Boot states

    private var bootLoadingView: some View {
        VStack(spacing: 0) {
            topControls
                .padding(.horizontal, 40)
                .padding(.top, 30)
            Spacer(minLength: 0)
            VStack(spacing: 14) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
                    .scaleEffect(1.55)
                Text(model.locale == .enUS ? "Starting local backend…" : "正在启动本机服务…")
                    .font(.system(size: 14))
                    .foregroundColor(LoginPalette.text(dark))
                Text(model.locale == .enUS
                     ? "Switch to Remote if you already deployed a server"
                     : "若已远程部署，可切换到「远程」")
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.muted(dark))
            }
            Spacer(minLength: 0)
            footer
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func bootFailedView(_ message: String) -> some View {
        VStack(spacing: 0) {
            topControls
                .padding(.horizontal, 40)
                .padding(.top, 30)
            Spacer(minLength: 0)
            VStack(spacing: 14) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 30, weight: .medium))
                    .foregroundColor(Color(hex: "f59e0b"))
                Text(model.locale == .enUS ? "Service failed to start" : "服务启动失败")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(LoginPalette.text(dark))
                Text(message)
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.muted(dark))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 360)
                Text(model.locale == .enUS
                     ? "Or switch to Remote and connect an existing server"
                     : "也可切换到「远程」连接已有服务")
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.muted(dark))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 40)
            Spacer(minLength: 0)
            footer
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Main (web-style)

    private var mainContent: some View {
        VStack(spacing: 0) {
            topControls
                .padding(.horizontal, 40)
                .padding(.top, 30)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    formCard
                }
                .frame(maxWidth: 380)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            footer
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Top controls

    private var topControls: some View {
        HStack {
            deploymentChip
            Spacer()
            languageChip
        }
    }

    private var deploymentChip: some View {
        HStack(spacing: 2) {
            deploySegment(.local, model.locale == .enUS ? "本机" : "本机")
            deploySegment(.remote, model.locale == .enUS ? "远程" : "远程")
        }
        .padding(3)
        .background(LoginPalette.chipBg(dark))
        .cornerRadius(999)
        .overlay(RoundedRectangle(cornerRadius: 999).stroke(LoginPalette.line(dark).opacity(0.6), lineWidth: 1))
    }

    private func deploySegment(_ mode: DeploymentMode, _ title: String) -> some View {
        let selected = model.modeActivated && model.deploymentMode == mode
        return Button(action: { onDeploymentMode(mode) }) {
            HStack(spacing: 5) {
                Image(systemName: mode == .local ? "laptopcomputer" : "cloud")
                    .font(.system(size: 11, weight: .semibold))
                Text(title)
                    .font(.system(size: 11.5, weight: selected ? .bold : .medium))
            }
            .foregroundColor(selected ? LoginPalette.tabActiveText(dark) : LoginPalette.muted(dark))
            .padding(.horizontal, 11)
            .frame(height: 26)
            .background(Capsule().fill(selected ? LoginPalette.tabActiveBg(dark) : Color.clear))
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(model.isSubmitting || model.isLoadingMeta)
    }

    private var languageChip: some View {
        HStack(spacing: 0) {
            langItem(.zhCN, "中文")
            Text("|")
                .font(.system(size: 12))
                .foregroundColor(LoginPalette.line(dark))
                .padding(.horizontal, 6)
            langItem(.enUS, "English")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(LoginPalette.chipBg(dark))
        .cornerRadius(999)
        .overlay(RoundedRectangle(cornerRadius: 999).stroke(LoginPalette.line(dark).opacity(0.6), lineWidth: 1))
    }

    private func langItem(_ loc: AppLocale, _ title: String) -> some View {
        let active = model.locale == loc
        return Button(action: {
            model.locale = loc
            onLocale(loc)
        }) {
            Text(title)
                .font(.system(size: 12, weight: active ? .bold : .regular))
                .foregroundColor(active ? LoginPalette.text(dark) : LoginPalette.muted(dark))
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Form card

    @ViewBuilder
    private var formCard: some View {
        if model.showVerifyStep {
            verifyCard
        } else if model.tab == .register {
            registerCard
        } else {
            loginCard
        }
    }

    // MARK: - Verify step (code shown only after the server asks for it)

    private var verifyCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(title: verifyTitle, subtitle: verifySubtitle)
                .padding(.bottom, 22)

            if model.showVerifyChoice {
                verifyChoice
                    .padding(.bottom, 18)
            }

            if model.showMessageCode {
                messageCodeRow
                    .padding(.bottom, 12)
            }

            if model.showMfaCode {
                fieldLabel(model.locale == .enUS ? "MFA code" : "MFA 验证码")
                LoginField(
                    title: "",
                    placeholder: "6 位动态码",
                    text: $model.mfaCode,
                    dark: dark,
                    enabled: formFieldEnabled,
                    onCommit: onLogin,
                    shakeToken: model.shakeMfa
                )
                .padding(.bottom, 10)
            }

            if let info = model.infoText {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundColor(Color(hex: "22c55e"))
                    Text(info)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(LoginPalette.muted(dark))
                }
                .padding(.bottom, 12)
            }

            if let e = model.errorText {
                Text(e)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(dangerColor)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 12)
            }

            verifySubmitButton

            backToLoginButton
                .padding(.top, 10)
        }
    }

    private var verifyIsMfa: Bool { model.showMfaCode && !model.showMessageCode }
    private var zh: Bool { model.locale == .zhCN || model.locale == .zhTW }

    private var verifyTitle: String {
        verifyIsMfa
            ? (zh ? "双因素认证" : "Two-factor authentication")
            : (zh ? "消息验证码" : "Message verification")
    }

    private var verifySubtitle: String {
        verifyIsMfa
            ? (zh ? "请输入 6 位验证码 · 由你的身份验证器 App 生成" : "Enter the 6-digit code from your authenticator app")
            : (zh ? "请输入通过消息渠道收到的 6 位验证码" : "Enter the 6-digit code from your notification channel")
    }

    private var verifySubmitButton: some View {
        Button(action: onLogin) {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().scaleEffect(0.7).frame(width: 14, height: 14)
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                }
                Text(model.isSubmitting
                     ? (model.locale == .enUS ? "Verifying…" : "验证中…")
                     : (model.locale == .enUS ? "Verify" : "验证"))
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundColor(.white)
            .background(LoginPalette.primary(dark))
            .cornerRadius(8)
        }
        .buttonStyle(LoginPressButtonStyle())
        .disabled(!model.canAttemptLogin(backendReady: formReady))
        .opacity(model.canAttemptLogin(backendReady: formReady) ? 1 : 0.55)
    }

    private var backToLoginButton: some View {
        Button(action: { model.leaveVerifyStep() }) {
            HStack(spacing: 5) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .medium))
                Text(model.locale == .enUS ? "Back to sign in" : "返回登录")
                    .font(.system(size: 12))
            }
            .foregroundColor(LoginPalette.muted(dark))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var loginCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(title: model.locale == .enUS ? "Welcome back" : "欢迎回来",
                    subtitle: model.locale == .enUS ? "Sign in to your OCI-POOL account" : "登录你的 OCI-POOL 管理账号")
                .padding(.bottom, 26)

            fieldLabel(model.locale == .enUS ? "Username" : "用户名")
            LoginField(
                title: "",
                placeholder: model.locale == .enUS ? "Enter username" : "请输入用户名",
                text: $model.username,
                dark: dark,
                enabled: formFieldEnabled,
                onCommit: onLogin,
                shakeToken: model.shakeUsername
            )
            .padding(.bottom, 14)

            passwordLabelRow
            LoginField(
                title: "",
                placeholder: model.locale == .enUS ? "Enter password" : "请输入密码",
                text: $model.password,
                secure: true,
                dark: dark,
                enabled: formFieldEnabled,
                onCommit: onLogin,
                shakeToken: model.shakePassword,
                isFocusedOut: $model.passwordFocused
            )
            .padding(.bottom, 10)

            statusLine
                .padding(.bottom, 12)

            rememberRow
                .padding(.bottom, 18)

            loginPrimaryButton

            HStack(spacing: 4) {
                Text(model.locale == .enUS ? "No account yet?" : "还没有账号？")
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.muted(dark))
                Button(action: { withAnimation(.easeInOut(duration: 0.18)) { model.tab = .register; model.errorText = nil } }) {
                    Text(model.locale == .enUS ? "Sign up now" : "立即注册")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(LoginPalette.primary(dark))
                }
                .buttonStyle(PlainButtonStyle())
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 14)

            adminNotice
                .padding(.top, 18)

            if model.githubEnabled || model.googleEnabled {
                orDivider
                    .padding(.top, 22)
                oauthRow
                    .padding(.top, 14)
            }
        }
    }

    private var registerCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(title: model.locale == .enUS ? "Create account" : "注册账号",
                    subtitle: model.locale == .enUS ? "Register your first OCI-POOL account" : "创建你的 OCI-POOL 管理账号")
                .padding(.bottom, 26)

            fieldLabel(model.locale == .enUS ? "Username" : "用户名")
            LoginField(
                title: "",
                placeholder: "请输入用户名",
                text: $model.username,
                dark: dark,
                enabled: formFieldEnabled,
                shakeToken: model.shakeUsername
            )
            .padding(.bottom, 14)

            fieldLabel(model.locale == .enUS ? "Password" : "密码")
            LoginField(
                title: "",
                placeholder: "请输入密码",
                text: $model.password,
                secure: true,
                dark: dark,
                enabled: formFieldEnabled,
                shakeToken: model.shakePassword,
                isFocusedOut: $model.passwordFocused
            )
            .padding(.bottom, 14)

            fieldLabel(model.locale == .enUS ? "Confirm password" : "确认密码")
            LoginField(
                title: "",
                placeholder: "再次输入密码",
                text: $model.confirmPassword,
                secure: true,
                dark: dark,
                enabled: formFieldEnabled,
                onCommit: onRegister,
                shakeToken: model.shakeConfirm,
                isFocusedOut: $model.passwordFocused
            )
            .padding(.bottom, 10)

            statusLine
                .padding(.bottom, 12)

            registerPrimaryButton

            HStack(spacing: 4) {
                Text(model.locale == .enUS ? "Already have an account?" : "已有账号？")
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.muted(dark))
                Button(action: { withAnimation(.easeInOut(duration: 0.18)) { model.tab = .login; model.errorText = nil } }) {
                    Text(model.locale == .enUS ? "Sign in" : "去登录")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(LoginPalette.primary(dark))
                }
                .buttonStyle(PlainButtonStyle())
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 14)
        }
    }

    // MARK: - Pieces

    private func heading(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(LoginPalette.text(dark))
                .tracking(-0.3)
            Text(subtitle)
                .font(.system(size: 12.5))
                .foregroundColor(LoginPalette.muted(dark))
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(LoginPalette.muted(dark))
            .padding(.bottom, 6)
    }

    private var passwordLabelRow: some View {
        HStack {
            Text(model.locale == .enUS ? "Password" : "密码")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(LoginPalette.muted(dark))
            Spacer()
            Button(action: onForgotPassword) {
                Text(model.locale == .enUS ? "Forgot password?" : "忘记密码？")
                    .font(.system(size: 11))
                    .foregroundColor(infoColor)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.bottom, 6)
    }

    private var rememberRow: some View {
        Button(action: { model.rememberMe.toggle() }) {
            HStack(spacing: 8) {
                Image(systemName: model.rememberMe ? "checkmark.square.fill" : "square")
                    .font(.system(size: 14))
                    .foregroundColor(model.rememberMe ? LoginPalette.primary(dark) : LoginPalette.muted(dark))
                Text(model.locale == .enUS ? "Remember me for 30 days" : "记住我 30 天")
                    .font(.system(size: 12))
                    .foregroundColor(LoginPalette.text(dark))
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var loginPrimaryButton: some View {
        Button(action: onLogin) {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().scaleEffect(0.7).frame(width: 14, height: 14)
                } else {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 14, weight: .semibold))
                }
                Text(loginButtonTitle)
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundColor(.white)
            .background(LoginPalette.primary(dark))
            .cornerRadius(8)
        }
        .buttonStyle(LoginPressButtonStyle())
        .disabled(!model.canAttemptLogin(backendReady: formReady))
        .opacity(model.canAttemptLogin(backendReady: formReady) ? 1 : 0.55)
    }

    private var loginButtonTitle: String {
        if model.isSubmitting {
            return model.locale == .enUS ? "Signing in…" : "登录中…"
        }
        return model.locale == .enUS ? "Sign in" : "登录"
    }

    private var registerPrimaryButton: some View {
        Button(action: onRegister) {
            HStack(spacing: 8) {
                if model.isSubmitting {
                    ProgressView().scaleEffect(0.7).frame(width: 14, height: 14)
                } else {
                    Image(systemName: "user.plus")
                        .font(.system(size: 14, weight: .semibold))
                }
                Text(model.isSubmitting
                     ? (model.locale == .enUS ? "Registering…" : "注册中…")
                     : (model.locale == .enUS ? "Register" : "注册"))
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundColor(.white)
            .background(LoginPalette.primary(dark))
            .cornerRadius(8)
        }
        .buttonStyle(LoginPressButtonStyle())
        .disabled(!model.canAttemptRegister(backendReady: formReady))
        .opacity(model.canAttemptRegister(backendReady: formReady) ? 1 : 0.55)
    }

    @ViewBuilder
    private var statusLine: some View {
        if let e = model.errorText {
            Text(e)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(dangerColor)
                .fixedSize(horizontal: false, vertical: true)
        } else if let info = model.infoText {
            Text(info)
                .font(.system(size: 12))
                .foregroundColor(LoginPalette.muted(dark))
        } else if model.modeActivated, !model.isRemoteServer, model.metaLoadedURL != nil, !model.isLoadingMeta {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "22c55e"))
                Text(model.locale == .enUS ? "Local backend ready" : "本机服务已就绪，请登录")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(LoginPalette.muted(dark))
            }
        }
    }

    private var adminNotice: some View {
        HStack(alignment: .center, spacing: 8) {
            Image(systemName: "info.circle")
                .font(.system(size: 13))
                .foregroundColor(infoColor)
            Text(model.locale == .enUS ? "Sign in with the admin account you created on first run" : "使用您首次注册的管理员账号登录")
                .font(.system(size: 11))
                .foregroundColor(LoginPalette.text(dark))
                .lineSpacing(1.5)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: dark ? "1e1b4b" : "eef2ff").opacity(dark ? 0.45 : 0.8))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(infoColor, style: StrokeStyle(lineWidth: 1, dash: [6, 3]))
        )
        .cornerRadius(6)
    }

    private var orDivider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(LoginPalette.line(dark)).frame(height: 1)
            Text(model.locale == .enUS ? "or continue with" : "或使用以下方式")
                .font(.system(size: 11))
                .foregroundColor(LoginPalette.muted(dark))
            Rectangle().fill(LoginPalette.line(dark)).frame(height: 1)
        }
    }

    private var oauthRow: some View {
        HStack(spacing: 12) {
            if model.githubEnabled {
                oauthButton(title: "GitHub", icon: "chevron.left.forwardslash.chevron.right", action: { onOAuth("github") })
            }
            if model.googleEnabled {
                oauthButton(title: "Google", icon: "g.circle", action: { onOAuth("google") })
            }
        }
    }

    private func oauthButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundColor(LoginPalette.text(dark))
            .background(LoginPalette.oauthBg(dark))
            .cornerRadius(8)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(LoginPalette.oauthBorder(dark), lineWidth: 1))
        }
        .buttonStyle(LoginPressButtonStyle())
    }

    // MARK: - Verify

    private var verifyChoice: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(model.locale == .enUS ? "Verification" : "验证方式")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(LoginPalette.text(dark))
            HStack(spacing: 8) {
                verifyTab(model.locale == .enUS ? "Message code" : "消息验证码", selected: model.verifyMethod == .message) {
                    model.verifyMethod = .message
                    model.mfaCode = ""
                }
                verifyTab("MFA", selected: model.verifyMethod == .mfa) {
                    model.verifyMethod = .mfa
                    model.verificationCode = ""
                }
                Spacer()
            }
        }
    }

    private func verifyTab(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: selected ? .bold : .medium))
                .foregroundColor(selected ? LoginPalette.tabActiveText(dark) : LoginPalette.text(dark))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(selected ? LoginPalette.tabActiveBg(dark) : Color.clear)
                .cornerRadius(999)
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var messageCodeRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel(model.locale == .enUS ? "Verification code" : "验证码")
            HStack(alignment: .center, spacing: 12) {
                LoginField(
                    title: "",
                    placeholder: model.locale == .enUS ? "Code" : "消息验证码",
                    text: $model.verificationCode,
                    dark: dark,
                    enabled: formFieldEnabled,
                    onCommit: onLogin,
                    shakeToken: model.shakeVerify
                )
                LoginFieldActionButton(
                    title: model.codeCountdown > 0
                        ? "\(model.codeCountdown)s"
                        : (model.isSendingCode
                           ? (model.locale == .enUS ? "Sending" : "发送中")
                           : (model.locale == .enUS ? "Send code" : "发送验证码")),
                    loading: model.isSendingCode,
                    enabled: formReady && !model.isLoadingMeta && model.codeCountdown == 0
                        && !model.username.trimmingCharacters(in: .whitespaces).isEmpty,
                    dark: dark,
                    minWidth: 118,
                    action: onSendCode
                )
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        Text("\(backendVersion.isEmpty ? "" : "v\(backendVersion) · ")MIT · Nodewebzsz/oci-pool")
            .font(.system(size: 10.5, weight: .regular, design: .monospaced))
            .foregroundColor(LoginPalette.muted(dark))
            .frame(maxWidth: .infinity)
    }

    // MARK: - Version fetch

    private func routeLoadVersion() {
        pageLoadToken += 1
        let token = pageLoadToken
        Task {
            await loadBackendVersion(token: token)
        }
    }

    private func loadBackendVersion(token: Int) async {
        let base = model.serverURL
        guard let url = URL(string: base)?.appendingPathComponent("api/version/check") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let cur = obj["currentVersion"] as? String, !cur.isEmpty {
                let v = cur.replacingOccurrences(of: "^[vV]-?", with: "", options: .regularExpression)
                if token == pageLoadToken {
                    await MainActor.run { backendVersion = v }
                }
            }
        } catch {}
    }
}
