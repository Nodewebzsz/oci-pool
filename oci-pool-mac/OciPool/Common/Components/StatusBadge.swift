import SwiftUI

enum StatusTone {
    case success, warning, danger, info, neutral

    /// 对齐 Web 语义色：success=accent、warning=orange、danger=danger、info=info
    func color(dark: Bool) -> Color {
        switch self {
        case .success: return AppTheme.sidebarActive
        case .warning: return AppTheme.orange
        case .danger:  return AppTheme.danger
        case .info:    return AppTheme.info
        case .neutral: return dark ? Color(hex: "8d9398") : Color(hex: "5d646a")
        }
    }

    /// Map common OCI/instance states.
    static func fromState(_ state: String?) -> StatusTone {
        switch (state ?? "").uppercased() {
        case "RUNNING", "ACTIVE", "AVAILABLE", "ONLINE": return .success
        case "STOPPED", "STOPPING", "TERMINATED", "FAILED", "ERROR": return .danger
        case "PROVISIONING", "STARTING", "CREATING": return .warning
        default: return .neutral
        }
    }
}

struct StatusBadge: View {
    let text: String
    var tone: StatusTone = .neutral

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    var body: some View {
        let c = tone.color(dark: dark)
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(c)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(c.opacity(0.15))
            .cornerRadius(10)
    }

    static func state(_ state: String?) -> StatusBadge {
        StatusBadge(text: state ?? "—", tone: .fromState(state))
    }
}
