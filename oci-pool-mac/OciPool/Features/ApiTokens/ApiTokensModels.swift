import Foundation

struct ApiTokenForm: Equatable {
    var tokenName = ""
    var expirationDays = 30
    var description = ""
    var allowSwaggerAccess = true
}

enum TokenAvailability: Equatable {
    case missing, disabled, expired, unknown, expiring, valid

    var label: String {
        switch self {
        case .missing: return "未生成"
        case .disabled: return "已停用"
        case .expired: return "已过期"
        case .unknown: return "有效期未知"
        case .expiring: return "即将到期"
        case .valid: return "有效"
        }
    }

    var isUsable: Bool { self == .valid || self == .expiring }
}

struct ApiTokenStatus: Equatable {
    var enabled = false
    var tokenName = ""
    var hasToken = false
    var description = ""
    var tokenValue = ""
    var expirationDays = 30
    var expiresAt = ""
    var createdAt = ""
    var daysUntilExpiration = 0
    var isExpired = false

    func availability(at now: Date = Date()) -> TokenAvailability {
        guard hasToken else { return .missing }
        guard enabled else { return .disabled }
        if isExpired { return .expired }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let local = DateFormatter()
        local.locale = Locale(identifier: "en_US_POSIX")
        local.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let plainIso = ISO8601DateFormatter()
        guard let expiry = iso.date(from: expiresAt) ?? plainIso.date(from: expiresAt) ?? local.date(from: expiresAt) else {
            return .unknown
        }
        let remaining = expiry.timeIntervalSince(now)
        if remaining <= 0 { return .expired }
        return remaining <= 7 * 86400 ? .expiring : .valid
    }
}

struct ApiTokenGenerateResult: Equatable {
    var tokenValue = ""
    var expiresAt = ""
    var daysUntilExpiration = 0
    var tokenName = ""
}

struct OpenApiEndpointItem: Identifiable, Equatable {
    var id: String { "\(method):\(path)" }
    let method: String
    let path: String
    let summary: String
    let group: String
    let sampleBody: String?
}

struct OpenApiSpecPayload: Equatable {
    var openapi = "3.0.3"
    var title = "OCI Pool Manager Open API"
    var version = "1.0.0"
    var specDescription = ""
    var endpoints: [OpenApiEndpointItem] = []
    var exportJSONData = Data()
}

enum ApiTokensJSON {
    static func parseConfigs(_ data: Data) throws -> (form: ApiTokenForm, status: ApiTokenStatus) {
        guard let root = obj(data) else {
            throw APIError.serverMessage("Token 配置解析失败")
        }
        if let success = root["success"] as? Bool, success == false {
            throw APIError.serverMessage(str(root["message"]).isEmpty ? "加载 Token 配置失败" : str(root["message"]))
        }
        let payload = (root["data"] as? [String: Any]) ?? root
        var form = ApiTokenForm()
        var status = ApiTokenStatus()

        if let c = payload["config"] as? [String: Any] {
            form.tokenName = str(c["tokenName"])
            form.expirationDays = int(c["expirationDays"], fallback: 30)
            if ![7, 30, 90, 180, 365].contains(form.expirationDays) {
                form.expirationDays = 30
            }
            form.description = str(c["description"])
            form.allowSwaggerAccess = bool(c["allowSwaggerAccess"], fallback: true)
            status.tokenValue = str(c["tokenValue"])
            status.expirationDays = form.expirationDays
        }

        if let s = payload["status"] as? [String: Any] {
            status.enabled = bool(s["enabled"])
            status.tokenName = str(s["tokenName"])
            status.hasToken = bool(s["hasToken"])
            status.description = str(s["description"])
            status.expiresAt = formatTime(s["expiresAt"])
            status.createdAt = formatTime(s["createdAt"])
            status.daysUntilExpiration = int(s["daysUntilExpiration"])
            status.isExpired = bool(s["isExpired"])
            if form.tokenName.isEmpty {
                form.tokenName = status.tokenName
            }
            if form.description.isEmpty {
                form.description = status.description
            }
        }

        return (form, status)
    }

