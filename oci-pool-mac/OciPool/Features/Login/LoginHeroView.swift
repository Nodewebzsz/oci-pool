import SwiftUI
import AppKit
import Combine

/// Left hero panel — replicates the web AuthHeroArt:
/// Globe core, 45 orbiting region dots, concentric rings, shield mark, data-flow lines.
/// Adds the web brand hero copy (mini logo bar on top, earth art in the middle,
/// headline + subtitle + three-column stats at the bottom) and adapts to the
/// client window height (compresses the art; scrolls on very short windows).
/// macOS 11 compatible (no Canvas / TimelineView / GraphicsContext / .overlay(alignment:)).
struct LoginHeroView: View {
    var dark: Bool
    var crying: Bool = false
    var shyMode: Bool = false
    var locale: AppLocale = .zhCN

    @State private var t: TimeInterval = 0
    private let viewBox: CGFloat = 600

    private var accent: Color { Color(hex: "34d399") }
    private var cyanAccent: Color { Color(hex: "22d3ee") }
    private var orangeAccent: Color { AppTheme.orange }
    private var coreFill: Color { Color(hex: dark ? "272c34" : "f2f4f7") }
    private var grid: Color { Color(hex: dark ? "7c848f" : "c8ced6").opacity(0.10) }

    private var zh: Bool { locale == .zhCN || locale == .zhTW }

    private var brandTagline: String { zh ? "多租户池化管理" : "Multi-tenant management" }
    private var heroTitle: String { zh ? "现代化的 OCI 池化管理" : "Modern OCI pool management" }
    private var heroSubtitle: String {
        zh
            ? "14+ 项租户操作 · 45 个 Oracle 商业区域 · 深色主题 · 双语支持 · 现代化 UI 重做，自主优化升级。"
            : "14+ tenant operations · 45 Oracle commercial regions · dark theme · bilingual · a modernised UI with enhanced features."
    }
    private var statTenants: String { zh ? "内置租户" : "Tenants" }
    private var statRegions: String { zh ? "全球区域" : "Regions" }
    private var statUptime: String { zh ? "在线时间" : "Uptime" }

