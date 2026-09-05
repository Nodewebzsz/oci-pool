import Foundation
import Combine

/// Loads `/boot/dashboard-stats` + `/monitor/stats` on the same schedule as web dashboard.js.
@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var stats = DashboardStats()
    @Published private(set) var metrics = SystemMetrics()
    @Published private(set) var networkHistory: [NetworkSample] = []
    @Published private(set) var activityLogs: [ActivityLog] = []
    @Published private(set) var lastUpdateText = "加载中..."
    @Published private(set) var isLoading = false
    @Published private(set) var errorText: String?

    private let session: AppSession
    private var monitorTimer: Timer?
    private let maxNetworkPoints = 30

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task { await refreshAll() }
        stopTimers()
        // Web monitor page polls all three endpoints every 10s.
        monitorTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in
                await self.refreshAll()
            }
        }
        if let monitorTimer = monitorTimer { RunLoop.main.add(monitorTimer, forMode: .common) }
    }

    func stop() {
        stopTimers()
    }

    func refreshAll() async {
        isLoading = true
        errorText = nil
        async let s: () = refreshStats()
        async let m: () = refreshMetrics()
        async let l: () = refreshActivity()
        _ = await (s, m, l)
        isLoading = false
    }

    func refreshStats() async {
        do {
            let data = try await fetchEnvelope(path: "/boot/dashboard-stats", as: DashboardStats.self)
            stats = data
        } catch {
            // keep previous; show soft error
            if error is APIError {
                errorText = error.localizedDescription
            }
        }
    }

    func refreshMetrics() async {
        do {
            // Prefer web path used by page-monitor.jsx
            let data = try await fetchEnvelope(path: "/boot/stats", as: SystemMetrics.self)
            metrics = data
            appendNetwork(upload: data.uploadSpeed, download: data.downloadSpeed)
            if !data.timestamp.isEmpty {
                lastUpdateText = data.timestamp
            } else {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd HH:mm:ss"
                lastUpdateText = f.string(from: Date())
            }
            errorText = nil
        } catch {
            // Fallback alternate endpoint from DashBoardController
            do {
                let data = try await fetchEnvelope(path: "/boot/stats", as: SystemMetrics.self)
                metrics = data
                appendNetwork(upload: data.uploadSpeed, download: data.downloadSpeed)
                if !data.timestamp.isEmpty {
                    lastUpdateText = data.timestamp
                }
                errorText = nil
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    func refreshActivity() async {
        do {
            let base = session.serverURL
            let url = try APIClient.shared.makeURL(base, path: "/system/openLogs/json")
            let raw = try await APIClient.shared.getJSON(url)
            let envelope = try JSONDecoder().decode(OpenLogLinesEnvelope.self, from: raw)
            let lines = envelope.lines ?? []
            activityLogs = lines.prefix(10).enumerated().map { ActivityLog.parse($0.element, id: $0.offset) }
            if errorText != nil && !lines.isEmpty { errorText = nil }
        } catch {
            // Activity feed is secondary — do not surface a page-level error for it.
        }
    }

    private func appendNetwork(upload: Double, download: Double) {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "HH:mm:ss"
        networkHistory.append(NetworkSample(timeLabel: f.string(from: Date()), upload: upload, download: download))
        if networkHistory.count > maxNetworkPoints {
            networkHistory.removeFirst(networkHistory.count - maxNetworkPoints)
        }
    }

    private func fetchEnvelope<T: Decodable>(path: String, as type: T.Type) async throws -> T {
        let base = session.serverURL
        let url = try APIClient.shared.makeURL(base, path: path)
        let raw = try await APIClient.shared.getJSON(url)
        let envelope = try JSONDecoder().decode(APIEnvelope<T>.self, from: raw)
        guard envelope.success, let data = envelope.data else {
            throw APIError.serverMessage(envelope.message ?? "请求失败")
        }
        return data
    }

    private func stopTimers() {
        monitorTimer?.invalidate()
        monitorTimer = nil
    }

    deinit {
        monitorTimer?.invalidate()
    }
}
