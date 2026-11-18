import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Mac local startup requires a responding service or an available embedded runtime', () => {
  const source = readFileSync(new URL('../oci-pool-mac/OciPool/Core/BackendController.swift', import.meta.url), 'utf8');
  const start = source.indexOf('    @MainActor\n    func start() async');
  const end = source.indexOf('\n    /// Stop embedded backend.', start);
  assert.ok(start >= 0 && end > start);
  const directory = mkdtempSync(join(tmpdir(), 'oci-backend-start-'));
  try {
    const script = join(directory, 'main.swift');
    writeFileSync(script, `import Foundation
enum BackendState: Equatable { case idle, starting, ready, failed(String) }
final class Harness {
 var state: BackendState = .idle
 var responds = false
 var startEpoch: UInt64 = 0
 let defaultPort = 9856
 let processLock = NSLock()
 var process: Process?
 func ping(_ url: URL) async -> Bool { responds }
 func resolveJava() -> URL? { nil }
 func resolveServerJar() -> URL? { nil }
 func appendBackendLog(_ text: String) {}
 func appDataDir() -> URL { URL(fileURLWithPath: "/tmp/unused-oci-start-test") }
 func killOrphanBackendsOnPort(_ port: Int) {}
 func killOrphanProcessesHoldingFile(_ path: String) {}
 ${source.slice(start, end)}
}
Task { @MainActor in
 let missing = Harness()
 await missing.start()
 if case .failed = missing.state {} else { fatalError("Missing runtime must not report ready") }
 let external = Harness()
 external.responds = true
 await external.start()
 guard external.state == .ready else { fatalError("Responding external service should be ready") }
 print("startup checks passed")
 exit(0)
}
dispatchMain()
`);
    const run = spawnSync('swift', ['-swift-version', '5', '-module-cache-path', join(directory, 'cache'), script], { encoding: 'utf8', timeout: 120000 });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /startup checks passed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
