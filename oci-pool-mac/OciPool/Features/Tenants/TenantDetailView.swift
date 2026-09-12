import SwiftUI
import AppKit

/// Web 整页「租户详情」— 100% 对齐 Web `page-tenant-detail.jsx`
/// 五段式架构：
/// 1. 面包屑与返回栏（返回租户管理导航）
/// 2. 租户信息卡片（菱形图标、租户名、别名标签、状态、副标题、多区域切换器、脱敏切换、API导入）
/// 3. 区域操作按钮组（实例同步、添加开机、查看开机、硬盘信息、安全规则、资源列表、数据库管理）
/// 4. 核心表格卡片（序号、租户名、自定义名称、开机任务、区域、主区域、实例同步、创建时间）
/// 5. 底部 4 项核心指标卡片（实例总数、运行中、开机任务、本月花费）
struct TenantDetailView: View {
    @ObservedObject var model: TenantsViewModel
    @EnvironmentObject private var appearance: AppearanceController
    @EnvironmentObject private var session: AppSession

    @State private var hoveredRowId: Int64?

    private var dark: Bool { appearance.isDarkEffective }
    private var parent: TenantItem? { model.detailParent }
    private var activeRow: TenantItem? { model.activeRegionRow }

    private var primaryText: Color {
        dark ? Color(hex: "cdd9e5") : Color(hex: "1a202c")
    }
    private var mutedText: Color {
        dark ? Color(hex: "768390") : Color(hex: "64748b")
    }

    private var displayName: String {
        guard let p = parent else { return "租户详情" }
        if model.detailNamesHidden {
            return p.maskedName
        }
        return p.displayName.isEmpty ? p.userName : p.displayName
    }

    var body: some View {
        ScrollView([.vertical], showsIndicators: true) {
            VStack(spacing: 12) {
                // 1. 面包屑与返回栏
                breadcrumbsBar

                // 2. 租户信息卡片
                headerCard

                // 错误横幅（如有）
                if let err = model.detailError, !err.isEmpty {
                    errorBanner(err)
                }

                // 3. 4 项核心指标卡片（移动到区域操作上方）
                metricsGrid

                // 4. 区域操作按钮组卡片（7 项核心操作）
                actionsBar

                // 5. 核心表格卡片
                tableCard
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 20)
        }
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .background(dark ? Color(hex: "13161a") : Color(hex: "f4f6f8"))
        .appLoading(model.detailLoading && model.detailRows.isEmpty)
    }

    // MARK: - 1. 面包屑与返回栏

    private var breadcrumbsBar: some View {
        HStack(spacing: 12) {
            Button(action: { model.closeDetail() }) {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 11, weight: .bold))
                    Text("返回")
                        .font(.system(size: 12))
                }
                .foregroundColor(primaryText)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(AppTheme.sidebarBg(dark))
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(AppTheme.border(dark), lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())

            HStack(spacing: 6) {
                Button(action: { model.closeDetail() }) {
                    Text("租户管理")
                        .font(.system(size: 12))
                        .foregroundColor(mutedText)
                }
                .buttonStyle(PlainButtonStyle())

                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(mutedText.opacity(0.6))

                HStack(spacing: 4) {
                    Text("租户详情")
                        .font(.system(size: 12))
                        .foregroundColor(mutedText)
                    Text("·")
                        .foregroundColor(mutedText)
                    Text(displayName)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(primaryText)
                }
            }

