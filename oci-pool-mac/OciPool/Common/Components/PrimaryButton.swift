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

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView().scaleEffect(0.6).frame(width: 12, height: 12)
                } else if let systemImage = systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 11, weight: .semibold))
                }
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(background)
            .foregroundColor(foreground)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(borderColor, lineWidth: (!enabled || kind == .secondary) ? 1 : 0)
            )
            .opacity(isLoading ? 0.7 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!enabled || isLoading)
    }

    private var background: Color {
        if !enabled && !isLoading {
            switch kind {
            case .primary:
                return AppTheme.sidebarActive.opacity(dark ? 0.20 : 0.12)
            case .info:
                return AppTheme.info.opacity(dark ? 0.20 : 0.12)
            case .cyan:
                return Color(hex: "00b6be").opacity(dark ? 0.20 : 0.12)
            case .orange:
                return AppTheme.orange.opacity(dark ? 0.20 : 0.12)
            case .danger:
                return AppTheme.danger.opacity(dark ? 0.20 : 0.12)
            case .secondary:
                return dark ? Color(hex: "151c21").opacity(0.6) : Color(hex: "f1f4f6").opacity(0.8)
            case .plain:
                return Color.clear
            }
        }
        switch kind {
        case .primary: return AppTheme.sidebarActive
        case .danger: return AppTheme.danger
        case .cyan: return Color(hex: "00b6be")
        case .info: return AppTheme.info
        case .orange: return AppTheme.orange
        case .secondary: return dark ? Color(hex: "151c21") : Color(hex: "f1f4f6")
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
                return Color(hex: "00b6be").opacity(dark ? 0.65 : 0.8)
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
        case .primary, .danger, .cyan, .info, .orange: return .white
        case .secondary: return dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217")
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
                return Color(hex: "00b6be").opacity(dark ? 0.35 : 0.25)
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
