import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

function sliceFunction(source, fnName) {
  const start = source.indexOf(`function ${fnName}(`);
  assert.ok(start >= 0, `${fnName} must exist`);
  const nextFn = source.indexOf('\nfunction use', start + 10);
  return nextFn > start ? source.slice(start, nextFn) : source.slice(start);
}

test('heavy instance and tenant management panels render via shell.openDrawer', async () => {
  const inst = await read('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const tenant = await read('oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx');

  for (const fn of ['useReinstallModal', 'useSnapshotModal']) {
    assert.match(sliceFunction(inst, fn), /shell\.openDrawer\s*\(/, `${fn} should open a right-side drawer`);
  }
  for (const fn of ['useUserManageModal', 'useRegionSubscribeModal', 'useTrafficAlertModal', 'useMailModal', 'useSocialConfigModal']) {
    assert.match(sliceFunction(tenant, fn), /shell\.openDrawer\s*\(/, `${fn} should open a right-side drawer`);
  }
});
