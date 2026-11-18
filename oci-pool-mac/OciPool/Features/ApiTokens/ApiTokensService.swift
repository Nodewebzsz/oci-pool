import Foundation

/// Network layer for Web `/system/apiTokens`.
struct ApiTokensService {
    let baseURL: String
    private let client = APIClient.shared

    /// GET `/api/system/apiTokenConfigs`
    func fetchConfigs() async throws -> (form: ApiTokenForm, status: ApiTokenStatus) {
        let url = try client.makeURL(baseURL, path: "/api/system/apiTokenConfigs")
        let raw = try await client.getJSON(url)
        return try ApiTokensJSON.parseConfigs(raw)
    }

    /// POST `/api/system/generateApiToken`
    func generate(_ form: ApiTokenForm) async throws -> ApiTokenGenerateResult {
        let url = try client.makeURL(baseURL, path: "/api/system/generateApiToken")
        let raw = try await client.postJSON(url, body: [
            "enabled": true,
            "tokenName": form.tokenName,
            "expirationDays": form.expirationDays,
            "description": form.description,
            "allowSwaggerAccess": form.allowSwaggerAccess
        ])
        return try ApiTokensJSON.parseGenerate(raw)
    }

    /// POST `/api/system/revokeApiToken`
    func revoke() async throws {
        let url = try client.makeURL(baseURL, path: "/api/system/revokeApiToken")
        let raw = try await client.postJSON(url, body: [:])
        try ApiTokensJSON.ensureOK(raw, fallback: "撤销 Token 失败")
    }

    /// GET `/api/system/openApiSpec`
    func fetchOpenApiSpec() async throws -> OpenApiSpecPayload {
        let url = try client.makeURL(baseURL, path: "/api/system/openApiSpec")
        let raw = try await client.getJSON(url)
        return try ApiTokensJSON.parseOpenApiSpec(raw)
    }

    /// Live preview request against an Open API endpoint using `Authorization: Bearer <token>`.
    func executePreviewRequest(
        endpoint: OpenApiEndpointItem,
        bearerToken: String,
        overrideBody: String?
    ) async throws -> (statusCode: Int, formattedBody: String) {
        let root = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let normalizedPath = endpoint.path.hasPrefix("/") ? endpoint.path : "/\(endpoint.path)"
        guard let url = URL(string: root + normalizedPath) else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = endpoint.method.uppercased()
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if !bearerToken.isEmpty {
            req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        if req.httpMethod != "GET" {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let bodyStr = overrideBody ?? endpoint.sampleBody ?? "{}"
            req.httpBody = bodyStr.data(using: .utf8)
        }
        let (data, response) = try await URLSession.shared.compatData(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if let jsonObj = try? JSONSerialization.jsonObject(with: data),
           JSONSerialization.isValidJSONObject(jsonObj),
           let pretty = try? JSONSerialization.data(withJSONObject: jsonObj, options: [.prettyPrinted, .sortedKeys]),
           let text = String(data: pretty, encoding: .utf8) {
            return (code, text)
        }
        let rawText = String(data: data, encoding: .utf8) ?? ""
        return (code, rawText.isEmpty ? "(Empty Response)" : rawText)
    }
}
