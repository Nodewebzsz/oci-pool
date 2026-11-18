import SwiftUI

// MARK: - 区域经纬度（对齐 Web page-regions.jsx LNGLAT · Oracle 官方数据中心坐标）

enum RegionLngLat {
    static let table: [String: [Double]] = [
        "ap-tokyo-1":        [139.6917,  35.6895],
        "ap-osaka-1":        [135.5023,  34.6937],
        "ap-chuncheon-1":    [127.7300,  37.8813],
        "ap-seoul-1":        [126.9780,  37.5665],
        "ap-singapore-1":    [103.8198,   1.3521],
        "ap-singapore-2":    [103.8500,   1.3600],
        "ap-kulai-2":        [103.6081,   1.6598],
        "ap-batam-1":        [104.0300,   1.1200],
        "ap-mumbai-1":       [ 72.8777,  19.0760],
        "ap-hyderabad-1":    [ 78.4867,  17.3850],
        "ap-melbourne-1":    [144.9631, -37.8136],
        "ap-sydney-1":       [151.2093, -33.8688],
        "uk-london-1":       [ -0.1276,  51.5074],
        "uk-cardiff-1":      [ -3.1791,  51.4816],
        "eu-frankfurt-1":    [  8.6821,  50.1109],
        "eu-amsterdam-1":    [  4.9041,  52.3676],
        "eu-paris-1":        [  2.3522,  48.8566],
        "eu-marseille-1":    [  5.3698,  43.2965],
        "eu-milan-1":        [  9.1900,  45.4642],
        "eu-turin-1":        [  7.6869,  45.0703],
        "eu-madrid-1":       [ -3.7038,  40.4168],
        "eu-madrid-3":       [ -3.6900,  40.4200],
        "eu-zurich-1":       [  8.5417,  47.3769],
        "eu-stockholm-1":    [ 18.0686,  59.3293],
        "eu-jovanovac-1":    [ 20.9700,  43.9200],
        "il-jerusalem-1":    [ 35.2137,  31.7683],
        "me-jeddah-1":       [ 39.1925,  21.4858],
        "me-riyadh-1":       [ 46.6753,  24.7136],
        "me-dubai-1":        [ 55.2708,  25.2048],
        "me-abudhabi-1":     [ 54.3773,  24.4539],
        "af-casablanca-1":   [ -7.5898,  33.5731],
        "af-johannesburg-1": [ 28.0473, -26.2041],
        "us-ashburn-1":      [-77.4874,  39.0438],
        "us-phoenix-1":      [-112.0740, 33.4484],
        "us-sanjose-1":      [-121.8863, 37.3382],
        "us-chicago-1":      [-87.6298,  41.8781],
        "ca-toronto-1":      [-79.3832,  43.6532],
        "ca-montreal-1":     [-73.5673,  45.5017],
        "mx-queretaro-1":    [-100.3899, 20.5888],
        "mx-monterrey-1":    [-100.3161, 25.6866],
        "sa-saopaulo-1":     [-46.6333, -23.5505],
        "sa-vinhedo-1":      [-46.9750, -23.0300],
        "sa-santiago-1":     [-70.6693, -33.4489],
        "sa-valparaiso-1":   [-71.6127, -33.0472],
        "sa-bogota-1":       [-74.0721,   4.7110]
    ]
}

