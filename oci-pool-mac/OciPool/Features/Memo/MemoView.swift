import SwiftUI

/// 原生笔记管理（现代化便签卡片与知识管理）
struct MemoView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = MemoViewModel()

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        PageScaffold(
            title: "笔记管理",
            subtitle: "\(model.items.count) 条笔记",
            systemImage: "book",
            iconColor: AppTheme.info,
            toolbar: { toolbar },
            content: {
                VStack(spacing: 14) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                    }

                    // 1. 顶部现代工具栏：胶囊切换 Tab + 定宽灵动搜索框 + 结果计数
                    filterBar

                    // 2. 笔记内容区（告别全屏大遮罩，接入平滑骨架）
                    ScrollView {
                        if !model.hasLoadedOnce && model.isLoading {
                            loadingState
                        } else if model.filtered.isEmpty {
                            emptyState
                        } else {
                            LazyVGrid(
                                columns: [
                                    GridItem(.flexible(), spacing: 14),
                                    GridItem(.flexible(), spacing: 14)
                                ],
                                spacing: 14
                            ) {
                                ForEach(model.filtered) { item in
                                    MemoNoteCard(item: item, model: model)
                                }
                            }
                            .padding(.bottom, 20)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
        }
        .sheet(item: $model.activeForm) { formState in
            MemoEditorSheet(formState: formState, model: model)
                .environmentObject(appearance)
        }
        .sheet(item: $model.viewingItem) { item in
            MemoDetailSheet(item: item, model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(title: "新建笔记", systemImage: "plus", kind: .primary) {
                model.openCreate()
            }
            AppButton(
                title: "刷新",
                systemImage: "arrow.clockwise",
                kind: .secondary,
                isLoading: model.isLoading
            ) {
                Task { await model.reload() }
            }
        }
    }

    // MARK: - 顶部现代筛选与搜索栏

    private var filterBar: some View {
        HStack(spacing: 12) {
            // 胶囊 Tab 切换（全部 vs 最近更新）
            HStack(spacing: 2) {
                ForEach(MemoSortTab.allCases) { tab in
                    Button(action: { model.selectedTab = tab }) {
                        HStack(spacing: 5) {
                            Text(tab.rawValue)
                                .font(.system(size: 12, weight: model.selectedTab == tab ? .semibold : .regular))
                            if tab == .all && model.hasLoadedOnce {
                                Text("\(model.items.count)")
                                    .font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Capsule().fill(model.selectedTab == tab ? AppTheme.sidebarActive.opacity(0.2) : Color.black.opacity(0.06)))
                                    .foregroundColor(model.selectedTab == tab ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(model.selectedTab == tab ? (dark ? Color(hex: "2a303c") : Color.white) : Color.clear)
                                .shadow(color: Color.black.opacity(model.selectedTab == tab && !dark ? 0.08 : 0), radius: 3, y: 1)
                        )
                        .foregroundColor(model.selectedTab == tab ? (dark ? .white : Color(hex: "1a202c")) : AppTheme.sidebarText(dark))
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding(3)
            .background(RoundedRectangle(cornerRadius: 8).fill(AppTheme.sidebarHover(dark)))

            // 精致定宽搜索框
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.textTertiary(dark))
                TextField("搜索标题、摘要或正文...", text: $model.searchText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 12))
                if !model.searchText.isEmpty {
                    Button(action: { model.searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(width: 280)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.sidebarHover(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )

            Spacer()

            if !model.searchText.isEmpty && model.hasLoadedOnce {
                Text("已找到 \(model.filtered.count) 条匹配")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.textTertiary(dark))
            }
        }
    }

    // MARK: - 居中温和加载态（告别大遮罩）

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(0.9)
            Text("正在加载笔记…")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        }
        .frame(maxWidth: .infinity, minHeight: 280)
    }

    // MARK: - 插画级高级空状态

    private var emptyState: some View {
        VStack(spacing: 16) {
            ZStack {
                // 环境发光微晕
                Circle()
                    .fill(AppTheme.info.opacity(dark ? 0.12 : 0.08))
                    .frame(width: 100, height: 100)
                    .blur(radius: 12)

                // 底层旋转便签
                RoundedRectangle(cornerRadius: 12)
                    .fill(AppTheme.orange.opacity(0.18))
                    .frame(width: 56, height: 56)
                    .rotationEffect(.degrees(-8))
                    .offset(x: -4, y: -2)

                // 顶层便签卡片
                RoundedRectangle(cornerRadius: 12)
                    .fill(dark ? Color(hex: "252a36") : Color.white)
                    .frame(width: 56, height: 56)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.info.opacity(0.3), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(dark ? 0.4 : 0.08), radius: 6, y: 2)

                Image(systemName: "note.text")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(AppTheme.info)
            }
            .padding(.top, 40)

            VStack(spacing: 6) {
                Text(model.searchText.isEmpty ? "灵感与备忘随手记" : "无匹配笔记")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(dark ? .white : Color(hex: "1a202c"))

                Text(model.searchText.isEmpty ? "记录租户配置、常用 SSH 指令或重要凭据，安全存储随时查阅" : "试试换一个关键词，或清空搜索查看全部")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.textTertiary(dark))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 360)
            }

            if model.searchText.isEmpty {
                Button(action: { model.openCreate() }) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                        Text("创建第一篇笔记")
                    }
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(AppTheme.sidebarActive)
                            .shadow(color: AppTheme.sidebarActive.opacity(0.35), radius: 6, y: 2)
                    )
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.top, 6)
            } else {
                Button(action: { model.searchText = "" }) {
                    Text("清除搜索条件")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.sidebarActive)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.sidebarActive.opacity(0.12))
                        )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .frame(maxWidth: .infinity, minHeight: 320)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppTheme.danger)
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.reload() } }
                .buttonStyle(PlainButtonStyle())
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - 现代便签卡片（MemoNoteCard）

