import Foundation
import AppKit

// MARK: - Form state (align `/api/system/securitySettingsConfigs`)

struct GithubOAuthForm: Equatable {
    var enabled: Bool = false
    var username: String = ""
    var githubId: String = ""
    var clientId: String = ""
    var clientSecret: String = ""
    var redirectUri: String = ""
}

struct GoogleOAuthForm: Equatable {
    var enabled: Bool = false
    var email: String = ""
    var clientId: String = ""
    var clientSecret: String = ""
    var redirectUri: String = ""
}

struct MfaForm: Equatable {
    var enabled: Bool = false
    var issuer: String = "OCI-Pool Verify"
    var secretKey: String = ""
    var qrCodeBase64: String = ""
    var verifyCode: String = ""
}

struct TurnstileForm: Equatable {
    var enabled: Bool = false
    var siteKey: String = ""
    var secretKey: String = ""
}

struct SecuritySettingsSnapshot: Equatable {
    var currentUsername: String = ""
    var siteLogoName: String = "OCI-POOL"
    var github: GithubOAuthForm = GithubOAuthForm()
    var google: GoogleOAuthForm = GoogleOAuthForm()
    var mfa: MfaForm = MfaForm()
    var turnstile: TurnstileForm = TurnstileForm()
    var channelNotifyEnabled: Bool = false
}

// MARK: - IP Ban Management (align `/api/system/ip-bans`)

enum IpBanStatusFilter: String, CaseIterable, Identifiable {
    case all = ""
    case active = "1"
    case released = "0"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "全部状态"
        case .active: return "封禁中"
        case .released: return "已解封"
        }
    }
}

struct IpBanRecord: Identifiable, Equatable {
    var id: String
    var ipAddress: String
    var source: String
    var operatorName: String
    var reason: String
    var status: Int
    var createTime: String
    var unbanTime: String
    var unbanReason: String
    var unbanOperatorName: String

    var isActive: Bool { status == 1 }
}

struct IpBanPage: Equatable {
    var items: [IpBanRecord] = []
    var total: Int = 0
    var page: Int = 1
    var size: Int = 10
}

enum SecuritySettingsJSON {
    static func parse(_ data: Data) throws -> SecuritySettingsSnapshot {
        guard let root = obj(data) else {
            throw APIError.serverMessage("配置解析失败")
        }
        if let success = root["success"] as? Bool, success == false {
            throw APIError.serverMessage((root["message"] as? String) ?? "加载配置失败")
        }
        let payload = (root["data"] as? [String: Any]) ?? root
        var out = SecuritySettingsSnapshot()
        out.currentUsername = str(payload["currentUsername"])
        out.siteLogoName = str(payload["siteLogoName"]).isEmpty ? "OCI-POOL" : str(payload["siteLogoName"])
        out.channelNotifyEnabled = bool(payload["channelNotifyEnabled"])

        if let g = payload["github"] as? [String: Any] {
            out.github.enabled = bool(g["enabled"])
            out.github.username = firstNonEmpty(str(g["userName"]), str(g["username"]))
            out.github.githubId = str(g["githubId"])
            out.github.clientId = str(g["clientId"])
            out.github.clientSecret = str(g["clientSecret"])
            out.github.redirectUri = str(g["redirectUri"])
        }
        if let g = payload["google"] as? [String: Any] {
            out.google.enabled = bool(g["enabled"])
            out.google.email = str(g["email"])
            out.google.clientId = str(g["clientId"])
            out.google.clientSecret = str(g["clientSecret"])
            out.google.redirectUri = str(g["redirectUri"])
        }
        if let m = payload["mfa"] as? [String: Any] {
            out.mfa.enabled = bool(m["enabled"])
            out.mfa.issuer = str(m["issuer"]).isEmpty ? "OCI-Pool Verify" : str(m["issuer"])
            out.mfa.secretKey = str(m["secretKey"])
            out.mfa.qrCodeBase64 = str(m["qrCode"])
        }
        if let t = payload["turnstile"] as? [String: Any] {
            out.turnstile.enabled = bool(t["enabled"])
            out.turnstile.siteKey = str(t["siteKey"])
            out.turnstile.secretKey = str(t["secretKey"])
        }
        return out
    }

