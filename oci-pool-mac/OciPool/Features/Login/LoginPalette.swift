import SwiftUI

/// Exact tokens from web `login_user.ftl` light / `[data-theme=dark]`.
enum LoginPalette {
    // Light :root
    // --bg:#ECEEF2; --panel:#F3F4F6; --card:#FFFFFF;
    // --text:#111827; --muted:#6B7280; --line:#D1D5DB;
    // Dark: --bg:#1a1d21; --panel:#1e2124; --card:#22262b;
    // --text:#cdd9e5; --muted:#768390; --line:#31363d;

    static func bg(_ dark: Bool) -> Color {
        dark ? Color(hex: "060a0d") : Color(hex: "f8fafd")
    }
    static func panel(_ dark: Bool) -> Color {
        dark ? Color(hex: "1e2124") : Color(hex: "F3F4F6")
    }
    static func card(_ dark: Bool) -> Color {
        dark ? Color(hex: "22262b") : Color.white
    }
    /// Glass shell over aurora
    static func shellFill(_ dark: Bool) -> Color {
        dark ? Color(hex: "22262b").opacity(0.92) : Color.white.opacity(0.92)
    }
    static func shellBorder(_ dark: Bool) -> Color {
        dark ? Color.white.opacity(0.06) : Color.white.opacity(0.55)
    }
    static func text(_ dark: Bool) -> Color {
        dark ? Color(hex: "cdd9e5") : Color(hex: "111827")
    }
    static func muted(_ dark: Bool) -> Color {
        dark ? Color(hex: "768390") : Color(hex: "6B7280")
    }
    static func line(_ dark: Bool) -> Color {
        dark ? Color(hex: "31363d") : Color(hex: "D1D5DB")
    }
    /// Primary CTA + brand badge — 跟随当前强调色预设（Web `--accent` oklch(0.72 0.16 hue)）。
    static func primary(_ dark: Bool) -> Color {
        AppearanceController.shared.accent.color
    }
    /// 主按钮文字色（对齐 Web `--accent-fg`：dark 深色字 / light 白字）。
    static func buttonFg(_ dark: Bool) -> Color {
        AppearanceController.shared.accent.accentFg(dark)
    }
    static func oauthBg(_ dark: Bool) -> Color {
        dark ? Color(hex: "292d32") : Color(hex: "F3F4F6")
    }
    static func oauthBorder(_ dark: Bool) -> Color {
        dark ? Color(hex: "31363d") : Color(hex: "E5E7EB")
    }
    static func tabActiveBg(_ dark: Bool) -> Color {
        AppearanceController.shared.accent.accentSoft(dark)
    }
    static func tabActiveText(_ dark: Bool) -> Color {
        AppearanceController.shared.accent.color
    }
    static func divider(_ dark: Bool) -> Color {
        dark ? Color.white.opacity(0.06) : Color.black.opacity(0.06)
    }
    static func chipBg(_ dark: Bool) -> Color {
        dark ? Color(hex: "22262b").opacity(0.95) : Color.white.opacity(0.92)
    }
}