private struct MemoNoteCard: View {
    let item: MemoItem
    @ObservedObject var model: MemoViewModel
    @EnvironmentObject private var appearance: AppearanceController

    @State private var isHovered = false
    @State private var justCopied = false

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header: 图标 + 标题 + 字符数徽章
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(AppTheme.sidebarActive.opacity(0.14))
                        .frame(width: 26, height: 26)
                    Image(systemName: "note.text")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarActive)
                }

                Text(item.title.isEmpty ? "无标题" : item.title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.95) : Color(hex: "1a202c"))
                    .lineLimit(1)

                Spacer(minLength: 4)

                Text("\(item.content.count) 字")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(AppTheme.info)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(AppTheme.info.opacity(dark ? 0.2 : 0.12))
                    )
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // 摘要栏（如果有摘要）
            if !item.summary.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Rectangle()
                        .fill(AppTheme.orange.opacity(0.75))
                        .frame(width: 2.5)
                        .cornerRadius(1.25)
                    Text(item.summary)
                        .font(.system(size: 11.5))
                        .foregroundColor(AppTheme.textSecondary(dark))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(AppTheme.sidebarHover(dark).opacity(0.5))
                )
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
            }

            // 正文内容预览（带舒适行距，点击可阅读全量）
            Text(item.content.isEmpty ? "（暂无正文内容）" : item.content)
                .font(.system(size: 12))
                .lineSpacing(3.5)
                .foregroundColor(dark ? Color.white.opacity(0.8) : Color.black.opacity(0.72))
                .lineLimit(5)
                .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
                .padding(.horizontal, 14)
                .contentShape(Rectangle())
                .onTapGesture {
                    model.openView(item)
                }

            Spacer(minLength: 10)

            Divider()
                .opacity(0.5)

            // Footer: 时间戳 + 三联微操作按钮
            HStack(spacing: 8) {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 9.5))
                    Text(displayTime)
                        .font(.system(size: 10.5, design: .monospaced))
                }
                .foregroundColor(AppTheme.textTertiary(dark))

                Spacer()

                // 一键复制
                Button(action: {
                    model.copyContent(item)
                    justCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                        justCopied = false
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: justCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10.5, weight: .medium))
                        Text(justCopied ? "已复制" : "复制")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 5)
                            .fill(justCopied ? AppTheme.sidebarActive.opacity(0.18) : AppTheme.sidebarHover(dark))
                    )
                    .foregroundColor(justCopied ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
                }
                .buttonStyle(PlainButtonStyle())

                // 编辑
                Button(action: { model.openEdit(item) }) {
                    Image(systemName: "pencil")
                        .font(.system(size: 11))
                        .frame(width: 24, height: 24)
                        .background(
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AppTheme.sidebarHover(dark))
                        )
                        .foregroundColor(AppTheme.sidebarText(dark))
                }
                .buttonStyle(PlainButtonStyle())
                .help("编辑笔记")

                // 删除
                Button(action: { model.delete(item) }) {
                    Image(systemName: "trash")
                        .font(.system(size: 11))
                        .frame(width: 24, height: 24)
                        .background(
                            RoundedRectangle(cornerRadius: 5)
                                .fill(AppTheme.danger.opacity(0.12))
                        )
                        .foregroundColor(AppTheme.danger)
                }
                .buttonStyle(PlainButtonStyle())
                .help("删除笔记")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(AppTheme.sidebarHover(dark).opacity(0.3))
        }
        .frame(minHeight: 180, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.sidebarBg(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    isHovered
                        ? AppTheme.sidebarActive.opacity(dark ? 0.5 : 0.4)
                        : AppTheme.border(dark).opacity(0.85),
                    lineWidth: 1
                )
        )
        .shadow(
            color: Color.black.opacity(dark ? 0.35 : (isHovered ? 0.08 : 0.03)),
            radius: isHovered ? 8 : 3,
            y: isHovered ? 3 : 1
        )
        .offset(y: isHovered ? -2 : 0)
        .animation(.spring(response: 0.22, dampingFraction: 0.75), value: isHovered)
        .onHover { isHovered = $0 }
    }

    private var displayTime: String {
        let t = !item.updateTime.isEmpty ? item.updateTime : item.createTime
        if t.count >= 16 {
            return String(t.prefix(16))
        }
        return t
    }
}

