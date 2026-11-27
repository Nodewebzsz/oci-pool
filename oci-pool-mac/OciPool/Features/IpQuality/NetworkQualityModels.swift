import Foundation

// MARK: - Enums

enum NetworkQualityOperator: String, CaseIterable, Identifiable {
    case telecom
    case unicom
    case mobile
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .telecom: return "中国电信"
        case .unicom: return "中国联通"
        case .mobile: return "中国移动"
        case .custom: return "自定义"
        }
    }

    static func label(for raw: String) -> String {
        NetworkQualityOperator(rawValue: raw.lowercased())?.label ?? (raw.isEmpty ? "自定义" : raw)
    }
}

enum NetworkQualityProbeType: String, CaseIterable, Identifiable {
    case icmp
    case tcp
    case http

    var id: String { rawValue }

    var label: String {
        rawValue.uppercased()
    }

    var targetPlaceholder: String {
        switch self {
        case .icmp: return "IP 或域名，例如 223.5.5.5"
        case .tcp: return "主机:端口，例如 223.5.5.5:443"
        case .http: return "完整 URL，例如 https://www.baidu.com"
        }
    }
}

enum NetworkQualityWindow: Int, CaseIterable, Identifiable {
    case hour1 = 1
    case hour6 = 6
    case hour24 = 24
    case day7 = 168

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .hour1: return "1h"
        case .hour6: return "6h"
        case .hour24: return "24h"
        case .day7: return "7d"
        }
    }
}

// MARK: - Models

struct NetworkQualityAgent: Identifiable, Equatable {
    var id: String
    var instanceId: String
    var displayName: String
    var publicIps: String
    var tenancyName: String
    var regionName: String
    var cloudType: Int
    var monitorInstalled: Bool
    var qualityStatus: String
    var lastSeen: Int64?
    var version: String
    var capabilities: String

    var primaryLabel: String {
        if !displayName.isEmpty { return displayName }
        if !publicIps.isEmpty { return publicIps }
        return "实例 #\(id)"
    }

    var statusLabel: String {
        switch qualityStatus {
        case "online": return "探针在线"
        case "offline": return "探针离线"
        case "upgrade_required": return "待升级"
        default: return "未安装"
        }
    }

    var statusTone: StatusTone {
        switch qualityStatus {
        case "online": return .success
        case "offline": return .danger
        case "upgrade_required": return .warning
        default: return .neutral
        }
    }
}

struct NetworkQualityTask: Identifiable, Equatable {
    var id: String
    var version: String
    var name: String
    var operatorType: String
    var region: String
    var type: String
    var target: String
    var intervalSeconds: Int
    var sampleCount: Int
    var enabled: Bool
    var instanceIds: [String]
    var createdAt: Int64
    var updatedAt: Int64
}

struct NetworkQualitySample: Identifiable, Equatable {
    var instanceId: String
    var taskId: String
    var revision: String
    var executionId: String
    var updatedAt: Int64
    var status: String
    var attempts: Int
    var successful: Int
    var avgMs: Double?
    var minMs: Double?
    var maxMs: Double?
    var errorCode: String
    var errorMessage: String
    var httpStatus: Int?

    var id: String {
        if !executionId.isEmpty { return "\(instanceId)-\(taskId)-\(executionId)-\(updatedAt)" }
        return "\(instanceId)-\(taskId)-\(updatedAt)"
    }

    var lossPercent: Double? {
        guard attempts > 0 else { return nil }
        return max(0, min(100, Double(attempts - successful) * 100.0 / Double(attempts)))
    }

    var statusLabel: String {
        switch status {
        case "success": return "正常"
        case "partial": return "部分丢包"
        case "failed": return "失败"
        case "unsupported": return "不支持"
        case "unknown": return "超时"
        default: return "异常"
        }
    }

    var statusTone: StatusTone {
        switch status {
        case "success": return .success
        case "partial": return .warning
        case "failed", "error": return .danger
        default: return .neutral
        }
    }

    var compactMetricText: String {
        if let avg = avgMs {
            if let loss = lossPercent, loss > 0 {
                return String(format: "%.0fms · %.0f%%丢包", avg, loss)
            }
            return String(format: "%.0fms", avg)
        }
        if !errorMessage.isEmpty { return errorMessage }
        return statusLabel
    }
}

struct NetworkQualityOverview: Equatable {
    var tasks: [NetworkQualityTask] = []
    var agents: [NetworkQualityAgent] = []
    var latest: [NetworkQualitySample] = []
    var serverTime: Int64 = 0
    var legacyDisabled: Bool = false

    func latestSample(instanceId: String, taskId: String) -> NetworkQualitySample? {
        latest.first { $0.instanceId == instanceId && $0.taskId == taskId }
    }

    func agent(forInstanceId id: String) -> NetworkQualityAgent? {
        agents.first { $0.id == id || $0.instanceId == id }
    }

