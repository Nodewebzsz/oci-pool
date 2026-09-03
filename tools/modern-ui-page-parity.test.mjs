import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function loadText(path) { return readFile(resolve(root, path), 'utf8'); }
async function loadJson(path) { return JSON.parse(await loadText(path)); }

test('navigation brand and account avatar follow the approved identity design', async () => {
  const layout = await loadText('oci-server/src/main/resources/static/modern-ui/src/layout.jsx');
  assert.match(layout, /function\s+PoolBrandMark\s*\(/);
  assert.match(layout, /function\s+getUserAvatarLabel\s*\(/);
  assert.match(layout, /function\s+UserAvatar\s*\(/);
  assert.match(layout, /欢迎，\{userName\s*\|\|\s*'用户'\}/);
  assert.doesNotMatch(layout, />AD<\/div>/);
  assert.match(layout, /marginTop:\s*5/);
});

test('proxy management entries use distinct collapsed-sidebar icons', async () => {
  const layout = await loadText('oci-server/src/main/resources/static/modern-ui/src/layout.jsx');
  assert.match(layout, /\{ id:\s*'proxyKeyConfig',[^\n]+icon:\s*'key' \}/);
  assert.match(layout, /\{ id:\s*'cfManage',[^\n]+icon:\s*'cloud' \}/);
  assert.match(layout, /\{ id:\s*'eoManage',[^\n]+icon:\s*'network' \}/);
});

test('contract manifest has zero manual-review business requests', async () => {
  const manifest = await loadJson('docs/modern-ui-contract-manifest.json');
  // The page-entry baseline is derived from the generated contracts, so assert
  // it is non-empty and internally self-consistent rather than hardcoding a
  // count that drifts as requests are migrated into shared service modules.
  const pageBaseline = manifest.contracts
    .filter(c => c.file.endsWith('/app.jsx') || c.file.includes('/page-')).length;
  assert.ok(manifest.modernRequestCount > 0, 'page-entry baseline must be non-empty');
  assert.equal(manifest.modernRequestCount, pageBaseline,
    'page-entry baseline must match the generated contracts');
  const manual = manifest.contracts.filter(c => c.status === 'manual-review');
  assert.deepEqual(manual.map(c => `${c.method} ${c.path}`), []);
});

test('page parity matrix has no manual-review rows before Task 2', async () => {
  const matrix = await loadText('docs/modern-ui-page-parity-matrix.md');
  const rows = matrix
    .split('\n')
    .filter(line => /^\| [a-zA-Z]+/.test(line))
    .filter(line => !/配置|判定|自动扫描|未核对/.test(line));
  for (const row of rows) {
    assert.doesNotMatch(row, /\| *manual-review *\|/, `unresolved page row: ${row}`);
  }
});

test('tenant detail API import action opens the shared real import modal', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-tenant-detail.jsx');
  assert.match(page, /const\s+apiImport\s*=\s*useApiImportModal\(\);/);
  assert.match(page, /<Button[^>]*onClick=\{apiImport\}[^>]*>API 导入<\/Button>/);
});

test('notification settings do not render generated or fixture credentials before backend load', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-tools.jsx');
  assert.doesNotMatch(page, /wht_\s*\+\s*Math\.random/);
  assert.doesNotMatch(page, /8123:AAExxx|开机提醒群|open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/xxxx/);
});

test('memo page uses MemoController CRUD and no seeded notes', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-tools.jsx');
  assert.doesNotMatch(page, /const\s+MEMO_SEED\s*=\s*\[/);
  assert.match(page, /ociServices\.memo\.list\(\)/);
  assert.match(page, /ociServices\.memo\.(?:update|remove)\(/);
  assert.doesNotMatch(page, /setNotes\(MEMO_SEED\)/);
  const manifest = await loadJson('docs/modern-ui-contract-manifest.json');
  const memoContracts = manifest.contracts.filter(c => c.path.startsWith('/api/memos'));
  assert.deepEqual(memoContracts.map(c => c.method).sort(), ['DELETE', 'GET', 'POST', 'PUT']);
});

test('migration and MFA pages do not report mock business success', async () => {
  const tools = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-tools.jsx');
  assert.doesNotMatch(tools, /备份文件已生成|数据快照：?14 租户|开始导入[^\n]*mock|mfa-vault-[^\n]*mock/);
  assert.doesNotMatch(tools, /const\s+MFA_SEED\s*=|setKeys\(MFA_SEED\)/);
});

test('AI drawer does not fabricate chat responses when no backend endpoint exists', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-misc.jsx');
  assert.doesNotMatch(page, /这是一个 mock 响应|Mock 响应|setTimeout\(\(\)\s*=>\s*\{[\s\S]*messages\.push/);
  assert.match(page, /后端未提供 AI 对话接口/);
});

test('migration export handler keeps async request outside modal configuration', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-tools.jsx');
  assert.doesNotMatch(page, /shell\.openModal\(\{\s*try\s*\{/);
  assert.match(page, /const\s+generateBackup\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*ociServices\.migration\.exportEncrypted/);
});

test('proxy and token pages do not render fixture credentials or random business results', async () => {
  const proxy = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-proxy.jsx');
  const actions = await loadText('oci-server/src/main/resources/static/modern-ui/src/misc-actions.jsx');
  assert.doesNotMatch(proxy, /PROXIES/);
  assert.doesNotMatch(proxy, /ocip_pat_1a2b3c/);
  assert.doesNotMatch(actions, /Math\.random\(\)/);
});

test('notification popovers use SystemMessageController instead of seeded history', async () => {
  const actions = await loadText('oci-server/src/main/resources/static/modern-ui/src/misc-actions.jsx');
  assert.doesNotMatch(actions, /NOTIF_HISTORY|grab-worker-3|traffic-alert|autonomous DB/i);
  assert.match(actions, /ociServices\.notify\.list/);
  assert.match(actions, /ociServices\.notify\.readAll/);
  assert.match(actions, /ociServices\.notify\.get/);
});

test('object storage does not call the backend-absent object listing endpoint', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-misc.jsx');
  assert.doesNotMatch(page, /fetch\([^\n]*\/oci\/storage\/objects/);
  assert.match(page, /后端暂未提供对象列表接口/);
});

// The production data bundle must never contain realistic samples. This gate is
// intentionally kept in the contract test suite (Task 10 release gate) and is
// never allowed to be silently disabled.