    var body: some View {
        ZStack {
            // Web hero 背景：linear-gradient(135deg, var(--bg-1), var(--bg-0))
            LinearGradient(
                gradient: Gradient(colors: dark
                    ? [Color(hex: "0d1216"), Color(hex: "060a0d")]
                    : [Color(hex: "ffffff"), Color(hex: "f8fafd")]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                gradient: Gradient(colors: [accent.opacity(dark ? 0.14 : 0.12), Color.clear]),
                center: UnitPoint(x: 0.3, y: 0.2), startRadius: 10, endRadius: 260
            )
            RadialGradient(
                gradient: Gradient(colors: [cyanAccent.opacity(0.10), Color.clear]),
                center: UnitPoint(x: 0.8, y: 0.8), startRadius: 10, endRadius: 240
            )

            GeometryReader { geo in
                let compact = geo.size.height < 640
                let artH = min(max(geo.size.height - 320, 160), 280)

                Group {
                    if compact {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 0) {
                                brandHeader
                                    .padding(.top, 24)
                                    .padding(.horizontal, 40)
                                heroArt
                                    .frame(height: artH)
                                    .padding(.vertical, 12)
                                bottomCopy
                                    .padding(.horizontal, 40)
                                    .padding(.bottom, 24)
                            }
                            .frame(width: geo.size.width)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 0) {
                            brandHeader
                                .padding(.top, 26)
                                .padding(.horizontal, 40)
                            heroArt
                                .padding(.horizontal, 12)
                                .padding(.vertical, 12)
                            bottomCopy
                                .padding(.horizontal, 40)
                                .padding(.bottom, 30)
                        }
                        .frame(width: geo.size.width, height: geo.size.height)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .onReceive(Timer.publish(every: 1.0 / 30.0, on: .main, in: .common).autoconnect()) { _ in
            t += 1.0 / 30.0
        }
    }

    // MARK: - Brand header (top)

    private var brandHeader: some View {
        HStack(spacing: 12) {
            LoginBrandBadge(size: 38, accent: accent, cyan: cyanAccent)
            VStack(alignment: .leading, spacing: 3) {
                Text("OCI-POOL")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(LoginPalette.text(dark))
                    .tracking(-0.2)
                Text(brandTagline)
                    .font(.system(size: 11))
                    .foregroundColor(LoginPalette.muted(dark))
                    .tracking(0.4)
            }
        }
    }

    // MARK: - Global Topology Art (replicates Web AuthHeroArt 1:1)

    private var heroArt: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width, geo.size.height) / 530.0
            let cx = geo.size.width / 2
            let cy = geo.size.height / 2

            ZStack {
                // 1. HUD 顶部经纬点阵标题
                Text("OCI-POOL · 45 REGIONS GLOBAL TOPOLOGY")
                    .font(.system(size: max(8, 9 * scale), weight: .semibold, design: .monospaced))
                    .foregroundColor(LoginPalette.muted(dark))
                    .tracking(2.0)
                    .opacity(0.65)
                    .position(x: cx, y: cy - 212 * scale)

                // 2. HUD 四角定位准星
                HudCrosshairs(scale: scale, cx: cx, cy: cy, color: LoginPalette.muted(dark).opacity(0.35))

                // 3. 大气层环境晕光
                Circle()
                    .fill(RadialGradient(gradient: Gradient(colors: [accent.opacity(dark ? 0.30 : 0.20), cyanAccent.opacity(0.08), Color.clear]),
                                         center: .center, startRadius: 0, endRadius: 220 * scale))
                    .frame(width: 440 * scale, height: 440 * scale)
                    .position(x: cx, y: cy)
                    .blur(radius: 10)

                // 4. 地球轮廓基盘
                Circle()
                    .stroke(LinearGradient(gradient: Gradient(colors: [accent.opacity(0.8), cyanAccent.opacity(0.3), accent.opacity(0.1)]),
                                           startPoint: .topLeading, endPoint: .bottomTrailing),
                            lineWidth: 1.6)
                    .frame(width: 400 * scale, height: 400 * scale)
                    .position(x: cx, y: cy)

                // 5. 23.5° 空间物理倾角：外层自转天体环
                ZStack {
                    Ellipse()
                        .stroke(accent.opacity(0.4), style: StrokeStyle(lineWidth: 1.2, dash: [8, 6], dashPhase: CGFloat(t * 12)))
                        .frame(width: 472 * scale, height: 136 * scale)
                    Ellipse()
                        .stroke(cyanAccent.opacity(0.25), style: StrokeStyle(lineWidth: 0.8, dash: [20, 120, 40, 80], dashPhase: CGFloat(-t * 15)))
                        .frame(width: 496 * scale, height: 144 * scale)
                }
                .rotationEffect(.degrees(-22))
                .position(x: cx, y: cy)

                // 6. 3D 经纬球体骨架（纬线 + 经线 + 地轴）
                GlobeWireframe(scale: scale, cx: cx, cy: cy, cyan: cyanAccent)

                // 7. 中心发散的声呐心跳波纹 (Sonar Waves)
                SonarRippleWaves(scale: scale, cx: cx, cy: cy, t: t, accent: accent, cyan: cyanAccent)

                // 8. 动态弧线光缆飞线 (Curved Data Beams)
                CurvedDataBeams(scale: scale, cx: cx, cy: cy, t: t, accent: accent, orange: orangeAccent)

                // 9. 真实 OCI 区域节点与微徽章
                RegionNodesLayer(scale: scale, cx: cx, cy: cy, t: t, accent: accent, cyan: cyanAccent, orange: orangeAccent, dark: dark)

                // 10. 中心 OCI 算力中枢反应堆
                CentralComputeCore(scale: scale, cx: cx, cy: cy, t: t, accent: accent, cyan: cyanAccent, coreFill: coreFill, dark: dark)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    // MARK: - Bottom copy

    private var bottomCopy: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(heroTitle)
                .font(.system(size: 30, weight: .heavy))
                .foregroundColor(LoginPalette.text(dark))
                .tracking(-0.8)
                .lineSpacing(2)

            Text(heroSubtitle)
                .font(.system(size: 13.5))
                .foregroundColor(LoginPalette.muted(dark))
                .lineSpacing(4)
                .padding(.top, 10)
                .frame(maxWidth: 460, alignment: .leading)

            HStack(alignment: .top, spacing: 32) {
                statItem("14+", statTenants)
                statItem("45", statRegions)
                statItem("24/7", statUptime)
            }
            .padding(.top, 20)
        }
    }

    private func statItem(_ num: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(num)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(accent)
                .tracking(-0.4)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(LoginPalette.muted(dark))
                .tracking(0.3)
        }
    }
}

