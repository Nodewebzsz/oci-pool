import SwiftUI

struct BrandGlyphView: View {
    var size: CGFloat
    var color: Color
    var resourceColor: Color? = nil

    private var bounds: CGRect { CGRect(x: 0, y: 0, width: size, height: size) }
    private var stroke: StrokeStyle { StrokeStyle(lineWidth: size * 3.6 / 64, lineCap: .round, lineJoin: .round) }

    var body: some View {
        ZStack {
            Path(BrandGeometry.cloud(in: bounds)).stroke(color, style: stroke)
            Path(BrandGeometry.resource(in: bounds)).fill(resourceColor ?? color)
            Path(BrandGeometry.layers(in: bounds)).stroke(resourceColor ?? color, style: stroke)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

