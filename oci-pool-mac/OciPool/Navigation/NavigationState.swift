import Foundation
import Combine

/// Cross-page tenant filter when jumping from 租户详情 → 实例列表 / 开机管理.
struct PendingTenantListFilter: Equatable {
    var parentTenantId: String
    var regionTenantId: String
    var tenantName: String = ""
}

/// Touched from AppKit + SwiftUI; create/use on main thread only (not type-isolated,
/// avoids AppDelegate property-init MainActor deadlock on Big Sur).
final class NavigationState: ObservableObject {
    static let shared = NavigationState()

    /// Fires after `selected` changes (for AppKit hosts).
    let selectionDidChange = PassthroughSubject<NavID, Never>()

    @Published var selected: NavID = .dashboard {
        didSet {
            guard selected != oldValue else { return }
            selectionDidChange.send(selected)
            // Keep the parent section open for the selected page
            if let section = NavigationCatalog.section(for: selected) {
                expandedSection = section
            }
        }
    }
    @Published var searchText: String = ""
    /// Accordion: at most one first-level section expanded (nil = all collapsed).
    @Published var expandedSection: NavSection? = .service
    @Published var sidebarCollapsed: Bool {
        didSet { UserDefaults.standard.set(sidebarCollapsed, forKey: "sidebarCollapsed") }
    }

    /// Consumed once by InstancesViewModel on appear.
    private var pendingInstancesFilter: PendingTenantListFilter?
    /// Consumed once by BootViewModel on appear.
    private var pendingBootFilter: PendingTenantListFilter?
    /// Consumed once by TenantsViewModel on start: return from sub-page → tenant detail.
    private var pendingDetailParent: TenantItem?
    /// 租户列表「AI」→ AI 对话页预选租户；由 AiChatViewModel 消费一次。
    private var pendingAiChatTenantId: Int64?
    /// 递增以通知已在 AI 对话页时再次切入（同页不重建 VC）。
    @Published private(set) var aiChatOpenToken: Int = 0

    private init() {
        sidebarCollapsed = UserDefaults.standard.bool(forKey: "sidebarCollapsed")
        // Open only the section of the default page
        expandedSection = NavigationCatalog.section(for: selected) ?? .service
    }

    func select(_ nav: NavID) {
        selected = nav
    }

    /// 子页面包屑显示的租户名（查看开机/资源列表共用）
    @Published private(set) var tenantSubPageName: String = ""

    /// 从租户详情跳入时保存父租户对象，返回时可精准回到该租户详情
    @Published var fromTenantDetailParent: TenantItem? = nil

    /// 租户详情 → 实例列表子页（对齐 Web page-tenant-resources）
    func openInstances(parentId: String, regionId: String, tenantName: String = "", parentTenant: TenantItem? = nil) {
        pendingInstancesFilter = PendingTenantListFilter(
            parentTenantId: parentId,
            regionTenantId: regionId,
            tenantName: tenantName
        )
        tenantSubPageName = tenantName
        fromTenantDetailParent = parentTenant
        select(.tenantResources)
    }

    /// 租户详情 → 开机/抢机任务子页（对齐 Web page-tenant-grab）
    func openBootTasks(parentId: String, regionId: String, tenantName: String = "", parentTenant: TenantItem? = nil) {
        pendingBootFilter = PendingTenantListFilter(
            parentTenantId: parentId,
            regionTenantId: regionId,
            tenantName: tenantName
        )
        tenantSubPageName = tenantName
        fromTenantDetailParent = parentTenant
        select(.tenantGrab)
    }

    /// 子页（查看开机/资源列表）→ 侧栏高亮归属租户管理
    var sidebarActiveID: NavID {
        switch selected {
        case .tenantGrab, .tenantResources: return .tenants
        default: return selected
        }
    }

    /// 子页返回上一级：若来自租户详情则返回该租户详情页，否则返回租户列表
    func closeTenantSubPage() {
        if let parent = fromTenantDetailParent {
            pendingDetailParent = parent
            fromTenantDetailParent = nil
        }
        select(.tenants)
    }

    /// 点击面包屑最外层「OCI 租户管理」：清空层级直退大列表
    func closeToTenantsList() {
        fromTenantDetailParent = nil
        select(.tenants)
    }

    func takePendingInstancesFilter() -> PendingTenantListFilter? {
        let f = pendingInstancesFilter
        pendingInstancesFilter = nil
        return f
    }

    func takePendingBootFilter() -> PendingTenantListFilter? {
        let f = pendingBootFilter
        pendingBootFilter = nil
        return f
    }

    func takePendingDetailParent() -> TenantItem? {
        let p = pendingDetailParent
        pendingDetailParent = nil
        return p
    }

    /// 租户管理「AI」按钮 → 跳转 AI 对话整页并预选该租户（对齐 Web `/ai/chat?tenantId=`）
    func openAiChat(tenantId: Int64) {
        guard tenantId > 0 else {
            select(.aiChat)
            return
        }
        pendingAiChatTenantId = tenantId
        aiChatOpenToken &+= 1
        select(.aiChat)
    }

    func takePendingAiChatTenantId() -> Int64? {
        let id = pendingAiChatTenantId
        pendingAiChatTenantId = nil
        return id
    }

    /// Click first-level header: open this one and close others; click again to collapse.
    func toggleSection(_ section: NavSection) {
        if expandedSection == section {
            expandedSection = nil
        } else {
            expandedSection = section
        }
    }

    func isSectionExpanded(_ section: NavSection) -> Bool {
        expandedSection == section
    }
}
