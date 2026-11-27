import Foundation

struct NetworkQualityService {
    let baseURL: String
    private let client = APIClient.shared

    /// GET `/api/network-quality/overview`
    func fetchOverview() async throws -> NetworkQualityOverview {
        let url = try client.makeURL(baseURL, path: "/api/network-quality/overview")
        let raw = try await client.getJSON(url)
        return try NetworkQualityJSON.parseOverview(raw)
    }

    /// GET `/api/network-quality/history`
    func fetchHistory(instanceId: String, taskId: String, revision: String, hours: Int = 24) async throws -> NetworkQualityHistory {
        let url = try client.makeURL(baseURL, path: "/api/network-quality/history", query: [
            "instanceId": instanceId,
            "taskId": taskId,
            "revision": revision,
            "hours": String(hours)
        ])
        let raw = try await client.getJSON(url)
        return try NetworkQualityJSON.parseHistory(raw)
    }

    /// POST `/api/network-quality/tasks`
    func createTask(_ payload: [String: Any]) async throws -> NetworkQualityTask {
        let url = try client.makeURL(baseURL, path: "/api/network-quality/tasks")
        let raw = try await client.postJSON(url, body: payload)
        let data = try NetworkQualityJSON.unwrapData(raw, fallbackError: "创建探测任务失败")
        return NetworkQualityJSON.parseTask(data)
    }

    /// PUT `/api/network-quality/tasks/{id}`
    func updateTask(id: String, payload: [String: Any]) async throws -> NetworkQualityTask {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = try client.makeURL(baseURL, path: "/api/network-quality/tasks/\(encoded)")
        let raw = try await client.putJSON(url, body: payload)
        let data = try NetworkQualityJSON.unwrapData(raw, fallbackError: "更新探测任务失败")
        return NetworkQualityJSON.parseTask(data)
    }

    /// DELETE `/api/network-quality/tasks/{id}?version=...`
    func deleteTask(id: String, version: String) async throws {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = try client.makeURL(baseURL, path: "/api/network-quality/tasks/\(encoded)", query: [
            "version": version
        ])
        let raw = try await client.deleteJSON(url)
        _ = try NetworkQualityJSON.unwrapData(raw, fallbackError: "删除探测任务失败")
    }

    /// POST `/api/network-quality/tasks/{id}/run`
    func runTask(id: String, version: String, instanceIds: [String]? = nil) async throws {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = try client.makeURL(baseURL, path: "/api/network-quality/tasks/\(encoded)/run")
        var body: [String: Any] = ["version": version]
        if let instanceIds = instanceIds, !instanceIds.isEmpty {
            body["instanceIds"] = instanceIds
        }
        let raw = try await client.postJSON(url, body: body)
        _ = try NetworkQualityJSON.unwrapData(raw, fallbackError: "触发立即探测失败")
    }

    /// POST `/api/monitor/install?vpsId=...`
    func installAgent(vpsId: String) async throws -> String {
        let url = try client.makeURL(baseURL, path: "/api/monitor/install", query: ["vpsId": vpsId])
        let raw = try await client.postJSON(url, body: [:], longTimeout: true)
        let res = InstanceJSON.successMessage(raw, fallback: "探针部署完成")
        if !res.ok {
            throw APIError.serverMessage(res.message)
        }
        return res.message
    }

    /// POST `/api/monitor/uninstall?vpsId=...`
    func uninstallAgent(vpsId: String) async throws -> String {
        let url = try client.makeURL(baseURL, path: "/api/monitor/uninstall", query: ["vpsId": vpsId])
        let raw = try await client.postJSON(url, body: [:], longTimeout: true)
        let res = InstanceJSON.successMessage(raw, fallback: "探针卸载完成")
        if !res.ok {
            throw APIError.serverMessage(res.message)
        }
        return res.message
    }
}
