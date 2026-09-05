import SwiftUI
import AppKit
import Combine

/// Left hero panel — replicates the web AuthHeroArt:
/// Globe core, 45 orbiting region dots, concentric rings, shield mark, data-flow lines.
/// macOS 11 compatible (no Canvas / TimelineView).
struct LoginHeroView: View {
    var dark: Bool
    var crying: Bool = false
    var shyMode: Bool = false

    @State private var t: TimeInterval = 0
    private let viewBox: CGFloat = 600

    private var accent: Color { Color(hex: dark ? "34d399" : "0f766e") }
    private var cyanAccent: Color { Color(hex: "22d3ee") }
    private var orangeAccent: Color { Color(hex: "f59e0b") }
    private var coreFill: Color { Color(hex: dark ? "272c34" : "f2f4f7") }
    private var grid: Color { Color(hex: dark ? "7c848f" : "c8ced6").opacity(0.10) }

    var body: some View {
        ZStack {
            LoginPalette.panel(dark)

            RadialGradient(
                gradient: Gradient(colors: [accent.opacity(dark ? 0.14 : 0.12), Color.clear]),
                center: UnitPoint(x: 0.3, y: 0.2), startRadius: 10, endRadius: 260
            )
            RadialGradient(
                gradient: Gradient(colors: [cyanAccent.opacity(0.10), Color.clear]),
                center: UnitPoint(x: 0.8, y: 0.8), startRadius: 10, endRadius: 240
            )

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
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .onReceive(Timer.publish(every: 1.0 / 30.0, on: .main, in: .common).autoconnect()) { _ in
            t += 1.0 / 30.0
        }
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
