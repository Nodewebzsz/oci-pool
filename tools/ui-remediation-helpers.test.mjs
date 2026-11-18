import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

test('Web token availability distinguishes configuration from usable expiry', () => {
  const context = { window: { ociApi: { request() {} } } };
  vm.runInNewContext(readFileSync(new URL('../oci-server/src/main/resources/static/modern-ui/src/services-token.js', import.meta.url), 'utf8'), context);
  const availability = context.window.ociTokenAvailability;
  assert.equal(typeof availability, 'function');
  const now = Date.parse('2026-11-18T12:00:00Z');
  const base = { hasToken: true, enabled: true };
  for (const [status, expected] of [
    [{}, 'missing'], [{ hasToken: true }, 'disabled'], [base, 'unknown'],
    [{ ...base, expiresAt: '2026-10-02T12:00:00Z' }, 'expired'],
    [{ ...base, expiresAt: '2026-11-18T12:01:00Z' }, 'expiring'],
    [{ ...base, expiresAt: '2027-01-01T00:00:00Z' }, 'valid'],
    [{ ...base, expiresAt: '2027-01-01T00:00:00Z', isExpired: true }, 'expired'],
    [{ ...base, expiresAt: 'invalid' }, 'unknown'],
  ]) assert.equal(availability(status, now), expected);
});

test('toolbar rows keep actions within width and grow height instead of overlapping', () => {
  const source = readFileSync(new URL('../oci-pool-mac/OciPool/Common/Components/AdaptivePageToolbar.swift', import.meta.url), 'utf8');
  const packing = source.slice(source.indexOf('enum ToolbarPacking'), source.indexOf('@available(macOS 13.0, *)'));
  const directory = mkdtempSync(join(tmpdir(), 'oci-toolbar-'));
  try {
    const script = join(directory, 'main.swift');
    writeFileSync(script, `import Foundation\nimport CoreGraphics\n${packing}
let sizes = [CGSize(width:100,height:30), CGSize(width:100,height:30), CGSize(width:200,height:30)]
let compact = ToolbarPacking.arrange(sizes: sizes, width:220, spacing:8)
precondition(compact.size.height == 68)
precondition(compact.frames[0].minY == 0 && compact.frames[1].minY == 0 && compact.frames[2].minY == 38)
precondition(compact.frames.allSatisfy { $0.minX >= 0 && $0.maxX <= 220 })
precondition(ToolbarPacking.arrange(sizes:sizes,width:500,spacing:8).size.height == 30)
precondition(ToolbarPacking.arrange(sizes:[],width:220,spacing:8).size.height == 0)
print("toolbar checks passed")`);
    const run = spawnSync('swift', ['-module-cache-path', join(directory, 'cache'), script], { encoding: 'utf8', timeout: 120000 });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /toolbar checks passed/);
  } finally { rmSync(directory, { force: true, recursive: true }); }
});