// Mini brand badge (top-left logo) — 与 Web 端 PoolBrandMark 1:1 精确对齐
private struct LoginBrandBadge: View {
    var size: CGFloat = 38
    var accent: Color
    var cyan: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * (10.0 / 34.0))
                .fill(LinearGradient(gradient: Gradient(colors: [accent, cyan]),
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: size, height: size)
            PoolBrandGlyphStroke()
                .stroke(Color(hex: "0e2a22"),
                        style: StrokeStyle(lineWidth: size * (2.0 / 36.0), lineCap: .round, lineJoin: .round))
                .frame(width: size, height: size)
            PoolBrandGlyphDots()
                .fill(Color(hex: "0e2a22"))
                .frame(width: size, height: size)
        }
        .frame(width: size, height: size)
    }
}

// 严格对齐 Web 端 PoolBrandMark SVG（viewBox="0 0 36 36"）
// <path d="M10 20.4a4.2 4.2 0 0 1 2.6-7.5 6.1 6.1 0 0 1 11.6 1.2 3.7 3.7 0 0 1 .7 7.3H11.2" stroke-width="2" stroke-linecap="round"/>
// <path d="M13 23.9v-2.5 M18 23.9v-2.5 M23 23.9v-2.5" stroke-width="1.4"/>
private struct PoolBrandGlyphStroke: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 36.0
        let sy = rect.height / 36.0
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }
        var path = Path()
        // 1. 云朵外轮廓（Web SVG 精确三段贝塞尔弧）
        path.move(to: p(10, 20.4))
        path.addCurve(to: p(12.6, 12.9), control1: p(10, 16.6), control2: p(10.6, 14.5))
        path.addCurve(to: p(24.2, 14.1), control1: p(14.4, 7.4), control2: p(22.5, 8.2))
        path.addCurve(to: p(24.9, 21.4), control1: p(28.6, 14.3), control2: p(29.1, 20.5))
        path.addLine(to: p(11.2, 21.4))
        // 2. 底部三根连接虚线立柱 (M13 23.9v-2.5 ...)
        for x: CGFloat in [13.0, 18.0, 23.0] {
            path.move(to: p(x, 23.9))
            path.addLine(to: p(x, 21.4))
        }
        return path
    }
}

// 底部三个云池节点圆点（Web SVG cx="13/18/23", cy="25.5", r="1.6"）
private struct PoolBrandGlyphDots: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 36.0
        let sy = rect.height / 36.0
        var path = Path()
        let r: CGFloat = 1.6 * min(sx, sy)
        for x: CGFloat in [13.0, 18.0, 23.0] {
            let cx = rect.minX + x * sx
            let cy = rect.minY + 25.5 * sy
            path.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
        }
        return path
    }
}