/// 区域 code → 中文名（simpleName），对齐 Web data.jsx REGIONS。
/// 用于租户下拉「租户名 · 中文区域」的展示。
enum RegionCnName {
    static let table: [String: String] = [
        // Asia Pacific
        "ap-tokyo-1":        "东京",
        "ap-osaka-1":        "大阪",
        "ap-chuncheon-1":    "春川",
        "ap-seoul-1":        "首尔",
        "ap-singapore-1":    "新加坡",
        "ap-singapore-2":    "新加坡西",
        "ap-kulai-2":        "古来",
        "ap-batam-1":        "巴淡",
        "ap-mumbai-1":       "孟买",
        "ap-hyderabad-1":    "海得拉巴",
        "ap-melbourne-1":    "墨尔本",
        "ap-sydney-1":       "悉尼",
        // Europe
        "uk-london-1":       "伦敦",
        "uk-cardiff-1":      "纽波特",
        "eu-frankfurt-1":    "法兰克福",
        "eu-amsterdam-1":    "阿姆斯特丹",
        "eu-paris-1":        "巴黎",
        "eu-marseille-1":    "马赛",
        "eu-milan-1":        "米兰",
        "eu-turin-1":        "都灵",
        "eu-madrid-1":       "马德里",
        "eu-madrid-3":       "马德里 3",
        "eu-zurich-1":       "苏黎世",
        "eu-stockholm-1":    "斯德哥尔摩",
        "eu-jovanovac-1":    "约万诺瓦茨",
        "il-jerusalem-1":    "耶路撒冷",
        // Middle East / Africa
        "me-jeddah-1":       "吉达",
        "me-riyadh-1":       "利雅得",
        "me-dubai-1":        "迪拜",
        "me-abudhabi-1":     "阿布扎比",
        "af-casablanca-1":   "卡萨布兰卡",
        "af-johannesburg-1": "约翰内斯堡",
        // Americas
        "us-ashburn-1":      "阿什本",
        "us-phoenix-1":      "凤凰城",
        "us-sanjose-1":      "圣何塞",
        "us-chicago-1":      "芝加哥",
        "ca-toronto-1":      "多伦多",
        "ca-montreal-1":     "蒙特利尔",
        "mx-queretaro-1":    "克雷塔罗",
        "mx-monterrey-1":    "蒙特雷",
        "sa-saopaulo-1":     "圣保罗",
        "sa-vinhedo-1":      "维尼耶多",
        "sa-santiago-1":     "圣地亚哥",
        "sa-valparaiso-1":   "瓦尔帕莱索",
        "sa-bogota-1":       "波哥大"
    ]
}

// MARK: - 地图节点

struct RegionMapNode: Identifiable, Equatable {
    var id: String { code }
    let code: String
    let name: String
    let arch: String
    let released: Bool
    var isMine: Bool = false
    let totalGrabs: Int
    let todayGrabs: Int
    let firstAt: String
    let lng: Double
    let lat: Double

    var coverageKind: RegionCoverageKind {
        RegionCoverageKind.classify(isMine: isMine, released: released)
    }

    /// Web：released → max(2.5, min(5.5, 2 + √totalGrabs × 0.3))；未放货 → 2
    var radius: CGFloat {
        guard released else { return 2 }
        return max(2.5, min(5.5, 2 + sqrt(Double(totalGrabs)) * 0.3))
    }

    var position: CGPoint { WorldMapData.project(lon: lng, lat: lat) }
}

/// 45° 旋转菱形标记（用于 `unlinkedReleased` 官方已放货但尚未关联账号覆盖区域）。
struct DiamondMarkerShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let midX = rect.midX
        let midY = rect.midY
        p.move(to: CGPoint(x: midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: midY))
        p.addLine(to: CGPoint(x: midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: midY))
        p.closeSubpath()
        return p
    }
}

// MARK: - TopoJSON 解码 + d3 geoNaturalEarth1 投影

/// 加载后端 `/modern-ui/vendor/countries-110m.json`（与 Web 同一份 world-atlas 110m），
/// 解码 TopoJSON 并投影到 1000×500 视口（d3 geoNaturalEarth1 · scale 180 · translate(500,270)）。
final class WorldMapData: ObservableObject {
    @Published var countryRings: [[CGPoint]] = []
    @Published var graticuleRings: [[CGPoint]] = []
    @Published var loaded = false

    static let mapW: CGFloat = 1000
    static let mapH: CGFloat = 500
    static let mapScale: CGFloat = 180

