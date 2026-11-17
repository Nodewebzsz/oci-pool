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
guard upperBackground.redComponent < 0.25, upperBackground.redComponent > upperBackground.blueComponent else {
    fail("图标底色应为暖黑色")
}

let resource = color(atX: 0.50, y: 0.555)
guard resource.redComponent > 0.65, resource.greenComponent > 0.30, resource.greenComponent < 0.65, resource.blueComponent < 0.55 else {
    fail("图标缺少珊瑚色资源层")
}

let cloud = color(atX: 0.48, y: 0.24)
guard cloud.redComponent > 0.85, cloud.greenComponent > 0.85, cloud.blueComponent > 0.85 else {
    fail("图标缺少奶白色云轮廓")
}

guard color(atX: 0.01, y: 0.01).alphaComponent < 0.01 else { fail("图标四周应保留透明留白") }
print("图标检查通过：暖黑底、白色云轮廓、珊瑚色资源层、透明留白")
