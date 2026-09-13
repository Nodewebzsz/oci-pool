import Foundation
import SwiftUI

// MARK: - List

struct TenantsListResponse: Decodable {
    var content: [TenantItem] = []
    var currentPage: Int = 0
    var totalPages: Int = 0
    var totalElements: Int64 = 0
    var size: Int = 10

    enum CodingKeys: String, CodingKey {
        case content, currentPage, totalPages, totalElements, size
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        content = (try? c.decode([TenantItem].self, forKey: .content)) ?? []
        currentPage = Self.int(c, .currentPage) ?? 0
        totalPages = Self.int(c, .totalPages) ?? 0
        totalElements = Self.int64(c, .totalElements) ?? 0
        size = Self.int(c, .size) ?? 10
    }

    private static func int(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Int? {
        if let v = try? c.decode(Int.self, forKey: k) { return v }
        if let v = try? c.decode(Int64.self, forKey: k) { return Int(v) }
        return nil
    }
    private static func int64(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Int64? {
        if let v = try? c.decode(Int64.self, forKey: k) { return v }
        if let v = try? c.decode(Int.self, forKey: k) { return Int64(v) }
        return nil
    }
}

struct TenantItem: Decodable, Identifiable, Equatable {
    var id: Int64 = 0
    var tenantId: String = ""
    var userName: String = ""
    var fingerprint: String = ""
    var tenancy: String = ""
    var region: String = ""
    var regionEn: String = ""
    var tenancyName: String = ""
    var tenancyDes: String = ""
    var defName: String = ""
    var accountType: String = ""
    var accountTypeName: String = ""
    var accountCost: String = ""
    var activeDays: String = ""
    var emailAddress: String = ""
    var emailEnable: Int = 0
    var cloudType: Int = 1
    var transferStatus: Int = 0
    var transferAmount: String = ""
    var isHomeRegion: Bool = true
    var hasChildren: Bool = false
    var openBootFlag: Bool = false
    /// 是否已绑定专属代理（列表护盾，非持久化字段，由后端填充）
    var proxyBound: Bool = false
    /// 是否强制代理（橙色护盾）
    var proxyForce: Bool = false
    var isActive: Bool = true
    /// OCI API 是否已同步（租户详情「同步」列，对齐 Web apiSynced）
    var apiSynced: Bool = false
    var supportAI: Int = 0
    var createdAt: String = ""
    var children: [TenantItem] = []
    var registerDetail: TenantRegisterDetail?

    enum CodingKeys: String, CodingKey {
        case id, tenantId, userName, fingerprint, tenancy, region, regionEn
        case tenancyName, tenancyDes, defName
        case accountType, accountTypeName, accountCost, activeDays
        case emailAddress, emailEnable, cloudType
        case transferStatus, transferAmount
        case isHomeRegion, homeRegion
        case hasChildren, openBootFlag, proxyBound, proxyForce
        case isActive, active, apiSynced
        case supportAI, createdAt, createdAtStr
        case children, registerDetail
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = Self.int64(c, .id) ?? 0
        tenantId = Self.str(c, .tenantId)
        userName = Self.str(c, .userName)
        fingerprint = Self.str(c, .fingerprint)
        tenancy = Self.str(c, .tenancy)
        region = Self.str(c, .region)
        regionEn = Self.str(c, .regionEn)
        tenancyName = Self.str(c, .tenancyName)
        tenancyDes = Self.str(c, .tenancyDes)
        defName = Self.str(c, .defName)
        accountType = Self.str(c, .accountType)
        accountTypeName = Self.str(c, .accountTypeName)
        accountCost = Self.str(c, .accountCost)
        activeDays = Self.str(c, .activeDays)
        emailAddress = Self.str(c, .emailAddress)
        emailEnable = Self.int(c, .emailEnable) ?? 0
        cloudType = Self.int(c, .cloudType) ?? 1
        transferStatus = Self.int(c, .transferStatus) ?? 0
        transferAmount = Self.str(c, .transferAmount)
        isHomeRegion = Self.bool(c, .isHomeRegion) ?? Self.bool(c, .homeRegion) ?? true
        hasChildren = Self.bool(c, .hasChildren) ?? false
        openBootFlag = Self.bool(c, .openBootFlag) ?? false
        proxyBound = Self.bool(c, .proxyBound) ?? false
        proxyForce = Self.bool(c, .proxyForce) ?? false
        isActive = Self.bool(c, .isActive) ?? Self.bool(c, .active) ?? true
        apiSynced = Self.bool(c, .apiSynced) ?? false
        supportAI = Self.int(c, .supportAI) ?? 0
        createdAt = Self.str(c, .createdAtStr)
        if createdAt.isEmpty { createdAt = Self.time(c, .createdAt) ?? "" }
        children = (try? c.decode([TenantItem].self, forKey: .children)) ?? []
        registerDetail = try? c.decode(TenantRegisterDetail.self, forKey: .registerDetail)
    }

    var displayName: String {
        if !tenancyName.isEmpty { return tenancyName }
        if !userName.isEmpty { return userName }
        if !tenantId.isEmpty { return tenantId }
        return "#\(id)"
    }

    var maskedName: String {
        let tn = displayName
        guard tn.count > 2 else { return tn.isEmpty ? "" : "***" }
        return "\(tn.prefix(1))***\(tn.suffix(1))"
    }

    var isMultiRegion: Bool {
        guard !children.isEmpty else { return false }
        if children.count == 1, children[0].region == region { return false }
        return true
    }

    var isTransferred: Bool { transferStatus == 1 }

    /// 区域中文名：code → RegionCnName；未知则返回原始 code（对齐 Web REGION_MAP 回落）
    var regionNameText: String {
        if region.isEmpty { return "" }
        return RegionCnName.table[region] ?? region
    }
    // Web i18n tenants.task.active = 「进行中」
    var openTaskText: String { openBootFlag ? "进行中" : "无任务" }
    var syncStatusText: String { apiSynced ? "已同步" : "未同步" }
    var multiRegionText: String { isMultiRegion ? "是" : "否" }
    var typeText: String {
        if !accountTypeName.isEmpty, accountTypeName != "未知" { return accountTypeName }
        // Web i18n tenants.type.fallback = 「普通多区号」
        return hasChildren ? "普通多区号" : "未知"
    }
    var statusText: String { isActive ? "有效" : "失效" }
    var activeDaysText: String { activeDays.isEmpty ? "0" : activeDays }
    var costText: String { accountCost.isEmpty ? "—" : accountCost }
    /// Web getTenantAlias：defName 等于 userName/租户ID 时视为「未设置」（后端历史数据回填），返回空
    var customAlias: String {
        let raw = defName
        guard !raw.isEmpty else { return "" }
        if raw == userName { return "" }
        if raw == tenantId { return "" }
        if raw == String(id) { return "" }
        return raw
    }

    /// Web 表格展示：未设置为空白；有值截断 14 字符（truncateDisplayName(alias, 14)）
    var defNameText: String {
        let alias = customAlias
        guard alias.count > 14 else { return alias }
        return String(alias.prefix(14)) + "…"
    }

    /// 租户真实展示名（真实租户名 tenancyName 优先，对齐 TenantRegionOption.tenantPrimaryName）
    var tenantPrimaryName: String {
        if !tenancyName.isEmpty && !tenancyName.hasPrefix("ocid1.") { return tenancyName }
        if !customAlias.isEmpty && !customAlias.hasPrefix("ocid1.") { return customAlias }
        if !userName.isEmpty && !userName.hasPrefix("ocid1.") { return userName }
        return String(id)
    }

    /// 编辑弹窗默认值：未设置过自定义名称时输入框默认为空（Web editCustomName 同款逻辑）
    var editNameDefault: String { customAlias }
    /// Web：trial=violet / official=cyan / 其他=orange 软底徽章
    var typeBadgeColor: Color {
        let n = accountTypeName.lowercased()
        if n.contains("trial") || accountTypeName.contains("试用") { return Color(hex: "b484e8") }
        if n.contains("official") || accountTypeName.contains("官方") { return Color(hex: "00b6be") }
        return AppTheme.orange
    }

    private static func str(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> String {
        if let s = try? c.decode(String.self, forKey: k) { return s }
        if let n = try? c.decode(Int64.self, forKey: k) { return String(n) }
        if let n = try? c.decode(Int.self, forKey: k) { return String(n) }
        return ""
    }
    private static func int(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Int? {
        if let v = try? c.decode(Int.self, forKey: k) { return v }
        if let v = try? c.decode(Int64.self, forKey: k) { return Int(v) }
        if let s = try? c.decode(String.self, forKey: k) { return Int(s) }
        return nil
    }
    private static func int64(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Int64? {
        if let v = try? c.decode(Int64.self, forKey: k) { return v }
        if let v = try? c.decode(Int.self, forKey: k) { return Int64(v) }
        if let s = try? c.decode(String.self, forKey: k) { return Int64(s) }
        return nil
    }
    private static func bool(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Bool? {
        if let v = try? c.decode(Bool.self, forKey: k) { return v }
        if let n = try? c.decode(Int.self, forKey: k) { return n != 0 }
        if let s = try? c.decode(String.self, forKey: k) {
            let l = s.lowercased()
            if l == "true" || l == "1" { return true }
            if l == "false" || l == "0" { return false }
        }
        return nil
    }
    private static func time(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> String? {
        if let s = try? c.decode(String.self, forKey: k) { return s }
        if let arr = try? c.decode([Int].self, forKey: k), arr.count >= 5 {
            let sec = arr.count > 5 ? arr[5] : 0
            return String(format: "%04d-%02d-%02d %02d:%02d:%02d", arr[0], arr[1], arr[2], arr[3], arr[4], sec)
        }
        return nil
    }
}

struct TenantRegisterDetail: Decodable, Equatable {
    var accountType: String = ""
    var planType: String = ""
    var emailAddress: String = ""
    var firstName: String = ""
    var city: String = ""
    var country: String = ""
    var registerTime: String = ""

    enum CodingKeys: String, CodingKey {
        case accountType, planType, emailAddress, firstName, city, country, registerTime
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        accountType = (try? c.decode(String.self, forKey: .accountType)) ?? ""
        planType = (try? c.decode(String.self, forKey: .planType)) ?? ""
        emailAddress = (try? c.decode(String.self, forKey: .emailAddress)) ?? ""
        firstName = (try? c.decode(String.self, forKey: .firstName)) ?? ""
        city = (try? c.decode(String.self, forKey: .city)) ?? ""
        country = (try? c.decode(String.self, forKey: .country)) ?? ""
        if let s = try? c.decode(String.self, forKey: .registerTime) {
            registerTime = s
        } else if let n = try? c.decode(Double.self, forKey: .registerTime) {
            registerTime = String(Int(n))
        }
    }
}

// MARK: - Users

struct TenantOracleUser: Decodable, Identifiable, Equatable {
    var id: String = ""
    var username: String = ""
    var lifecycleState: String = ""
    var userId: String = ""
    var email: String = ""
    var domain: String = ""
    var lastSuccessfulLoginTime: String = ""
    var timeCreated: String = ""

    enum CodingKeys: String, CodingKey {
        case id, username, lifecycleState, userId, email, domain
        case lastSuccessfulLoginTime, timeCreated
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? ""
        username = (try? c.decode(String.self, forKey: .username)) ?? ""
        lifecycleState = (try? c.decode(String.self, forKey: .lifecycleState)) ?? ""
        userId = (try? c.decode(String.self, forKey: .userId)) ?? id
        email = (try? c.decode(String.self, forKey: .email)) ?? ""
        domain = (try? c.decode(String.self, forKey: .domain)) ?? ""
        lastSuccessfulLoginTime = Self.anyTime(c, .lastSuccessfulLoginTime)
        timeCreated = Self.anyTime(c, .timeCreated)
    }

    private static func anyTime(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> String {
        if let s = try? c.decode(String.self, forKey: k) { return s }
        if let n = try? c.decode(Double.self, forKey: k) {
            let d = Date(timeIntervalSince1970: n / (n > 1e12 ? 1000 : 1))
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd HH:mm:ss"
            return f.string(from: d)
        }
        return ""
    }
}

struct TenantOciGroup: Decodable, Identifiable, Equatable {
    var id: String = ""
    var name: String = ""
    var description: String = ""

    enum CodingKeys: String, CodingKey { case id, name, description, groupId, groupName }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id))
            ?? (try? c.decode(String.self, forKey: .groupId))
            ?? ""
        name = (try? c.decode(String.self, forKey: .name))
            ?? (try? c.decode(String.self, forKey: .groupName))
            ?? ""
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
    }
}

struct TenantPasswordPolicy: Decodable, Identifiable, Equatable {
    var id: String { name + "\(isEnabled)" }
    var name: String = ""
    var isEnabled: Bool = false
    var description: String = ""

    enum CodingKeys: String, CodingKey {
        case name, isEnabled, enabled, description, policyName
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name))
            ?? (try? c.decode(String.self, forKey: .policyName))
            ?? ""
        isEnabled = (try? c.decode(Bool.self, forKey: .isEnabled))
            ?? (try? c.decode(Bool.self, forKey: .enabled))
            ?? false
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
    }
}

// MARK: - Traffic / Boot / Social / Quota / Check

struct TenantTrafficAlert: Decodable, Equatable {
    var tenantId: Int64?
    var threshold: Double?
    var autoShutdown: Bool?
    var enabled: Bool?
    var statisticsEnabled: Bool?
    var success: Bool?
    var message: String?

    var thresholdText: String {
        guard let t = threshold, t > 0 else { return "" }
        if t == Double(Int(t)) { return "\(Int(t))" }
        return String(format: "%.2f", t)
    }
}

struct TenantBootVolume: Decodable, Identifiable, Equatable {
    var id: String = ""
    var displayName: String = ""
    var sizeInGBs: Int64 = 0
    var vpusPerGB: Int64 = 0
    var status: String = ""
    var instanceName: String = ""
    var regionCode: String = ""

    enum CodingKeys: String, CodingKey {
        case id, displayName, sizeInGBs, vpusPerGB, status, instanceName, regionCode
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? ""
        displayName = (try? c.decode(String.self, forKey: .displayName)) ?? ""
        sizeInGBs = (try? c.decode(Int64.self, forKey: .sizeInGBs))
            ?? Int64((try? c.decode(Int.self, forKey: .sizeInGBs)) ?? 0)
        vpusPerGB = (try? c.decode(Int64.self, forKey: .vpusPerGB))
            ?? Int64((try? c.decode(Int.self, forKey: .vpusPerGB)) ?? 0)
        status = (try? c.decode(String.self, forKey: .status)) ?? ""
        instanceName = (try? c.decode(String.self, forKey: .instanceName)) ?? ""
        regionCode = (try? c.decode(String.self, forKey: .regionCode)) ?? ""
    }
}

struct TenantSocialItem: Decodable, Identifiable, Equatable {
    var id: Int64 = 0
    var tenantId: Int64 = 0
    var clientId: String = ""
    var clientSecret: String = ""
    var socialTypeStr: String = ""
    var thirdLoginAddress: String = ""
    var redirectUrl: String = ""
    var socialStatus: String = "active"
    var cloudType: Int = 1

    enum CodingKeys: String, CodingKey {
        case id, tenantId, clientId, clientSecret, socialTypeStr
        case thirdLoginAddress, redirectUrl, socialStatus, cloudType
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(Int64.self, forKey: .id)) ?? 0
        tenantId = (try? c.decode(Int64.self, forKey: .tenantId)) ?? 0
        clientId = (try? c.decode(String.self, forKey: .clientId)) ?? ""
        clientSecret = (try? c.decode(String.self, forKey: .clientSecret)) ?? ""
        socialTypeStr = (try? c.decode(String.self, forKey: .socialTypeStr)) ?? ""
        thirdLoginAddress = (try? c.decode(String.self, forKey: .thirdLoginAddress)) ?? ""
        redirectUrl = (try? c.decode(String.self, forKey: .redirectUrl)) ?? ""
        socialStatus = (try? c.decode(String.self, forKey: .socialStatus)) ?? "active"
        cloudType = (try? c.decode(Int.self, forKey: .cloudType)) ?? 1
    }
}

/// Web `TenantResp` from `GET /tenants/listRegions?parentId=`
struct TenantRegionOption: Decodable, Identifiable, Equatable {
    var id: String = ""
    var tenancyName: String = ""
    var userName: String = ""
    var region: String = ""
    var tenantId: String = ""
    var defName: String = ""        // 自定义/显示名（对齐 Web getTenantAlias：自定义名优先）
    var isHomeRegion: Bool = false
    var hasChildren: Bool = false

    enum CodingKeys: String, CodingKey {
        case id, tenancyName, userName, region, tenantId, defName, isHomeRegion, hasChildren
    }

    init(
        id: String = "",
        tenancyName: String = "",
        userName: String = "",
        region: String = "",
        tenantId: String = "",
        defName: String = "",
        isHomeRegion: Bool = false,
        hasChildren: Bool = false
    ) {
        self.id = id
        self.tenancyName = tenancyName
        self.userName = userName
        self.region = region
        self.tenantId = tenantId
        self.defName = defName
        self.isHomeRegion = isHomeRegion
        self.hasChildren = hasChildren
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) {
            id = s
        } else if let n = try? c.decode(Int64.self, forKey: .id) {
            id = String(n)
        }
        tenancyName = (try? c.decode(String.self, forKey: .tenancyName)) ?? ""
        userName = (try? c.decode(String.self, forKey: .userName)) ?? ""
        region = (try? c.decode(String.self, forKey: .region)) ?? ""
        tenantId = (try? c.decode(String.self, forKey: .tenantId)) ?? ""
        defName = (try? c.decode(String.self, forKey: .defName)) ?? ""
        isHomeRegion = (try? c.decode(Bool.self, forKey: .isHomeRegion)) ?? false
        hasChildren = (try? c.decode(Bool.self, forKey: .hasChildren)) ?? false
    }

    /// 自定义显示名：优先 defName；若回落为 OCID/ID 则视为未设置（对齐 Web getTenantAlias）
    var customName: String {
        let raw = defName.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "" }
        let fallbacks = [userName, tenantId, id].filter { !$0.isEmpty }
        if fallbacks.contains(raw) { return "" }
        return raw
    }

