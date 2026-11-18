import SwiftUI
import AppKit

// MARK: - Shared Boot Shape Normalization & Live USD Pricing Estimator

struct BootNormalizedSpec: Equatable {
    let shape: String
    let ocpu: Int
    let memoryGb: Int
    let bootVolumeGb: Int
    let locked: Bool
    let isFreeFixed: Bool
    let validationError: String?
}

struct BootCostEstimate: Equatable {
    let hourlyUsd: Double
    let computeMonthlyUsd: Double
    let volumeMonthlyUsd: Double
    let totalMonthlyUsd: Double
    let tierBadge: String
    let isAlwaysFree: Bool
}

enum BootPricingEstimator {
    static let microShape = "VM.Standard.E2.1.Micro"
    static let armFreeFlexShape = "VM.Standard.A1.Flex"

    static func shapes(for arch: String) -> [SelectOption] {
        if arch.uppercased() == "ARM" {
            return [
                SelectOption(id: "VM.Standard.A1.Flex", title: "VM.Standard.A1.Flex (Ampere Always Free / Flex)"),
                SelectOption(id: "VM.Standard.A2.Flex", title: "VM.Standard.A2.Flex (Ampere Paid Flex)")
            ]
        }
        return [
            SelectOption(id: "VM.Standard.E2.1.Micro", title: "VM.Standard.E2.1.Micro (Always Free 1C 1G 固定)"),
            SelectOption(id: "VM.Standard.E4.Flex", title: "VM.Standard.E4.Flex (AMD EPYC Flex)"),
            SelectOption(id: "VM.Standard.E5.Flex", title: "VM.Standard.E5.Flex (AMD EPYC Gen4 Flex)"),
            SelectOption(id: "VM.Standard3.Flex", title: "VM.Standard3.Flex (Intel Xeon Flex)"),
            SelectOption(id: "VM.Optimized3.Flex", title: "VM.Optimized3.Flex (Intel 高频 Flex)")
        ]
    }

    static func defaultShape(for arch: String, ocpu: Int, memoryGb: Int) -> String {
        if arch.uppercased() == "ARM" {
            return armFreeFlexShape
        }
        if ocpu == 1 && memoryGb == 1 {
            return microShape
        }
        return "VM.Standard.E4.Flex"
    }

    static func normalize(
        shape: String,
        ocpuText: String,
        memoryText: String,
        diskText: String
    ) -> BootNormalizedSpec {
        let trimmedDisk = diskText.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsedDisk = Int(trimmedDisk)
        let diskVal = parsedDisk ?? 50
        var diskError: String? = nil
        if parsedDisk == nil || diskVal < 50 || diskVal > 32768 {
            diskError = "引导卷容量须为 50 ~ 32768 GB 之间的整数"
        }

        if shape == microShape {
            return BootNormalizedSpec(
                shape: shape,
                ocpu: 1,
                memoryGb: 1,
                bootVolumeGb: max(50, diskVal),
                locked: true,
                isFreeFixed: true,
                validationError: diskError
            )
        }

        let trimmedOcpu = ocpuText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedMem = memoryText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let ocpu = Int(trimmedOcpu), !trimmedOcpu.contains(".") else {
            return BootNormalizedSpec(
                shape: shape, ocpu: 1, memoryGb: 6, bootVolumeGb: max(50, diskVal),
                locked: false, isFreeFixed: false,
                validationError: "Flex 规格 OCPU 必须为 1 ~ 80 的整数"
            )
        }
        guard let mem = Int(trimmedMem), !trimmedMem.contains(".") else {
            return BootNormalizedSpec(
                shape: shape, ocpu: ocpu, memoryGb: 6, bootVolumeGb: max(50, diskVal),
                locked: false, isFreeFixed: false,
                validationError: "Flex 规格内存容量必须为 1 ~ 512 GB 的整数"
            )
        }
        if ocpu < 1 || ocpu > 80 {
            return BootNormalizedSpec(
                shape: shape, ocpu: ocpu, memoryGb: mem, bootVolumeGb: max(50, diskVal),
                locked: false, isFreeFixed: false,
                validationError: "OCPU 超出范围：须在 1 ~ 80 核之间"
            )
        }
        if mem < 1 || mem > 512 {
            return BootNormalizedSpec(
                shape: shape, ocpu: ocpu, memoryGb: mem, bootVolumeGb: max(50, diskVal),
                locked: false, isFreeFixed: false,
                validationError: "内存容量超出范围：须在 1 ~ 512 GB 之间"
            )
        }
        let ratio = Double(mem) / Double(max(1, ocpu))
        if ratio < 1.0 || ratio > 64.0 {
            return BootNormalizedSpec(
                shape: shape, ocpu: ocpu, memoryGb: mem, bootVolumeGb: max(50, diskVal),
                locked: false, isFreeFixed: false,
                validationError: "单核内存比须在 1 ~ 64 GB / OCPU 之间"
            )
        }
        return BootNormalizedSpec(
            shape: shape,
            ocpu: ocpu,
            memoryGb: mem,
            bootVolumeGb: max(50, diskVal),
            locked: false,
            isFreeFixed: false,
            validationError: diskError
        )
    }