    func tasks(forInstanceId id: String) -> [NetworkQualityTask] {
        tasks.filter { $0.instanceIds.contains(id) }
    }
}

struct NetworkQualityHistoryStats: Equatable {
    var count: Int = 0
    var successCount: Int = 0
    var partialCount: Int = 0
    var failedCount: Int = 0
    var unsupportedCount: Int = 0
    var errorCount: Int = 0
    var unknownCount: Int = 0
    var attempts: Int = 0
    var successful: Int = 0
    var avgMs: Double?
    var minMs: Double?
    var maxMs: Double?
    var lossPercent: Double?
}

struct NetworkQualityHistory: Equatable {
    var instanceId: String = ""
    var taskId: String = ""
    var revision: String = ""
    var hours: Int = 24
    var from: Int64 = 0
    var to: Int64 = 0
    var points: [NetworkQualitySample] = []
    var totalPoints: Int = 0
    var truncated: Bool = false
    var stats: NetworkQualityHistoryStats = NetworkQualityHistoryStats()
}

struct NetworkQualityHistoryContext: Identifiable, Equatable {
    var instanceId: String
    var instanceName: String
    var taskId: String
    var taskName: String
    var revision: String
    var target: String
    var type: String
    var operatorType: String
    var region: String

    var id: String { "\(instanceId)-\(taskId)-\(revision)" }
}

struct NetworkQualityTaskDraft: Equatable {
    var editingTaskId: String?
    var editingVersion: String?
    var name: String = ""
    var operatorType: NetworkQualityOperator = .telecom
    var region: String = ""
    var type: NetworkQualityProbeType = .icmp
    var target: String = ""
    var intervalSeconds: String = "60"
    var sampleCount: String = "3"
    var enabled: Bool = true
    var instanceIds: Set<String> = []

    var isEditing: Bool { editingTaskId != nil }

    static func from(_ task: NetworkQualityTask) -> NetworkQualityTaskDraft {
        NetworkQualityTaskDraft(
            editingTaskId: task.id,
            editingVersion: task.version,
            name: task.name,
            operatorType: NetworkQualityOperator(rawValue: task.operatorType) ?? .custom,
            region: task.region,
            type: NetworkQualityProbeType(rawValue: task.type) ?? .icmp,
            target: task.target,
            intervalSeconds: String(task.intervalSeconds),
            sampleCount: String(task.sampleCount),
            enabled: task.enabled,
            instanceIds: Set(task.instanceIds)
        )
    }
}

// MARK: - JSON Parsing & Formatting

