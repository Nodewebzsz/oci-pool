import SwiftUI
import AppKit

/// 原生数据迁移（对齐 Web `/migration/migPage`）。
/// UI 标准：两列 `ModuleSettingsCard` 等宽等高。
struct MigrationView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = MigrationViewModel()

    @State private var isDragTargeted = false
    @State private var copiedKey = false

    private var dark: Bool { appearance.isDarkEffective }
    private let cardMinHeight: CGFloat = 360

    private var isEncFile: Bool {
        guard let url = model.selectedFileURL else { return true }
        return url.pathExtension.lowercased() != "sql"
    }

    private var canImport: Bool {
        guard let _ = model.selectedFileURL else { return false }
        if isEncFile {
            return !model.masterKeyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return true
    }

    var body: some View {
        PageScaffold(
            title: "数据迁移",
            subtitle: "加密备份 · 一键导出 · 密钥恢复",
            systemImage: "arrow.left.and.right",
            iconColor: AppTheme.info,
            toolbar: { EmptyView() },
            content: {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        EqualHeightCardRow(minHeight: cardMinHeight) {
                            exportCard
                        } second: {
                            importCard
                        }
                        if let key = model.lastMasterKey, !key.isEmpty {
                            masterKeyBanner(key)
                        }
                        if let status = model.statusText, !status.isEmpty {
                            Text(status)
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.sidebarText(dark))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .environmentObject(appearance)
    }

    private var exportCard: some View {
        ModuleSettingsCard(
            title: "数据导出",
            subtitle: "生成加密 .enc 备份",
            systemImage: "square.and.arrow.up",
            accent: AppTheme.sidebarActive,
            enabled: nil,
            minHeight: cardMinHeight
        ) {
            infoLine(icon: "lock.shield", text: "采用 AES-256 CBC 高强度动态加密，导出时生成一次性随机 Master Key。")
            infoLine(icon: "checkmark.seal", text: "备份覆盖租户凭据、出站代理、通知配置、备忘笔记及系统全局设置。")
            infoLine(icon: "shield.slash", text: "自动剔除临时心跳日志与运行时流量监控，备份轻量安全。")
            infoLine(icon: "key", text: "务必妥善保存导出的 Master Key，密钥丢失将无法解密恢复。")
        } footer: {
            AppButton(
                title: "导出加密备份",
                systemImage: "lock",
                kind: .primary,
                isLoading: model.isExporting
            ) {
                model.exportEncrypted()
            }
        }
    }

    private var importCard: some View {
        ModuleSettingsCard(
            title: "数据导入",
            subtitle: "上传 .enc 并填写密钥",
            systemImage: "square.and.arrow.down",
            accent: AccentPreset.orange.color,
            enabled: nil,
            minHeight: cardMinHeight
        ) {
            FormFieldRow(label: "备份文件 *") {
                Button(action: { model.pickImportFile() }) {
                    VStack(spacing: 8) {
                        if let name = model.selectedFileName {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(AppTheme.sidebarActive.opacity(0.12))
                                    .frame(width: 36, height: 36)
                                Image(systemName: "doc.zipper")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(AppTheme.sidebarActive)
                            }
                            VStack(spacing: 3) {
                                Text(name)
                                    .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
                                    .foregroundColor(dark ? .white : Color(hex: "1a202c"))
                                    .lineLimit(1)
                                if let size = model.selectedFileSizeText {
                                    Text(size)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(AppTheme.textTertiary(dark))
                                }
                            }
                            HStack(spacing: 12) {
                                Text("点击更换文件")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(AppTheme.sidebarActive)
                                Button(action: { model.clearImportFile() }) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "xmark.circle.fill")
                                        Text("清除")
                                    }
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(AppTheme.danger)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                            .padding(.top, 2)
                        } else {
                            ZStack {
                                Circle()
                                    .fill(AccentPreset.orange.color.opacity(0.1))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "arrow.up.doc")
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundColor(AccentPreset.orange.color)
                            }
                            VStack(spacing: 3) {
                                Text("拖拽备份文件到此处，或点击选择")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(dark ? Color.white.opacity(0.9) : Color.primary)
                                Text("支持 .enc 加密备份或 .sql 数据库文件")
                                    .font(.system(size: 10.5))
                                    .foregroundColor(AppTheme.textTertiary(dark))
                            }
                        }
                    }
                    .padding(.vertical, 14)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: 116)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isDragTargeted ? AccentPreset.orange.color.opacity(0.08) : AppTheme.sidebarHover(dark).opacity(0.6))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(
                                model.selectedFileName != nil
                                    ? AppTheme.sidebarActive.opacity(0.5)
                                    : (isDragTargeted ? AccentPreset.orange.color : AppTheme.border(dark)),
                                style: StrokeStyle(lineWidth: 1.2, dash: model.selectedFileName != nil ? [] : [5, 4])
                            )
                    )
                }
                .buttonStyle(PlainButtonStyle())
                .onDrop(of: ["public.file-url"], isTargeted: $isDragTargeted) { providers in
                    guard let first = providers.first else { return false }
                    _ = first.loadObject(ofClass: URL.self) { url, _ in
                        guard let fileURL = url else { return }
                        DispatchQueue.main.async {
                            model.setImportFile(url: fileURL)
                        }
                    }
                    return true
                }
            }
            FormFieldRow(label: isEncFile ? "Master Key *" : "Master Key") {
                AppTextField(
                    text: $model.masterKeyInput,
                    placeholder: isEncFile ? "解密 .enc 备份必需密钥" : "明文备份无需密钥",
                    secure: true,
                    leadingSystemImage: "key"
                )
            }
            Text("导入会覆盖当前库中相关数据，操作前请确认已备份。")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.sidebarText(dark))
                .fixedSize(horizontal: false, vertical: true)
        } footer: {
            AppButton(
                title: "开始导入",
                systemImage: "tray.and.arrow.down",
                kind: .primary,
                isLoading: model.isImporting,
                enabled: canImport
            ) {
                model.importEncrypted()
            }
        }
    }

    private func infoLine(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppTheme.sidebarActive)
                .frame(width: 16)
            Text(text)
                .font(.system(size: 12))
                .foregroundColor(AppTheme.sidebarText(dark))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func masterKeyBanner(_ key: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // 顶行：钥匙图标 + 标题 + 右侧复制按钮
            HStack(alignment: .center) {
                HStack(spacing: 6) {
                    Image(systemName: "key.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppTheme.sidebarActive)
                    Text("最近一次导出的 Master Key")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(dark ? Color.white.opacity(0.95) : Color(hex: "1a202c"))
                }
                Spacer()
                Button(action: {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(key, forType: NSPasteboard.PasteboardType.string)
                    copiedKey = true
                    ToastCenter.shared.success("已复制 Master Key")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                        copiedKey = false
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: copiedKey ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10.5, weight: .medium))
                        Text(copiedKey ? "已复制" : "复制密钥")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4.5)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(copiedKey ? AppTheme.sidebarActive.opacity(0.18) : AppTheme.sidebarBg(dark))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(copiedKey ? AppTheme.sidebarActive : AppTheme.border(dark), lineWidth: 1)
                    )
                    .foregroundColor(copiedKey ? AppTheme.sidebarActive : AppTheme.sidebarText(dark))
                }
                .buttonStyle(PlainButtonStyle())
            }

            // 中间层：独立等宽密钥槽（Code Box）
            HStack {
                Text(key)
                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                    .foregroundColor(AppTheme.sidebarActive)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(AppTheme.sidebarBg(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )

            // 底部：辅助安全说明
            Text("此密钥用于解密恢复该 .enc 备份文件，请妥善保存至密码管理器或安全介质中。")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.textTertiary(dark))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.sidebarHover(dark))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.sidebarActive.opacity(dark ? 0.45 : 0.35), lineWidth: 1)
        )
    }
}
