import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROUTER_PATH = resolve(fileURLToPath(new URL('../', import.meta.url)), 'oci-server/src/main/resources/static/modern-ui/src/router.js');
const router = require(ROUTER_PATH);

// Fresh browser-ish location/history for every assertion.
function setHash(hash) {
  let calls = [];
  globalThis.location = { hash, _setHash(v) { this.hash = v; } };
  globalThis.history = {
    pushState: (a, b, c) => calls.push(['push', c]),
    replaceState: (a, b, c) => calls.push(['replace', c]),
  };
  globalThis.__routerCalls = calls;
}

// Representative route/context table mirroring the canonical routes.
const ROWS = [
  { page: 'monitor', ctx: {}, href: '/monitor', page2: 'monitor' },
  { page: 'regions', ctx: {}, href: '/regions', page2: 'regions' },
  { page: 'tenants', ctx: { page: '1', size: '20', keyword: 'a', cloudType: 'ocid', emailEnable: 'true' }, href: '/tenants?page=1&size=20&keyword=a&cloudType=ocid&emailEnable=true', page2: 'tenants' },
  { page: 'tenant-detail', ctx: { tenantDbId: '42', tab: 'users', regionCode: 'ap-singapore-1' }, href: '/tenants/42?tab=users&region=ap-singapore-1', page2: 'tenant-detail', params: { tenantDbId: '42' }, query: { tab: 'users', region: 'ap-singapore-1' } },
  { page: 'tenant-grab', ctx: { tenantDbId: '42', page: '1', size: '20' }, href: '/tenants/42/grab?page=1&size=20', page2: 'tenant-grab' },
  { page: 'tenant-resources', ctx: { tenantDbId: '42', regionCode: 'ap-singapore-1' }, href: '/tenants/42/resources?region=ap-singapore-1', page2: 'tenant-resources' },
  { page: 'instances', ctx: { page: '1', tenantId: '7', regionId: '8' }, href: '/instances?page=1&tenantId=7&regionId=8', page2: 'instances' },
  { page: 'grab', ctx: { page: '1', tenantId: '7' }, href: '/grab?page=1&tenantId=7', page2: 'grab' },
  { page: 'mail', ctx: { tenantId: '7' }, href: '/mail?tenantId=7', page2: 'mail' },
  { page: 'object', ctx: { tenantId: '7', bucket: 'b', path: '/x' }, href: '/object-storage?tenantId=7&bucket=b&path=%2Fx', page2: 'object' },
  { page: 'ai', ctx: { tenantId: '7', model: 'genai' }, href: '/ai?tenantId=7&model=genai', page2: 'ai' },
  { page: 'link', ctx: { target: '192.0.2.1' }, href: '/link-test?target=192.0.2.1', page2: 'link' },
  { page: 'logs', ctx: { level: 'INFO', keyword: 'f' }, href: '/boot-logs?level=INFO&keyword=f', page2: 'logs' },
  { page: 'proxyKeyConfig', ctx: {}, href: '/proxy/keys', page2: 'proxyKeyConfig' },
  { page: 'cfManage', ctx: { zoneId: 'z1' }, href: '/proxy/cloudflare?zoneId=z1', page2: 'cfManage' },
  { page: 'eoManage', ctx: { zoneId: 'z1' }, href: '/proxy/edgeone?zoneId=z1', page2: 'eoManage' },
  { page: 'keyConfig', ctx: {}, href: '/developer/tokens', page2: 'keyConfig' },
  { page: 'notifyMgmt', ctx: {}, href: '/tools/notifications', page2: 'notifyMgmt' },
  { page: 'memPage', ctx: { keyword: 'f' }, href: '/tools/memos?keyword=f', page2: 'memPage' },
  { page: 'migPage', ctx: {}, href: '/tools/migration', page2: 'migPage' },
  { page: 'mfaBackup', ctx: {}, href: '/tools/mfa-backup', page2: 'mfaBackup' },
  { page: 'resList', ctx: { keyword: 'f' }, href: '/resources?keyword=f', page2: 'resList' },
  { page: 'resCloudInit', ctx: { resourceId: '5' }, href: '/resources/cloud-init?resourceId=5', page2: 'resCloudInit' },
  { page: 'sysIpQuality', ctx: {}, href: '/system/ip-quality', page2: 'sysIpQuality' },
  { page: 'sysLogs', ctx: { level: 'INFO' }, href: '/system/logs?level=INFO', page2: 'sysLogs' },
  { page: 'sysSetting', ctx: {}, href: '/system/security', page2: 'sysSetting' },
  { page: 'sysVpnProxy', ctx: { keyword: 'f' }, href: '/system/proxy?keyword=f', page2: 'sysVpnProxy' },
  { page: 'auth', ctx: {}, href: '/login', page2: 'auth' },
  { page: 'sysNotify', ctx: {}, href: '/tools/notifications', page2: 'notifyMgmt' },
];

