import Foundation

/// Menu identifiers. Order of cases is not the sidebar order — see NavigationCatalog.
/// Source of truth for labels/paths: sidebar.ftl
enum NavID: String, CaseIterable, Hashable {
    // service
    case dashboard
    case regions
    case tenants
    case instances
    case email
    case storage
    case boot
    case ai
    case speedTest
    case openLogs
    case gcpAccounts
    case gcpInstances
    case azureVms
    case azureResources
    case azureStorage
    case azureNetworks
    case awsEc2
    case awsS3
    case awsLambda
    case awsRds
    // proxy
    case keyConfig
    case cloudflare
    case edgeOne
    // vps
    case vpsList
    // system
    case ipQuality
    case systemLogs
    case settings
    case proxyConfig
    // tools
    case aiChat
    case notify
    case memo
    case migration
    case mfa
    // dev
    case apiTokens
}

extension NavID {
    /// Lucide icon name (aligned with `modern-ui/src/layout.jsx` `buildNav`).
    var lucideIcon: String {
        switch self {
        case .dashboard: return "activity"
        case .regions: return "globe"
        case .tenants: return "users"
        case .instances: return "server"
        case .email: return "mail"
        case .storage: return "database"
        case .boot: return "zap"
        case .ai: return "brain-circuit"
        case .speedTest: return "wifi"
        case .openLogs: return "terminal"
        case .gcpAccounts: return "cloud"
        case .gcpInstances: return "server"
        case .azureVms: return "server"
        case .azureResources: return "layers"
        case .azureStorage: return "database"
        case .azureNetworks: return "network"
        case .awsEc2: return "server"
        case .awsS3: return "cloud"
        case .awsLambda: return "code"
        case .awsRds: return "database"
        case .keyConfig: return "key"
        case .cloudflare: return "cloud"
        case .edgeOne: return "network"
        case .vpsList: return "server"
        case .ipQuality: return "shield"
        case .systemLogs: return "file-text"
        case .settings: return "shield-check"
        case .proxyConfig: return "shuffle"
        case .aiChat: return "message-square"
        case .notify: return "bell"
        case .memo: return "book-open"
        case .migration: return "arrow-left-right"
        case .mfa: return "smartphone"
        case .apiTokens: return "key"
        }
    }
}

enum NavSection: String, CaseIterable {
    case service
    case proxy
    case resource
    case system
    case tools
    case devConfig

    var title: String {
        switch self {
        case .service: return "服务管理"
        case .proxy: return "代理管理"
        case .resource: return "资源管理"
        case .system: return "系统管理"
        case .tools: return "我的工具"
        case .devConfig: return "开发配置"
        }
    }

    var systemImage: String {
        switch self {
        case .service: return "server.rack"
        case .proxy: return "arrow.left.arrow.right"
        case .resource: return "shippingbox"
        case .system: return "gearshape"
        case .tools: return "wrench.and.screwdriver"
        // SF Symbols 2 (macOS 11) — avoid iOS15+ only names like chevron.left.forwardslash.chevron.right
        case .devConfig: return "chevron.left.slash.chevron.right"
        }
    }

    /// Lucide icon name (aligned with `modern-ui/src/layout.jsx` `buildNav`).
    var lucideIcon: String {
        switch self {
        case .service: return "layers"
        case .proxy: return "shuffle"
        case .resource: return "package"
        case .system: return "settings"
        case .tools: return "wrench"
        case .devConfig: return "code-2"
        }
    }
}
