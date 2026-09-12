import SwiftUI

// MARK: - Shared input chrome (aligned with login page filled fields)

/// Global input tokens — 对齐 Web ui.jsx：SearchInput/Select/TextInput 统一 md 高度 30。
/// 登录页输入框为 Web 特例（高 40 / 圆角 6），由 LoginField 自行定义。
enum AppInputStyle {
    static let height: CGFloat = 30
    static let radius: CGFloat = 5
    static let fontSize: CGFloat = 12
    static let iconSize: CGFloat = 12
    static let hPad: CGFloat = 12

    static func fill(_ dark: Bool, focused: Bool = false) -> Color {
        if focused {
            return dark ? Color(hex: "1a1d21") : Color.white
        }
        return dark ? Color(hex: "292d32") : Color(hex: "f8f9fa")
    }

    static func border(_ dark: Bool, focused: Bool = false, hovering: Bool = false) -> Color {
        if focused {
            return dark ? AppTheme.info : AppTheme.sidebarActive
        }
        if hovering {
            return dark ? AppTheme.info.opacity(0.45) : AppTheme.sidebarActive.opacity(0.45)
        }
        return dark ? Color(hex: "31363d") : Color(hex: "e4e7ed")
    }

    static func glow(_ dark: Bool, focused: Bool) -> Color {
        guard focused else { return .clear }
        return dark
            ? AppTheme.info.opacity(0.18)
            : AppTheme.sidebarActive.opacity(0.14)
    }

    static func text(_ dark: Bool) -> Color {
        dark ? Color(hex: "cdd9e5") : Color(hex: "2c3e50")
    }

    static func placeholder(_ dark: Bool) -> Color {
        dark ? Color(hex: "768390") : Color(hex: "999999")
    }

    static func icon(_ dark: Bool) -> Color {
        dark ? Color(hex: "768390") : Color(hex: "6b7280")
    }
}

/// Visual shell for text fields / select triggers: fill + border + optional leading/trailing.
struct AppInputChrome<Content: View>: View {
    var dark: Bool
    var focused: Bool = false
    var height: CGFloat = AppInputStyle.height
    var radius: CGFloat = AppInputStyle.radius
    var hPad: CGFloat = AppInputStyle.hPad
    var leading: AnyView? = nil
    var trailing: AnyView? = nil
    @ViewBuilder var content: () -> Content

    @State private var hovering = false

    var body: some View {
        HStack(spacing: 8) {
            if let leading = leading {
                leading
            }
            content()
            if let trailing = trailing {
                trailing
            }
        }
        .padding(.horizontal, hPad)
        .frame(height: height)
        .background(
            RoundedRectangle(cornerRadius: radius)
                .fill(AppInputStyle.fill(dark, focused: focused))
        )
        .overlay(
            RoundedRectangle(cornerRadius: radius)
                .stroke(
                    AppInputStyle.border(dark, focused: focused, hovering: hovering),
                    lineWidth: focused ? 1.5 : 1
                )
        )
        .shadow(
            color: AppInputStyle.glow(dark, focused: focused),
            radius: focused ? 6 : 0,
            y: 0
        )
        .animation(.easeOut(duration: 0.15), value: focused)
        .animation(.easeOut(duration: 0.12), value: hovering)
        .onHover { hovering = $0 }
    }
}

// MARK: - Labeled form row

struct FormFieldRow<Content: View>: View {
    let label: String
    var required: Bool = false
    @ViewBuilder var content: () -> Content

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    private var cleanLabel: String {
        var s = label.trimmingCharacters(in: .whitespaces)
        if s.hasSuffix("*") {
            s = String(s.dropLast(1)).trimmingCharacters(in: .whitespaces)
        }
        return s
    }

    private var isRequiredEffective: Bool {
        required || label.trimmingCharacters(in: .whitespaces).hasSuffix("*")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 2) {
                Text(cleanLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarText(dark))
                if isRequiredEffective {
                    Text("*")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(AppTheme.danger)
                }
            }
            content()
        }
    }
}

// MARK: - Primary text / secure field

struct AppTextField: View {
    @Binding var text: String
    var placeholder: String = ""
    var secure: Bool = false
    var leadingSystemImage: String? = nil
    var height: CGFloat = AppInputStyle.height
    var onCommit: (() -> Void)? = nil

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    @State private var focused = false
    @State private var isRevealed = false

    var body: some View {
        AppInputChrome(
            dark: dark,
            focused: focused,
            height: height,
            leading: leadingSystemImage.map { name in
                AnyView(
                    Image(systemName: name)
                        .font(.system(size: AppInputStyle.iconSize, weight: .medium))
                        .foregroundColor(AppInputStyle.icon(dark))
                )
            },
            trailing: AnyView(
                HStack(spacing: 6) {
                    if !text.isEmpty {
                        Button(action: { text = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: AppInputStyle.iconSize))
                                .foregroundColor(AppInputStyle.icon(dark).opacity(0.85))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    if secure {
                        Button(action: { isRevealed.toggle() }) {
                            Image(systemName: isRevealed ? "eye.slash" : "eye")
                                .font(.system(size: AppInputStyle.iconSize))
                                .foregroundColor(isRevealed ? AppTheme.sidebarActive : AppInputStyle.icon(dark).opacity(0.85))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            )
        ) {
            AppNSTextField(
                text: $text,
                placeholder: placeholder,
                secure: secure && !isRevealed,
                dark: dark,
                enabled: true,
                fontSize: AppInputStyle.fontSize,
                isFocused: $focused,
                onCommit: onCommit
            )
            .frame(maxWidth: .infinity)
            .frame(height: 20)
        }
    }
}

// MARK: - Compact field (pagination jump etc.) — same tokens as AppInputStyle

struct AppCompactField: View {
    @Binding var text: String
    var placeholder: String = ""
    var width: CGFloat = 56
    var height: CGFloat = 32
    var alignCenter: Bool = false
    var onCommit: (() -> Void)? = nil

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    @State private var focused = false

    var body: some View {
        AppInputChrome(dark: dark, focused: focused, height: height) {
            AppNSTextField(
                text: $text,
                placeholder: placeholder,
                secure: false,
                dark: dark,
                enabled: true,
                fontSize: 12,
                isFocused: $focused,
                alignCenter: alignCenter,
                onCommit: onCommit
            )
            .frame(maxWidth: .infinity)
            .frame(height: 18)
        }
        .frame(width: width)
    }
}

struct KeyValueRow: View {
    let key: String
    let value: String

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    var body: some View {
        HStack(alignment: .top) {
            Text(key)
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))
                .frame(width: 120, alignment: .leading)
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
            Spacer()
        }
        .padding(.vertical, 4)
    }
}