    static func estimate(
        shape: String,
        ocpu: Int,
        memoryGb: Int,
        bootVolumeGb: Int,
        instanceCount: Int = 1
    ) -> BootCostEstimate {
        let count = max(1, instanceCount)
        let totalOcpu = max(1, ocpu) * count
        let totalMem = max(1, memoryGb) * count
        let totalDisk = max(50, bootVolumeGb) * count

        let overflowDiskGb = max(0, totalDisk - 200)
        let volumeMonthly = Double(overflowDiskGb) * 0.0255

        var hourlyCompute = 0.0
        var badge = "按量计费 Flex"

        switch shape {
        case microShape:
            let paidInstances = max(0, count - 2)
            hourlyCompute = Double(paidInstances) * 0.0085
            badge = (paidInstances == 0 && overflowDiskGb == 0)
                ? "Always Free 额度内 $0.00"
                : "超出免费额度估算"
        case armFreeFlexShape:
            let billableOcpu = max(0, totalOcpu - 4)
            let billableMem = max(0, totalMem - 24)
            hourlyCompute = Double(billableOcpu) * 0.01 + Double(billableMem) * 0.0015
            badge = (hourlyCompute == 0 && overflowDiskGb == 0)
                ? "Always Free 额度内 $0.00"
                : "超出免费池部分计费"
        case "VM.Standard.E4.Flex":
            hourlyCompute = Double(totalOcpu) * 0.025 + Double(totalMem) * 0.0015
            badge = "付费 AMD E4.Flex"
        case "VM.Standard.E5.Flex":
            hourlyCompute = Double(totalOcpu) * 0.030 + Double(totalMem) * 0.0020
            badge = "付费 AMD E5.Flex"
        case "VM.Standard3.Flex":
            hourlyCompute = Double(totalOcpu) * 0.040 + Double(totalMem) * 0.0015
            badge = "付费 Intel Standard3.Flex"
        case "VM.Optimized3.Flex":
            hourlyCompute = Double(totalOcpu) * 0.054 + Double(totalMem) * 0.0015
            badge = "付费高频 Optimized3.Flex"
        default:
            hourlyCompute = Double(totalOcpu) * 0.010 + Double(totalMem) * 0.0015
            badge = "付费 Flex 规格"
        }

        let computeMonthly = hourlyCompute * 720.0
        let totalMonthly = computeMonthly + volumeMonthly
        let isFree = totalMonthly < 0.0001

        return BootCostEstimate(
            hourlyUsd: hourlyCompute,
            computeMonthlyUsd: computeMonthly,
            volumeMonthlyUsd: volumeMonthly,
            totalMonthlyUsd: totalMonthly,
            tierBadge: badge,
            isAlwaysFree: isFree
        )
    }
}

struct BootPricingEstimateCard: View {
    let shape: String
    let ocpuText: String
    let memoryText: String
    let diskText: String
    var countText: String = "1"

