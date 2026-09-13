import AppKit
import SwiftUI
import Combine

/// Logged-in shell using pure autoresizing layout (no Auto Layout).
/// Top-nav dropdowns render in a full-window overlay so they stay inside the app.
final class MainShellViewController: NSViewController {
    private let session: AppSession
    private let navigation: NavigationState
    private let appearance: AppearanceController
    private let header = HeaderViewModel()
    private let chrome = TopNavChromeState.shared
    private var statusOverlayHost: DropdownHostingView?
    private var dropdownHost: DropdownHostingView?
    private var cancellables = Set<AnyCancellable>()

    private var topHost: NSHostingController<AnyView>!
    private var sidebarHost: NSHostingController<AnyView>!
    private var detail: ContentHostViewController!
    private var divider: NSView!

    private let topHeight: CGFloat = 52
    private let sidebarWidth: CGFloat = 188
    private let sidebarCollapsedWidth: CGFloat = 60
    private let dividerWidth: CGFloat = 1

    init(session: AppSession, navigation: NavigationState, appearance: AppearanceController = .shared) {
        self.session = session
        self.navigation = navigation
        self.appearance = appearance
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        let v = NSView(frame: NSRect(x: 0, y: 0, width: 1280, height: 800))
        v.wantsLayer = true
        v.autoresizingMask = [.width, .height]
        view = v
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let top = TopNavView()
            .environmentObject(session)
            .environmentObject(navigation)
            .environmentObject(appearance)
            .environmentObject(header)
            .environmentObject(chrome)
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 52, maxHeight: 52)
        topHost = NSHostingController(rootView: AnyView(top))

        let sidebarRoot = SidebarView()
            .environmentObject(navigation)
            .environmentObject(session)
            .environmentObject(appearance)
            .environmentObject(header)
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
        sidebarHost = NSHostingController(rootView: AnyView(sidebarRoot))

        detail = ContentHostViewController(session: session, navigation: navigation)

        divider = NSView()
        divider.wantsLayer = true
        divider.layer?.backgroundColor = NSColor.separatorColor.cgColor

        addChild(topHost)
        addChild(sidebarHost)
        addChild(detail)

        topHost.view.translatesAutoresizingMaskIntoConstraints = true
        sidebarHost.view.translatesAutoresizingMaskIntoConstraints = true
        detail.view.translatesAutoresizingMaskIntoConstraints = true
        divider.translatesAutoresizingMaskIntoConstraints = true
        view.addSubview(topHost.view)
        view.addSubview(sidebarHost.view)
        view.addSubview(divider)
        view.addSubview(detail.view)

        // Full-window dropdown overlay (above content, below toast)
        let overlay = TopNavDropdownOverlay(chrome: chrome, header: header)
            .environmentObject(session)
            .environmentObject(appearance)
            .environmentObject(navigation)
        let drop = DropdownHostingView(rootView: AnyView(overlay))
        drop.isInteractive = { [weak self] in
            guard let self = self else { return false }
            return self.chrome.open != .none
        }
        drop.translatesAutoresizingMaskIntoConstraints = true
        drop.autoresizingMask = [.width, .height]
        view.addSubview(drop)
        dropdownHost = drop

        // Loading HUD + error toast (blocks hits only while spinner is visible)
        let status = DropdownHostingView(rootView: AnyView(
            StatusOverlayHost().environmentObject(appearance)
        ))
        status.isInteractive = {
            LoadingHUD.shared.isVisible
        }
        status.translatesAutoresizingMaskIntoConstraints = true
        status.autoresizingMask = [.width, .height]
        status.frame = view.bounds
        view.addSubview(status)
        statusOverlayHost = status

        layoutChildren()

        navigation.$sidebarCollapsed
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.layoutChildren()
            }
            .store(in: &cancellables)

        // Close top-bar popovers and in-page floating menus when navigating.
        navigation.selectionDidChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.chrome.close()
                self?.header.closeMessages()
                // 清掉租户/实例/开机操作浮层，避免 catcher 残留挡死下一页
                FloatingMenuDismiss.all()
            }
            .store(in: &cancellables)
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        layoutChildren()
    }

    private func layoutChildren() {
        let b = view.bounds
        guard b.width > 1, b.height > 1 else { return }

        let collapsed = navigation.sidebarCollapsed
        let sideW: CGFloat = collapsed ? sidebarCollapsedWidth : sidebarWidth

        // Web 布局：左侧栏全高，顶栏在内容列上方，内容在顶栏下方。
        sidebarHost.view.frame = NSRect(x: 0, y: 0, width: sideW, height: b.height)
        divider.frame = NSRect(x: sideW, y: 0, width: dividerWidth, height: b.height)

        let contentX = sideW + dividerWidth
        let contentW = max(0, b.width - contentX)
        let contentH = max(0, b.height - topHeight)
        topHost.view.frame = NSRect(x: contentX, y: contentH, width: contentW, height: topHeight)
        detail.view.frame = NSRect(x: contentX, y: 0, width: contentW, height: contentH)

        dropdownHost?.frame = b
        statusOverlayHost?.frame = b
    }
}
