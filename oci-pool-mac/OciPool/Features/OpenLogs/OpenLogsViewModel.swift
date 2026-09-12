import Foundation
import Combine
import AppKit

/// ViewModel for Web `/system/openLogs` — history + live SSE tail.
@MainActor
final class OpenLogsViewModel: ObservableObject {

    static let maxLines = 1000

    @Published private(set) var entries: [OpenLogEntry] = []
    @Published var filterLevel: OpenLogFilterLevel = .all
    @Published var keyword: String = ""
    @Published private(set) var connection: OpenLogsConnectionState = .disconnected
    @Published private(set) var isLoadingHistory = false
    @Published private(set) var errorText: String?
    @Published var autoScroll = true
    /// Web logs.action.pause：暂停时断开 SSE，恢复时重连
    @Published var paused = false {
        didSet {
            if paused != oldValue {
                if paused {
                    OpenLogsSSEClient.shared.stop(notify: false)
                    connection = .disconnected
                } else if active {
                    Task { await connectStream() }
                }
            }
        }
    }
    @Published private(set) var clockText: String = ""
    /// Bumped when a new line arrives so ScrollView can pin to bottom.
    @Published private(set) var scrollToken: Int = 0

    private let session: AppSession
    private var service: OpenLogsService { OpenLogsService(baseURL: session.serverURL) }
    private var nextId = 1
    private var clockTimer: Timer?
    private var reconnectWork: DispatchWorkItem?
    private var active = false
    private let reconnectDelay: TimeInterval = 5

    init(session: AppSession = .shared) {
        self.session = session
    }

    // MARK: - Lifecycle

    func start() {
        active = true
        errorText = nil
        startClock()
        if !paused {
            Task { await loadHistoryAndConnect() }
        } else {
            Task { await loadHistoryOnly() }
        }
    }

    func stop() {
        active = false
        reconnectWork?.cancel()
        reconnectWork = nil
        OpenLogsSSEClient.shared.stop(notify: false)
        connection = .disconnected
        stopClock()
    }

    func clearLogs() {
        entries = []
        errorText = nil
    }

    /// Web logs.action.download：导出日志为 .txt 并 toast
    func exportLogs() {
        let target = filteredEntries.isEmpty ? entries : filteredEntries
        guard !target.isEmpty else { return }
        let text = target.map { $0.text }.joined(separator: "\n")
        let fname = "boot-logs-\(Int(Date().timeIntervalSince1970)).txt"
        let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let url = dir.appendingPathComponent(fname)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } catch {
            Self.exportFail(error)
        }
    }

    /// 经过当前过滤规则（级别 + 关键词）筛选后的日志条目
    var filteredEntries: [OpenLogEntry] {
        let kw = keyword.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return entries.filter { entry in
            if !filterLevel.matches(entry.level) {
                return false
            }
            if !kw.isEmpty {
                return entry.text.lowercased().contains(kw)
            }
            return true
        }
    }

    /// 各级别统计
    func count(for filter: OpenLogFilterLevel) -> Int {
        switch filter {
        case .all:
            return entries.count
        case .info:
            return entries.filter { $0.level == .info }.count
        case .warn:
            return entries.filter { $0.level == .warn }.count
        case .error:
            return entries.filter { $0.level == .error }.count
        case .success:
            return entries.filter { $0.level == .success }.count
        }
    }

    private static func exportFail(_ error: Error) {
        let line = "\(error)\n"
        fputs(line, stderr)
    }

    private func loadHistoryOnly() async {
        isLoadingHistory = true
        errorText = nil
        defer { isLoadingHistory = false }
        do {
            let lines = try await service.fetchHistory(lines: 300)
            var built: [OpenLogEntry] = []
            built.reserveCapacity(lines.count)
            for line in lines {
                let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                let id = nextId
                nextId += 1
                built.append(OpenLogEntry.make(id: id, raw: trimmed))
            }
            if built.count > Self.maxLines {
                built = Array(built.suffix(Self.maxLines))
            }
            entries = built
        } catch {
            errorText = "开机日志加载失败"
        }
    }

    func reconnectNow() {
        reconnectWork?.cancel()
        reconnectWork = nil
        Task { await connectStream() }
    }

    func reloadHistory() {
        Task { await loadHistoryAndConnect() }
    }

    // MARK: - History + stream

    private func loadHistoryAndConnect() async {
        isLoadingHistory = true
        errorText = nil
        defer { isLoadingHistory = false }

        do {
            let lines = try await service.fetchHistory(lines: 300)
            var built: [OpenLogEntry] = []
            built.reserveCapacity(lines.count)
            for line in lines {
                let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                let id = nextId
                nextId += 1
                built.append(OpenLogEntry.make(id: id, raw: trimmed))
            }
            if built.count > Self.maxLines {
                built = Array(built.suffix(Self.maxLines))
            }
            entries = built
            if autoScroll { scrollToken += 1 }
        } catch {
            errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }

        guard active else { return }
        await connectStream()
    }

    private func connectStream() async {
        guard active else { return }
        reconnectWork?.cancel()
        reconnectWork = nil
        connection = .connecting

        let req: URLRequest
        do {
            req = try service.streamRequest()
        } catch {
            connection = .disconnected
            errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
            scheduleReconnect()
            return
        }

        // Strong capture: StateObject owns this VM for the page lifetime (same pattern as Tenants SSE).
        OpenLogsSSEClient.shared.start(
            request: req,
            onOpen: {
                DispatchQueue.main.async {
                    self.connection = .connected
                    self.errorText = nil
                }
            },
            onLine: { line in
                DispatchQueue.main.async {
                    self.appendLine(line)
                }
            },
            onClose: { error in
                DispatchQueue.main.async {
                    self.handleStreamClose(error)
                }
            }
        )
    }

    private func handleStreamClose(_ error: Error?) {
        guard active else {
            connection = .disconnected
            return
        }
        connection = .disconnected
        if let error = error {
            let msg = (error as? APIError)?.errorDescription ?? error.localizedDescription
            if !(error is CancellationError) {
                errorText = msg
            }
        }
        scheduleReconnect()
    }

    private func appendLine(_ raw: String) {
        guard active else { return }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let id = nextId
        nextId += 1
        entries.append(OpenLogEntry.make(id: id, raw: trimmed))
        if entries.count > Self.maxLines {
            entries.removeFirst(entries.count - Self.maxLines)
        }
        if autoScroll {
            scrollToken += 1
        }
    }

    private func scheduleReconnect() {
        guard active else { return }
        reconnectWork?.cancel()
        let work = DispatchWorkItem {
            Task {
                await self.connectStream()
            }
        }
        reconnectWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + reconnectDelay, execute: work)
    }

    // MARK: - Clock

    private func startClock() {
        stopClock()
        tickClock()
        let t = Timer(timeInterval: 1, repeats: true) { _ in
            DispatchQueue.main.async {
                self.tickClock()
            }
        }
        RunLoop.main.add(t, forMode: .common)
        clockTimer = t
    }

    private func stopClock() {
        clockTimer?.invalidate()
        clockTimer = nil
    }

    private func tickClock() {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        clockText = f.string(from: Date())
    }
}
