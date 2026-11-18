import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('system message batch cleanup and Google credentials shortcut exist in Web and Mac', async () => {
  const sysSvc = await read('oci-server/src/main/resources/static/modern-ui/src/services-system.js');
  const tenantActions = await read('oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx');
  const macTenantSheets = await read('oci-pool-mac/OciPool/Features/Tenants/TenantSheets.swift');

  assert.match(sysSvc, /\/sysMessage\/delBatch/);
  assert.match(sysSvc, /\/sysMessage\/clear/);
  assert.match(tenantActions, /https:\/\/console\.cloud\.google\.com\/apis\/credentials/);
  assert.match(macTenantSheets, /https:\/\/console\.cloud\.google\.com\/apis\/credentials/);
});
