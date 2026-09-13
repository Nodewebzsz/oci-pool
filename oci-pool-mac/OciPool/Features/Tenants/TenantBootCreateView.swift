import SwiftUI
import AppKit

// MARK: - Boot template model

private struct BootTemplate: Identifiable {
    let id: String
    let arch: String
    let label: String
    let ocpu: String
    let memory: String
    let disk: String
    let tag: String       // "免费" / "付费"
    let tagDanger: Bool
}

private let bootTemplates: [BootTemplate] = [
    BootTemplate(id: "arm-base",     arch: "ARM", label: "ARM Base",     ocpu: "1", memory: "6",  disk: "50",  tag: "免费", tagDanger: false),
    BootTemplate(id: "arm-std",      arch: "ARM", label: "ARM Standard", ocpu: "2", memory: "12", disk: "50",  tag: "免费", tagDanger: false),
    BootTemplate(id: "arm-high",     arch: "ARM", label: "ARM High",     ocpu: "4", memory: "24", disk: "50",  tag: "免费", tagDanger: false),
    BootTemplate(id: "arm-a2",       arch: "ARM", label: "ARM A2",       ocpu: "4", memory: "24", disk: "200", tag: "付费", tagDanger: true),
    BootTemplate(id: "amd-base",     arch: "AMD", label: "AMD Base",     ocpu: "1", memory: "1",  disk: "50",  tag: "免费", tagDanger: false),
    BootTemplate(id: "amd-e3",       arch: "AMD", label: "AMD E3",       ocpu: "4", memory: "24", disk: "50",  tag: "付费", tagDanger: true),
    BootTemplate(id: "amd-e4",       arch: "AMD", label: "AMD E4",       ocpu: "4", memory: "24", disk: "50",  tag: "付费", tagDanger: true),
    BootTemplate(id: "amd-e5",       arch: "AMD", label: "AMD E5",       ocpu: "4", memory: "24", disk: "50",  tag: "付费", tagDanger: true),
    BootTemplate(id: "x86-base",     arch: "X86", label: "X86 Base",     ocpu: "1", memory: "1",  disk: "50",  tag: "免费", tagDanger: false),
]

private let intervalPresets: [(String, String)] = [
    ("10s", "10"), ("30s", "30"), ("60s", "60"), ("200s", "200"), ("500s", "500")
]

