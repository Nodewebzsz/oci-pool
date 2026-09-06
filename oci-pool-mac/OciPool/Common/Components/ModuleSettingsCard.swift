import SwiftUI

// MARK: - 页面模块卡片标准（以「质量管理」IpQualityView 为基准）
//
// 后续所有「模块配置 / 设置类」原生页必须使用本组件，禁止再抄一份私有 settingsCard。
// 完整规范：仓库 `tasks/macos-ui-standard.md`、`tasks/lessons.md`

/// 两列等宽等高行（兼容 ScrollView）。
/// 同行两卡互相撑满高度，底部操作栏自然对齐。
struct EqualHeightCardRow<A: View, B: View>: View {
    var minHeight: CGFloat = 380
    let first: A
    let second: B

    init(minHeight: CGFloat = 380, @ViewBuilder first: () -> A, @ViewBuilder second: () -> B) {
        self.minHeight = minHeight
        self.first = first()
        self.second = second()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            first
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            second
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .top)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// 标准模块卡片：固定头栏 + 可撑满内容区 + 固定底栏。
/// - 启用态描边高亮 + 轻微阴影
/// - 内容区 `Spacer` 顶对齐，footer 始终贴底
struct ModuleSettingsCard<BodyContent: View, Footer: View>: View {
    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme

    let title: String
    let subtitle: String
    let systemImage: String
    let accent: Color
    /// `nil` = 不显示开关
    var enabled: Binding<Bool>? = nil
    var minHeight: CGFloat = 380
    @ViewBuilder var bodyContent: () -> BodyContent
    @ViewBuilder var footer: () -> Footer

    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    private var isOn: Bool { enabled?.wrappedValue == true }

    /// Web SettingsCard：标题条 bg-2（10px 14px · icon 13 · 标题 12/600）+ body 14 + footer bg-2 右对齐
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(AppTheme.sidebarHover(dark))
                .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .bottom)

            VStack(alignment: .leading, spacing: 12) {
                bodyContent()
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            HStack {
                Spacer()
                footer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AppTheme.sidebarHover(dark))
            .overlay(Rectangle().fill(AppTheme.border(dark)).frame(height: 1), alignment: .top)
        }
        .frame(maxWidth: .infinity, minHeight: minHeight, maxHeight: .infinity, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    isOn
                        ? accent.opacity(dark ? 0.45 : 0.35)
                        : AppTheme.border(dark),
                    lineWidth: 1
                )
        )
        .cornerRadius(8)
        .animation(.easeInOut(duration: 0.18), value: isOn)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(accent)
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.navIcon(dark))
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let enabled = enabled {
                Toggle("", isOn: enabled)
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.sidebarActive))
                    .labelsHidden()
            }
        }
    }
}