    /// 租户展示名：自定义名优先，其次租户名，再用户名/ID（对齐 Web getTenantName）
    var displayName: String {
        if !customName.isEmpty { return customName }
        if !tenancyName.isEmpty { return tenancyName }
        if !userName.isEmpty { return userName }
        return id
    }

    /// 租户真实展示名（方案 B：优先真实租户名 tenancyName，其次自定义名，再用户名/ID）
    var tenantPrimaryName: String {
        if !tenancyName.isEmpty && !tenancyName.hasPrefix("ocid1.") { return tenancyName }
        if !customName.isEmpty && !customName.hasPrefix("ocid1.") { return customName }
        if !userName.isEmpty && !userName.hasPrefix("ocid1.") { return userName }
        return id
    }

    /// 区域中文名：code → RegionCnName；未知则返回原始 code（对齐 Web REGION_MAP 回落）
    var regionNameText: String {
        if region.isEmpty { return "" }
        return RegionCnName.table[region] ?? region
    }

    /// 二级区域下拉显示：区域名(中文名或原始区码) + 主区域标识。
    /// 主区域标识跟随系统语言：zh→"主" / en→"Home"（对齐 Web tenants.col.mainRegion）。
    var regionDropdownLabel: String {
        var base = region
        if base.isEmpty {
            base = tenancyName.isEmpty ? (userName.isEmpty ? id : userName) : tenancyName
        } else {
            base = regionNameText
        }
        return isHomeRegion ? "\(base) · 主" : base
    }

