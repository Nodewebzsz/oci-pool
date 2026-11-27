import Foundation
import Combine
import AppKit
import UniformTypeIdentifiers

@MainActor
final class ApiTokensViewModel: ObservableObject {
    @Published var form = ApiTokenForm()
    @Published var status = ApiTokenStatus()
    @Published var lastGenerated: ApiTokenGenerateResult?
    @Published private(set) var isLoading = false
    @Published private(set) var savingKey: String?
    @Published private(set) var errorText: String?

    @Published var showDocsSheet = false
    @Published var docsSearchText = ""
    @Published var selectedDocsGroup = "ALL"
    @Published private(set) var openApiSpec: OpenApiSpecPayload?
    @Published private(set) var isSpecLoading = false
    @Published private(set) var specErrorText: String?
    @Published private(set) var testingEndpointId: String?
    @Published private(set) var previewResponses: [String: String] = [:]

    private let session: AppSession
    private var service: ApiTokensService { ApiTokensService(baseURL: session.serverURL) }

    var expireOptions: [SelectOption] {
        [7, 30, 90, 180, 365].map { SelectOption(id: "\($0)", title: "\($0) 天") }
    }

    var displayToken: String {
        if let g = lastGenerated, !g.tokenValue.isEmpty { return g.tokenValue }
        return status.tokenValue
    }

