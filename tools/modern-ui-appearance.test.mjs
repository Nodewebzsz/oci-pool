import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const helperPath = new URL('../oci-server/src/main/resources/static/modern-ui/src/appearance.js', import.meta.url);

function loadAppearance() {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(helperPath, 'utf8'), context);
  return context.window.ociAppearance;
}

function createRoot() {
  const attributes = new Map();
  const properties = new Map();
  return { attributes, properties, setAttribute: (name, value) => attributes.set(name, value), style: { setProperty: (name, value) => properties.set(name, value) } };
}

test('design switching remembers each design accent and preserves the selected color mode', () => {
  const appearance = loadAppearance();
  let values = { design: 'claude', accent: 'violet', theme: 'dark' };
  values = { ...values, ...appearance.changeDesign(values, 'classic') };
  assert.equal(values.accent, 'green');
  assert.equal(values.theme, 'dark');
  values = { ...values, ...appearance.changeAccent(values, 'blue') };
  values = { ...values, ...appearance.changeDesign(values, 'claude') };
  assert.equal(values.accent, 'violet');
  values = { ...values, ...appearance.changeDesign(values, 'classic') };
  assert.equal(values.accent, 'blue');
});

test('legacy accent objects and invalid preferences resolve to usable defaults', () => {
  const appearance = loadAppearance();
  assert.equal(appearance.preferences({ accent: { value: 'cyan' } }).accent, 'cyan');
  assert.equal(appearance.preferences({ accent: { key: 'orange' } }).accent, 'orange');
  assert.equal(appearance.preferences({ design: 'classic', accent: 'invalid' }).accent, 'green');
  assert.equal(appearance.preferences({ design: 'invalid', accent: 'constructor' }).design, 'claude');
  assert.equal(appearance.preferences({ accent: 'constructor' }).accent, 'coral');
});

test('saved appearance and custom accents survive serialization and reload', () => {
  const appearance = loadAppearance();
  const values = { design: 'classic', accent: 'blue', theme: 'system', accentByDesign: { classic: 'blue', claude: 'coral' } };
  const restored = appearance.readPreferences({ design: 'claude' }, { getItem: () => JSON.stringify(values) });
  assert.equal(restored.design, 'classic');
  assert.equal(restored.theme, 'system');
  assert.equal(appearance.changeDesign(restored, 'claude').accent, 'coral');
});

test('invalid or unavailable storage uses defaults without blocking rendering', () => {
  const appearance = loadAppearance();
  const defaults = { design: 'claude', accent: 'coral', theme: 'light' };
  for (const raw of ['null', '[]', '"dark"', '{broken']) {
    assert.equal(appearance.readPreferences(defaults, { getItem: () => raw }).design, 'claude');
  }
  assert.equal(appearance.readPreferences(defaults, { getItem: () => { throw new Error('denied'); } }).accent, 'coral');
});

test('both designs apply independently in both color modes and clear prior accent overrides', () => {
  const appearance = loadAppearance();
  const root = createRoot();
  appearance.apply(root, { design: 'claude', accent: 'coral', theme: 'light' }, false);
  assert.equal(root.attributes.get('data-design'), 'claude');
  assert.equal(root.properties.get('--accent'), '#cc785c');
  assert.match(root.properties.get('--accent-soft'), /#faf9f5/);
  appearance.apply(root, { design: 'classic', accent: 'green', theme: 'dark' }, false);
  assert.equal(root.attributes.get('data-theme'), 'dark');
  assert.equal(root.properties.get('--accent'), 'oklch(0.72 0.16 155)');
  assert.equal(root.properties.get('--accent-soft'), 'oklch(0.30 0.10 155)');
  appearance.apply(root, { design: 'classic', accent: 'green', theme: 'light' }, false);
  assert.equal(root.properties.get('--accent-soft'), 'oklch(0.93 0.06 155)');
  appearance.apply(root, { design: 'claude', accent: 'coral', theme: 'dark' }, false);
  assert.match(root.properties.get('--accent-soft'), /#1f1e1b/);
  assert.equal(root.properties.get('--accent-active'), '#a9583e');
});

test('system color mode updates both the color scheme and theme-dependent accent values', () => {
  const appearance = loadAppearance();
  const root = createRoot();
  const values = { design: 'classic', accent: 'green', theme: 'system' };
  appearance.apply(root, values, true);
  assert.equal(root.attributes.get('data-theme'), 'dark');
  assert.equal(root.properties.get('--accent-soft'), 'oklch(0.30 0.10 155)');
  appearance.apply(root, values, false);
  assert.equal(root.attributes.get('data-theme'), 'light');
  assert.equal(root.properties.get('--accent-soft'), 'oklch(0.93 0.06 155)');
});