// MARK: - HUD Crosshairs
private struct HudCrosshairs: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var color: Color

    var body: some View {
        Path { p in
            let d: CGFloat = 180 * scale
            let s: CGFloat = 8 * scale
            // Top-left
            p.move(to: CGPoint(x: cx - d, y: cy - d + s))
            p.addLine(to: CGPoint(x: cx - d, y: cy - d))
            p.addLine(to: CGPoint(x: cx - d + s, y: cy - d))
            // Top-right
            p.move(to: CGPoint(x: cx + d - s, y: cy - d))
            p.addLine(to: CGPoint(x: cx + d, y: cy - d))
            p.addLine(to: CGPoint(x: cx + d, y: cy - d + s))
            // Bottom-left
            p.move(to: CGPoint(x: cx - d, y: cy + d - s))
            p.addLine(to: CGPoint(x: cx - d, y: cy + d))
            p.addLine(to: CGPoint(x: cx - d + s, y: cy + d))
            // Bottom-right
            p.move(to: CGPoint(x: cx + d - s, y: cy + d))
            p.addLine(to: CGPoint(x: cx + d, y: cy + d))
            p.addLine(to: CGPoint(x: cx + d, y: cy + d - s))
        }
        .stroke(color, lineWidth: 1)
    }
}

// MARK: - Globe Wireframe
private struct GlobeWireframe: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var cyan: Color

    var body: some View {
        ZStack {
            // 纬线
            Ellipse()
                .stroke(cyan.opacity(0.2), style: StrokeStyle(lineWidth: 0.9, dash: [3, 3]))
                .frame(width: 330 * scale, height: 92 * scale)
                .position(x: cx, y: cy - 75 * scale)
            Ellipse()
                .stroke(cyan.opacity(0.35), lineWidth: 1.2)
                .frame(width: 400 * scale, height: 116 * scale)
                .position(x: cx, y: cy)
            Ellipse()
                .stroke(cyan.opacity(0.2), style: StrokeStyle(lineWidth: 0.9, dash: [3, 3]))
                .frame(width: 330 * scale, height: 92 * scale)
                .position(x: cx, y: cy + 75 * scale)

            // 经线
            Ellipse()
                .stroke(cyan.opacity(0.3), lineWidth: 1.0)
                .frame(width: 130 * scale, height: 400 * scale)
                .position(x: cx, y: cy)
            Ellipse()
                .stroke(cyan.opacity(0.25), style: StrokeStyle(lineWidth: 0.9, dash: [4, 3]))
                .frame(width: 270 * scale, height: 400 * scale)
                .position(x: cx, y: cy)

            // 地轴线
            Path { p in
                p.move(to: CGPoint(x: cx, y: cy - 205 * scale))
                p.addLine(to: CGPoint(x: cx, y: cy + 205 * scale))
            }
            .stroke(cyan.opacity(0.2), style: StrokeStyle(lineWidth: 0.8, dash: [4, 4]))
        }
    }
}

// MARK: - Sonar Ripple Waves
private struct SonarRippleWaves: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var t: TimeInterval
    var accent: Color
    var cyan: Color

    var body: some View {
        let p1 = (t.truncatingRemainder(dividingBy: 3.6)) / 3.6
        let r1 = (50.0 + p1 * 160.0) * scale
        let op1 = max(0, 0.7 * (1.0 - p1))

        let p2 = ((t + 1.8).truncatingRemainder(dividingBy: 3.6)) / 3.6
        let r2 = (50.0 + p2 * 160.0) * scale
        let op2 = max(0, 0.6 * (1.0 - p2))

        return ZStack {
            Circle()
                .stroke(accent.opacity(op1), lineWidth: 1.5 * (1.0 - p1 * 0.5))
                .frame(width: r1 * 2, height: r1 * 2)
                .position(x: cx, y: cy)

            Circle()
                .stroke(cyan.opacity(op2), lineWidth: 1.2 * (1.0 - p2 * 0.5))
                .frame(width: r2 * 2, height: r2 * 2)
                .position(x: cx, y: cy)
        }
    }
}

