import Foundation

@main
struct AppearanceVerification {
    static func main() {
        let suite = "com.nodewebzsz.ocipool.appearance-check.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        var preferences = AppearancePreferences(defaults: defaults)
        precondition(preferences.design == .claude && preferences.accent == "coral" && preferences.initialMode == "light")
        preferences.save(to: defaults)
        defaults.set("dark", forKey: "appAppearance")
        preferences = AppearancePreferences(defaults: defaults)
        precondition(preferences.design == .claude && preferences.initialMode == "dark")
        preferences.selectAccent("violet")
        preferences.selectDesign(.classic)
        precondition(preferences.accent == "green" && preferences.initialMode == "dark")
        preferences.selectAccent("blue")
        preferences.selectDesign(.claude)
        precondition(preferences.accent == "violet")
        preferences.selectDesign(.classic)
        preferences.save(to: defaults)
        preferences = AppearancePreferences(defaults: defaults)
        precondition(preferences.design == .classic && preferences.accent == "blue")
        preferences.selectDesign(.claude)
        precondition(preferences.accent == "violet")
        defaults.removePersistentDomain(forName: suite)
        defaults.set("system", forKey: "appAppearance")
        defaults.set("orange", forKey: "appAccent")
        preferences = AppearancePreferences(defaults: defaults)
        precondition(preferences.design == .classic && preferences.accent == "orange" && preferences.initialMode == "system")
        defaults.set("invalid", forKey: "appAccent")
        defaults.set("invalid", forKey: "appAppearance")
        preferences = AppearancePreferences(defaults: defaults)
        precondition(preferences.accent == "green" && preferences.initialMode == "dark")
        print("Appearance checks passed: defaults, legacy migration, independent accents, persistence, invalid values")
    }
}
