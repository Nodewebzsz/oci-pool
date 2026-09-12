import Foundation
import Combine

@MainActor
final class AiModelsViewModel: ObservableObject {
    @Published var tenants: [AiTenantOption] = []
    @Published var selectedTenantId: String = ""
    @Published var models: [AiAvailableModel] = []
    @Published var configs: [AiConfigItem] = []
    @Published var linkTenantFilter = false
    @Published var isLoadingTenants = false
    @Published var isLoadingModels = false
    @Published var isLoadingConfigs = false
    @Published var isBusy = false
    @Published var errorText: String?

    private let session: AppSession
    private var service: AiModelsService { AiModelsService(baseURL: session.serverURL) }

    var configuredModelIds: Set<String> {
        Set(configs.map(\.modelId))
    }

    var visibleConfigs: [AiConfigItem] {
        guard linkTenantFilter, !selectedTenantId.isEmpty else { return configs }
        return configs.filter { $0.tenantId == selectedTenantId }
    }

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task {
            await loadTenants()
            await loadConfigs()
        }
    }

    func loadTenants() async {
        isLoadingTenants = true
        defer { isLoadingTenants = false }
        do {
            tenants = try await service.listTenants().sorted {
                let a = $0.tname.isEmpty ? $0.name : $0.tname
                let b = $1.tname.isEmpty ? $1.name : $1.tname
                return a.localizedCaseInsensitiveCompare(b) == .orderedAscending
            }
            // 对齐原项目 oci-start：默认自动选中第一个租户并加载模型，开箱即见数据
            if selectedTenantId.isEmpty, let first = tenants.first {
                selectedTenantId = first.id
                await loadModels()
            }
        } catch {
            tenants = []
            errorText = error.localizedDescription
        }
    }

    func onTenantChanged(_ id: String?) {
        selectedTenantId = id ?? ""
        models = []
        guard !selectedTenantId.isEmpty else { return }
        Task { await loadModels() }
    }

    func loadModels() async {
        guard !selectedTenantId.isEmpty else { return }
        isLoadingModels = true
        defer { isLoadingModels = false }
        do {
            models = try await service.listModels(tenantId: selectedTenantId)
        } catch {
            models = []
            ToastCenter.shared.error(error.localizedDescription)
        }
    }

    func loadConfigs() async {
        isLoadingConfigs = true
        defer { isLoadingConfigs = false }
        do {
            configs = try await service.listConfigs()
        } catch {
            configs = []
            ToastCenter.shared.error(error.localizedDescription)
        }
    }

    func addModel(_ model: AiAvailableModel) {
        let tid = selectedTenantId.isEmpty ? model.tenantId : selectedTenantId
        guard !tid.isEmpty else {
            ToastCenter.shared.error("请先选择租户")
            return
        }
        if configuredModelIds.contains(model.id) {
            ToastCenter.shared.error("该模型已配置")
            return
        }
        Task {
            isBusy = true
            do {
                try await service.addConfig(tenantId: tid, model: model)
                ToastCenter.shared.success("已添加 \(model.name) 到已配置模型")
                await loadConfigs()
            } catch {
                ToastCenter.shared.error(error.localizedDescription)
            }
            isBusy = false
        }
    }

    func toggle(_ item: AiConfigItem) {
        Task {
            isBusy = true
            do {
                try await service.toggleConfig(item, enabled: !item.enabled)
                await loadConfigs()
            } catch {
                ToastCenter.shared.error(error.localizedDescription)
            }
            isBusy = false
        }
    }

    func delete(_ item: AiConfigItem) {
        let name = item.modelName.isEmpty ? item.modelId : item.modelName
        guard AppAlert.confirm(
            title: "删除 \(name)?",
            message: "该模型的配置将从租户中删除。调用中的会话不会立即中断,但重新连接后无法使用此模型。",
            confirmTitle: "删除",
            style: .critical
        ) else { return }
        Task {
            isBusy = true
            do {
                try await service.deleteConfig(id: item.id)
                await loadConfigs()
                ToastCenter.shared.warn("✓ 已删除模型配置 \(name)")
            } catch {
                ToastCenter.shared.error(error.localizedDescription)
            }
            isBusy = false
        }
    }

    func batchEnable(_ enabled: Bool) {
        // 对齐原项目：批量操作作用于全库配置，执行前需二次确认防误触
        let title = enabled ? "批量启用" : "批量禁用"
        guard AppAlert.confirm(title: title, message: "将对全部 AI 配置执行\(title)？") else { return }
        Task {
            isBusy = true
            do {
                try await service.batchToggle(enabled: enabled)
                ToastCenter.shared.success(enabled ? "✓ 已启用所有模型" : "✓ 已禁用所有模型")
                await loadConfigs()
            } catch {
                ToastCenter.shared.error(error.localizedDescription)
            }
            isBusy = false
        }
    }

    func reload() {
        Task {
            await loadTenants()
            await loadConfigs()
            if !selectedTenantId.isEmpty {
                await loadModels()
            }
        }
    }
}