    var tokenAvailability: TokenAvailability { status.availability() }
    var tokenIsUsable: Bool { tokenAvailability.isUsable && !displayToken.isEmpty }

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task { await reload() }
    }

    func reload() async {
        isLoading = true
        errorText = nil
        defer { isLoading = false }
        do {
            let result = try await service.fetchConfigs()
            form = result.form
            status = result.status
        } catch {
            errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func generate() {
        Task { await performGenerate() }
    }

    private func performGenerate() async {
        let name = form.tokenName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            ToastCenter.shared.error("请填写 Token 名称")
            return
        }
        let ok = AppAlert.confirm(
            title: "生成新 Token",
            message: "生成后旧 Token 将立即失效，确认继续？",
            confirmTitle: "生成"
        )
        guard ok else { return }

        var payload = form
        payload.tokenName = name
        savingKey = "generate"
        defer { savingKey = nil }
        do {
            let result = try await LoadingHUD.shared.during {
                try await service.generate(payload)
            }
            lastGenerated = result
            await reload()
            status.tokenValue = result.tokenValue
            status.hasToken = true
            status.enabled = true
            AppAlert.info(
                title: "Token 已生成",
                message: "请妥善保存：\n\n\(result.tokenValue)\n\n有效期约 \(result.daysUntilExpiration) 天\(result.expiresAt.isEmpty ? "" : "（\(result.expiresAt)）")"
            )
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func revoke() {
        Task { await performRevoke() }
    }

    private func performRevoke() async {
        guard status.enabled || status.hasToken else {
            ToastCenter.shared.error("当前没有可撤销的 Token")
            return
        }
        let ok = AppAlert.confirm(
            title: "撤销 Token",
            message: "撤销后所有使用该 Token 的 API 调用将失败，确认继续？",
            confirmTitle: "撤销"
        )
        guard ok else { return }
        savingKey = "revoke"
        defer { savingKey = nil }
        do {
            try await LoadingHUD.shared.during {
                try await service.revoke()
            }
            lastGenerated = nil
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func copyToken() {
        let token = displayToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            ToastCenter.shared.error("暂无 Token 可复制")
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(token, forType: .string)
        ToastCenter.shared.success("Token 已复制")
    }

    func copyAuthHeader() {
        let token = tokenIsUsable ? displayToken : "{your_token}"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString("Authorization: Bearer \(token)", forType: .string)
        ToastCenter.shared.success("鉴权请求头已复制")
    }

    func openDocsSheet() {
        showDocsSheet = true
        if openApiSpec == nil {
            Task { await loadOpenApiSpec() }
        }
    }

    func closeDocsSheet() {
        showDocsSheet = false
    }

    func loadOpenApiSpec() async {
        isSpecLoading = true
        specErrorText = nil
        defer { isSpecLoading = false }
        do {
            openApiSpec = try await service.fetchOpenApiSpec()
        } catch {
            specErrorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    var filteredEndpoints: [OpenApiEndpointItem] {
        let list = openApiSpec?.endpoints ?? []
        let q = docsSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return list.filter { ep in
            let groupOK = selectedDocsGroup == "ALL" || ep.group.caseInsensitiveCompare(selectedDocsGroup) == .orderedSame
            let searchOK = q.isEmpty
                || ep.path.lowercased().contains(q)
                || ep.summary.lowercased().contains(q)
                || ep.method.lowercased().contains(q)
            return groupOK && searchOK
        }
    }

    func curlCommand(for endpoint: OpenApiEndpointItem) -> String {
        let base = session.serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let token = displayToken.trimmingCharacters(in: .whitespacesAndNewlines)
        let bearer = tokenIsUsable ? token : "<YOUR_API_TOKEN>"
        let path = endpoint.path.hasPrefix("/") ? endpoint.path : "/\(endpoint.path)"
        var lines = [
            "curl -X \(endpoint.method.uppercased()) '\(base)\(path)'",
            "  -H 'Authorization: Bearer \(bearer)'"
        ]
        if let body = endpoint.sampleBody, !body.isEmpty, endpoint.method.uppercased() != "GET" {
            let escaped = body.replacingOccurrences(of: "'", with: "'\\''")
            lines.append("  -H 'Content-Type: application/json'")
            lines.append("  -d '\(escaped)'")
        }
        return lines.joined(separator: " \\\n")
    }

    func copyCurl(for endpoint: OpenApiEndpointItem) {
        let cmd = curlCommand(for: endpoint)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(cmd, forType: .string)
        ToastCenter.shared.success("cURL 命令已复制")
    }

    func runPreview(for endpoint: OpenApiEndpointItem) {
        Task { await performPreview(for: endpoint) }
    }

    private func performPreview(for endpoint: OpenApiEndpointItem) async {
        let token = displayToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard tokenIsUsable, !token.isEmpty else {
            ToastCenter.shared.error("当前 Token \(tokenAvailability.label)，无法发起调试")
            return
        }
        testingEndpointId = endpoint.id
        defer { testingEndpointId = nil }
        do {
            let res = try await service.executePreviewRequest(
                endpoint: endpoint,
                bearerToken: token,
                overrideBody: endpoint.sampleBody
            )
            previewResponses[endpoint.id] = "HTTP \(res.statusCode)\n\(res.formattedBody)"
        } catch {
            let msg = (error as? APIError)?.errorDescription ?? error.localizedDescription
            previewResponses[endpoint.id] = "请求失败：\(msg)"
        }
    }

    func exportOpenApiSpec() {
        Task { await performExportOpenApiSpec() }
    }

    private func performExportOpenApiSpec() async {
        if openApiSpec == nil {
            await loadOpenApiSpec()
        }
        guard let spec = openApiSpec, !spec.exportJSONData.isEmpty else {
            ToastCenter.shared.error(specErrorText ?? "暂无可导出的 OpenAPI 规范")
            return
        }
        let panel = NSSavePanel()
        panel.title = L("导出 OpenAPI 3.0.3 规范")
        panel.nameFieldStringValue = "oci-pool-openapi-3.0.3.json"
        panel.canCreateDirectories = true
        panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let targetURL = panel.url else { return }
        do {
            try spec.exportJSONData.write(to: targetURL, options: .atomic)
            ToastCenter.shared.success("已导出 oci-pool-openapi-3.0.3.json")
        } catch {
            ToastCenter.shared.error("导出失败：\(error.localizedDescription)")
        }
    }
}
