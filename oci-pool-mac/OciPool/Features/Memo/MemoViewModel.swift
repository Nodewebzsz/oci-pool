import Foundation
import Combine
import AppKit

enum MemoSortTab: String, CaseIterable, Identifiable {
    case all = "全部笔记"
    case recent = "最近更新"

    var id: String { rawValue }
}

@MainActor
final class MemoViewModel: ObservableObject {
    @Published var items: [MemoItem] = []
    @Published var searchText = ""
    @Published var selectedTab: MemoSortTab = .all
    @Published var activeForm: MemoFormState?
    @Published var viewingItem: MemoItem?
    @Published private(set) var hasLoadedOnce = false
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published private(set) var errorText: String?

    private let session: AppSession
    private var service: MemoService { MemoService(baseURL: session.serverURL) }

    var filtered: [MemoItem] {
        var list = items
        if selectedTab == .recent {
            list.sort { (a, b) in
                let tA = !a.updateTime.isEmpty ? a.updateTime : a.createTime
                let tB = !b.updateTime.isEmpty ? b.updateTime : b.createTime
                return tA > tB
            }
        }
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return list }
        return list.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || $0.summary.localizedCaseInsensitiveContains(q)
                || $0.content.localizedCaseInsensitiveContains(q)
        }
    }

    init(session: AppSession = .shared) {
        self.session = session
    }

    func start() {
        Task { await reload() }
    }

    func reload() async {
        isLoading = true
        errorText = nil
        defer {
            isLoading = false
            hasLoadedOnce = true
        }
        do {
            items = try await service.list()
        } catch {
            errorText = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func copyContent(_ item: MemoItem) {
        let text = !item.content.isEmpty ? item.content : item.summary
        guard !text.isEmpty else {
            ToastCenter.shared.warn("正文为空")
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: NSPasteboard.PasteboardType.string)
        ToastCenter.shared.success("已复制笔记正文")
    }

    func openCreate() {
        activeForm = MemoFormState()
    }

    func openEdit(_ item: MemoItem) {
        activeForm = MemoFormState(
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content
        )
    }

    func openView(_ item: MemoItem) {
        viewingItem = item
    }

    func save(id: Int64?, title: String, summary: String, content: String) {
        guard !title.isEmpty else {
            ToastCenter.shared.warn("请填写笔记标题")
            return
        }
        guard !content.isEmpty else {
            ToastCenter.shared.warn("请填写笔记正文")
            return
        }
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                try await LoadingHUD.shared.during {
                    if let editId = id {
                        _ = try await service.update(id: editId, title: title, summary: summary, content: content)
                    } else {
                        _ = try await service.create(title: title, summary: summary, content: content)
                    }
                }
                activeForm = nil
                await reload()
                ToastCenter.shared.success(id != nil ? "笔记已更新" : "笔记已创建")
            } catch {
                ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    func saveForm() {
        guard let f = activeForm else { return }
        save(id: f.id, title: f.title.trimmingCharacters(in: .whitespacesAndNewlines), summary: f.summary.trimmingCharacters(in: .whitespacesAndNewlines), content: f.content)
    }

    func delete(_ item: MemoItem) {
        let ok = AppAlert.confirm(
            title: "删除备忘",
            message: "确定删除「\(item.title)」？此操作不可恢复。",
            confirmTitle: "删除"
        )
        guard ok else { return }
        Task { await performDelete(item) }
    }

    private func performDelete(_ item: MemoItem) async {
        do {
            try await LoadingHUD.shared.during {
                try await service.delete(id: item.id)
            }
            await reload()
        } catch {
            ToastCenter.shared.error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
