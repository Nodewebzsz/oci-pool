import SwiftUI

extension View {
    /// Page-local overlay. Prefer empty `message` for native spinner-only style.
    func appLoading(_ isLoading: Bool, message: String = "") -> some View {
        modifier(LoadingOverlay(isLoading: isLoading, message: message))
    }

    /// Embed status overlay (loading HUD + error toast). Prefer shell-level host.
    func withToastHost() -> some View {
        ZStack {
            self
            StatusOverlayHost()
        }
    }

    /// 只对指定角做圆角（分页条贴卡片底部时圆化底角）。
    func cornerRadius(_ radius: CGFloat, corners: CardCorners) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

/// macOS 无 SwiftUI.RectCorner，自建角位集合。
struct CardCorners: OptionSet {
    let rawValue: Int
    static let topLeft = CardCorners(rawValue: 1 << 0)
    static let topRight = CardCorners(rawValue: 1 << 1)
    static let bottomLeft = CardCorners(rawValue: 1 << 2)
    static let bottomRight = CardCorners(rawValue: 1 << 3)
}

struct RoundedCorner: Shape {
    var radius: CGFloat
    var corners: CardCorners

    func path(in rect: CGRect) -> Path {
        let r = min(radius, rect.width / 2, rect.height / 2)
        return Path { p in
            p.move(to: CGPoint(x: rect.minX, y: corners.contains(.topLeft) ? rect.minY + r : rect.minY))
            p.addLine(to: CGPoint(x: corners.contains(.topRight) ? rect.maxX - r : rect.maxX, y: rect.minY))
            p.addArc(
                center: CGPoint(x: corners.contains(.topRight) ? rect.maxX - r : rect.maxX,
                                y: corners.contains(.topRight) ? rect.minY + r : rect.minY),
                radius: corners.contains(.topRight) ? r : 0,
                startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false
            )
            p.addLine(to: CGPoint(x: rect.maxX, y: corners.contains(.bottomRight) ? rect.maxY - r : rect.maxY))
            p.addArc(
                center: CGPoint(x: corners.contains(.bottomRight) ? rect.maxX - r : rect.maxX,
                                y: corners.contains(.bottomRight) ? rect.maxY - r : rect.maxY),
                radius: corners.contains(.bottomRight) ? r : 0,
                startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false
            )
            p.addLine(to: CGPoint(x: corners.contains(.bottomLeft) ? rect.minX + r : rect.minX, y: rect.maxY))
            p.addArc(
                center: CGPoint(x: corners.contains(.bottomLeft) ? rect.minX + r : rect.minX,
                                y: corners.contains(.bottomLeft) ? rect.maxY - r : rect.maxY),
                radius: corners.contains(.bottomLeft) ? r : 0,
                startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false
            )
            p.addLine(to: CGPoint(x: rect.minX, y: corners.contains(.topLeft) ? rect.minY + r : rect.minY))
            p.addArc(
                center: CGPoint(x: corners.contains(.topLeft) ? rect.minX + r : rect.minX,
                                y: corners.contains(.topLeft) ? rect.minY + r : rect.minY),
                radius: corners.contains(.topLeft) ? r : 0,
                startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false
            )
            p.closeSubpath()
        }
    }
}
