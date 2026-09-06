import SwiftUI

/// Unified search input — login-style chrome, **no system blue focus ring**.
struct SearchField: View {
    @Binding var text: String
    var placeholder: String = "搜索…"
    var onSubmit: (() -> Void)? = nil
    var onEscape: (() -> Void)? = nil
    var onMoveUp: (() -> Void)? = nil
    var onMoveDown: (() -> Void)? = nil
    var maxWidth: CGFloat? = 280
    /// When true, expand to parent width (sidebar).
    var fillsWidth: Bool = false
    /// Sidebar-compatible dense chrome: 28pt tall, 5pt radius, 12pt text.
    var compact: Bool = false
    /// 焦点变化回调（侧栏搜索下拉面板用）。
    var onFocusChange: ((Bool) -> Void)? = nil

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    @State private var focused = false

    private var unitHeight: CGFloat { compact ? 28 : AppInputStyle.height }
    private var unitRadius: CGFloat { compact ? 5 : AppInputStyle.radius }
    private var unitFontSize: CGFloat { compact ? 12 : AppInputStyle.fontSize }
    private var unitIconSize: CGFloat { compact ? 12 : AppInputStyle.iconSize }
    private var unitHPad: CGFloat { compact ? 10 : AppInputStyle.hPad }

    var body: some View {
        AppInputChrome(
            dark: dark,
            focused: focused,
            height: unitHeight,
            radius: unitRadius,
            hPad: unitHPad,
            leading: AnyView(
                Image(systemName: "magnifyingglass")
                    .font(.system(size: unitIconSize, weight: .medium))
                    .foregroundColor(focused ? AppInputStyle.border(dark, focused: true) : AppInputStyle.icon(dark))
            ),
            trailing: text.isEmpty ? nil : AnyView(
                Button(action: {
                    text = ""
                    onSubmit?()
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: unitIconSize))
                        .foregroundColor(AppInputStyle.icon(dark).opacity(0.9))
                }
                .buttonStyle(PlainButtonStyle())
            )
        ) {
            AppNSTextField(
                text: $text,
                placeholder: placeholder,
                secure: false,
                dark: dark,
                enabled: true,
                fontSize: unitFontSize,
                isFocused: $focused,
                onCommit: onSubmit,
                onEscape: onEscape,
                onMoveUp: onMoveUp,
                onMoveDown: onMoveDown
            )
            .frame(maxWidth: .infinity)
            .frame(height: compact ? 18 : 20)
        }
        .onChange(of: focused) { onFocusChange?($0) }
        .frame(
            minWidth: fillsWidth ? 0 : 140,
            idealWidth: fillsWidth ? nil : 220,
            maxWidth: fillsWidth ? .infinity : maxWidth
        )
    }
}