// MARK: - Curved Data Beams
private struct CurvedDataBeams: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var t: TimeInterval
    var accent: Color
    var orange: Color

    var body: some View {
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: cx + (x - 300) * scale, y: cy + (y - 300) * scale)
        }

        return ZStack {
            // 美西 PHX 飞线: (160, 210) -> (260, 290) ctrl (210, 280)
            Path { path in
                path.move(to: p(160, 210))
                path.addQuadCurve(to: p(260, 290), control: p(210, 280))
            }
            .stroke(accent.opacity(0.6), style: StrokeStyle(lineWidth: 1.4, dash: [5, 4], dashPhase: CGFloat(-t * 22)))

            // 欧洲 FRA 飞线: (330, 155) -> (300, 260) ctrl (310, 220)
            Path { path in
                path.move(to: p(330, 155))
                path.addQuadCurve(to: p(300, 260), control: p(310, 220))
            }
            .stroke(accent.opacity(0.6), style: StrokeStyle(lineWidth: 1.4, dash: [6, 4], dashPhase: CGFloat(-t * 20)))

            // 亚太 NRT 飞线: (425, 210) -> (338, 285) ctrl (370, 240)
            Path { path in
                path.move(to: p(425, 210))
                path.addQuadCurve(to: p(338, 285), control: p(370, 240))
            }
            .stroke(orange.opacity(0.7), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3], dashPhase: CGFloat(-t * 26)))

            // 亚太 SIN 飞线: (390, 385) -> (325, 330) ctrl (350, 330)
            Path { path in
                path.move(to: p(390, 385))
                path.addQuadCurve(to: p(325, 330), control: p(350, 330))
            }
            .stroke(accent.opacity(0.55), style: StrokeStyle(lineWidth: 1.4, dash: [6, 4], dashPhase: CGFloat(-t * 24)))

            // 南美 GRU 飞线: (180, 375) -> (265, 315) ctrl (230, 330)
            Path { path in
                path.move(to: p(180, 375))
                path.addQuadCurve(to: p(265, 315), control: p(230, 330))
            }
            .stroke(accent.opacity(0.45), style: StrokeStyle(lineWidth: 1.3, dash: [5, 5], dashPhase: CGFloat(-t * 20)))
        }
    }
}

// MARK: - Region Nodes Layer
private struct RegionNodesLayer: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var t: TimeInterval
    var accent: Color
    var cyan: Color
    var orange: Color
    var dark: Bool

    // 区域坐标点表 (1:1 对齐 Web)
    private struct NodeItem {
        let x: CGFloat
        let y: CGFloat
        let code: String
        let hot: Bool
        let tagX: CGFloat
        let tagY: CGFloat
    }

    private let nodes: [NodeItem] = [
        NodeItem(x: 160, y: 210, code: "US-PHX", hot: true, tagX: -52, tagY: -10),
        NodeItem(x: 220, y: 175, code: "US-IAD", hot: false, tagX: -48, tagY: -12),
        NodeItem(x: 330, y: 155, code: "EU-FRA", hot: true, tagX: 10, tagY: -12),
        NodeItem(x: 425, y: 210, code: "AP-NRT", hot: true, tagX: 12, tagY: -10),
        NodeItem(x: 440, y: 310, code: "AP-ICN", hot: false, tagX: 12, tagY: -2),
        NodeItem(x: 390, y: 385, code: "AP-SIN", hot: true, tagX: 12, tagY: 6),
        NodeItem(x: 330, y: 415, code: "AP-SYD", hot: false, tagX: 10, tagY: 10),
        NodeItem(x: 180, y: 375, code: "SA-GRU", hot: false, tagX: -50, tagY: 10),
        NodeItem(x: 130, y: 310, code: "ME-DXB", hot: true, tagX: -48, tagY: 4),
        NodeItem(x: 250, y: 250, code: "", hot: false, tagX: 0, tagY: 0),
        NodeItem(x: 360, y: 260, code: "", hot: false, tagX: 0, tagY: 0),
        NodeItem(x: 275, y: 345, code: "", hot: false, tagX: 0, tagY: 0),
        NodeItem(x: 430, y: 260, code: "", hot: false, tagX: 0, tagY: 0),
        NodeItem(x: 170, y: 270, code: "", hot: false, tagX: 0, tagY: 0)
    ]

    var body: some View {
        ZStack {
            ForEach(0..<nodes.count, id: \.self) { i in
                let n = nodes[i]
                let nx = cx + (n.x - 300) * scale
                let ny = cy + (n.y - 300) * scale

                // 热点水波纹
                if n.hot {
                    let pulsePhase = sin(t * 3.0 + Double(i)) * 0.5 + 0.5
                    let ripR = (6.0 + pulsePhase * 8.0) * scale
                    Circle()
                        .stroke(orange.opacity(0.7 * (1.0 - pulsePhase)), lineWidth: 1)
                        .frame(width: ripR * 2, height: ripR * 2)
                        .position(x: nx, y: ny)
                }

                // 节点实体圆
                Circle()
                    .fill(n.hot ? orange : cyan)
                    .frame(width: (n.hot ? 8 : 5.5) * scale, height: (n.hot ? 8 : 5.5) * scale)
                    .position(x: nx, y: ny)

                // 地标文字微徽章
                if !n.code.isEmpty {
                    let tx = nx + n.tagX * scale
                    let ty = ny + n.tagY * scale
                    ZStack {
                        RoundedRectangle(cornerRadius: 3 * scale)
                            .fill(Color(hex: dark ? "161b22" : "ffffff").opacity(0.85))
                            .overlay(
                                RoundedRectangle(cornerRadius: 3 * scale)
                                    .stroke(n.hot ? orange.opacity(0.6) : cyan.opacity(0.5), lineWidth: 0.8)
                            )
                            .frame(width: 42 * scale, height: 15 * scale)

                        Text(n.code)
                            .font(.system(size: 8.5 * scale, weight: .bold, design: .monospaced))
                            .foregroundColor(n.hot ? orange : LoginPalette.text(dark))
                    }
                    .position(x: tx + 21 * scale, y: ty + 7.5 * scale)
                }
            }
        }
    }
}

