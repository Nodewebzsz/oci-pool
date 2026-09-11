import SwiftUI
import AppKit

/// All tenant modals / subpages (Web modal-overlay equivalents).
struct TenantSheetHost: View {
    let sheet: TenantSheet
    @ObservedObject var model: TenantsViewModel
    @EnvironmentObject private var appearance: AppearanceController
    @EnvironmentObject private var session: AppSession
    @Environment(\.presentationMode) private var presentationMode
    @State private var userSearchText: String = ""
    @State private var showPasswordPolicyModal: Bool = false

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        Group {
            switch sheet {
            case .add:
                addSheet
            case .editName(let t):
                editFieldSheet(title: "编辑自定义名称", item: t, save: { model.saveEditName(t) })
            case .editCost(let t):
                editFieldSheet(title: "编辑账号成本", item: t, save: { model.saveEditCost(t) })
            case .accountDetail(let t):
                accountDetail(t)
            case .users(let t):
                usersSheet(t)
            case .traffic(let t):
                trafficSheet(t)
            case .email(let t):
                emailSheet(t)
            case .social(let t):
                socialSheet(t)
            case .bootVolumes(let t):
                volumesSheet(t)
            case .accountCheck:
                accountCheckSheet
            case .exportAll:
                exportSheet(title: "导出租户", onExport: { model.doExportAll() })
            case .exportOne(let t):
                exportSheet(title: "导出 \(t.displayName)", onExport: { model.doExportOne(t) })
            case .importJSON:
                EmptyView()
            case .updateProgress(_, let lines):
                progressSheet(title: "更新租户信息", lines: lines)
            case .syncProgress(_, let name):
                syncProgressSheet(name: name)
            case .bootCreate(let t):
                bootCreateSheet(t)
            case .regionSub(let t):
                regionSubSheet(t)
            case .trafficQuery:
                EmptyView()
            case .aiChat(let t):
                aiChatSheet(t)
            case .passwordResult(let title, let user, let pwd):
                passwordResult(title: title, user: user, pwd: pwd)
            case .securityRules(let t):
                securityRulesSheet(t)
            case .mysql(let t):
                mysqlSheet(t)
            case .proxyQuick(let t):
                proxyQuickSheet(t)
            }
        }
        .onDisappear {
            // 关闭 AI 页时断开 WS
            if case .aiChat = sheet { model.closeAIChat() }
        }
    }

    // MARK: - Chrome（对齐 Web `.modal-container`）

    private func chrome<Content: View, Footer: View>(
        title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        iconColor: Color? = nil,
        width: CGFloat = 520,
        height: CGFloat = 480,
        /// 为 true 时用固定宽高，避免 sheet 被系统撑满窗口
        fixedSize: Bool = false,
        scrollableContent: Bool = true,
        @ViewBuilder footer: () -> Footer,
        @ViewBuilder content: () -> Content
    ) -> some View {
        AppSheetChrome(
            title: title,
            subtitle: subtitle,
            systemImage: systemImage,
            iconColor: iconColor,
            width: width,
            height: height,
            fixedSize: fixedSize,
            scrollableContent: scrollableContent,
            onClose: { presentationMode.wrappedValue.dismiss() },
            footer: footer,
            content: content
        )
    }

    private var primaryText: Color { AppSheetSurface.primaryText(dark) }
    private var mutedText: Color { AppSheetSurface.mutedText(dark) }
    private var panelBg: Color { AppSheetSurface.panelBg(dark) }
    private var border: Color { AppSheetSurface.border(dark) }

    // MARK: - Add

    /// 对齐 Web 端「API 导入租户」弹窗与「API 配置快速导入」卡片
    private var addSheet: some View {
        chrome(title: "API 导入租户", systemImage: "bolt.fill", width: 560, height: 680, footer: {
            HStack(spacing: 10) {
                AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                AppButton(title: "确定导入", systemImage: "checkmark", kind: .primary) { model.submitAdd() }
            }
        }) {
            VStack(alignment: .leading, spacing: 14) {
                if let err = model.formError, !err.isEmpty {
                    errorBanner(err)
                }

                // ─── 顶部：API 配置快速导入卡片（完全对齐 Web 端） ───
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .center, spacing: 8) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.sidebarActive)
                                .frame(width: 22, height: 22)
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.white)
                        }
                        Text("API 配置快速导入")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(primaryText)

                        if model.addParsedCount > 0 {
                            Text("已识别 \(model.addParsedCount) 个字段")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(RoundedRectangle(cornerRadius: 3).fill(AppTheme.sidebarActive))
                        }

                        Spacer()

                        HStack(spacing: 6) {
                            AppButton(title: "从剪贴板读取", systemImage: "doc.on.clipboard", kind: .secondary) {
                                model.readFromClipboard()
                            }
                            AppButton(
                                title: "解析并填充",
                                systemImage: "wand.and.stars",
                                kind: .primary,
                                enabled: !model.addConfigText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ) {
                                model.parseAddConfig(silent: false)
                            }
                        }
                    }

                    ZStack(alignment: .topLeading) {
                        AppTextEditor(text: $model.addConfigText, minHeight: 110, monospaced: true)
                            .onChange(of: model.addConfigText) { _ in
                                model.parseAddConfig(silent: true)
                            }

                        if model.addConfigText.isEmpty {
                            Text("请粘贴 Oracle Cloud API 配置信息,或拖入 .pem 文件,格式如下:\n[DEFAULT]\nuser=ocid1.user.oc1..example\nfingerprint=xx:xx:xx:xx\ntenancy=ocid1.tenancy.oc1..example\nregion=us-phoenix-1\nkey_file=~/.oci/oci_api_key.pem")
                                .font(.system(size: 12, design: .monospaced))
                                .lineSpacing(2)
                                .foregroundColor(AppInputStyle.placeholder(dark).opacity(0.85))
                                .padding(.leading, 14)
                                .padding(.trailing, 8)
                                .padding(.vertical, 10)
                                .allowsHitTesting(false)
                        }
                    }

                    HStack(spacing: 6) {
                        Image(systemName: "info.circle")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.textTertiary(dark))
                        Text("识别字段: user · fingerprint · tenancy · region · PEM 块 · 自动生成别名")
                            .font(.system(size: 10.5))
                            .foregroundColor(AppTheme.textTertiary(dark))
                    }
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.sidebarActive.opacity(0.45), lineWidth: 1)
                )

                // ─── 下方表单字段（会被自动填充） ───
                HStack(spacing: 12) {
                    FormFieldRow(label: "自定义名称", required: true) {
                        AppTextField(text: $model.addUserName, placeholder: "例:sg-singapore-main")
                    }
                    .frame(maxWidth: .infinity)

                    FormFieldRow(label: "Region", required: true) {
                        SelectMenu(
                            options: TenantKnownRegions.oci,
                            selection: Binding(
                                get: { model.addRegion.isEmpty ? nil : model.addRegion },
                                set: { model.addRegion = $0 ?? "" }
                            ),
                            placeholder: "请选择区域",
                            width: 250,
                            allowClear: false,
                            searchable: true
                        )
                    }
                    .frame(maxWidth: .infinity)
                }

                FormFieldRow(label: "Tenancy OCID", required: true) {
                    AppTextField(text: $model.addTenancy, placeholder: "ocid1.tenancy.oc1..aaaaaaaa...")
                }

                FormFieldRow(label: "User OCID", required: true) {
                    AppTextField(text: $model.addTenantId, placeholder: "ocid1.user.oc1..aaaaaaaa...")
                }

                FormFieldRow(label: "Fingerprint", required: true) {
                    AppTextField(text: $model.addFingerprint, placeholder: "a1:b2:c3:d4:e5:f6:g7:h8:i9:j0:k1:l2:m3:n4:o5:p6")
                }

                FormFieldRow(label: "Private Key (PEM)", required: true) {
                    keyFileRow
                }
            }
        }
    }

    /// Web: `editCustomNameModal` / 编辑成本
    private func editFieldSheet(title: String, item: TenantItem, save: @escaping () -> Void) -> some View {
        chrome(title: title, systemImage: "pencil", width: 400, height: 260, footer: {
            HStack(spacing: 10) {
                AppButton(title: "保存", kind: .primary, action: save)
                AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
            }
        }) {
            VStack(alignment: .leading, spacing: 8) {
                sectionLabel(title.contains("成本") ? "账号成本" : "自定义名称")
                AppTextField(text: $model.editText, placeholder: title)
                hint(title.contains("成本") ? "用于统计账号费用，可填数字" : "最长 100 字符，便于区分同区域账号")
                if let err = model.formError {
                    Text(err).font(.system(size: 12)).foregroundColor(AppSheetSurface.accentRed(dark))
                }
                Text(item.displayName)
                    .font(.system(size: 12))
                    .foregroundColor(mutedText)
                    .padding(.top, 4)
            }
        }
    }

    /// Web: `accountDetailModal` — `.detail-item` 键值行
    private func accountDetail(_ t: TenantItem) -> some View {
        chrome(title: "账号详情", systemImage: "person.circle", width: 480, height: 360, footer: {
            AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
        }) {
            VStack(alignment: .leading, spacing: 0) {
                AppDetailRow(label: "名称", value: t.displayName)
                AppDetailRow(label: "类型", value: t.typeText)
                AppDetailRow(label: "区域", value: t.region.isEmpty ? "—" : t.region)
                AppDetailRow(
                    label: "邮箱",
                    value: t.emailAddress.isEmpty ? "—" : t.emailAddress,
                    isLast: t.registerDetail == nil
                )
                if let d = t.registerDetail {
                    AppDetailRow(label: "计划", value: d.planType.isEmpty ? "—" : d.planType)
                    AppDetailRow(label: "城市", value: d.city.isEmpty ? "—" : d.city)
                    AppDetailRow(label: "国家", value: d.country.isEmpty ? "—" : d.country)
                    AppDetailRow(
                        label: "注册邮箱",
                        value: d.emailAddress.isEmpty ? "—" : d.emailAddress,
                        isLast: true
                    )
                }
            }
            .padding(.horizontal, 4)
        }
    }

    // MARK: - Users (Web `userManagementModal` 三 Tab + 表格)

    // MARK: - Users (Web `userManagementModal` 三 Tab + 表格)

    private func usersSheet(_ t: TenantItem) -> some View {
        let cn = t.regionNameText.isEmpty ? t.region : t.regionNameText
        let reg = (t.region.isEmpty || t.region == cn || t.region.contains(cn) || cn.contains(t.region)) ? cn : "\(cn) (\(t.region))"
        let subtitle = "\(t.displayName) · \(reg)"

        return ZStack {
            chrome(
                title: "用户管理",
                subtitle: subtitle,
                systemImage: "person.2",
                iconColor: AppTheme.sidebarActive,
                width: 900,
                height: 660,
                fixedSize: true,
                scrollableContent: false,
                footer: {
                    HStack {
                        Spacer()
                        AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                    }
                }
            ) {
                VStack(alignment: .leading, spacing: 14) {
                    // 顶部三 Tab 导航
                    userTabsBar(t)

                    if model.userTab == .users {
                        usersTabContent(t)
                    } else if model.userTab == .notifications {
                        notifyTabContent(t)
                    } else {
                        mfaTabContent(t)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 6)
            }

            // 独立的密码策略弹窗（对齐 Web 端 openPasswordPolicy 弹窗）
            if showPasswordPolicyModal {
                passwordPolicyModalOverlay(t)
            }
        }
    }

    private func userTabsBar(_ t: TenantItem) -> some View {
        HStack(spacing: 4) {
            userTabButton(title: "用户列表", count: model.users.count, icon: "person.2", tab: .users, tenant: t)
            userTabButton(title: "通知邮箱", count: model.notifyEmails.count, icon: "envelope", tab: .notifications, tenant: t)
            userTabButton(title: "MFA 管理", count: nil, icon: "shield.lefthalf.fill", tab: .mfa, tenant: t)
        }
        .padding(3)
        .background(dark ? Color.white.opacity(0.04) : Color.black.opacity(0.03))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(border.opacity(0.7), lineWidth: 1))
        .cornerRadius(8)
    }

    private func userTabButton(title: String, count: Int?, icon: String, tab: TenantUserTab, tenant: TenantItem) -> some View {
        let active = model.userTab == tab
        return Button(action: {
            model.switchUserTab(tab, tenant: tenant)
        }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                Text(title)
                    .font(.system(size: 12.5, weight: active ? .semibold : .medium))
                if let c = count {
                    Text("\(c)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1.5)
                        .background(active ? AppTheme.sidebarActive.opacity(0.12) : (dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)))
                        .cornerRadius(4)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .padding(.horizontal, 10)
            .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(active ? (dark ? Color.white.opacity(0.08) : Color.white) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(active ? border.opacity(0.8) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func usersTabContent(_ t: TenantItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // 操作栏：搜索框 + 添加用户(绿) + 刷新(青) + 密码策略(橙)
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(mutedText)
                        .font(.system(size: 12))
                    TextField("搜索用户或邮箱...", text: $userSearchText)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.system(size: 12))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .frame(width: 240)
                .background(dark ? Color.white.opacity(0.04) : Color.black.opacity(0.02))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.7), lineWidth: 1))
                .cornerRadius(6)

                Spacer()

                AppButton(title: "添加用户", systemImage: "person.badge.plus", kind: .primary) { model.showAddUser.toggle() }
                AppButton(title: "刷新列表", systemImage: "arrow.clockwise", kind: .secondary) { Task { await model.loadUsersAndGroups(t) } }
                Button(action: {
                    showPasswordPolicyModal = true
                    model.openPasswordPolicy(for: t)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "key.fill").font(.system(size: 11))
                        Text("密码策略").font(.system(size: 12, weight: .medium))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .foregroundColor(.white)
                    .background(AppTheme.orange)
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())
            }

            if model.showAddUser {
                formPanel {
                    VStack(alignment: .leading, spacing: 10) {
                        field("用户名", text: $model.newUsername)
                        field("邮箱", text: $model.newEmail)
                        Toggle("使用邮箱作为用户名", isOn: $model.useEmailAsUsername)
                            .foregroundColor(primaryText)
                        if !model.groups.isEmpty {
                            sectionLabel("用户组")
                            SelectMenu(
                                options: model.groups.map { SelectOption(id: $0.id, title: $0.name) },
                                selection: Binding(get: { model.newGroupId.isEmpty ? nil : model.newGroupId }, set: { model.newGroupId = $0 ?? "" }),
                                placeholder: "选择用户组",
                                width: 240,
                                allowClear: true
                            )
                        }
                        HStack(spacing: 8) {
                            AppButton(title: "保存", kind: .primary) { model.createUser(for: t) }
                            AppButton(title: "取消", kind: .danger) { model.showAddUser = false }
                        }
                    }
                }
            }

            let filteredUsers = model.users.filter { u in
                let q = userSearchText.trimmingCharacters(in: .whitespaces).lowercased()
                if q.isEmpty { return true }
                return u.username.lowercased().contains(q) || u.email.lowercased().contains(q) || u.domain.lowercased().contains(q)
            }

            // 用户表格：严格对齐 Web 端 7 列，全列居中
            AppSheetFixedTable(
                isLoading: model.userManageLoading,
                isEmpty: filteredUsers.isEmpty,
                emptyText: model.users.isEmpty ? "暂无用户" : "未找到匹配用户",
                emptyIcon: "person.2",
                rowCount: filteredUsers.count,
                emptyBodyHeight: 180
            ) {
                AppSheetTableHeader(columns: [
                    ("所属域", 100), ("用户名", 120), ("邮箱地址", nil), ("账号状态", 80),
                    ("创建时间", 135), ("最后登录时间", 135), ("操作", 70)
                ])
            } rows: {
                ForEach(Array(filteredUsers.enumerated()), id: \.element.id) { idx, u in
                    let isActive = u.lifecycleState.uppercased() == "ACTIVE" || u.lifecycleState == "有效"
                    AppSheetTableRow(striped: idx % 2 == 1) {
                        HStack(spacing: 0) {
                            // 1. 所属域 (居中)
                            Text(u.domain.isEmpty ? "Default" : u.domain)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(mutedText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(width: 100, alignment: .center)
                                .help(u.domain.isEmpty ? "Default" : u.domain)

                            // 2. 用户名 (去掉圆形头像徽章，居中，超长省略，hover 显示完整)
                            Text(u.username)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundColor(primaryText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(width: 120, alignment: .center)
                                .help(u.username)

                            // 3. 邮箱地址 (弹性居中，超长省略，hover 显示完整)
                            Text(u.email.isEmpty ? "—" : u.email)
                                .font(.system(size: 11.5, design: .monospaced))
                                .foregroundColor(primaryText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.horizontal, 10)
                                .help(u.email.isEmpty ? "—" : u.email)

                            // 4. 账号状态 (居中)
                            StatusBadge(text: isActive ? "有效" : "已禁用", tone: isActive ? .success : .neutral)
                                .frame(width: 80, alignment: .center)

                            // 5. 创建时间 (居中，hover 显示完整)
                            Text(u.timeCreated.isEmpty ? "—" : u.timeCreated)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(mutedText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(width: 135, alignment: .center)
                                .help(u.timeCreated)

                            // 6. 最后登录时间 (居中，hover 显示完整)
                            Text(u.lastSuccessfulLoginTime.isEmpty ? "—" : u.lastSuccessfulLoginTime)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(mutedText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(width: 135, alignment: .center)
                                .help(u.lastSuccessfulLoginTime)

                            // 7. 操作 (严格对齐 UI_STANDARD.md 标准：28x28 方块按钮，点击高亮绿，弹出标准卡片菜单)
                            UserActionMoreButton(
                                dark: dark,
                                username: u.username,
                                isActive: isActive,
                                appearance: appearance,
                                onResetPassword: {
                                    model.resetUserPassword(for: t, user: u)
                                },
                                onDelete: {
                                    model.deleteUser(for: t, user: u)
                                }
                            )
                            .frame(width: 28, height: 28)
                            .frame(width: 70, alignment: .center)
                        }
                    }
                }
            }
        }
    }

    private func notifyTabContent(_ t: TenantItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Spacer()
                AppButton(title: "添加邮箱", systemImage: "plus", kind: .primary) { model.showAddNotify.toggle() }
                AppButton(title: "刷新", systemImage: "arrow.clockwise", kind: .secondary) { Task { await model.loadNotifyEmails(t) } }
            }
            if model.showAddNotify {
                formPanel {
                    VStack(alignment: .leading, spacing: 10) {
                        field("邮箱地址 *", text: $model.newNotifyEmail)
                        HStack(spacing: 8) {
                            AppButton(title: "添加", kind: .primary) { model.addNotifyEmail(t) }
                            AppButton(title: "取消", kind: .danger) { model.showAddNotify = false }
                        }
                    }
                }
            }
            AppSheetFixedTable(
                isLoading: model.notifyEmailsLoading,
                isEmpty: model.notifyEmails.isEmpty,
                emptyText: "暂无通知邮箱",
                emptyIcon: "envelope",
                rowCount: model.notifyEmails.count,
                emptyBodyHeight: 160
            ) {
                AppSheetTableHeader(columns: [
                    ("序号", 60), ("邮箱地址", nil), ("状态", 120), ("操作", 80)
                ])
            } rows: {
                ForEach(Array(model.notifyEmails.enumerated()), id: \.offset) { idx, email in
                    AppSheetTableRow(striped: idx % 2 == 1) {
                        HStack(spacing: 0) {
                            tableCell("\(idx + 1)", width: 60, muted: true)
                            Text(email)
                                .font(.system(size: 11.5, design: .monospaced))
                                .foregroundColor(primaryText)
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.horizontal, 10)
                                .help(email)
                            StatusBadge(text: "有效", tone: .success)
                                .frame(width: 120, alignment: .center)
                                .padding(.horizontal, 10)
                            AppButton(title: "移除", kind: .danger) { model.removeNotifyEmail(t, email: email) }
                                .frame(width: 80, alignment: .center)
                                .padding(.horizontal, 6)
                        }
                    }
                }
            }
            Text("共 \(model.notifyEmails.count) 个收件人")
                .font(.system(size: 12))
                .foregroundColor(mutedText)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(panelBg)
                .cornerRadius(4)
        }
    }

    private func mfaTabContent(_ t: TenantItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // 4 个操作按钮（橙/绿/红/青）
            HStack(spacing: 8) {
                Button(action: { model.resetMfa(t) }) {
                    HStack(spacing: 5) {
                        Image(systemName: "key.fill").font(.system(size: 11))
                        Text("一键重置 MFA").font(.system(size: 12, weight: .medium))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .foregroundColor(.white)
                    .background(AppTheme.orange)
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())

                AppButton(title: "启用邮箱 MFA", systemImage: "envelope", kind: .primary) { model.setEmailMfa(t, enable: true) }
                AppButton(title: "关闭邮箱 MFA", systemImage: "envelope", kind: .danger) { model.setEmailMfa(t, enable: false) }
                AppButton(title: "刷新状态", systemImage: "arrow.clockwise", kind: .secondary) { Task { await model.loadMfa(t) } }
            }

            // MFA 状态区（紧凑 6x10 padding，11.5pt 字号）
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(AppTheme.cyan)
                        .font(.system(size: 12))
                    Text("当前 MFA 状态")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(primaryText)
                }
                .padding(.bottom, 4)

                mfaRow(icon: "envelope", label: "邮箱验证", enabled: model.mfaEmailEnabled)
                mfaRow(icon: "message", label: "短信验证", enabled: false)
                mfaRow(icon: "shield.lefthalf.fill", label: "MFA 验证", enabled: false)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(panelBg)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.6), lineWidth: 1))
            .cornerRadius(6)
        }
    }

    private func mfaRow(icon: String, label: String, enabled: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundColor(enabled ? AppTheme.sidebarActive : mutedText)
            Text(label)
                .font(.system(size: 11.5, weight: .medium))
                .foregroundColor(enabled ? AppTheme.sidebarActive : primaryText)
            Spacer()
            Text(enabled ? "ON" : "OFF")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(enabled ? AppTheme.sidebarActive : mutedText)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(enabled ? AppTheme.sidebarActive.opacity(0.12) : (dark ? Color.white.opacity(0.06) : Color.black.opacity(0.04)))
                .cornerRadius(10)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(enabled ? AppTheme.sidebarActive.opacity(0.08) : (dark ? Color.white.opacity(0.03) : Color.black.opacity(0.02)))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(enabled ? AppTheme.sidebarActive.opacity(0.3) : border.opacity(0.5), lineWidth: 1))
        .cornerRadius(6)
    }

    // MARK: - 独立密码策略弹窗（层级高于用户管理弹窗，严格对齐 Web 图2）
    private func passwordPolicyModalOverlay(_ t: TenantItem) -> some View {
        let cn = t.regionNameText.isEmpty ? t.region : t.regionNameText
        let reg = (t.region.isEmpty || t.region == cn || t.region.contains(cn) || cn.contains(t.region)) ? cn : "\(cn) (\(t.region))"
        let subtitle = "\(t.displayName) · \(reg)"

        return ZStack {
            // 半透明遮罩层 (深色半透明)
            Color.black.opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture { showPasswordPolicyModal = false }

            // 居中弹窗盒 (540 x 380)
            VStack(spacing: 0) {
                // Header (对齐图2: 绿钥匙 + 租户密码策略设置 + 关闭X)
                HStack(spacing: 12) {
                    Image(systemName: "key.fill")
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(AppTheme.sidebarActive)
                        .cornerRadius(8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("租户密码策略设置")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(primaryText)
                        Text(subtitle)
                            .font(.system(size: 11.5))
                            .foregroundColor(mutedText)
                    }
                    Spacer()
                    Button(action: { showPasswordPolicyModal = false }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(mutedText)
                            .frame(width: 28, height: 28)
                            .background(dark ? Color.white.opacity(0.06) : Color.black.opacity(0.04))
                            .cornerRadius(4)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .overlay(Rectangle().fill(border.opacity(0.6)).frame(height: 1), alignment: .bottom)

                // Body (对齐图2)
                VStack(alignment: .leading, spacing: 16) {
                    // 状态提示横幅 (对齐图2: 当前密码策略状态: 未启用 / 已启用)
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundColor(AppTheme.cyan)
                            .font(.system(size: 13))
                        Text("当前密码策略状态: \(model.policyEnableExpiry ? "已启用 (\(model.policyExpiryDays)天)" : "未启用")")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.cyan)
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(AppTheme.cyan.opacity(dark ? 0.12 : 0.08))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.cyan.opacity(0.35), lineWidth: 1))
                    .cornerRadius(6)

                    // 启用强制修改密码 (可点击卡片 + Checkbox)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("启用强制修改密码")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(primaryText)

                        Button(action: {
                            model.policyEnableExpiry.toggle()
                            if model.policyEnableExpiry && (model.policyExpiryDays.isEmpty || model.policyExpiryDays == "0") {
                                model.policyExpiryDays = "120"
                            }
                        }) {
                            HStack(spacing: 10) {
                                Image(systemName: model.policyEnableExpiry ? "checkmark.square.fill" : "square")
                                    .foregroundColor(model.policyEnableExpiry ? AppTheme.sidebarActive : mutedText)
                                    .font(.system(size: 14))
                                Text("启用后,该租户下所有用户将在指定天数后被强制修改密码")
                                    .font(.system(size: 12))
                                    .foregroundColor(model.policyEnableExpiry ? primaryText : mutedText)
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(model.policyEnableExpiry ? AppTheme.sidebarActive.opacity(0.08) : (dark ? Color.white.opacity(0.03) : Color.black.opacity(0.02)))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(model.policyEnableExpiry ? AppTheme.sidebarActive.opacity(0.4) : border.opacity(0.6), lineWidth: 1))
                            .cornerRadius(6)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }

                    // 密码过期天数 (始终显示，对齐图2)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 4) {
                            Text("密码过期天数")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(primaryText)
                            Text("*")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(AppTheme.danger)
                        }
                        TextField("120", text: $model.policyExpiryDays)
                            .textFieldStyle(PlainTextFieldStyle())
                            .font(.system(size: 12, design: .monospaced))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(dark ? Color.white.opacity(0.04) : Color.black.opacity(0.02))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.8), lineWidth: 1))
                            .cornerRadius(6)
                    }
                }
                .padding(20)

                Spacer()

                // Footer (对齐图2: 取消 + 保存策略)
                HStack(spacing: 10) {
                    Spacer()
                    AppButton(title: "取消", kind: .secondary) { showPasswordPolicyModal = false }
                    AppButton(title: "保存策略", systemImage: "square.and.arrow.down", kind: .primary) {
                        model.savePasswordPolicy(for: t)
                        showPasswordPolicyModal = false
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .overlay(Rectangle().fill(border.opacity(0.6)).frame(height: 1), alignment: .top)
            }
            .frame(width: 540, height: 380)
            .background(AppTheme.pageBg(dark))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(border.opacity(0.9), lineWidth: 1))
            .cornerRadius(10)
            .shadow(color: Color.black.opacity(0.45), radius: 25, x: 0, y: 10)
        }
    }

    private func passwordPolicyPanel(_ t: TenantItem) -> some View {
        formPanel {
            VStack(alignment: .leading, spacing: 12) {
                Text("密码策略配置")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(primaryText)
                ForEach(model.policyInfoLines, id: \.self) { line in
                    Text(line).font(.system(size: 12)).foregroundColor(mutedText)
                }
                Toggle("启用密码过期策略", isOn: $model.policyEnableExpiry)
                    .foregroundColor(primaryText)
                if model.policyEnableExpiry {
                    field("过期天数", text: $model.policyExpiryDays)
                    hint("0 = 永不过期，默认 120 天")
                }
                AppSheetInfoBox(
                    text: "说明",
                    lines: [
                        "策略作用于该租户下 OCI 用户",
                        "过期后用户需重置密码",
                        "天数为 0 表示永不过期"
                    ]
                )
                HStack(spacing: 10) {
                    AppButton(title: "保存", kind: .primary) { model.savePasswordPolicy(for: t) }
                    AppButton(title: "取消", kind: .secondary) { model.showPasswordPolicy = false }
                }
            }
        }
    }

    // MARK: - Traffic / Email / Social / Volumes（对齐 Web 弹层；审计/配额/费用已改整页）

    /// Web: `trafficAlertModal` — 严格对齐 Web 端流量预警设置现代化弹窗
    private func trafficSheet(_ t: TenantItem) -> some View {
        let regionName = t.regionNameText.isEmpty ? (t.region.isEmpty ? "—" : t.region) : t.regionNameText
        let subtitle = "\(t.displayName) · \(regionName)"

        return chrome(
            title: "流量预警设置",
            subtitle: subtitle,
            systemImage: "bell",
            iconColor: AppTheme.orange,
            width: 520,
            height: 520,
            scrollableContent: true,
            footer: {
                HStack(spacing: 10) {
                    AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                    AppButton(title: "保存", kind: .primary) { model.saveTraffic(t) }
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 18) {
                // 1. 启用流量统计 · 现代拟物白勾大卡片
                Button(action: {
                    model.trafficStats.toggle()
                }) {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(model.trafficStats ? AppTheme.sidebarActive : panelBg)
                                .frame(width: 18, height: 18)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 5)
                                        .stroke(model.trafficStats ? AppTheme.sidebarActive : border, lineWidth: 1)
                                )
                            if model.trafficStats {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(model.trafficStats ? "流量监控与预警已启用" : "流量监控与预警未启用")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(model.trafficStats ? AppTheme.sidebarActive : primaryText)
                            Text("开启后按月统计公网出方向流量，并在达到阈值时触发通知告警")
                                .font(.system(size: 11.5))
                                .foregroundColor(mutedText)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(model.trafficStats ? AppTheme.sidebarActive.opacity(dark ? 0.12 : 0.08) : panelBg)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(model.trafficStats ? AppTheme.sidebarActive.opacity(0.4) : border, lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
                .buttonStyle(PlainButtonStyle())

                // 2. 预警阈值与快捷药丸按钮组
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 4) {
                        Text("预警阈值 (GB)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(primaryText)
                        Text("*")
                            .foregroundColor(AppTheme.danger)
                        Text("· 每月流量达到该值时预警")
                            .font(.system(size: 11.5))
                            .foregroundColor(mutedText)
                    }

                    // 带右侧 GB 后缀标签的输入框
                    ZStack(alignment: .trailing) {
                        AppTextField(
                            text: $model.trafficThreshold,
                            placeholder: "5000"
                        )
                        Text("GB")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundColor(mutedText)
                            .padding(.trailing, 12)
                    }

                    // 快捷 Pill 胶囊按钮组
                    HStack(spacing: 8) {
                        ForEach([
                            ("1 TB", "1000"),
                            ("5 TB (推荐)", "5000"),
                            ("10 TB", "10000"),
                            ("20 TB", "20000")
                        ], id: \.0) { item in
                            let isSelected = model.trafficThreshold == item.1
                            Button(action: {
                                model.trafficThreshold = item.1
                            }) {
                                Text(item.0)
                                    .font(.system(size: 11.5, weight: isSelected ? .semibold : .medium))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 5)
                                    .background(isSelected ? AppTheme.sidebarActive : panelBg)
                                    .foregroundColor(isSelected ? .white : primaryText)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 6)
                                            .stroke(isSelected ? AppTheme.sidebarActive : border, lineWidth: 1)
                                    )
                                    .cornerRadius(6)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.top, 2)
                }
                .opacity(model.trafficStats ? 1.0 : 0.55)
                .allowsHitTesting(model.trafficStats)

                // 3. 高级防护动作 · 流量超限自动关机卡片
                VStack(alignment: .leading, spacing: 6) {
                    Text("高级保护动作")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(primaryText)

                    Button(action: {
                        model.trafficAutoShutdown.toggle()
                    }) {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(model.trafficAutoShutdown ? AppTheme.danger : panelBg)
                                    .frame(width: 18, height: 18)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 5)
                                            .stroke(model.trafficAutoShutdown ? AppTheme.danger : border, lineWidth: 1)
                                    )
                                if model.trafficAutoShutdown {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(.white)
                                }
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("流量超限自动关机")
                                    .font(.system(size: 12.5, weight: .semibold))
                                    .foregroundColor(model.trafficAutoShutdown ? AppTheme.danger : primaryText)
                                Text("当月流量达到阈值后自动停止该区域的所有实例，防止产生巨额账单")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(mutedText)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(model.trafficAutoShutdown ? AppTheme.danger.opacity(dark ? 0.12 : 0.08) : panelBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(model.trafficAutoShutdown ? AppTheme.danger.opacity(0.4) : border, lineWidth: 1)
                        )
                        .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                .opacity(model.trafficStats ? 1.0 : 0.55)
                .allowsHitTesting(model.trafficStats)

                // 4. 预警通知渠道状态与管理跳转
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("预警通知渠道")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(primaryText)
                        Spacer()
                        Button(action: {
                            model.openUsers(t, tab: .notifications)
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "gearshape")
                                    .font(.system(size: 11))
                                Text("管理通知邮箱")
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundColor(AppTheme.sidebarActive)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }

                    if model.notifyEmails.isEmpty {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(AppTheme.orange)
                                .font(.system(size: 13))
                            Text("暂未配置通知邮箱 — 流量触发预警时将无法接收提醒")
                                .font(.system(size: 11.5))
                                .foregroundColor(mutedText)
                            Spacer()
                            AppButton(title: "前往配置", kind: .secondary) {
                                model.openUsers(t, tab: .notifications)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(panelBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(AppTheme.orange.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        )
                        .cornerRadius(6)
                    } else {
                        HStack(spacing: 6) {
                            ForEach(model.notifyEmails, id: \.self) { email in
                                HStack(spacing: 5) {
                                    Image(systemName: "envelope")
                                        .font(.system(size: 11))
                                        .foregroundColor(AppTheme.info)
                                    Text(email)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(primaryText)
                                    Text("有效")
                                        .font(.system(size: 9.5, weight: .bold))
                                        .foregroundColor(AppTheme.sidebarActive)
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 1)
                                        .background(AppTheme.sidebarActive.opacity(0.15))
                                        .cornerRadius(3)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(panelBg)
                                .overlay(RoundedRectangle(cornerRadius: 5).stroke(border, lineWidth: 1))
                                .cornerRadius(5)
                            }
                        }
                    }
                }
            }
        }
    }

    /// Web: `emailServiceModal`
    private func emailSheet(_ t: TenantItem) -> some View {
        chrome(title: "启用邮箱服务", systemImage: "envelope", width: 500, height: 420, footer: {
            HStack(spacing: 10) {
                if model.emailEnabled || model.emailViewOnly {
                    AppButton(title: "修改", kind: .secondary) { model.emailViewOnly = false }
                }
                AppButton(title: "启用/保存", kind: .primary) { model.enableEmail(t) }
                AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
            }
        }) {
            VStack(alignment: .leading, spacing: 14) {
                if !model.emailInfo.isEmpty {
                    Text(model.emailInfo)
                        .font(.system(size: 13))
                        .foregroundColor(primaryText)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(panelBg)
                        .cornerRadius(4)
                }
                field("邮箱域名 *", text: $model.emailDomain)
                hint("示例：example.com，用于 OCI Email Delivery")
                AppSheetInfoBox(
                    text: "域名说明",
                    lines: [
                        "需完成域名验证后方可发送",
                        "启用后可在此配置测试收件地址",
                        "禁用将停止该租户邮箱投递"
                    ]
                )
                Divider().opacity(0.5)
                field("测试收件地址", text: $model.emailTestAddress)
                AppButton(title: "发送测试邮件", kind: .secondary) { model.testEmailService(t) }
                if model.emailEnabled {
                    AppButton(title: "禁用邮箱服务", kind: .danger) { model.disableEmail(t) }
                }
            }
        }
    }

    /// Web: `socialLoginModal` — 列表表格 + 编辑表单
    private func socialSheet(_ t: TenantItem) -> some View {
        chrome(title: "社媒配置", systemImage: "link", width: 800, height: 580, footer: {
            AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
        }) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 6) {
                    AppButton(title: "添加社媒", systemImage: "plus", kind: .primary) { model.resetSocialDraft(t) }
                    AppButton(title: "刷新", systemImage: "arrow.clockwise", kind: .secondary) {
                        model.openSocial(t)
                    }
                }

                AppSheetFixedTable(
                    isLoading: false,
                    isEmpty: model.socialItems.isEmpty,
                    emptyText: "暂无社媒绑定",
                    emptyIcon: "link",
                    rowCount: model.socialItems.count,
                    emptyBodyHeight: 160
                ) {
                    AppSheetTableHeader(columns: [
                        ("类型", 90), ("Client ID", nil), ("回调 URL", 180), ("状态", 80), ("操作", 160)
                    ])
                } rows: {
                    ForEach(Array(model.socialItems.enumerated()), id: \.element.id) { idx, s in
                        AppSheetTableRow(striped: idx % 2 == 1) {
                            HStack(spacing: 0) {
                                tableCell(s.socialTypeStr, width: 90, bold: true)
                                tableCell(s.clientId.isEmpty ? "—" : s.clientId, width: nil)
                                tableCell(s.redirectUrl.isEmpty ? "—" : s.redirectUrl, width: 180, muted: true)
                                StatusBadge(text: s.socialStatus, tone: s.socialStatus == "active" ? .success : .neutral)
                                    .frame(width: 80, alignment: .center)
                                    .padding(.horizontal, 8)
                                HStack(spacing: 4) {
                                    AppButton(title: "编辑", kind: .secondary) { model.editSocial(t, social: s) }
                                    if s.socialStatus == "active" {
                                        AppButton(title: "禁用", kind: .danger) { model.toggleSocial(t, social: s, enable: false) }
                                    } else {
                                        AppButton(title: "启用", kind: .primary) { model.toggleSocial(t, social: s, enable: true) }
                                    }
                                }
                                .frame(width: 160, alignment: .center)
                                .padding(.horizontal, 4)
                            }
                        }
                    }
                }

                sectionTitle(model.socialDraft.id > 0 ? "编辑配置" : "新增配置")
                formPanel {
                    VStack(alignment: .leading, spacing: 10) {
                        if !model.socialTypes.isEmpty {
                            sectionLabel("社媒类型 *")
                            SelectMenu(
                                options: model.socialTypes.map { SelectOption(id: $0, title: $0) },
                                selection: Binding(
                                    get: { model.socialDraft.socialTypeStr.isEmpty ? nil : model.socialDraft.socialTypeStr },
                                    set: { model.socialDraft.socialTypeStr = $0 ?? "" }
                                ),
                                placeholder: "类型",
                                width: 200,
                                allowClear: false
                            )
                        }
                        field("Client ID *", text: Binding(get: { model.socialDraft.clientId }, set: { model.socialDraft.clientId = $0 }))
                        field("Client Secret *", text: Binding(get: { model.socialDraft.clientSecret }, set: { model.socialDraft.clientSecret = $0 }))
                        field("第三方账号", text: Binding(get: { model.socialDraft.thirdLoginAddress }, set: { model.socialDraft.thirdLoginAddress = $0 }))
                        field("回调 URL", text: Binding(get: { model.socialDraft.redirectUrl }, set: { model.socialDraft.redirectUrl = $0 }))
                        hint("回调地址用于 OAuth 完成跳转，可从服务端生成")
                        HStack(spacing: 10) {
                            AppButton(title: "保存", kind: .primary) { model.saveSocial(t) }
                            AppButton(title: "取消", kind: .secondary) { model.resetSocialDraft(t) }
                        }
                    }
                }
            }
        }
    }

    /// Web: `bootVolumesModal` / `showDiskModal` — 对齐 Web 端磁盘管理弹窗（固定表头 + 100% 铺满 + 圆环进度 + 自适应滚动）
    private func volumesSheet(_ t: TenantItem) -> some View {
        let title = t.displayName.isEmpty ? "磁盘管理" : "\(t.displayName) · 磁盘管理"
        let subtitle = "区域: \(t.region) · 共 \(model.volumes.count) 个卷"
        let isEditing = model.editingVolumeId != nil
        let baseHeight: CGFloat = isEditing ? 560 : min(560, max(360, CGFloat(model.volumes.count) * 44 + 220))

        return chrome(
            title: title,
            subtitle: subtitle,
            systemImage: "externaldrive",
            iconColor: AppTheme.sidebarActive,
            width: 800,
            height: baseHeight,
            scrollableContent: false,
            footer: {
                HStack(spacing: 8) {
                    AppButton(
                        title: "刷新",
                        systemImage: "arrow.clockwise",
                        kind: .secondary,
                        isLoading: model.volumesLoading
                    ) {
                        Task { await model.reloadVolumes(t) }
                    }
                    AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 12) {
                // 如果正在编辑某个卷，展示对齐 Web 的性能预估编辑卡片
                if let editingId = model.editingVolumeId, let editingVol = model.volumes.first(where: { $0.id == editingId }) {
                    volumeEditCard(for: t, volume: editingVol)
                }

                // 表格盒子：100% 铺满宽度，表头恒定固定在顶端，加载时表头固定
                volumeTableBox(tenant: t)
            }
        }
    }

    private func volumeTableBox(tenant t: TenantItem) -> some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                let totalW = geo.size.width
                // 固定列：类型(58) + 容量(76) + 性能VPU(106) + 状态(80) + 操作(76) = 396px
                let fixedW: CGFloat = 396
                let flexW = max(240, totalW - fixedW)
                let wName = flexW * 0.58
                let wInstance = flexW * 0.42

                VStack(spacing: 0) {
                    // 1. 固定列表头（100% 铺满，向上滑动时永远固定不动）
                    volumeTableHeader(wName: wName, wInstance: wInstance)

                    // 2. 表体内容区（仅当数据超出 360px 高度时才允许上下滑动，少于时不动）
                    if model.volumesLoading || model.volumesBusy {
                        VStack(spacing: 8) {
                            Spacer()
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("加载中…")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
                    } else if model.volumes.isEmpty {
                        VStack {
                            Spacer()
                            Text("暂无引导卷")
                                .font(.system(size: 13))
                                .foregroundColor(mutedText)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
                    } else {
                        let totalRowsH = CGFloat(model.volumes.count) * 44
                        if totalRowsH > 360 {
                            ScrollView([.vertical], showsIndicators: true) {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(model.volumes.enumerated()), id: \.element.id) { idx, v in
                                        volumeRow(index: idx, volume: v, tenant: t, wName: wName, wInstance: wInstance)
                                    }
                                }
                            }
                            .frame(height: 360)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(Array(model.volumes.enumerated()), id: \.element.id) { idx, v in
                                    volumeRow(index: idx, volume: v, tenant: t, wName: wName, wInstance: wInstance)
                                }
                            }
                        }
                    }
                }
            }
            .frame(height: computedTableHeight)
        }
        .frame(maxWidth: .infinity)
        .background(AppSheetSurface.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private var computedTableHeight: CGFloat {
        if model.volumesLoading || model.volumesBusy || model.volumes.isEmpty {
            return 198 // 38 header + 160 body
        }
        let rowsH = CGFloat(model.volumes.count) * 44
        return min(398, rowsH + 38)
    }

    private func volumeRow(index: Int, volume v: TenantBootVolume, tenant t: TenantItem, wName: CGFloat, wInstance: CGFloat) -> some View {
        let isEditing = model.editingVolumeId == v.id
        return HStack(spacing: 0) {
            // 1. 名称（左侧留有 14pt 呼吸边距，绝对不顶格贴边）
            Text(v.displayName)
                .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                .foregroundColor(primaryText)
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.leading, 14)
                .padding(.trailing, 6)
                .frame(width: wName, alignment: .leading)
                .help(v.displayName)

            // 2. 实例
            Text(v.instanceName.isEmpty ? "未关联实例" : v.instanceName)
                .font(.system(size: 11))
                .foregroundColor(v.instanceName.isEmpty ? mutedText : primaryText)
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, 6)
                .frame(width: wInstance, alignment: .leading)
                .help(v.instanceName)

            // 3. 类型
            HStack {
                Text("Boot")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(AppTheme.info)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(AppTheme.info.opacity(0.15))
                    .cornerRadius(3)
            }
            .padding(.horizontal, 6)
            .frame(width: 58, alignment: .center)

            // 4. 容量
            Text("\(v.sizeInGBs) GB")
                .font(.system(size: 11.5, design: .monospaced))
                .foregroundColor(primaryText)
                .padding(.horizontal, 6)
                .frame(width: 76, alignment: .center)

            // 5. 性能 (VPU) - 圆环进度环
            HStack {
                VpuCircleRing(vpu: v.vpusPerGB, dark: dark)
            }
            .padding(.horizontal, 6)
            .frame(width: 106, alignment: .center)

            // 6. 状态
            HStack(spacing: 4) {
                if !v.instanceName.isEmpty {
                    Circle()
                        .fill(AppTheme.sidebarActive)
                        .frame(width: 5, height: 5)
                    Text("已挂载")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.sidebarActive)
                } else {
                    Text("未挂载")
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                }
            }
            .padding(.horizontal, 6)
            .frame(width: 80, alignment: .center)

            // 7. 操作（右侧贴齐，保留 10pt 内边距）
            HStack(spacing: 4) {
                AppButton(title: isEditing ? "取消" : "编辑", kind: isEditing ? .primary : .secondary) {
                    if isEditing {
                        model.editingVolumeId = nil
                    } else {
                        model.beginEditVolume(v)
                    }
                }
                if v.instanceName.isEmpty {
                    AppButton(title: "删除", kind: .danger) {
                        model.deleteVolume(for: t, volume: v)
                    }
                }
            }
            .padding(.leading, 6)
            .padding(.trailing, 10)
            .frame(width: 76, alignment: .center)
        }
        .padding(.vertical, 9)
        .background(index % 2 == 1 ? AppSheetSurface.panelBg(dark).opacity(0.4) : Color.clear)
        .overlay(
            Rectangle().fill(AppSheetSurface.border(dark).opacity(0.4)).frame(height: 1),
            alignment: .bottom
        )
    }

    private func volumeTableHeader(wName: CGFloat, wInstance: CGFloat) -> some View {
        HStack(spacing: 0) {
            volumeHeaderCell("引导卷名称", width: wName, align: .leading, isFirst: true)
            volumeHeaderCell("实例名称", width: wInstance, align: .leading)
            volumeHeaderCell("类型", width: 58, align: .center)
            volumeHeaderCell("容量", width: 76, align: .center)
            volumeHeaderCell("性能 (VPU)", width: 106, align: .center)
            volumeHeaderCell("状态", width: 80, align: .center)
            volumeHeaderCell("操作", width: 76, align: .center, isLast: true)
        }
        .padding(.vertical, 10)
        .background(AppSheetSurface.panelBg(dark))
        .overlay(
            Rectangle().fill(AppSheetSurface.border(dark)).frame(height: 1),
            alignment: .bottom
        )
    }

    private func volumeHeaderCell(_ text: String, width: CGFloat, align: Alignment, isFirst: Bool = false, isLast: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppSheetSurface.mutedText(dark))
            .lineLimit(1)
            .padding(.leading, isFirst ? 14 : 6)
            .padding(.trailing, isLast ? 10 : 6)
            .frame(width: width, alignment: align)
    }

    private func volumeEditCard(for t: TenantItem, volume: TenantBootVolume) -> some View {
        let vpu = Int64(model.editVolumeVpus.rounded())
        let estIops = Int64(Double(volume.sizeInGBs) * Double(vpu * 12 + 60))
        let estMbps = Double(vpu) * 1.75 / 10.0

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("修改引导卷配置")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(primaryText)
                Spacer()
                Button(action: { model.editingVolumeId = nil }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(mutedText)
                }
                .buttonStyle(PlainButtonStyle())
            }

            field("卷名称", text: $model.editVolumeName)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("VPUs 性能档位: \(vpu)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(primaryText)
                    Spacer()
                    Text("OCI 范围: 10–120")
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                }
                Slider(value: $model.editVolumeVpus, in: 10...120, step: 10)
                    .accentColor(AppTheme.sidebarActive)
            }

            // 性能预估卡片（对齐 Web）
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Text("预计 IOPS:")
                        .font(.system(size: 11.5))
                        .foregroundColor(mutedText)
                    Text("\(estIops)")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(AppTheme.sidebarActive)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(AppTheme.sidebarHover(dark))
                .cornerRadius(6)

                HStack(spacing: 8) {
                    Text("预计吞吐量:")
                        .font(.system(size: 11.5))
                        .foregroundColor(mutedText)
                    Text(String(format: "%.2f MB/s/GB", estMbps))
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(AppTheme.cyan)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(AppTheme.sidebarHover(dark))
                .cornerRadius(6)

                Spacer(minLength: 0)

                AppButton(title: "取消", kind: .secondary) {
                    model.editingVolumeId = nil
                }
                AppButton(title: "保存更改", systemImage: "checkmark", kind: .primary) {
                    model.saveVolumeEdit(for: t)
                }
            }
        }
        .padding(14)
        .background(AppTheme.sidebarBg(dark))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
    }

    // MARK: - Check / Export / Progress / Subpage

    private var accountCheckSheet: some View {
        chrome(title: "批量账号检测", width: 560, height: 520, footer: {
            AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
        }) {
            VStack(alignment: .leading, spacing: 12) {
                ProgressView(value: Double(model.checkPercent), total: 100)
                Text("\(model.checkPercent)%")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(mutedText)
                if let r = model.checkResult {
                    HStack(spacing: 12) {
                        stat("总计", "\(r.totalAccounts)")
                        stat("有效", "\(r.activeAccounts)")
                        stat("失效", "\(r.inactiveAccounts)")
                    }
                    if !r.inactiveAccountNames.isEmpty {
                        sectionTitle("失效账号列表")
                        ForEach(r.inactiveAccountNames, id: \.self) { name in
                            Text("· \(name)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(AppTheme.danger)
                        }
                    }
                }
                sectionTitle("日志")
                formPanel {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(Array(model.checkLines.suffix(40)), id: \.self) { line in
                            Text(line)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(primaryText.opacity(0.88))
                        }
                    }
                }
            }
        }
    }

    /// Web `handleSecureExport`：打开即发码 → 输入 6 位 → 确认导出 JSON。
    private func exportSheet(title: String, onExport: @escaping () -> Void) -> some View {
        chrome(title: title, systemImage: "square.and.arrow.down", width: 440, height: 340, footer: {
            HStack(spacing: 8) {
                AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                AppButton(title: "确认导出", kind: .primary, action: onExport)
            }
        }) {
            VStack(alignment: .leading, spacing: 14) {
                formPanel {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("导出安全验证")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(primaryText)
                        Text("验证码已发送至您的通知终端，请输入 6 位验证码以确认导出。导出文件含 API 私钥，请妥善保管。")
                            .font(.system(size: 12))
                            .foregroundColor(mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                HStack(spacing: 10) {
                    AppButton(
                        title: model.exportSending
                            ? "发送中…"
                            : (model.exportSent ? "重新发送验证码" : "发送验证码"),
                        kind: .secondary
                    ) {
                        model.sendExportCode()
                    }
                    if model.exportSending {
                        ProgressView().scaleEffect(0.7)
                    } else if model.exportSent {
                        Text("已发送")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarActive)
                    }
                    Spacer(minLength: 0)
                }
                field("验证码", text: $model.exportCode)
                hint("请输入通知中的 6 位数字验证码")
            }
        }
    }

    private func progressSheet(title: String, lines: [String]) -> some View {
        let isDone = lines.contains { $0.contains("[success]") }
        let isFailed = lines.contains { $0.contains("[error]") }

        return chrome(title: title, width: 520, height: 400, footer: {
            AppButton(title: isDone ? "完成" : "关闭", kind: isDone ? .primary : .secondary) {
                presentationMode.wrappedValue.dismiss()
            }
        }) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    if isDone {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.sidebarActive)
                        Text("更新完成")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppTheme.sidebarActive)
                    } else if isFailed {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.danger)
                        Text("更新失败")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppTheme.danger)
                    } else {
                        ProgressView()
                            .scaleEffect(0.75)
                        Text("处理中…")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(mutedText)
                    }
                }
                formPanel {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(lines.suffix(50), id: \.self) { line in
                                Text(line)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(
                                        line.contains("[success]") ? AppTheme.sidebarActive :
                                        line.contains("[error]") ? AppTheme.danger :
                                        primaryText.opacity(0.88)
                                    )
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }
        }
    }

    /// 对齐 Web `syncModal`：标题 + 进度条 + 状态文案
    private func syncProgressSheet(name: String) -> some View {
        let phase = model.syncPhase
        let canClose = phase == .success || phase == .error
        return chrome(
            title: "OCI 资源同步",
            systemImage: "arrow.2.circlepath",
            width: 440,
            height: 280,
            fixedSize: true,
            footer: {
                if canClose {
                    AppButton(title: "关闭", kind: .secondary) {
                        model.dismissSyncProgress()
                    }
                } else {
                    Text("同步期间请保持窗口打开")
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(syncPhaseColor(phase).opacity(0.15))
                            .frame(width: 40, height: 40)
                        if phase == .running || phase == .waitingLong {
                            ProgressView()
                                .scaleEffect(0.75)
                        } else {
                            Image(systemName: phase == .success ? "checkmark" : "xmark")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(syncPhaseColor(phase))
                        }
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(name.isEmpty ? model.syncTenantName : name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(primaryText)
                            .lineLimit(1)
                        Text(model.syncStatusText)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(syncPhaseColor(phase))
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: 8) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(dark ? Color.white.opacity(0.08) : Color.black.opacity(0.06))
                            Capsule()
                                .fill(syncPhaseColor(phase))
                                .frame(width: max(8, geo.size.width * CGFloat(model.syncPercent / 100)))
                                .animation(.easeInOut(duration: 0.25), value: model.syncPercent)
                        }
                    }
                    .frame(height: 10)

                    HStack {
                        Text(syncPhaseLabel(phase))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(mutedText)
                        Spacer()
                        Text("\(Int(model.syncPercent.rounded()))%")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundColor(primaryText)
                    }
                }

                formPanel {
                    Text(syncPhaseHint(phase))
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func syncPhaseColor(_ phase: TenantSyncPhase) -> Color {
        switch phase {
        case .running: return AppTheme.sidebarActive
        case .waitingLong: return AppTheme.orange
        case .success: return AppTheme.sidebarActive
        case .error: return AppTheme.danger
        }
    }

    private func syncPhaseLabel(_ phase: TenantSyncPhase) -> String {
        switch phase {
        case .running: return "同步进行中"
        case .waitingLong: return "仍在等待服务端"
        case .success: return "已完成"
        case .error: return "同步失败"
        }
    }

    private func syncPhaseHint(_ phase: TenantSyncPhase) -> String {
        switch phase {
        case .running:
            return "正在从 OCI 拉取区域与资源信息，通常需要数十秒到数分钟，请耐心等待。"
        case .waitingLong:
            return "已超过预估时间，请求仍在进行。请不要关闭应用；若最终超时可稍后重试。"
        case .success:
            return "同步完成，列表即将刷新。"
        case .error:
            return "请检查租户 API 配置与网络后重试。错误信息见上方状态。"
        }
    }

    // MARK: - Native subpages

    private func bootCreateSheet(_ t: TenantItem) -> some View {
        // 宽扁弹框，避免竖向撑满主窗口
        // Web: `add_boot.ftl` form-card
        chrome(title: "预开机配置", systemImage: "plus.circle", width: 760, height: 480, fixedSize: true, footer: {
            HStack(spacing: 10) {
                AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                AppButton(title: "保存任务", kind: .primary) { model.submitBoot(t) }
            }
        }) {
            HStack(alignment: .top, spacing: 24) {
                // 左列：规格
                VStack(alignment: .leading, spacing: 10) {
                    sectionTitle("选择区域 / 规格")
                    labeledSelect("架构", width: 200) {
                        SelectMenu(
                            options: [
                                SelectOption(id: "ARM", title: "ARM"),
                                SelectOption(id: "AMD", title: "AMD"),
                                SelectOption(id: "X86", title: "X86")
                            ],
                            selection: Binding(
                                get: { model.bootArchitecture },
                                set: {
                                    model.bootArchitecture = $0 ?? "ARM"
                                    Task {
                                        let tid = Int64(model.bootSelectedRegionTenantId) ?? t.id
                                        await model.loadBootImages(tenantId: tid)
                                    }
                                }
                            ),
                            placeholder: "架构", width: 200, allowClear: false
                        )
                    }
                    if !model.bootRegionOptions.isEmpty {
                        labeledSelect("区域租户", width: 280) {
                            SelectMenu(
                                options: model.bootRegionOptions.map { SelectOption(id: $0.id, title: $0.label) },
                                selection: Binding(
                                    get: { model.bootSelectedRegionTenantId },
                                    set: {
                                        model.bootSelectedRegionTenantId = $0 ?? "\(t.id)"
                                        Task {
                                            let tid = Int64(model.bootSelectedRegionTenantId) ?? t.id
                                            await model.loadBootImages(tenantId: tid)
                                        }
                                    }
                                ),
                                placeholder: "区域", width: 280, allowClear: false
                            )
                        }
                    }
                    HStack(spacing: 12) {
                        field("OCPU", text: $model.bootOcpu)
                        field("内存 (GB)", text: $model.bootMemory)
                        field("磁盘 (GB)", text: $model.bootDisk)
                    }
                    HStack(spacing: 12) {
                        field("循环间隔(秒)", text: $model.bootLoopTime)
                        field("实例数量", text: $model.bootCount)
                    }
                    field("时段 dayGap (如 0-8)", text: $model.bootDayGap)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // 右列：镜像与密码
                VStack(alignment: .leading, spacing: 10) {
                    sectionTitle("镜像与访问")
                    field("root 密码", text: $model.bootRootPassword)
                    labeledSelect("操作系统", width: 280) {
                        if model.bootOSList.isEmpty {
                            Text("加载镜像中或暂无镜像…")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                                .frame(height: AppInputStyle.height, alignment: .leading)
                        } else {
                            SelectMenu(
                                options: model.bootOSList.map { SelectOption(id: $0, title: $0) },
                                selection: Binding(
                                    get: { model.bootSelectedOS.isEmpty ? nil : model.bootSelectedOS },
                                    set: { if let v = $0 { model.applyBootOS(v) } }
                                ),
                                placeholder: "OS", width: 280, allowClear: false
                            )
                        }
                    }
                    labeledSelect("系统版本", width: 280) {
                        if model.bootVersions.isEmpty {
                            Text("—")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                                .frame(height: AppInputStyle.height, alignment: .leading)
                        } else {
                            SelectMenu(
                                options: model.bootVersions.map {
                                    SelectOption(id: $0.operatingSystemVersion, title: $0.operatingSystemVersion)
                                },
                                selection: Binding(
                                    get: { model.bootSelectedVersion.isEmpty ? nil : model.bootSelectedVersion },
                                    set: { if let v = $0 { model.applyBootVersion(v) } }
                                ),
                                placeholder: "版本", width: 280, allowClear: false
                            )
                        }
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        sectionLabel("Image ID")
                        Text(model.bootImageId.isEmpty ? "—" : model.bootImageId)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(mutedText)
                            .lineLimit(2)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(AppInputStyle.fill(dark))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(AppTheme.border(dark).opacity(0.6), lineWidth: 1)
                            )
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func labeledSelect<Content: View>(_ title: String, width: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel(title)
            content()
                .frame(width: width, alignment: .leading)
        }
    }

    /// Web: `securityRulesModal`（租户详情页）
    private func securityRulesSheet(_ t: TenantItem) -> some View {
        let regionName = RegionCnName.table[t.region] ?? t.region
        let subtitle = "\(t.displayName) · \(regionName) · \(model.currentRules.count) 条规则"
        return chrome(title: "安全规则管理", subtitle: subtitle, systemImage: "shield", width: 880, height: 620, footer: {
            HStack(spacing: 8) {
                AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                AppButton(title: "刷新规则", systemImage: "arrow.clockwise", kind: .primary, isLoading: model.rulesLoading) {
                    model.loadSecurityRules(t)
                }
            }
        }) {
            sheetCenteredLoading(isLoading: model.rulesBusy) {
                VStack(alignment: .leading, spacing: 12) {
                    ruleTabBar(item: t)
                    HStack {
                        AppButton(title: model.editingRuleIndex != nil ? "编辑规则" : "添加规则", systemImage: "plus", kind: .primary) {
                            if model.showAddRule {
                                model.closeRuleForm()
                                model.showRuleTemplatePicker = false
                            } else {
                                model.startAddRule()
                                model.showRuleTemplatePicker = false
                            }
                        }
                        .disabled(model.rulesLoading || model.rulesBusy)
                        AppButton(title: "一键模板", systemImage: "wand.and.stars", kind: .secondary) {
                            model.showRuleTemplatePicker.toggle()
                        }
                        .disabled(model.rulesLoading || model.rulesBusy)
                        Spacer()
                    }
                    if model.showRuleTemplatePicker {
                        formPanel {
                            VStack(alignment: .leading, spacing: 10) {
                                sectionLabel("一键模板")
                                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                                    ForEach(SecurityRuleTemplates.all, id: \.id) { tmpl in
                                        Button {
                                            model.applySecurityTemplate(tmpl.rules, item: t)
                                        } label: {
                                            VStack(alignment: .leading, spacing: 3) {
                                                HStack(spacing: 6) {
                                                    Text(tmpl.name)
                                                        .font(.system(size: 12, weight: .semibold))
                                                        .foregroundColor(primaryText)
                                                    Spacer()
                                                    Text("\(tmpl.rules.count)")
                                                        .font(.system(size: 10, design: .monospaced))
                                                        .foregroundColor(mutedText)
                                                        .padding(.horizontal, 5)
                                                        .padding(.vertical, 1)
                                                        .background(panelBg)
                                                        .cornerRadius(3)
                                                }
                                                Text(tmpl.desc)
                                                    .font(.system(size: 10.5))
                                                    .foregroundColor(mutedText)
                                                    .lineLimit(2)
                                            }
                                            .padding(10)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .background(panelBg)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 6)
                                                    .stroke(border, lineWidth: 1)
                                            )
                                            .cornerRadius(6)
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }
                                }
                            }
                        }
                    }
                    if model.showAddRule {
                        formPanel {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(spacing: 8) {
                                    sectionLabel(model.editingRuleIndex != nil ? "编辑规则" : "添加规则")
                                    if model.editingRuleIndex != nil { Spacer() }
                                }
                                sectionLabel("协议")
                                protocolSegmentedControl

                                // 源地址：CIDR 快选 + 输入（对齐 Web CIDR_PRESETS）
                                sectionLabel("源地址 *")
                                cidrQuickChips
                                AppTextField(text: $model.ruleSource, placeholder: "如 0.0.0.0/0，或 10.0.0.0/8")

                                // 端口：常用端口 chips + 双输入（对齐 Web PORT_PRESETS，ALL/ICMP 时禁用）
                                sectionLabel("端口范围")
                                if isPortsDisabledForProtocol(model.ruleProtocol) {
                                    hint("\(model.ruleProtocol == "all" ? "全部协议" : "ICMP")无需填写端口")
                                } else {
                                    portPresetChips
                                    HStack(spacing: 8) {
                                        AppTextField(text: $model.rulePortStart, placeholder: "起始端口")
                                            .frame(maxWidth: .infinity)
                                        Text("—")
                                            .foregroundColor(mutedText)
                                        AppTextField(text: $model.rulePortEnd, placeholder: "结束端口")
                                            .frame(maxWidth: .infinity)
                                    }
                                    hint("示例：单端口输入 22，或范围 80-443")
                                }
                                HStack(spacing: 8) {
                                    AppButton(
                                        title: "保存",
                                        kind: .primary,
                                        isLoading: model.rulesBusy
                                    ) { model.saveSecurityRule(t) }
                                    AppButton(title: "取消", kind: .danger) { model.closeRuleForm() }
                                }
                            }
                        }
                    }
                    // 风险汇总（对齐 Web 顶部风险徽章）
                    securityRuleRiskSummary

                    // 表格盒：表头恒定固定，数据区独立加载/空态/滚动（对齐硬盘弹窗 volumeTableBox）
                    ruleTableBox(tenant: t)
                }
            }
        }
    }

    /// 表头单元格：minWidth 自适应居中 / flexible 占满剩余 / fixed 固定宽
    private func headerCell(_ title: String, minWidth: CGFloat? = nil, flexible: Bool = false, fixed: CGFloat? = nil) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(mutedText)
            .lineLimit(1)
            .padding(.horizontal, 10)
            .frame(maxWidth: flexible ? .infinity : nil)
            .frame(minWidth: minWidth, alignment: .center)
            .frame(width: fixed, alignment: .center)
            .frame(maxHeight: .infinity)
    }

    /// 安全规则表格盒：表头恒定 + 数据区（加载/空态/滚动行）
    private func ruleTableBox(tenant t: TenantItem) -> some View {
        VStack(spacing: 0) {
            // 固定表头（恒定常驻，不随数据滚动）：非操作列自适应(minWidth)，源列弹性，操作列固定
            HStack(spacing: 0) {
                headerCell("#", minWidth: 40)
                headerCell("类型", minWidth: 76)
                headerCell("协议", minWidth: 76)
                headerCell("源", minWidth: 120, flexible: true)
                headerCell("端口", minWidth: 92)
                headerCell("风险", minWidth: 72)
                headerCell("操作", fixed: 190)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(AppSheetSurface.panelBg(dark))
            .overlay(
                Rectangle()
                    .fill(AppSheetSurface.border(dark))
                    .frame(height: 1),
                alignment: .bottom
            )

            // 数据区：加载 / 空态 / 滚动行
            if model.rulesLoading {
                VStack(spacing: 8) {
                    Spacer()
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("加载中…")
                        .font(.system(size: 12))
                        .foregroundColor(mutedText)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
            } else if model.currentRules.isEmpty {
                let tabName = model.rulesTab == "egress" ? "出站" : "入站"
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "shield.slash")
                        .font(.system(size: 36))
                        .foregroundColor(mutedText.opacity(0.6))
                    Text("暂无\(tabName)规则")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(primaryText)
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 11))
                        Text(model.rulesTab == "egress" ? "当前允许所有出站流量" : "当前不允许任何外部流量进入")
                            .font(.system(size: 11.5))
                    }
                    .foregroundColor(model.rulesTab == "egress" ? AppTheme.orange : AppTheme.danger)
                    .padding(.top, 2)
                    HStack(spacing: 8) {
                        AppButton(title: "手动添加", systemImage: "plus", kind: .primary) {
                            model.startAddRule()
                            model.showRuleTemplatePicker = false
                        }
                        AppButton(title: "从模板开始", systemImage: "wand.and.stars", kind: .secondary) {
                            model.showRuleTemplatePicker = true
                        }
                    }
                    .padding(.top, 6)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .frame(height: 200)
            } else {
                let totalRowsH = CGFloat(model.currentRules.count) * 44
                if totalRowsH > 360 {
                    ScrollView([.vertical], showsIndicators: true) {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(model.currentRules.enumerated()), id: \.offset) { idx, rule in
                                ruleRow(index: idx, rule: rule, tenant: t)
                            }
                        }
                    }
                    .frame(height: 360)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(model.currentRules.enumerated()), id: \.offset) { idx, rule in
                            ruleRow(index: idx, rule: rule, tenant: t)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .background(AppSheetSurface.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    /// 安全规则单行
    private func ruleRow(index: Int, rule: TenantSecurityRule, tenant t: TenantItem) -> some View {
        let tabLabel = rule.type.isEmpty ? model.rulesTab : rule.type
        return HStack(spacing: 0) {
            Text("\(index + 1)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(mutedText)
                .frame(minWidth: 40, alignment: .center)
            // 类型（入站/出站）
            HStack(spacing: 3) {
                Image(systemName: model.rulesTab == "egress" ? "arrow.up.right" : "arrow.down.left")
                    .font(.system(size: 9, weight: .semibold))
                Text(tabLabel == "egress" ? "出站" : "入站")
                    .font(.system(size: 10.5, weight: .semibold))
            }
            .foregroundColor(model.rulesTab == "egress" ? AppTheme.orange : AppTheme.info)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background((model.rulesTab == "egress" ? AppTheme.orange : AppTheme.info).opacity(0.14))
            .cornerRadius(3)
            .frame(minWidth: 76, alignment: .center)

            // 协议
            Text(rule.protocolDisplay)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(protocolColor(rule.protocolValue))
                .frame(minWidth: 76, alignment: .center)

            // 源（弹性占满剩余空间，居中）
            Text(rule.source.isEmpty ? "—" : rule.source)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(primaryText)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .center)

            // 端口
            if rule.portsDisplay == "—" {
                Text("全部")
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundColor(mutedText)
                    .frame(minWidth: 92, alignment: .center)
            } else {
                Text(rule.portsDisplay)
                    .font(.system(size: 10.5, weight: .medium, design: .monospaced))
                    .foregroundColor(AppTheme.cyan)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.cyan.opacity(0.14))
                    .cornerRadius(3)
                    .frame(minWidth: 92, alignment: .center)
            }

            // 风险
            riskBadge(for: rule)
                .frame(minWidth: 72, alignment: .center)

            // 行操作：编辑 / 复制 / 删除（固定宽）
            HStack(spacing: 4) {
                AppButton(title: "编辑", kind: .secondary) {
                    model.beginEditRule(at: index)
                }
                .fixedSize()
                AppButton(title: "复制", kind: .secondary) {
                    model.copyRule(at: index, item: t)
                }
                .fixedSize()
                AppButton(title: "删除", kind: .danger) {
                    model.deleteSecurityRule(at: index, item: t)
                }
                .fixedSize()
            }
            .frame(width: 190, alignment: .center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(index % 2 == 1 ? AppSheetSurface.panelBg(dark).opacity(0.5) : Color.clear)
        .overlay(
            Rectangle()
                .fill(AppSheetSurface.border(dark).opacity(0.7))
                .frame(height: 1),
            alignment: .bottom
        )
    }

    /// 协议颜色（对齐 Web PROTOCOLS 颜色）
    private func protocolColor(_ proto: String) -> Color {
        switch proto.lowercased() {
        case "all", "all protocols": return AppTheme.info
        case "6", "tcp": return AppTheme.info
        case "17", "udp": return AppTheme.cyan
        case "1", "icmp": return AppTheme.orange
        default: return AppTheme.info
        }
    }

    /// 入站/出站 Tab（带计数徽章，对齐 Web 分段控件风格）
    private func ruleTabBar(item t: TenantItem) -> some View {
        let tabs: [(key: String, label: String, icon: String, count: Int, color: Color)] = [
            ("ingress", "入站规则", "arrow.down.left", model.ingressRules.count, AppTheme.info),
            ("egress", "出站规则", "arrow.up.right", model.egressRules.count, AppTheme.orange),
        ]
        return HStack(spacing: 6) {
            ForEach(tabs, id: \.key) { tab in
                let active = model.rulesTab == tab.key
                Button {
                    model.switchRulesTab(tab.key, item: t)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 12, weight: .semibold))
                        Text(tab.label)
                            .font(.system(size: 13, weight: active ? .semibold : .medium))
                        // 计数徽章
                        Text("\(tab.count)")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(
                                active ? Color.white.opacity(0.2) : panelBg
                            )
                            .foregroundColor(active ? .white : mutedText)
                            .cornerRadius(4)
                    }
                    .foregroundColor(active ? .white : mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(active ? tab.color : dark ? Color(hex: "1a222a") : Color(hex: "eef2f5"))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(active ? tab.color : border, lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(4)
        .background(AppSheetSurface.panelBg(dark))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
    }

    // MARK: - 安全规则表单辅助控件（对齐 Web showSecurityModal）

    /// 协议分段控件（对齐 Web PROTOCOLS）
    private var protocolSegmentedControl: some View {
        let protocols: [(id: String, label: String, color: Color)] = [
            ("all", "全部", AppTheme.info),
            ("tcp", "TCP", AppTheme.info),
            ("udp", "UDP", AppTheme.cyan),
            ("icmp", "ICMP", AppTheme.orange),
        ]
        return HStack(spacing: 4) {
            ForEach(protocols, id: \.id) { p in
                let active = model.ruleProtocol == p.id
                Button {
                    model.ruleProtocol = p.id
                    if p.id == "all" || p.id == "icmp" {
                        model.rulePortStart = ""
                        model.rulePortEnd = ""
                    }
                } label: {
                    Text(p.label)
                        .font(.system(size: 11.5, weight: active ? .semibold : .medium))
                        .foregroundColor(active ? p.color : mutedText)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 30)
                        .background(active ? p.color.opacity(0.14) : Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(active ? p.color : border, lineWidth: 1)
                        )
                        .cornerRadius(6)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }

    /// CIDR 快选 chips（对齐 Web CIDR_PRESETS）
    private var cidrQuickChips: some View {
        let presets: [(label: String, value: String, color: Color, active: Bool)] = [
            ("任何", "0.0.0.0/0", AppTheme.orange, model.ruleSource == "0.0.0.0/0"),
            ("仅 IPv6", "::/0", AppTheme.orange, model.ruleSource == "::/0"),
            ("内网 A", "10.0.0.0/8", AppTheme.sidebarActive, model.ruleSource == "10.0.0.0/8"),
            ("内网 B", "172.16.0.0/12", AppTheme.sidebarActive, model.ruleSource == "172.16.0.0/12"),
            ("内网 C", "192.168.0.0/16", AppTheme.sidebarActive, model.ruleSource == "192.168.0.0/16"),
        ]
        return HStack(spacing: 6) {
            ForEach(presets, id: \.value) { p in
                Button { model.ruleSource = p.value } label: {
                    HStack(spacing: 4) {
                        Text(p.label)
                            .font(.system(size: 11, weight: .medium))
                        Text(p.value)
                            .font(.system(size: 10, design: .monospaced))
                            .opacity(0.7)
                    }
                    .foregroundColor(p.active ? p.color : mutedText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(p.active ? p.color.opacity(0.14) : panelBg)
                    .overlay(
                        Capsule().stroke(p.active ? p.color : border, lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
            Spacer(minLength: 0)
        }
    }

    /// 常用端口 chips（对齐 Web PORT_PRESETS）
    private var portPresetChips: some View {
        // (label, start, end) — end 为空表示单端口
        let presets: [(label: String, start: String, end: String, display: String)] = [
            ("SSH", "22", "", "22"), ("HTTP", "80", "", "80"), ("HTTPS", "443", "", "443"), ("RDP", "3389", "", "3389"),
            ("MySQL", "3306", "", "3306"), ("PostgreSQL", "5432", "", "5432"), ("Redis", "6379", "", "6379"),
            ("MongoDB", "27017", "", "27017"), ("Web 高段", "8000", "8100", "8000-8100"),
        ]
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 6)], spacing: 6) {
            ForEach(presets, id: \.display) { p in
                let active = p.end.isEmpty
                    ? (model.rulePortStart == p.start && model.rulePortEnd.isEmpty)
                    : (model.rulePortStart == p.start && model.rulePortEnd == p.end)
                Button {
                    model.rulePortStart = p.start
                    model.rulePortEnd = p.end
                } label: {
                    HStack(spacing: 4) {
                        Text(p.label)
                            .font(.system(size: 11, weight: .medium))
                        Text(p.display)
                            .font(.system(size: 10, design: .monospaced))
                            .opacity(0.7)
                    }
                    .foregroundColor(active ? AppTheme.cyan : mutedText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .background(active ? AppTheme.cyan.opacity(0.14) : panelBg)
                    .overlay(
                        Capsule().stroke(active ? AppTheme.cyan : border, lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }

    /// 端口是否禁用（ALL / ICMP 协议）
    private func isPortsDisabledForProtocol(_ proto: String) -> Bool {
        let p = proto.lowercased()
        return p == "all" || p == "icmp" || p == "1"
    }

    /// 风险等级（对齐 Web riskLevel）：返回 (等级key, 文案, 颜色)
    private func securityRuleRiskLevel(_ rule: TenantSecurityRule) -> (key: String, label: String, color: Color) {
        let proto = rule.protocolValue.lowercased()
        let openAll = rule.source == "0.0.0.0/0" || rule.source == "::/0"
        let ports = rule.portsDisplay == "—" ? "" : rule.ports
        let dangerPorts = "(^|,|-|\\b)(22|3389|3306|5432|6379|27017)(\\b|,|-|$)"
        let hasDangerPort = !ports.isEmpty && ports.range(of: dangerPorts, options: .regularExpression) != nil

        if openAll && (proto == "all" || proto == "all protocols") {
            return ("critical", "严重", AppSheetSurface.accentRed(dark))
        } else if openAll && hasDangerPort {
            return ("high", "高", AppSheetSurface.accentRed(dark))
        } else if openAll {
            return ("medium", "中", AppTheme.orange)
        } else {
            return ("low", "低", AppTheme.sidebarActive)
        }
    }

    /// 风险等级徽章（对齐 Web riskLevel / riskCfg）
    private func riskBadge(for rule: TenantSecurityRule) -> some View {
        let level = securityRuleRiskLevel(rule)
        let hasAlert = level.key == "critical" || level.key == "high"
        return HStack(spacing: 3) {
            if hasAlert {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 9, weight: .semibold))
            }
            Text(level.label)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundColor(level.color)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(level.color.opacity(0.14))
        .cornerRadius(4)
    }

    /// 风险汇总徽章行（对齐 Web 顶部风险汇总）
    private var securityRuleRiskSummary: some View {
        let counts: [(key: String, label: String, color: Color, count: Int)] = [
            ("high", "高", AppSheetSurface.accentRed(dark), model.currentRules.filter { securityRuleRiskLevel($0).key == "critical" || securityRuleRiskLevel($0).key == "high" }.count),
            ("medium", "中", AppTheme.orange, model.currentRules.filter { securityRuleRiskLevel($0).key == "medium" }.count),
            ("low", "低", AppTheme.sidebarActive, model.currentRules.filter { securityRuleRiskLevel($0).key == "low" }.count),
        ]
        return HStack(spacing: 6) {
            Text("风险")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundColor(mutedText)
            ForEach(counts.filter { $0.count > 0 }, id: \.key) { item in
                HStack(spacing: 3) {
                    if item.key == "high" {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    Text(item.label)
                        .font(.system(size: 10.5, weight: .semibold))
                    Text("\(item.count)")
                        .font(.system(size: 10, design: .monospaced))
                        .opacity(0.85)
                }
                .foregroundColor(item.color)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(item.color.opacity(0.14))
                .cornerRadius(4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Web: `mysqlManagementModal` — 列表 + 创建/同步/重置密码/绑定公网/终止
    private func mysqlSheet(_ t: TenantItem) -> some View {
        let baseHeight: CGFloat = min(560, max(360, CGFloat(model.mysqlRows.count) * 44 + 220))
        return chrome(title: "数据库管理", systemImage: "cylinder", width: 900, height: baseHeight, scrollableContent: false, footer: {
            HStack(spacing: 8) {
                AppButton(title: "创建 MySQL", systemImage: "plus", kind: .primary) {
                    model.createMysql(t)
                }
                .disabled(model.mysqlLoading || model.mysqlBusy)
                AppButton(title: "从云同步", systemImage: "arrow.triangle.2.circlepath", kind: .secondary) {
                    model.syncMysqlCloud(t)
                }
                .disabled(model.mysqlLoading || model.mysqlBusy)
                AppButton(
                    title: "刷新",
                    systemImage: "arrow.clockwise",
                    kind: .secondary,
                    isLoading: model.mysqlLoading
                ) {
                    model.loadMysql(t)
                }
                AppButton(title: "关闭", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
            }
        }) {
            // 仅操作进行中时遮罩；首屏数据加载由表格数据区独立展示（对齐硬盘信息弹窗）
            sheetCenteredLoading(isLoading: model.mysqlBusy) {
                VStack(alignment: .leading, spacing: 12) {
                    mysqlTableBox(tenant: t)
                }
            }
        }
    }

    /// 数据库表格盒高度：贴合内容（空态/加载固定，数据按行数，上限与硬盘弹窗一致）
    private var mysqlTableHeight: CGFloat {
        if model.mysqlLoading || model.mysqlBusy || model.mysqlRows.isEmpty {
            return 198 // 38 header + 160 body
        }
        let rowsH = CGFloat(model.mysqlRows.count) * 44
        return min(398, rowsH + 38)
    }

    /// 数据库管理表格盒：表头恒定固定 + 数据区（加载/空态/超阈值滚动），对齐硬盘信息弹窗
    private func mysqlTableBox(tenant t: TenantItem) -> some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                let totalW = geo.size.width
                // 固定列：版本(64)+状态(72)+连接(130)+用户/密码(120)+规格(90)+存储(56)+操作(168) = 700
                let fixedW: CGFloat = 700
                let wName = max(140, totalW - fixedW)

                VStack(spacing: 0) {
                    // 1. 固定表头（100% 铺满，不随数据滚动）
                    mysqlTableHeader(wName: wName)

                    // 2. 数据区：加载 / 空态 / 滚动行
                    if model.mysqlLoading {
                        VStack(spacing: 8) {
                            Spacer()
                            ProgressView().scaleEffect(0.8)
                            Text("加载中…")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
                    } else if model.mysqlRows.isEmpty {
                        VStack(spacing: 8) {
                            Spacer()
                            Image(systemName: "cylinder")
                                .font(.system(size: 32))
                                .foregroundColor(mutedText.opacity(0.6))
                            Text("暂无数据库实例")
                                .font(.system(size: 13))
                                .foregroundColor(primaryText)
                            Text("可点击上方「创建 MySQL」或「从云同步」")
                                .font(.system(size: 11.5))
                                .foregroundColor(mutedText)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
                    } else {
                        let totalRowsH = CGFloat(model.mysqlRows.count) * 44
                        if totalRowsH > 360 {
                            ScrollView([.vertical], showsIndicators: true) {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(model.mysqlRows.enumerated()), id: \.element.id) { idx, row in
                                        mysqlRow(index: idx, row: row, tenant: t, wName: wName)
                                    }
                                }
                            }
                            .frame(height: 360)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(Array(model.mysqlRows.enumerated()), id: \.element.id) { idx, row in
                                    mysqlRow(index: idx, row: row, tenant: t, wName: wName)
                                }
                            }
                        }
                    }
                }
            }
            .frame(height: mysqlTableHeight)
        }
        .frame(maxWidth: .infinity)
        .background(AppSheetSurface.surface(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppSheetSurface.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    /// 数据库表格表头（列宽与数据行严格一致）
    private func mysqlTableHeader(wName: CGFloat) -> some View {
        HStack(spacing: 0) {
            volumeHeaderCell("名称", width: wName, align: .center)
            volumeHeaderCell("版本", width: 64, align: .center)
            volumeHeaderCell("状态", width: 72, align: .center)
            volumeHeaderCell("连接", width: 130, align: .center)
            volumeHeaderCell("用户/密码", width: 120, align: .center)
            volumeHeaderCell("规格", width: 90, align: .center)
            volumeHeaderCell("存储", width: 56, align: .center)
            volumeHeaderCell("操作", width: 168, align: .center, isLast: true)
        }
        .padding(.vertical, 10)
        .background(AppSheetSurface.panelBg(dark))
        .overlay(
            Rectangle().fill(AppSheetSurface.border(dark)).frame(height: 1),
            alignment: .bottom
        )
    }

    /// 数据库管理单行
    private func mysqlRow(index idx: Int, row: TenantMysqlInstance, tenant t: TenantItem, wName: CGFloat) -> some View {
        HStack(spacing: 0) {
            Button(action: { model.copyMysqlOcid(row) }) {
                Text(row.displayName.isEmpty ? "未命名" : row.displayName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.sidebarActive)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .help("点击复制 OCID")
            }
            .buttonStyle(PlainButtonStyle())
            .frame(width: wName, alignment: .center)
            .padding(.horizontal, 10)

            tableCell(row.dbVersion.isEmpty ? "—" : row.dbVersion, width: 64)
            tableCell(row.dbStatus.isEmpty ? "—" : row.dbStatus, width: 72)
            tableCell(row.connectDisplay, width: 130, muted: true)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.loginUserDisplay)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                Button(action: { model.toggleMysqlPasswordReveal(row.id) }) {
                    Text(mysqlPasswordLabel(row))
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(mutedText)
                        .lineLimit(1)
                }
                .buttonStyle(PlainButtonStyle())
                .help("点击显示/隐藏密码")
            }
            .frame(width: 120, alignment: .center)
            .padding(.horizontal, 10)

            tableCell(row.shape.isEmpty ? "—" : row.shape, width: 90)
            tableCell(row.dataStorageSizeInGBs.isEmpty ? "—" : row.dataStorageSizeInGBs, width: 56)

            HStack(spacing: 4) {
                AppButton(title: "同步", kind: .secondary) {
                    model.syncSingleMysql(row, tenant: t)
                }
                Menu {
                    Button("重置密码") { model.resetMysqlAuth(row, tenant: t) }
                    Button("绑定公网 IP") { model.bindMysqlPublicIp(row, tenant: t) }
                    Divider()
                    Button("终止删除") { model.deleteMysql(row, tenant: t) }
                } label: {
                    Text("更多")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(primaryText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(panelBg)
                        .cornerRadius(6)
                }
                .menuStyle(BorderlessButtonMenuStyle())
            }
            .frame(width: 168, alignment: .center)
            .padding(.horizontal, 4)
        }
        .padding(.vertical, 8)
        .background(idx % 2 == 1 ? AppSheetSurface.panelBg(dark).opacity(0.5) : Color.clear)
        .overlay(
            Rectangle()
                .fill(AppSheetSurface.border(dark).opacity(0.7))
                .frame(height: 1),
            alignment: .bottom
        )
    }

    private func mysqlPasswordLabel(_ row: TenantMysqlInstance) -> String {
        let pwd = row.dbPassword
        if pwd.isEmpty { return "—" }
        if model.mysqlRevealedPasswordIds.contains(row.id) { return pwd }
        return String(repeating: "•", count: min(8, max(4, pwd.count)))
    }

    /// 弹层内容区居中原生 ProgressView（Web modal 内 loading 对齐；不依赖窗口级 LoadingHUD）。
    @ViewBuilder
    private func sheetCenteredLoading<Content: View>(
        isLoading: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack {
            content()
                .opacity(isLoading ? 0.28 : 1)
                .allowsHitTesting(!isLoading)
                .animation(.easeOut(duration: 0.15), value: isLoading)

            if isLoading {
                VStack(spacing: 0) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                        .scaleEffect(1.25)
                }
                .frame(maxWidth: .infinity, minHeight: 240)
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.15), value: isLoading)
    }

    /// 区域订阅弹窗 — 严格对齐 Web 端区域订阅模态弹窗
    private func regionSubSheet(_ t: TenantItem) -> some View {
        let subCount = model.regionSubscribedCount
        let total = model.regionTotalCount
        let subtitle = "\(t.displayName) · 已订阅 \(subCount) / \(total)"

        return chrome(
            title: "区域订阅",
            subtitle: subtitle,
            systemImage: "globe",
            iconColor: AppTheme.cyan,
            width: 740,
            height: 590,
            scrollableContent: false,
            footer: {
                HStack {
                    AppButton(title: "刷新", systemImage: "arrow.clockwise", kind: .secondary) {
                        Task { await model.refreshRegionSub(t) }
                    }
                    Spacer()
                    AppButton(title: "关闭", kind: .secondary) {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        ) {
            VStack(spacing: 12) {
                // 1. 顶部三项统计卡片
                HStack(spacing: 10) {
                    // 全部区域
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.regionSubLoading ? "—" : "\(model.regionTotalCount)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(primaryText)
                        Text("全部区域")
                            .font(.system(size: 11))
                            .foregroundColor(mutedText)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(panelBg.opacity(0.6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.7), lineWidth: 1))
                    .cornerRadius(6)

                    // 已订阅（高亮绿底+绿字）
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.regionSubLoading ? "—" : "\(model.regionSubscribedCount)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(AppTheme.sidebarActive)
                        Text("已订阅")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.sidebarActive)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.sidebarActive.opacity(dark ? 0.15 : 0.10))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.sidebarActive.opacity(0.35), lineWidth: 1))
                    .cornerRadius(6)

                    // 未订阅
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.regionSubLoading ? "—" : "\(model.regionUnsubscribedCount)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(primaryText)
                        Text("未订阅")
                            .font(.system(size: 11))
                            .foregroundColor(mutedText)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(panelBg.opacity(0.6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.7), lineWidth: 1))
                    .cornerRadius(6)
                }

                // 2. 规则提示横幅
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundColor(AppTheme.cyan)
                        .font(.system(size: 13))
                    let homeName = t.regionNameText.isEmpty ? (t.region.isEmpty ? "—" : t.region) : t.regionNameText
                    (Text("主区域为 ")
                        .foregroundColor(AppTheme.cyan)
                    + Text(homeName)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.cyan)
                    + Text(",不可退订。订阅新区域后可在该区域创建实例。")
                        .foregroundColor(AppTheme.cyan))
                        .font(.system(size: 11.5))
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(AppTheme.cyan.opacity(dark ? 0.12 : 0.08))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.cyan.opacity(0.35), lineWidth: 1))
                .cornerRadius(6)

                // 3. 标签页切换栏（下划线风格）
                HStack(spacing: 16) {
                    // 已订阅 Tab
                    Button(action: { model.regionSubTab = 0 }) {
                        let active = model.regionSubTab == 0
                        VStack(spacing: 6) {
                            HStack(spacing: 6) {
                                Text("已订阅")
                                    .font(.system(size: 13, weight: active ? .semibold : .regular))
                                    .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
                                Text("\(model.regionSubscribedCount)")
                                    .font(.system(size: 10.5, weight: active ? .bold : .medium))
                                    .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1.5)
                                    .background(active ? AppTheme.sidebarActive.opacity(0.12) : (dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)))
                                    .cornerRadius(10)
                            }
                            .padding(.horizontal, 4)
                            Rectangle()
                                .fill(active ? AppTheme.sidebarActive : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(PlainButtonStyle())

                    // 未订阅 Tab
                    Button(action: { model.regionSubTab = 1 }) {
                        let active = model.regionSubTab == 1
                        VStack(spacing: 6) {
                            HStack(spacing: 6) {
                                Text("未订阅")
                                    .font(.system(size: 13, weight: active ? .semibold : .regular))
                                    .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
                                Text("\(model.regionUnsubscribedCount)")
                                    .font(.system(size: 10.5, weight: active ? .bold : .medium))
                                    .foregroundColor(active ? AppTheme.sidebarActive : mutedText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1.5)
                                    .background(active ? AppTheme.sidebarActive.opacity(0.12) : (dark ? Color.white.opacity(0.08) : Color.black.opacity(0.05)))
                                    .cornerRadius(10)
                            }
                            .padding(.horizontal, 4)
                            Rectangle()
                                .fill(active ? AppTheme.sidebarActive : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(PlainButtonStyle())

                    Spacer()
                }
                .overlay(Rectangle().fill(border.opacity(0.4)).frame(height: 1), alignment: .bottom)

                // 4. 标签页内容
                if model.regionSubTab == 0 {
                    regionSubscribedTable(t)
                } else {
                    regionUnsubscribedList(t)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 6)
        }
    }

    private func regionSubscribedTable(_ t: TenantItem) -> some View {
        VStack(spacing: 0) {
            // 表头
            HStack(spacing: 0) {
                Text("区域名称")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 14)
                Text("区域标识")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(mutedText)
                    .frame(width: 170, alignment: .leading)
                Text("主区域")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(mutedText)
                    .frame(width: 80, alignment: .center)
                Text("状态")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(mutedText)
                    .frame(width: 90, alignment: .center)
                    .padding(.trailing, 14)
            }
            .padding(.vertical, 9)
            .background(dark ? Color.white.opacity(0.05) : Color.black.opacity(0.03))
            .overlay(Rectangle().fill(border.opacity(0.6)).frame(height: 1), alignment: .bottom)

            // 数据区
            if model.regionSubLoading && model.subscribedRegions.isEmpty {
                VStack(spacing: 8) {
                    ProgressView().scaleEffect(0.8)
                    Text("加载区域订阅…").font(.system(size: 12)).foregroundColor(mutedText)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 200)
            } else if model.subscribedRegions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "globe")
                        .font(.system(size: 28))
                        .foregroundColor(mutedText.opacity(0.5))
                    Text("暂无已订阅区域").font(.system(size: 12.5)).foregroundColor(mutedText)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(model.subscribedRegions.enumerated()), id: \.element.id) { idx, r in
                            let flag = RegionFlag.emoji(code: r.regionKey, name: r.regionName)
                            let cn = RegionCnName.table[r.regionKey] ?? (r.regionName.isEmpty ? r.regionKey : r.regionName)
                            let isHome = r.isHomeRegion || r.regionKey == t.region

                            HStack(spacing: 0) {
                                // 区域名称 (国旗 + 中文名)
                                HStack(spacing: 6) {
                                    Text(flag).font(.system(size: 13))
                                    Text(cn).font(.system(size: 12, weight: .medium)).foregroundColor(primaryText)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.leading, 14)

                                // 区域标识 (mono 绿字)
                                Text(r.regionKey)
                                    .font(.system(size: 11.5, weight: .regular, design: .monospaced))
                                    .foregroundColor(AppTheme.sidebarActive)
                                    .frame(width: 170, alignment: .leading)

                                // 主区域
                                Group {
                                    if isHome {
                                        Text("主区域")
                                            .font(.system(size: 10.5, weight: .semibold))
                                            .foregroundColor(AppTheme.sidebarActive)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2.5)
                                            .background(AppTheme.sidebarActive.opacity(0.12))
                                            .cornerRadius(10)
                                    } else {
                                        Text("—").font(.system(size: 12)).foregroundColor(mutedText)
                                    }
                                }
                                .frame(width: 80, alignment: .center)

                                // 状态
                                Group {
                                    let st = r.status.uppercased()
                                    if st == "READY" || st == "已就绪" {
                                        Text("已就绪")
                                            .font(.system(size: 10.5, weight: .semibold))
                                            .foregroundColor(AppTheme.sidebarActive)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2.5)
                                            .background(AppTheme.sidebarActive.opacity(0.12))
                                            .cornerRadius(4)
                                    } else if st == "PENDING" || st == "订阅中" {
                                        Text("订阅中")
                                            .font(.system(size: 10.5, weight: .semibold))
                                            .foregroundColor(AppTheme.orange)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2.5)
                                            .background(AppTheme.orange.opacity(0.12))
                                            .cornerRadius(4)
                                    } else {
                                        Text(r.status.isEmpty ? "—" : r.status)
                                            .font(.system(size: 10.5, weight: .semibold))
                                            .foregroundColor(AppTheme.danger)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 2.5)
                                            .background(AppTheme.danger.opacity(0.12))
                                            .cornerRadius(4)
                                    }
                                }
                                .frame(width: 90, alignment: .center)
                                .padding(.trailing, 14)
                            }
                            .padding(.vertical, 9)
                            .background(idx % 2 == 1 ? (dark ? Color.white.opacity(0.02) : Color.black.opacity(0.015)) : Color.clear)
                            .overlay(Rectangle().fill(border.opacity(0.3)).frame(height: 1), alignment: .bottom)
                        }
                    }
                }
                .frame(maxHeight: 280)
            }
        }
        .background(panelBg.opacity(0.4))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.6), lineWidth: 1))
        .cornerRadius(6)
    }

    private func regionUnsubscribedList(_ t: TenantItem) -> some View {
        let allKeys = Set(model.unsubscribedRegions.map { $0.key })
        let allSelected = !allKeys.isEmpty && model.selectedUnsubKeys == allKeys

        return VStack(spacing: 8) {
            // 顶部操作栏（全选 + 已选项 + 批量订阅按钮）
            HStack {
                Button(action: {
                    model.selectedUnsubKeys = allSelected ? [] : allKeys
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: allSelected ? "checkmark.square.fill" : (model.selectedUnsubKeys.isEmpty ? "square" : "minus.square.fill"))
                            .foregroundColor(AppTheme.sidebarActive)
                            .font(.system(size: 13))
                        Text("全选（共 \(model.unsubscribedRegions.count) 个区域）")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(primaryText)
                    }
                }
                .buttonStyle(PlainButtonStyle())

                Spacer()

                if !model.selectedUnsubKeys.isEmpty {
                    Text("已选 \(model.selectedUnsubKeys.count) 项")
                        .font(.system(size: 11.5))
                        .foregroundColor(mutedText)
                }

                AppButton(
                    title: model.selectedUnsubKeys.isEmpty ? "订阅所选" : "订阅所选 (\(model.selectedUnsubKeys.count))",
                    kind: .primary
                ) {
                    model.subscribeSelected(t)
                }
                .disabled(model.selectedUnsubKeys.isEmpty)
                .opacity(model.selectedUnsubKeys.isEmpty ? 0.5 : 1.0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(dark ? Color.white.opacity(0.04) : Color.black.opacity(0.02))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.6), lineWidth: 1))
            .cornerRadius(6)

            // 未订阅列表
            if model.regionSubLoading && model.unsubscribedRegions.isEmpty {
                VStack(spacing: 8) {
                    ProgressView().scaleEffect(0.8)
                    Text("加载可订阅区域…").font(.system(size: 12)).foregroundColor(mutedText)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 200)
            } else if model.unsubscribedRegions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 28))
                        .foregroundColor(AppTheme.sidebarActive)
                    Text("已订阅全部区域").font(.system(size: 12.5, weight: .medium)).foregroundColor(primaryText)
                    Text("当前租户已订阅所有可用区域").font(.system(size: 11)).foregroundColor(mutedText)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(model.unsubscribedRegions.enumerated()), id: \.element.id) { idx, r in
                            let isSelected = model.selectedUnsubKeys.contains(r.key)
                            let flag = RegionFlag.emoji(code: r.key, name: r.cnName.isEmpty ? r.name : r.cnName)
                            let cn = r.cnName.isEmpty ? r.name : r.cnName

                            HStack(spacing: 10) {
                                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                                    .foregroundColor(AppTheme.sidebarActive)
                                    .font(.system(size: 13))

                                Text(flag).font(.system(size: 13))

                                Text(cn)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(primaryText)

                                Text(r.key)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundColor(mutedText)

                                Spacer()

                                AppButton(title: "+ 订阅", kind: .primary) {
                                    model.subscribeRegions(item: t, keys: [r.key])
                                }
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(isSelected ? AppTheme.sidebarActive.opacity(0.08) : (idx % 2 == 1 ? (dark ? Color.white.opacity(0.02) : Color.black.opacity(0.015)) : Color.clear))
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.toggleUnsubKey(r.key)
                            }
                            .overlay(Rectangle().fill(border.opacity(0.3)).frame(height: 1), alignment: .bottom)
                        }
                    }
                }
                .frame(maxHeight: 250)
                .background(panelBg.opacity(0.4))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(border.opacity(0.6), lineWidth: 1))
                .cornerRadius(6)
            }
        }
    }

    private func aiChatSheet(_ t: TenantItem) -> some View {
        chrome(title: "OCI AI — \(t.displayName)", width: 640, height: 580, footer: {
            AppButton(title: "关闭", kind: .secondary) {
                model.closeAIChat()
                presentationMode.wrappedValue.dismiss()
            }
        }) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(model.aiStatus)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(mutedText)
                    Spacer()
                    Toggle("上下文", isOn: $model.aiUseHistory)
                        .foregroundColor(primaryText)
                }
                if !model.aiModels.isEmpty {
                    SelectMenu(
                        options: model.aiModels.map {
                            SelectOption(id: $0.id, title: "\($0.displayName) (\($0.version.isEmpty ? "latest" : $0.version))")
                        },
                        selection: Binding(
                            get: { model.aiSelectedModelId.isEmpty ? nil : model.aiSelectedModelId },
                            set: {
                                model.aiSelectedModelId = $0 ?? ""
                                model.connectAIChat(tenantId: t.id)
                            }
                        ),
                        placeholder: "选择模型", width: 320, allowClear: false
                    )
                }
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.aiLines) { line in
                            HStack(alignment: .top) {
                                if line.role == "user" { Spacer(minLength: 40) }
                                Text(line.text)
                                    .font(.system(size: 12))
                                    .foregroundColor(primaryText)
                                    .padding(10)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10)
                                            .fill(line.role == "user"
                                                  ? AppTheme.sidebarActive.opacity(0.22)
                                                  : AppSheetSurface.panelBg(dark))
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(AppTheme.border(dark).opacity(0.45), lineWidth: 1)
                                    )
                                if line.role != "user" { Spacer(minLength: 40) }
                            }
                        }
                    }
                }
                .frame(minHeight: 280)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(AppSheetSurface.rowHover(dark).opacity(0.5))
                )

                HStack(spacing: 8) {
                    AppTextField(text: $model.aiInput, placeholder: "输入消息…", onCommit: { model.sendAIMessage() })
                    AppButton(title: "发送", kind: .primary) { model.sendAIMessage() }
                }
            }
        }
    }

    private func passwordResult(title: String, user: String, pwd: String) -> some View {
        chrome(title: title, width: 420, height: 260, footer: {
            AppButton(title: "关闭", kind: .primary) { presentationMode.wrappedValue.dismiss() }
        }) {
            VStack(alignment: .leading, spacing: 12) {
                formPanel {
                    VStack(alignment: .leading, spacing: 0) {
                        kv("用户名", user)
                        kv("临时密码", pwd.isEmpty ? "（见服务端返回）" : pwd)
                    }
                }
                if !pwd.isEmpty {
                    AppButton(title: "复制密码", kind: .secondary) {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(pwd, forType: .string)
                    }
                }
            }
        }
    }

    // MARK: - Helpers（对齐 Web form-group / table cell）

    private var keyFileRow: some View {
        HStack(spacing: 10) {
            Text(model.addKeyFileURL?.lastPathComponent ?? "未选择私钥文件")
                .font(.system(size: 13))
                .foregroundColor(model.addKeyFileURL == nil ? mutedText : primaryText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .frame(height: 36)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(dark ? Color(hex: "161820") : Color.white)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(border, lineWidth: 1)
                )
            AppButton(title: "选择文件…", kind: .secondary) { model.pickKeyFile() }
        }
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel(title)
            AppTextField(text: text, placeholder: title)
        }
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(mutedText)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(primaryText)
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundColor(mutedText)
    }

    private func emptyHint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundColor(mutedText)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 28)
            .background(panelBg)
            .cornerRadius(4)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
            Text(text).font(.system(size: 12, weight: .medium))
        }
        .foregroundColor(AppSheetSurface.accentRed(dark))
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppSheetSurface.accentRed(dark).opacity(0.12))
        .cornerRadius(4)
    }

    /// Web `.edit-rule-form` / form 面板
    private func formPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(panelBg)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(border.opacity(0.8), lineWidth: 1)
            )
            .cornerRadius(4)
    }

    private func listRow<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(panelBg.opacity(0.55))
            .overlay(
                Rectangle()
                    .fill(border.opacity(0.7))
                    .frame(height: 1),
                alignment: .bottom
            )
    }

    private func tableCell(_ text: String, width: CGFloat?, bold: Bool = false, muted: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 12, weight: bold ? .semibold : .regular))
            .foregroundColor(muted ? mutedText : primaryText)
            .lineLimit(2)
            .frame(width: width, alignment: .center)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .padding(.horizontal, 10)
    }

    private func kv(_ k: String, _ v: String) -> some View {
        AppDetailRow(label: k, value: v)
    }

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(primaryText)
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(mutedText)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(panelBg)
        .cornerRadius(4)
    }

    // MARK: - 护盾快捷配置代理

    private func proxyQuickSheet(_ t: TenantItem) -> some View {
        chrome(
            title: "快速配置代理 · \(t.displayName)",
            systemImage: "shield.fill",
            width: 540,
            height: 520,
            footer: {
                HStack {
                    Spacer()
                    AppButton(title: "取消", kind: .secondary) {
                        presentationMode.wrappedValue.dismiss()
                    }
                    AppButton(
                        title: model.proxyQuickCreateMode ? "新建并绑定" : "保存绑定",
                        systemImage: "square.and.arrow.down",
                        kind: .primary,
                        isLoading: model.proxyQuickSaving
                    ) {
                        model.saveProxyQuick()
                    }
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text("选择已有代理，或直接新建并绑定到该租户（其它租户也可共用）。")
                    .font(.system(size: 12))
                    .foregroundColor(mutedText)

                // 模式切换
                HStack(spacing: 8) {
                    proxyModeChip(title: "选择已有", active: !model.proxyQuickCreateMode) {
                        model.proxyQuickCreateMode = false
                    }
                    proxyModeChip(title: "新建并绑定", active: model.proxyQuickCreateMode) {
                        model.proxyQuickCreateMode = true
                        if model.proxyQuickForm.tenantIds.isEmpty {
                            model.proxyQuickForm.tenantIds = [t.id]
                        }
                    }
                }

                if model.proxyQuickCreateMode {
                    proxyQuickCreateForm
                } else if model.proxyQuickLoading {
                    HStack {
                        Spacer()
                        ProgressView().scaleEffect(0.85)
                        Text("加载中…")
                            .font(.system(size: 12))
                            .foregroundColor(mutedText)
                        Spacer()
                    }
                    .padding(.vertical, 40)
                } else {
                    ScrollView {
                        VStack(spacing: 4) {
                            proxyQuickRow(
                                title: "不使用专属代理（走全局池）",
                                meta: "全局共享",
                                selected: model.proxyQuickSelectedId == nil
                            ) {
                                model.proxyQuickSelectedId = nil
                            }
                            if model.proxyQuickItems.isEmpty {
                                Text("暂无代理，可切换到「新建并绑定」")
                                    .font(.system(size: 12))
                                    .foregroundColor(mutedText)
                                    .padding(.vertical, 20)
                                    .frame(maxWidth: .infinity)
                            } else {
                                ForEach(model.proxyQuickItems) { p in
                                    proxyQuickRow(
                                        title: p.displayName,
                                        meta: proxyQuickMeta(p),
                                        selected: model.proxyQuickSelectedId == p.id
                                    ) {
                                        model.proxyQuickSelectedId = p.id
                                    }
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(panelBg)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(border, lineWidth: 1)
                    )
                }
            }
        }
    }

    private func proxyModeChip(title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(active ? Color.white : primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(active ? AppTheme.sidebarActive : panelBg)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(active ? AppTheme.sidebarActive : border, lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var proxyQuickCreateForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                FormFieldRow(label: "自定义名称") {
                    AppTextField(
                        text: Binding(
                            get: { model.proxyQuickForm.customName },
                            set: { model.proxyQuickForm.customName = $0 }
                        ),
                        placeholder: "可选，仅展示",
                        leadingSystemImage: "tag"
                    )
                }
                HStack(spacing: 10) {
                    FormFieldRow(label: "代理类型", required: true) {
                        SelectMenu(
                            options: [
                                SelectOption(id: "HTTP", title: "HTTP"),
                                SelectOption(id: "HTTPS", title: "HTTPS"),
                                SelectOption(id: "SOCKS5", title: "SOCKS5")
                            ],
                            selection: Binding(
                                get: { model.proxyQuickForm.proxyType.uppercased() },
                                set: { model.proxyQuickForm.proxyType = $0 ?? "HTTP" }
                            ),
                            placeholder: "类型",
                            width: 140,
                            allowClear: false,
                            searchable: false
                        )
                    }
                    FormFieldRow(label: "强制代理") {
                        SelectMenu(
                            options: [
                                SelectOption(id: "0", title: "非强制"),
                                SelectOption(id: "1", title: "强制")
                            ],
                            selection: Binding(
                                get: { "\(model.proxyQuickForm.forceProxy)" as String? },
                                set: { model.proxyQuickForm.forceProxy = ($0 == "1") ? 1 : 0 }
                            ),
                            placeholder: "强制",
                            width: 140,
                            allowClear: false,
                            searchable: false
                        )
                    }
                }
                HStack(spacing: 10) {
                    FormFieldRow(label: "代理地址", required: true) {
                        AppTextField(
                            text: Binding(
                                get: { model.proxyQuickForm.proxyHost },
                                set: { model.proxyQuickForm.proxyHost = $0 }
                            ),
                            placeholder: "127.0.0.1",
                            leadingSystemImage: "globe"
                        )
                    }
                    FormFieldRow(label: "端口", required: true) {
                        AppTextField(
                            text: Binding(
                                get: { model.proxyQuickForm.proxyPort },
                                set: { model.proxyQuickForm.proxyPort = $0.filter { $0.isNumber } }
                            ),
                            placeholder: "8080",
                            leadingSystemImage: "number"
                        )
                    }
                }
                HStack(spacing: 10) {
                    FormFieldRow(label: "用户名") {
                        AppTextField(
                            text: Binding(
                                get: { model.proxyQuickForm.proxyUsername },
                                set: { model.proxyQuickForm.proxyUsername = $0 }
                            ),
                            placeholder: "可选",
                            leadingSystemImage: "person"
                        )
                    }
                    FormFieldRow(label: "密码") {
                        AppTextField(
                            text: Binding(
                                get: { model.proxyQuickForm.proxyPassword },
                                set: { model.proxyQuickForm.proxyPassword = $0 }
                            ),
                            placeholder: "可选",
                            secure: true,
                            leadingSystemImage: "key"
                        )
                    }
                }
            }
            .padding(4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func proxyQuickRow(title: String, meta: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Circle()
                    .strokeBorder(selected ? AppTheme.sidebarActive : border, lineWidth: 1.5)
                    .background(Circle().fill(selected ? AppTheme.sidebarActive : Color.clear))
                    .frame(width: 12, height: 12)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(primaryText)
                        .lineLimit(1)
                    Text(meta)
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                        .lineLimit(2)
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(selected ? AppTheme.sidebarActive.opacity(0.12) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }

    private func proxyQuickMeta(_ p: VpnProxyItem) -> String {
        [
            "\(p.proxyType) · \(p.proxyHost):\(p.proxyPort)",
            p.isForce ? "强制" : "非强制",
            p.isEnabled ? "通畅" : "不通",
            p.tenantLabel
        ].joined(separator: " · ")
    }
}

// MARK: - 用户操作菜单按钮（严格对齐全站 UI_STANDARD.md 第二章 Action Menu 标准）
struct UserActionMoreButton: NSViewRepresentable {
    let dark: Bool
    let username: String
    let isActive: Bool
    let appearance: AppearanceController
    let onResetPassword: () -> Void
    let onDelete: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            username: username,
            isActive: isActive,
            appearance: appearance,
            dark: dark,
            onResetPassword: onResetPassword,
            onDelete: onDelete
        )
    }

    func makeNSView(context: Context) -> NSButton {
        let b = NSButton(frame: NSRect(x: 0, y: 0, width: 28, height: 28))
        b.bezelStyle = .shadowlessSquare
        b.isBordered = false
        b.title = ""
        b.image = NSImage(systemSymbolName: "ellipsis", accessibilityDescription: "更多操作")
        b.imagePosition = .imageOnly
        b.imageScaling = .scaleProportionallyDown
        b.contentTintColor = dark
            ? NSColor.white.withAlphaComponent(0.9)
            : NSColor.labelColor
        b.wantsLayer = true
        if let layer = b.layer {
            layer.cornerRadius = 4
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            layer.borderWidth = 1
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
        b.target = context.coordinator
        b.action = #selector(Coordinator.clicked(_:))
        b.setButtonType(.momentaryChange)
        b.toolTip = "更多操作"
        return b
    }

    func updateNSView(_ nsView: NSButton, context: Context) {
        context.coordinator.username = username
        context.coordinator.isActive = isActive
        context.coordinator.appearance = appearance
        context.coordinator.dark = dark
        context.coordinator.onResetPassword = onResetPassword
        context.coordinator.onDelete = onDelete
        nsView.contentTintColor = dark
            ? NSColor.white.withAlphaComponent(0.9)
            : NSColor.labelColor
        if let layer = nsView.layer {
            layer.backgroundColor = (dark
                ? NSColor(calibratedRed: 0.17, green: 0.19, blue: 0.21, alpha: 1)
                : NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)).cgColor
            layer.borderColor = (dark
                ? NSColor.white.withAlphaComponent(0.12)
                : NSColor.black.withAlphaComponent(0.08)).cgColor
        }
    }

    final class Coordinator: NSObject {
        var username: String
        var isActive: Bool
        var appearance: AppearanceController
        var dark: Bool
        var onResetPassword: () -> Void
        var onDelete: () -> Void

        init(
            username: String,
            isActive: Bool,
            appearance: AppearanceController,
            dark: Bool,
            onResetPassword: @escaping () -> Void,
            onDelete: @escaping () -> Void
        ) {
            self.username = username
            self.isActive = isActive
            self.appearance = appearance
            self.dark = dark
            self.onResetPassword = onResetPassword
            self.onDelete = onDelete
        }

        @objc func clicked(_ sender: NSButton) {
            let uName = username
            let act = isActive
            let d = dark
            let ap = appearance
            let resetCb = onResetPassword
            let deleteCb = onDelete

            guard sender.window != nil else { return }

            let actions = [
                TenantActionItem(id: "reset", title: "重置密码", systemImage: "key", isDanger: false, tone: .default) {
                    resetCb()
                },
                TenantActionItem(id: "delete", title: "删除用户", systemImage: "trash", isDanger: true, tone: .danger) {
                    deleteCb()
                }
            ]

            DispatchQueue.main.async {
                TenantActionMenuPresenter.shared.present(
                    from: sender,
                    title: uName,
                    isActive: act,
                    dark: d,
                    appearance: ap,
                    actions: actions
                )
            }
        }
    }
}

// MARK: - 引导卷性能 VPU 圆环进度组件
struct VpuCircleRing: View {
    let vpu: Int64
    var dark: Bool = true

    private var progress: Double {
        min(1.0, max(0.0, Double(vpu) / 120.0))
    }

    var body: some View {
        HStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(dark ? Color(white: 0.22) : Color(white: 0.85), lineWidth: 3)
                Circle()
                    .trim(from: 0, to: CGFloat(progress))
                    .stroke(
                        AppTheme.cyan,
                        style: StrokeStyle(lineWidth: 3, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                Text("\(vpu)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(AppTheme.cyan)
            }
            .frame(width: 28, height: 28)

            Text("VPU")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(dark ? Color(hex: "8d9398") : Color(hex: "768390"))
        }
    }
}


