import SwiftUI
import AppKit

/// 原生 MFA 备份（严格遵循 UI_STANDARD.md 第一章 DataList 标准表格与居中对齐规范）。
struct MfaBackupView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceController
    @StateObject private var model = MfaBackupViewModel()

    @State private var copiedItemId: String? = nil

    private var dark: Bool { appearance.isDarkEffective }

    // MARK: - 列宽计算结构体（严格遵循 UI_STANDARD.md 第一章对齐与比例标准）
    // 动态弹性池：账号分配约 28%（消除空池子），发行方分配约 22%，密钥分配约 50%（消除截断），杜绝某单列畸形超大
    private struct MfaColWidths {
        let account: CGFloat
        let issuer: CGFloat
        let secret: CGFloat
        let qr: CGFloat
        let otp: CGFloat
        let action: CGFloat
    }

    private func computeColWidths(tableWidth: CGFloat) -> MfaColWidths {
        let contentW = max(tableWidth - 28, 860) // 扣除表头与行两侧 14px 内边距
        let wQr: CGFloat = 85
        let wOtp: CGFloat = 160
        let wAction: CGFloat = 80
        let fixedSum = wQr + wOtp + wAction
        let flexPool = max(0, contentW - fixedSum)
        let wAccount = max(170, flexPool * 0.28)
        let wIssuer = max(130, flexPool * 0.22)
        let wSecret = flexPool - wAccount - wIssuer
        return MfaColWidths(
            account: wAccount,
            issuer: wIssuer,
            secret: max(280, wSecret),
            qr: wQr,
            otp: wOtp,
            action: wAction
        )
    }

    var body: some View {
        PageScaffold(
            title: "MFA 密钥备份",
            subtitle: "\(model.items.count) 个两步验证密钥",
            systemImage: "iphone",
            iconColor: AppTheme.sidebarActive, // 图标颜色跟随主题色
            toolbar: { toolbar },
            content: {
                VStack(spacing: 0) {
                    if let err = model.errorText, !err.isEmpty {
                        errorBanner(err)
                            .padding(.bottom, 12)
                    }

                    // 1. 顶部常驻控制台：定宽搜索框 + 30 秒平滑倒计时进度条
                    topBar
                        .padding(.bottom, 12)

                    // 2. 核心表格区域（严格对齐 BootView.swift 1.8 节：表头独立置顶 + 表体 ZStack 专属 Loading 区域 + 比例均衡列宽）
                    GeometryReader { geo in
                        let cols = computeColWidths(tableWidth: geo.size.width)
                        VStack(spacing: 0) {
                            // 2.1 表头独立置顶常驻（永远不随数据或 loading 被抹除，全居中）
                            HStack(spacing: 0) {
                                DataListColumnHeader(title: "账号", width: cols.account, alignment: .center)
                                DataListColumnHeader(title: "发行方", width: cols.issuer, alignment: .center)
                                DataListColumnHeader(title: "密钥", width: cols.secret, alignment: .center)
                                DataListColumnHeader(title: "二维码", width: cols.qr, alignment: .center)
                                DataListColumnHeader(title: "当前 OTP", width: cols.otp, alignment: .center)
                                DataListColumnHeader(title: "操作", width: cols.action, alignment: .center)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(AppTheme.sidebarHover(dark).opacity(0.65))
                            .overlay(
                                Rectangle()
                                    .frame(height: 1)
                                    .foregroundColor(AppTheme.border(dark).opacity(0.5)),
                                alignment: .bottom
                            )

                            // 2.2 表体专属 Loading / 空态 / 数据行区域（ZStack 撑满剩余全部垂直空间）
                            ZStack {
                                // 态 1：初次进入或数据为空加载中 -> 专属 Loading 区域撑满整表，杜绝空态闪现
                                if (!model.hasLoadedOnce || model.isLoading) && model.items.isEmpty {
                                    VStack(spacing: 12) {
                                        Spacer()
                                        ProgressView().scaleEffect(0.95)
                                        Text("正在加载 MFA 密钥…")
                                            .font(.system(size: 12))
                                            .foregroundColor(AppTheme.sidebarText(dark))
                                        Spacer()
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else if model.filtered.isEmpty {
                                    // 态 3：确认为空时的标准空状态（撑满整表）
                                    VStack(spacing: 14) {
                                        Spacer()
                                        Image(systemName: "key")
                                            .font(.system(size: 34))
                                            .foregroundColor(AppTheme.textTertiary(dark).opacity(0.5))
                                        Text(model.searchText.isEmpty ? "暂无 MFA 密钥 · 点右上「添加密钥」开始" : "无匹配结果")
                                            .font(.system(size: 12.5))
                                            .foregroundColor(AppTheme.textTertiary(dark))
                                        Spacer()
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else {
                                    // 态 4：正常数据行垂直滚动
                                    ScrollView {
                                        LazyVStack(spacing: 0) {
                                            ForEach(model.filtered) { item in
                                                DataListRow {
                                                    row(item, cols: cols)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        .background(AppTheme.sidebarBg(dark))
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(AppTheme.border(dark), lineWidth: 1)
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
        )
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .onReceive(NotificationCenter.default.publisher(for: .ociReloadCurrentPage)) { _ in
            Task { await model.reload() }
        }
        .sheet(item: $model.addForm) { _ in
            MfaAddSheet(model: model)
                .environmentObject(appearance)
        }
        .sheet(item: $model.qrPreviewItem) { item in
            MfaQrPreviewSheet(item: item, model: model)
                .environmentObject(appearance)
        }
        .environmentObject(appearance)
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            AppButton(title: "添加密钥", systemImage: "plus", kind: .primary) {
                model.openAdd()
            }
            AppButton(title: "导出全部", systemImage: "square.and.arrow.up", kind: .secondary) {
                model.exportCSV()
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

    // MARK: - 顶部常驻控制台

    private var topBar: some View {
        HStack(spacing: 14) {
            // 定宽搜索框
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.textTertiary(dark))
                TextField("按名称或发行方搜索...", text: $model.searchText)
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
            .frame(width: 260)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.sidebarHover(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )

            Spacer()

            // 30 秒流式平滑倒计时进度条
            HStack(spacing: 8) {
                Image(systemName: "clock")
                    .font(.system(size: 11))
                    .foregroundColor(model.countdown <= 5 ? AppTheme.danger : AppTheme.info)
                Text("动态码刷新")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundColor(dark ? Color.white.opacity(0.85) : Color(hex: "1a202c"))

                // 平滑进度条
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AppTheme.bg3(dark))
                        .frame(width: 110, height: 4)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(model.countdown <= 5 ? AppTheme.danger : AppTheme.sidebarActive)
                        .frame(width: max(0, 110 * CGFloat(model.countdown) / 30.0), height: 4)
                        .animation(.linear(duration: 1.0), value: model.countdown)
                }

                // 倒计时微胶囊
                Text("\(model.countdown)s")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1.5)
                    .background(
                        Capsule()
                            .fill(model.countdown <= 5 ? AppTheme.danger.opacity(0.16) : AppTheme.sidebarActive.opacity(0.14))
                    )
                    .foregroundColor(model.countdown <= 5 ? AppTheme.danger : AppTheme.sidebarActive)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppTheme.sidebarHover(dark))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(AppTheme.sidebarBg(dark))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.border(dark), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    // MARK: - 数据行（Row - 严格遵循 UI_STANDARD.md 第一章）

    private func row(_ item: MfaKeyItem, cols: MfaColWidths) -> some View {
        HStack(spacing: 0) {
            // 1. 账号 (keyName) - 规范 1.3: 居中对齐，适度分配宽度，单行打点截断 + .help 提示
            HStack {
                Spacer(minLength: 0)
                Text(item.keyName)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundColor(dark ? Color.white.opacity(0.92) : Color(hex: "1a202c"))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .help(item.keyName)
                Spacer(minLength: 0)
            }
            .frame(width: cols.account, alignment: .center)

            // 2. 发行方 (issuer) - 颜色跟随主题色，居中对齐
            HStack {
                Spacer()
                Text(item.issuer.isEmpty ? "mfa-oci-pool" : item.issuer)
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2.5)
                    .background(AppTheme.sidebarActive.opacity(0.12))
                    .foregroundColor(AppTheme.sidebarActive)
                    .cornerRadius(4)
                    .lineLimit(1)
                    .help(item.issuer.isEmpty ? "mfa-oci-pool" : item.issuer)
                Spacer()
            }
            .frame(width: cols.issuer, alignment: .center)

            // 3. 密钥 (secretKey - 充分获得分配的宽度，完美容纳 32 位 Base32 密钥)
            HStack(spacing: 0) {
                Button(action: { model.toggleSecret(item) }) {
                    Image(systemName: item.revealSecret ? "eye.slash" : "eye")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .frame(width: 26, height: 26)
                }
                .buttonStyle(PlainButtonStyle())
                .help(item.revealSecret ? "隐藏密钥" : "显示密钥")

                Text(item.revealSecret ? item.secretKey : "••••••••••••••••")
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundColor(item.revealSecret ? (dark ? Color.white : Color(hex: "1a202c")) : AppTheme.sidebarText(dark))
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.horizontal, 6)
                    .help(item.secretKey)

                Button(action: {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(item.secretKey, forType: NSPasteboard.PasteboardType.string)
                    ToastCenter.shared.success("已复制密钥")
                }) {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                        .frame(width: 26, height: 26)
                }
                .buttonStyle(PlainButtonStyle())
                .help("复制密钥")
            }
            .padding(.horizontal, 4)
            .frame(width: max(220, cols.secret - 16), height: 28)
            .background(
                RoundedRectangle(cornerRadius: 5)
                    .fill(AppTheme.sidebarHover(dark).opacity(0.7))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(AppTheme.border(dark), lineWidth: 1)
            )
            .frame(width: cols.secret, alignment: .center)

            // 4. 二维码 (qrCode - 居中对齐)
            HStack {
                Spacer()
                Button(action: { model.qrPreviewItem = item }) {
                    if let img = MfaBackupJSON.qrImage(from: item.qrCodeBase64) {
                        Image(nsImage: img)
                            .resizable()
                            .interpolation(.none)
                            .frame(width: 36, height: 36)
                            .cornerRadius(4)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(AppTheme.border(dark), lineWidth: 1)
                            )
                    } else {
                        ZStack {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(AppTheme.sidebarActive.opacity(0.12))
                                .frame(width: 36, height: 36)
                            Image(systemName: "qrcode")
                                .font(.system(size: 16))
                                .foregroundColor(AppTheme.sidebarActive)
                        }
                    }
                }
                .buttonStyle(PlainButtonStyle())
                .help("点击放大二维码扫码")
                Spacer()
            }
            .frame(width: cols.qr, alignment: .center)

            // 5. 当前 OTP (16px 粗体等宽 + 居中对齐 + 点击一键复制)
            HStack {
                Spacer()
                Button(action: {
                    model.copyOtp(item.otpCode)
                    copiedItemId = item.id
                    ToastCenter.shared.success("已复制动态码 \(item.otpCode)")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                        if copiedItemId == item.id { copiedItemId = nil }
                    }
                }) {
                    HStack(spacing: 8) {
                        Text(formatOtp(item.otpCode))
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundColor(copiedItemId == item.id ? AppTheme.sidebarActive : (dark ? Color.white : Color(hex: "1a202c")))

                        Text("\(model.countdown)s")
                            .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1.5)
                            .background(
                                Capsule()
                                    .fill(model.countdown <= 5 ? AppTheme.danger.opacity(0.18) : (dark ? Color(hex: "232a2f") : Color(hex: "e2e8f0")))
                            )
                            .foregroundColor(model.countdown <= 5 ? AppTheme.danger : AppTheme.sidebarText(dark))
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(copiedItemId == item.id ? AppTheme.sidebarActive.opacity(0.15) : (dark ? Color(hex: "151c21") : Color(hex: "f1f4f6")))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(copiedItemId == item.id ? AppTheme.sidebarActive.opacity(0.5) : AppTheme.border(dark), lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
                .help("点击复制动态码")
                Spacer()
            }
            .frame(width: cols.otp, alignment: .center)

            // 6. 操作 (删除) - 规范 1.4: 按钮固定 28x28，外层撑满列宽并水平居中
            HStack {
                Spacer()
                Button(action: { model.delete(item) }) {
                    Image(systemName: "trash")
                        .font(.system(size: 11.5))
                        .foregroundColor(AppTheme.danger)
                        .frame(width: 28, height: 28)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.danger.opacity(0.12))
                        )
                }
                .buttonStyle(PlainButtonStyle())
                .help("删除密钥")
                Spacer()
            }
            .frame(width: cols.action, alignment: .center)
        }
        .frame(minHeight: 52)
    }

    private func formatOtp(_ code: String) -> String {
        let clean = code.replacingOccurrences(of: " ", with: "")
        if clean.count == 6 {
            let p1 = clean.prefix(3)
            let p2 = clean.suffix(3)
            return "\(p1) \(p2)"
        }
        return code
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

// MARK: - 二维码大图预览弹窗（MfaQrPreviewSheet · 优化高度至 385px，彻底消除多余空白）

private struct MfaQrPreviewSheet: View {
    let item: MfaKeyItem
    @ObservedObject var model: MfaBackupViewModel
    @EnvironmentObject private var appearance: AppearanceController

    private var dark: Bool { appearance.isDarkEffective }

    var body: some View {
        AppSheetChrome(
            title: "MFA 二维码扫描",
            systemImage: "qrcode",
            width: 380,
            height: 385,                // 优化压缩高度，消除底部 50px 冗余空白
            fixedSize: true,            // 固定尺寸防抖
            scrollableContent: false,    // 彻底关闭内部滚动，杜绝滑动！
            onClose: { model.qrPreviewItem = nil },
            footer: {
                HStack(spacing: 8) {
                    AppButton(title: "复制密钥", systemImage: "doc.on.doc", kind: .secondary) {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(item.secretKey, forType: NSPasteboard.PasteboardType.string)
                        ToastCenter.shared.success("已复制密钥")
                    }
                    Spacer()
                    AppButton(title: "完成", kind: .primary) {
                        model.qrPreviewItem = nil
                    }
                }
            },
            content: {
                VStack(spacing: 10) {
                    if let img = MfaBackupJSON.qrImage(from: item.qrCodeBase64) {
                        Image(nsImage: img)
                            .resizable()
                            .interpolation(.none)
                            .frame(width: 165, height: 165)
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(AppTheme.border(dark), lineWidth: 1)
                            )
                            .shadow(color: Color.black.opacity(0.06), radius: 4, y: 2)
                    } else {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(AppTheme.sidebarHover(dark))
                                .frame(width: 165, height: 165)
                            Image(systemName: "qrcode")
                                .font(.system(size: 38))
                                .foregroundColor(AppTheme.textTertiary(dark))
                        }
                    }

                    VStack(spacing: 3) {
                        Text(item.keyName)
                            .font(.system(size: 14.5, weight: .bold))
                            .foregroundColor(dark ? .white : Color(hex: "1a202c"))
                            .lineLimit(1)
                        Text("发行方：" + item.issuer)
                            .font(.system(size: 11.5))
                            .foregroundColor(AppTheme.textSecondary(dark))
                            .lineLimit(1)
                    }

                    Text("请使用手机 Authenticator App 对准屏幕扫描")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
            }
        )
    }
}

// MARK: - 添加密钥弹窗（MfaAddSheet · 关闭滚动，固定尺寸零滑动）

private struct MfaAddSheet: View {
    @ObservedObject var model: MfaBackupViewModel
    @EnvironmentObject private var appearance: AppearanceController

    @State private var name: String = ""
    @State private var issuer: String = ""
    @State private var secret: String = ""
    @State private var otpauthUrl: String = ""

    private var dark: Bool { appearance.isDarkEffective }
    private var canSubmit: Bool {
        !secret.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        AppSheetChrome(
            title: "添加 MFA 密钥",
            systemImage: "lock.shield",
            width: 490,
            height: 450,
            fixedSize: true,            // 固定尺寸防抖
            scrollableContent: false,    // 彻底关闭内部滚动，杜绝滑动！
            onClose: { model.addForm = nil },
            footer: {
                HStack(spacing: 8) {
                    AppButton(title: "取消", kind: .secondary) {
                        model.addForm = nil
                    }
                    AppButton(
                        title: "保存密钥",
                        systemImage: "square.and.arrow.down",
                        kind: .primary,
                        isLoading: model.isSaving,
                        enabled: canSubmit
                    ) {
                        model.saveAdd(name: name, secret: secret, issuer: issuer)
                    }
                }
            },
            content: {
                VStack(alignment: .leading, spacing: 14) {
                    // 智能解析输入
                    FormFieldRow(label: "智能粘贴链接") {
                        AppTextField(
                            text: $otpauthUrl,
                            placeholder: "粘贴 otpauth://totp/... 链接可自动识别",
                            leadingSystemImage: "link"
                        )
                        .onChange(of: otpauthUrl) { url in
                            if let parsed = model.smartParse(urlText: url) {
                                if name.isEmpty { name = parsed.name }
                                if issuer.isEmpty { issuer = parsed.issuer }
                                secret = parsed.secret
                                ToastCenter.shared.success("已自动提取密钥与账号名称")
                            }
                        }
                    }

                    HStack(spacing: 12) {
                        FormFieldRow(label: "账号名称") {
                            AppTextField(
                                text: $name,
                                placeholder: "留空则使用时间戳",
                                leadingSystemImage: "tag"
                            )
                        }

                        FormFieldRow(label: "发行方") {
                            AppTextField(
                                text: $issuer,
                                placeholder: "例如 Oracle Cloud",
                                leadingSystemImage: "building.2"
                            )
                        }
                    }

                    FormFieldRow(label: "密钥 (Base32) *") {
                        AppTextField(
                            text: $secret,
                            placeholder: "例如 JBSWY3DPEHPK3PXP",
                            leadingSystemImage: "key"
                        )
                    }

                    Text("支持输入 16 位或 32 位 Base32 密钥，系统将自动去除空格并校验。")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.textTertiary(dark))
                }
            }
        )
    }
}
