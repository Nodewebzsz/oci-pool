import SwiftUI
import AppKit

/// Visual tokens aligned with Web modern-ui `index.html` CSS variables (cool slate oklch 240).
enum AppTheme {
    // Web dark: --bg-0/1/2, --border, --fg-1, --fg-0
    static let pageBgDark = Color(hex: "060a0d")
    static let topNavBgDark = Color(hex: "0d1216")
    static let sidebarBgDark = Color(hex: "0d1216")
    static let sidebarHoverDark = Color(hex: "151c21")
    static let borderDark = Color(hex: "232a2f")
    static let sidebarTextDark = Color(hex: "ccd2d6")

    // Web light: --bg-0/1/2, --border, --fg-1, --fg-0
    static let pageBgLight = Color(hex: "f8fafd")
    static let topNavBgLight = Color(hex: "ffffff")
    static let sidebarBgLight = Color(hex: "ffffff")
    static let sidebarHoverLight = Color(hex: "f1f4f6")
    static let borderLight = Color(hex: "d9dfe3")
    static let sidebarTextLight = Color(hex: "2d3439")

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
        dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217")
    }

    /// Web `var(--info)`（oklch(0.68 0.13 260)），light/dark 同值。
    static let info = Color(hex: "6898e8")
    /// Web `var(--orange)`（oklch(0.72 0.16 55)）。
    static let orange = Color(hex: "ef852e")
    /// Web `var(--danger)`（oklch(0.66 0.19 25)）。
    static let danger = Color(hex: "f05653")
    /// Web `var(--cyan)`（oklch(0.70 0.13 200)）。
    static let cyan = Color(hex: "00b6be")
    /// Web `var(--fg-2)`：次要文本（dark oklch(0.66 0.01 240) / light oklch(0.50 0.012 240)）。
    static func textSecondary(_ dark: Bool) -> Color { dark ? Color(hex: "8d9398") : Color(hex: "5d646a") }
    /// Web `var(--fg-3)`：弱化文本/标签。
    static func textTertiary(_ dark: Bool) -> Color { dark ? Color(hex: "5d646a") : Color(hex: "81878c") }
    /// Web `var(--bg-3)`：仪表轨道/DEBUG 徽章底。
    static func bg3(_ dark: Bool) -> Color { dark ? Color(hex: "1e252a") : Color(hex: "e7ecef") }
    /// Web `--cyan-soft`。
    static func cyanSoft(_ dark: Bool) -> Color { dark ? Color(hex: "003a3f") : Color(hex: "b9f5f8") }
    /// Web `--orange-soft`。
    static func orangeSoft(_ dark: Bool) -> Color { dark ? Color(hex: "511a00") : Color(hex: "ffe0bf") }
    /// Web `--danger-soft`。
    static func dangerSoft(_ dark: Bool) -> Color { dark ? Color(hex: "590a0e") : Color(hex: "ffdcd7") }
    /// Web `--info-soft`。
    static func infoSoft(_ dark: Bool) -> Color { dark ? Color(hex: "0b2b5f") : Color(hex: "d4edff") }
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
        case .cyan: return "海洋青"
        case .violet: return "幽紫"
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

    /// 主强调色 — Web `getAccentColor` = `oklch(0.72 0.16 hue)`（精确换算 sRGB）。
    var color: Color {
        switch self {
        case .green: return Color(hex: "35c177")
        case .cyan: return Color(hex: "00c1cc")
        case .violet: return Color(hex: "bc88f4")
        case .orange: return Color(hex: "ef852e")
        case .blue: return Color(hex: "19affe")
        }
    }

    /// Web `--accent-soft`：dark `oklch(0.30 0.10 hue)` / light `oklch(0.93 0.06 hue)`。
    func accentSoft(_ dark: Bool) -> Color {
        switch self {
        case .green: return dark ? Color(hex: "003b15") : Color(hex: "c9f4d7")
        case .cyan: return dark ? Color(hex: "003b41") : Color(hex: "b9f5f8")
        case .violet: return dark ? Color(hex: "3a1c55") : Color(hex: "f1deff")
        case .orange: return dark ? Color(hex: "511a00") : Color(hex: "ffdec2")
        case .blue: return dark ? Color(hex: "00315a") : Color(hex: "c4eeff")
        }
    }

    /// Web `--accent-fg`：强调色底上的前景（dark `oklch(0.14 0.02 hue)` / light `white`）。
    func accentFg(_ dark: Bool) -> Color {
        if !dark { return .white }
        switch self {
        case .green: return Color(hex: "040c06")
        case .cyan: return Color(hex: "010c0c")
        case .violet: return Color(hex: "0b0710")
        case .orange: return Color(hex: "0f0703")
        case .blue: return Color(hex: "030a11")
        }
    }
}

/// 信息密度，对齐 Web `tweaks.density`（compact/comfortable）。
enum DensityMode: String, CaseIterable, Identifiable {
    case compact
    case comfortable

    var id: String { rawValue }

    var title: String {
        switch self {
        case .compact: return "紧凑"
        case .comfortable: return "舒适"
        }
    }

    /// 列表/表格行的纵向 padding（对齐 Web Table `py`：9 / 12）。
    var rowPadding: CGFloat {
        switch self {
        case .compact: return 9
        case .comfortable: return 12
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

    @Published var density: DensityMode {
        didSet {
            UserDefaults.standard.set(density.rawValue, forKey: "appDensity")
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
        density = DensityMode(rawValue: UserDefaults.standard.string(forKey: "appDensity") ?? "") ?? .compact
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