/// 创建开机任务整页 — 对应 Web `add_boot.ftl`，从租户列表进入，非弹框。
/// UI 标准：`ModuleSettingsCard` + `EqualHeightCardRow`（同质量管理页）。
struct TenantBootCreateView: View {
    @ObservedObject var model: TenantsViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }
    private var tenant: TenantItem? { model.bootPageParent }

    private let pairMinHeight: CGFloat = 520
    private let topMinHeight: CGFloat = 320

    private var accent: Color { AppTheme.sidebarActive }
    private var freeTag: Color { AppTheme.sidebarActive }
    private var paidTag: Color { Color(hex: "f78166") }

    @State private var selectedTemplateId: String = "arm-high"
    @State private var isPasswordMasked = false

    private var visibleTemplates: [BootTemplate] {
        bootTemplates.filter { $0.arch == model.bootArchitecture }
    }

    var body: some View {
        PageScaffold(
            title: "创建开机任务",
            subtitle: tenant.map {
                let s = $0.tenantPrimaryName
                let regCn = RegionCnName.table[$0.region] ?? ($0.region.isEmpty ? "—" : $0.region)
                return "\(s) · \(regCn)"
            },
            systemImage: "play.circle.fill",
            toolbar: { toolbar },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        apiRiskBanner

                        // 上排：架构区域 | 规格模板（等宽等高）
                        EqualHeightCardRow(minHeight: topMinHeight) {
                            archCard
                        } second: {
                            templateCard
                        }

                        // 下排：部署配置 | 镜像与访问（等宽等高，用户锁定要求）
                        EqualHeightCardRow(minHeight: pairMinHeight) {
                            configCard
                        } second: {
                            imageCard
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .environmentObject(appearance)
    }

    private var apiRiskBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundColor(AppTheme.danger)
            VStack(alignment: .leading, spacing: 4) {
                Text("API 开机风控警告")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.danger)
                Text("Oracle 已加强对 API 开机的风控。通过 API 创建实例极大概率触发风控，可能导致账号受限。保存任务前会再次弹框确认。")
                    .font(.system(size: 12))
                    .foregroundColor(dark ? Color.white.opacity(0.85) : Color.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(AppTheme.danger.opacity(dark ? 0.14 : 0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.danger.opacity(0.45), lineWidth: 1)
        )
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(title: "返回列表", systemImage: "chevron.left", kind: .secondary) {
                model.closeBootCreate()
            }
            AppButton(title: "保存任务", systemImage: "checkmark", kind: .primary) {
                guard let t = tenant else { return }
                model.submitBoot(t)
            }
        }
    }

    // MARK: - 1. Architecture + Region

    private var archCard: some View {
        ModuleSettingsCard(
            title: "架构与区域",
            subtitle: "选择 CPU 架构与部署区域",
            systemImage: "cpu",
            accent: AppTheme.info,
            enabled: nil,
            minHeight: topMinHeight
        ) {
            FormFieldRow(label: "架构") {
                HStack(spacing: 0) {
                    ForEach(["ARM", "AMD", "X86"], id: \.self) { arch in
                        archSegment(arch)
                    }
                }
                .padding(3)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(AppInputStyle.fill(dark))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                )
            }

            if !model.bootRegionOptions.isEmpty {
                FormFieldRow(label: "部署区域") {
                    SelectMenu(
                        options: model.bootRegionOptions.map { opt in
                            let s = opt.tenantPrimaryName
                            let rn = RegionCnName.table[opt.region] ?? opt.region
                            let suffix = opt.isHomeRegion ? " (主区域)" : ""
                            return SelectOption(id: opt.id, title: "\(s) · \(rn)\(suffix)")
                        },
                        selection: Binding(
                            get: { model.bootSelectedRegionTenantId },
                            set: {
                                model.bootSelectedRegionTenantId = $0 ?? "\(tenant?.id ?? 0)"
                                Task {
                                    let tid = Int64(model.bootSelectedRegionTenantId) ?? (tenant?.id ?? 0)
                                    await model.loadBootImages(tenantId: tid)
                                }
                            }
                        ),
                        placeholder: "选择区域租户",
                        width: 240,
                        allowClear: false
                    )
                }
            } else {
                Text("使用当前租户区域")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
            }
        } footer: {
            StatusBadge(
                text: model.bootArchitecture,
                tone: .info
            )
        }
    }

    private func archSegment(_ arch: String) -> some View {
        let active = model.bootArchitecture == arch
        let subtitle: String = {
            switch arch {
            case "ARM": return "AArch64"
            case "AMD": return "x86-64"
            default: return "x86-64"
            }
        }()
        return Button(action: {
            guard model.bootArchitecture != arch else { return }
            model.bootArchitecture = arch
            if let first = bootTemplates.first(where: { $0.arch == arch }) {
                applyTemplate(first)
            }
            Task {
                let tid = Int64(model.bootSelectedRegionTenantId) ?? (tenant?.id ?? 0)
                await model.loadBootImages(tenantId: tid)
            }
        }) {
            VStack(spacing: 2) {
                Text(arch)
                    .font(.system(size: 13, weight: .bold))
                Text(subtitle)
                    .font(.system(size: 10, weight: .medium))
                    .opacity(0.8)
            }
            .foregroundColor(active ? .white : AppTheme.sidebarText(dark))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(active ? accent : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .animation(.easeOut(duration: 0.15), value: active)
    }

    // MARK: - 2. Templates

    private var templateCard: some View {
        ModuleSettingsCard(
            title: "规格模板",
            subtitle: "点击卡片快速填充 OCPU / 内存 / 磁盘",
            systemImage: "square.grid.2x2",
            accent: Color(hex: "9b59b6"),
            enabled: nil,
            minHeight: topMinHeight
        ) {
            // 固定 2 列等宽，避免 adaptive 大小不一
            VStack(spacing: 10) {
                ForEach(pairRows(visibleTemplates), id: \.0) { row in
                    HStack(spacing: 10) {
                        templateTile(row.1)
                        if let second = row.2 {
                            templateTile(second)
                        } else {
                            Color.clear.frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        } footer: {
            Text("已选 \(selectedLabel)")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        }
    }

    private var selectedLabel: String {
        bootTemplates.first(where: { $0.id == selectedTemplateId })?.label ?? "自定义"
    }

    /// 两列配对
    private func pairRows(_ items: [BootTemplate]) -> [(Int, BootTemplate, BootTemplate?)] {
        var rows: [(Int, BootTemplate, BootTemplate?)] = []
        var i = 0
        while i < items.count {
            let left = items[i]
            let right = (i + 1 < items.count) ? items[i + 1] : nil
            rows.append((i, left, right))
            i += 2
        }
        return rows
    }

    private func templateTile(_ tpl: BootTemplate) -> some View {
        let active = selectedTemplateId == tpl.id
        let tagColor = tpl.tagDanger ? paidTag : freeTag
        return Button(action: { applyTemplate(tpl) }) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Text(tpl.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(active ? accent : (dark ? Color.white.opacity(0.92) : Color.primary))
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    if active {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(accent)
                    }
                }

                Text("\(tpl.ocpu)C · \(tpl.memory)G · \(tpl.disk)G")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.sidebarText(dark))
                    .lineLimit(1)

                Text(tpl.tag)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(tagColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(tagColor.opacity(0.14))
                    .cornerRadius(4)
            }
            .padding(10)
            .frame(maxWidth: .infinity, minHeight: 78, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(active ? accent.opacity(dark ? 0.12 : 0.07) : AppInputStyle.fill(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(active ? accent.opacity(0.55) : AppTheme.border(dark).opacity(0.7), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .animation(.easeOut(duration: 0.15), value: active)
    }

    // MARK: - 3. Deploy config（与镜像卡等宽等高）

    private var configCard: some View {
        ModuleSettingsCard(
            title: "部署配置",
            subtitle: "计算规格 · 循环间隔 · 数量与时段",
            systemImage: "slider.horizontal.3",
            accent: AppTheme.info,
            enabled: nil,
            minHeight: pairMinHeight
        ) {
            FormFieldRow(label: "计算规格") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        numField("OCPU", text: $model.bootOcpu)
                        numField("内存 (GB)", text: $model.bootMemory)
                        numField("磁盘 (GB)", text: $model.bootDisk)
                    }

                    // ARM 1:6 核心内存比动态防呆守卫条
                    if model.bootArchitecture == "ARM",
                       let c = Double(model.bootOcpu), c > 0,
                       let m = Double(model.bootMemory) {
                        let ratioOk = (abs((m / c) - 6.0) < 0.1)
                        HStack(spacing: 6) {
                            Image(systemName: ratioOk ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(ratioOk ? AppTheme.sidebarActive : AppTheme.orange)
                            Text(ratioOk
                                ? "ARM 内存核心比守卫：当前 \(model.bootOcpu)C : \(model.bootMemory)G (1:6) 完美符合 Oracle 官方推荐规则"
                                : "注意：当前比例为 1:\(String(format: "%.1f", m / c))，Oracle ARM 官方严格推荐 1C:6G 比例"
                            )
                            .font(.system(size: 11))
                            .foregroundColor(ratioOk ? AppTheme.sidebarActive : AppTheme.orange)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill((ratioOk ? AppTheme.sidebarActive : AppTheme.orange).opacity(0.12))
                        )
                    }

                    // 免费额度超额告警条
                    if model.bootArchitecture == "ARM",
                       let c = Double(model.bootOcpu),
                       let m = Double(model.bootMemory),
                       let d = Double(model.bootDisk),
                       (c > 4 || m > 24 || d > 200) {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.orange)
                            Text("当前规格已超过 Oracle ARM 永久免费上限 (4C 24G 200GB)，可能产生计费")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.orange)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.orange.opacity(0.12))
                        )
                    }
                }
            }

            FormFieldRow(label: "循环间隔") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        ForEach(intervalPresets, id: \.0) { label, val in
                            presetChip(label: label, value: val, binding: $model.bootLoopTime)
                        }
                    }
                    HStack(spacing: 8) {
                        AppTextField(
                            text: $model.bootLoopTime,
                            placeholder: "自定义秒数",
                            leadingSystemImage: "timer"
                        )
                        Text("秒")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarText(dark))
                    }
                }
            }

            FormFieldRow(label: "实例数量") {
                AppTextField(
                    text: $model.bootCount,
                    placeholder: "1",
                    leadingSystemImage: "number"
                )
            }

            // 每日抢机时段 (对齐 Web 端场景胶囊 + 实时大白话反馈条)
            FormFieldRow(label: "每日抢机时段 (可选)") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        ForEach([
                            ("全天执行", ""),
                            ("凌晨 (1-8点)", "1-8"),
                            ("白天 (9-18点)", "9-18"),
                            ("夜间 (18-24点)", "18-24")
                        ], id: \.0) { label, val in
                            presetChip(label: label, value: val, binding: $model.bootDayGap)
                        }
                    }

                    // 实时大白话状态反馈条
                    HStack(spacing: 6) {
                        Image(systemName: timeRangeHint.isAllDay ? "clock.fill" : "moon.stars.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarActive)
                        Text(timeRangeHint.text)
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.sidebarActive)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(AppTheme.sidebarActive.opacity(0.12))
                    )
                }
            }
        } footer: {
            Text("可改规格后保存")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
        }
    }

    // MARK: - 4. Image & access（与部署配置等宽等高）

    private var imageCard: some View {
        ModuleSettingsCard(
            title: "镜像与访问",
            subtitle: "Root 密码 · 操作系统 · Image ID",
            systemImage: "desktopcomputer",
            accent: AppTheme.cyan,
            enabled: nil,
            minHeight: pairMinHeight
        ) {
            FormFieldRow(label: "Root 密码") {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        AppTextField(
                            text: $model.bootRootPassword,
                            placeholder: "root 登录密码",
                            secure: isPasswordMasked,
                            leadingSystemImage: "key"
                        )
                        Button(action: { isPasswordMasked.toggle() }) {
                            Image(systemName: isPasswordMasked ? "eye" : "eye.slash")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.sidebarText(dark))
                                .frame(width: 28, height: 28)
                                .background(RoundedRectangle(cornerRadius: 6).fill(AppInputStyle.fill(dark)))
                        }
                        .buttonStyle(PlainButtonStyle())
                        AppButton(title: "随机", systemImage: "arrow.clockwise", kind: .secondary) {
                            model.bootRootPassword = randomPassword()
                        }
                    }
                    // 密码强度条
                    HStack(spacing: 3) {
                        ForEach(0..<4) { idx in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(idx < passwordStrengthScore ? AppTheme.sidebarActive : Color.gray.opacity(0.3))
                                .frame(height: 3)
                        }
                    }
                }
            }

            FormFieldRow(label: "任务备注") {
                AppTextField(
                    text: $model.bootRemark,
                    placeholder: "如：新加坡-ARM-满血",
                    leadingSystemImage: "tag"
                )
            }

            FormFieldRow(label: "操作系统") {
                if model.bootOSList.isEmpty {
                    HStack(spacing: 8) {
                        if model.bootImages.isEmpty {
                            ProgressView().scaleEffect(0.65)
                        } else {
                            Image(systemName: "exclamationmark.circle")
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }
                        Text(model.bootImages.isEmpty ? "加载镜像中…" : "暂无可用镜像")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.sidebarText(dark))
                    }
                    .frame(height: AppInputStyle.height)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, AppInputStyle.hPad)
                    .background(
                        RoundedRectangle(cornerRadius: AppInputStyle.radius)
                            .fill(AppInputStyle.fill(dark))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: AppInputStyle.radius)
                            .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                    )
                } else {
                    SelectMenu(
                        options: model.bootOSList.map { SelectOption(id: $0, title: $0) },
                        selection: Binding(
                            get: { model.bootSelectedOS.isEmpty ? nil : model.bootSelectedOS },
                            set: { if let v = $0 { model.applyBootOS(v) } }
                        ),
                        placeholder: "选择操作系统",
                        width: 240,
                        allowClear: false
                    )
                }
            }

            if !model.bootVersions.isEmpty {
                FormFieldRow(label: "系统版本") {
                    SelectMenu(
                        options: model.bootVersions.map {
                            SelectOption(id: $0.operatingSystemVersion, title: $0.operatingSystemVersion)
                        },
                        selection: Binding(
                            get: { model.bootSelectedVersion.isEmpty ? nil : model.bootSelectedVersion },
                            set: { if let v = $0 { model.applyBootVersion(v) } }
                        ),
                        placeholder: "选择版本",
                        width: 240,
                        allowClear: false
                    )
                }
            }

            FormFieldRow(label: "Image ID") {
                Text(model.bootImageId.isEmpty ? "请先选择操作系统和版本" : model.bootImageId)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(
                        model.bootImageId.isEmpty
                            ? AppTheme.sidebarText(dark)
                            : (dark ? Color.white.opacity(0.9) : Color.primary)
                    )
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .frame(minHeight: 56, alignment: .topLeading)
                    .background(
                        RoundedRectangle(cornerRadius: AppInputStyle.radius)
                            .fill(AppInputStyle.fill(dark))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: AppInputStyle.radius)
                            .stroke(AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                    )
            }
        } footer: {
            if model.bootImageId.isEmpty {
                StatusBadge(text: "未选镜像", tone: .warning)
            } else {
                StatusBadge(text: "镜像已就绪", tone: .success)
            }
        }
    }

    // MARK: - Shared controls

    private func numField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(AppTheme.sidebarText(dark))
            AppTextField(
                text: Binding(
                    get: { text.wrappedValue },
                    set: {
                        text.wrappedValue = $0
                        selectedTemplateId = ""
                    }
                ),
                placeholder: "0"
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func presetChip(label: String, value: String, binding: Binding<String>) -> some View {
        let active = binding.wrappedValue == value
        return Button(action: { binding.wrappedValue = value }) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(active ? .white : AppTheme.sidebarText(dark))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(active ? accent : AppInputStyle.fill(dark))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(active ? accent : AppTheme.border(dark).opacity(0.7), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Helpers

    private func applyTemplate(_ tpl: BootTemplate) {
        selectedTemplateId = tpl.id
        model.bootOcpu = tpl.ocpu
        model.bootMemory = tpl.memory
        model.bootDisk = tpl.disk
        if let t = tenant {
            model.bootRemark = "\(t.tenantPrimaryName)-\(tpl.id)"
        }
    }

    private var timeRangeHint: (isAllDay: Bool, text: String) {
        let raw = model.bootDayGap.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty {
            return (true, "全天 24 小时持续轮询抢机")
        }
        let parts = raw.components(separatedBy: "-").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if parts.count == 2, parts[0] >= 0, parts[1] <= 24, parts[0] < parts[1] {
            let sStr = String(format: "%02d:00", parts[0])
            let eStr = String(format: "%02d:00", parts[1])
            return (false, "仅在每日 \(sStr) ~ \(eStr) 期间尝试抢机，其余时间自动静默挂起")
        }
        return (false, "时段格式需为「起始-结束小时」(如 1-8，不支持跨天)")
    }

    private var passwordStrengthScore: Int {
        let pw = model.bootRootPassword
        if pw.isEmpty { return 0 }
        var s = 0
        if pw.count >= 8 { s += 1 }
        if pw.count >= 12 { s += 1 }
        if pw.rangeOfCharacter(from: .uppercaseLetters) != nil && pw.rangeOfCharacter(from: .lowercaseLetters) != nil { s += 1 }
        if pw.rangeOfCharacter(from: .decimalDigits) != nil { s += 1 }
        return min(4, s)
    }

    private func randomPassword() -> String {
        let chars = Array("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#")
        return String((0..<16).map { _ in chars[Int.random(in: 0..<chars.count)] })
    }
}
