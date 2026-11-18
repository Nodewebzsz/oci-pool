import Foundation
import Combine

/// Local embedded backend vs already-deployed remote server.
enum DeploymentMode: String, CaseIterable {
    case local
    case remote

    var isRemote: Bool { self == .remote }
}

/// Authentication + shell chrome state (no business list caches).
/// Not marked @MainActor on the type: AppDelegate must touch `.shared` on the main
/// thread only. Methods that update @Published should run on main.
final class AppSession: ObservableObject {
    static let shared = AppSession()

    static let localDefaultURL = "http://localhost:9856"

    @Published private(set) var isLoggedIn = false
    @Published var lastError: String?
    @Published private(set) var isBusy = false
    @Published private(set) var username: String = ""
    @Published private(set) var siteName: String = "OCI-POOL"
    /// 1 = Oracle, 2 = GCP (align web header provider switch)
    @Published private(set) var cloudProvider: Int = 1
    /// Remembered on disk; login UI can switch smoothly without re-asking each launch.
    @Published private(set) var deploymentMode: DeploymentMode = .local

    private let auth = AuthService()
    private let defaultsKey = "serverURL"
    private let remoteURLKey = "remoteServerURL"
    private let deploymentModeKey = "deploymentMode"
    /// True only after the user has explicitly tapped a deployment option at least once.
    private let deploymentChosenKey = "deploymentModeChosen"
    private let userKey = "lastUsername"
    private let cloudKey = "cloudProvider"

    /// First install / never tapped → false. After user picks once → true (auto-apply next launch).
    var hasChosenDeploymentMode: Bool {
        UserDefaults.standard.bool(forKey: deploymentChosenKey)
    }

    var serverURL: String {
        get {
            let raw = UserDefaults.standard.string(forKey: defaultsKey)
            if let r = raw, !r.isEmpty {
                let n = Self.normalize(r)
                if !n.isEmpty { return n }
            }
            return deploymentMode == .local ? Self.localDefaultURL : ""
        }
        set {
            let normalized = Self.normalize(newValue)
            UserDefaults.standard.set(normalized, forKey: defaultsKey)
            if !normalized.isEmpty && !Self.isLocalServerURL(normalized) {
                UserDefaults.standard.set(normalized, forKey: remoteURLKey)
            }
            objectWillChange.send()
        }
    }

    /// Last non-local URL so switching Local → Remote restores the address.
    var lastRemoteServerURL: String {
        get {
            let raw = Self.normalize(UserDefaults.standard.string(forKey: remoteURLKey) ?? "")
            if raw.isEmpty || raw == "https://" || raw == "http://" || Self.isLocalServerURL(raw) {
                return ""
            }
            return raw
        }
        set {
            let n = Self.normalize(newValue)
            guard !Self.isLocalServerURL(n) else { return }
            UserDefaults.standard.set(n, forKey: remoteURLKey)
        }
    }

    var isRemoteDeployment: Bool { deploymentMode.isRemote }

    var cloudProviderName: String {
        switch cloudProvider {
        case 2: return "Google Cloud"
        case 3: return "Azure"
        case 4: return "AWS"
        default: return "Oracle Cloud"
        }
    }

    private init() {
        username = UserDefaults.standard.string(forKey: userKey) ?? ""
        let stored = UserDefaults.standard.integer(forKey: cloudKey)
        cloudProvider = stored == 0 ? 1 : stored
        deploymentMode = Self.loadDeploymentMode()
        // Keep active URL consistent with remembered mode.
        if deploymentMode == .local, !Self.isLocalServerURL(serverURL) {
            lastRemoteServerURL = serverURL
            UserDefaults.standard.set(Self.localDefaultURL, forKey: defaultsKey)
        } else if deploymentMode == .remote, Self.isLocalServerURL(serverURL) {
            let remote = UserDefaults.standard.string(forKey: remoteURLKey) ?? ""
            if !remote.isEmpty, !Self.isLocalServerURL(remote) {
                UserDefaults.standard.set(Self.normalize(remote), forKey: defaultsKey)
            }
        }
    }

    private static func loadDeploymentMode() -> DeploymentMode {
        if let raw = UserDefaults.standard.string(forKey: "deploymentMode"),
           let mode = DeploymentMode(rawValue: raw) {
            return mode
        }
        // Migrate: infer from previously saved server URL.
        let url = UserDefaults.standard.string(forKey: "serverURL") ?? localDefaultURL
        let mode: DeploymentMode = isLocalServerURL(url) ? .local : .remote
        UserDefaults.standard.set(mode.rawValue, forKey: "deploymentMode")
        if mode == .remote, !isLocalServerURL(url) {
            UserDefaults.standard.set(normalize(url), forKey: "remoteServerURL")
        }
        return mode
    }

    /// Switch deployment mode and align `serverURL`. Does not start/stop Java — caller owns backend lifecycle.
    /// - Parameter userChosen: when true (default), marks that the user has picked a mode (persist for next launch).
    @MainActor
    func setDeploymentMode(_ mode: DeploymentMode, userChosen: Bool = true) {
        if userChosen {
            UserDefaults.standard.set(true, forKey: deploymentChosenKey)
        }
        guard mode != deploymentMode else {
            // Still normalize URL for current mode.
            alignServerURL(for: mode)
            return
        }
        if deploymentMode == .remote, mode == .local {
            if !Self.isLocalServerURL(serverURL) {
                lastRemoteServerURL = serverURL
            }
        }
        deploymentMode = mode
        UserDefaults.standard.set(mode.rawValue, forKey: deploymentModeKey)
        alignServerURL(for: mode)
    }

