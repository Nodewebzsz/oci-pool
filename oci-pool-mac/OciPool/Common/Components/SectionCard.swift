import SwiftUI

struct SectionCard<Content: View>: View {
    var title: String? = nil
    @ViewBuilder var content: () -> Content

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.mode == .system ? colorScheme == .dark : (appearance.mode == .dark) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let title = title {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
            }
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
        )
    }
}
