import SwiftUI
import AppKit

/// Boot modals: edit config / 原生添加抢机配置（禁止 WebEmbed）。
/// 开机详情与开机日志已改为 `BootDetailView` 整页，不在此弹框。
struct BootSheetHost: View {
    let sheet: BootSheet
    @ObservedObject var model: BootViewModel
    @EnvironmentObject private var appearance: AppearanceController
    @EnvironmentObject private var session: AppSession
    @Environment(\.presentationMode) private var presentationMode

    @State private var createShape: String = "VM.Standard.A1.Flex"
    @State private var editShape: String = "VM.Standard.A1.Flex"

    private var dark: Bool { appearance.isDarkEffective }
    private var primaryText: Color { AppSheetSurface.primaryText(dark) }
    private var mutedText: Color { AppSheetSurface.mutedText(dark) }

    var body: some View {
        switch sheet {
        case .editDetail:
            editSheet
        case .createConfig(let item):
            createConfigSheet(item)
        }
    }

    private func chrome<Content: View, Footer: View>(
        title: String,
        systemImage: String? = nil,
        width: CGFloat = 720,
        height: CGFloat = 520,
        @ViewBuilder footer: () -> Footer,
        @ViewBuilder content: () -> Content
    ) -> some View {
        AppSheetChrome(
            title: title,
            systemImage: systemImage,
            width: width,
            height: height,
            fixedSize: true,
            onClose: { presentationMode.wrappedValue.dismiss() },
            footer: footer,
            content: content
        )
    }

    // MARK: - Edit

    private var editSheet: some View {
        let spec = BootPricingEstimator.normalize(
            shape: editShape,
            ocpuText: model.editOcpu,
            memoryText: model.editMemory,
            diskText: model.editDisk
        )
        return chrome(title: "修改开机配置", systemImage: "slider.horizontal.3", width: 520, height: 580, footer: {
            HStack(spacing: 10) {
                AppButton(title: "恢复模板默认", systemImage: "arrow.counterclockwise", kind: .secondary) {
                    if editShape == BootPricingEstimator.microShape {
                        model.editOcpu = "1"
                        model.editMemory = "1"
                    } else {
                        model.editOcpu = "4"
                        model.editMemory = "24"
                    }
                    model.editDisk = "50"
                }
                Spacer()
                AppButton(title: "取消", kind: .secondary) {
                    presentationMode.wrappedValue.dismiss()
                }
                AppButton(title: "保存", kind: .primary, isLoading: model.formBusy, enabled: spec.validationError == nil) {
                    model.submitEditDetail()
                }
            }
        }) {
            VStack(alignment: .leading, spacing: 12) {
                FormFieldRow(label: "实例规格") {
                    HStack(spacing: 8) {
                        SelectMenu(
                            options: BootPricingEstimator.shapes(for: "ARM") + BootPricingEstimator.shapes(for: "AMD"),
                            selection: Binding(
                                get: { editShape },
                                set: { next in
                                    let s = next ?? BootPricingEstimator.armFreeFlexShape
                                    editShape = s
                                    if s == BootPricingEstimator.microShape {
                                        model.editOcpu = "1"
                                        model.editMemory = "1"
                                    }
                                }
                            ),
                            placeholder: "选择规格",
                            allowClear: false
                        )
                        if spec.isFreeFixed {
                            StatusBadge(text: "Always Free 固定规格", tone: .success)
                        }
                    }
                }
                FormFieldRow(label: "OCPU", required: true) {
                    AppTextField(text: $model.editOcpu, placeholder: "1")
                        .disabled(spec.locked)
                        .opacity(spec.locked ? 0.65 : 1.0)
                }
                FormFieldRow(label: "内存 (GB)", required: true) {
                    AppTextField(text: $model.editMemory, placeholder: "6")
                        .disabled(spec.locked)
                        .opacity(spec.locked ? 0.65 : 1.0)
                }
                FormFieldRow(label: "磁盘 (GB)", required: true) {
                    AppTextField(text: $model.editDisk, placeholder: "50")
                }
                if let vErr = spec.validationError {
                    Text(vErr)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(AppSheetSurface.accentRed(dark))
                }
                BootPricingEstimateCard(
                    shape: editShape,
                    ocpuText: model.editOcpu,
                    memoryText: model.editMemory,
                    diskText: model.editDisk
                )
                FormFieldRow(label: "循环间隔 (秒)", required: true) {
                    AppTextField(text: $model.editLoopTime, placeholder: "60")
                }
                FormFieldRow(label: "时段范围") {
                    AppTextField(text: $model.editDayGap, placeholder: "如 08:00-22:00")
                }
                FormFieldRow(label: "Root 密码", required: true) {
                    AppTextField(text: $model.editPassword, placeholder: "root 密码")
                }
                if let err = model.formError, !err.isEmpty {
                    Text(err)
                        .font(.system(size: 12))
                        .foregroundColor(AppSheetSurface.accentRed(dark))
                }
            }
        }
        .onAppear {
            let c = Int(model.editOcpu) ?? 1
            let m = Int(model.editMemory) ?? 6
            editShape = (c == 1 && m == 1) ? BootPricingEstimator.microShape : BootPricingEstimator.armFreeFlexShape
        }
    }