    @MainActor
    private func alignServerURL(for mode: DeploymentMode) {
        switch mode {
        case .local:
            if !Self.isLocalServerURL(serverURL) {
                lastRemoteServerURL = serverURL
            }
            UserDefaults.standard.set(Self.localDefaultURL, forKey: defaultsKey)
        case .remote:
            if Self.isLocalServerURL(serverURL) {
                let restored = lastRemoteServerURL
                UserDefaults.standard.set(
                    restored.isEmpty ? "" : Self.normalize(restored),
                    forKey: defaultsKey
                )
            }
        }
        objectWillChange.send()
    }

    @MainActor
    func bootstrap() async {
        isBusy = true
        defer { isBusy = false }
        // Always require explicit login on launch.
        // Auto-restore was causing “open → skip login into main” while the shell
        // was still unstable; re-enable only after remember-me UX is intentional.
        isLoggedIn = false
        APIClient.shared.clearCookies(for: serverURL)
        AppDelegate.log("bootstrap: forced login (session restore disabled)")
    }

    @MainActor
    func login(
        username: String,
        password: String,
        verificationCode: String? = nil,
        mfaCode: String? = nil,
        rememberMe: Bool = true
    ) async throws {
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            try await auth.login(
                baseURL: serverURL,
                username: username,
                password: password,
                verificationCode: verificationCode,
                mfaCode: mfaCode,
                rememberMe: rememberMe
            )
            self.username = username
            UserDefaults.standard.set(username, forKey: userKey)
            isLoggedIn = true
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    @MainActor
    func registerFirstUser(username: String, password: String) async throws {
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        try await auth.registerFirstUser(baseURL: serverURL, username: username, password: password)
        // After first register, login immediately
        try await login(username: username, password: password)
    }

    func sendLoginCode(username: String) async throws {
        try await auth.sendVerificationCode(baseURL: serverURL, username: username)
    }

    func fetchLoginPageMeta() async throws -> APIClient.LoginPageMeta {
        try await auth.loginPageMeta(baseURL: serverURL)
    }

    @MainActor
    func logout() async {
        isBusy = true
        defer { isBusy = false }
        // Close main shell first, then hit logout API / clear cookies.
        let base = serverURL
        isLoggedIn = false
        await auth.logout(baseURL: base)
        APIClient.shared.clearCookies(for: base)
    }

    @MainActor
    func forceLogout() {
        isLoggedIn = false
        APIClient.shared.clearCookies(for: serverURL)
    }

    /// Local embedded backend (localhost) vs remote deployment.
    static func isLocalServerURL(_ raw: String) -> Bool {
        let s = normalize(raw)
        if s.isEmpty { return true }
        guard let url = URLComponents(string: s), let host = url.host?.lowercased(),
              url.scheme == "http", url.port == URLComponents(string: localDefaultURL)?.port else {
            return false
        }
        return host == "localhost"
            || host == "127.0.0.1"
            || host == "0.0.0.0"
            || host == "::1"
            || host == "[::1]"
    }

    @MainActor
    func setCloudProvider(_ type: Int) {
        cloudProvider = type
        UserDefaults.standard.set(type, forKey: cloudKey)
        MenuBuilder.rebuildNavigationMenu()
        // Web header: if current page not available for this cloud, go to default landing
        let landing: NavID
        switch type {
        case 2: landing = .gcpAccounts
        case 3: landing = .azureVms
        case 4: landing = .awsEc2
        default: landing = .tenants
        }
        if let item = NavigationCatalog.item(for: NavigationState.shared.selected),
           let allowed = item.cloudTypes,
           !allowed.contains(type) {
            NavigationState.shared.select(landing)
        }
    }

    /// Update username from `/api/userInfo` without re-login.
    func applyRemoteUsername(_ name: String) {
        guard !name.isEmpty else { return }
        let apply = { [weak self] in
            self?.username = name
            UserDefaults.standard.set(name, forKey: self?.userKey ?? "lastUsername")
        }
        if Thread.isMainThread { apply() } else { DispatchQueue.main.async(execute: apply) }
    }

    /// Update site logo name (安全管理页保存 Logo 后刷新顶栏).
    func applySiteName(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if Thread.isMainThread {
            siteName = trimmed
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.siteName = trimmed
            }
        }
    }

    func fetchLoginFactors() async -> APIClient.LoginFactorConfig {
        await auth.loginFactorConfig(baseURL: serverURL)
    }

    static func normalize(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty, s.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else { return "" }
        if !s.contains("://") {
            s = "http://\(s)"
        }
        guard var comps = URLComponents(string: s),
              let scheme = comps.scheme?.lowercased(), ["http", "https"].contains(scheme),
              let host = comps.host?.lowercased(), !host.isEmpty,
              comps.user == nil, comps.password == nil,
              comps.port.map({ (1...65535).contains($0) }) ?? true else { return "" }
        comps.scheme = scheme
        // 兼容历史保存的 localhost.，避免显示、Cookie 与本地模式识别不一致。
        comps.host = host == "localhost." ? "localhost" : host
        // 用户常从浏览器地址栏粘贴带路径的 URL（/login、/index、/tenants…），
        // 若保留 path，后续 makeURL 会拼成 /tenants/boot/... 导致整站 404 Not Found。
        comps.path = ""
        comps.query = nil
        comps.fragment = nil
        return comps.url?.absoluteString ?? ""
    }
}
