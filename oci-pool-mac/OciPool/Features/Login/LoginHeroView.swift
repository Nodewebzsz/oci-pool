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
    private var orangeAccent: Color { Color(hex: "f59e0b") }
    private var coreFill: Color { Color(hex: dark ? "272c34" : "f2f4f7") }
    private var grid: Color { Color(hex: dark ? "7c848f" : "c8ced6").opacity(0.10) }

    private var zh: Bool { locale == .zhCN || locale == .zhTW }

    private var brandTagline: String { zh ? "多租户池化管理" : "Multi-tenant management" }
    private var heroTitle: String { zh ? "现代化的 OCI 池化管理" : "Modern OCI pool management" }
    private var heroSubtitle: String {
        zh
            ? "14+ 项租户操作 · 45 个 Oracle 商业区域 · 深色主题 · 双语支持 · 现代化 UI 重做,业务逻辑与 doubleDimple/oci-start 完全一致。"
            : "14+ tenant operations · 45 Oracle commercial regions · dark theme · bilingual · a modernised UI on top of the doubleDimple/oci-start business logic."
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
        HStack(spacing: 10) {
            LoginBrandBadge(accent: accent, cyan: cyanAccent)
            VStack(alignment: .leading, spacing: 2) {
                Text("OCI-POOL")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(LoginPalette.text(dark))
                    .tracking(-0.2)
                Text(brandTagline)
                    .font(.system(size: 10))
                    .foregroundColor(LoginPalette.muted(dark))
                    .tracking(0.4)
            }
        }
    }

    // MARK: - Earth art (middle, fills available space)

    private var heroArt: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width, geo.size.height) / viewBox
            let cx = geo.size.width / 2
            let cy = geo.size.height / 2

            ZStack {
                // ambient glow
                Circle()
                    .fill(RadialGradient(gradient: Gradient(colors: [accent.opacity(0.32), cyanAccent.opacity(0.12), Color.clear]),
                                         center: .center, startRadius: 0, endRadius: 280 * scale))
                    .frame(width: 560 * scale, height: 560 * scale)
                    .position(x: cx, y: cy)
                    .blur(radius: 12)

                // grid
                LoginGridShape()
                    .stroke(grid, lineWidth: 1)
                    .frame(width: viewBox * scale, height: viewBox * scale)
                    .position(x: cx, y: cy)

                // concentric rings; middle dashed and rotating
                ForEach(0..<3, id: \.self) { i in
                    let rad: CGFloat = i == 0 ? 210 : (i == 1 ? 160 : 110)
                    let op = 0.15 + Double(i) * 0.08
                    Circle()
                        .stroke(LinearGradient(gradient: Gradient(colors: [accent.opacity(op), cyanAccent.opacity(op * 0.6)]),
                                               startPoint: .topLeading, endPoint: .bottomTrailing),
                                style: StrokeStyle(lineWidth: 1.2,
                                                   dash: i == 1 ? [3, 6] : [],
                                                   dashPhase: i == 1 ? CGFloat(t * 20) : 0))
                        .frame(width: rad * 2 * scale, height: rad * 2 * scale)
                        .position(x: cx, y: cy)
                }

                // data flow lines
                LoginFlowShape()
                    .stroke(accent.opacity(0.16),
                            style: StrokeStyle(lineWidth: 0.8, dash: [2, 3], dashPhase: CGFloat(-t * 20)))
                    .frame(width: viewBox * scale, height: viewBox * scale)
                    .position(x: cx, y: cy)

                // central core
                Circle().fill(coreFill)
                    .frame(width: 104 * scale, height: 104 * scale)
                    .position(x: cx, y: cy)
                Circle().stroke(accent, lineWidth: 2)
                    .frame(width: 104 * scale, height: 104 * scale)
                    .position(x: cx, y: cy)
                Circle().stroke(accent.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
                    .frame(width: 84 * scale, height: 84 * scale)
                    .position(x: cx, y: cy)

                // shield mark
                LoginShieldShape()
                    .fill(accent.opacity(0.15))
                    .frame(width: 30 * scale, height: 30 * scale)
                    .position(x: cx, y: cy)
                LoginShieldShape()
                    .stroke(accent, lineWidth: 1.8 * scale)
                    .frame(width: 30 * scale, height: 30 * scale)
                    .position(x: cx, y: cy)
                LoginCheckShape()
                    .stroke(accent, style: StrokeStyle(lineWidth: 1.6 * scale, lineCap: .round, lineJoin: .round))
                    .frame(width: 30 * scale, height: 30 * scale)
                    .position(x: cx, y: cy)

                // 45 region dots
                ForEach(0..<45, id: \.self) { i in
                    let ang = CGFloat(i) / 45.0 * .pi * 2
                    let x = cx + cos(ang) * 210 * scale
                    let y = cy + sin(ang) * 210 * scale
                    let hot = i % 5 == 2
                    let base: Double = hot ? 0.9 : 0.55
                    let pulse: Double = hot ? (0.9 + 0.35 * sin(t * (2.0 + Double(i % 3)) * 2.0)) : 1.0
                    let col = hot ? orangeAccent : cyanAccent
                    let rad = hot ? 4 * scale : 2 * scale
                    Circle()
                        .fill(col.opacity(min(1, max(0.3, base * pulse))))
                        .frame(width: rad * 2, height: rad * 2)
                        .position(x: x, y: y)
                }
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

// Mini brand badge (top-left logo)
private struct LoginBrandBadge: View {
    var accent: Color
    var cyan: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(LinearGradient(gradient: Gradient(colors: [accent, cyan]),
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 32, height: 32)
            LoginShieldShape()
                .fill(Color.white.opacity(0.16))
                .frame(width: 17, height: 17)
            LoginShieldShape()
                .stroke(Color.white.opacity(0.92), lineWidth: 1.6)
                .frame(width: 17, height: 17)
            LoginCheckShape()
                .stroke(Color.white.opacity(0.92), style: StrokeStyle(lineWidth: 1.4, lineCap: .round, lineJoin: .round))
                .frame(width: 17, height: 17)
        }
        .frame(width: 32, height: 32)
    }
}

// Grid helper lines (web coords 0..600)
private struct LoginGridShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 600
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * s, y: rect.minY + y * s) }
        var p = Path()
        for i in 0..<5 {
            p.move(to: pt(120, 200 + CGFloat(i) * 25))
            p.addLine(to: pt(480, 200 + CGFloat(i) * 25))
        }
        for i in 0..<5 {
            p.move(to: pt(220 + CGFloat(i) * 40, 180))
            p.addLine(to: pt(220 + CGFloat(i) * 40, 420))
        }
        return p
    }
}

