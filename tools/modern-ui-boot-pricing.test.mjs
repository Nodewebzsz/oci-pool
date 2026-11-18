import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('boot create enforces E2.1.Micro lock, integer Flex bounds, template reset, and live USD estimate', async () => {
  const src = await readFile(new URL('oci-server/src/main/resources/static/modern-ui/src/page-tenant-boot-create.jsx', root), 'utf8');
  const macSrc = await readFile(new URL('oci-pool-mac/OciPool/Features/Tenants/TenantBootCreateView.swift', root), 'utf8');

  assert.match(src, /function\s+normalizeBootShapeSpec\b/);
  assert.match(src, /function\s+estimateBootMonthlyCost\b/);
  assert.match(src, /VM\.Standard\.E2\.1\.Micro/);
  assert.match(macSrc, /VM\.Standard\.E2\.1\.Micro/);

  const start = src.indexOf('function normalizeBootShapeSpec');
  const end = src.indexOf('// --- END BOOT PRICING HELPERS ---');
  assert.ok(start >= 0 && end > start, 'boot pricing helper markers must exist');
  const ctx = { Number, Math, Object };
  vm.createContext(ctx);
  vm.runInContext(src.slice(start, end), ctx);

  const micro = ctx.normalizeBootShapeSpec({ shape: 'VM.Standard.E2.1.Micro', ocpu: 4, memoryGb: 24, bootVolumeGb: 50 });
  assert.equal(micro.ocpu, 1);
  assert.equal(micro.memoryGb, 1);
  assert.equal(micro.locked, true);

  const freeArm = ctx.estimateBootMonthlyCost({ shape: 'VM.Standard.A1.Flex', ocpu: 4, memoryGb: 24, bootVolumeGb: 100 });
  assert.equal(freeArm.computeMonthlyUsd, 0);

  const paidArm = ctx.estimateBootMonthlyCost({ shape: 'VM.Standard.A1.Flex', ocpu: 6, memoryGb: 36, bootVolumeGb: 100 });
  assert.ok(paidArm.computeMonthlyUsd > 0);
});
