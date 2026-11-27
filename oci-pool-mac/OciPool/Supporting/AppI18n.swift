import Foundation
import AppKit
import Combine

extension Notification.Name {
    static let ociLocaleDidChange = Notification.Name("ociLocaleDidChange")
}

/// Global bilingual localization store (zh_CN / en_US).
/// Changing `locale` immediately triggers `AppearanceController.shared.objectWillChange`
/// so all mounted SwiftUI views re-render in place without resetting ViewModel state.
final class AppI18n: ObservableObject {
    static let shared = AppI18n()

    private static let localeKey = "appLocale"

    @Published private(set) var locale: AppLocale

    private let lock = NSLock()
    private var cachedDict: [String: String]?

    private init() {
        if let raw = UserDefaults.standard.string(forKey: Self.localeKey),
           let saved = AppLocale(rawValue: raw) {
            self.locale = saved
        } else {
            self.locale = .zhCN
        }
    }

    var isEnglish: Bool { locale == .enUS }
    var isChinese: Bool { locale != .enUS }

    func setLocale(_ newLocale: AppLocale) {
        guard locale != newLocale else { return }
        UserDefaults.standard.set(newLocale.rawValue, forKey: Self.localeKey)
        let apply = {
            self.locale = newLocale
            AppearanceController.shared.objectWillChange.send()
            MenuBuilder.install()
            NotificationCenter.default.post(name: .ociLocaleDidChange, object: newLocale)
        }
        if Thread.isMainThread {
            apply()
        } else {
            DispatchQueue.main.async(execute: apply)
        }
    }

    func toggleLocale() {
        setLocale(isEnglish ? .zhCN : .enUS)
    }