// 5 data-flow diagonals from outer edge to core (web coords)
private struct LoginFlowShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 600
        let cx = rect.minX + 300 * s
        let cy = rect.minY + 300 * s
        func edge(_ i: Int) -> CGPoint {
            let ang = CGFloat(i) / 45.0 * .pi * 2
            return CGPoint(x: cx + cos(ang) * 210 * s, y: cy + sin(ang) * 210 * s)
        }
        var p = Path()
        for i in [0, 9, 18, 27, 36] {
            p.move(to: edge(i))
            p.addLine(to: CGPoint(x: cx, y: cy))
        }
        return p
    }
}

// Shield outline centered in the shape frame
private struct LoginShieldShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 30.0
        let cx = rect.midX
        let cy = rect.midY
        var p = Path()
        p.move(to: CGPoint(x: cx, y: cy - 10 * s))
        p.addLine(to: CGPoint(x: cx - 8 * s, y: cy - 6 * s))
        p.addLine(to: CGPoint(x: cx - 8 * s, y: cy))
        p.addQuadCurve(to: CGPoint(x: cx, y: cy + 10 * s), control: CGPoint(x: cx - 8 * s, y: cy + 8 * s))
        p.addQuadCurve(to: CGPoint(x: cx + 8 * s, y: cy), control: CGPoint(x: cx + 8 * s, y: cy + 8 * s))
        p.addLine(to: CGPoint(x: cx + 8 * s, y: cy - 6 * s))
        p.closeSubpath()
        return p
    }
}

private struct LoginCheckShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 30.0
        let cx = rect.midX
        let cy = rect.midY
        var p = Path()
        p.move(to: CGPoint(x: cx - 4 * s, y: cy))
        p.addLine(to: CGPoint(x: cx - 1.5 * s, y: cy + 2.5 * s))
        p.addLine(to: CGPoint(x: cx + 4.5 * s, y: cy - 2.5 * s))
        return p
    }
}
