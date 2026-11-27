import Foundation
import Combine

@MainActor
final class NetworkQualityViewModel: ObservableObject {
    @Published private(set) var overview = NetworkQualityOverview()
    @Published private(set) var isLoading = false
    @Published private(set) var busyKey: String?
    @Published private(set) var errorText: String?

    @Published var isEditorPresented = false
    @Published var draft = NetworkQualityTaskDraft()
    @Published var historyContext: NetworkQualityHistoryContext?

    private let session: AppSession
    var serverURL: String { session.serverURL }
    private var service: NetworkQualityService { NetworkQualityService(baseURL: session.serverURL) }

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
            overview = try await service.fetchOverview()
        } catch {
            errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    var onlineAgentCount: Int {
        overview.agents.filter { $0.qualityStatus == "online" }.count
    }

    var upgradeRequiredCount: Int {
        overview.agents.filter { $0.qualityStatus == "upgrade_required" }.count
    }

    // MARK: - Task Editor

    func openCreateTask() {
        let defaultIds = overview.agents
            .filter { $0.qualityStatus == "online" || $0.monitorInstalled }
            .map(\.id)
        draft = NetworkQualityTaskDraft(
            instanceIds: Set(defaultIds.isEmpty ? overview.agents.map(\.id) : defaultIds)
        )
        isEditorPresented = true
    }

    func openEditTask(_ task: NetworkQualityTask) {
        draft = NetworkQualityTaskDraft.from(task)
        isEditorPresented = true
    }

    func saveDraft() {
        Task { await performSaveDraft() }
    }

    private func performSaveDraft() async {
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let region = draft.region.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = draft.target.trimmingCharacters(in: .whitespacesAndNewlines)
        let interval = Int(draft.intervalSeconds.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let sampleCount = Int(draft.sampleCount.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let orderedIds = overview.agents.map(\.id).filter { draft.instanceIds.contains($0) }

        guard !name.isEmpty, name.count <= 80 else {
            ToastCenter.shared.error("任务名称不能为空且不超过 80 字")
            return
        }
        guard !target.isEmpty else {
            ToastCenter.shared.error("请输入有效的探测目标")
            return
        }
        guard interval >= 30 && interval <= 86400 else {
            ToastCenter.shared.error("探测间隔必须在 30 ~ 86400 秒之间")
            return
        }
        guard sampleCount >= 1 && sampleCount <= 10 else {
            ToastCenter.shared.error("单次采样次数必须在 1 ~ 10 次之间")
            return
        }
        guard !orderedIds.isEmpty else {
            ToastCenter.shared.error("请至少选择一个执行探测的 VPS 节点")
            return
        }

        var payload: [String: Any] = [
            "name": name,
            "operator": draft.operatorType.rawValue,
            "region": region,
            "type": draft.type.rawValue,
            "target": target,
            "intervalSeconds": interval,
            "sampleCount": sampleCount,
            "enabled": draft.enabled,
            "instanceIds": orderedIds
        ]
        busyKey = "saveTask"
        defer { busyKey = nil }
        do {
            if let editId = draft.editingTaskId, let version = draft.editingVersion {
                payload["version"] = version
                _ = try await LoadingHUD.shared.during {
                    try await service.updateTask(id: editId, payload: payload)
                }
                ToastCenter.shared.success("探测任务已更新")
            } else {
                _ = try await LoadingHUD.shared.during {
                    try await service.createTask(payload)
                }
                ToastCenter.shared.success("探测任务已创建")
            }
            isEditorPresented = false
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func toggleTaskEnabled(_ task: NetworkQualityTask) {
        Task { await performToggleTask(task) }
    }

    private func performToggleTask(_ task: NetworkQualityTask) async {
        busyKey = "toggle-\(task.id)"
        defer { busyKey = nil }
        let payload: [String: Any] = [
            "version": task.version,
            "name": task.name,
            "operator": task.operatorType,
            "region": task.region,
            "type": task.type,
            "target": task.target,
            "intervalSeconds": task.intervalSeconds,
            "sampleCount": task.sampleCount,
            "enabled": !task.enabled,
            "instanceIds": task.instanceIds
        ]
        do {
            _ = try await service.updateTask(id: task.id, payload: payload)
            ToastCenter.shared.success(task.enabled ? "已暂停任务「\(task.name)」" : "已启用任务「\(task.name)」")
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func runTaskNow(_ task: NetworkQualityTask, instanceIds: [String]? = nil) {
        Task { await performRunTask(task, instanceIds: instanceIds) }
    }

    private func performRunTask(_ task: NetworkQualityTask, instanceIds: [String]?) async {
        busyKey = "run-\(task.id)"
        defer { busyKey = nil }
        do {
            try await service.runTask(id: task.id, version: task.version, instanceIds: instanceIds)
            ToastCenter.shared.success("已下发立即探测指令，请稍后刷新查看结果")
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func deleteTask(_ task: NetworkQualityTask) {
        guard AppAlert.confirm(
            title: "删除探测任务",
            message: "确认删除「\(task.name)」及其所有历史采样数据？此操作不可撤销。",
            confirmTitle: "删除"
        ) else { return }
        Task { await performDeleteTask(task) }
    }

    private func performDeleteTask(_ task: NetworkQualityTask) async {
        busyKey = "delete-\(task.id)"
        defer { busyKey = nil }
        do {
            try await LoadingHUD.shared.during {
                try await service.deleteTask(id: task.id, version: task.version)
            }
            ToastCenter.shared.success("已删除任务「\(task.name)」")
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    // MARK: - Agent Management

    func installOrUpgradeAgent(_ agent: NetworkQualityAgent) {
        let isUpgrade = agent.qualityStatus == "upgrade_required" || agent.monitorInstalled
        guard AppAlert.confirm(
            title: isUpgrade ? "升级网络质量探针" : "安装监控与网络质量探针",
            message: "将通过 SSH 连接 \(agent.primaryLabel) (\(agent.publicIps)) 部署系统监控与网络质量探针。",
            confirmTitle: isUpgrade ? "升级部署" : "开始安装"
        ) else { return }
        Task { await performInstallAgent(agent) }
    }

    private func performInstallAgent(_ agent: NetworkQualityAgent) async {
        busyKey = "agent-\(agent.id)"
        defer { busyKey = nil }
        do {
            let msg = try await LoadingHUD.shared.during {
                try await service.installAgent(vpsId: agent.id)
            }
            ToastCenter.shared.success(msg)
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func uninstallAgent(_ agent: NetworkQualityAgent) {
        guard AppAlert.confirm(
            title: "卸载监控与网络质量探针",
            message: "确认卸载 \(agent.primaryLabel) 上的探针服务并吊销凭据？",
            confirmTitle: "卸载"
        ) else { return }
        Task { await performUninstallAgent(agent) }
    }

    private func performUninstallAgent(_ agent: NetworkQualityAgent) async {
        busyKey = "agent-\(agent.id)"
        defer { busyKey = nil }
        do {
            let msg = try await LoadingHUD.shared.during {
                try await service.uninstallAgent(vpsId: agent.id)
            }
            ToastCenter.shared.success(msg)
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    // MARK: - History

    func openHistory(agent: NetworkQualityAgent, task: NetworkQualityTask) {
        historyContext = NetworkQualityHistoryContext(
            instanceId: agent.id,
            instanceName: agent.primaryLabel,
            taskId: task.id,
            taskName: task.name,
            revision: task.version,
            target: task.target,
            type: task.type,
            operatorType: task.operatorType,
            region: task.region
        )
    }
}
