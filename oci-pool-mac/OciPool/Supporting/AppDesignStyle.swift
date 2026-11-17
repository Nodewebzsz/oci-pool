import Foundation

enum AppDesignStyle: String, CaseIterable, Identifiable {
    case claude
    case classic

    var id: String { rawValue }
    var title: String { self == .claude ? "Claude 风格" : "经典风格" }
    var defaultAccent: String { self == .claude ? "coral" : "green" }
    var defaultMode: String { self == .claude ? "light" : "dark" }
}