    // MARK: - Create config

    private func createConfigSheet(_ item: BootTaskItem) -> some View {
        let spec = BootPricingEstimator.normalize(
            shape: createShape,
            ocpuText: model.createOcpu,
            memoryText: model.createMemory,
            diskText: model.createDisk
        )
        return chrome(
            title: "添加抢机配置",
            systemImage: "plus.circle",
            width: 580,
            height: 660,
            footer: {
                HStack {
                    AppButton(title: "取消", kind: .secondary) { presentationMode.wrappedValue.dismiss() }
                    AppButton(title: "恢复模板默认", systemImage: "arrow.counterclockwise", kind: .secondary) {
                        if model.createArchitecture == "ARM" {
                            createShape = BootPricingEstimator.armFreeFlexShape
                            model.createOcpu = "4"
                            model.createMemory = "24"
                            model.createDisk = "50"
                        } else {
                            createShape = BootPricingEstimator.microShape
                            model.createOcpu = "1"
                            model.createMemory = "1"
                            model.createDisk = "50"
                        }
                    }
                    Spacer()
                    AppButton(
                        title: "保存任务",
                        systemImage: "checkmark",
                        kind: .primary,
                        isLoading: model.formBusy,
                        enabled: spec.validationError == nil
                    ) {
                        model.submitCreateConfig()
                    }
                }
            }
        ) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "person.2")
                        .foregroundColor(AppTheme.sidebarActive)
                    if item.tenantId == 0 {
                        // 工具栏「预开」：表单内选择租户（对齐 Web addBoot(null) 租户下拉）
                        SelectMenu(
                            options: model.parentTenants.map {
                                SelectOption(id: $0.id, title: model.tenantLabel($0))
                            },
                            selection: Binding(
                                get: { model.createTenantId > 0 ? String(model.createTenantId) : nil },
                                set: { v in model.createTenantId = Int64(v ?? "0") ?? 0 }
                            ),
                            placeholder: "请选择租户",
                            width: 300,
                            allowClear: false,
                            searchable: true
                        )
                    } else {
                        Text(item.displayTenant)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(primaryText)
                        if !item.regionName.isEmpty {
                            Text("· \(item.regionName)")
                                .font(.system(size: 12))
                                .foregroundColor(mutedText)
                        }
                    }
                    Spacer()
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 10).fill(AppSheetSurface.panelBg(dark)))

                FormFieldRow(label: "架构") {
                    HStack(spacing: 8) {
                        ForEach(["ARM", "AMD", "X86"], id: \.self) { arch in
                            Button(action: {
                                model.onCreateArchitectureChanged(arch)
                                if arch == "ARM" {
                                    createShape = BootPricingEstimator.armFreeFlexShape
                                    model.createOcpu = "4"
                                    model.createMemory = "24"
                                } else {
                                    createShape = BootPricingEstimator.microShape
                                    model.createOcpu = "1"
                                    model.createMemory = "1"
                                }
                            }) {
                                Text(arch)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(model.createArchitecture == arch ? appearance.accent.accentFg(dark) : primaryText)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(model.createArchitecture == arch
                                                  ? AppTheme.sidebarActive
                                                  : AppSheetSurface.panelBg(dark))
                                    )
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                        Spacer()
                        if model.createLoadingImages {
                            ProgressView().scaleEffect(0.7)
                        }
                    }
                }

                FormFieldRow(label: "实例规格") {
                    HStack(spacing: 8) {
                        SelectMenu(
                            options: BootPricingEstimator.shapes(for: model.createArchitecture),
                            selection: Binding(
                                get: { createShape },
                                set: { next in
                                    let s = next ?? BootPricingEstimator.shapes(for: model.createArchitecture).first?.id ?? BootPricingEstimator.armFreeFlexShape
                                    createShape = s
                                    if s == BootPricingEstimator.microShape {
                                        model.createOcpu = "1"
                                        model.createMemory = "1"
                                    }
                                }
                            ),
                            placeholder: "选择实例规格",
                            allowClear: false
                        )
                        if spec.isFreeFixed {
                            StatusBadge(text: "Always Free 固定规格", tone: .success)
                        }
                    }
                }

                HStack(spacing: 10) {
                    FormFieldRow(label: "OCPU", required: true) {
                        AppTextField(text: $model.createOcpu, placeholder: "1")
                            .disabled(spec.locked)
                            .opacity(spec.locked ? 0.65 : 1.0)
                    }
                    FormFieldRow(label: "内存 GB", required: true) {
                        AppTextField(text: $model.createMemory, placeholder: "6")
                            .disabled(spec.locked)
                            .opacity(spec.locked ? 0.65 : 1.0)
                    }
                    FormFieldRow(label: "磁盘 GB", required: true) {
                        AppTextField(text: $model.createDisk, placeholder: "50")
                    }
                }

                if let vErr = spec.validationError {
                    Text(vErr)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundColor(AppSheetSurface.accentRed(dark))
                }

                BootPricingEstimateCard(
                    shape: createShape,
                    ocpuText: model.createOcpu,
                    memoryText: model.createMemory,
                    diskText: model.createDisk,
                    countText: model.createCount
                )

                HStack(spacing: 10) {
                    FormFieldRow(label: "循环间隔(秒)", required: true) {
                        AppTextField(text: $model.createLoopTime, placeholder: "60")
                    }
                    FormFieldRow(label: "实例数量", required: true) {
                        AppTextField(text: $model.createCount, placeholder: "1")
                    }
                }

                FormFieldRow(label: "时段范围") {
                    AppTextField(text: $model.createDayGap, placeholder: "如 08:00-22:00，可空")
                }
                FormFieldRow(label: "Root 密码", required: true) {
                    AppTextField(text: $model.createPassword, placeholder: "root 密码", secure: true)
                }

                FormFieldRow(label: "操作系统", required: true) {
                    SelectMenu(
                        options: model.createOSList.map { SelectOption(id: $0, title: $0) },
                        selection: Binding(
                            get: { model.createSelectedOS.isEmpty ? nil : model.createSelectedOS },
                            set: { if let v = $0 { model.applyCreateOS(v) } }
                        ),
                        placeholder: model.createLoadingImages ? "加载镜像…" : "选择系统…",
                        width: 460,
                        enabled: !model.createOSList.isEmpty,
                        searchable: true
                    )
                }
                FormFieldRow(label: "系统版本", required: true) {
                    SelectMenu(
                        options: model.createVersions.map {
                            SelectOption(id: $0.operatingSystemVersion, title: $0.operatingSystemVersion)
                        },
                        selection: Binding(
                            get: { model.createSelectedVersion.isEmpty ? nil : model.createSelectedVersion },
                            set: { if let v = $0 { model.applyCreateVersion(v) } }
                        ),
                        placeholder: "选择版本…",
                        width: 460,
                        enabled: !model.createVersions.isEmpty
                    )
                }

                if !model.createImageId.isEmpty {
                    Text("镜像 ID：\(model.createImageId)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(mutedText)
                        .lineLimit(1)
                }

                if let err = model.formError, !err.isEmpty {
                    Text(err)
                        .font(.system(size: 12))
                        .foregroundColor(AppSheetSurface.accentRed(dark))
                }
            }
        }
        .onAppear {
            createShape = BootPricingEstimator.defaultShape(
                for: model.createArchitecture,
                ocpu: Int(model.createOcpu) ?? 1,
                memoryGb: Int(model.createMemory) ?? 6
            )
        }
    }
}
