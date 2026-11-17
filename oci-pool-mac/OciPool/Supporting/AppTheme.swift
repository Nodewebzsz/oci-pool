import SwiftUI
import AppKit

enum AppTheme {
    static var isClaude: Bool { AppearanceController.shared.design == .claude }
    // Web dark: --bg-0/1/2, --border, --fg-1, --fg-0
    static var pageBgDark: Color { Color(hex: isClaude ? "181715" : "060a0d") }
    static var topNavBgDark: Color { Color(hex: isClaude ? "1f1e1b" : "0d1216") }
    static var sidebarBgDark: Color { topNavBgDark }
    static var sidebarHoverDark: Color { Color(hex: isClaude ? "252320" : "151c21") }
    static var borderDark: Color { Color(hex: isClaude ? "34312c" : "232a2f") }
    static var sidebarTextDark: Color { Color(hex: isClaude ? "d8d5cd" : "ccd2d6") }

    // Web light: --bg-0/1/2, --border, --fg-1, --fg-0
    static var pageBgLight: Color { Color(hex: isClaude ? "f5f0e8" : "f8fafd") }
    static var topNavBgLight: Color { Color(hex: isClaude ? "faf9f5" : "ffffff") }
    static var sidebarBgLight: Color { topNavBgLight }
    static var sidebarHoverLight: Color { Color(hex: isClaude ? "f5f0e8" : "f1f4f6") }
    static var borderLight: Color { Color(hex: isClaude ? "e6dfd8" : "d9dfe3") }
    static var sidebarTextLight: Color { Color(hex: isClaude ? "3d3d3a" : "2d3439") }

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
        if isClaude { return Color(hex: dark ? "faf9f5" : "141413") }
        return dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217")
    }

    /// Web `var(--info)`（oklch(0.68 0.13 260)），light/dark 同值。
    static var info: Color { semantic(light: "6b7f99", dark: "8da2bd", classic: "6898e8") }
    /// Web `var(--orange)`（oklch(0.72 0.16 55)）。
    static var orange: Color { semantic(light: "c98a3b", dark: "e8a55a", classic: "ef852e") }
    /// Web `var(--danger)`（oklch(0.66 0.19 25)）。
    static var danger: Color { semantic(light: "c64545", dark: "e0645c", classic: "f05653") }
    /// Web `var(--cyan)`（oklch(0.70 0.13 200)）。
    static var cyan: Color { semantic(light: "3f9b8a", dark: "5db8a6", classic: "00b6be") }
    /// Web `var(--violet)`（oklch(0.70 0.15 305)）。用于「API 调用」环境徽章。
    static var violet: Color { semantic(light: "8a7396", dark: "b09cbd", classic: "8b7bd8") }
    static var success: Color { semantic(light: "4f9a63", dark: "5db872", classic: "35c177") }
    /// Web `var(--fg-2)`：次要文本（dark oklch(0.66 0.01 240) / light oklch(0.50 0.012 240)）。
    static func textSecondary(_ dark: Bool) -> Color { dark ? Color(hex: isClaude ? "a09d96" : "8d9398") : Color(hex: isClaude ? "6c6a64" : "5d646a") }
    /// Web `var(--fg-3)`：弱化文本/标签。
    static func textTertiary(_ dark: Bool) -> Color { dark ? Color(hex: isClaude ? "7a776f" : "5d646a") : Color(hex: isClaude ? "8e8b82" : "81878c") }
    /// Web `var(--bg-3)`：仪表轨道/DEBUG 徽章底。
    static func bg3(_ dark: Bool) -> Color { dark ? Color(hex: isClaude ? "2e2b27" : "1e252a") : Color(hex: isClaude ? "efe9de" : "e7ecef") }
    /// Web `--cyan-soft`。
    static func cyanSoft(_ dark: Bool) -> Color { isClaude ? mix(cyan, over: sidebarBg(dark), amount: dark ? 0.20 : 0.16) : (dark ? Color(hex: "003a3f") : Color(hex: "b9f5f8")) }
    /// Web `--orange-soft`。
    static func orangeSoft(_ dark: Bool) -> Color { isClaude ? mix(orange, over: sidebarBg(dark), amount: dark ? 0.20 : 0.18) : (dark ? Color(hex: "511a00") : Color(hex: "ffe0bf")) }
    /// Web `--danger-soft`。
    static func dangerSoft(_ dark: Bool) -> Color { isClaude ? mix(danger, over: sidebarBg(dark), amount: dark ? 0.20 : 0.12) : (dark ? Color(hex: "590a0e") : Color(hex: "ffdcd7")) }
    /// Web `--info-soft`。
    static func infoSoft(_ dark: Bool) -> Color { isClaude ? mix(info, over: sidebarBg(dark), amount: dark ? 0.18 : 0.14) : (dark ? Color(hex: "0b2b5f") : Color(hex: "d4edff")) }

    static func successSoft(_ dark: Bool) -> Color { mix(success, over: sidebarBg(dark), amount: dark ? 0.20 : 0.16) }
    static func borderStrong(_ dark: Bool) -> Color { isClaude ? Color(hex: dark ? "46423b" : "d9d0c1") : border(dark).opacity(0.85) }
    static func codeSurface(_ dark: Bool) -> Color { isClaude ? Color(hex: dark ? "12110f" : "181715") : Color(hex: "060a0d") }
    static var codeForeground: Color { Color(hex: isClaude ? "faf9f5" : "c9d1d9") }
    static var codeMuted: Color { Color(hex: isClaude ? "a09d96" : "8b949e") }
    static var primaryHover: Color {
        AppearanceController.shared.accent == .coral ? Color(hex: "a9583e") : mix(sidebarActive, over: .black, amount: 0.8)
    }
    static func brandBackground(_ dark: Bool) -> Color {
        if !isClaude {
            return dark ? sidebarHover(dark) : mix(sidebarActive, over: Color(hex: "475569"), amount: 0.65)
        }
        return dark ? Color(hex: "302a25") : mix(sidebarActive, over: Color(hex: "141413"), amount: 0.75)
    }
    static func brandBorder(_ dark: Bool) -> Color {
        if !isClaude { return dark ? borderStrong(dark) : mix(sidebarActive, over: .white, amount: 0.55) }
        return dark ? Color(hex: "59473b") : mix(sidebarActive, over: Color(hex: "141413"), amount: 0.65)
    }
    static func brandCloud(_ dark: Bool) -> Color { dark ? Color(hex: "faf9f5") : .white }
    static func brandResource(_ dark: Bool) -> Color {
        if !isClaude { return dark ? sidebarActive : .white }
        return dark ? mix(sidebarActive, over: Color(hex: "faf9f5"), amount: 0.8) : Color(hex: "faf9f5")
    }
    static func mix(_ foreground: Color, over background: Color, amount: Double) -> Color {
        guard let front = NSColor(foreground).usingColorSpace(.sRGB), let back = NSColor(background).usingColorSpace(.sRGB) else { return foreground }
        let fraction = CGFloat(min(1, max(0, amount)))
        return Color(red: Double(front.redComponent * fraction + back.redComponent * (1 - fraction)),
                     green: Double(front.greenComponent * fraction + back.greenComponent * (1 - fraction)),
                     blue: Double(front.blueComponent * fraction + back.blueComponent * (1 - fraction)))
    }
    private static func semantic(light: String, dark: String, classic: String) -> Color {
        Color(hex: isClaude ? (AppearanceController.shared.isDarkEffective ? dark : light) : classic)
    }
}

