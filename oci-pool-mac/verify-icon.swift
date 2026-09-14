#!/usr/bin/env swift
import AppKit
import Darwin

private func fail(_ message: String) -> Never {
    fputs("图标检查失败：\(message)\n", stderr)
    exit(EXIT_FAILURE)
}

let iconPath = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "OciPool/Assets.xcassets/AppIcon.appiconset/icon_1024.png"

guard
    let image = NSImage(contentsOfFile: iconPath),
    let data = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: data)
else {
    fail("无法读取图标：\(iconPath)")
}

func color(atX x: Double, y: Double) -> NSColor {
    let pixelX = min(bitmap.pixelsWide - 1, max(0, Int(Double(bitmap.pixelsWide) * x)))
    let pixelY = min(bitmap.pixelsHigh - 1, max(0, Int(Double(bitmap.pixelsHigh) * y)))
    guard let color = bitmap.colorAt(x: pixelX, y: pixelY)?.usingColorSpace(.deviceRGB) else {
        fail("无法读取图标像素：\(pixelX), \(pixelY)")
    }
    return color
}

let upperBackground = color(atX: 0.50, y: 0.10)
guard upperBackground.greenComponent > upperBackground.blueComponent + 0.12 else {
    fail("图标左上区域不是品牌绿色，仍可能是旧版蓝色图标")
}

let lowerBackground = color(atX: 0.78, y: 0.90)
guard lowerBackground.greenComponent > 0.60, lowerBackground.blueComponent > 0.55 else {
    fail("图标右下区域不是品牌青色渐变")
}

let bolt = color(atX: 18.5 / 36.0, y: 16.5 / 36.0)
guard bolt.redComponent > 0.85, bolt.greenComponent > 0.85, bolt.blueComponent > 0.85 else {
    fail("图标缺少纯白高能闪电核心")
}

print("图标品牌色与纯白高能闪电核心检查通过")
