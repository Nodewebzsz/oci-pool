import CoreGraphics

enum BrandGeometry {
    static func cloud(in rect: CGRect) -> CGPath {
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 20, y: 44))
        path.addLine(to: CGPoint(x: 18, y: 44))
        path.addCurve(to: CGPoint(x: 9, y: 35), control1: CGPoint(x: 13.03, y: 44), control2: CGPoint(x: 9, y: 39.97))
        path.addCurve(to: CGPoint(x: 17, y: 26.06), control1: CGPoint(x: 9, y: 30.4), control2: CGPoint(x: 12.45, y: 26.6))
        path.addCurve(to: CGPoint(x: 30.7, y: 13), control1: CGPoint(x: 17.8, y: 18.7), control2: CGPoint(x: 23.2, y: 13))
        path.addCurve(to: CGPoint(x: 44, y: 24), control1: CGPoint(x: 37.6, y: 13), control2: CGPoint(x: 42.8, y: 17.5))
        path.addCurve(to: CGPoint(x: 54.95, y: 33.8), control1: CGPoint(x: 50, y: 23.6), control2: CGPoint(x: 54.95, y: 28.2))
        path.addCurve(to: CGPoint(x: 46, y: 43.8), control1: CGPoint(x: 54.95, y: 38.8), control2: CGPoint(x: 51, y: 43.8))
        path.addLine(to: CGPoint(x: 44, y: 43.8))
        return scaled(path, in: rect)
    }

    static func resource(in rect: CGRect) -> CGPath {
        let path = CGMutablePath()
        path.move(to: CGPoint(x: 32, y: 30))
        path.addLine(to: CGPoint(x: 43, y: 36))
        path.addLine(to: CGPoint(x: 32, y: 42))
        path.addLine(to: CGPoint(x: 21, y: 36))
        path.closeSubpath()
        return scaled(path, in: rect)
    }

    static func layers(in rect: CGRect) -> CGPath {
        let path = CGMutablePath()
        for level in [CGFloat(42), CGFloat(49)] {
            path.move(to: CGPoint(x: 22, y: level))
            path.addLine(to: CGPoint(x: 32, y: level + 5.5))
            path.addLine(to: CGPoint(x: 42, y: level))
        }
        return scaled(path, in: rect)
    }

    private static func scaled(_ path: CGPath, in rect: CGRect) -> CGPath {
        var transform = CGAffineTransform(translationX: rect.minX, y: rect.minY)
            .scaledBy(x: rect.width / 64, y: rect.height / 64)
        return path.copy(using: &transform) ?? path
    }
}
