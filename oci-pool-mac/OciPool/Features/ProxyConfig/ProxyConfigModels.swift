import Foundation

// MARK: - List item

struct VpnProxyItem: Identifiable, Equatable {
    var id: Int64 = 0
    var proxyType: String = "HTTP"
    var proxyHost: String = ""
    var proxyPort: Int = 8080
    var proxyUsername: String = ""
    var proxyPassword: String = ""
    /// 后端不再返回密码原文，只告知是否已设置
    var hasPassword: Bool = false
    var availableStatus: Int = 1
    /// 1 = 强制代理（不通则拒绝请求）
    var forceProxy: Int = 0
    /// 兼容旧字段：首个绑定租户
    var tenantId: Int64? = nil
    /// 多租户绑定
    var tenantIds: [Int64] = []
    var tenantName: String = ""
    /// 自定义名称（可选）
    var customName: String = ""
    /// 代理归属地（国家/省市，由 proxyHost 自动解析或连通测试时识别）
    var location: String = ""
    /// 最近一次检测时间（后端原始值，可能为空）
    var lastCheckedAt: String = ""
    /// 最近一次检测失败原因（已脱敏）
    var lastCheckError: String = ""
    /// 最近一次手动检测识别到的出口 IP
    var lastExitIp: String = ""
    /// 全部绑定关系的版本号，保存绑定时回传用于检测并发修改
    var bindingRevision: String = ""
    /// Client-side: row is currently being probed.
    var isTesting: Bool = false

    var isEnabled: Bool { availableStatus == 1 }
    var isForce: Bool { forceProxy == 1 }

    var displayName: String {
        let cn = customName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cn.isEmpty { return cn }
        return "\(proxyType) \(proxyHost):\(proxyPort)"
    }

    var tenantLabel: String {
        let ids = !tenantIds.isEmpty
            ? tenantIds
            : (tenantId.map { [$0] } ?? [])
        if ids.isEmpty {
            return "全局共享"
        }
        if !tenantName.isEmpty { return tenantName }
        if ids.count == 1 { return "#\(ids[0])" }
        return "\(ids.count) 个租户"
    }

    /// 连通状态（落库 availableStatus：1=通畅，0=不通）
    var statusLabel: String {
        if isTesting { return "测试中…" }
        return isEnabled ? "通畅" : "不通"
    }

    var statusTone: StatusTone {
        if isTesting { return .warning }
        return isEnabled ? .success : .danger
    }

    var forceLabel: String { isForce ? "强制" : "非强制" }

    /// 列表中状态下方的检测信息：未检测 / 检测于 MM-dd HH:mm / 检测失败 MM-dd HH:mm
    var checkLabel: String {
        let normalized = lastCheckedAt.replacingOccurrences(of: "T", with: " ")
        guard normalized.count >= 16 else { return "未检测" }
        let start = normalized.index(normalized.startIndex, offsetBy: 5)
        let end = normalized.index(normalized.startIndex, offsetBy: 16)
        let text = String(normalized[start..<end])
        return lastCheckError.isEmpty ? "检测于 \(text)" : "检测失败 \(text)"
    }

    var checkHelp: String {
        if !lastCheckError.isEmpty { return lastCheckError }
        if lastCheckedAt.isEmpty { return "尚未检测，代理池选路时会实时检测" }
        return lastExitIp.isEmpty ? "" : "出口 IP：\(lastExitIp)"
    }
}

struct ProxyTestResult: Equatable {
    var id: Int64 = 0
    var connected: Bool = false
    var availableStatus: Int = 0
    var message: String = ""
    var location: String? = nil
}

struct ProxyTestAllResult: Equatable {
    var total: Int = 0
    var successCount: Int = 0
    var failCount: Int = 0
    var message: String = ""
    var results: [ProxyTestResult] = []
}

struct ProxyFormState: Equatable, Identifiable {
    var id: Int64? = nil
    var proxyType: String = "HTTP"
    var proxyHost: String = ""
    var proxyPort: String = "8080"
    var proxyUsername: String = ""
    var proxyPassword: String = ""
    var availableStatus: Int = 1
    var forceProxy: Int = 0
    /// 多选父租户；空 = 全局共享
    var tenantIds: [Int64] = []
    var customName: String = ""
    /// 打开编辑时的绑定版本号
    var bindingRevision: String = ""
    /// 编辑的代理是否已设置密码（表单密码留空即保留原密码）
    var hasPassword: Bool = false

