import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));

let manifest;
test('manifest loads from disk', async () => {
  manifest = JSON.parse(await readFile(resolve(root, 'docs/modern-ui-contract-manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifest.contracts));
});

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
const ALLOWED_BINDINGS = new Set(['query-params', 'json-body', 'multipart', 'form-urlencoded', 'unknown-body']);

test('every business request has method, path, encoding, field arrays and Java Controller owner', () => {
  const business = manifest.contracts.filter(c => c.requestKind === 'business');
  assert.ok(business.length > 0, 'expected at least one business contract');
  for (const contract of business) {
    assert.ok(ALLOWED_METHODS.has(contract.method), `${contract.method} ${contract.path}: invalid method`);
    assert.ok(contract.path && contract.path.startsWith('/'), `${contract.method} ${contract.path}: invalid path`);
    assert.ok(ALLOWED_BINDINGS.has(contract.requestBinding), `${contract.method} ${contract.path}: unknown encoding ${contract.requestBinding}`);
    assert.ok(Array.isArray(contract.requestFields), `${contract.method} ${contract.path}: requestFields not an array`);
    assert.ok(Array.isArray(contract.responseFields), `${contract.method} ${contract.path}: responseFields not an array`);
    assert.ok(contract.responseType, `${contract.method} ${contract.path}: missing responseType`);
    assert.ok(contract.controller, `${contract.method} ${contract.path}: missing Java Controller`);
    assert.ok(contract.methodName, `${contract.method} ${contract.path}: missing Controller method name`);
  }
});

test('no business contract may remain unverified or manual-review', () => {
  const unresolved = manifest.contracts.filter(c =>
    c.requestKind === 'business' && (c.status === 'unverified' || c.status === 'manual-review'));
  assert.deepEqual(unresolved.map(c => `${c.method} ${c.path}`), []);
});