    private func loadDictionary() -> [String: String] {
        lock.lock()
        defer { lock.unlock() }
        if let existing = cachedDict {
            return existing
        }
        var loaded: [String: String] = [:]
        if let url = Bundle.main.url(forResource: "i18n-en", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let map = try? JSONDecoder().decode([String: String].self, from: data) {
            loaded = map
        }
        cachedDict = loaded
        return loaded
    }

    static func containsCJK(_ text: String) -> Bool {
        for scalar in text.unicodeScalars {
            let v = scalar.value
            if (0x4E00...0x9FFF).contains(v)
                || (0x3400...0x4DBF).contains(v)
                || (0x3000...0x303F).contains(v)
                || (0xFF00...0xFFEF).contains(v) {
                return true
            }
        }
        return false
    }

    func translate(_ raw: String) -> String {
        guard isEnglish, !raw.isEmpty, Self.containsCJK(raw) else { return raw }
        let dict = loadDictionary()
        if let exact = dict[raw] {
            return exact
        }

        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed != raw, !trimmed.isEmpty {
            let leading = String(raw.prefix(while: { $0.isWhitespace || $0.isNewline }))
            let trailing = String(raw.reversed().prefix(while: { $0.isWhitespace || $0.isNewline }).reversed())
            let inner = translateCore(trimmed, dict: dict)
            return leading + inner + trailing
        }

        return translateCore(raw, dict: dict)
    }

    private func translateCore(_ text: String, dict: [String: String]) -> String {
        if let exact = dict[text] {
            return exact
        }

        let suffixPairs: [(String, String)] = [
            ("：", ":"),
            (":", ":"),
            ("…", "..."),
            ("...", "..."),
            (" *", " *"),
            ("*", "*"),
            ("？", "?"),
            ("！", "!"),
            ("。", "."),
            (" (主区域)", " (Home)"),
            (" [主区域]", " [Home]"),
            ("（主区域）", " (Home)"),
            (" · 主区域", " · Home"),
            (" · 主", " · Home")
        ]
        for (zhSuffix, enSuffix) in suffixPairs {
            if text.hasSuffix(zhSuffix), text.count > zhSuffix.count {
                let base = String(text.dropLast(zhSuffix.count))
                let translatedBase = translateCore(base, dict: dict)
                if translatedBase != base || !Self.containsCJK(base) {
                    return translatedBase + enSuffix
                }
            }
        }

        if let patterned = translatePatterns(text, dict: dict) {
            return patterned
        }

        let colonPrefixes: [(String, String)] = [
            ("加载失败：", "Load failed: "),
            ("加载失败:", "Load failed:"),
            ("加载失败 ", "Load failed "),
            ("保存失败：", "Save failed: "),
            ("保存失败:", "Save failed:"),
            ("操作失败：", "Operation failed: "),
            ("操作失败:", "Operation failed:"),
            ("删除失败：", "Delete failed: "),
            ("删除失败:", "Delete failed:"),
            ("创建失败：", "Create failed: "),
            ("创建失败:", "Create failed:"),
            ("更新失败：", "Update failed: "),
            ("更新失败:", "Update failed:"),
            ("请求失败：", "Request failed: "),
            ("请求失败:", "Request failed:"),
            ("启动失败：", "Start failed: "),
            ("启动失败:", "Start failed:"),
            ("停止失败：", "Stop failed: "),
            ("停止失败:", "Stop failed:"),
            ("导入失败：", "Import failed: "),
            ("导入失败:", "Import failed:"),
            ("导出失败：", "Export failed: "),
            ("导出失败:", "Export failed:"),
            ("连接失败：", "Connection failed: "),
            ("连接失败:", "Connection failed:"),
            ("检测失败：", "Check failed: "),
            ("检测失败:", "Check failed:"),
            ("提交失败：", "Submit failed: "),
            ("提交失败:", "Submit failed:"),
            ("发送失败：", "Send failed: "),
            ("发送失败:", "Send failed:"),
            ("同步失败：", "Sync failed: "),
            ("同步失败:", "Sync failed:"),
            ("登录失败 ", "Login failed "),
            ("登录失败：", "Login failed: "),
            ("启动 Java 失败：", "Failed to start Java: "),
            ("页面加载失败: ", "Page load failed: "),
            ("页面错误: ", "Page error: "),
            ("已断开：", "Disconnected: "),
            ("断开: ", "Disconnected: "),
            ("已复制：", "Copied: "),
            ("已复制 ", "Copied "),
            ("已复制连接地址 · ", "Copied address · "),
            ("✓ 已复制 · ", "✓ Copied · "),
            ("当前云：", "Cloud: "),
            ("欢迎，", "Welcome, "),
            ("欢迎,", "Welcome, "),
            ("出口 IP：", "Exit IP: "),
            ("公网 IP：", "Public IP: "),
            ("镜像 ID：", "Image ID: "),
            ("检测于 ", "Checked at "),
            ("更新于 ", "Updated at "),
            ("更新：", "Updated: "),
            ("更新:", "Updated:"),
            ("来源：", "Source: "),
            ("来源:", "Source:"),
            ("操作人：", "Operator: "),
            ("操作人:", "Operator:"),
            ("解封：", "Unban: "),
            ("解封:", "Unban:"),
            ("系统：", "OS: "),
            ("系统:", "OS:"),
            ("实例：", "Instance: "),
            ("实例:", "Instance:"),
            ("响应状态：", "Response status: "),
            ("VPUs 性能档位: ", "VPUs Tier: "),
            ("当前密码策略状态: ", "Password policy: "),
            ("备注：", "Remark: "),
            ("备注:", "Remark:"),
            ("原因：", "Reason: "),
            ("原因:", "Reason:"),
            ("状态：", "Status: "),
            ("状态:", "Status:"),
            ("错误：", "Error: "),
            ("错误:", "Error:"),
            ("路径：", "Path: "),
            ("路径:", "Path:"),
            ("端口：", "Port: "),
            ("端口:", "Port:"),
            ("主机：", "Host: "),
            ("主机:", "Host:"),
            ("区域：", "Region: "),
            ("区域:", "Region:"),
            ("租户：", "Tenant: "),
            ("租户:", "Tenant:"),
            ("邮箱：", "Email: "),
            ("邮箱:", "Email:"),
            ("名称：", "Name: "),
            ("名称:", "Name:"),
            ("类型：", "Type: "),
            ("类型:", "Type:"),
            ("版本：", "Version: "),
            ("版本:", "Version:"),
            ("信息密度: ", "Density: "),
            ("强度 ", "Strength "),
            ("优先级 ", "Priority "),
            ("↑ 新版 v", "↑ New v")
        ]
        for (zhPre, enPre) in colonPrefixes {
            if text.hasPrefix(zhPre) {
                let rest = String(text.dropFirst(zhPre.count))
                return enPre + translateCore(rest, dict: dict)
            }
        }

        if text.hasSuffix(" 已复制") {
            let prefix = String(text.dropLast(" 已复制".count))
            return translateCore(prefix, dict: dict) + " copied"
        }

        if text.hasPrefix("· "), text.count > 2 {
            let rest = String(text.dropFirst(2))
            let translatedRest = translateCore(rest, dict: dict)
            if translatedRest != rest {
                return "· " + translatedRest
            }
        }

        if text.contains("\n") {
            let lines = text.components(separatedBy: "\n")
            let mapped = lines.map { line -> String in
                line.isEmpty ? "" : translateCore(line, dict: dict)
            }
            let joined = mapped.joined(separator: "\n")
            if joined != text {
                return joined
            }
        }

        for sep in [" · ", " — ", " / "] {
            if text.contains(sep) {
                let parts = text.components(separatedBy: sep)
                var changed = false
                let translated = parts.map { part -> String in
                    let p = part.trimmingCharacters(in: .whitespaces)
                    let t = translateCore(p, dict: dict)
                    if t != p { changed = true }
                    return t
                }
                if changed {
                    return translated.joined(separator: sep)
                }
            }
        }

        if text.contains("·") {
            let parts = text.components(separatedBy: "·")
            var changed = false
            let translated = parts.map { part -> String in
                let p = part.trimmingCharacters(in: .whitespaces)
                let t = translateCore(p, dict: dict)
                if t != p { changed = true }
                return t
            }
            if changed {
                return translated.joined(separator: " · ")
            }
        }

        return text
    }

    private func translatePatterns(_ text: String, dict: [String: String]) -> String? {
        let rules = Self.compiledRules
        let ns = text as NSString
        let fullRange = NSRange(location: 0, length: ns.length)
        let sub: (String) -> String = { part in
            self.translateCore(part, dict: dict)
        }
        for (regex, builder) in rules {
            if let match = regex.firstMatch(in: text, options: [], range: fullRange) {
                return builder(match, ns, sub)
            }
        }
        return nil
    }

    private static let compiledRules: [(NSRegularExpression, (NSTextCheckingResult, NSString, (String) -> String) -> String)] = {
        func rule(_ pattern: String, _ builder: @escaping (NSTextCheckingResult, NSString, (String) -> String) -> String) -> (NSRegularExpression, (NSTextCheckingResult, NSString, (String) -> String) -> String) {
            (try! NSRegularExpression(pattern: pattern, options: []), builder)
        }
        func g(_ m: NSTextCheckingResult, _ ns: NSString, _ idx: Int) -> String {
            ns.substring(with: m.range(at: idx))
        }
        return [
            rule("^(\\$[0-9.,]+)\\s*/\\s*月$") { m, ns, _ in "\(g(m, ns, 1)) / mo" },
            rule("^(\\$[0-9.,]+)\\s*/\\s*GB·月$") { m, ns, _ in "\(g(m, ns, 1)) / GB·mo" },
            rule("^共\\s*([0-9,+]+)\\s*条\\s*([0-9,]+/[0-9,]+)$") { m, ns, _ in "Total \(g(m, ns, 1)) · \(g(m, ns, 2))" },
            rule("^共\\s*([0-9,+]+)\\s*条$") { m, ns, _ in "Total \(g(m, ns, 1))" },
            rule("^共\\s*([0-9,+]+)\\s*台$") { m, ns, _ in "\(g(m, ns, 1)) instances" },
            rule("^共\\s*([0-9,+]+)\\s*项$") { m, ns, _ in "Total \(g(m, ns, 1))" },
            rule("^共\\s*([0-9,+]+)\\s*个$") { m, ns, _ in "Total \(g(m, ns, 1))" },
            rule("^共\\s*([0-9,+]+)\\s*个实例$") { m, ns, _ in "\(g(m, ns, 1)) instances" },
            rule("^共\\s*([0-9,+]+)\\s*组抢机任务$") { m, ns, _ in "\(g(m, ns, 1)) boot tasks" },
            rule("^共\\s*([0-9,+]+)\\s*组任务$") { m, ns, _ in "\(g(m, ns, 1)) task groups" },
            rule("^共\\s*([0-9,+]+)\\s*组$") { m, ns, _ in "\(g(m, ns, 1)) groups" },
            rule("^共\\s*([0-9,+]+)\\s*条配额$") { m, ns, _ in "\(g(m, ns, 1)) quotas" },
            rule("^共\\s*([0-9,+]+)\\s*个卷$") { m, ns, _ in "\(g(m, ns, 1)) volumes" },
            rule("^共\\s*([0-9,+]+)\\s*个区域$") { m, ns, _ in "\(g(m, ns, 1)) regions" },
            rule("^共\\s*([0-9,+]+)\\s*个收件人，系统通知将发送至全部邮箱$") { m, ns, _ in
                "\(g(m, ns, 1)) recipients — system notifications will be sent to all emails"
            },
            rule("^共\\s*([0-9,+]+)\\s*个收件人$") { m, ns, _ in "\(g(m, ns, 1)) recipients" },
            rule("^([0-9,]+)\\s*条$") { m, ns, _ in "\(g(m, ns, 1)) items" },
            rule("^([0-9,]+)\\s*项$") { m, ns, _ in "\(g(m, ns, 1)) items" },
            rule("^([0-9,]+)\\s*个$") { m, ns, _ in "\(g(m, ns, 1))" },
            rule("^([0-9,]+)\\s*台$") { m, ns, _ in "\(g(m, ns, 1)) instances" },
            rule("^([0-9,]+)\\s*次$") { m, ns, _ in "\(g(m, ns, 1)) runs" },
            rule("^([0-9,]+)\\s*处$") { m, ns, _ in "\(g(m, ns, 1)) matches" },
            rule("^([0-9,]+)\\s*字符$") { m, ns, _ in "\(g(m, ns, 1)) chars" },
            rule("^([0-9,]+)\\s*字$") { m, ns, _ in "\(g(m, ns, 1)) chars" },
            rule("^([0-9,]+)\\s*天前$") { m, ns, _ in "\(g(m, ns, 1))d ago" },
            rule("^([0-9,]+)\\s*小时前$") { m, ns, _ in "\(g(m, ns, 1))h ago" },
            rule("^([0-9,]+)\\s*分钟前$") { m, ns, _ in "\(g(m, ns, 1))m ago" },
            rule("^([0-9,]+)\\s*秒前$") { m, ns, _ in "\(g(m, ns, 1))s ago" },
            rule("^([0-9.]+)\\s*天$") { m, ns, _ in "\(g(m, ns, 1))d" },
            rule("^([0-9.]+)\\s*小时$") { m, ns, _ in "\(g(m, ns, 1))h" },
            rule("^([0-9.]+)\\s*分钟$") { m, ns, _ in "\(g(m, ns, 1))m" },
            rule("^([0-9.]+)\\s*分$") { m, ns, _ in "\(g(m, ns, 1))m" },
            rule("^([0-9.]+)\\s*秒$") { m, ns, _ in "\(g(m, ns, 1))s" },
            rule("^已选\\s*([0-9,]+)/([0-9,]+)\\s*项$") { m, ns, _ in "\(g(m, ns, 1))/\(g(m, ns, 2)) selected" },
            rule("^已选\\s*([0-9,]+)\\s*个区域$") { m, ns, _ in "\(g(m, ns, 1)) regions selected" },
            rule("^已选\\s*([0-9,]+)\\s*[条项个台人]?$") { m, ns, _ in "\(g(m, ns, 1)) selected" },
            rule("^全选（共\\s*([0-9,]+)\\s*个区域）$") { m, ns, _ in "Select All (\(g(m, ns, 1)) regions)" },
            rule("^删除所选\\s*\\(([0-9,]+)\\)$") { m, ns, _ in "Delete Selected (\(g(m, ns, 1)))" },
            rule("^第\\s*([0-9,]+)\\s*/\\s*([0-9,]+)\\s*页$") { m, ns, _ in "Page \(g(m, ns, 1)) / \(g(m, ns, 2))" },
            rule("^第\\s*([0-9,]+)\\s*页，共\\s*([0-9,]+)\\s*条$") { m, ns, _ in "Page \(g(m, ns, 1)), Total \(g(m, ns, 2))" },
            rule("^第\\s*([0-9,]+)\\s*页$") { m, ns, _ in "Page \(g(m, ns, 1))" },
            rule("^每页\\s*([0-9,]+)\\s*条$") { m, ns, _ in "\(g(m, ns, 1)) / page" },
            rule("^([0-9,]+)\\s*条/页$") { m, ns, _ in "\(g(m, ns, 1)) / page" },
            rule("^有效主账号\\s*([0-9,]+)\\s*个$") { m, ns, _ in "\(g(m, ns, 1)) Active Home Accounts" },
            rule("^主区域账号\\s*([0-9,]+)\\s*个$") { m, ns, _ in "\(g(m, ns, 1)) Home-Region Accounts" },
            rule("^失效\\s*([0-9,]+)\\s*个（已排除）$") { m, ns, _ in "\(g(m, ns, 1)) inactive (excluded)" },
            rule("^待同步主体\\s*([0-9,]+)\\s*个$") { m, ns, _ in "\(g(m, ns, 1)) pending entity sync" },
            rule("^升级\\s*([0-9,]+)\\s*·\\s*免费\\s*([0-9,]+)\\s*·\\s*未知\\s*([0-9,]+)$") { m, ns, _ in
                "PAYG \(g(m, ns, 1)) · Free \(g(m, ns, 2)) · Unknown \(g(m, ns, 3))"
            },
            rule("^升级\\s*([0-9,]+)\\s*·\\s*免费\\s*([0-9,]+)$") { m, ns, _ in
                "PAYG \(g(m, ns, 1)) · Free \(g(m, ns, 2))"
            },
            rule("^满半年\\s*([0-9,]+)\\s*·\\s*满一年\\s*([0-9,]+)$") { m, ns, _ in
                "6m+ \(g(m, ns, 1)) · 1y+ \(g(m, ns, 2))"
            },
            rule("^多区账号\\s*([0-9,]+)\\s*/\\s*([0-9,]+)$") { m, ns, _ in
                "Multi-region \(g(m, ns, 1)) / \(g(m, ns, 2))"
            },
            rule("^通知\\s*·\\s*([0-9,]+)\\s*条未读$") { m, ns, _ in
                "Notifications · \(g(m, ns, 1)) unread"
            },
            rule("^已订阅\\s*([0-9,]+)\\s*/\\s*([0-9,]+)$") { m, ns, _ in
                "Subscribed \(g(m, ns, 1)) / \(g(m, ns, 2))"
            },
            rule("^在线\\s*([0-9,]+)\\s*/\\s*([0-9,]+)$") { m, ns, _ in
                "Online \(g(m, ns, 1)) / \(g(m, ns, 2))"
            },
            rule("^基于\\s*([0-9,]+)\\s*/\\s*([0-9,]+)\\s*个区域$") { m, ns, _ in
                "Based on \(g(m, ns, 1)) / \(g(m, ns, 2)) regions"
            },
            rule("^待升级\\s*([0-9,]+)$") { m, ns, _ in "Upgrade needed: \(g(m, ns, 1))" },
            rule("^今日\\s*([0-9,]+/[0-9,]+)$") { m, ns, _ in "Today \(g(m, ns, 1))" },
            rule("^负载\\s*(.+)$") { m, ns, _ in "Load \(g(m, ns, 1))" },
            rule("^已用\\s*(.+)$") { m, ns, _ in "Used \(g(m, ns, 1))" },
            rule("^剩余\\s*(.+)$") { m, ns, _ in "Remaining \(g(m, ns, 1))" },
            rule("^当前\\s+(.+)$") { m, ns, t in "Current \(t(g(m, ns, 1)))" },
            rule("^点击切换到\\s*(.+)$") { m, ns, t in "Click to switch to \(t(g(m, ns, 1)))" },
            rule("^正在从 GitHub 下载 Mac 安装包（DMG）…\\s*([0-9]+)%$") { m, ns, _ in
                "Downloading Mac installer (DMG) from GitHub... \(g(m, ns, 1))%"
            },
            rule("^ARM 内存核心比守卫：当前\\s*(.+?)C\\s*:\\s*(.+?)G\\s*\\(1:6\\)\\s*完美符合 Oracle 官方推荐规则$") { m, ns, _ in
                "ARM RAM/OCPU Guard: \(g(m, ns, 1))C : \(g(m, ns, 2))G (1:6) matches Oracle's recommended ratio"
            },
            rule("^注意：当前比例为\\s*1:([0-9.]+)，Oracle ARM 官方严格推荐 1C:6G 比例$") { m, ns, _ in
                "Note: current ratio is 1:\(g(m, ns, 1)); Oracle ARM strongly recommends 1C:6G"
            },
            rule("^仅在每日\\s*(.+?)\\s*~\\s*(.+?)\\s*期间尝试抢机，其余时间自动静默挂起$") { m, ns, _ in
                "Only attempts booting daily between \(g(m, ns, 1)) and \(g(m, ns, 2)); silently paused otherwise"
            },
            rule("^每\\s*([0-9]+)s\\s*·\\s*采样\\s*([0-9]+)\\s*次\\s*·\\s*节点\\s*([0-9]+)\\s*台$") { m, ns, _ in
                "Every \(g(m, ns, 1))s · \(g(m, ns, 2)) samples · \(g(m, ns, 3)) nodes"
            },
            rule("^收起至前\\s*([0-9]+)\\s*台$") { m, ns, _ in "Collapse to first \(g(m, ns, 1))" },
            rule("^展开其余\\s*([0-9]+)\\s*台节点（共\\s*([0-9]+)\\s*台）$") { m, ns, _ in
                "Show remaining \(g(m, ns, 1)) nodes (\(g(m, ns, 2)) total)"
            },
            rule("^Email Delivery Service · ([0-9,]+) 个租户已启用 · ([0-9,]+) 位联系人 · ([0-9,]+) 条发送记录$") { m, ns, _ in
                "Email Delivery Service · \(g(m, ns, 1)) tenants enabled · \(g(m, ns, 2)) contacts · \(g(m, ns, 3)) send records"
            },
            rule("^已运行\\s*(.+?)\\s*天$") { m, ns, _ in "Active \(g(m, ns, 1))d" },
            rule("^([0-9,]+)\\s*项进行中$") { m, ns, _ in "\(g(m, ns, 1)) running" },
            rule("^([0-9,]+)\\s*条规则$") { m, ns, _ in "\(g(m, ns, 1)) rules" },
            rule("^([0-9,]+)\\s*个任务$") { m, ns, _ in "\(g(m, ns, 1)) tasks" },
            rule("^([0-9,]+)\\s*条笔记$") { m, ns, _ in "\(g(m, ns, 1)) notes" },
            rule("^([0-9,]+)\\s*个租户$") { m, ns, _ in "\(g(m, ns, 1)) tenants" },
            rule("^([0-9,]+)\\s*个两步验证密钥$") { m, ns, _ in "\(g(m, ns, 1)) 2FA secrets" },
            rule("^([0-9,]+)\\s*天过期$") { m, ns, _ in "Expires in \(g(m, ns, 1))d" },
            rule("^([0-9,]+)\\s*天内$") { m, ns, _ in "Last \(g(m, ns, 1))d" },
            rule("^最近\\s*([0-9,]+)\\s*天$") { m, ns, _ in "Last \(g(m, ns, 1)) days" },
            rule("^筛选结果\\s*([0-9,]+)\\s*条$") { m, ns, _ in "\(g(m, ns, 1)) filtered results" },
            rule("^匹配\\s*([0-9,]+)\\s*条$") { m, ns, _ in "\(g(m, ns, 1)) matched" },
            rule("^已找到\\s*([0-9,]+)\\s*条匹配$") { m, ns, _ in "Found \(g(m, ns, 1)) matches" },
            rule("^当前已加载\\s*([0-9,]+)\\s*条记录$") { m, ns, _ in "Loaded \(g(m, ns, 1)) records" },
            rule("^已加载\\s*([0-9,]+)\\s*条$") { m, ns, _ in "Loaded \(g(m, ns, 1)) items" },
            rule("^已识别\\s*([0-9,]+)\\s*个字段$") { m, ns, _ in "\(g(m, ns, 1)) fields detected" },
            rule("^✓ 已成功识别并填充\\s*([0-9,]+)\\s*个字段$") { m, ns, _ in "✓ Detected and filled \(g(m, ns, 1)) fields" },
            rule("^显示\\s*([0-9,]+)\\s*/\\s*共\\s*([0-9,]+)\\s*条$") { m, ns, _ in
                "Showing \(g(m, ns, 1)) / \(g(m, ns, 2))"
            },
            rule("^仅展示最近\\s*([0-9,]+)\\s*/\\s*([0-9,]+)\\s*条$") { m, ns, _ in
                "Showing latest \(g(m, ns, 1)) / \(g(m, ns, 2))"
            },
            rule("^共\\s*([0-9,]+)\\s*条，当前第\\s*([0-9,]+)\\s*/\\s*([0-9,]+)\\s*页$") { m, ns, _ in
                "Total \(g(m, ns, 1)) · Page \(g(m, ns, 2)) / \(g(m, ns, 3))"
            },
            rule("^显示\\s*([0-9,]+)\\s*[-–~]\\s*([0-9,]+)\\s*条，共\\s*([0-9,]+)\\s*条$") { m, ns, _ in
                "Showing \(g(m, ns, 1))–\(g(m, ns, 2)) of \(g(m, ns, 3))"
            },
            rule("^查询最近\\s*([0-9,]+)\\s*天（含今天）的审计事件$") { m, ns, _ in
                "Query audit events from the last \(g(m, ns, 1)) days (including today)"
            },
            rule("^当前区间\\s*(.+?)\\s*~\\s*(.+?)，可放宽时间范围后重试$") { m, ns, _ in
                "Range \(g(m, ns, 1)) ~ \(g(m, ns, 2)). Try widening the time range."
            },
            rule("^系统时区下每天\\s*(.+?)\\s*触发$") { m, ns, _ in
                "Triggers daily at \(g(m, ns, 1)) (system timezone)"
            },
            rule("^正在与\\s*(.+?)\\s*的 OCI AI 模型对话$") { m, ns, _ in
                "Chatting with \(g(m, ns, 1))'s OCI AI model"
            },
            rule("^首次放货\\s*(.+)$") { m, ns, _ in "First stock \(g(m, ns, 1))" },
            rule("^内网\\s*(.+)$") { m, ns, _ in "Private \(g(m, ns, 1))" },
            rule("^点击复制 IPv6：(.+)$") { m, ns, _ in "Click to copy IPv6: \(g(m, ns, 1))" },
            rule("^当前：([0-9.]+)\\s*GB\\s*·\\s*仅支持扩容$") { m, ns, _ in
                "Current: \(g(m, ns, 1)) GB · Expand only"
            },
            rule("^当前 VPU：([0-9]+)\\s*·\\s*范围 0–120，步长 10$") { m, ns, _ in
                "Current VPU: \(g(m, ns, 1)) · Range 0–120, step 10"
            },
            rule("^当前 IPv4：(.+)$") { m, ns, _ in "Current IPv4: \(g(m, ns, 1))" },
            rule("^实例 #(.+)$") { m, ns, _ in "Instance #\(g(m, ns, 1))" },
            rule("^租户#([0-9]+)$") { m, ns, _ in "Tenant #\(g(m, ns, 1))" },
            rule("^租户\\s+(.+)$") { m, ns, _ in "Tenant \(g(m, ns, 1))" },
            rule("^裸金属·(.+)$") { m, ns, _ in "Bare Metal · \(g(m, ns, 1))" },
            rule("^导出\\s+(.+)$") { m, ns, _ in "Export \(g(m, ns, 1))" },
            rule("^暂无(.+?)规则$") { m, ns, t in "No \(t(g(m, ns, 1))) rules" },
            rule("^(.+?)无需填写端口$") { m, ns, t in "\(t(g(m, ns, 1))) requires no port" },
            rule("^执行探测的 VPS 节点 \\*（已选\\s*([0-9,]+)\\s*台）$") { m, ns, _ in
                "Probe VPS Nodes * (\(g(m, ns, 1)) selected)"
            },
            rule("^([0-9,]+)（成功\\s*([0-9,]+)）$") { m, ns, _ in
                "\(g(m, ns, 1)) (\(g(m, ns, 2)) succeeded)"
            },
            rule("^点击查看「(.+?)」历史延迟与丢包(?:趋势)?$") { m, ns, _ in
                "Click to view latency & packet loss history for \"\(g(m, ns, 1))\""
            },
            rule("^为「(.+?)」配置发件域名$") { m, ns, _ in
                "Configure sending domain for \"\(g(m, ns, 1))\""
            },
            rule("^已暂停任务「(.+?)」$") { m, ns, _ in "Paused task \"\(g(m, ns, 1))\"" },
            rule("^已启用任务「(.+?)」$") { m, ns, _ in "Enabled task \"\(g(m, ns, 1))\"" },
            rule("^已删除任务「(.+?)」$") { m, ns, _ in "Deleted task \"\(g(m, ns, 1))\"" },
            rule("^任务\\s*(.+?)\\s*已启动$") { m, ns, _ in "Task \(g(m, ns, 1)) started" },
            rule("^任务\\s*(.+?)\\s*已停止$") { m, ns, _ in "Task \(g(m, ns, 1)) stopped" },
            rule("^已删除\\s*([0-9,]+)\\s*条通知$") { m, ns, _ in "Deleted \(g(m, ns, 1)) notifications" },
            rule("^已复制动态码\\s*(.+)$") { m, ns, _ in "Copied OTP \(g(m, ns, 1))" },
            rule("^已保存\\s*(.+)$") { m, ns, _ in "Saved \(g(m, ns, 1))" },
            rule("^已连接\\s*(.+)$") { m, ns, _ in "Connected \(g(m, ns, 1))" },
            rule("^同步完成，共处理\\s*([0-9,]+)\\s*条记录$") { m, ns, _ in
                "Sync complete, processed \(g(m, ns, 1)) records"
            },
            rule("^已复制\\s*([0-9,]+)\\s*条\\s*(IPv[46])\\s*网段$") { m, ns, _ in
                "Copied \(g(m, ns, 1)) \(g(m, ns, 2)) CIDRs"
            },
            rule("^确定删除「(.+?)」及其关联数据？此操作不可恢复。$") { m, ns, _ in
                "Delete \"\(g(m, ns, 1))\" and all related data? This cannot be undone."
            },
            rule("^确定删除「(.+?)」？此操作不可恢复。$") { m, ns, _ in
                "Delete \"\(g(m, ns, 1))\"? This cannot be undone."
            },
            rule("^确定删除「(.+?)」？$") { m, ns, _ in "Delete \"\(g(m, ns, 1))\"?" },
            rule("^确认删除「(.+?)」及其所有历史采样数据？此操作不可撤销。$") { m, ns, _ in
                "Delete \"\(g(m, ns, 1))\" and all historical sample data? This cannot be undone."
            },
            rule("^(?:确定|确认)删除\\s*(.+?)[？?]$") { m, ns, _ in "Delete \(g(m, ns, 1))?" },
            rule("^确定启动\\s*(.+?)[？?]$") { m, ns, _ in "Start \(g(m, ns, 1))?" },
            rule("^确定停止\\s*(.+?)[？?]$") { m, ns, _ in "Stop \(g(m, ns, 1))?" },
            rule("^停止任务\\s*(.+?)[？?]$") { m, ns, _ in "Stop task \(g(m, ns, 1))?" },
            rule("^删除任务\\s*(.+?)[？?]$") { m, ns, _ in "Delete task \(g(m, ns, 1))?" },
            rule("^删除存储桶\\s*(.+?)[？?]$") { m, ns, _ in "Delete bucket \(g(m, ns, 1))?" },
            rule("^删除地址\\s*(.+?)[？?]$") { m, ns, _ in "Delete address \(g(m, ns, 1))?" },
            rule("^删除\\s+(.+?)[？?]$") { m, ns, _ in "Delete \(g(m, ns, 1))?" },
            rule("^确定移除\\s*(.+?)[？?]$") { m, ns, _ in "Remove \(g(m, ns, 1))?" },
            rule("^确定重置用户\\s*(.+?)\\s*的密码[？?]$") { m, ns, _ in
                "Reset password for user \(g(m, ns, 1))?"
            },
            rule("^对\\s*(.+?)\\s*执行\\s*(.+?)[？?]$") { m, ns, t in
                "Run \(t(g(m, ns, 2))) on \(g(m, ns, 1))?"
            },
            rule("^✓ 已删除存储桶\\s*(.+)$") { m, ns, _ in "✓ Deleted bucket \(g(m, ns, 1))" },
            rule("^✓ 已删除模型配置\\s*(.+)$") { m, ns, _ in "✓ Deleted model config \(g(m, ns, 1))" },
            rule("^已应用模板：([0-9,]+)\\s*条规则$") { m, ns, _ in
                "Applied template: \(g(m, ns, 1)) rules"
            },
            rule("^硬盘\\s*\\((.+?)\\)$") { m, ns, _ in "Disk (\(g(m, ns, 1)))" },
            rule("^日期范围不能超过 90 天（当前\\s*([0-9,]+)\\s*天）$") { m, ns, _ in
                "Date range cannot exceed 90 days (currently \(g(m, ns, 1)) days)"
            },
            rule("^实例同步完成（([0-9,]+)\\s*个实例）$") { m, ns, _ in
                "Instance sync complete (\(g(m, ns, 1)) instances)"
            },
            rule("^开始同步区域\\s*(.+?)\\s*实例…$") { m, ns, _ in
                "Syncing instances in \(g(m, ns, 1))..."
            },
            rule("^(.+?)\\s*待完整实现$") { m, ns, t in "\(t(g(m, ns, 1))) — coming soon" },
            rule("^全部测试完成：共\\s*([0-9,]+)\\s*条，通\\s*([0-9,]+)，不通\\s*([0-9,]+)$") { m, ns, _ in
                "All tests done: \(g(m, ns, 1)) total, \(g(m, ns, 2)) OK, \(g(m, ns, 3)) failed"
            },
            rule("^(.+?)\\s*\\(([0-9,]+)\\)$") { m, ns, t in
                "\(t(g(m, ns, 1))) (\(g(m, ns, 2)))"
            },
            rule("^(.+?)（([0-9,]+)）$") { m, ns, t in
                "\(t(g(m, ns, 1))) (\(g(m, ns, 2)))"
            }
        ]
    }()
}

@inline(__always)
func L(_ zh: String) -> String {
    AppI18n.shared.translate(zh)
}

@inline(__always)
func L<S: StringProtocol>(_ zh: S) -> String {
    AppI18n.shared.translate(String(zh))
}

@inline(__always)
func L(_ zh: String, en: String) -> String {
    AppI18n.shared.isEnglish ? en : zh
}

func LF(_ zhFormat: String, _ args: CVarArg...) -> String {
    let template = AppI18n.shared.translate(zhFormat)
    return String(format: template, arguments: args)
}