    private var loading = false

    func load(baseURL: String) {
        guard countryRings.isEmpty, !loading else { return }
        loading = true
        Task {
            do {
                let url = try APIClient.shared.makeURL(baseURL, path: "/modern-ui/vendor/countries-110m.json")
                let raw = try await APIClient.shared.getJSON(url)
                let result = try Self.decodeTopology(raw)
                await MainActor.run {
                    self.countryRings = result.rings
                    self.graticuleRings = result.grat
                    self.loaded = true
                    self.loading = false
                }
            } catch {
                Self.log("world map load failed: \(error)")
                await MainActor.run { self.loading = false }
            }
        }
    }

    struct DecodeResult {
        let rings: [[CGPoint]]
        let grat: [[CGPoint]]
    }

    static func decodeTopology(_ data: Data) throws -> DecodeResult {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let transform = obj["transform"] as? [String: Any],
              let scale = transform["scale"] as? [Double], scale.count == 2,
              let translate = transform["translate"] as? [Double], translate.count == 2,
              let arcsRaw = obj["arcs"] as? [[[Double]]],
              let objects = obj["objects"] as? [String: Any],
              let countries = objects["countries"] as? [String: Any],
              let geometries = countries["geometries"] as? [[String: Any]]
        else {
            throw NSError(domain: "WorldMapData", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "invalid topojson"])
        }

        // TopoJSON arcs：位置 delta 编码，每个 arc 的累计从 0 重新开始
        var arcs: [[CGPoint]] = []
        for arc in arcsRaw {
            var acc = CGPoint.zero
            var pts: [CGPoint] = []
            for pt in arc where pt.count >= 2 {
                acc = CGPoint(x: acc.x + CGFloat(pt[0]), y: acc.y + CGFloat(pt[1]))
                pts.append(CGPoint(x: acc.x * CGFloat(scale[0]) + CGFloat(translate[0]),
                                   y: acc.y * CGFloat(scale[1]) + CGFloat(translate[1])))
            }
            arcs.append(pts)
        }

        func ringPoints(_ indices: [Int]) -> [CGPoint] {
            var pts: [CGPoint] = []
            for idx in indices {
                let reversed = idx < 0
                let arc = arcs[reversed ? ~idx : idx]
                for p in (reversed ? arc.reversed() : arc) {
                    if let last = pts.last, abs(last.x - p.x) < 1e-9, abs(last.y - p.y) < 1e-9 { continue }
                    pts.append(p)
                }
            }
            if pts.count > 2, let first = pts.first, let last = pts.last,
               abs(first.x - last.x) < 1e-9, abs(first.y - last.y) < 1e-9 {
                pts.removeLast()
            }
            // 反经线解缠绕：相邻点经度差 >180 时就近 ±360，
            // 使楚科奇/南极洲等跨 180° 多边形投影连续（等效 d3 投影管线的 antimeridian clipping）
            var unwrapped: [CGPoint] = []
            var prevLon: Double?
            for pt in pts {
                var lon = Double(pt.x)
                if let prev = prevLon {
                    while lon - prev > 180 { lon -= 360 }
                    while lon - prev < -180 { lon += 360 }
                }
                unwrapped.append(CGPoint(x: CGFloat(lon), y: pt.y))
                prevLon = lon
            }
            return unwrapped
        }

        func polygons(of geo: [String: Any]) -> [[[CGPoint]]] {
            var result: [[[CGPoint]]] = []
            let type = geo["type"] as? String ?? ""
            if type == "Polygon", let ringIdx = geo["arcs"] as? [[Int]] {
                result.append(ringIdx.map(ringPoints))
            } else if type == "MultiPolygon", let multi = geo["arcs"] as? [[[Int]]] {
                for poly in multi { result.append(poly.map(ringPoints)) }
            }
            return result
        }

