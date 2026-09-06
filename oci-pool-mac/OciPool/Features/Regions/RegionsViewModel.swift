import Foundation
import Combine

/// Data layer for web `/resource/list` (arm_records) page.
@MainActor
final class RegionsViewModel: ObservableObject {
    @Published private(set) var openRecords: [OpenRegionNotify] = []
    @Published private(set) var myRecords: [OpenRegionNotify] = []
    @Published private(set) var myRegionCodes: Set<String> = []
    @Published private(set) var regionMap: [String: String] = [:]
    @Published private(set) var allRows: [RegionRow] = []
    @Published private(set) var filteredRows: [RegionRow] = []
    @Published private(set) var pageRows: [RegionRow] = []
    @Published private(set) var lastUpdateText = "加载中..."
    @Published private(set) var isLoading = false
    @Published private(set) var errorText: String?

    @Published var searchText = "" {
        didSet { refilter() }
    }
    @Published var continent: RegionContinent = .all {
        didSet { refilter() }
    }
    @Published var statusFilter: RegionStatusFilter = .all {
        didSet { refilter() }
    }
    @Published var mapMode: RegionsMapViewMode = .arm {
        didSet {
            if mapMode != oldValue { refilter() }
        }
    }
    @Published var showMapBoard = false
    @Published var pageState = PageState(page: 0, size: 10)

    private let session: AppSession
    private var refreshTimer: Timer?

