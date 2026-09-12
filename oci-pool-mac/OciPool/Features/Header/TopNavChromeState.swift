import Foundation
import Combine

/// Coordinates mutually-exclusive in-window top-nav popovers.
/// Avoids SwiftUI `.popover` which escapes the app window and can glitch when two are adjacent.
enum TopNavDropdown: Equatable {
    case none
    case theme
    case accent
    case notifications
    case user
}

final class TopNavChromeState: ObservableObject {
    static let shared = TopNavChromeState()

    @Published var open: TopNavDropdown = .none

    func toggle(_ which: TopNavDropdown) {
        open = (open == which) ? .none : which
    }

    func close() {
        open = .none
    }
}