    /// 租户下拉统一显示（方案 B）：真实租户名优先 · 中文区域（对齐 Web getTenantLabel）
    var label: String {
        var s = tenantPrimaryName
        if s.isEmpty { s = id }
        let rn = regionNameText
        if !rn.isEmpty { s += " · \(rn)" }
        return s
    }

    /// 转为列表行模型，不足字段从父租户继承（对齐 Web regionList 行数据）
    func toTenantItem(fallback parent: TenantItem) -> TenantItem {
        var t = TenantItem()
        t.id = Int64(id) ?? 0
        t.tenantId = tenantId.isEmpty ? parent.tenantId : tenantId
        t.tenancyName = tenancyName.isEmpty ? (userName.isEmpty ? parent.tenancyName : userName) : tenancyName
        t.userName = userName.isEmpty ? parent.userName : userName
        t.region = region
        t.isHomeRegion = isHomeRegion
        t.hasChildren = hasChildren
        t.defName = parent.defName
        t.cloudType = parent.cloudType
        t.supportAI = parent.supportAI
        t.openBootFlag = false
        t.createdAt = ""
        t.isActive = true
        t.apiSynced = false
        return t
    }
}

// MARK: - Security rules / MySQL (租户详情页弹层)

struct TenantSecurityRule: Decodable, Identifiable, Equatable {
    var id: String { "\(type)-\(protocolValue)-\(source)-\(ports)" }
    var type: String = ""
    var protocolValue: String = ""
    var source: String = ""
    var ports: String = ""

