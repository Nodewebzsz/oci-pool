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
                    .stroke(borderColor, lineWidth: kind == .secondary ? 1 : 0)
            )
            .opacity(enabled && !isLoading ? 1 : 0.5)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!enabled || isLoading)
    }

    private var background: Color {
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
        switch kind {
        case .primary, .danger, .cyan, .info, .orange: return .white
        case .secondary: return dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217")
        case .plain: return AppTheme.sidebarActive
        }
    }

    private var borderColor: Color {
        kind == .secondary ? AppTheme.border(dark).opacity(0.85) : .clear
    }
}
