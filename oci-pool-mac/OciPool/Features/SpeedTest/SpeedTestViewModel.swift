import Foundation
import Combine

/// Web-parity 延迟测试 (`speed_test.ftl`): load regions + client IP, parallel HEAD ping.
@MainActor
final class SpeedTestViewModel: ObservableObject {
    @Published private(set) var regions: [SpeedRegionEndpoint] = []
    @Published private(set) var latency: [String: SpeedLatencyState] = [:]
    @Published private(set) var clientIPText = "测试中…"
    @Published private(set) var bestRegionText = "--"
    @Published private(set) var avgLatencyText = "--"
    @Published private(set) var top5: [SpeedRankItem] = []
    @Published private(set) var isLoadingRegions = false
    @Published private(set) var isTesting = false
    /// 测完一轮后置 true（按钮切「重新测速」）
    @Published private(set) var hasCompleted = false
    /// 已完成探测数 / 总数（进度条）
    @Published private(set) var testedCount = 0
    @Published private(set) var aborted = false
    @Published private(set) var errorText: String?
    /// Region currently mid-ping (border highlight like web).
    @Published private(set) var activeCode: String?

    private let session: AppSession
    private var testGeneration = 0

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task {
            await loadClientIP()
            await loadRegions()
            // web: setTimeout(initTest, 500)
            try? await Task.sleep(nanoseconds: 500_000_000)
            await runTest()
        }
    }

    func refresh() async {
        await loadClientIP()
        await loadRegions()
        await runTest()
    }

    // MARK: - Load

    /// Web 同款 5 级兜底链：后端 getCurrentIp → ipwho.is → ipinfo.io → geojs → ipify
    func loadClientIP() async {
        // 1) 后端 /api/getCurrentIp（登录后返回 公网IP/地址）
        if let raw = try? await fetchStringData(path: "/api/getCurrentIp"), raw.lowercased() != "error", !raw.isEmpty {
            if raw.contains("/") {
                let parts = raw.split(separator: "/", maxSplits: 1).map(String.init)
                let ip = parts.first ?? raw
                let loc = parts.count > 1 ? parts[1] : ""
                clientIPText = loc.isEmpty ? ip : "\(ip)  \(loc)"
            } else {
                clientIPText = raw.replacingOccurrences(of: "_", with: ".")
            }
            return
        }
        // 2) ipwho.is — 含 城市/国家/ISP
        if let d = try? await publicIPJSON("https://ipwho.is/") as? [String: Any] {
            let explicitFail = d["success"] != nil && (d["success"] as? Bool) == false
            if !explicitFail, let ip = d["ip"] as? String, !ip.isEmpty {
                var parts: [String] = []
                if let flag = (d["flag"] as? [String: Any])?["emoji"] as? String { parts.append(flag) }
                if let city = d["city"] as? String, !city.isEmpty { parts.append(city) }
                if let country = d["country"] as? String, !country.isEmpty { parts.append(country) }
                let conn = d["connection"] as? [String: Any] ?? [:]
                let org = (conn["isp"] as? String) ?? (conn["org"] as? String) ?? ""
                let loc = parts.joined(separator: " · ") + (org.isEmpty ? "" : " · \(org)")
                clientIPText = loc.isEmpty ? ip : "\(ip)  \(loc)"
                return
            }
        }
        // 3) ipinfo.io
        if let d = try? await publicIPJSON("https://ipinfo.io/json") as? [String: Any] {
            if let ip = d["ip"] as? String, !ip.isEmpty {
                let city = d["city"] as? String ?? ""
                let country = d["country"] as? String ?? ""
                let org = (d["org"] as? String ?? "").replacingOccurrences(of: "^AS\\d+\\s*", with: "", options: .regularExpression)
                let loc = [city, country].filter { !$0.isEmpty }.joined(separator: " · ") + (org.isEmpty ? "" : " · \(org)")
                clientIPText = loc.isEmpty ? ip : "\(ip)  \(loc)"
                return
            }
        }
        // 4) geojs
        if let d = try? await publicIPJSON("https://get.geojs.io/v1/ip/geo.json") as? [String: Any] {
            if let ip = d["ip"] as? String, !ip.isEmpty {
                let city = d["city"] as? String ?? ""
                let country = d["country"] as? String ?? ""
                let org = d["organization_name"] as? String ?? ""
                let loc = [city, country].filter { !$0.isEmpty }.joined(separator: " · ") + (org.isEmpty ? "" : " · \(org)")
                clientIPText = loc.isEmpty ? ip : "\(ip)  \(loc)"
                return
            }
        }
        // 5) ipify — 仅 IP
        if let d = try? await publicIPJSON("https://api.ipify.org?format=json") as? [String: Any] {
            if let ip = d["ip"] as? String, !ip.isEmpty {
                clientIPText = ip
                return
            }
        }
        clientIPText = "获取失败"
    }

    /// 直连公共 IP API（不走后端）
    private func publicIPJSON(_ urlString: String) async throws -> Any {
        guard let url = URL(string: urlString) else { throw APIError.serverMessage("bad url") }
        var req = URLRequest(url: url, timeoutInterval: 8)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, _) = try await APIClient.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data)
    }

    func loadRegions() async {
        isLoadingRegions = true
        errorText = nil
        defer { isLoadingRegions = false }
        do {
            let list = try await fetchRegions(path: "/api/getOracleEndpoint")
            regions = list.filter { !$0.endpoint.isEmpty }
            var map: [String: SpeedLatencyState] = [:]
            for r in regions { map[r.code] = .idle }
            latency = map
        } catch {
            errorText = error.localizedDescription
            regions = []
        }
    }

    /// Web 停止按钮：中止进行中的测速
    func abortTest() {
        guard isTesting else { return }
        testGeneration += 1
        isTesting = false
        aborted = true
        latency = latency.mapValues { state in
            if case .testing = state { return .idle }
            return state
        }
    }

    /// Web 重置按钮：清空结果回未测状态
    func resetResults() {
        testGeneration += 1
        isTesting = false
        hasCompleted = false
        aborted = false
        latency = latency.mapValues { _ in .idle }
        bestRegionText = "—"
        avgLatencyText = "--"
        top5 = []
        activeCode = nil
    }

    // MARK: - Test (web initTest)

    func runTest() async {
        guard !regions.isEmpty else { return }
        testGeneration += 1
        let gen = testGeneration
        isTesting = true
        bestRegionText = "loading..."
        avgLatencyText = "--"
        top5 = []
        activeCode = nil

        var next: [String: SpeedLatencyState] = [:]
        for r in regions { next[r.code] = .testing }
        latency = next

        var green: [SpeedRankItem] = []
        var totalLatency = 0
        var successCount = 0
        var minLatency = 9999
        var bestName = ""

        await withTaskGroup(of: (String, String, Int).self) { group in
            for r in regions {
                group.addTask { [weak self] in
                    guard let self = self else { return (r.code, r.simpleName, -1) }
                    var ms = await self.ping(r.endpoint)
                    if ms != -1 {
                        let retry = await self.ping(r.endpoint)
                        if retry != -1 && retry < ms { ms = retry }
                    }
                    return (r.code, r.simpleName, ms)
                }
            }

            for await (code, simpleName, ms) in group {
                guard gen == testGeneration else { continue }
                testedCount += 1

                if ms != -1 {
                    var lat = latency
                    lat[code] = .ok(ms)
                    latency = lat

                    if ms < 150 {
                        green.append(SpeedRankItem(code: code, name: simpleName, ms: ms))
                        green.sort { $0.ms < $1.ms }
                        top5 = Array(green.prefix(5))
                    }

                    totalLatency += ms
                    successCount += 1
                    if ms < minLatency {
                        minLatency = ms
                        bestName = simpleName
                        bestRegionText = "\(bestName) (\(minLatency)ms)"
                    }
                    if successCount > 0 {
                        avgLatencyText = "\(Int(round(Double(totalLatency) / Double(successCount))))ms"
                    }
                } else {
                    var lat = latency
                    lat[code] = .timeout
                    latency = lat
                }
            }
        }

        guard gen == testGeneration else { return }
        if !bestName.isEmpty {
            bestRegionText = "\(bestName) (\(minLatency)ms)"
        } else if bestRegionText == "loading..." {
            bestRegionText = "--"
        }
        isTesting = false
        hasCompleted = true
        activeCode = nil
    }

    /// Browser: `fetch(url, { method: 'HEAD', mode: 'no-cors' })` timing.
    /// Native: HEAD request round-trip; any HTTP response counts as success for timing.
    private func ping(_ urlString: String) async -> Int {
        guard let url = URL(string: urlString) else { return -1 }
        var req = URLRequest(url: url)
        req.httpMethod = "HEAD"
        req.timeoutInterval = 6
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        let start = CFAbsoluteTimeGetCurrent()
        do {
            _ = try await URLSession.shared.compatData(for: req)
            let ms = Int(((CFAbsoluteTimeGetCurrent() - start) * 1000).rounded())
            return max(1, ms)
        } catch {
            // Network-level failure → timeout like web catch
            return -1
        }
    }

    // MARK: - HTTP helpers

    private func fetchStringData(path: String) async throws -> String {
        let url = try APIClient.shared.makeURL(session.serverURL, path: path)
        let data = try await APIClient.shared.getJSON(url)
        if let env = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let success = (env["success"] as? Bool) ?? true
            if !success {
                throw APIError.serverMessage((env["message"] as? String) ?? "失败")
            }
            if let s = env["data"] as? String { return s }
            if let n = env["data"] as? NSNumber { return n.stringValue }
        }
        if let s = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: CharacterSet(charactersIn: "\" \n\r")) {
            return s
        }
        throw APIError.serverMessage("无法解析 IP")
    }

    private func fetchRegions(path: String) async throws -> [SpeedRegionEndpoint] {
        let url = try APIClient.shared.makeURL(session.serverURL, path: path)
        let data = try await APIClient.shared.getJSON(url)
        guard let env = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw APIError.serverMessage("无效响应")
        }
        let success = (env["success"] as? Bool) ?? true
        if !success {
            throw APIError.serverMessage((env["message"] as? String) ?? "加载失败")
        }
        let arr = env["data"] as? [[String: Any]] ?? []
        return arr.compactMap { d in
            let code = (d["code"] as? String) ?? ""
            let endpoint = (d["endpoint"] as? String) ?? ""
            guard !code.isEmpty, !endpoint.isEmpty else { return nil }
            return SpeedRegionEndpoint(
                code: code,
                name: (d["name"] as? String) ?? code,
                simpleName: (d["simpleName"] as? String) ?? code,
                endpoint: endpoint
            )
        }
    }
}
