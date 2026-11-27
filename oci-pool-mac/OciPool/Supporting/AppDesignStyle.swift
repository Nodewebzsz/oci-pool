import Foundation

enum AppDesignStyle: String, CaseIterable, Identifiable {
    case claude
    case classic

    var id: String { rawValue }
    var title: String { self == .claude ? L("Claude 风格") : L("经典风格") }
    var defaultAccent: String { self == .claude ? "coral" : "green" }
    var defaultMode: String { self == .claude ? "light" : "dark" }
}


