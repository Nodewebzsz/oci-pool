import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('tenant portrait endpoint is wired in Web MonitorPage and Mac Dashboard', async () => {
  const bootSvc = await read('oci-server/src/main/resources/static/modern-ui/src/services-boot.js');
  const monitorPage = await read('oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx');
  const macDash = await read('oci-pool-mac/OciPool/Features/Dashboard/DashboardViewModel.swift');

  assert.match(bootSvc, /\/boot\/tenant-portrait/);
  assert.match(monitorPage, /tenantPortrait/);
  assert.match(macDash, /\/boot\/tenant-portrait/);
});
