import SwiftUI
import AppKit

/// Visual tokens aligned with Web `header.css` / sidebar (dark default).
enum AppTheme {
    // Web dark
    static let topNavBgDark = Color(hex: "1f1f1f")
    static let sidebarBgDark = Color(hex: "1e2124")
    static let sidebarHoverDark = Color(hex: "292d30")
    static let sidebarTextDark = Color(hex: "a9b7c6")
    static let pageBgDark = Color(hex: "1a1d21")
    static let borderDark = Color(hex: "383c40")

    // Web light
    static let topNavBgLight = Color(hex: "d0dae6")
    static let sidebarBgLight = Color(hex: "e4eaf2")
    static let sidebarHoverLight = Color(hex: "d6dfe9")
    static let sidebarTextLight = Color(hex: "374a61")
    static let pageBgLight = Color(hex: "f0f4f8")
    static let borderLight = Color(hex: "b8c8d8")

    /// 当前强调色（随 `AppearanceController.accent` 变化，对齐 Web `--accent`）。
    static var sidebarActive: Color { AppearanceController.shared.accent.color }

    static func topNavBg(_ dark: Bool) -> Color { dark ? topNavBgDark : topNavBgLight }
    static func sidebarBg(_ dark: Bool) -> Color { dark ? sidebarBgDark : sidebarBgLight }
    static func sidebarHover(_ dark: Bool) -> Color { dark ? sidebarHoverDark : sidebarHoverLight }
    static func sidebarText(_ dark: Bool) -> Color { dark ? sidebarTextDark : sidebarTextLight }
    static func brand(_ dark: Bool) -> Color { AppearanceController.shared.accent.color }
    static func pageBg(_ dark: Bool) -> Color { dark ? pageBgDark : pageBgLight }
    static func border(_ dark: Bool) -> Color { dark ? borderDark : borderLight }
    static func navIcon(_ dark: Bool) -> Color {
        dark ? Color.white.opacity(0.9) : Color(hex: "1e2f42")
    }
}

/// 强调色预设，对齐 Web `ACCENT_PRESETS`（green/cyan/violet/orange/blue）。
enum AccentPreset: String, CaseIterable, Identifiable {
    case green
    case cyan
    case violet
    case orange
    case blue

    var id: String { rawValue }

    var title: String {
        switch self {
        case .green: return "活力绿"
        case .cyan: return "海蓝青"
        case .violet: return "紫罗兰"
        case .orange: return "琥珀橙"
        case .blue: return "经典蓝"
        }
    }

    var hue: Int {
        switch self {
        case .green: return 155
        case .cyan: return 200
        case .violet: return 305
        case .orange: return 55
        case .blue: return 240
        }
    }

    /// 主强调色（近似 Web `oklch(0.72 0.16 hue)`）。
    var color: Color {
        switch self {
        case .green: return Color(hex: "34d399")
        case .cyan: return Color(hex: "2fd0cc")
        case .violet: return Color(hex: "b784ff")
        case .orange: return Color(hex: "f5a524")
        case .blue: return Color(hex: "4d8dff")
        }
    }

    /// 用作背景时的前景色/符号色（对齐 Web `--accent-fg`）。
    var fg: Color {
        switch self {
        case .green: return Color(hex: "0e2a22")
        case .cyan: return Color(hex: "0e2a2a")
        case .violet: return Color(hex: "2a0e3a")
        case .orange: return Color(hex: "3a240e")
        case .blue: return Color(hex: "0e1a3a")
        }
    }
}

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r, g, b: Double
        switch h.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b)
    }
}

enum AppAppearanceMode: String, CaseIterable {
    case system
    case dark
    case light

    var title: String {
        switch self {
        case .system: return "跟随系统"
        case .dark: return "深色"
        case .light: return "浅色"
        }
    }

    var nsAppearance: NSAppearance? {
        switch self {
        case .system: return nil
        case .dark: return NSAppearance(named: .darkAqua)
        case .light: return NSAppearance(named: .aqua)
        }
    }
}

final class AppearanceController: ObservableObject {
    static let shared = AppearanceController()

    @Published var accent: AccentPreset {
        didSet {
            UserDefaults.standard.set(accent.rawValue, forKey: "appAccent")
        }
    }

    @Published var mode: AppAppearanceMode {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: "appAppearance")
            apply()
        }
    }

    private init() {
        let raw = UserDefaults.standard.string(forKey: "appAppearance") ?? AppAppearanceMode.dark.rawValue
        mode = AppAppearanceMode(rawValue: raw) ?? .dark
        accent = AccentPreset(rawValue: UserDefaults.standard.string(forKey: "appAccent") ?? "") ?? .green
        apply()
    }

    func apply() {
        let appearance = mode.nsAppearance
        if Thread.isMainThread {
            NSApp.appearance = appearance
        } else {
            DispatchQueue.main.async { NSApp.appearance = appearance }
        }
    }

    func cycle() {
        switch mode {
        case .dark: mode = .light
        case .light: mode = .system
        case .system: mode = .dark
        }
    }

    /// Effective dark for drawing when mode is system.
    var isDarkEffective: Bool {
        switch mode {
        case .dark: return true
        case .light: return false
        case .system:
            if let a = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) {
                return a == .darkAqua
            }
            return true
        }
    }
}