test('href builds the exact tenant-detail URL with regionCode alias', () => {
  assert.equal(router.href('tenant-detail', { tenantDbId: '42', tab: 'users', regionCode: 'ap-singapore-1' }), '/tenants/42?tab=users&region=ap-singapore-1');
});

test('tenant-grab preserves the selected region in the child-route query', () => {
  assert.equal(
    router.href('tenant-grab', { tenantDbId: '42', page: '1', size: '20', regionCode: 'ap-singapore-1' }),
    '/tenants/42/grab?page=1&size=20&region=ap-singapore-1',
  );
});

test('every canonical row href/read round-trips to the same page', () => {
  for (const row of ROWS) {
    assert.equal(router.href(row.page, row.ctx), row.href, 'href for ' + row.page);
    setHash('#' + row.href);
    const state = router.read();
    assert.equal(state.page, row.page2, 'page round-trip for ' + row.page + ' via ' + row.href);
    if (row.params) assert.deepEqual(state.params, row.params);
    if (row.query) assert.deepEqual(state.query, row.query);
  }
});

test('legacy sysNotify page id normalizes to notifyMgmt', () => {
  assert.equal(router.href('sysNotify'), '/tools/notifications');
  setHash('#/tools/notifications');
  assert.equal(router.read().page, 'notifyMgmt');
});

test('auth routes parse to the auth page', () => {
  setHash('#/register'); assert.equal(router.read().page, 'auth');
  setHash('#/forgot-password'); assert.equal(router.read().page, 'auth');
  setHash('#/login'); assert.equal(router.read().page, 'auth');
});

test('auth href/read carry the authView so the hash drives the login/register/forgot view', () => {
  assert.equal(router.href('auth', { authView: 'register' }), '/register');
  assert.equal(router.href('auth', { authView: 'forgot-password' }), '/forgot-password');
  assert.equal(router.href('auth', {}), '/login');
  assert.equal(router.href('auth', { view: 'register' }), '/register');
  setHash('#/register'); assert.equal(router.read().params.authView, 'register');
  setHash('#/forgot-password'); assert.equal(router.read().params.authView, 'forgot-password');
  setHash('#/login'); assert.equal(router.read().params.authView, 'login');
});

test('non-numeric tenantDbId and unknown routes fall back to monitor', () => {
  setHash('#/tenants/abc'); assert.equal(router.read().page, 'monitor'); assert.equal(router.read().invalid, true);
  setHash('#/does-not-exist'); assert.equal(router.read().page, 'monitor'); assert.equal(router.read().invalid, true);
  setHash('#/tenants/42/grab?page=1');
  assert.equal(router.read().page, 'tenant-grab');
  setHash('#/monitor'); assert.equal(router.read().invalid, undefined);
});

test('go pushes state, syncs location.hash, and notifies subscribers', () => {
  setHash('');
  const seen = [];
  const un = router.subscribe(s => seen.push(s.page));
  router.go('tenant-detail', { tenantDbId: '9', tab: 'users' });
  assert.deepEqual(globalThis.__routerCalls, [['push', '#/tenants/9?tab=users']]);
  assert.equal(globalThis.location.hash, '/tenants/9?tab=users');
  assert.deepEqual(seen, ['tenant-detail']);
  un();
  router.go('monitor');
  assert.deepEqual(seen, ['tenant-detail']);
});

test('go with replace uses replaceState', () => {
  setHash('#/grab');
  router.go('monitor', {}, { replace: true });
  assert.deepEqual(globalThis.__routerCalls, [['replace', '#/monitor']]);
});

test('subscribe returns an unsubscribe function', () => {
  setHash('#/monitor');
  const un = router.subscribe(() => {});
  assert.equal(typeof un, 'function');
});