// MARK: - Central Compute Core
private struct CentralComputeCore: View {
    var scale: CGFloat
    var cx: CGFloat
    var cy: CGFloat
    var t: TimeInterval
    var accent: Color
    var cyan: Color
    var coreFill: Color
    var dark: Bool

    var body: some View {
        ZStack {
            // 外层氛围晕光
            Circle()
                .fill(RadialGradient(gradient: Gradient(colors: [accent.opacity(0.35), Color.clear]),
                                     center: .center, startRadius: 0, endRadius: 65 * scale))
                .frame(width: 130 * scale, height: 130 * scale)
                .position(x: cx, y: cy)

            // 外部 HUD 刻度齿轮环 (反向旋转)
            Circle()
                .stroke(cyan.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [3, 4], dashPhase: CGFloat(-t * 15)))
                .frame(width: 104 * scale, height: 104 * scale)
                .position(x: cx, y: cy)

            Circle()
                .stroke(accent.opacity(0.75), style: StrokeStyle(lineWidth: 1.8, dash: [16, 8, 8, 8], dashPhase: CGFloat(t * 18)))
                .frame(width: 92 * scale, height: 92 * scale)
                .position(x: cx, y: cy)

            // 磨砂玻璃底盘
            Circle()
                .fill(Color(hex: dark ? "161b22" : "f8fafc"))
                .frame(width: 76 * scale, height: 76 * scale)
                .position(x: cx, y: cy)

            Circle()
                .stroke(accent, lineWidth: 1.8)
                .frame(width: 76 * scale, height: 76 * scale)
                .position(x: cx, y: cy)

            Circle()
                .stroke(Color(hex: dark ? "30363d" : "e2e8f0"), lineWidth: 1)
                .frame(width: 64 * scale, height: 64 * scale)
                .position(x: cx, y: cy)

            // OCI 云池芯片徽标
            PoolBrandGlyphStroke()
                .stroke(accent, style: StrokeStyle(lineWidth: 2 * scale, lineCap: .round, lineJoin: .round))
                .frame(width: 44 * scale, height: 44 * scale)
                .position(x: cx, y: cy)

            PoolBrandGlyphDots()
                .fill(accent)
                .frame(width: 44 * scale, height: 44 * scale)
                .position(x: cx, y: cy)
        }
    }
}