            Spacer()
        }
    }

    // MARK: - 2. 租户信息页头卡片

    private var headerCard: some View {
        HStack(spacing: 16) {
            // 菜单对应租户管理图标（MenuGlyph "users" 与左侧菜单栏 100% 一致）
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(AppTheme.sidebarActive.opacity(0.18))
                    .frame(width: 42, height: 42)
                MenuGlyph(name: "users", size: 22, lineWidth: 2, color: AppTheme.sidebarActive)
            }

            // 标题与副标题信息
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 8) {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            model.detailNamesHidden.toggle()
                        }
                    }) {
                        Text(displayName)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(primaryText)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .help(model.detailNamesHidden ? "点击显示完整名称" : "点击脱敏隐藏名称")

                    // 自定义别名徽章：只有设置了别名且与租户名不同时才展示
                    if let alias = parent?.customAlias, !alias.isEmpty, alias != parent?.displayName {
                        Text(alias)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundColor(primaryText)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(AppTheme.sidebarHover(dark))
                            .cornerRadius(4)
                    }

                    // 状态徽章
                    StatusBadge(
                        text: (parent?.isActive ?? true) ? "有效" : "停用",
                        tone: (parent?.isActive ?? true) ? .success : .danger
                    )
                }

                // 副标题：多区域/单区域 · 账号类型 · 运行天数
                HStack(spacing: 8) {
                    let isMulti = (parent?.isMultiRegion == true || model.detailRows.count > 1)
                    Text(isMulti ? "多区域账号" : "单区域账号")
                    Text("·")
                    let type = (parent?.accountTypeName.isEmpty == false) ? parent!.accountTypeName : "未知"
                    Text(type)
                    Text("·")
                    Text("已运行 \(parent?.activeDaysText ?? "0") 天")
                }
                .font(.system(size: 12))
                .foregroundColor(mutedText)
            }

            Spacer(minLength: 0)

            // 右侧工具组：区域切换器（仅多区域时展示）、脱敏、API 导入
            HStack(spacing: 8) {
                if model.detailRows.count > 1 {
                    regionSwitcherMenu
                }

                // 脱敏眼睛按钮
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        model.detailNamesHidden.toggle()
                    }
                }) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(AppTheme.sidebarBg(dark))
                            .frame(width: 32, height: 32)
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(AppTheme.border(dark), lineWidth: 1)
                            .frame(width: 32, height: 32)
                        Image(systemName: model.detailNamesHidden ? "eye" : "eye.slash")
                            .font(.system(size: 12))
                            .foregroundColor(mutedText)
                    }
                }
                .buttonStyle(PlainButtonStyle())
                .help(model.detailNamesHidden ? "显示名称" : "隐藏名称")

                // API 导入按钮
                AppButton(title: "API 导入", systemImage: "bolt.fill", kind: .primary) {
                    model.openAdd()
                }
            }
        }
        .padding(16)
        .background(cardBackground)
    }

    /// 多区域切换器下拉组件（对齐 Web RegionSwitcher）
    private var regionSwitcherMenu: some View {
        Menu {
            ForEach(model.detailRows) { row in
                Button(action: {
                    model.selectRegion(row.id)
                }) {
                    let flag = RegionFlag.emoji(row.region)
                    let cn = RegionCnName.table[row.region] ?? row.region
                    let regionSuffix = (cn != row.region) ? " (\(row.region))" : ""
                    let homeTag = row.isHomeRegion ? " [主区域]" : ""
                    let check = (row.id == model.selectedRegionId) ? "✓ " : ""
                    Text("\(check)\(flag) \(cn)\(regionSuffix)\(homeTag)")
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 12))
                    .foregroundColor(mutedText)
                Text("区域")
                    .font(.system(size: 11))
                    .foregroundColor(mutedText)

                let curCode = activeRow?.region ?? ""
                let curCn = RegionCnName.table[curCode] ?? curCode
                Text(curCn)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(primaryText)

                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(mutedText)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(AppTheme.sidebarBg(dark))
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )
        }
        .menuStyle(BorderlessButtonMenuStyle())
    }

    // MARK: - 3. 区域操作 7 项按钮组卡片

    private var actionsBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "gearshape.2")
                    .font(.system(size: 12, weight: .semibold))
                Text("区域操作")
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundColor(mutedText)
            .padding(.trailing, 6)

            // 1. 实例同步（Primary 绿色）
            AppButton(
                title: "实例同步",
                systemImage: "arrow.2.circlepath",
                kind: .primary,
                isLoading: model.isSyncingRegion
            ) {
                Task { await model.syncActiveRegion() }
            }

            // 2. 添加开机
            AppButton(title: "添加开机", systemImage: "plus", kind: .secondary) {
                if let target = activeRow { model.openBoot(target) }
            }

            // 3. 查看开机
            AppButton(title: "查看开机", systemImage: "eye", kind: .secondary) {
                if let target = activeRow { model.openBootTaskList(target) }
            }

            // 4. 硬盘信息
            AppButton(title: "硬盘信息", systemImage: "externaldrive", kind: .secondary) {
                if let target = activeRow { model.openVolumes(target) }
            }

            // 5. 安全规则
            AppButton(title: "安全规则", systemImage: "shield", kind: .secondary) {
                if let target = activeRow { model.openSecurityRules(target) }
            }

            // 6. 实例列表
            AppButton(title: "实例列表", systemImage: "list.bullet", kind: .secondary) {
                if let target = activeRow { model.openInstancesList(target) }
            }

            // 7. 数据库管理
            AppButton(title: "数据库管理", systemImage: "cylinder.split.1x2", kind: .secondary) {
                if let target = activeRow { model.openMysql(target) }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(cardBackground)
    }

    // MARK: - 4. 核心表格卡片

    private var tableCard: some View {
        VStack(spacing: 0) {
            // 表头
            HStack(spacing: 0) {
                headerCol("#", width: 44)
                headerCol("租户名", width: 140)
                headerCol("自定义名称", width: 130)
                headerCol("开机任务", width: 90)
                headerCol("区域", width: 140)
                headerCol("主区域", width: 70)
                headerCol("实例同步", width: 96)
                headerCol("创建时间", width: 150)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(AppTheme.sidebarHover(dark).opacity(0.6))
            .overlay(
                Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.4)),
                alignment: .bottom
            )

            // 数据行
            if model.detailRows.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Text("暂无区域数据")
                        .font(.system(size: 12))
                        .foregroundColor(mutedText)
                    Spacer()
                }
                .frame(height: 120)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(model.detailRows.enumerated()), id: \.offset) { idx, row in
                        rowView(index: idx, item: row)
                            .id("region-row-\(row.id)")
                    }
                }
            }
        }
        .background(cardBackground)
    }

    private func headerCol(_ text: String, width: CGFloat) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(mutedText)
            .frame(width: width, alignment: .leading)
    }

    private func rowView(index: Int, item: TenantItem) -> some View {
        let isSelected = item.id == activeRow?.id
        let isHovered = hoveredRowId == item.id

        return Button(action: {
            model.selectRegion(item.id)
        }) {
            HStack(spacing: 0) {
                // #
                Text("\(index + 1)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(mutedText)
                    .frame(width: 44, alignment: .leading)

                // 租户名标签
                let nameShown = !model.detailNamesHidden
                let tName = nameShown ? item.displayName : item.maskedName
                Text(tName)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.sidebarHover(dark))
                    .cornerRadius(4)
                    .frame(width: 140, alignment: .leading)

                // 自定义名称
                Text(item.defNameText)
                    .font(.system(size: 12))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(width: 130, alignment: .leading)

                // 开机任务（仅统计正在进行中的任务数，与指标卡片一致）
                HStack {
                    let taskCount = isSelected ? model.detailBootTaskCount : (item.openBootFlag ? 1 : 0)
                    if taskCount > 0 {
                        Text("\(taskCount)项进行中")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(AppTheme.info)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppTheme.info.opacity(0.14))
                            .cornerRadius(4)
                    } else {
                        Text("无任务")
                            .font(.system(size: 11))
                            .foregroundColor(mutedText.opacity(0.8))
                    }
                }
                .frame(width: 90, alignment: .leading)

                // 区域（仅展示区域名称，去掉地球图标与括号重复项）
                let cn = RegionCnName.table[item.region] ?? item.region
                Text(cn)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(primaryText)
                    .lineLimit(1)
                    .frame(width: 140, alignment: .leading)

                // 主区域
                HStack {
                    if item.isHomeRegion {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 9, weight: .bold))
                            Text("是")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundColor(AppTheme.sidebarActive)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppTheme.sidebarActive.opacity(0.14))
                        .cornerRadius(4)
                    } else {
                        Text("否")
                            .font(.system(size: 11))
                            .foregroundColor(mutedText.opacity(0.8))
                    }
                }
                .frame(width: 70, alignment: .leading)

                // 实例同步
                HStack {
                    if item.apiSynced {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(AppTheme.sidebarActive)
                                .frame(width: 5, height: 5)
                            Text("已同步")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(AppTheme.sidebarActive)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppTheme.sidebarActive.opacity(0.12))
                        .cornerRadius(4)
                    } else {
                        Text("未同步")
                            .font(.system(size: 11))
                            .foregroundColor(mutedText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppTheme.sidebarHover(dark).opacity(0.6))
                            .cornerRadius(4)
                    }
                }
                .frame(width: 96, alignment: .leading)

                // 创建时间
                Text(item.createdAt.isEmpty ? "—" : item.createdAt)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(mutedText)
                    .lineLimit(1)
                    .frame(width: 150, alignment: .leading)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                isHovered ? AppTheme.sidebarHover(dark).opacity(0.4) : Color.clear
            )
            .overlay(
                Rectangle().frame(height: 1).foregroundColor(AppTheme.border(dark).opacity(0.25)),
                alignment: .bottom
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { inside in
            hoveredRowId = inside ? item.id : (hoveredRowId == item.id ? nil : hoveredRowId)
        }
    }

    // MARK: - 5. 底部 4 项核心指标卡片（MiniMetric Grid）

    private var metricsGrid: some View {
        HStack(spacing: 12) {
            miniMetricCard(
                label: "实例总数",
                value: "\(model.detailInstanceCount)",
                icon: "server.rack",
                color: Color(hex: "00b6be")
            )
            miniMetricCard(
                label: "运行中",
                value: "\(model.detailRunningCount)",
                icon: "play.circle.fill",
                color: AppTheme.sidebarActive
            )
            miniMetricCard(
                label: "开机任务",
                value: "\(model.detailBootTaskCount)",
                icon: "bolt.circle.fill",
                color: AppTheme.info
            )
            let costVal: Double = {
                if let str = parent?.accountCost, let d = Double(str), d > 0.001 {
                    return d
                }
                return 0.0
            }()
            miniMetricCard(
                label: "本月花费",
                value: String(format: "$%.2f", costVal),
                icon: "dollarsign.circle.fill",
                color: AppTheme.orange
            )
        }
    }

    private func miniMetricCard(label: String, value: String, icon: String, color: Color) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(color.opacity(0.15))
                    .frame(width: 38, height: 38)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(mutedText)
                Text(value)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(primaryText)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(cardBackground)
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(AppTheme.sidebarBg(dark))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(AppTheme.border(dark).opacity(0.55), lineWidth: 1)
            )
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text).font(.system(size: 12))
            Spacer()
            Button("重试") { Task { await model.reloadDetail() } }
                .buttonStyle(PlainButtonStyle())
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundColor(AppTheme.danger)
        .padding(12)
        .background(AppTheme.danger.opacity(0.1))
        .cornerRadius(10)
    }
}