    enum CodingKeys: String, CodingKey {
        case type, source, ports
        case protocolValue = "protocol"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = (try? c.decode(String.self, forKey: .type)) ?? ""
        if let s = try? c.decode(String.self, forKey: .protocolValue) {
            protocolValue = s
        } else if let n = try? c.decode(Int.self, forKey: .protocolValue) {
            protocolValue = String(n)
        }
        source = (try? c.decode(String.self, forKey: .source)) ?? ""
        if let s = try? c.decode(String.self, forKey: .ports) {
            ports = s
        } else if let n = try? c.decode(Int.self, forKey: .ports) {
            ports = String(n)
        }
    }

    var protocolDisplay: String {
        switch protocolValue.lowercased() {
        case "all", "all protocols": return "全部"
        case "6", "tcp": return "TCP"
        case "17", "udp": return "UDP"
        case "1", "icmp": return "ICMP"
        default: return protocolValue.isEmpty ? "—" : protocolValue
        }
    }

    var portsDisplay: String {
        if ports.isEmpty || ports == "null" || ports == "N/A" || protocolValue == "1" { return "—" }
        return ports
    }
}

/// 安全规则一键模板的一条规则（对齐 Web TEMPLATES）
struct SecurityRuleTemplate {
    var protocolValue: String  // tcp / udp / icmp / all
    var source: String         // CIDR
    var ports: String = ""     // 提交用完整端口串，可空
    var portStart: String = ""
    var portEnd: String = ""
}

/// 安全规则一键模板（对齐 Web TEMPLATES：[web, db, k8s, docker, minimal, icmp]）
enum SecurityRuleTemplates {
    static let web = SecurityRuleTemplateGroup(
        id: "web", name: "Web", desc: "SSH + HTTP + HTTPS",
        rules: [
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "22"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "80"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "443"),
        ])
    static let db = SecurityRuleTemplateGroup(
        id: "db", name: "数据库", desc: "MySQL + PostgreSQL + Redis",
        rules: [
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "3306"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "5432"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "6379"),
        ])
    static let k8s = SecurityRuleTemplateGroup(
        id: "k8s", name: "Kubernetes", desc: "API/etcd/Kubelet/NodePort",
        rules: [
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "6443"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "2379-2380"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "10250"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "30000-32767"),
        ])
    static let docker = SecurityRuleTemplateGroup(
        id: "docker", name: "Docker", desc: "SSH + Swarm",
        rules: [
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "22"),
            SecurityRuleTemplate(protocolValue: "tcp", source: "10.0.0.0/8", ports: "2375-2376"),
        ])
    static let minimal = SecurityRuleTemplateGroup(
        id: "minimal", name: "最小化", desc: "仅 SSH",
        rules: [
            SecurityRuleTemplate(protocolValue: "tcp", source: "0.0.0.0/0", ports: "22"),
        ])
    static let icmp = SecurityRuleTemplateGroup(
        id: "icmp", name: "ICMP", desc: "Ping 探测",
        rules: [
            SecurityRuleTemplate(protocolValue: "icmp", source: "0.0.0.0/0"),
            SecurityRuleTemplate(protocolValue: "icmp", source: "::/0"),
        ])

    static let all: [SecurityRuleTemplateGroup] = [web, db, k8s, docker, minimal, icmp]
}

struct SecurityRuleTemplateGroup {
    var id: String
    var name: String
    var desc: String
    var rules: [SecurityRuleTemplate]
}

struct TenantMysqlInstance: Decodable, Identifiable, Equatable {
    var id: String = ""
    var dbId: String = ""
    var displayName: String = ""
    var dbVersion: String = ""
    var dbStatus: String = ""
    var dbPublicUrl: String = ""
    var dbPort: String = ""
    var dbUsername: String = ""
    /// Web 字段 `dbName`（登录用户名展示）
    var dbName: String = ""
    var dbPassword: String = ""
    var shape: String = ""
    var dataStorageSizeInGBs: String = ""

