import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(
  root,
  'oci-server/src/main/resources/static/modern-ui/src/tenant-row.js',
);

function loadTenantRow() {
  if (!fs.existsSync(helperPath)) {
    assert.fail('缺少 tenant-row.js，租户后端字段与 UI 派生字段无法独立验收');
  }
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(helperPath, 'utf8'), context, { filename: helperPath });
  return context.window.ociTenantRow;
}

const regions = [
  { code: 'ap-singapore-1', simpleName: '新加坡西', cn: '新加坡西', name: 'Singapore' },
  { code: 'sa-saopaulo-1', simpleName: '圣保罗东', cn: '圣保罗东', name: 'Sao Paulo' },
];

test('保留空 defName、0、false、子区域和失效账号的后端原值', () => {
  const tenantRow = loadTenantRow();
  const source = {
    id: 42,
    idStr: '90071992547409931234',
    tenantId: 'ocid1.tenancy.oc1..example',
    userName: 'default',
    tenancyName: '默认租户',
    region: '新加坡西',
    createdAt: '2026-09-01T10:10:00',
    createdAtStr: '2026-09-01 10:10',
    defName: '',
    accountCost: 0,
    activeDays: 0,
    openBootFlag: false,
    hasChildren: false,
    children: [{ id: 43, idStr: '43', region: '圣保罗东', isActive: false }],
    isActive: false,
    proxyBound: false,
    proxyForce: false,
  };

  const row = tenantRow.normalize(source, regions);

  for (const [key, value] of Object.entries(source)) {
    assert.deepEqual(row[key], value, `后端字段 ${key} 不应被 normalize 覆盖`);
  }
  assert.equal(row._ui.id, '90071992547409931234');
  assert.equal(row._ui.regionCode, 'ap-singapore-1');
  assert.equal(row._ui.isActive, false);
  assert.equal(row._ui.alias, '');
  assert.equal(row._ui.activeDays, '0');
  assert.equal(row._ui.hasBootTask, false);
  assert.equal(row._ui.hasChildren, false);
  assert.deepEqual(row.children, source.children);
});

test('缺失 activeDays 格式化为 0，true 布尔和区域 code 不被改写', () => {
  const tenantRow = loadTenantRow();
  const source = {
    id: 0,
    idStr: '0',
    tenancyName: '',
    userName: 'zero-user',
    region: 'sa-saopaulo-1',
    accountCost: '0',
    openBootFlag: true,
    hasChildren: true,
    isActive: true,
  };

  const row = tenantRow.normalize(source, regions);

  assert.equal(row.id, 0);
  assert.equal(row.idStr, '0');
  assert.equal(row.region, 'sa-saopaulo-1');
  assert.equal(row._ui.id, '0');
  assert.equal(row._ui.name, '');
  assert.equal(row._ui.accountCost, 0);
  assert.equal(row._ui.activeDays, '0');
  assert.equal(row._ui.hasBootTask, true);
  assert.equal(row._ui.hasChildren, true);
  assert.equal(row._ui.isActive, true);
  assert.equal(row._ui.regionCode, 'sa-saopaulo-1');
});

test('后端历史回填的 userName/OCID defName 按未设置处理，不能冒充自定义名称', () => {
  const tenantRow = loadTenantRow();
  const row = tenantRow.normalize({
    id: 7,
    idStr: '7',
    tenantId: 'ocid1.tenancy.example',
    userName: 'ocid1.user.example',
    tenancyName: 'saopaulo',
    defName: 'ocid1.user.example',
  }, regions);
  assert.equal(row._ui.alias, '');
});

test('租户页在 mapper 之后加载并使用独立字段契约', () => {
  const html = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/index.html'),
    'utf8',
  );
  const mapperIndex = html.indexOf('/modern-ui/src/tenant-row.js');
  const pageIndex = html.indexOf('/modern-ui/src/page-tenants.jsx');
  assert.ok(mapperIndex >= 0, 'index.html 未加载 tenant-row.js');
  assert.ok(mapperIndex < pageIndex, 'tenant-row.js 必须先于 page-tenants.jsx 加载');
});

test('租户操作统一使用 idStr 派生的精确 ID，禁止直接读取可能失真的数字 id', () => {
  const actions = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx'),
    'utf8',
  );
  const page = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/page-tenants.jsx'),
    'utf8',
  );
  assert.doesNotMatch(actions, /\b(?:tenant|preselectedTenant)\.id\b/);
  assert.doesNotMatch(page, /\b(?:tenant|row)\.id\b/);
});

test('开机弹窗锁定租户名称必须读取标准化字段，不能读取已移除的顶层 name', () => {
  const actions = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx'),
    'utf8',
  );
  assert.doesNotMatch(
    actions,
    /<span className="mono"[^>]*>\{t\.name\}<\/span>/,
    '锁定租户卡片不能依赖标准化行中不存在的顶层 t.name',
  );
});

test('租户表保留原项目代理护盾入口并使用真实代理绑定服务', () => {
  const page = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/page-tenants.jsx'),
    'utf8',
  );
  assert.match(page, /useTenantProxyQuickModal/);
  assert.match(page, /key: 'proxy'/);
  assert.match(page, /proxyQuick\(r\)/);
});

test('费用、流量和审计导出必须基于真实查询结果，不能只弹出成功提示', () => {
  const actions = fs.readFileSync(
    path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx'),
    'utf8',
  );
  assert.doesNotMatch(actions, /已导出审计日志 → audit-log\.csv/);
  assert.doesNotMatch(actions, /已导出流量报表 → traffic-report\.csv/);
  assert.doesNotMatch(actions, /已导出账单 → cost_/);
});
