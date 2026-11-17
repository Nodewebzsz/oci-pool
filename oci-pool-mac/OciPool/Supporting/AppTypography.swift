import SwiftUI

enum AppTypography {
    static var pageTitle: Font { AppTheme.isClaude ? .system(size: 24, weight: .medium, design: .serif) : .system(size: 17, weight: .semibold) }
    static var loginTitle: Font { AppTheme.isClaude ? .system(size: 30, weight: .medium, design: .serif) : .system(size: 22, weight: .bold) }
    static var heroTitle: Font { AppTheme.isClaude ? .system(size: 34, weight: .medium, design: .serif) : .system(size: 30, weight: .bold) }
}