    enum CodingKeys: String, CodingKey {
        case id, dbId, displayName, dbVersion, dbStatus, dbPublicUrl, dbPort
        case dbUsername, dbName, dbPassword, shape, shapeName
        case dataStorageSizeInGBs, storageSize, dataStorageSize
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) { id = s }
        else if let n = try? c.decode(Int64.self, forKey: .id) { id = String(n) }
        dbId = (try? c.decode(String.self, forKey: .dbId)) ?? id
        displayName = (try? c.decode(String.self, forKey: .displayName)) ?? ""
        dbVersion = (try? c.decode(String.self, forKey: .dbVersion)) ?? ""
        dbStatus = (try? c.decode(String.self, forKey: .dbStatus)) ?? ""
        dbPublicUrl = (try? c.decode(String.self, forKey: .dbPublicUrl)) ?? ""
        if let s = try? c.decode(String.self, forKey: .dbPort) { dbPort = s }
        else if let n = try? c.decode(Int.self, forKey: .dbPort) { dbPort = String(n) }
        dbUsername = (try? c.decode(String.self, forKey: .dbUsername)) ?? ""
        dbName = (try? c.decode(String.self, forKey: .dbName)) ?? dbUsername
        dbPassword = (try? c.decode(String.self, forKey: .dbPassword)) ?? ""
        // Web 用 shapeName
        if let s = try? c.decode(String.self, forKey: .shapeName), !s.isEmpty {
            shape = s
        } else {
            shape = (try? c.decode(String.self, forKey: .shape)) ?? ""
        }
        if let s = try? c.decode(String.self, forKey: .dataStorageSizeInGBs) { dataStorageSizeInGBs = s }
        else if let n = try? c.decode(Int.self, forKey: .dataStorageSizeInGBs) { dataStorageSizeInGBs = String(n) }
        else if let s = try? c.decode(String.self, forKey: .storageSize) { dataStorageSizeInGBs = s }
        else if let n = try? c.decode(Int.self, forKey: .dataStorageSize) { dataStorageSizeInGBs = String(n) }
        if id.isEmpty { id = dbId.isEmpty ? displayName : dbId }
    }

    var loginUserDisplay: String {
        if !dbName.isEmpty { return dbName }
        if !dbUsername.isEmpty { return dbUsername }
        return "—"
    }

    var connectDisplay: String {
        let host = dbPublicUrl.isEmpty ? "—" : dbPublicUrl
        let port = dbPort.isEmpty ? "3306" : dbPort
        return "\(host)/\(port)"
    }
}

struct TenantAccountCheckResult: Decodable, Equatable {
    var totalAccounts: Int = 0
    var activeAccounts: Int = 0
    var inactiveAccounts: Int = 0
    var inactiveAccountNames: [String] = []
    var message: String = ""

    enum CodingKeys: String, CodingKey {
        case totalAccounts, activeAccounts, inactiveAccounts, message
        case total, active, inactive
        case inactiveAccountNames, inactiveNames, inActiveAccountNames
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalAccounts = (try? c.decode(Int.self, forKey: .totalAccounts))
            ?? (try? c.decode(Int.self, forKey: .total))
            ?? 0
        activeAccounts = (try? c.decode(Int.self, forKey: .activeAccounts))
            ?? (try? c.decode(Int.self, forKey: .active))
            ?? 0
        inactiveAccounts = (try? c.decode(Int.self, forKey: .inactiveAccounts))
            ?? (try? c.decode(Int.self, forKey: .inactive))
            ?? 0
        inactiveAccountNames = (try? c.decode([String].self, forKey: .inactiveAccountNames))
            ?? (try? c.decode([String].self, forKey: .inactiveNames))
            ?? (try? c.decode([String].self, forKey: .inActiveAccountNames))
            ?? []
        message = (try? c.decode(String.self, forKey: .message)) ?? ""
    }
}

/// One row from `/tenants/quota` items[]（对齐 Web `renderQuotaContent`）。
struct TenantQuotaItem: Identifiable, Equatable {
    var id: String { "\(name)-\(scope)-\(available)-\(used)-\(limit)" }
    var name: String
    var scope: String
    /// 展示用字符串
    var available: String
    var used: String
    var limit: String
    /// 数值（进度条 / 染色），解析失败为 0
    var totalValue: Double
    var usedValue: Double
    var availableValue: Double
    /// 推断的实例类型；空字符串表示无可识别类型（对齐 Web `null`）
    var instanceType: String

    /// used/total，0…100
    var usagePercent: Int {
        guard totalValue > 0 else { return 0 }
        return min(100, Int(round(usedValue / totalValue * 100)))
    }

    var hasInstanceType: Bool { !instanceType.isEmpty }

    static func parseList(from root: [String: Any]) -> (items: [TenantQuotaItem], page: Int, hasNext: Bool, region: String) {
        let page = (root["page"] as? Int) ?? Int("\(root["page"] ?? "")") ?? 0
        let hasNext = (root["hasNextPage"] as? Bool) ?? false
        let region = (root["region"] as? String) ?? (root["regionEn"] as? String) ?? ""
        var items: [TenantQuotaItem] = []
        let rawItems = (root["items"] as? [[String: Any]]) ?? []
        for it in rawItems {
            let name = "\(it["name"] ?? it["limitName"] ?? it["resourceName"] ?? "—")"
            let scope = "\(it["scope"] ?? it["availabilityDomain"] ?? "")"
            let totalV = number(it["total"] ?? it["limit"] ?? it["value"])
            let usedV = number(it["used"] ?? it["usedQuota"])
            let availV = number(it["available"] ?? it["availableQuota"] ?? it["remaining"])
            let available = formatNum(it["available"] ?? it["availableQuota"] ?? it["remaining"], fallback: availV)
            let used = formatNum(it["used"] ?? it["usedQuota"], fallback: usedV)
            let limit = formatNum(it["total"] ?? it["limit"] ?? it["value"], fallback: totalV)
            items.append(TenantQuotaItem(
                name: name,
                scope: scope,
                available: available,
                used: used,
                limit: limit,
                totalValue: totalV,
                usedValue: usedV,
                availableValue: availV,
                instanceType: Self.inferType(name) ?? ""
            ))
        }
        return (items, page, hasNext, region)
    }

    private static func number(_ raw: Any?) -> Double {
        if let d = raw as? Double { return d }
        if let i = raw as? Int { return Double(i) }
        if let n = raw as? NSNumber { return n.doubleValue }
        if let s = raw as? String, let d = Double(s.trimmingCharacters(in: .whitespaces)) { return d }
        if let raw = raw {
            let s = "\(raw)".trimmingCharacters(in: .whitespaces)
            return Double(s) ?? 0
        }
        return 0
    }

    private static func formatNum(_ raw: Any?, fallback: Double) -> String {
        if let raw = raw {
            let s = "\(raw)".trimmingCharacters(in: .whitespaces)
            if !s.isEmpty && s != "<null>" { return s }
        }
        if fallback == 0 { return "0" }
        if fallback.rounded() == fallback { return String(Int(fallback)) }
        return String(format: "%g", fallback)
    }

