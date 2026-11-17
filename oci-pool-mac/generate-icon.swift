import AppKit
import CoreGraphics

private let iconSizes = [16, 32, 64, 128, 256, 512, 1024]

private func color(_ red: Int, _ green: Int, _ blue: Int, alpha: CGFloat = 1) -> CGColor {
    NSColor(srgbRed: CGFloat(red) / 255, green: CGFloat(green) / 255, blue: CGFloat(blue) / 255, alpha: alpha).cgColor
}

private func makeBitmap(size: Int) -> NSBitmapImageRep {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else {
        fatalError("无法创建图标画布")
    }
    bitmap.size = NSSize(width: size, height: size)
    return bitmap
}

private func drawIcon(into bitmap: NSBitmapImageRep, pixelSize: Int) {
    guard let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("无法创建绘图上下文") }
    NSGraphicsContext.saveGraphicsState()
    defer { NSGraphicsContext.restoreGraphicsState() }
    NSGraphicsContext.current = graphics
    let context = graphics.cgContext
    context.clear(CGRect(x: 0, y: 0, width: pixelSize, height: pixelSize))
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    context.translateBy(x: 0, y: CGFloat(pixelSize))
    context.scaleBy(x: CGFloat(pixelSize) / 64, y: -CGFloat(pixelSize) / 64)
    let bounds = CGRect(x: 4, y: 4, width: 56, height: 56)
    let background = CGPath(roundedRect: bounds, cornerWidth: 15, cornerHeight: 15, transform: nil)
    context.addPath(background)
    context.setFillColor(color(38, 35, 31))
    context.fillPath()
    context.addPath(background)
    context.setStrokeColor(color(250, 249, 245, alpha: 0.12))
    context.setLineWidth(0.6)
    context.strokePath()
    context.setLineWidth(3.2)
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.addPath(BrandGeometry.cloud(in: bounds))
    context.setStrokeColor(color(250, 249, 245))
    context.strokePath()
    context.addPath(BrandGeometry.resource(in: bounds))
    context.setFillColor(color(204, 120, 92))
    context.fillPath()
    context.addPath(BrandGeometry.layers(in: bounds))
    context.setStrokeColor(color(204, 120, 92))
    context.strokePath()
    graphics.flushGraphics()
}

@main
struct IconGenerator {
    static func main() throws {
        let directory = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "OciPool/Assets.xcassets/AppIcon.appiconset"
        let output = URL(fileURLWithPath: directory)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        for size in iconSizes {
            let bitmap = makeBitmap(size: size)
            drawIcon(into: bitmap, pixelSize: size)
            guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("PNG 编码失败") }
            try png.write(to: output.appendingPathComponent("icon_\(size).png"))
        }
        print("已生成 7 个尺寸的 OCI-POOL 云资源池图标")
    }
}
