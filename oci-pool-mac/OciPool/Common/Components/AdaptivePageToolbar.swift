import SwiftUI

/// Keeps action order while wrapping at the available content width.
struct AdaptivePageToolbar<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        if #available(macOS 13.0, *) {
            PageToolbarLayout(spacing: 8) { content() }
        } else {
            ScrollView(.horizontal, showsIndicators: true) {
                HStack(spacing: 8) { content() }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }
}

enum ToolbarPacking {
    static func arrange(sizes: [CGSize], width: CGFloat, spacing: CGFloat) -> (frames: [CGRect], size: CGSize) {
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var rowStart = 0
        var usedWidth: CGFloat = 0
        let limit = max(1, width)
        func alignRow(_ range: Range<Int>, height: CGFloat) {
            for index in range {
                let offset = (height - frames[index].height) * 0.5
                if offset > 0 {
                    frames[index].origin.y += offset
                }
            }
        }
        for size in sizes {
            let itemWidth = min(size.width, limit)
            if x > 0 && x + itemWidth > limit {
                alignRow(rowStart..<frames.count, height: rowHeight)
                rowStart = frames.count
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(x: x, y: y, width: itemWidth, height: size.height))
            usedWidth = max(usedWidth, x + itemWidth)
            rowHeight = max(rowHeight, size.height)
            x += itemWidth + spacing
        }
        alignRow(rowStart..<frames.count, height: rowHeight)
        return (frames, CGSize(width: usedWidth, height: frames.isEmpty ? 0 : y + rowHeight))
    }
}

@available(macOS 13.0, *)
private struct PageToolbarLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let idealWidth = sizes.reduce(0) { $0 + $1.width } + CGFloat(max(0, sizes.count - 1)) * spacing
        return ToolbarPacking.arrange(sizes: sizes, width: proposal.width ?? idealWidth, spacing: spacing).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let frames = ToolbarPacking.arrange(
            sizes: subviews.map { $0.sizeThatFits(.unspecified) }, width: bounds.width, spacing: spacing
        ).frames
        for (subview, frame) in zip(subviews, frames) {
            subview.place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                          anchor: .topLeading, proposal: ProposedViewSize(frame.size))
        }
    }
}