    /// 对齐 Web `quotaInstanceType`；无法识别返回 nil
    private static func inferType(_ limitName: String) -> String? {
        let n = limitName.lowercased()
        let bm = n.hasPrefix("bm-") || n.contains("-bm-")
        var arch: String?
        if n.contains("-a1-") || n.contains("-a2-") { arch = "Ampere" }
        else if n.contains("-e5-") { arch = "AMD E5" }
        else if n.contains("-e4-") { arch = "AMD E4" }
        else if n.contains("-e3-") { arch = "AMD E3" }
        else if n.contains("-e2-") || n.contains("e2-1-micro") { arch = "AMD E2" }
        else if n.contains("gpu") { arch = "GPU" }
        else if n.contains("hpc") { arch = "HPC" }
        else if n.contains("optimized3") { arch = "Intel 高频" }
        else if n.contains("-x9-") || n.hasPrefix("x9-") || n.contains("x9-") { arch = "Intel X9" }
        else if n.contains("-x8-") { arch = "Intel X8" }
        else if n.contains("-x7-") { arch = "Intel X7" }
        else if n.contains("standard3") { arch = "Intel" }
        else if n.contains("standard2") { arch = "Intel 旧款" }
        else if n.contains("dense-a4-ax") { arch = "DenseIO A4 AX" }
        else if n.contains("dense-io") || n.contains("denseio") { arch = "DenseIO" }
        else if n.contains("autonomous-") || n.contains("-adb-") || n.hasPrefix("adb-") { arch = "ADB" }
        else if n.contains("mysql") { arch = "MySQL" }
        else if n.contains("nosql") { arch = "NoSQL" }
        else if n.contains("exadata") { arch = "Exadata" }
        else if n.contains("db-system") || n.contains("db-vcpu") || n.contains("db-node") { arch = "DBCS" }
        guard let arch = arch else { return bm ? "裸金属" : nil }
        return bm ? "裸金属·\(arch)" : arch
    }
}

enum TenantUserTab: String, CaseIterable, Identifiable {
    case users, notifications, mfa
    var id: String { rawValue }
    var title: String {
        switch self {
        case .users: return "用户"
        case .notifications: return "通知邮箱"
        case .mfa: return "MFA"
        }
    }
}

/// 对齐后端 `OciAuditEventDto`（Web 审计日志表列）。
struct TenantAuditLogEntry: Decodable, Identifiable, Equatable {
    var id: String { "\(eventType)-\(eventTime)-\(userName)-\(ipAddress)-\(responseStatus)" }
    /// 事件短名（后端 `AuditEvent.Data.eventName`，如 LaunchInstance）
    var eventType: String = ""
    /// 事件完整类型（如 com.oraclecloud.ComputeApi.LaunchInstance），用于 hover 排查
    var eventFullType: String = ""
    var userName: String = ""
    /// 认证类型原始码（authType）。无公开枚举，**不可**用于区分控制台/API
    var userType: String = ""
    /// 控制台会话 ID。非空 = 控制台登录会话；为空 = API / SDK 调用
    var consoleSessionId: String = ""
    var ipAddress: String = ""
    /// 客户端原始 UserAgent（已降级为 hover 详情）
    var clientEnv: String = ""
    var eventTime: String = ""
    /// 响应状态码；后端在 response 为空时填 "-"
    var responseStatus: String = ""

    /// 状态未知：后端在 response 为 null 时填 "-"，不能据此判失败
    var isUnknownStatus: Bool {
        let s = responseStatus.trimmingCharacters(in: .whitespaces)
        return s.isEmpty || s == "-"
    }

    /// 2xx 或 "OK" 视为成功（对齐原项目 `mobile/audit_log.ftl` 的 `startsWith('2')`）
    var isSuccess: Bool {
        if isUnknownStatus { return false }
        let s = responseStatus.trimmingCharacters(in: .whitespaces).uppercased()
        return s.hasPrefix("2") || s == "OK"
    }

    /// 只有「状态已知且非 2xx」才算失败，用于错误行高亮
    var isError: Bool {
        !isUnknownStatus && !isSuccess
    }

    /// 是否控制台会话：唯一可靠判据是 consoleSessionId 非空
    var isConsoleSession: Bool {
        !consoleSessionId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// 环境列展示值：控制台 / API / —
    var envLabel: String {
        let hasAnySignal = !consoleSessionId.isEmpty || !userType.isEmpty || !clientEnv.isEmpty
        guard hasAnySignal else { return "—" }
        return isConsoleSession ? "控制台" : "API"
    }

    /// 环境列 hover 详情：原始 UA + authType 原始码
    var envDetail: String {
        var parts: [String] = []
        if !userType.isEmpty { parts.append("authType=\(userType)") }
        if !clientEnv.isEmpty { parts.append("UA=\(clientEnv)") }
        if !consoleSessionId.isEmpty { parts.append("consoleSessionId=\(consoleSessionId)") }
        return parts.isEmpty ? "无环境信息" : parts.joined(separator: "\n")
    }

    /// 事件列 hover 详情：完整事件类型
    var eventDetail: String {
        eventFullType.isEmpty ? eventType : eventFullType
    }

    enum CodingKeys: String, CodingKey {
        case eventType, eventName, type
        case eventFullType
        case userName, principalName, user
        case userType
        case consoleSessionId
        case ipAddress, sourceIP, sourceIp, ip
        case clientEnv
        case eventTime, time
        case responseStatus, status
        case message
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        eventType = (try? c.decode(String.self, forKey: .eventType))
            ?? (try? c.decode(String.self, forKey: .eventName))
            ?? (try? c.decode(String.self, forKey: .type))
            ?? ""
        eventFullType = (try? c.decode(String.self, forKey: .eventFullType)) ?? ""
        userName = (try? c.decode(String.self, forKey: .userName))
            ?? (try? c.decode(String.self, forKey: .principalName))
            ?? (try? c.decode(String.self, forKey: .user))
            ?? ""
        userType = (try? c.decode(String.self, forKey: .userType)) ?? ""
        consoleSessionId = (try? c.decode(String.self, forKey: .consoleSessionId)) ?? ""
        ipAddress = (try? c.decode(String.self, forKey: .ipAddress))
            ?? (try? c.decode(String.self, forKey: .sourceIP))
            ?? (try? c.decode(String.self, forKey: .sourceIp))
            ?? (try? c.decode(String.self, forKey: .ip))
            ?? ""
        clientEnv = (try? c.decode(String.self, forKey: .clientEnv))
            ?? (try? c.decode(String.self, forKey: .message))
            ?? ""
        eventTime = (try? c.decode(String.self, forKey: .eventTime))
            ?? (try? c.decode(String.self, forKey: .time))
            ?? ""
        responseStatus = (try? c.decode(String.self, forKey: .responseStatus))
            ?? (try? c.decode(String.self, forKey: .status))
            ?? ""
    }
}

/// `POST /tenants/audit/log` 分页结果（`OciPageResult`）。
struct TenantAuditLogPage: Equatable {
    var items: [TenantAuditLogEntry] = []
    var nextPageToken: String?
    /// 后端标记的演示数据（MODERN_UI_MOCK_DATA=true 且真实查询为空或失败）
    var mock: Bool = false
}

// MARK: - Generic API helpers

struct TenantBoolMessage: Decodable {
    var success: Bool = false
    var message: String = ""

