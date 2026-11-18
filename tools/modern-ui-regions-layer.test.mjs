import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('world map classifies 4 region coverage states while preserving vector projection in Web and Mac', async () => {
  const src = await readFile(new URL('oci-server/src/main/resources/static/modern-ui/src/page-regions.jsx', root), 'utf8');
  const macMap = await readFile(new URL('oci-pool-mac/OciPool/Features/Regions/RegionWorldMapView.swift', root), 'utf8');

  assert.match(src, /function\s+classifyRegionCoverage\b/);
  assert.doesNotMatch(src, /landMask/);
  assert.match(macMap, /unlinkedReleased|uncoveredReleased/);

  const start = src.indexOf('function classifyRegionCoverage');
  const end = src.indexOf('// --- END REGION COVERAGE HELPERS ---');
  assert.ok(start >= 0 && end > start);
  const ctx = { Boolean };
  vm.createContext(ctx);
  vm.runInContext(src.slice(start, end), ctx);

  assert.equal(ctx.classifyRegionCoverage({ mine: true, released: true }), 'linked_active');
  assert.equal(ctx.classifyRegionCoverage({ mine: true, released: false }), 'linked_idle');
  assert.equal(ctx.classifyRegionCoverage({ mine: false, released: true }), 'unlinked_released');
  assert.equal(ctx.classifyRegionCoverage({ mine: false, released: false }), 'unlinked_unreleased');
});