        var rings: [[CGPoint]] = []
        for geo in geometries {
            for poly in polygons(of: geo) {
                for ring in poly where ring.count > 2 {
                    rings.append(ring.map { Self.project(lon: $0.x, lat: $0.y) })
                }
            }
        }

        // 经纬网（对齐 Web d3 geoGraticule().step([30,30])：经线每 30° 弯曲、纬线每 30° 平直）
        var grat: [[CGPoint]] = []
        for lon in stride(from: -150.0, through: 180.0, by: 30) {
            var line: [CGPoint] = []
            for lat in stride(from: -90.0, through: 90.0, by: 3) {
                line.append(Self.project(lon: lon, lat: lat))
            }
            grat.append(line)
        }
        for lat in stride(from: -60.0, through: 60.0, by: 30) {
            var line: [CGPoint] = []
            for lon in stride(from: -180.0, through: 180.0, by: 3) {
                line.append(Self.project(lon: lon, lat: lat))
            }
            grat.append(line)
        }
        return DecodeResult(rings: rings, grat: grat)
    }

    /// d3 geoNaturalEarth1 raw 投影（λ/φ 弧度）→ 1000×500 视口坐标
    static func project(lon: Double, lat: Double) -> CGPoint {
        let lambda = lon * .pi / 180
        let phi = lat * .pi / 180
        let p2 = phi * phi
        let p4 = p2 * p2
        let x = lambda * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
        let y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
        return CGPoint(x: mapW / 2 + mapScale * CGFloat(x),
                       y: mapH / 2 + 20 - mapScale * CGFloat(y))
    }

    private static func log(_ msg: String) {
        let line = "\(ISO8601DateFormatter().string(from: Date()))  \(msg)\n"
        fputs(line, stderr)
    }
}

// MARK: - 世界地图视图（对齐 Web RegionMapView）

struct RegionWorldMapView: View {
    @ObservedObject private var appearance = AppearanceController.shared
    @ObservedObject var world: WorldMapData
    let nodes: [RegionMapNode]
    var dark: Bool
    var onNodeTap: (RegionMapNode) -> Void = { _ in }

    @State private var hoveredCode: String?
    @State private var hoverMonitor: Any?
    @State private var hoverBox = MapHoverBox()

    private var bg0: Color { AppTheme.pageBg(dark) }
    private var landFill: Color { AppTheme.sidebarHover(dark) }
    private var landStroke: Color { AppTheme.borderStrong(dark) }
    private var fg3: Color { AppTheme.textTertiary(dark) }
    private var fg1: Color { AppTheme.sidebarText(dark) }
    private var fg0: Color { AppTheme.navIcon(dark) }
    private var bg2: Color { AppTheme.sidebarHover(dark) }

