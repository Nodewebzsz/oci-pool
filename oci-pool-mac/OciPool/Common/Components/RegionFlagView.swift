import SwiftUI

/// 专门处理与解析全球区域国旗 Emoji 的核心模块
/// 具备 5 级智能回退解析能力：
/// 1. 标准 OCI Code 映射（us-phoenix-1、ap-tokyo-1）
/// 2. 3 字母机场/简码映射（PHX、IAD、NRT、FRA、ICN、SIN、LHR 等）
/// 3. 国家代码前缀提取（us-*, ca-*, uk-*, eu-*, ap-*, me-*, sa-*, af-*）
/// 4. 区域城市标识匹配（phoenix, tokyo, frankfurt, seoul, singapore, sydney 等）
/// 5. 中文字符串模糊匹配（凤凰城、东京、法兰克福、首尔、新加坡、伦敦、圣何塞等）
enum RegionFlag {

    /// 标准 OCI 区域 Code → 国旗 Emoji 表
    static let table: [String: String] = [
        // Asia Pacific
        "ap-tokyo-1":        "🇯🇵",
        "ap-osaka-1":        "🇯🇵",
        "ap-chuncheon-1":    "🇰🇷",
        "ap-seoul-1":        "🇰🇷",
        "ap-singapore-1":    "🇸🇬",
        "ap-singapore-2":    "🇸🇬",
        "ap-kulai-2":        "🇲🇾",
        "ap-batam-1":        "🇮🇩",
        "ap-mumbai-1":       "🇮🇳",
        "ap-hyderabad-1":    "🇮🇳",
        "ap-melbourne-1":    "🇦🇺",
        "ap-sydney-1":       "🇦🇺",
        // Europe
        "uk-london-1":       "🇬🇧",
        "uk-cardiff-1":      "🇬🇧",
        "eu-frankfurt-1":    "🇩🇪",
        "eu-amsterdam-1":    "🇳🇱",
        "eu-paris-1":        "🇫🇷",
        "eu-marseille-1":    "🇫🇷",
        "eu-milan-1":        "🇮🇹",
        "eu-turin-1":        "🇮🇹",
        "eu-madrid-1":       "🇪🇸",
        "eu-madrid-3":       "🇪🇸",
        "eu-zurich-1":       "🇨🇭",
        "eu-stockholm-1":    "🇸🇪",
        "eu-jovanovac-1":    "🇷🇸",
        "il-jerusalem-1":    "🇮🇱",
        // Middle East / Africa
        "me-jeddah-1":       "🇸🇦",
        "me-riyadh-1":       "🇸🇦",
        "me-dubai-1":        "🇦🇪",
        "me-abudhabi-1":     "🇦🇪",
        "af-casablanca-1":   "🇲🇦",
        "af-johannesburg-1": "🇿🇦",
        // Americas
        "us-ashburn-1":      "🇺🇸",
        "us-phoenix-1":      "🇺🇸",
        "us-sanjose-1":      "🇺🇸",
        "us-chicago-1":      "🇺🇸",
        "ca-toronto-1":      "🇨🇦",
        "ca-montreal-1":     "🇨🇦",
        "mx-queretaro-1":    "🇲🇽",
        "mx-monterrey-1":    "🇲🇽",
        "sa-saopaulo-1":     "🇧🇷",
        "sa-vinhedo-1":      "🇧🇷",
        "sa-santiago-1":     "🇨🇱",
        "sa-valparaiso-1":   "🇨🇱",
        "sa-bogota-1":       "🇨🇴"
    ]

    /// OCI 3 字母机场/区域简码 → 国旗 Emoji 表
    static let shortCodes: [String: String] = [
        "phx": "🇺🇸", "iad": "🇺🇸", "sjc": "🇺🇸", "ord": "🇺🇸",
        "yyz": "🇨🇦", "yul": "🇨🇦",
        "qro": "🇲🇽", "mty": "🇲🇽",
        "gru": "🇧🇷", "vcp": "🇧🇷", "scl": "🇨🇱", "vap": "🇨🇱", "bog": "🇨🇴",
        "nrt": "🇯🇵", "kix": "🇯🇵", "icn": "🇰🇷", "yny": "🇰🇷",
        "sin": "🇸🇬", "xsp": "🇸🇬", "syd": "🇦🇺", "mel": "🇦🇺",
        "bom": "🇮🇳", "hyd": "🇮🇳", "jhb": "🇲🇾", "bth": "🇮🇩",
        "fra": "🇩🇪", "ams": "🇳🇱", "cdg": "🇫🇷", "mrs": "🇫🇷",
        "lin": "🇮🇹", "mxp": "🇮🇹", "trn": "🇮🇹", "mad": "🇪🇸",
        "zrh": "🇨🇭", "arn": "🇸🇪", "beg": "🇷🇸", "jrs": "🇮🇱", "tlv": "🇮🇱",
        "lhr": "🇬🇧", "cwl": "🇬🇧",
        "dxb": "🇦🇪", "auh": "🇦🇪", "jed": "🇸🇦", "ruh": "🇸🇦",
        "jnb": "🇿🇦", "cmn": "🇲🇦"
    ]

