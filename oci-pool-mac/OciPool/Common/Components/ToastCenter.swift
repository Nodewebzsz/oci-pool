import Foundation
import Combine
import SwiftUI

enum ToastStyle {
    case info, success, warn, error
}

/// Lightweight error/info banner. Prefer `LoadingHUD` for action-in-progress feedback.
final class ToastCenter: ObservableObject {
    static let shared = ToastCenter()

    @Published private(set) var message: String?
    @Published private(set) var style: ToastStyle = .info

    private var hideTask: Task<Void, Never>?

    private init() {}

    /// 对齐 Web shell.showToast：success 带 ✓ 前缀、warn 用于删除/警告、error 用于失败。
    func show(_ text: String, style: ToastStyle = .error, duration: TimeInterval = 2.8) {
        let apply = { [weak self] in
            guard let self = self else { return }
            self.hideTask?.cancel()
            self.message = text
            self.style = style
            self.hideTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
                if !Task.isCancelled {
                    self.message = nil
                }
            }
        }
        if Thread.isMainThread {
            apply()
        } else {
            DispatchQueue.main.async(execute: apply)
        }
    }

    /// Web 成功 toast 带 ✓ 前缀
    func success(_ text: String) {
        show(text.hasPrefix("✓") ? text : "✓ " + text, style: .success)
    }

    /// Web 删除/警告 toast（warn 语义色）
    func warn(_ text: String) {
        show(text, style: .warn)
    }

    func error(_ text: String) { show(text, style: .error) }
}

struct ToastHost: View {
    @ObservedObject var center: ToastCenter = .shared

    @EnvironmentObject private var appearance: AppearanceController
    @Environment(\.colorScheme) private var colorScheme
    private var dark: Bool { appearance.isDarkEffective || colorScheme == .dark }

    var body: some View {
        VStack {
            if let message = center.message {
                Text(message)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(background)
                    .cornerRadius(10)
                    .shadow(color: Color.black.opacity(0.2), radius: 8, y: 3)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .padding(.top, 12)
            }
            Spacer()
        }
        .animation(.easeInOut(duration: 0.2), value: center.message)
        .allowsHitTesting(false)
    }

    private var background: Color {
        switch center.style {
        case .info: return AppTheme.info
        case .success: return AppTheme.sidebarActive
        case .warn: return AppTheme.orange
        case .error: return AppTheme.danger
        }
    }
}

/// Combined shell overlay: native spinner + error toast.
struct StatusOverlayHost: View {
    var body: some View {
        ZStack {
            LoadingHost()
            ToastHost()
        }
    }
}