    static func parseGenerate(_ data: Data) throws -> ApiTokenGenerateResult {
        guard let root = obj(data) else {
            throw APIError.serverMessage("生成 Token 响应解析失败")
        }
        // 可能直接是 ApiTokenResponse，或包在 data 里
        let d = (root["data"] as? [String: Any]) ?? root
        var r = ApiTokenGenerateResult()
        r.tokenValue = str(d["tokenValue"])
        r.tokenName = str(d["tokenName"])
        r.expiresAt = formatTime(d["expiresAt"])
        r.daysUntilExpiration = int(d["daysUntilExpiration"])
        if r.tokenValue.isEmpty {
            throw APIError.serverMessage(str(root["message"]).isEmpty ? "生成 Token 失败" : str(root["message"]))
        }
        return r
    }

    static func parseOpenApiSpec(_ data: Data) throws -> OpenApiSpecPayload {
        guard let root = obj(data) else {
            throw APIError.serverMessage("OpenAPI 规范解析失败")
        }
        if let success = root["success"] as? Bool, !success {
            throw APIError.serverMessage(str(root["message"]).isEmpty ? "获取 OpenAPI 规范失败" : str(root["message"]))
        }
        let payload = (root["data"] as? [String: Any]) ?? root
        var result = OpenApiSpecPayload()
        let ver = str(payload["openapi"])
        if !ver.isEmpty { result.openapi = ver }
        if let info = payload["info"] as? [String: Any] {
            let t = str(info["title"])
            if !t.isEmpty { result.title = t }
            let v = str(info["version"])
            if !v.isEmpty { result.version = v }
            result.specDescription = str(info["description"])
        }
        if let list = payload["endpoints"] as? [[String: Any]] {
            result.endpoints = list.compactMap { item in
                let method = str(item["method"]).uppercased()
                let path = str(item["path"])
                guard !method.isEmpty, !path.isEmpty else { return nil }
                let summary = str(item["summary"])
                let group = str(item["group"]).isEmpty ? "General" : str(item["group"])
                let sampleRaw = item["sampleBody"]
                let sampleBody: String?
                if let s = sampleRaw as? String, !s.isEmpty {
                    sampleBody = s
                } else if let dict = sampleRaw as? [String: Any],
                          let json = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
                          let text = String(data: json, encoding: .utf8) {
                    sampleBody = text
                } else {
                    sampleBody = nil
                }
                return OpenApiEndpointItem(
                    method: method,
                    path: path,
                    summary: summary,
                    group: group,
                    sampleBody: sampleBody
                )
            }
        }
        if JSONSerialization.isValidJSONObject(payload),
           let pretty = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys]) {
            result.exportJSONData = pretty
        } else {
            result.exportJSONData = data
        }
        return result
    }

    static func ensureOK(_ data: Data, fallback: String) throws {
        if data.isEmpty { return }
        if let root = obj(data) {
            if let success = root["success"] as? Bool, !success {
                throw APIError.serverMessage(str(root["message"]).isEmpty ? fallback : str(root["message"]))
            }
        }
    }

    static func formatTime(_ v: Any?) -> String {
        if let s = v as? String { return s }
        if let arr = v as? [Any] {
            // LocalDateTime array [y,m,d,h,mi,s]
            let nums = arr.compactMap { ($0 as? NSNumber)?.intValue ?? Int("\($0)") }
            if nums.count >= 3 {
                let y = nums[0], m = nums[1], d = nums[2]
                let h = nums.count > 3 ? nums[3] : 0
                let mi = nums.count > 4 ? nums[4] : 0
                let s = nums.count > 5 ? nums[5] : 0
                return String(format: "%04d-%02d-%02d %02d:%02d:%02d", y, m, d, h, mi, s)
            }
        }
        return str(v)
    }

    static func obj(_ data: Data) -> [String: Any]? {
        (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    static func str(_ v: Any?) -> String {
        if let s = v as? String { return s }
        if let n = v as? NSNumber { return n.stringValue }
        return ""
    }

    static func int(_ v: Any?, fallback: Int = 0) -> Int {
        if let i = v as? Int { return i }
        if let n = v as? NSNumber { return n.intValue }
        if let s = v as? String, let i = Int(s) { return i }
        return fallback
    }

    static func bool(_ v: Any?, fallback: Bool = false) -> Bool {
        if let b = v as? Bool { return b }
        if let n = v as? NSNumber { return n.boolValue }
        if let s = v as? String {
            return s == "1" || s.lowercased() == "true"
        }
        return fallback
    }
}