/// 强调色预设，对齐 Web `ACCENT_PRESETS`（green/cyan/violet/orange/blue）。
enum AccentPreset: String, CaseIterable, Identifiable {
    case coral
    case green
    case cyan
    case violet
    case orange
    case blue

    var id: String { rawValue }

    var title: String {
        switch self {
        case .coral: return "Claude Coral"
        case .green: return "活力绿"
        case .cyan: return "海洋青"
        case .violet: return "幽紫"
        case .orange: return "琥珀橙"
        case .blue: return "经典蓝"
        }
    }

    var hue: Int {
        switch self {
        case .coral: return 35
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
        case .coral: return Color(hex: "cc785c")
        case .green: return Color(hex: "35c177")
        case .cyan: return Color(hex: "00c1cc")
        case .violet: return Color(hex: "bc88f4")
        case .orange: return Color(hex: "ef852e")
        case .blue: return Color(hex: "19affe")
        }
    }

    /// Web `--accent-soft`：dark `oklch(0.30 0.10 hue)` / light `oklch(0.93 0.06 hue)`。
    func accentSoft(_ dark: Bool) -> Color {
        if AppTheme.isClaude { return AppTheme.mix(color, over: AppTheme.sidebarBg(dark), amount: dark ? 0.22 : 0.14) }
        switch self {
        case .coral: return AppTheme.mix(color, over: AppTheme.sidebarBg(dark), amount: dark ? 0.22 : 0.14)
        case .green: return dark ? Color(hex: "003b15") : Color(hex: "c9f4d7")
        case .cyan: return dark ? Color(hex: "003b41") : Color(hex: "b9f5f8")
        case .violet: return dark ? Color(hex: "3a1c55") : Color(hex: "f1deff")
        case .orange: return dark ? Color(hex: "511a00") : Color(hex: "ffdec2")
        case .blue: return dark ? Color(hex: "00315a") : Color(hex: "c4eeff")
        }
    }

    /// Web `--accent-fg`：强调色底上的前景（dark `oklch(0.14 0.02 hue)` / light `white`）。
    func accentFg(_ dark: Bool) -> Color {
        if AppTheme.isClaude || !dark || self == .coral { return .white }
        switch self {
        case .coral: return .white
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
    private let defaults: UserDefaults
    private var preferences: AppearancePreferences

    @Published var design: AppDesignStyle {
        didSet {
            guard design != oldValue else { return }
            preferences.selectDesign(design)
            accent = AccentPreset(rawValue: preferences.accent) ?? .coral
            preferences.save(to: defaults)
        }
    }

    @Published var accent: AccentPreset {
        didSet {
            preferences.selectAccent(accent.rawValue)
            preferences.save(to: defaults)
        }
    }

    @Published var density: DensityMode {
        didSet {
            defaults.set(density.rawValue, forKey: "appDensity")
        }
    }

    @Published var mode: AppAppearanceMode {
        didSet {
            defaults.set(mode.rawValue, forKey: "appAppearance")
            apply()
        }
    }

    private init() {
        let storage = UserDefaults.standard
        let saved = AppearancePreferences(defaults: storage)
        defaults = storage
        preferences = saved
        design = saved.design
        mode = AppAppearanceMode(rawValue: saved.initialMode) ?? .light
        accent = AccentPreset(rawValue: saved.accent) ?? .coral
        density = DensityMode(rawValue: storage.string(forKey: "appDensity") ?? "") ?? .compact
        saved.save(to: storage)
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
