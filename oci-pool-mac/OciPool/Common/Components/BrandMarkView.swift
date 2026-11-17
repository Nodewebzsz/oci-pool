import SwiftUI

struct BrandMarkView: View {
    var size: CGFloat = 32
    var dark: Bool
    @EnvironmentObject private var appearance: AppearanceController

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 17 / 64)
                .fill(AppTheme.brandBackground(dark))
            RoundedRectangle(cornerRadius: size * 17 / 64)
                .stroke(AppTheme.brandBorder(dark), lineWidth: max(0.5, size / 64))
            BrandGlyphView(size: size, color: AppTheme.brandCloud(dark), resourceColor: AppTheme.brandResource(dark))
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("OCI-POOL 云资源池")
    }
}


