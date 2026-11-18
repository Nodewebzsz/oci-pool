import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Mac server addresses normalize before display and distinguish embedded from development ports', () => {
  const source = readFileSync(new URL('../oci-pool-mac/OciPool/Core/AppSession.swift', import.meta.url), 'utf8');
  const extract = name => {
    const start = source.indexOf(`    static func ${name}(`) >= 0
      ? source.indexOf(`    static func ${name}(`)
      : source.indexOf(`    private static func ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    const end = source.indexOf('\n    }', start) + '\n    }'.length;
    return source.slice(start, end).replace('private static', 'static');
  };
  const cases = [
    ['http://localhost.:19857', 'http://localhost:19857', false],
    [' LOCALHOST.:9856/login?next=1#top ', 'http://localhost:9856', true],
    ['127.0.0.1:19857/', 'http://127.0.0.1:19857', false],
    ['http://127.0.0.1:9856', 'http://127.0.0.1:9856', true],
    ['http://[::1]:9856', 'http://[::1]:9856', true],
    ['http://[::1]:19857', 'http://[::1]:19857', false],
    ['HTTPS://EXAMPLE.COM/login?next=1#top', 'https://example.com', false],
    ['https://example.com?next=1#top', 'https://example.com', false],
    ['example.com:9856/', 'http://example.com:9856', false],
    ['https://localhost:9856', 'https://localhost:9856', false],
    ['http://localhost', 'http://localhost', false],
    ...['', 'http://', 'https://', 'ftp://example.com', 'http://bad host:9856',
      'http://user:password@example.com', 'http://example.com:0', 'http://example.com:65536']
      .map(value => [value, '', true]),
  ];
  const directory = mkdtempSync(join(tmpdir(), 'oci-server-url-'));
  try {
    const script = join(directory, 'main.swift');
    writeFileSync(script, `import Foundation\nenum AppSession {\nstatic let localDefaultURL = "http://localhost:9856"\n${extract('normalize')}\n${extract('isLocalServerURL')}\n}\nlet inputs = ${JSON.stringify(cases.map(c => c[0]))}\nlet result = inputs.map { ["normalized": AppSession.normalize($0), "local": AppSession.isLocalServerURL($0)] as [String: Any] }\nprint(String(data: try! JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)\n`);
    const run = spawnSync('swift', ['-module-cache-path', join(directory, 'cache'), script], { encoding: 'utf8', timeout: 120000 });
    assert.equal(run.status, 0, run.stderr);
    const results = JSON.parse(run.stdout);
    for (let i = 0; i < cases.length; i++) {
      assert.deepEqual(results[i], { normalized: cases[i][1], local: cases[i][2] }, cases[i][0]);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
