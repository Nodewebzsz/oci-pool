import Foundation
import SwiftUI

// MARK: - Connection

enum OpenLogsConnectionState: Equatable {
    case disconnected
    case connecting
    case connected

    var label: String {
        switch self {
        case .disconnected: return "已断开"
        case .connecting: return "连接中…"
        case .connected: return "已连接"
        }
    }
}

// MARK: - Filter level

enum OpenLogFilterLevel: String, CaseIterable, Identifiable {
    case all = "全部"
    case info = "INFO"
    case warn = "WARN"
    case error = "ERROR"
    case success = "SUCCESS"

    var id: String { rawValue }

    func matches(_ level: OpenLogLevel) -> Bool {
        switch self {
        case .all: return true
        case .info: return level == .info
        case .warn: return level == .warn
        case .error: return level == .error
        case .success: return level == .success
        }
    }

    var activeColor: Color {
        switch self {
        case .all: return Color.primary
        case .info: return Color(hex: "00b6be")
        case .warn: return AppTheme.orange
        case .error: return AppTheme.danger
        case .success: return AppTheme.sidebarActive
        }
    }
}

// MARK: - Log entry

enum OpenLogLevel: Equatable {
    case plain
    case success
    case warn
    case error
    case info

    static func detect(in raw: String) -> OpenLogLevel {
        let lower = raw.lowercased()
        if lower.contains("[success]") || lower.contains("抢机成功") {
            return .success
        }
        if lower.contains("[error]") || lower.contains("error") {
            return .error
        }
        if lower.contains("[warn]") || lower.contains("warning") {
            return .warn
        }
        if lower.contains("[info]") {
            return .info
        }
        return .plain
    }

    var color: Color {
        // 对齐 Web page-monitor.jsx logColor：INFO=cyan/WARN=orange/ERROR=danger/SUCCESS=accent
        switch self {
        case .plain: return Color(hex: "8d9398")
        case .success: return AppTheme.sidebarActive
        case .warn: return AppTheme.orange
        case .error: return AppTheme.danger
        case .info: return Color(hex: "00b6be")
        }
    }
}

struct OpenLogEntry: Identifiable, Equatable {
    let id: Int
    let text: String
    let level: OpenLogLevel

    /// Align Web `open_boot_log.js`: strip leading `[SUCCESS|ERROR|WARN|INFO]`.
    static func cleaned(_ message: String) -> String {
        var s = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = s.range(of: #"^\[(SUCCESS|ERROR|WARN|INFO)\]\s*"#, options: .regularExpression) {
            s = String(s[r.upperBound...]).trimmingCharacters(in: .whitespaces)
        }
        return s
    }

    static func make(id: Int, raw: String) -> OpenLogEntry {
        let level = OpenLogLevel.detect(in: raw)
        return OpenLogEntry(id: id, text: cleaned(raw), level: level)
    }
}

// MARK: - History JSON

struct OpenLogsHistoryResponse: Decodable {
    let lines: [String]
    let count: Int?
    let error: String?
}