    var isEditing: Bool { id != nil }

    /// 兼容：是否绑定了任一租户
    var tenantId: Int64? { tenantIds.first }

    static func empty() -> ProxyFormState { ProxyFormState() }

    static func from(_ item: VpnProxyItem) -> ProxyFormState {
        let ids: [Int64]
        if !item.tenantIds.isEmpty {
            ids = item.tenantIds
        } else if let tid = item.tenantId, tid > 0 {
            ids = [tid]
        } else {
            ids = []
        }
        return ProxyFormState(
            id: item.id,
            proxyType: item.proxyType.isEmpty ? "HTTP" : item.proxyType,
            proxyHost: item.proxyHost,
            proxyPort: "\(item.proxyPort)",
            proxyUsername: item.proxyUsername,
            proxyPassword: "",
            availableStatus: item.availableStatus,
            forceProxy: item.forceProxy,
            tenantIds: ids,
            customName: item.customName,
            bindingRevision: item.bindingRevision,
            hasPassword: item.hasPassword
        )
    }
}

struct ProxyParentTenant: Identifiable, Equatable {
    var id: String
    var name: String
    var region: String
}

enum ProxyConfigJSON {
    static func parsePage(_ data: Data) throws -> (items: [VpnProxyItem], total: Int64, pages: Int, number: Int, size: Int) {
        guard let root = obj(data) else {
            throw APIError.serverMessage("代理列表解析失败")
        }
        if let success = root["success"] as? Bool, success == false {
            throw APIError.serverMessage((root["message"] as? String) ?? "加载失败")
        }
        let page = (root["data"] as? [String: Any]) ?? root
        let content = (page["content"] as? [[String: Any]]) ?? []
        let items = content.map { parseItem($0) }
        return (
            items,
            int64(page["totalElements"]),
            int(page["totalPages"]),
            int(page["number"]),
            int(page["size"], fallback: 10)
        )
    }

    static func parseItem(_ d: [String: Any]) -> VpnProxyItem {
        var item = VpnProxyItem()
        item.id = int64(d["id"])
        item.proxyType = str(d["proxyType"]).isEmpty ? "HTTP" : str(d["proxyType"])
        item.proxyHost = str(d["proxyHost"])
        item.proxyPort = int(d["proxyPort"], fallback: 8080)
        item.proxyUsername = str(d["proxyUsername"])
        item.proxyPassword = str(d["proxyPassword"])
        item.hasPassword = bool(d["hasPassword"]) || !item.proxyPassword.isEmpty
        item.availableStatus = int(d["availableStatus"], fallback: 1)
        // 兼容 1 / "1" / true
        if let b = d["forceProxy"] as? Bool {
            item.forceProxy = b ? 1 : 0
        } else {
            item.forceProxy = int(d["forceProxy"], fallback: 0)
            if item.forceProxy != 1 { item.forceProxy = 0 }
        }
        let tid = int64(d["tenantId"])
        item.tenantId = tid > 0 ? tid : nil
        item.tenantName = str(d["tenantName"])
        item.customName = str(d["customName"])
        item.location = str(d["location"])
        item.lastCheckedAt = dateText(d["lastCheckedAt"])
        item.lastCheckError = str(d["lastCheckError"])
        item.lastExitIp = str(d["lastExitIp"])
        item.bindingRevision = str(d["bindingRevision"])
        // tenantIds: 数组 或 兼容单值
        if let arr = d["tenantIds"] as? [Any] {
            item.tenantIds = arr.compactMap { v -> Int64? in
                let n = int64(v)
                return n > 0 ? n : nil
            }
        } else if let arr = d["tenantIds"] as? [Int] {
            item.tenantIds = arr.compactMap { $0 > 0 ? Int64($0) : nil }
        } else if let arr = d["tenantIds"] as? [Int64] {
            item.tenantIds = arr.filter { $0 > 0 }
        } else if tid > 0 {
            item.tenantIds = [tid]
        } else {
            item.tenantIds = []
        }
        if item.tenantId == nil, let first = item.tenantIds.first {
            item.tenantId = first
        }
        return item
    }