    /// 国家代码前缀 → 国旗 Emoji 表
    static let countryPrefixes: [String: String] = [
        "us": "🇺🇸", "ca": "🇨🇦", "uk": "🇬🇧", "mx": "🇲🇽", "il": "🇮🇱"
    ]

    /// 城市英文关键子串 → 国旗 Emoji 表
    static let cityKeywords: [String: String] = [
        "phoenix": "🇺🇸", "ashburn": "🇺🇸", "sanjose": "🇺🇸", "chicago": "🇺🇸",
        "tokyo": "🇯🇵", "osaka": "🇯🇵", "seoul": "🇰🇷", "chuncheon": "🇰🇷",
        "singapore": "🇸🇬", "frankfurt": "🇩🇪", "london": "🇬🇧", "cardiff": "🇬🇧",
        "paris": "🇫🇷", "marseille": "🇫🇷", "amsterdam": "🇳🇱", "sydney": "🇦🇺",
        "melbourne": "🇦🇺", "mumbai": "🇮🇳", "hyderabad": "🇮🇳", "toronto": "🇨🇦",
        "montreal": "🇨🇦", "zurich": "🇨🇭", "stockholm": "🇸🇪", "milan": "🇮🇹",
        "turin": "🇮🇹", "madrid": "🇪🇸", "dubai": "🇦🇪", "abudhabi": "🇦🇪",
        "jeddah": "🇸🇦", "riyadh": "🇸🇦", "saopaulo": "🇧🇷", "vinhedo": "🇧🇷",
        "santiago": "🇨🇱", "valparaiso": "🇨🇱", "bogota": "🇨🇴", "johannesburg": "🇿🇦",
        "casablanca": "🇲🇦", "jerusalem": "🇮🇱", "queretaro": "🇲🇽", "monterrey": "🇲🇽",
        "kulai": "🇲🇾", "batam": "🇮🇩", "jovanovac": "🇷🇸"
    ]

