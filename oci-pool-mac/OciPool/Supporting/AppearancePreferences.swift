import Foundation

struct AppearancePreferences {
    private static let validAccents: Set<String> = ["coral", "green", "cyan", "violet", "orange", "blue"]
    private(set) var design: AppDesignStyle
    private(set) var accent: String
    private(set) var accentByDesign: [String: String]
    let initialMode: String

    init(defaults: UserDefaults) {
        let legacy = defaults.object(forKey: "appAppearance") != nil || defaults.object(forKey: "appAccent") != nil
        design = defaults.string(forKey: "appInterfaceStyle").flatMap(AppDesignStyle.init(rawValue:)) ?? (legacy ? .classic : .claude)
        accentByDesign = defaults.dictionary(forKey: "appAccentByDesign") as? [String: String] ?? [:]
        let savedAccent = defaults.string(forKey: "appAccent") ?? accentByDesign[design.rawValue] ?? design.defaultAccent
        accent = Self.validAccents.contains(savedAccent) ? savedAccent : design.defaultAccent
        let savedMode = defaults.string(forKey: "appAppearance") ?? design.defaultMode
        initialMode = ["light", "dark", "system"].contains(savedMode) ? savedMode : design.defaultMode
    }

    mutating func selectDesign(_ value: AppDesignStyle) {
        accentByDesign[design.rawValue] = accent
        design = value
        let remembered = accentByDesign[value.rawValue] ?? value.defaultAccent
        accent = Self.validAccents.contains(remembered) ? remembered : value.defaultAccent
        accentByDesign[value.rawValue] = accent
    }

    mutating func selectAccent(_ value: String) {
        accent = Self.validAccents.contains(value) ? value : design.defaultAccent
        accentByDesign[design.rawValue] = accent
    }

    func save(to defaults: UserDefaults) {
        defaults.set(design.rawValue, forKey: "appInterfaceStyle")
        defaults.set(accent, forKey: "appAccent")
        defaults.set(accentByDesign, forKey: "appAccentByDesign")
    }
}