    @EnvironmentObject private var appearance: AppearanceController
    @State private var showRiskNotes = false

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        let spec = BootPricingEstimator.normalize(
            shape: shape,
            ocpuText: ocpuText,
            memoryText: memoryText,
            diskText: diskText
        )
        let count = max(1, Int(countText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 1)
        let est = BootPricingEstimator.estimate(
            shape: spec.shape,
            ocpu: spec.ocpu,
            memoryGb: spec.memoryGb,
            bootVolumeGb: spec.bootVolumeGb,
            instanceCount: count
        )
        let toneColor = est.isAlwaysFree ? AppTheme.success : AppTheme.orange

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(toneColor)
                Text("实时费用预估 (USD)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(AppTheme.navIcon(dark))
                Spacer(minLength: 4)
                StatusBadge(
                    text: est.tierBadge,
                    tone: est.isAlwaysFree ? .success : .warning
                )
            }

            HStack(spacing: 12) {
                metricPill(
                    label: "折算月费 (720h)",
                    value: String(format: "$%.2f / 月", est.totalMonthlyUsd),
                    highlight: toneColor
                )
                metricPill(
                    label: "计算小时单价",
                    value: String(format: "$%.4f / h", est.hourlyUsd),
                    highlight: AppTheme.navIcon(dark)
                )
                metricPill(
                    label: "引导卷超额估算",
                    value: est.volumeMonthlyUsd > 0
                        ? String(format: "$%.2f / 月", est.volumeMonthlyUsd)
                        : "$0.00 (≤200GB)",
                    highlight: est.volumeMonthlyUsd > 0 ? AppTheme.orange : AppTheme.textSecondary(dark)
                )
            }

            DisclosureGroup(isExpanded: $showRiskNotes) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("• Always Free 免费池为租户级共享额度：总计最多 4 OCPU + 24 GB (A1.Flex)、2 台 E2.1.Micro 以及 200 GB 块存储/引导卷。")
                    Text("• 若该租户名下已有存量实例或残留未删引导卷，叠加后超出免费池的部分将按 Oracle 官方单价扣减试用金或产生 Pay-As-You-Go 账单。")
                    Text("• 引导卷超 200 GB 免费总额后按基础性能块存储约 $0.0255 / GB·月估算。")
                }
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textSecondary(dark))
                .padding(.top, 6)
            } label: {
                Text("计费口径与超额风险说明")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.info)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(toneColor.opacity(dark ? 0.10 : 0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(toneColor.opacity(0.32), lineWidth: 1)
        )
    }

    private func metricPill(label: String, value: String, highlight: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(AppTheme.textTertiary(dark))
            Text(value)
                .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                .foregroundColor(highlight)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(AppTheme.sidebarBg(dark).opacity(0.85))
        .cornerRadius(6)
    }
}

// MARK: - Boot template model (100% 对齐 Web 端规格模板)

private struct BootTemplate: Identifiable {
    let id: String
    let arch: String
    let shape: String
    let label: String
    let ocpu: String
    let memory: String
    let disk: String
    let tag: String       // "免费" / "付费"
    let paid: Bool
}

private let bootTemplates: [BootTemplate] = [
    BootTemplate(id: "arm-base",     arch: "ARM", shape: "VM.Standard.A1.Flex",    label: "ARM Base",     ocpu: "1", memory: "6",  disk: "50",  tag: "免费", paid: false),
    BootTemplate(id: "arm-std",      arch: "ARM", shape: "VM.Standard.A1.Flex",    label: "ARM Standard", ocpu: "2", memory: "12", disk: "50",  tag: "免费", paid: false),
    BootTemplate(id: "arm-high",     arch: "ARM", shape: "VM.Standard.A1.Flex",    label: "ARM High",     ocpu: "4", memory: "24", disk: "50",  tag: "免费", paid: false),
    BootTemplate(id: "arm-a2",       arch: "ARM", shape: "VM.Standard.A2.Flex",    label: "ARM A2",       ocpu: "4", memory: "24", disk: "200", tag: "付费", paid: true),
    BootTemplate(id: "amd-base",     arch: "AMD", shape: "VM.Standard.E2.1.Micro", label: "AMD Base",     ocpu: "1", memory: "1",  disk: "50",  tag: "免费", paid: false),
    BootTemplate(id: "amd-e3",       arch: "AMD", shape: "VM.Standard3.Flex",      label: "AMD / X86 S3", ocpu: "4", memory: "24", disk: "50",  tag: "付费", paid: true),
    BootTemplate(id: "amd-e4",       arch: "AMD", shape: "VM.Standard.E4.Flex",    label: "AMD E4",       ocpu: "4", memory: "24", disk: "50",  tag: "付费", paid: true),
    BootTemplate(id: "amd-e5",       arch: "AMD", shape: "VM.Standard.E5.Flex",    label: "AMD E5",       ocpu: "4", memory: "24", disk: "50",  tag: "付费", paid: true),
]