    var totalRegions: Int { KnownRegions.codes.count }
    var openArmCount: Int { openRecords.filter { $0.openCount > 0 }.count }
    var todayNewCount: Int {
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        return openRecords.filter { rec in
            guard rec.openCount > 0, let t = rec.openTime, let d = Self.parseDate(t) else { return false }
            return d >= start
        }.count
    }
    /// Web「数量:」= 当前 tab + 筛选后的行数
    var filteredCount: Int { filteredRows.count }

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task { await refresh() }
        stopTimer()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 5 * 60, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor in await self.refresh() }
        }
        if let refreshTimer = refreshTimer {
            RunLoop.main.add(refreshTimer, forMode: .common)
        }
    }

    func stop() {
        stopTimer()
    }

    func refresh() async {
        isLoading = true
        errorText = nil
        defer { isLoading = false }
        do {
            async let arm: () = fetchArmData()
            async let mine: () = fetchMyRegions()
            _ = await (arm, mine)
            myRegionCodes = Set(myRecords.map(\.region))
            rebuildRows()
            let f = DateFormatter()
            f.locale = Locale(identifier: "zh_CN")
            f.dateFormat = "yyyy/M/d HH:mm:ss"
            lastUpdateText = f.string(from: Date())
        }
    }

    func goPage(_ action: (inout PageState) -> Void) {
        action(&pageState)
        applyPage()
    }

    // MARK: - Private

    private func fetchArmData() async {
        do {
            let data = try await fetchEnvelope(path: "/resource/arm-data", as: ArmDataPayload.self)
            openRecords = data.armRecords
            regionMap = data.regionMap
            errorText = nil
        } catch {
            // 文案对齐 Web i18n regions.err.arm
            errorText = "ARM 区域加载失败"
            openRecords = []
        }
    }

    private func fetchMyRegions() async {
        do {
            let data = try await fetchEnvelope(path: "/resource/my-regions", as: MyRegionsPayload.self)
            myRecords = data.hasRecords
        } catch {
            myRecords = []
        }
    }

    private func rebuildRows() {
        var rows: [RegionRow] = []
        var added = Set<String>()

        func makeRow(code: String, name: String, isOpen: Bool, arch: String,
                     openTime: String?, openCount: Int, monthly: Int, lastNotify: String?) -> RegionRow {
            RegionRow(
                regionCode: code,
                name: name,
                isOpen: isOpen,
                architectureType: arch,
                openTime: openTime,
                openCount: openCount,
                monthlyOpenCount: monthly,
                lastNotifyTime: lastNotify,
                continent: RegionContinent.of(regionCode: code),
                isMine: myRegionCodes.contains(code),
                todayGrabs: Self.openedToday(openTime) ? openCount : 0
            )
        }

        // Open regions first (backend order)
        for rec in openRecords {
            let code = rec.region
            guard KnownRegions.codes.contains(code) || !code.isEmpty else { continue }
            added.insert(code)
            rows.append(makeRow(
                code: code,
                name: regionMap[code] ?? code,
                isOpen: rec.openCount > 0,
                arch: rec.architectureType.isEmpty ? "—" : rec.architectureType,
                openTime: rec.openTime,
                openCount: rec.openCount,
                monthly: rec.monthlyOpenCount,
                lastNotify: rec.lastNotifyTime
            ))
        }

        // Closed known regions
        var closed: [RegionRow] = []
        for code in KnownRegions.codes where !added.contains(code) {
            closed.append(makeRow(
                code: code,
                name: regionMap[code] ?? code,
                isOpen: false,
                arch: "—",
                openTime: nil,
                openCount: 0,
                monthly: 0,
                lastNotify: nil
            ))
        }
        closed.sort { $0.regionCode < $1.regionCode }
        // Web page-regions：全部行按最近开机时间倒序，无时间的排最后
        allRows = (rows + closed).sorted { (a: RegionRow, b: RegionRow) -> Bool in
            let at = a.lastNotifyTime ?? a.openTime
            let bt = b.lastNotifyTime ?? b.openTime
            switch (at, bt) {
            case (nil, nil): return false
            case (nil, _): return false
            case (_, nil): return true
            case (let l?, let r?):
                return (Self.parseDate(l) ?? .distantPast) > (Self.parseDate(r) ?? .distantPast)
            }
        }
        refilter()
    }

    private static func openedToday(_ time: String?) -> Bool {
        guard let time, !time.isEmpty, let d = parseDate(time) else { return false }
        return Calendar.current.isDateInToday(d)
    }

    private func refilter() {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // Web：tab 先过滤（released → 已放货，mine → 我的区域，map → 全部）
        let tabFiltered: [RegionRow]
        switch mapMode {
        case .arm: tabFiltered = allRows.filter(\.isOpen)
        case .mine: tabFiltered = allRows.filter(\.isMine)
        case .map: tabFiltered = allRows
        }
        filteredRows = tabFiltered.filter { row in
            let matchQ = q.isEmpty
                || row.regionCode.lowercased().contains(q)
                || row.name.lowercased().contains(q)
            let matchC = continent == .all || row.continent == continent.rawValue
            let matchS: Bool = {
                switch statusFilter {
                case .all: return true
                case .open: return row.isOpen
                case .closed: return !row.isOpen
                }
            }()
            return matchQ && matchC && matchS
        }
        pageState.page = 0
        pageState.apply(totalElements: Int64(filteredRows.count))
        applyPage()
    }

    private func applyPage() {
        pageState.apply(totalElements: Int64(filteredRows.count))
        let start = pageState.page * pageState.size
        let end = min(start + pageState.size, filteredRows.count)
        if start < end {
            pageRows = Array(filteredRows[start..<end])
        } else {
            pageRows = []
        }
    }

    private func fetchEnvelope<T: Decodable>(path: String, as type: T.Type) async throws -> T {
        let url = try APIClient.shared.makeURL(session.serverURL, path: path)
        let raw = try await APIClient.shared.getJSON(url)
        let envelope = try JSONDecoder().decode(APIEnvelope<T>.self, from: raw)
        guard envelope.success, let data = envelope.data else {
            throw APIError.serverMessage(envelope.message ?? "请求失败")
        }
        return data
    }

    private func stopTimer() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    private static func parseDate(_ s: String) -> Date? {
        let f1 = DateFormatter()
        f1.dateFormat = "yyyy-MM-dd HH:mm:ss"
        f1.locale = Locale(identifier: "en_US_POSIX")
        if let d = f1.date(from: s) { return d }
        let f2 = ISO8601DateFormatter()
        return f2.date(from: s)
    }

    deinit {
        refreshTimer?.invalidate()
    }
}
