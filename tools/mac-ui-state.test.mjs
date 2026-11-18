import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('completed and unknown boot states cannot start, and token expiry overrides enabled configuration', () => {
  const boot = readFileSync(new URL('../oci-pool-mac/OciPool/Features/Boot/BootModels.swift', import.meta.url), 'utf8');
  const token = readFileSync(new URL('../oci-pool-mac/OciPool/Features/ApiTokens/ApiTokensModels.swift', import.meta.url), 'utf8');
  assert.ok(boot.includes('struct BootActionAvailability'), 'missing shared boot state rules');
  assert.ok(token.includes('enum TokenAvailability'), 'missing token availability rules');
  const directory = mkdtempSync(join(tmpdir(), 'oci-ui-state-'));
  try {
    const code = `import Foundation
${boot.slice(boot.indexOf('struct BootActionAvailability'), boot.indexOf('// MARK: - Sheets'))}
${token.slice(token.indexOf('enum TokenAvailability'), token.indexOf('struct ApiTokenGenerateResult'))}
for (state, start, stop) in [(0,true,false),(1,false,true),(2,false,false),(-1,false,false),(99,false,false)] {
 let actions = BootActionAvailability(status: state)
 precondition(actions.canStart == start && actions.canStop == stop, "boot state \\(state)")
}
let now = Date(timeIntervalSince1970: 1800000000)
var status = ApiTokenStatus()
precondition(status.availability(at: now) == .missing)
status.hasToken = true
precondition(status.availability(at: now) == .disabled)
status.enabled = true
precondition(status.availability(at: now) == .unknown)
status.expiresAt = "2026-10-02 23:11:04"
precondition(status.availability(at: now) == .expired)
let format = ISO8601DateFormatter()
status.expiresAt = format.string(from: now.addingTimeInterval(3600))
precondition(status.availability(at: now) == .expiring)
status.expiresAt = format.string(from: now.addingTimeInterval(30 * 86400))
precondition(status.availability(at: now) == .valid)
status.isExpired = true
precondition(status.availability(at: now) == .expired)
status.isExpired = false
status.expiresAt = "invalid"
precondition(status.availability(at: now) == .unknown)
print("UI state checks passed")
`;
    const script = join(directory, 'main.swift');
    writeFileSync(script, code);
    const result = spawnSync('swift', ['-module-cache-path', join(directory, 'cache'), script], { encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /UI state checks passed/);
  } finally { rmSync(directory, { force: true, recursive: true }); }
});
