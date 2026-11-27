import SwiftUI

enum AppButtonStyleKind {
    case primary, secondary, danger, plain
    case cyan   // Web Button cyan 实心
    case info   // Web Button info 实心（蓝）
    case orange // Web Button orange 实心
}

struct AppButton: View {
    let title: String
    var systemImage: String? = nil
    var kind: AppButtonStyleKind = .primary
    var isLoading: Bool = false
    var enabled: Bool = true
    let action: () -> Void
    @State private var hovering = false

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }
    private var cornerRadius: CGFloat { AppTheme.isClaude ? 8 : 5 }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView().scaleEffect(0.6).frame(width: 12, height: 12)
                } else if let systemImage = systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 11, weight: .semibold))
                }
                Text(L(title))
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
            }
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(background)
            .foregroundColor(foreground)
            .cornerRadius(cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(borderColor, lineWidth: (!enabled || kind == .secondary) ? 1 : 0)
            )
            .opacity(isLoading ? 0.7 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!enabled || isLoading)
        .onHover { hovering = $0 && enabled && !isLoading }
        .animation(.easeOut(duration: 0.12), value: hovering)
    }

    private var background: Color {
        if !enabled && !isLoading {
            switch kind {
            case .primary:
                return AppTheme.sidebarActive.opacity(dark ? 0.20 : 0.12)
            case .info:
                return AppTheme.info.opacity(dark ? 0.20 : 0.12)
            case .cyan:
                return AppTheme.cyan.opacity(dark ? 0.20 : 0.12)
            case .orange:
                return AppTheme.orange.opacity(dark ? 0.20 : 0.12)
            case .danger:
                return AppTheme.danger.opacity(dark ? 0.20 : 0.12)
            case .secondary:
                return AppTheme.sidebarHover(dark).opacity(dark ? 0.65 : 0.8)
            case .plain:
                return Color.clear
            }
        }
        switch kind {
        case .primary: return hovering && AppTheme.isClaude ? AppTheme.primaryHover : AppTheme.sidebarActive
        case .danger: return AppTheme.danger
        case .cyan: return AppTheme.cyan
        case .info: return AppTheme.info
        case .orange: return AppTheme.orange
        case .secondary: return AppTheme.sidebarHover(dark)
        case .plain: return Color.clear
        }
    }

    private var foreground: Color {
        if !enabled && !isLoading {
            switch kind {
            case .primary:
                // 方案 B：文字反转为对应强调色（非白色），在浅色软底上对比度极佳
                return AppTheme.sidebarActive.opacity(dark ? 0.65 : 0.75)
            case .info:
                return AppTheme.info.opacity(dark ? 0.65 : 0.8)
            case .cyan:
                return AppTheme.cyan.opacity(dark ? 0.65 : 0.8)
            case .orange:
                return AppTheme.orange.opacity(dark ? 0.65 : 0.85)
            case .danger:
                return AppTheme.danger.opacity(dark ? 0.65 : 0.85)
            case .secondary:
                return AppTheme.textTertiary(dark)
            case .plain:
                return AppTheme.sidebarActive.opacity(0.5)
            }
        }
        switch kind {
        case .primary: return appearance.accent.accentFg(dark)
        case .danger, .cyan, .info, .orange: return .white
        case .secondary: return AppTheme.navIcon(dark)
        case .plain: return AppTheme.sidebarActive
        }
    }

    private var borderColor: Color {
        if !enabled && !isLoading {
            switch kind {
            case .primary:
                return AppTheme.sidebarActive.opacity(dark ? 0.35 : 0.25)
            case .info:
                return AppTheme.info.opacity(dark ? 0.35 : 0.25)
            case .cyan:
                return AppTheme.cyan.opacity(dark ? 0.35 : 0.25)
            case .orange:
                return AppTheme.orange.opacity(dark ? 0.35 : 0.25)
            case .danger:
                return AppTheme.danger.opacity(dark ? 0.35 : 0.25)
            case .secondary:
                return AppTheme.border(dark).opacity(0.6)
            case .plain:
                return Color.clear
            }
        }
        return kind == .secondary ? AppTheme.border(dark).opacity(0.85) : .clear
    }
}
