#!/usr/bin/env swift
// 生成与 Web favicon 一致的 OCI-POOL 云池品牌图标。
import AppKit
import CoreGraphics

let outputDirectory = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "OciPool/Assets.xcassets/AppIcon.appiconset"

let iconSizes = [16, 32, 64, 128, 256, 512, 1024]

private let canvasSize: CGFloat = 36

private func color(_ red: Int, _ green: Int, _ blue: Int, alpha: CGFloat = 1) -> CGColor {
    NSColor(
        calibratedRed: CGFloat(red) / 255,
        green: CGFloat(green) / 255,
        blue: CGFloat(blue) / 255,
        alpha: alpha
    ).cgColor
}

private func makeBitmap(size: Int) -> NSBitmapImageRep {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fatalError("无法创建 \(size)x\(size) 图标画布")
    }
    bitmap.size = NSSize(width: size, height: size)
    return bitmap
}

private func drawIcon(into bitmap: NSBitmapImageRep, pixelSize: Int) {
    guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("无法创建 \(pixelSize)x\(pixelSize) 图标绘图上下文")
    }

    NSGraphicsContext.saveGraphicsState()
    defer { NSGraphicsContext.restoreGraphicsState() }
    NSGraphicsContext.current = graphicsContext

    let context = graphicsContext.cgContext
    let scale = CGFloat(pixelSize) / canvasSize

    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: x * scale, y: CGFloat(pixelSize) - y * scale)
    }

    func rect(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) -> CGRect {
        CGRect(
            x: x * scale,
            y: CGFloat(pixelSize) - (y + height) * scale,
            width: width * scale,
            height: height * scale
        )
    }

    let canvas = CGRect(x: 0, y: 0, width: pixelSize, height: pixelSize)
    context.clear(canvas)
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    context.interpolationQuality = .high

    // 与 favicon.svg 相同的 34x34 圆角渐变底板。
    let background = CGPath(
        roundedRect: rect(x: 1, y: 1, width: 34, height: 34),
        cornerWidth: 10 * scale,
        cornerHeight: 10 * scale,
        transform: nil
    )
    guard let gradient = CGGradient(
        colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [color(34, 197, 94), color(34, 211, 238)] as CFArray,
        locations: [0, 1]
    ) else {
        fatalError("无法创建品牌渐变")
    }

    context.saveGState()
    context.addPath(background)
    context.clip()
    context.drawLinearGradient(
        gradient,
        start: point(4, 3),
        end: point(31, 33),
        options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
    )
    context.restoreGState()

    // 云轮廓沿用 Web favicon 的视觉比例，并以贝塞尔曲线适配所有图标尺寸。
    let cloud = CGMutablePath()
    cloud.move(to: point(10, 20.4))
    cloud.addCurve(
        to: point(12.6, 12.9),
        control1: point(7.2, 19.1),
        control2: point(8.2, 14.2)
    )
    cloud.addCurve(
        to: point(24.2, 14.1),
        control1: point(14.4, 7.4),
        control2: point(22.5, 8.2)
    )
    cloud.addCurve(
        to: point(24.9, 21.4),
        control1: point(28.6, 14.3),
        control2: point(29.1, 20.5)
    )
    cloud.addLine(to: point(11.2, 21.4))

    let ink = color(15, 23, 42)
    context.addPath(cloud)
    context.setStrokeColor(ink)
    context.setLineWidth(max(1, 2 * scale))
    context.setLineCap(.round)
    context.setLineJoin(.round)
    context.strokePath()

    let nodeRadius = max(0.8, 1.6 * scale)
    let nodeLineWidth = max(0.8, 1.4 * scale)
    for nodeX: CGFloat in [13, 18, 23] {
        context.setStrokeColor(ink)
        context.setLineWidth(nodeLineWidth)
        context.setLineCap(.butt)
        context.move(to: point(nodeX, 23.9))
        context.addLine(to: point(nodeX, 21.4))
        context.strokePath()

        let center = point(nodeX, 25.5)
        context.setFillColor(ink)
        context.fillEllipse(
            in: CGRect(
                x: center.x - nodeRadius,
                y: center.y - nodeRadius,
                width: nodeRadius * 2,
                height: nodeRadius * 2
            )
        )
    }

    graphicsContext.flushGraphics()
}

do {
    try FileManager.default.createDirectory(
        at: URL(fileURLWithPath: outputDirectory),
        withIntermediateDirectories: true
    )
} catch {
    fatalError("无法创建图标输出目录：\(error.localizedDescription)")
}

for size in iconSizes {
    let bitmap = makeBitmap(size: size)
    drawIcon(into: bitmap, pixelSize: size)

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("无法编码 icon_\(size).png")
    }

    let outputURL = URL(fileURLWithPath: outputDirectory)
        .appendingPathComponent("icon_\(size).png")
    do {
        try png.write(to: outputURL)
        print("已生成 \(outputURL.path)")
    } catch {
        fatalError("写入 \(outputURL.path) 失败：\(error.localizedDescription)")
    }
}

print("图标生成完毕：OCI-POOL 绿色云池品牌图标")