private let intervalPresets: [(String, String)] = [
    ("10s", "10"), ("30s", "30"), ("60s", "60"), ("200s", "200"), ("500s", "500")
]

/// 创建开机任务整页 — 100% 像素级对齐 Web 端 Modern UI 标准架构
struct TenantBootCreateView: View {
    @ObservedObject var model: TenantsViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }
    private var tenant: TenantItem? { model.bootPageParent }

    private var accent: Color { AppTheme.sidebarActive }
    private var cardBg: Color { AppTheme.isClaude ? AppTheme.sidebarBg(dark) : (dark ? AppTheme.sidebarHoverDark : Color.white) }
    private var cardBorder: Color { dark ? AppTheme.borderDark : AppTheme.borderLight }
    private var primaryText: Color { dark ? Color.white.opacity(0.92) : Color.primary }
    private var mutedText: Color { AppTheme.sidebarText(dark) }

    @State private var selectedTemplateId: String = "arm-high"
    @State private var lastAppliedTemplateId: String = "arm-high"
    @State private var selectedShape: String = "VM.Standard.A1.Flex"
    @State private var isPasswordMasked = false

    private var visibleTemplates: [BootTemplate] {
        bootTemplates.filter { $0.arch == model.bootArchitecture }
    }

    private var normalizedSpec: BootNormalizedSpec {
        BootPricingEstimator.normalize(
            shape: selectedShape,
            ocpuText: model.bootOcpu,
            memoryText: model.bootMemory,
            diskText: model.bootDisk
        )
    }

    private var fallbackTemplate: BootTemplate {
        bootTemplates.first(where: { $0.id == lastAppliedTemplateId && $0.arch == model.bootArchitecture })
            ?? visibleTemplates.first
            ?? bootTemplates[2]
    }

    private var isCustomModifiedFromTemplate: Bool {
        let tpl = fallbackTemplate
        return model.bootOcpu != tpl.ocpu || model.bootMemory != tpl.memory || model.bootDisk != tpl.disk || selectedShape != tpl.shape
    }

    private var headerSubtitle: String? {
        guard let t = tenant else { return nil }
        let realName = t.tenantPrimaryName
        let regCn = RegionCnName.table[t.region] ?? (t.region.isEmpty ? "主区域" : t.region)
        return "\(realName) · \(regCn)"
    }

    var body: some View {
        PageScaffold(
            title: "创建开机任务",
            subtitle: headerSubtitle,
            systemImage: "bolt.fill",
            iconColor: AppTheme.orange,
            parentTitle: "租户管理",
            onParentClick: {
                model.closeBootCreate()
            },
            toolbar: {
                HStack(spacing: 10) {
                    AppButton(title: "返回租户列表", systemImage: "arrow.left", kind: .secondary) {
                        model.closeBootCreate()
                    }

                    AppButton(title: "保存开机任务", systemImage: "bolt.fill", kind: .primary) {
                        guard let t = tenant else { return }
                        if let err = normalizedSpec.validationError {
                            ToastCenter.shared.error(err)
                            return
                        }
                        model.submitBoot(t)
                    }
                }
            },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        // 1. Oracle API 开机风控警示横幅
                        apiRiskBanner

                        // 2. 上排双卡片：架构区域 | 规格模板 (等高并排，100% 宽度撑满)
                        HStack(alignment: .top, spacing: 14) {
                            archCard
                                .frame(maxWidth: .infinity)
                            templateCard
                                .frame(maxWidth: .infinity)
                        }

                        // 3. 下排双卡片：部署配置 | 镜像与访问 (等高并排，100% 宽度撑满)
                        HStack(alignment: .top, spacing: 14) {
                            configCard
                                .frame(maxWidth: .infinity)
                            imageCard
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.top, 14)
                    .padding(.bottom, 24)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .environmentObject(appearance)
    }

    // ─── 2. Oracle API 开机风控警告横幅 ─────────────────────────────
    private var apiRiskBanner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(AppTheme.danger)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text("Oracle API 开机风控警告")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.danger)
                Text("Oracle 近期已严厉收紧对通过 API 频繁下发创建实例任务的风控策略。高频（如 10s）自动轮询开机可能触发账号异常或限制。建议合理设置循环时间（推荐 60s 以上），保存前请仔细核对配额与配置。")
                    .font(.system(size: 12))
                    .foregroundColor(primaryText.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.danger.opacity(dark ? 0.14 : 0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.danger.opacity(0.35), lineWidth: 1)
        )
    }

    // ─── 3. 卡片 1：计算架构与目标区域 (archCard) ─────────────────
    private var archCard: some View {
        cardContainer(
            icon: "cpu",
            iconColor: accent,
            title: "计算架构与目标区域",
            subtitle: "选择处理器架构与部署可用区"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                // 架构选择双列大卡片按钮 (100% 对齐 Web 端)
                HStack(spacing: 10) {
                    let isArm = model.bootArchitecture == "ARM"
                    Button(action: { handleArchChange("ARM") }) {
                        VStack(spacing: 4) {
                            HStack(spacing: 6) {
                                Text("Ampere ARM")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(isArm ? accent : primaryText)
                                Text("推荐")
                                    .font(.system(size: 9.5, weight: .semibold))
                                    .foregroundColor(accent)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(RoundedRectangle(cornerRadius: 3).fill(accent.opacity(0.15)))
                            }
                            Text("最高可享 4C 24G 免费额度")
                                .font(.system(size: 10.5))
                                .foregroundColor(mutedText)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(isArm ? accent.opacity(0.12) : AppInputStyle.fill(dark))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isArm ? accent : cardBorder, lineWidth: isArm ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())

                    Button(action: { handleArchChange("AMD") }) {
                        VStack(spacing: 4) {
                            Text("AMD / x86")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(!isArm ? AppTheme.info : primaryText)
                            Text("标准 1C 1G 微型或付费实例")
                                .font(.system(size: 10.5))
                                .foregroundColor(mutedText)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(!isArm ? AppTheme.info.opacity(0.12) : AppInputStyle.fill(dark))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(!isArm ? AppTheme.info : cardBorder, lineWidth: !isArm ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }

                // 部署目标区域下拉框 (带红星，首帧绝不空白)
                FormFieldRow(label: "部署目标区域", required: true) {
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
                        placeholder: "选择目标区域",
                        width: 240,
                        allowClear: false
                    )
                }
            }
        }
    }

    // ─── 4. 卡片 2：规格预设模板 (templateCard) ───────────────────
    private var templateCard: some View {
        cardContainer(
            icon: "square.stack.3d.up.fill",
            iconColor: AppTheme.cyan,
            title: "规格预设模板",
            subtitle: "一键填充最佳核心数、内存与磁盘配置"
        ) {
            VStack(alignment: .leading, spacing: 10) {
                // 2x2 网格模板大卡片 (右上角仅纯色标签，去除多余白勾圈)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(visibleTemplates) { tpl in
                        let active = selectedTemplateId == tpl.id
                        Button(action: { applyTemplate(tpl) }) {
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text(tpl.label)
                                        .font(.system(size: 12.5, weight: .semibold))
                                        .foregroundColor(active ? accent : primaryText)
                                    Spacer(minLength: 2)
                                    Text(tpl.tag)
                                        .font(.system(size: 9.5, weight: .semibold))
                                        .foregroundColor(tpl.paid ? Color(hex: "f78166") : accent)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(
                                            RoundedRectangle(cornerRadius: 3)
                                                .fill((tpl.paid ? Color(hex: "f78166") : accent).opacity(0.14))
                                        )
                                }
                                Text("\(tpl.ocpu)C \(tpl.memory)G · \(tpl.disk)GB")
                                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                                    .foregroundColor(mutedText)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(active ? accent.opacity(0.12) : AppInputStyle.fill(dark))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(active ? accent : cardBorder, lineWidth: active ? 1.5 : 1)
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }

                // 底部提示行 (对齐 Web 端)
                Text("💡 提示：点击预设模板将自动联动下方参数并生成任务备注，后续亦可在下方卡片中进行微调。")
                    .font(.system(size: 11))
                    .foregroundColor(mutedText)
                    .lineLimit(2)
                    .padding(.top, 2)
            }
        }
    }

    // ─── 5. 卡片 3：计算与部署参数 (configCard) ───────────────────
    private var configCard: some View {
        cardContainer(
            icon: "slider.horizontal.3",
            iconColor: AppTheme.info,
            title: "计算与部署参数",
            subtitle: "核心、内存、磁盘与轮询周期"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("实例规格 (Shape) *")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(primaryText)
                        if normalizedSpec.isFreeFixed {
                            StatusBadge(text: "Always Free 固定规格", tone: .success)
                        }
                        Spacer(minLength: 4)
                        if isCustomModifiedFromTemplate {
                            Button(action: { applyTemplate(fallbackTemplate) }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "arrow.counterclockwise")
                                        .font(.system(size: 10, weight: .semibold))
                                    Text("恢复模板默认")
                                        .font(.system(size: 11, weight: .medium))
                                }
                                .foregroundColor(accent)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }

                    SelectMenu(
                        options: BootPricingEstimator.shapes(for: model.bootArchitecture),
                        selection: Binding(
                            get: { selectedShape },
                            set: { newVal in
                                let nextShape = newVal ?? BootPricingEstimator.shapes(for: model.bootArchitecture).first?.id ?? "VM.Standard.A1.Flex"
                                handleShapeChange(nextShape)
                            }
                        ),
                        placeholder: "选择实例规格",
                        allowClear: false
                    )
                }

                // OCPU (核心数) + 内存容量 (GB) 双列并排 (去除拥挤的三列)
                HStack(spacing: 12) {
                    numField("OCPU (核心数) *", text: $model.bootOcpu, disabled: normalizedSpec.locked)
                    numField("内存容量 (GB) *", text: $model.bootMemory, disabled: normalizedSpec.locked)
                }

                if let err = normalizedSpec.validationError {
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.octagon.fill")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.danger)
                        Text(err)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.danger)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(RoundedRectangle(cornerRadius: 6).fill(AppTheme.dangerSoft(dark)))
                }

                // ARM 1:6 核心内存比动态防呆守卫条
                if model.bootArchitecture == "ARM",
                   let c = Double(model.bootOcpu), c > 0,
                   let m = Double(model.bootMemory) {
                    let ratioOk = (abs((m / c) - 6.0) < 0.1)
                    HStack(spacing: 6) {
                        Image(systemName: ratioOk ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(ratioOk ? accent : AppTheme.orange)
                        Text(ratioOk
                            ? "ARM 内存核心比守卫：当前 \(model.bootOcpu)C : \(model.bootMemory)G (1:6) 完美符合 Oracle 官方推荐规则"
                            : "注意：当前比例为 1:\(String(format: "%.1f", m / c))，Oracle ARM 官方严格推荐 1C:6G 比例"
                        )
                        .font(.system(size: 11))
                        .foregroundColor(ratioOk ? accent : AppTheme.orange)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill((ratioOk ? accent : AppTheme.orange).opacity(0.12))
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

                // 引导卷大小 (GB) * 独占整行
                numField("引导卷大小 (GB) *", text: $model.bootDisk)

                BootPricingEstimateCard(
                    shape: selectedShape,
                    ocpuText: model.bootOcpu,
                    memoryText: model.bootMemory,
                    diskText: model.bootDisk,
                    countText: model.bootCount
                )

                // 轮询抢机周期 (秒) * (纯胶囊按钮，彻底去除多余输入框)
                FormFieldRow(label: "轮询抢机周期 (秒) *") {
                    HStack(spacing: 6) {
                        ForEach(intervalPresets, id: \.0) { label, val in
                            presetChip(label: label, value: val, binding: $model.bootLoopTime)
                        }
                    }
                }

                // 开机实例数量 * (去除多余 # 号与清除叉)
                FormFieldRow(label: "开机实例数量 *") {
                    AppTextField(text: $model.bootCount, placeholder: "1", allowClear: false)
                }

                // 每日抢机时段 (可选) (场景胶囊 + 实时大白话反馈条)
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

                    // 起止时间联动下拉框 (从 00:00 至 24:00)
                    HStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Text("从")
                                .font(.system(size: 11))
                                .foregroundColor(mutedText)
                            SelectMenu(
                                options: startHourOptions,
                                selection: Binding(
                                    get: { "\(parsedStartHour)" },
                                    set: { val in
                                        let newStart = Int(val ?? "0") ?? 0
                                        let curEnd = parsedEndHour
                                        let nextEnd = newStart >= curEnd ? min(24, newStart + 1) : curEnd
                                        model.bootDayGap = "\(newStart)-\(nextEnd)"
                                    }
                                ),
                                placeholder: "00:00",
                                width: 110,
                                allowClear: false
                            )
                        }

                        HStack(spacing: 6) {
                            Text("至")
                                .font(.system(size: 11))
                                .foregroundColor(mutedText)
                            SelectMenu(
                                options: endHourOptions(start: parsedStartHour),
                                selection: Binding(
                                    get: { "\(parsedEndHour)" },
                                    set: { val in
                                        let newEnd = Int(val ?? "24") ?? 24
                                        let curStart = parsedStartHour
                                        let nextStart = newEnd <= curStart ? max(0, newEnd - 1) : curStart
                                        model.bootDayGap = "\(nextStart)-\(newEnd)"
                                    }
                                ),
                                placeholder: "24:00",
                                width: 110,
                                allowClear: false
                            )
                        }
                        Spacer()
                    }

                    // 实时大白话状态反馈条 (全宽撑满 + 淡绿细边框 + 空心时钟图标)
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                            .foregroundColor(accent)
                        Text(timeRangeHint.text)
                            .font(.system(size: 11))
                            .foregroundColor(accent)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(accent.opacity(0.12))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(accent.opacity(0.25), lineWidth: 1)
                    )
                    }
                }
            }
        }
    }

    // ─── 6. 卡片 4：系统镜像与安全凭据 (imageCard) ─────────────────
    private var imageCard: some View {
        cardContainer(
            icon: "checkmark.shield.fill",
            iconColor: AppTheme.orange,
            title: "系统镜像与安全凭据",
            subtitle: "动态探测官方镜像与初始化 Root 密码"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                // 1. 操作系统镜像 *
                FormFieldRow(label: "操作系统镜像", required: true) {
                    if model.bootImagesLoading {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("正在实时探测该区域镜像…")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                        }
                        .frame(height: 32)
                    } else if let error = model.bootImagesError {
                        HStack(alignment: .center, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.danger)
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.danger)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            AppButton(title: "重试", systemImage: "arrow.clockwise", kind: .secondary) {
                                Task {
                                    let tid = Int64(model.bootSelectedRegionTenantId) ?? (tenant?.id ?? 0)
                                    await model.loadBootImages(tenantId: tid)
                                }
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(AppTheme.dangerSoft(dark))
                        )
                    } else if model.bootOSList.isEmpty {
                        Text("该区域暂无可用镜像")
                            .font(.system(size: 12))
                            .foregroundColor(mutedText)
                            .frame(height: 32)
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

                // 2. 镜像版本 * (纯净版本号，新版优先)
                if !model.bootVersions.isEmpty {
                    FormFieldRow(label: "镜像版本", required: true) {
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

                // 3. 镜像 OCID (只读展示，不可编辑，带复制按钮)
                FormFieldRow(label: "镜像 OCID") {
                    HStack(spacing: 8) {
                        AppTextField(
                            text: .constant(model.bootImageId.isEmpty ? "探测匹配中…" : model.bootImageId),
                            placeholder: "ocid1.image.oc1...",
                            leadingSystemImage: "doc.text"
                        )
                        .disabled(true)
                        if !model.bootImageId.isEmpty {
                            AppButton(title: "复制", systemImage: "doc.on.doc", kind: .secondary) {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(model.bootImageId, forType: .string)
                                ToastCenter.shared.success("已复制镜像 OCID 到剪贴板")
                            }
                        }
                    }
                }

                // 4. 实例 Root 初始密码 * (默认明文展示 + 眼睛显隐 + 随机按钮 + 4 档强度条)
                FormFieldRow(label: "实例 Root 初始密码", required: true) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            AppTextField(
                                text: $model.bootRootPassword,
                                placeholder: "root 初始密码 (至少8位)",
                                secure: isPasswordMasked,
                                leadingSystemImage: "key"
                            )
                            Button(action: { isPasswordMasked.toggle() }) {
                                Image(systemName: isPasswordMasked ? "eye" : "eye.slash")
                                    .font(.system(size: 12))
                                    .foregroundColor(mutedText)
                                    .frame(width: 28, height: 28)
                                    .background(RoundedRectangle(cornerRadius: 6).fill(AppInputStyle.fill(dark)))
                            }
                            .buttonStyle(PlainButtonStyle())
                            AppButton(title: "随机", systemImage: "arrow.clockwise", kind: .secondary) {
                                model.bootRootPassword = randomPassword()
                            }
                        }
                        // 4 档彩色密码强度条
                        HStack(spacing: 3) {
                            ForEach(0..<4) { idx in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(idx < passwordStrengthScore ? accent : Color.gray.opacity(0.3))
                                    .frame(height: 3)
                            }
                        }
                    }
                }

                // 5. 任务自定义备注
                FormFieldRow(label: "任务自定义备注") {
                    AppTextField(
                        text: $model.bootRemark,
                        placeholder: "如：新加坡-ARM-满血",
                        leadingSystemImage: "tag"
                    )
                }
            }
        }
    }

    // ─── 通用卡片外壳 (彻底拔除旧版 ModuleSettingsCard 底栏灰条！) ───────
    private func cardContainer<Content: View>(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(iconColor)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(primaryText)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(mutedText)
                }
            }
            content()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 10).fill(cardBg))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(cardBorder, lineWidth: 1))
    }

    // ─── 通用辅助控件 ───────────────────────────────────────────────
    private func numField(_ label: String, text: Binding<String>, disabled: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(primaryText)
            AppTextField(
                text: Binding(
                    get: { text.wrappedValue },
                    set: {
                        guard !disabled else { return }
                        text.wrappedValue = $0
                        selectedTemplateId = ""
                    }
                ),
                placeholder: "0"
            )
            .disabled(disabled)
            .opacity(disabled ? 0.65 : 1.0)
        }
        .frame(maxWidth: .infinity)
    }

    private func presetChip(label: String, value: String, binding: Binding<String>) -> some View {
        let active = binding.wrappedValue == value
        return Button(action: { binding.wrappedValue = value }) {
            Text(label)
                .font(.system(size: 11, weight: active ? .bold : .medium))
                .foregroundColor(active ? accent : primaryText)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(active ? accent.opacity(0.14) : AppInputStyle.fill(dark))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(active ? accent : cardBorder, lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }

    // ─── 逻辑与数据辅助方法 ──────────────────────────────────────────
    private func handleArchChange(_ arch: String) {
        guard model.bootArchitecture != arch else { return }
        model.bootArchitecture = arch
        if arch == "ARM" {
            applyTemplate(bootTemplates[2]) // ARM High
        } else {
            applyTemplate(bootTemplates[4]) // AMD Base
        }
        Task {
            let tid = Int64(model.bootSelectedRegionTenantId) ?? (tenant?.id ?? 0)
            await model.loadBootImages(tenantId: tid)
        }
    }

    private func applyTemplate(_ tpl: BootTemplate) {
        selectedTemplateId = tpl.id
        lastAppliedTemplateId = tpl.id
        selectedShape = tpl.shape
        model.bootOcpu = tpl.ocpu
        model.bootMemory = tpl.memory
        model.bootDisk = tpl.disk
        if let t = tenant {
            model.bootRemark = "\(t.tenantPrimaryName)-\(tpl.id)"
        }
    }

    private func handleShapeChange(_ shape: String) {
        selectedShape = shape
        if shape == BootPricingEstimator.microShape {
            model.bootOcpu = "1"
            model.bootMemory = "1"
            selectedTemplateId = "amd-base"
            lastAppliedTemplateId = "amd-base"
        } else if let match = visibleTemplates.first(where: { $0.shape == shape && $0.ocpu == model.bootOcpu && $0.memory == model.bootMemory }) {
            selectedTemplateId = match.id
            lastAppliedTemplateId = match.id
        } else {
            selectedTemplateId = ""
        }
    }

    private var parsedStartHour: Int {
        let raw = model.bootDayGap.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return 0 }
        let parts = raw.components(separatedBy: "-").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if parts.count == 2, parts[0] >= 0, parts[0] <= 23 { return parts[0] }
        return 0
    }

    private var parsedEndHour: Int {
        let raw = model.bootDayGap.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return 24 }
        let parts = raw.components(separatedBy: "-").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        if parts.count == 2, parts[1] >= 1, parts[1] <= 24 { return parts[1] }
        return 24
    }

    private var startHourOptions: [SelectOption] {
        (0...23).map { SelectOption(id: "\($0)", title: String(format: "%02d:00", $0)) }
    }

    private func endHourOptions(start: Int) -> [SelectOption] {
        ((start + 1)...24).map { SelectOption(id: "\($0)", title: String(format: "%02d:00", $0)) }
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