    enum CodingKeys: String, CodingKey { case success, message, msg }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let b = try? c.decode(Bool.self, forKey: .success) {
            success = b
        } else if let n = try? c.decode(Int.self, forKey: .success) {
            success = n != 0
        }
        message = (try? c.decode(String.self, forKey: .message))
            ?? (try? c.decode(String.self, forKey: .msg))
            ?? ""
    }
}

struct TenantApiEnvelope: Decodable {
    var success: Bool?
    var message: String?
    var msg: String?
    var code: Int?
    var data: AnyCodableJSON?

    var ok: Bool {
        if let success = success { return success }
        if let code = code { return code == 200 || code == 0 }
        return false
    }
    var text: String { message ?? msg ?? (ok ? "成功" : "失败") }
}

/// Lightweight JSON tree for flexible envelope data.
enum AnyCodableJSON: Decodable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([AnyCodableJSON])
    case object([String: AnyCodableJSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([AnyCodableJSON].self) { self = .array(a); return }
        if let o = try? c.decode([String: AnyCodableJSON].self) { self = .object(o); return }
        self = .null
    }

    var stringValue: String? {
        switch self {
        case .string(let s): return s
        case .number(let n): return String(n)
        case .bool(let b): return b ? "true" : "false"
        default: return nil
        }
    }

    var dict: [String: AnyCodableJSON]? {
        if case .object(let o) = self { return o }
        return nil
    }

    var arrayValue: [AnyCodableJSON]? {
        if case .array(let a) = self { return a }
        return nil
    }
}

// MARK: - Sheet routing

/// 租户 OCI 同步进度态（对齐 Web syncModal）
enum TenantSyncPhase: Equatable {
    case running
    case success
    case error
    case waitingLong  // 超过预估时间仍在等服务端
}

enum TenantSheet: Identifiable, Equatable {
    case add
    case editName(TenantItem)
    case editCost(TenantItem)
    case accountDetail(TenantItem)
    case users(TenantItem)
    case traffic(TenantItem)
    case email(TenantItem)
    case social(TenantItem)
    case bootVolumes(TenantItem)
    case accountCheck
    case exportAll
    case exportOne(TenantItem)
    case importJSON
    case updateProgress(tenantId: Int64, lines: [String])
    /// OCI 同步进度（Web syncModal）
    case syncProgress(tenantId: Int64, name: String)
    /// 原生二级弹层
    case bootCreate(TenantItem)
    case regionSub(TenantItem)
    case trafficQuery(TenantItem)
    case aiChat(TenantItem)
    case passwordResult(title: String, username: String, password: String)
    case securityRules(TenantItem)
    case mysql(TenantItem)
    /// 租户护盾：快速绑定代理
    case proxyQuick(TenantItem)
    /// 一键切换为受限 API
    case restrictedApi(TenantItem)

    var id: String {
        switch self {
        case .add: return "add"
        case .editName(let t): return "name-\(t.id)"
        case .editCost(let t): return "cost-\(t.id)"
        case .accountDetail(let t): return "detail-\(t.id)"
        case .users(let t): return "users-\(t.id)"
        case .traffic(let t): return "traffic-\(t.id)"
        case .email(let t): return "email-\(t.id)"
        case .social(let t): return "social-\(t.id)"
        case .bootVolumes(let t): return "boot-volumes-\(t.id)"
        case .accountCheck: return "account-check"
        case .exportAll: return "export-all"
        case .exportOne(let t): return "export-\(t.id)"
        case .importJSON: return "import-json"
        case .updateProgress(let id, _): return "update-\(id)"
        case .syncProgress(let id, _): return "sync-\(id)"
        case .bootCreate(let t): return "boot-create-\(t.id)"
        case .regionSub(let t): return "region-sub-\(t.id)"
        case .trafficQuery(let t): return "traffic-query-\(t.id)"
        case .aiChat(let t): return "ai-chat-\(t.id)"
        case .passwordResult: return "pwd-result"
        case .securityRules(let t): return "rules-\(t.id)"
        case .mysql(let t): return "mysql-\(t.id)"
        case .proxyQuick(let t): return "proxy-\(t.id)"
        case .restrictedApi(let t): return "restricted-\(t.id)"
        }
    }
}

// ─── Restricted API Models ──────────────────────────────────────

enum RestrictedApiPhase: Equatable {
    case backup
    case executing
}

enum RestrictedStepStatus: Equatable {
    case pending
    case running
    case completed
    case error
}

struct RestrictedApiStep: Identifiable, Equatable {
    let id: Int
    let title: String
    var status: RestrictedStepStatus = .pending
    var time: String = ""
    var progressText: String = ""
}

struct RestrictedApiBackupData: Codable, Equatable {
    var tenantId: Int64?
    var userName: String?
    var userOcid: String?
    var tenancyOcid: String?
    var fingerprint: String?
    var region: String?
    var fileName: String?
    var keyContent: String?
    var configSnippet: String?
}

struct RestrictedApiTaskSummary: Codable, Equatable {
    var domainName: String?
    var groupName: String?
    var groupId: String?
    var policyName: String?
    var policyId: String?
    var userName: String?
    var userId: String?
    var fingerprint: String?
    var time: String?
}

// MARK: - Subpage models

/// 对齐后端 `CloudCostItem`（Web 费用明细行）。
struct TenantCostItem: Decodable, Identifiable, Equatable {
    var id: String { "\(day)|\(resourceType)|\(resourceId)|\(skuName)|\(cost)" }
    var cloudType: Int = 1
    var resourceId: String = ""
    var resourceType: String = ""
    var skuName: String = ""
    var day: String = ""
    var cost: Double = 0

    enum CodingKeys: String, CodingKey {
        case cloudType, resourceId, resourceType, skuName, day, cost
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let i = try? c.decode(Int.self, forKey: .cloudType) {
            cloudType = i
        } else if let s = try? c.decode(String.self, forKey: .cloudType), let i = Int(s) {
            cloudType = i
        }
        resourceId = (try? c.decode(String.self, forKey: .resourceId)) ?? ""
        resourceType = (try? c.decode(String.self, forKey: .resourceType)) ?? ""
        skuName = (try? c.decode(String.self, forKey: .skuName)) ?? ""
        day = (try? c.decode(String.self, forKey: .day)) ?? ""
        if let d = try? c.decode(Double.self, forKey: .cost) {
            cost = d
        } else if let s = try? c.decode(String.self, forKey: .cost), let d = Double(s) {
            cost = d
        } else if let n = try? c.decode(Decimal.self, forKey: .cost) {
            cost = NSDecimalNumber(decimal: n).doubleValue
        }
    }