enum NetworkQualityJSON {
    static func unwrapData(_ data: Data, fallbackError: String) throws -> [String: Any] {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw APIError.serverMessage(fallbackError)
        }
        if let ok = root["success"] as? Bool, !ok {
            let msg = str(root["message"])
            throw APIError.serverMessage(msg.isEmpty ? fallbackError : msg)
        }
        if let inner = root["data"] as? [String: Any] {
            return inner
        }
        return root
    }

    static func parseOverview(_ data: Data) throws -> NetworkQualityOverview {
        let payload = try unwrapData(data, fallbackError: "加载网络质量概览失败")
        let rawTasks = (payload["tasks"] as? [[String: Any]]) ?? []
        let rawAgents = (payload["agents"] as? [[String: Any]]) ?? []
        let rawLatest = (payload["latest"] as? [[String: Any]]) ?? []
        return NetworkQualityOverview(
            tasks: rawTasks.map(parseTask),
            agents: rawAgents.map(parseAgent),
            latest: rawLatest.map(parseSample),
            serverTime: int64Val(payload["serverTime"]) ?? 0,
            legacyDisabled: boolVal(payload["legacyDisabled"])
        )
    }

    static func parseHistory(_ data: Data) throws -> NetworkQualityHistory {
        let payload = try unwrapData(data, fallbackError: "加载历史采样失败")
        let rawPoints = (payload["points"] as? [[String: Any]]) ?? []
        let statsObj = (payload["stats"] as? [String: Any]) ?? [:]
        let stats = NetworkQualityHistoryStats(
            count: intVal(statsObj["count"]),
            successCount: intVal(statsObj["successCount"]),
            partialCount: intVal(statsObj["partialCount"]),
            failedCount: intVal(statsObj["failedCount"]),
            unsupportedCount: intVal(statsObj["unsupportedCount"]),
            errorCount: intVal(statsObj["errorCount"]),
            unknownCount: intVal(statsObj["unknownCount"]),
            attempts: intVal(statsObj["attempts"]),
            successful: intVal(statsObj["successful"]),
            avgMs: doubleVal(statsObj["avgMs"]),
            minMs: doubleVal(statsObj["minMs"]),
            maxMs: doubleVal(statsObj["maxMs"]),
            lossPercent: doubleVal(statsObj["lossPercent"])
        )
        return NetworkQualityHistory(
            instanceId: str(payload["instanceId"]),
            taskId: str(payload["taskId"]),
            revision: str(payload["revision"]),
            hours: max(1, intVal(payload["hours"], fallback: 24)),
            from: int64Val(payload["from"]) ?? 0,
            to: int64Val(payload["to"]) ?? 0,
            points: rawPoints.map(parseSample),
            totalPoints: intVal(payload["totalPoints"], fallback: rawPoints.count),
            truncated: boolVal(payload["truncated"]),
            stats: stats
        )
    }

    static func parseAgent(_ row: [String: Any]) -> NetworkQualityAgent {
        let id = str(row["id"])
        let instanceId = str(row["instanceId"])
        return NetworkQualityAgent(
            id: id.isEmpty ? instanceId : id,
            instanceId: instanceId.isEmpty ? id : instanceId,
            displayName: str(row["displayName"]),
            publicIps: str(row["publicIps"]),
            tenancyName: str(row["tenancyName"]),
            regionName: str(row["regionName"]),
            cloudType: intVal(row["cloudType"], fallback: 1),
            monitorInstalled: boolVal(row["monitorInstalled"]),
            qualityStatus: str(row["qualityStatus"]).isEmpty ? "not_installed" : str(row["qualityStatus"]),
            lastSeen: int64Val(row["lastSeen"]),
            version: str(row["version"]),
            capabilities: str(row["capabilities"])
        )
    }

    static func parseTask(_ row: [String: Any]) -> NetworkQualityTask {
        let rawIds = (row["instanceIds"] as? [Any]) ?? []
        let ids = rawIds.map { str($0) }.filter { !$0.isEmpty }
        return NetworkQualityTask(
            id: str(row["id"]),
            version: str(row["version"]),
            name: str(row["name"]),
            operatorType: str(row["operator"]),
            region: str(row["region"]),
            type: str(row["type"]),
            target: str(row["target"]),
            intervalSeconds: intVal(row["intervalSeconds"], fallback: 60),
            sampleCount: intVal(row["sampleCount"], fallback: 3),
            enabled: boolVal(row["enabled"]),
            instanceIds: ids,
            createdAt: int64Val(row["createdAt"]) ?? 0,
            updatedAt: int64Val(row["updatedAt"]) ?? 0
        )
    }

    static func parseSample(_ row: [String: Any]) -> NetworkQualitySample {
        NetworkQualitySample(
            instanceId: str(row["instanceId"]),
            taskId: str(row["taskId"]),
            revision: str(row["revision"]),
            executionId: str(row["executionId"]),
            updatedAt: int64Val(row["updatedAt"]) ?? 0,
            status: str(row["status"]),
            attempts: intVal(row["attempts"]),
            successful: intVal(row["successful"]),
            avgMs: doubleVal(row["avgMs"]),
            minMs: doubleVal(row["minMs"]),
            maxMs: doubleVal(row["maxMs"]),
            errorCode: str(row["errorCode"]),
            errorMessage: str(row["errorMessage"]),
            httpStatus: intOptional(row["httpStatus"])
        )
    }

    static func formatEpochMs(_ ms: Int64?, short: Bool = false) -> String {
        guard let ms = ms, ms > 0 else { return "—" }
        let date = Date(timeIntervalSince1970: TimeInterval(ms) / 1000.0)
        let fmt = DateFormatter()
        fmt.dateFormat = short ? "MM-dd HH:mm" : "MM-dd HH:mm:ss"
        return fmt.string(from: date)
    }

    static func formatMs(_ val: Double?) -> String {
        guard let val = val else { return "—" }
        return String(format: "%.1f ms", val)
    }

    static func formatLoss(_ val: Double?) -> String {
        guard let val = val else { return "—" }
        return String(format: "%.1f%%", val)
    }

    private static func str(_ v: Any?) -> String {
        if let s = v as? String { return s }
        if let n = v as? NSNumber { return n.stringValue }
        return ""
    }

    private static func boolVal(_ v: Any?) -> Bool {
        if let b = v as? Bool { return b }
        if let n = v as? NSNumber { return n.boolValue }
        if let s = v as? String { return s == "1" || s.lowercased() == "true" }
        return false
    }

    private static func intVal(_ v: Any?, fallback: Int = 0) -> Int {
        if let n = v as? NSNumber { return n.intValue }
        if let s = v as? String, let i = Int(s) { return i }
        return fallback
    }

    private static func intOptional(_ v: Any?) -> Int? {
        if v == nil || v is NSNull { return nil }
        if let n = v as? NSNumber { return n.intValue }
        if let s = v as? String { return Int(s) }
        return nil
    }

    private static func int64Val(_ v: Any?) -> Int64? {
        if v == nil || v is NSNull { return nil }
        if let n = v as? NSNumber { return n.int64Value }
        if let s = v as? String { return Int64(s) }
        return nil
    }

    private static func doubleVal(_ v: Any?) -> Double? {
        if v == nil || v is NSNull { return nil }
        if let n = v as? NSNumber { return n.doubleValue }
        if let s = v as? String { return Double(s) }
        return nil
    }
}
