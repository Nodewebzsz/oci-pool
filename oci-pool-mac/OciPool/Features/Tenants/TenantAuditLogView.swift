import SwiftUI

/// 租户审计日志整页 — 对应 Web `auditLogModal`，从租户列表进入，非弹框。
/// 列：# / 用户名 / 来源 IP / 事件 / 环境 / 事件时间 / 响应
/// 分页：OCI token 游标 → 「加载更多」追加模式。
/// 依据 `UI_STANDARD.md` 第四章 4.3/4.4：游标接口不得出现页码条 / 跳页框 / 「共 N 条」。
struct TenantAuditLogView: View {
    @ObservedObject var model: TenantsViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }
    private var tenant: TenantItem? { model.auditParent }

    // C1：序号列 36（最多 4 位数，36 足够，且不换行不截断）
    private let wIndex: CGFloat = 36
    private let wUser: CGFloat = 110
    // 响应列改为「语义徽章 + 原始码」两段式
    private let wStatus: CGFloat = 118
    // 环境列：仅需容纳「控制台 / API」短徽章，严格固定为 76px 紧凑居中，绝不随屏宽放大浪费空间
    private let wEnv: CGFloat = 76
    // 事件时间列：严格固定为 160px，彻底保证 yyyy-MM-dd HH:mm:ss（19字符）不截断完整展示
    private let wTime: CGFloat = 160
    private let minIP: CGFloat = 120
    private let minEvent: CGFloat = 140
    private let hPad: CGFloat = 12

    /// 快捷区间（对齐原项目 `mobile/audit_log.ftl` 的近1/3/7/30 天）
    private static let quickRanges: [(days: Int, title: String)] = [
        (1, "近1天"), (3, "近3天"), (7, "近7天"), (30, "近30天")
    ]

    var body: some View {
        let regionCn = tenant.map { t -> String in
            let reg = t.regionNameText.isEmpty ? (t.region.isEmpty ? "—" : t.region) : t.regionNameText
            return "\(t.displayName) · \(reg)"
        }

        return PageScaffold(
            title: "审计日志",
            subtitle: regionCn,
            systemImage: "doc.text",
            parentTitle: "租户管理",
            onParentClick: {
                model.closeAudit()
            },
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    filterBar
                    if model.auditMock {
                        mockBanner
                    }
                    if let err = model.auditError, !err.isEmpty {
                        errorBanner(err)
                    }
                    listBody
                    if shouldShowFooter {
                        footBar
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }

    /// 底部条：只要有已加载数据就展示统计；「加载更多」仅在确实还有下一页时出现
    private var shouldShowFooter: Bool {
        !model.auditPageItems.isEmpty
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(title: "返回列表", systemImage: "chevron.left", kind: .secondary) {
                model.closeAudit()
            }
            AppButton(title: "刷新", systemImage: "arrow.clockwise", kind: .secondary) {
                model.reloadAudit()
            }
            if model.auditLoading {
                ProgressView().scaleEffect(0.7)
            }
        }
    }

    // MARK: - Filter

    private var filterBar: some View {
        FilterBar(
            leading: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        ForEach(Self.quickRanges, id: \.days) { range in
                            rangeChip(range.days, range.title)
                        }
                        customChip
                    }
                    HStack(spacing: 8) {
                        Text("开始")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarText(dark))
                        AuditDateInputField(text: $model.auditStart, dark: dark)
                        Text("结束")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarText(dark))
                        AuditDateInputField(text: $model.auditEnd, dark: dark)
                        Text("最多查询近 90 天")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarText(dark).opacity(0.85))
                    }
                }
            },
            trailing: {
                AppButton(title: "查询", systemImage: "magnifyingglass", kind: .primary) {
                    guard let t = tenant else { return }
                    model.searchAudit(t)
                }
            }
        )
    }

    /// 快捷区间 chip：点击即填充日期并发起查询
    private func rangeChip(_ days: Int, _ title: String) -> some View {
        let active = model.isAuditQuickRangeActive(days)
        return Button(action: { model.applyAuditQuickRange(days) }) {
            Text(title)
                .font(.system(size: 12, weight: active ? .semibold : .regular))
                .foregroundColor(active ? .white : AppTheme.sidebarText(dark))
                .padding(.horizontal, 11)
                .frame(height: 26)
                .background(Capsule().fill(active ? AppTheme.sidebarActive : Color.clear))
                .overlay(
                    Capsule().stroke(
                        active ? AppTheme.sidebarActive : AppTheme.border(dark),
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(PlainButtonStyle())
        .help("查询最近 \(days) 天（含今天）的审计事件")
    }

    /// 「自定义」状态指示：日期不匹配任何快捷区间时高亮。
    /// 本页日期字段始终可编辑，故这里只作状态显示，不设点击（避免造出无效按钮）。
    private var customChip: some View {
        let active = model.isAuditRangeCustom
        return Text("自定义")
            .font(.system(size: 12, weight: active ? .semibold : .regular))
            .foregroundColor(active ? .white : AppTheme.sidebarText(dark).opacity(0.75))
            .padding(.horizontal, 11)
            .frame(height: 26)
            .background(Capsule().fill(active ? AppTheme.sidebarActive : Color.clear))
            .overlay(
                Capsule().stroke(
                    active ? AppTheme.sidebarActive : AppTheme.border(dark),
                    lineWidth: 1
                )
            )
            .help("手动编辑上方日期即处于自定义区间")
    }

    // MARK: - Banners

    /// 演示数据提示：后端返回 mock=true 时置顶，避免把假数据当真
    private var mockBanner: some View {
        banner(
            icon: "info.circle.fill",
            tint: AppTheme.orange,
            title: "当前显示的是演示数据",
            detail: "MODERN_UI_MOCK_DATA=true · 非真实审计记录，请勿据此判断租户状态"
        )
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
            VStack(alignment: .leading, spacing: 1) {
                Text("查询审计日志失败")
                    .font(.system(size: 12, weight: .semibold))
                Text(text)
                    .font(.system(size: 11))
                    .opacity(0.9)
            }
            Spacer()
            Button("重试") {
                model.reloadAudit()
            }
            .buttonStyle(PlainButtonStyle())
            .font(.system(size: 11, weight: .semibold))
        }
        .foregroundColor(AppTheme.danger)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(AppTheme.danger.opacity(0.1))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.danger.opacity(0.25)),
            alignment: .bottom
        )
    }

    private func banner(icon: String, tint: Color, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                Text(detail)
                    .font(.system(size: 11))
                    .opacity(0.9)
            }
            Spacer()
        }
        .foregroundColor(tint)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(tint.opacity(0.1))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(tint.opacity(0.25)),
            alignment: .bottom
        )
    }

    // MARK: - Table

    @ViewBuilder
    private var listBody: some View {
        if model.auditLoading && model.auditPageItems.isEmpty {
            VStack {
                Spacer()
                ProgressView()
                Text("加载审计日志…")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .padding(.top, 8)
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if model.auditPageItems.isEmpty {
            EmptyStateView(
                icon: "doc.text.magnifyingglass",
                title: "该时间范围内没有审计事件",
                subtitle: "当前区间 \(model.auditStart) ~ \(model.auditEnd)，可放宽时间范围后重试",
                actionTitle: "放宽到近 7 天",
                action: { model.applyAuditQuickRange(7) }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            GeometryReader { geo in
                let baseTotal = wIndex + wUser + minIP + minEvent + wEnv + wTime + wStatus + hPad * 2
                let totalW = max(geo.size.width, baseTotal)
                let flex = max(0, totalW - baseTotal)
                // 弹性分配：环境(76px)与事件时间(160px)保持固定，剩余全部弹性空间由长文本列（来源 IP 与事件）按比例吸收
                let wIP = minIP + flex * 0.55
                let wEvent = minEvent + flex * 0.45

                VStack(spacing: 0) {
                    headerRow(wEvent: wEvent, wIP: wIP, width: totalW)
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(model.auditPageItems.enumerated()), id: \.offset) { idx, log in
                                dataRow(
                                    displayIndex: idx + 1,
                                    log: log,
                                    wEvent: wEvent,
                                    wIP: wIP,
                                    width: totalW
                                )
                            }
                        }
                    }
                }
                .frame(width: totalW, height: geo.size.height, alignment: .topLeading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func headerRow(wEvent: CGFloat, wIP: CGFloat, width: CGFloat) -> some View {
        HStack(spacing: 0) {
            colHeader("#", wIndex)
            colHeader("用户名", wUser)
            colHeader("来源 IP", wIP)
            colHeader("事件", wEvent)
            colHeader("环境", wEnv)
            colHeader("事件时间", wTime)
            colHeader("响应", wStatus)
        }
        .padding(.horizontal, hPad)
        .padding(.vertical, 9)
        .frame(width: width, alignment: .leading)
        .background(AppTheme.sidebarHover(dark).opacity(0.65))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.5)),
            alignment: .bottom
        )
    }

    private func dataRow(
        displayIndex: Int,
        log: TenantAuditLogEntry,
        wEvent: CGFloat,
        wIP: CGFloat,
        width: CGFloat
    ) -> some View {
        let errorTint = AppTheme.danger.opacity(dark ? 0.12 : 0.08)
        let stripe = displayIndex % 2 == 0 ? AppTheme.sidebarHover(dark).opacity(0.18) : Color.clear
        return HStack(spacing: 0) {
            cell("\(displayIndex)", wIndex, muted: true)
            cell(display(log.userName), wUser)
            cell(display(log.ipAddress), wIP, muted: true)
            // 事件列 hover 显示完整类型（com.oraclecloud.XxxApi.Yyy）
            cell(display(log.eventType), wEvent, bold: true, hover: log.eventDetail)
            envCell(log, width: wEnv)
            cell(display(log.eventTime), wTime, muted: true)
            statusCell(log)
                .frame(width: wStatus, alignment: .center)
        }
        .padding(.horizontal, hPad)
        .padding(.vertical, appearance.density.rowPadding)
        .frame(width: width, alignment: .leading)
        .background(log.isError ? errorTint : stripe)
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.3)),
            alignment: .bottom
        )
    }

    /// 环境列：控制台（info 蓝）/ API（violet 紫）/ —（无信号）
    /// 判据是 consoleSessionId 非空，**不是** authType（见 TenantAuditLogEntry.envLabel）
    @ViewBuilder
    private func envCell(_ log: TenantAuditLogEntry, width: CGFloat) -> some View {
        let hasSignal = !log.consoleSessionId.isEmpty || !log.userType.isEmpty || !log.clientEnv.isEmpty
        Group {
            if hasSignal {
                let tint = log.isConsoleSession ? AppTheme.info : AppTheme.violet
                Text(log.envLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(tint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(tint.opacity(0.15))
                    .cornerRadius(10)
            } else {
                Text("—")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
        }
        .lineLimit(1)
        .frame(width: width, alignment: .center)
        .help(log.envDetail)
    }

    /// 响应列：语义徽章（成功 / 失败 / 未知）+ 原始状态码
    private func statusCell(_ log: TenantAuditLogEntry) -> some View {
        let tone: StatusTone = log.isSuccess ? .success : (log.isUnknownStatus ? .warning : .danger)
        let label = log.isSuccess ? "成功" : (log.isUnknownStatus ? "未知" : "失败")
        let codeText = log.responseStatus.isEmpty ? "—" : log.responseStatus
        let codeColor = log.isError ? AppTheme.danger : AppTheme.sidebarText(dark)
        return HStack(spacing: 7) {
            StatusBadge(text: label, tone: tone)
            Text(codeText)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(codeColor)
                .lineLimit(1)
        }
        .help("响应状态：\(label)（原始码 \(codeText)）")
    }

    // MARK: - Footer（游标分页标准形态）

    private var footBar: some View {
        HStack(spacing: 12) {
            Text(model.auditFooterText)
                .font(.system(size: 12))
                .foregroundColor(model.auditReachedLimit ? AppTheme.orange : AppTheme.sidebarText(dark))
            Spacer()
            if model.auditHasMore && !model.auditReachedLimit {
                AppButton(
                    title: "加载更多",
                    systemImage: "chevron.down",
                    kind: .secondary,
                    isLoading: model.auditLoadingMore,
                    enabled: !model.auditLoading
                ) {
                    model.loadMoreAudit()
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(AppTheme.sidebarBg(dark).opacity(0.5))
        .overlay(
            Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.5)),
            alignment: .top
        )
    }

    // MARK: - Cells

    private func display(_ s: String) -> String {
        s.isEmpty ? "—" : s
    }

    private func colHeader(_ title: String, _ w: CGFloat, align: Alignment = .center) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(AppTheme.sidebarText(dark))
            .frame(width: w, alignment: align)
    }

    private func cell(
        _ text: String,
        _ w: CGFloat,
        muted: Bool = false,
        bold: Bool = false,
        hover: String? = nil
    ) -> some View {
        Text(text)
            .font(.system(size: 12, weight: bold ? .semibold : .regular))
            .foregroundColor(
                muted
                    ? AppTheme.sidebarText(dark)
                    : (dark ? Color.white.opacity(0.9) : Color.primary)
            )
            .lineLimit(1)
            .truncationMode(.tail)
            .help(hover ?? text)
            .frame(width: w, alignment: .center)
    }
}

// MARK: - 精准日期输入组件（支持直接键盘输入 + 日历选择）

private struct AuditDateInputField: View {
    @Binding var text: String
    let dark: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark).opacity(0.7))

            TextField("yyyy-MM-dd", text: $text)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                .frame(width: 88)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(dark ? Color(hex: "161820") : Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(4)
    }
}