// MARK: - 详情阅读弹窗（MemoDetailSheet）

private struct MemoDetailSheet: View {
    let item: MemoItem
    @ObservedObject var model: MemoViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        AppSheetChrome(
            title: "笔记详情",
            systemImage: "book.pages",
            width: 600,
            height: 520,
            onClose: { model.viewingItem = nil },
            footer: {
                HStack(spacing: 8) {
                    AppButton(title: "复制正文", systemImage: "doc.on.doc", kind: .secondary) {
                        model.copyContent(item)
                    }
                    Spacer()
                    AppButton(title: "编辑此笔记", systemImage: "pencil", kind: .primary) {
                        let it = item
                        model.viewingItem = nil
                        model.openEdit(it)
                    }
                }
            },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(item.title.isEmpty ? "无标题" : item.title)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(dark ? .white : Color(hex: "1a202c"))

                        HStack(spacing: 12) {
                            HStack(spacing: 4) {
                                Image(systemName: "clock")
                                Text("更新于 " + (item.updateTime.isEmpty ? item.createTime : item.updateTime))
                            }
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(AppTheme.textTertiary(dark))

                            Text("\(item.content.count) 字符")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(AppTheme.info)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(AppTheme.info.opacity(0.12)))
                        }

                        if !item.summary.isEmpty {
                            HStack(alignment: .top, spacing: 8) {
                                Rectangle()
                                    .fill(AppTheme.orange.opacity(0.7))
                                    .frame(width: 3)
                                    .cornerRadius(1.5)
                                Text(item.summary)
                                    .font(.system(size: 12))
                                    .foregroundColor(AppTheme.textSecondary(dark))
                                    .lineSpacing(3)
                            }
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(AppTheme.sidebarHover(dark).opacity(0.6))
                            )
                        }

                        Divider().opacity(0.5)

                        Text(item.content.isEmpty ? "（无正文）" : item.content)
                            .font(.system(size: 13))
                            .lineSpacing(5)
                            .foregroundColor(dark ? Color.white.opacity(0.88) : Color.black.opacity(0.82))
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .padding(4)
                }
            }
        )
    }
}

// MARK: - 编辑创作弹窗（MemoEditorSheet）

private struct MemoEditorSheet: View {
    let formState: MemoFormState
    @ObservedObject var model: MemoViewModel
    @EnvironmentObject private var appearance: AppearanceController

    @State private var title: String
    @State private var summary: String
    @State private var content: String

    init(formState: MemoFormState, model: MemoViewModel) {
        self.formState = formState
        self.model = model
        _title = State(initialValue: formState.title)
        _summary = State(initialValue: formState.summary)
        _content = State(initialValue: formState.content)
    }

    private var dark: Bool { appearance.isDarkEffective }
    private var isNew: Bool { formState.isNew }
    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        AppSheetChrome(
            title: isNew ? "新建笔记" : "编辑笔记",
            systemImage: "square.and.pencil",
            width: 580,
            height: 540,
            onClose: { model.activeForm = nil },
            footer: {
                HStack(spacing: 8) {
                    AppButton(title: "取消", kind: .secondary) {
                        model.activeForm = nil
                    }
                    AppButton(
                        title: "保存笔记",
                        systemImage: "square.and.arrow.down",
                        kind: .primary,
                        isLoading: model.isSaving,
                        enabled: canSubmit
                    ) {
                        model.save(
                            id: formState.id,
                            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                            summary: summary.trimmingCharacters(in: .whitespacesAndNewlines),
                            content: content
                        )
                    }
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 14) {
                    FormFieldRow(label: "笔记标题 *") {
                        AppTextField(
                            text: $title,
                            placeholder: "输入清晰醒目的标题...",
                            leadingSystemImage: "textformat"
                        )
                    }
                    FormFieldRow(label: "摘要说明") {
                        AppTextField(
                            text: $summary,
                            placeholder: "可选，一两句话概括笔记核心要点（200 字内）",
                            leadingSystemImage: "text.quote"
                        )
                    }
                    FormFieldRow(label: "正文内容 *") {
                        VStack(alignment: .trailing, spacing: 4) {
                            AppTextEditor(text: $content, minHeight: 230)
                            Text("\(content.count) 字符")
                                .font(.system(size: 10))
                                .foregroundColor(AppTheme.textTertiary(dark))
                        }
                    }
                }
            }
        )
    }
}
