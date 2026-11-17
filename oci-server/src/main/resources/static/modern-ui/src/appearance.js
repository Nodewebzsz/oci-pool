(function (global) {
  const STORAGE_KEY = 'ocip-tweaks-v2';
  const ACCENTS = {
    coral: { hue: 35, color: '#cc785c', active: '#a9583e' },
    green: { hue: 155 },
    cyan: { hue: 200 },
    violet: { hue: 305 },
    orange: { hue: 55 },
    blue: { hue: 240 },
  };
  const DEFAULT_ACCENTS = { claude: 'coral', classic: 'green' };

  function normalizeDesign(value) {
    return value === 'classic' ? 'classic' : 'claude';
  }

  function normalizeAccent(value, design) {
    const key = typeof value === 'string' ? value : value && (value.value || value.key);
    return Object.prototype.hasOwnProperty.call(ACCENTS, key) ? key : DEFAULT_ACCENTS[normalizeDesign(design)];
  }

  function preferences(values) {
    const design = normalizeDesign(values.design);
    return { design, accent: normalizeAccent(values.accent, design) };
  }

  function changeDesign(values, nextDesign) {
    const current = preferences(values);
    const design = normalizeDesign(nextDesign);
    const accentByDesign = { ...values.accentByDesign, [current.design]: current.accent };
    const accent = normalizeAccent(accentByDesign[design], design);
    return { design, accent, accentByDesign: { ...accentByDesign, [design]: accent } };
  }

  function changeAccent(values, nextAccent) {
    const current = preferences(values);
    const accent = normalizeAccent(nextAccent, current.design);
    return { accent, accentByDesign: { ...values.accentByDesign, [current.design]: accent } };
  }

  function accentColor(value) {
    const preset = ACCENTS[normalizeAccent(value, 'claude')];
    return preset.color || `oklch(0.72 0.16 ${preset.hue})`;
  }

  function readPreferences(defaults, storage) {
    try {
      const source = storage || global.localStorage;
      const parsed = JSON.parse(source.getItem(STORAGE_KEY));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...defaults, ...parsed };
    } catch (_) {}
    return { ...defaults };
  }

  function apply(root, values, systemDark) {
    const current = preferences(values);
    const theme = values.theme === 'dark' || values.theme === 'light'
      ? values.theme : systemDark ? 'dark' : 'light';
    const preset = ACCENTS[current.accent];
    const color = accentColor(current.accent);
    const isLight = theme === 'light';
    root.setAttribute('data-design', current.design);
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent-2', color);
    if (current.design === 'classic') {
      root.style.setProperty('--accent-active', color);
      root.style.setProperty('--accent-soft', isLight ? `oklch(0.93 0.06 ${preset.hue})` : `oklch(0.30 0.10 ${preset.hue})`);
    } else {
      root.style.setProperty('--accent-active', preset.active || `color-mix(in srgb, ${color} 80%, black)`);
      root.style.setProperty('--accent-soft', `color-mix(in srgb, ${color} ${isLight ? 14 : 22}%, ${isLight ? '#faf9f5' : '#1f1e1b'})`);
    }
    root.style.setProperty('--accent-fg', preset.color || isLight ? 'white' : `oklch(0.14 0.02 ${preset.hue})`);
    return { ...current, theme };
  }

  global.ociAppearance = { STORAGE_KEY, ACCENTS, preferences, changeDesign, changeAccent, accentColor, readPreferences, apply };
})(window);