    /// Web 归类：instance→计算 / boot-volume|block-volume→存储 / vnic→网络 / else→其他
    var category: TenantCostCategory {
        switch resourceType.lowercased() {
        case "instance": return .compute
        case "boot-volume", "block-volume": return .storage
        case "vnic": return .network
        default: return .other
        }
    }
}

enum TenantCostCategory: String, CaseIterable, Identifiable {
    case compute, storage, network, other
    var id: String { rawValue }
    var title: String {
        switch self {
        case .compute: return "计算"
        case .storage: return "存储"
        case .network: return "网络"
        case .other: return "其他"
        }
    }
}

struct TenantImageInfo: Decodable, Equatable, Identifiable {
    var id: String { imageId + operatingSystem + operatingSystemVersion }
    var imageId: String = ""
    var operatingSystem: String = ""
    var operatingSystemVersion: String = ""
}

struct TenantSubscribedRegion: Decodable, Identifiable, Equatable {
    var id: String { regionName.isEmpty ? regionKey : regionName }
    var regionKey: String = ""
    var regionName: String = ""
    var status: String = ""
    var isHomeRegion: Bool = false

    enum CodingKeys: String, CodingKey {
        case regionKey, regionName, status, isHomeRegion
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        regionKey = (try? c.decode(String.self, forKey: .regionKey)) ?? ""
        regionName = (try? c.decode(String.self, forKey: .regionName)) ?? ""
        if let s = try? c.decode(String.self, forKey: .status) {
            status = s
        } else if let obj = try? c.decode([String: String].self, forKey: .status) {
            status = obj["value"] ?? ""
        }
        isHomeRegion = (try? c.decode(Bool.self, forKey: .isHomeRegion)) ?? false
    }
}

struct TenantUnsubscribedRegion: Decodable, Identifiable, Equatable {
    var id: String { key }
    var key: String = ""
    var name: String = ""
    var cnName: String = ""
}

struct TenantTrafficRow: Decodable, Identifiable, Equatable {
    /// Unique per time-series sample (instance + timePoint).
    var id: String { "\(instanceId)|\(timePoint)|\(displayName)" }
    var instanceId: String = ""
    var displayName: String = ""
    var instanceName: String = ""
    var region: String = ""
    var publicIp: String = ""
    var publicIps: String = ""
    var state: String = ""
    var timePoint: String = ""
    var ingressBytes: Double = 0
    var egressBytes: Double = 0
    var totalBytes: Double = 0

    enum CodingKeys: String, CodingKey {
        case instanceId, displayName, instanceName, region, publicIp, publicIps, state
        case timePoint, ingressBytes, egressBytes, totalBytes
    }

    init(
        instanceId: String = "",
        displayName: String = "",
        instanceName: String = "",
        region: String = "",
        publicIp: String = "",
        publicIps: String = "",
        state: String = "",
        timePoint: String = "",
        ingressBytes: Double = 0,
        egressBytes: Double = 0,
        totalBytes: Double = 0
    ) {
        self.instanceId = instanceId
        self.displayName = displayName
        self.instanceName = instanceName
        self.region = region
        self.publicIp = publicIp
        self.publicIps = publicIps
        self.state = state
        self.timePoint = timePoint
        self.ingressBytes = ingressBytes
        self.egressBytes = egressBytes
        self.totalBytes = totalBytes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        instanceId = (try? c.decode(String.self, forKey: .instanceId)) ?? ""
        displayName = (try? c.decode(String.self, forKey: .displayName)) ?? ""
        instanceName = (try? c.decode(String.self, forKey: .instanceName)) ?? ""
        region = (try? c.decode(String.self, forKey: .region)) ?? ""
        publicIp = (try? c.decode(String.self, forKey: .publicIp)) ?? ""
        publicIps = (try? c.decode(String.self, forKey: .publicIps)) ?? ""
        state = (try? c.decode(String.self, forKey: .state)) ?? ""
        // LocalDateTime may arrive as "yyyy-MM-dd'T'HH:mm:ss" or "yyyy-MM-dd HH:mm:ss"
        if let s = try? c.decode(String.self, forKey: .timePoint) {
            timePoint = s
        } else {
            timePoint = ""
        }
        ingressBytes = (try? c.decode(Double.self, forKey: .ingressBytes)) ?? 0
        egressBytes = (try? c.decode(Double.self, forKey: .egressBytes)) ?? 0
        totalBytes = (try? c.decode(Double.self, forKey: .totalBytes)) ?? 0
        if totalBytes == 0 {
            totalBytes = ingressBytes + egressBytes
        }
    }

    var title: String {
        if !displayName.isEmpty { return displayName }
        if !instanceName.isEmpty { return instanceName }
        return instanceId
    }

    var ipText: String {
        if !publicIp.isEmpty { return publicIp }
        if !publicIps.isEmpty { return publicIps }
        return ""
    }

    var totalGB: String {
        String(format: "%.2f GB", totalBytes / 1_073_741_824.0)
    }
}

struct TenantAiModel: Identifiable, Equatable {
    var id: String
    var displayName: String
    var version: String
}

struct TenantChatLine: Identifiable, Equatable {
    var id: UUID = UUID()
    var role: String // user / ai
    var text: String
}

enum TenantKnownRegions {
    static let oci: [SelectOption] = [
        "af-johannesburg-1", "af-casablanca-1",
        "ap-chuncheon-1", "ap-hyderabad-1", "ap-melbourne-1", "ap-mumbai-1",
        "ap-osaka-1", "ap-seoul-1", "ap-kulai-2", "ap-singapore-1", "ap-singapore-2",
        "ap-sydney-1", "ap-tokyo-1", "ap-batam-1",
        "ca-montreal-1", "ca-toronto-1",
        "eu-amsterdam-1", "eu-frankfurt-1", "eu-jovanovac-1", "eu-madrid-1", "eu-madrid-3",
        "eu-marseille-1", "eu-milan-1", "eu-turin-1", "eu-paris-1", "eu-stockholm-1", "eu-zurich-1",
        "il-jerusalem-1",
        "me-abudhabi-1", "me-dubai-1", "me-jeddah-1",
        "mx-monterrey-1", "mx-queretaro-1",
        "sa-bogota-1", "sa-santiago-1", "sa-saopaulo-1", "sa-vinhedo-1", "sa-valparaiso-1",
        "uk-cardiff-1", "uk-london-1",
        "us-ashburn-1", "us-chicago-1", "us-phoenix-1", "us-sanjose-1"
    ].map { code in
        let flag = RegionFlag.emoji(code)
        let cn = RegionCnName.table[code] ?? code
        let title = "\(flag) \(cn) (\(code))"
        return SelectOption(id: code, title: title)
    }
}
