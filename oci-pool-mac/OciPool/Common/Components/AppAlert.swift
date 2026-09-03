import AppKit

/// Unified confirm / message dialogs (replaces scattered NSAlert).
enum AppAlert {

    @discardableResult
    static func confirm(
        title: String,
        message: String,
        confirmTitle: String = "确定",
        cancelTitle: String = "取消",
        style: NSAlert.Style = .warning
    ) -> Bool {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = style
        alert.addButton(withTitle: confirmTitle)
        alert.addButton(withTitle: cancelTitle)
        return alert.runModal() == .alertFirstButtonReturn
    }

    static func info(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "好")
        alert.runModal()
    }

    /// Oracle API 开机风控确认：取消为默认按钮，确认后才允许提交。
    static func confirmOracleApiBootRisk() -> Bool {
        let alert = NSAlert()
        alert.messageText = "API 开机风控警告"
        alert.informativeText = "Oracle 已加强对 API 开机的风控。通过 API 创建实例极大概率触发风控，可能导致账号受限。"
        alert.alertStyle = .critical
        alert.addButton(withTitle: "取消")
        alert.addButton(withTitle: "已知晓风险，继续创建")
        return alert.runModal() == .alertSecondButtonReturn
    }

    static func error(title: String = "错误", message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "好")
        alert.runModal()
    }

    /// 带单行输入的确认框；取消返回 nil。
    static func prompt(
        title: String,
        message: String,
        defaultValue: String = "",
        placeholder: String = "",
        confirmTitle: String = "确定",
        cancelTitle: String = "取消"
    ) -> String? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: confirmTitle)
        alert.addButton(withTitle: cancelTitle)

        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.stringValue = defaultValue
        field.placeholderString = placeholder
        alert.accessoryView = field
        alert.window.initialFirstResponder = field

        guard alert.runModal() == .alertFirstButtonReturn else { return nil }
        return field.stringValue
    }
}
