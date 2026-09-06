import SwiftUI

/// Standard page chrome — Web `main(padding:16)` + `PageHeader` 卡（bg-1 · border · radius 8 · padding 14px 20px）。
/// 内容区紧随其后；可选 footer（分页）通铺钉在页面最底部。
struct PageScaffold<Toolbar: View, Content: View, Footer: View>: View {
    let title: String
    var subtitle: String? = nil
    var systemImage: String? = nil
    /// 页头图标色（Web 各页不同：如 实例=cyan / 开机=orange / 邮箱=cyan / 存储=info / AI=violet），默认强调色
    var iconColor: Color? = nil
    @ViewBuilder var toolbar: () -> Toolbar
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    private var resolvedIconColor: Color { iconColor ?? AppTheme.sidebarActive }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                headerCard
                content()
                    .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            footer()
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .background(AppTheme.pageBg(dark))
    }

    /// Web PageHeader（ui.jsx）：bg-1 卡 · border · radius 8 · padding 14px 20px · 图标 32(18% 底) · 标题 17/600
    private var headerCard: some View {
        HStack(alignment: .center, spacing: 16) {
            HStack(spacing: 12) {
                if let systemImage = systemImage {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(resolvedIconColor.opacity(0.18))
                            .frame(width: 32, height: 32)
                        Image(systemName: systemImage)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(resolvedIconColor)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(AppTheme.navIcon(dark))
                        .tracking(-0.2)
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                }
            }
            Spacer()
            toolbar()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
        .padding(.bottom, 14)
    }
}

extension PageScaffold where Toolbar == EmptyView, Footer == EmptyView {
    init(title: String, subtitle: String? = nil, systemImage: String? = nil,
         @ViewBuilder content: @escaping () -> Content) {
        self.init(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            toolbar: { EmptyView() },
            content: content,
            footer: { EmptyView() }
        )
    }
}

extension PageScaffold where Footer == EmptyView {
    init(title: String, subtitle: String? = nil, systemImage: String? = nil, iconColor: Color? = nil,
         @ViewBuilder toolbar: @escaping () -> Toolbar,
         @ViewBuilder content: @escaping () -> Content) {
        self.init(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            iconColor: iconColor,
            toolbar: toolbar,
            content: content,
            footer: { EmptyView() }
        )
    }
}
