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
    @Published private(set) var isRestoringSession = false
    @Published var restoreNotice: String?
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
    private let rememberMePrefKey = "rememberMeEnabled"
    private static let rememberMeDurationSeconds: TimeInterval = 30 * 24 * 60 * 60

    var rememberMePreference: Bool {
        get { UserDefaults.standard.bool(forKey: rememberMePrefKey) }
        set { UserDefaults.standard.set(newValue, forKey: rememberMePrefKey) }
    }

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
        isLoggedIn = false
        restoreNotice = nil

        guard hasChosenDeploymentMode else {
            APIClient.shared.clearCookies(for: serverURL)
            AppDelegate.log("bootstrap: deployment mode not chosen yet")
            return
        }

        let targetMode = deploymentMode
        let targetURL = serverURL
        guard !targetURL.isEmpty,
              let saved = RememberedSessionStore.shared.load(for: targetURL) else {
            APIClient.shared.clearCookies(for: targetURL)
            AppDelegate.log("bootstrap: no remembered session for \(targetURL)")
            return
        }

        isRestoringSession = true
        defer { isRestoringSession = false }
        AppDelegate.log("bootstrap: attempting 30-day session restore mode=\(targetMode.rawValue) url=\(targetURL)")

        if targetMode == .local {
            let ready = await BackendController.shared.ensureStartedAndWait()
            guard ready else {
                AppDelegate.log("bootstrap: local backend failed to start; keep remembered record")
                return
            }
        }

        guard !isLoggedIn, deploymentMode == targetMode, serverURL == targetURL else {
            AppDelegate.log("bootstrap: cancelled restore because mode/server changed")
            return
        }

        APIClient.shared.restoreSaTokenCookie(saved.token, expiresAt: saved.expiresAt, for: targetURL)
        let result = await auth.validateSessionDetailed(baseURL: targetURL)

        guard !isLoggedIn, deploymentMode == targetMode, serverURL == targetURL else { return }

        switch result {
        case .valid:
            if !saved.username.isEmpty {
                self.username = saved.username
                UserDefaults.standard.set(saved.username, forKey: userKey)
            }
            isLoggedIn = true
            AppDelegate.log("bootstrap: restored remembered session user=\(self.username)")
        case .unauthorized:
            RememberedSessionStore.shared.remove(for: targetURL)
            APIClient.shared.clearCookies(for: targetURL)
            restoreNotice = L("30 天免登会话已失效，请重新登录")
            AppDelegate.log("bootstrap: remembered session rejected by server (401); cleared")
        case .unreachable:
            AppDelegate.log("bootstrap: server unreachable during restore; keeping remembered record")
        }
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
        restoreNotice = nil
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
            rememberMePreference = rememberMe
            self.username = username
            UserDefaults.standard.set(username, forKey: userKey)
            persistRememberedSessionIfNeeded(username: username, rememberMe: rememberMe, baseURL: serverURL)
            isLoggedIn = true
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    @MainActor
    func registerFirstUser(username: String, password: String, rememberMe: Bool = false) async throws {
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        try await auth.registerFirstUser(baseURL: serverURL, username: username, password: password)
        // After first register, login immediately
        try await login(username: username, password: password, rememberMe: rememberMe)
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
        restoreNotice = nil
        RememberedSessionStore.shared.remove(for: base)
        await auth.logout(baseURL: base)
        APIClient.shared.clearCookies(for: base)
    }

    @MainActor
    func forceLogout() {
        let base = serverURL
        isLoggedIn = false
        RememberedSessionStore.shared.remove(for: base)
        APIClient.shared.clearCookies(for: base)
    }

    private func persistRememberedSessionIfNeeded(username: String, rememberMe: Bool, baseURL: String) {
        let normalized = Self.normalize(baseURL)
        guard !normalized.isEmpty else { return }
        if !rememberMe {
            RememberedSessionStore.shared.remove(for: normalized)
            return
        }
        guard let cookie = APIClient.shared.saTokenCookie(for: normalized), !cookie.value.isEmpty else {
            AppDelegate.log("rememberMe: login succeeded but satoken cookie missing for \(normalized)")
            return
        }
        let expiresAt = cookie.expiresDate ?? Date().addingTimeInterval(Self.rememberMeDurationSeconds)
        let record = RememberedSessionRecord(
            token: cookie.value,
            username: username,
            expiresAt: expiresAt,
            savedAt: Date()
        )
        RememberedSessionStore.shared.save(record, for: normalized)
        AppDelegate.log("rememberMe: saved 30-day session for \(normalized) expires=\(expiresAt)")
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

/// Persisted metadata for an opted-in 30-day "Remember me" session (stores only the revocable Sa-Token UUID, never passwords).
struct RememberedSessionRecord: Codable {
    let token: String
    let username: String
    let expiresAt: Date
    let savedAt: Date
}

final class RememberedSessionStore {
    static let shared = RememberedSessionStore()

    private let lock = NSLock()
    private let fileURL: URL

    private init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let dir = home.appendingPathComponent(".ocipool", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let bundleId = Bundle.main.bundleIdentifier ?? "com.nodewebzsz.ocipool"
        let fileName = bundleId == "com.nodewebzsz.ocipool"
            ? "remembered-sessions.json"
            : "remembered-sessions-\(bundleId).json"
        self.fileURL = dir.appendingPathComponent(fileName)
    }

    func load(for serverURL: String) -> RememberedSessionRecord? {
        let key = AppSession.normalize(serverURL)
        guard !key.isEmpty else { return nil }
        lock.lock()
        defer { lock.unlock() }
        var map = readAllLocked()
        guard let record = map[key] else { return nil }
        if record.expiresAt <= Date() || record.token.isEmpty {
            map.removeValue(forKey: key)
            writeAllLocked(map)
            return nil
        }
        return record
    }

    func save(_ record: RememberedSessionRecord, for serverURL: String) {
        let key = AppSession.normalize(serverURL)
        guard !key.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        var map = readAllLocked()
        map[key] = record
        writeAllLocked(map)
    }

    func remove(for serverURL: String) {
        let key = AppSession.normalize(serverURL)
        guard !key.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        var map = readAllLocked()
        guard map.removeValue(forKey: key) != nil else { return }
        writeAllLocked(map)
    }

    private func readAllLocked() -> [String: RememberedSessionRecord] {
        guard let data = try? Data(contentsOf: fileURL) else { return [:] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([String: RememberedSessionRecord].self, from: data)) ?? [:]
    }

    private func writeAllLocked(_ map: [String: RememberedSessionRecord]) {
        let dir = fileURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if map.isEmpty {
            try? FileManager.default.removeItem(at: fileURL)
            return
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(map) else { return }
        try? data.write(to: fileURL, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }
}