    /// 中文区域关键字 → 国旗 Emoji 表
    static let chineseKeywords: [(String, String)] = [
        ("凤凰城", "🇺🇸"), ("圣何塞", "🇺🇸"), ("芝加哥", "🇺🇸"), ("阿什本", "🇺🇸"),
        ("美西", "🇺🇸"), ("美东", "🇺🇸"), ("美国", "🇺🇸"),
        ("东京", "🇯🇵"), ("大阪", "🇯🇵"), ("日本", "🇯🇵"),
        ("首尔", "🇰🇷"), ("春川", "🇰🇷"), ("韩国", "🇰🇷"),
        ("新加坡", "🇸🇬"),
        ("法兰克福", "🇩🇪"), ("德国", "🇩🇪"),
        ("伦敦", "🇬🇧"), ("卡迪夫", "🇬🇧"), ("英国", "🇬🇧"),
        ("巴黎", "🇫🇷"), ("马赛", "🇫🇷"), ("法国", "🇫🇷"),
        ("阿姆斯特丹", "🇳🇱"), ("荷兰", "🇳🇱"),
        ("悉尼", "🇦🇺"), ("墨尔本", "🇦🇺"), ("澳大利亚", "🇦🇺"), ("澳洲", "🇦🇺"),
        ("多伦多", "🇨🇦"), ("蒙特利尔", "🇨🇦"), ("加拿大", "🇨🇦"),
        ("苏黎世", "🇨🇭"), ("瑞士", "🇨🇭"),
        ("斯德哥尔摩", "🇸🇪"), ("瑞典", "🇸🇪"),
        ("米兰", "🇮🇹"), ("都灵", "🇮🇹"), ("意大利", "🇮🇹"),
        ("马德里", "🇪🇸"), ("西班牙", "🇪🇸"),
        ("迪拜", "🇦🇪"), ("阿布扎比", "🇦🇪"), ("阿联酋", "🇦🇪"),
        ("吉达", "🇸🇦"), ("利雅得", "🇸🇦"), ("沙特", "🇸🇦"),
        ("孟买", "🇮🇳"), ("海得拉巴", "🇮🇳"), ("印度", "🇮🇳"),
        ("圣保罗", "🇧🇷"), ("维涅杜", "🇧🇷"), ("巴西", "🇧🇷"),
        ("圣地亚哥", "🇨🇱"), ("瓦尔帕莱索", "🇨🇱"), ("智利", "🇨🇱"),
        ("波哥大", "🇨🇴"), ("哥伦比亚", "🇨🇴"),
        ("约翰内斯堡", "🇿🇦"), ("南非", "🇿🇦"),
        ("卡萨布兰卡", "🇲🇦"), ("摩洛哥", "🇲🇦"),
        ("耶路撒冷", "🇮🇱"), ("以色列", "🇮🇱"),
        ("墨西哥", "🇲🇽"), ("克雷塔罗", "🇲🇽"), ("蒙特雷", "🇲🇽"),
        ("古来", "🇲🇾"), ("柔佛", "🇲🇾"), ("马来西亚", "🇲🇾"),
        ("巴淡", "🇮🇩"), ("印尼", "🇮🇩"), ("印度尼西亚", "🇮🇩"),
        ("约万诺瓦茨", "🇷🇸"), ("塞尔维亚", "🇷🇸")
    ]

    /// 核心单参数智能解析函数
    static func emoji(_ input: String) -> String {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "🌐" }
        let lower = raw.lowercased()

        // 1. 标准 Code 精确匹配
        if let f = table[lower] { return f }

        // 2. 3 字母简码匹配
        if let f = shortCodes[lower] { return f }

        // 3. 常见国家前缀匹配
        for (prefix, flag) in countryPrefixes {
            if lower.hasPrefix("\(prefix)-") || lower == prefix { return flag }
        }

        // 4. 城市英文单词匹配
        for (city, flag) in cityKeywords {
            if lower.contains(city) { return flag }
        }

        // 5. 中文名称模糊匹配
        for (kw, flag) in chineseKeywords {
            if raw.contains(kw) { return flag }
        }

        return "🌐"
    }

    /// 双参数智能解析（优先 code，未命中时回退 name 综合判定）
    static func emoji(code: String, name: String? = nil) -> String {
        let e1 = emoji(code)
        if e1 != "🌐" { return e1 }
        if let n = name, !n.isEmpty {
            let e2 = emoji(n)
            if e2 != "🌐" { return e2 }
        }
        return "🌐"
    }
}

// MARK: - 国旗展示组件（纯 Emoji 渲染，保证系统层字体与缩放稳定性）

/// 专门展示区域国旗 Emoji 的组件
struct RegionFlagView: View {
    let code: String
    var name: String? = nil
    var size: CGFloat = 14

    var body: some View {
        let flag = RegionFlag.emoji(code: code, name: name)
        Text(flag)
            .font(.system(size: size))
            .lineLimit(1)
    }
}

// MARK: - 区域徽章组件（国旗 + 中文名称对齐 Web RegionBadge）

/// 区域徽章组件：展示「国旗 Emoji + 中文区域名」
struct RegionBadgeView: View {
    let code: String
    var name: String? = nil
    var size: CGFloat = 13
    var bold: Bool = false
    var textColor: Color = .primary

    var body: some View {
        let flag = RegionFlag.emoji(code: code, name: name)
        let resolvedName: String = {
            let lower = code.lowercased()
            if let cn = RegionCnName.table[lower] { return cn }
            if let n = name, !n.isEmpty {
                // 如果传入了中文名，直接使用
                if RegionCnName.table.values.contains(n) { return n }
                return n
            }
            return code
        }()

        HStack(spacing: 6) {
            Text(flag)
                .font(.system(size: size))
            Text(resolvedName)
                .font(.system(size: 12, weight: bold ? .semibold : .medium))
                .foregroundColor(textColor)
                .lineLimit(1)
        }
    }
}