    static func parseParentTenants(_ data: Data) -> [ProxyParentTenant] {
        var list: [[String: Any]] = []
        if let arr = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] {
            list = arr
        } else if let root = obj(data) {
            if let arr = root["data"] as? [[String: Any]] {
                list = arr
            } else if let arr = root["content"] as? [[String: Any]] {
                list = arr
            }
        }
        return list.compactMap { d in
            let id = str(d["id"])
            guard !id.isEmpty else { return nil }
            let name = firstNonEmpty(
                str(d["tenancyName"]),
                str(d["userName"]),
                str(d["tenantId"]),
                "#\(id)"
            )
            return ProxyParentTenant(id: id, name: name, region: str(d["region"]))
        }
    }

    static func ensureSuccess(_ data: Data, fallback: String) throws {
        if data.isEmpty { return }
        guard let root = obj(data) else { return }
        if let success = root["success"] as? Bool, !success {
            throw APIError.serverMessage((root["message"] as? String) ?? fallback)
        }
    }

    static func parseTestResult(_ data: Data) throws -> ProxyTestResult {
        guard let root = obj(data) else {
            throw APIError.serverMessage("连通测试结果解析失败")
        }
        if let success = root["success"] as? Bool, success == false {
            throw APIError.serverMessage((root["message"] as? String) ?? "连通测试失败")
        }
        let payload = (root["data"] as? [String: Any]) ?? [:]
        var r = ProxyTestResult()
        r.id = int64(payload["id"])
        r.connected = bool(payload["connected"])
        r.availableStatus = int(payload["availableStatus"], fallback: r.connected ? 1 : 0)
        r.message = str(root["message"])
        if let loc = payload["location"] as? String, !loc.isEmpty {
            r.location = loc
        }
        return r
    }

    static func parseTestAllResult(_ data: Data) throws -> ProxyTestAllResult {
        guard let root = obj(data) else {
            throw APIError.serverMessage("全部测试结果解析失败")
        }
        if let success = root["success"] as? Bool, success == false {
            throw APIError.serverMessage((root["message"] as? String) ?? "全部测试失败")
        }
        let payload = (root["data"] as? [String: Any]) ?? [:]
        var out = ProxyTestAllResult()
        out.total = int(payload["total"])
        out.successCount = int(payload["successCount"])
        out.failCount = int(payload["failCount"])
        out.message = str(root["message"])
        let arr = (payload["results"] as? [[String: Any]]) ?? []
        out.results = arr.map { d in
            var r = ProxyTestResult()
            r.id = int64(d["id"])
            r.connected = bool(d["connected"])
            r.availableStatus = int(d["availableStatus"], fallback: r.connected ? 1 : 0)
            r.message = str(d["message"])
            if let loc = d["location"] as? String, !loc.isEmpty {
                r.location = loc
            }
            return r
            r.availableStatus = int(d["availableStatus"], fallback: r.connected ? 1 : 0)
            return r
        }
        return out
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

    /// 兼容 "2026-11-17T02:00:00" 字符串与 [2026,11,17,2,0,0] 数组两种时间格式
    static func dateText(_ v: Any?) -> String {
        if let s = v as? String { return s }
        if let arr = v as? [Any], arr.count >= 5 {
            let parts = arr.prefix(6).map { int($0) }
            let second = parts.count > 5 ? parts[5] : 0
            return String(format: "%04d-%02d-%02d %02d:%02d:%02d", parts[0], parts[1], parts[2], parts[3], parts[4], second)
        }
        return ""
    }

    static func int(_ v: Any?, fallback: Int = 0) -> Int {
        if let i = v as? Int { return i }
        if let n = v as? NSNumber { return n.intValue }
        if let s = v as? String, let i = Int(s) { return i }
        return fallback
    }

    static func int64(_ v: Any?) -> Int64 {
        if let i = v as? Int64 { return i }
        if let i = v as? Int { return Int64(i) }
        if let n = v as? NSNumber { return n.int64Value }
        if let s = v as? String, let i = Int64(s) { return i }
        return 0
    }

    static func bool(_ v: Any?) -> Bool {
        if let b = v as? Bool { return b }
        if let n = v as? NSNumber { return n.boolValue }
        if let s = v as? String {
            let lower = s.lowercased()
            return lower == "true" || lower == "1" || lower == "yes"
        }
        return false
    }

    static func firstNonEmpty(_ values: String...) -> String {
        for v in values where !v.isEmpty { return v }
        return ""
    }
}
