import SwiftUI

struct AppearanceOptionsView: View {
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    var english = false
    var onSelect: () -> Void = {}

    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading(english ? "Interface style" : "界面风格")
            ForEach(AppDesignStyle.allCases) { design in
                option(english ? (design == .claude ? "Claude style" : "Classic style") : design.title,
                       icon: design == .claude ? "textformat" : "square.grid.2x2",
                       selected: appearance.design == design) {
                    appearance.design = design
                    onSelect()
                }
            }
            Divider().padding(.vertical, 4)
            heading(english ? "Color mode" : "配色模式")
            ForEach([AppAppearanceMode.light, .dark, .system], id: \.rawValue) { mode in
                option(modeTitle(mode), icon: mode == .light ? "sun.max" : mode == .dark ? "moon" : "desktopcomputer", selected: appearance.mode == mode) {
                    appearance.mode = mode
                    onSelect()
                }
            }
        }
        .padding(4)
        .frame(width: 196)
        .background(AppTheme.sidebarBg(dark))
    }

    private func heading(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundColor(AppTheme.textSecondary(dark))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
    }

    private func option(_ title: String, icon: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon).font(.system(size: 11)).frame(width: 14)
                Text(title).font(.system(size: 12, weight: selected ? .semibold : .medium))
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark").font(.system(size: 10, weight: .semibold)) }
            }
            .foregroundColor(selected ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(selected ? AppTheme.sidebarHover(dark) : Color.clear)
            .cornerRadius(5)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel(title)
        .accessibilityValue(selected ? (english ? "Selected" : "已选择") : "")
    }

    private func modeTitle(_ mode: AppAppearanceMode) -> String {
        if !english { return mode.title }
        switch mode {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }
}
