import SwiftUI

enum AppTypography {
    static var pageTitle: Font { AppTheme.isClaude ? .system(size: 20, weight: .semibold) : .system(size: 17, weight: .semibold) }
    static var breadcrumbParent: Font { AppTheme.isClaude ? .system(size: 20, weight: .regular) : .system(size: 16, weight: .medium) }
    static var breadcrumbSeparator: Font { AppTheme.isClaude ? .system(size: 16, weight: .light) : .system(size: 14, weight: .regular) }
    static var breadcrumbTitle: Font { AppTheme.isClaude ? .system(size: 20, weight: .semibold) : .system(size: 16, weight: .semibold) }
    static var loginTitle: Font { AppTheme.isClaude ? .system(size: 26, weight: .semibold) : .system(size: 22, weight: .bold) }
    static var heroTitle: Font { AppTheme.isClaude ? .system(size: 30, weight: .semibold) : .system(size: 30, weight: .bold) }
}