    var body: some View {
        GeometryReader { geo in
            let s = geo.size.width / WorldMapData.mapW
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(bg0)
                    .overlay(
                        // Web：info/violet 双 radial 渐变氛围
                        ZStack {
                            RadialGradient(colors: [AppTheme.info.opacity(0.18), .clear],
                                           center: UnitPoint(x: 0.3, y: 0.4), startRadius: 10, endRadius: 320)
                            RadialGradient(colors: [AppTheme.violet.opacity(0.12), .clear],
                                           center: UnitPoint(x: 0.7, y: 0.6), startRadius: 10, endRadius: 360)
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                worldPaths(scale: s)

                let labelCodes = nonOverlappingLinkedLabelCodes
                ForEach(nodes) { node in
                    nodeView(node, scale: s, showLinkedLabel: labelCodes.contains(node.code))
                }

                if let node = nodes.first(where: { $0.code == hoveredCode }) {
                    tooltip(node, scale: s)
                        .transition(.opacity)
                }

                if world.countryRings.isEmpty {
                    Text("Loading world map...")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(fg3)
                }
            }
            .frame(width: geo.size.width, height: geo.size.width / 2)
            .clipped()
            .background(
                GeometryReader { g in
                    Color.clear
                        .onAppear { syncHoverBox(g) }
                        .onChange(of: g.frame(in: .global)) { _ in syncHoverBox(g) }
                        .onChange(of: nodes) { _ in syncHoverBox(g) }
                }
            )
        }
        // 高度由调用方 aspectRatio(2, contentMode: .fit) 给出，避免 GeometryReader 撑满视口导致裁切
        .onAppear { installHoverMonitor() }
        .onDisappear { removeHoverMonitor() }
    }

    private func syncHoverBox(_ g: GeometryProxy) {
        hoverBox.origin = g.frame(in: .global).origin
        hoverBox.scale = g.size.width / WorldMapData.mapW
        hoverBox.nodes = nodes
    }

    /// 全局 mouseMoved → 最近节点判定（比逐节点 onHover 更稳，滚动/快速移动均有效）
    private func installHoverMonitor() {
        guard hoverMonitor == nil else { return }
        let box = hoverBox
        hoverMonitor = NSEvent.addLocalMonitorForEvents(matching: .mouseMoved) { event in
            guard let window = event.window else { return event }
            let p = event.locationInWindow
            // SwiftUI .global 原点 = 窗口 frame（含标题栏）左上角
            let globalPoint = CGPoint(x: p.x, y: window.frame.height - p.y)
            let lx = globalPoint.x - box.origin.x
            let ly = globalPoint.y - box.origin.y
            let mapW = WorldMapData.mapW * box.scale
            let mapH = mapW / 2
            var nearest: RegionMapNode?
            if lx >= 0, ly >= 0, lx <= mapW, ly <= mapH {
                var best: CGFloat = 14
                for n in box.nodes {
                    let d = hypot(n.position.x * box.scale - lx, n.position.y * box.scale - ly)
                    if d < best { best = d; nearest = n }
                }
            }
            let code = nearest?.code ?? ""
            if code != box.currentCode {
                box.currentCode = code
                DispatchQueue.main.async { hoveredCode = code.isEmpty ? nil : code }
            }
            return event
        }
    }

    private func removeHoverMonitor() {
        if let monitor = hoverMonitor {
            NSEvent.removeMonitor(monitor)
            hoverMonitor = nil
        }
        hoverBox.currentCode = ""
    }

    // MARK: 大陆 + 经纬网

    @ViewBuilder
    private func worldPaths(scale: CGFloat) -> some View {
        if !world.countryRings.isEmpty {
            let landPath = path(from: world.countryRings, scale: scale)
            // GeoJSON 外环/内环方向相反，非零绕组规则即可正确挖洞
            landPath
                .fill(landFill)
            landPath
                .stroke(landStroke, style: StrokeStyle(lineWidth: 0.5 * scale, lineJoin: .round))
            let gratPath = path(from: world.graticuleRings, scale: scale, closed: false)
            gratPath
                .stroke(fg3.opacity(0.3), style: StrokeStyle(lineWidth: 0.5 * scale))
        }
    }

    private func path(from rings: [[CGPoint]], scale: CGFloat, closed: Bool = true) -> Path {
        var path = Path()
        for ring in rings {
            guard let first = ring.first else { continue }
            path.move(to: CGPoint(x: first.x * scale, y: first.y * scale))
            for pt in ring.dropFirst() {
                path.addLine(to: CGPoint(x: pt.x * scale, y: pt.y * scale))
            }
            // 经纬线是开放曲线：closeSubpath 会画出首尾直线弦（多余的横竖线），只有多边形才闭合
            if closed { path.closeSubpath() }
        }
        return path
    }

    /// 对 `linkedActive` 节点计算碰撞避让后的常驻微标签集合，防止密集同城/邻国重叠。
    private var nonOverlappingLinkedLabelCodes: Set<String> {
        var accepted: [CGPoint] = []
        var codes = Set<String>()
        let candidates = nodes
            .filter { $0.coverageKind == .linkedActive }
            .sorted { $0.totalGrabs > $1.totalGrabs }
        for n in candidates {
            let pos = n.position
            let collides = accepted.contains { existing in
                abs(existing.x - pos.x) < 42 && abs(existing.y - pos.y) < 16
            }
            if !collides {
                accepted.append(pos)
                codes.insert(n.code)
            }
        }
        return codes
    }

    // MARK: 节点（脉冲光晕 + 主圆 + hover）

    private func nodeView(_ node: RegionMapNode, scale: CGFloat, showLinkedLabel: Bool) -> some View {
        let kind = node.coverageKind
        let r = node.radius * scale
        let isHover = hoveredCode == node.code
        return Group {
            switch kind {
            case .linkedActive:
                let color = node.todayGrabs > 0 ? AppTheme.orange : AppTheme.sidebarActive
                HaloCircle(color: color, radius: r + 2 * scale, opacity: 0.22)
                if node.todayGrabs > 0 {
                    PulseHaloCircle(color: color, baseRadius: r + 5 * scale)
                } else {
                    Circle()
                        .stroke(color.opacity(0.45), lineWidth: 1.2)
                        .frame(width: (r + 3.5 * scale) * 2, height: (r + 3.5 * scale) * 2)
                }
                Circle()
                    .fill(color)
                    .frame(width: r * 2, height: r * 2)
                    .shadow(color: color.opacity(0.8), radius: 3)
                if showLinkedLabel && !isHover {
                    Text(node.name)
                        .font(.system(size: max(8.5, 9.5 * scale), weight: .semibold))
                        .foregroundColor(fg0)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(
                            RoundedRectangle(cornerRadius: 3)
                                .fill(bg2.opacity(dark ? 0.86 : 0.90))
                        )
                        .offset(y: -(r + 9 * scale))
                }

            case .linkedIdle:
                let color = AppTheme.info
                Circle()
                    .stroke(color.opacity(0.55), lineWidth: 1.2)
                    .frame(width: (r + 3 * scale) * 2, height: (r + 3 * scale) * 2)
                Circle()
                    .fill(color)
                    .frame(width: max(5, r * 2), height: max(5, r * 2))

            case .unlinkedReleased:
                let diamondColor = node.todayGrabs > 0 ? AppTheme.orange : AppTheme.cyan
                let side = max(8, (r * 2 + 2.5) * scale)
                if node.todayGrabs > 0 {
                    PulseHaloCircle(color: diamondColor, baseRadius: side * 0.85)
                }
                DiamondMarkerShape()
                    .fill(diamondColor.opacity(dark ? 0.28 : 0.20))
                    .frame(width: side, height: side)
                DiamondMarkerShape()
                    .stroke(diamondColor, lineWidth: 1.4)
                    .frame(width: side, height: side)

            case .unlinkedUnreleased:
                Circle()
                    .fill(fg3.opacity(0.5))
                    .frame(width: max(3.5, 3.8 * scale), height: max(3.5, 3.8 * scale))
            }

            // hover 高亮环
            Circle()
                .stroke(fg0.opacity(0.7), lineWidth: 1)
                .frame(width: (r + 4 * scale) * 2, height: (r + 4 * scale) * 2)
                .opacity(isHover ? 1 : 0)
            // 命中区（不小于 14px）
            Circle()
                .fill(Color.clear)
                .frame(width: max(14, r * 2 + 6), height: max(14, r * 2 + 6))
                .contentShape(Rectangle())
        }
        .position(x: node.position.x * scale, y: node.position.y * scale)
        .onTapGesture { onNodeTap(node) }
    }

    // MARK: Tooltip（对齐 Web hover 卡片）

    private func tooltip(_ node: RegionMapNode, scale: CGFloat) -> some View {
        let px = node.position.x * scale
        let py = node.position.y * scale
        let viewWidth: CGFloat = 248
        let showRight = px / max(WorldMapData.mapW * scale, 1) < 0.7
        let tipX = showRight ? px + 30 : px - viewWidth - 30
        let tipY = max(4, py - 40)

        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(node.name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(fg0)
                    .lineLimit(1)
                Spacer(minLength: 4)
                StatusBadge(text: node.coverageKind.badgeText, tone: node.coverageKind.tone)
            }
            Text("\(node.code) · \(node.arch.isEmpty ? "ARM" : node.arch)")
                .font(.system(size: 10.5, design: .monospaced))
                .foregroundColor(fg3)
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("历史开机").font(.system(size: 10.5)).foregroundColor(fg3)
                    Text("\(node.totalGrabs)")
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(fg0)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text("今日新增").font(.system(size: 10.5)).foregroundColor(fg3)
                    Text(node.todayGrabs > 0 ? "+\(node.todayGrabs)" : "0")
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(node.todayGrabs > 0 ? AppTheme.orange : fg1.opacity(0.7))
                }
            }
            Divider().overlay(Color(hex: dark ? "363e45" : "d9dfe3"))
            switch node.coverageKind {
            case .linkedActive:
                HStack(spacing: 4) {
                    Circle().fill(AppTheme.sidebarActive).frame(width: 5, height: 5)
                    Text("已关联账号覆盖 · 首次放货 \(node.firstAt)")
                        .font(.system(size: 10))
                        .foregroundColor(AppTheme.sidebarActive)
                }
            case .linkedIdle:
                HStack(spacing: 4) {
                    Circle().fill(AppTheme.info).frame(width: 5, height: 5)
                    Text("已关联账号覆盖 · 暂未监测到放货")
                        .font(.system(size: 10))
                        .foregroundColor(AppTheme.info)
                }
            case .unlinkedReleased:
                HStack(spacing: 4) {
                    DiamondMarkerShape()
                        .stroke(AppTheme.cyan, lineWidth: 1.2)
                        .frame(width: 6, height: 6)
                    Text("官方曾放货 · 尚未关联覆盖（可订阅开拓）")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.cyan)
                }
            case .unlinkedUnreleased:
                Text("未关联 · 尚未放货")
                    .font(.system(size: 10))
                    .foregroundColor(fg3)
            }
        }
        .padding(12)
        .frame(width: viewWidth, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(bg2)
                .shadow(color: Color.black.opacity(dark ? 0.45 : 0.12), radius: 8, y: 3)
        )
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(hex: dark ? "363e45" : "bfc5ca"), lineWidth: 1))
        .position(x: min(max(tipX + viewWidth / 2, viewWidth / 2 + 4), WorldMapData.mapW * scale - viewWidth / 2 - 4),
                  y: min(tipY + 60, WorldMapData.mapH * scale - 70))
        .allowsHitTesting(false)
        .zIndex(20)
    }
}

// MARK: - 动画辅助

/// 持续扩散的光晕（今日新增节点）。
private struct PulseHaloCircle: View {
    var color: Color
    var baseRadius: CGFloat
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(color.opacity(pulse ? 0.0 : 0.22))
            .frame(width: (baseRadius + (pulse ? 4 : 0)) * 2, height: (baseRadius + (pulse ? 4 : 0)) * 2)
            .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: pulse)
            .onAppear { pulse = true }
    }
}

/// 静态半透明光环（已放货节点）。
private struct HaloCircle: View {
    var color: Color
    var radius: CGFloat
    var opacity: Double

    var body: some View {
        Circle()
            .fill(color.opacity(opacity))
            .frame(width: radius * 2, height: radius * 2)
    }
}

/// 地图 hover 判定的缓存（原点/缩放/节点，供全局 mouseMoved 监听器使用）。
final class MapHoverBox {
    var origin: CGPoint = .zero
    var scale: CGFloat = 1
    var nodes: [RegionMapNode] = []
    var currentCode: String = ""
}
