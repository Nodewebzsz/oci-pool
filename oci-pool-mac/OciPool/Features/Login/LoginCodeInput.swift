import SwiftUI

/// 6 格数字验证码输入 — 对齐 Web page-auth VerifyView：
/// 48×56 / radius 8 / mono 22 semibold / 填充后 bg-1 + accent 边框。
/// macOS 11 兼容：透明 AppNSTextField 捕获键盘（自动支持跳格/退格/粘贴），
/// 前景仅按文本渲染 6 个样式格。
struct LoginCodeInput: View {
    @Binding var text: String
    var dark: Bool
    var enabled: Bool = true
    var onCommit: (() -> Void)? = nil
    var shakeToken: Int = 0

    @State private var shakeX: CGFloat = 0

    private var accent: Color { LoginPalette.primary(dark) }
    private var filledBg: Color { Color(hex: dark ? "0d1216" : "ffffff") }
    private var emptyBg: Color { Color(hex: dark ? "151c21" : "f1f4f6") }
    private var borderColor: Color { Color(hex: dark ? "232a2f" : "d9dfe3") }
    private var textColor: Color { Color(hex: dark ? "f6f9fb" : "0c1217") }

    private var digits: [Character] {
        Array(text.filter { $0.isNumber }.prefix(6))
    }

    var body: some View {
        ZStack {
            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { i in
                    codeCell(i)
                }
            }

            AppNSTextField(
                text: digitBinding,
                placeholder: "",
                secure: false,
                dark: dark,
                enabled: enabled,
                fontSize: 24,
                isFocused: .constant(false),
                onCommit: { onCommit?() }
            )
            .opacity(0.02)
            .frame(height: 56)
            .contentShape(Rectangle())
        }
        .disabled(!enabled)
        .offset(x: shakeX)
        .onChange(of: shakeToken) { _ in
            // Web `.input-shake` 等效：短促左右位移动画
            withAnimation(.easeOut(duration: 0.08)) { shakeX = -6 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                withAnimation(.easeOut(duration: 0.08)) { shakeX = 6 }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
                withAnimation(.easeOut(duration: 0.08)) { shakeX = 0 }
            }
        }
    }

    private func codeCell(_ i: Int) -> some View {
        let chars = digits
        let value = i < chars.count ? String(chars[i]) : ""
        return ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(value.isEmpty ? emptyBg : filledBg)
            Text(value)
                .font(.system(size: 22, weight: .semibold, design: .monospaced))
                .foregroundColor(textColor)
        }
        .frame(width: 48, height: 56)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(value.isEmpty ? borderColor : accent, lineWidth: 1)
        )
    }

    private var digitBinding: Binding<String> {
        Binding<String>(
            get: { String(digits) },
            set: { newValue in
                // Web VerifyView：输满 6 位不自动提交，由「验证」按钮/回车触发
                text = String(newValue.filter { $0.isNumber }.prefix(6))
            }
        )
    }
}