    static func ensureOK(_ data: Data, fallback: String) throws {
        if data.isEmpty { return }
        guard let root = obj(data) else { return }
        if let success = root["success"] as? Bool, !success {
            throw APIError.serverMessage((root["message"] as? String) ?? fallback)
        }
        if let code = root["code"] as? Int, code != 200 {
            throw APIError.serverMessage((root["msg"] as? String) ?? (root["message"] as? String) ?? fallback)
        }
    }

    static func parseApiResponse(_ data: Data, fallback: String) throws -> String {
        if data.isEmpty { return "操作成功" }
        guard let root = obj(data) else { return "操作成功" }
        let success = bool(root["success"])
        let message = firstNonEmpty(str(root["message"]), str(root["msg"]), fallback)
        if root["success"] != nil && !success {
            throw APIError.serverMessage(message)
        }
        return message
    }

    static func qrImage(from base64: String) -> NSImage? {
        let cleaned = base64
            .replacingOccurrences(of: "data:image/png;base64,", with: "")
            .replacingOccurrences(of: "data:image/jpeg;base64,", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, let data = Data(base64Encoded: cleaned) else { return nil }
        return NSImage(data: data)
    }

    // helpers

    static func obj(_ data: Data) -> [String: Any]? {
        (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    static func str(_ v: Any?) -> String {
        if let s = v as? String { return s }
        if let n = v as? NSNumber { return n.stringValue }
        return ""
    }

    static func bool(_ v: Any?) -> Bool {
        if let b = v as? Bool { return b }
        if let n = v as? NSNumber { return n.boolValue }
        if let s = v as? String {
            return s == "1" || s.lowercased() == "true"
        }
        return false
    }

    static func firstNonEmpty(_ values: String...) -> String {
        for v in values where !v.isEmpty { return v }
        return ""
    }

    static func parseIpBanPage(_ data: Data) throws -> IpBanPage {
        guard let root = obj(data) else {
            throw APIError.serverMessage("IP 封禁记录解析失败")
        }
        if let success = root["success"] as? Bool, !success {
            throw APIError.serverMessage(firstNonEmpty(str(root["message"]), str(root["msg"]), "读取封禁记录失败"))
        }
        let payload = (root["data"] as? [String: Any]) ?? root
        let rawItems = (payload["items"] as? [[String: Any]]) ?? []
        let items: [IpBanRecord] = rawItems.map { row in
            IpBanRecord(
                id: str(row["id"]),
                ipAddress: str(row["ipAddress"]),
                source: str(row["source"]),
                operatorName: str(row["operatorName"]),
                reason: str(row["reason"]),
                status: intVal(row["status"], fallback: 0),
                createTime: dateText(row["createTime"]),
                unbanTime: dateText(row["unbanTime"]),
                unbanReason: str(row["unbanReason"]),
                unbanOperatorName: str(row["unbanOperatorName"])
            )
        }
        return IpBanPage(
            items: items,
            total: intVal(payload["total"], fallback: items.count),
            page: max(1, intVal(payload["page"], fallback: 1)),
            size: max(1, intVal(payload["size"], fallback: 10))
        )
    }

    static func intVal(_ value: Any?, fallback: Int) -> Int {
        if let num = value as? NSNumber { return num.intValue }
        if let text = value as? String, let parsed = Int(text) { return parsed }
        return fallback
    }

    static func dateText(_ value: Any?) -> String {
        if let text = value as? String {
            return text.replacingOccurrences(of: "T", with: " ").prefix(19).description
        }
        if let arr = value as? [NSNumber], arr.count >= 5 {
            let y = arr[0].intValue
            let mo = arr[1].intValue
            let d = arr[2].intValue
            let h = arr[3].intValue
            let mi = arr[4].intValue
            let sec = arr.count >= 6 ? arr[5].intValue : 0
            return String(format: "%04d-%02d-%02d %02d:%02d:%02d", y, mo, d, h, mi, sec)
        }
        return ""
    }
}
