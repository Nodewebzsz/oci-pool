import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildPageParity } from './modern-ui-page-parity.mjs';
import { buildInventory } from './modern-ui-contracts.mjs';
import { countPageBaselineRequests } from './modern-ui-parity.mjs';

const ROUTES = {
  monitor: '/#/monitor',
  regions: '/#/regions',
  tenants: '/#/tenants',
  'tenant-detail': '/#/tenants/:tenantDbId',
  'tenant-grab': '/#/tenants/:tenantDbId/grab',
  'tenant-resources': '/#/tenants/:tenantDbId/resources',
  instances: '/#/instances',
  grab: '/#/grab',
  mail: '/#/mail',
  object: '/#/object-storage',
  ai: '/#/ai',
  link: '/#/link-test',
  logs: '/#/boot-logs',
  proxyKeyConfig: '/#/proxy/keys',
  cfManage: '/#/proxy/cloudflare',
  eoManage: '/#/proxy/edgeone',
  resList: '/#/resources',
  resCloudInit: '/#/resources/cloud-init',
  sysIpQuality: '/#/system/ip-quality',
  sysLogs: '/#/system/logs',
  sysSetting: '/#/system/security',
  sysVpnProxy: '/#/system/proxy',
  notifyMgmt: '/#/tools/notifications',
  memPage: '/#/tools/memos',
  migPage: '/#/tools/migration',
  mfaBackup: '/#/tools/mfa-backup',
  keyConfig: '/#/developer/tokens',
  auth: '/#/login, /#/register, /#/forgot-password',
  sysNotify: '/#/tools/notifications (alias)',
};

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function renderPageMatrix(pageRows) {
  const lines = [
    '# Modern UI 页面对照与迁移状态矩阵',
    '',
    '> 本文件由 `tools/modern-ui-generate-docs.mjs` 生成，依据 `docs/modern-ui-contract-manifest.json` 与 Java Controller 证据。',
    '',
    '### 说明',
    '',
    '- `status` 基于该页业务请求能否绑定到真实后端映射并解析请求/响应字段。',
    '- 共享文件（`page-misc.jsx`、`misc-actions.jsx`、`page-proxy.jsx`）承载多个功能页，相关页的 `requestCount` 是按文件聚合的上限，最终以 manifest 逐条归因为准。',
    '- 本阶段不允许存在 `manual-review` 或 `unverified` 业务行；任何缺失必须记录为 `backend-absent` 并附源文件/行证据。',
    '- `可见字段` 列为当前可从响应 DTO/Entity 解析出的字段集合的基线；对于返回 `Object`/`Map` 的接口，字段将在对应垂直切片（Task 5-9）逐一对照 Java getter 与原始 Freemarker 模板补齐。',
    '',
    '| Modern 页面 | Modern 路由 | 原项目路由 | 原模板 | 请求数 | 已连接 | 可见字段 | 接口动作 | 状态 |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of pageRows) {
    const route = ROUTES[row.modernPageId] || '—';
    const fields = row.visibleFields.join('<br>') || '—';
    const actions = row.actions.join('<br>') || '—';
    lines.push(`| ${row.modernPageId} | ${escapeCell(route)} | ${escapeCell(row.originalRoutes.join(', ') || '—')} | ${escapeCell(row.templates.join(', ') || '—')} | ${row.requestCount} | ${row.connectedCount} | ${escapeCell(fields)} | ${escapeCell(actions)} | ${row.status} |`);
  }
  return `${lines.join('\n')}\n`;
}

function renderContractMatrix(manifest, endpointCount, modernRequestCount, inventory) {
  const statusSummary = {};
  const staticAssets = manifest.filter(c => c.requestKind === 'static-asset').length;
  const business = manifest.filter(c => c.requestKind === 'business').length;
  const businessConnected = manifest.filter(c => c.requestKind === 'business' && c.status === 'connected').length;
  for (const c of manifest) statusSummary[c.status] = (statusSummary[c.status] || 0) + 1;
  const lines = [
    '# Modern UI / 原项目后端契约矩阵',
    '',
    '> 更新日期：2026-09-01。本文件由 `tools/modern-ui-generate-docs.mjs` 从 `docs/modern-ui-contract-manifest.json` 生成，替代手写版本。',
    '',
    '## 判定规则',
    '',
    '- 后端 Java Controller、请求 DTO、响应 DTO/Entity 是字段和方法的最终依据。',
    '- 原 Freemarker 页面及其 JavaScript 是功能、交互和接口使用方式的对照依据。',
    '- `modern-ui/src/data.jsx` 中的租户、实例、任务等样例数据不得作为生产回退值。',
    '- 数据库主键和 OCI 资源 ID 必须分开保存，不能用 `a || b` 合并。',
    '- 请求失败必须显示错误或空态，不能静默回退到模拟数据。',
    '',
    '## 自动扫描基线',
    '',
    '| 项目 | 当前数量 |',
    '|---|---:|',
    `| 后端映射 | ${endpointCount} |`,
    `| Modern UI 静态可识别请求 | ${modernRequestCount} |`,
    `| 原项目 Freemarker 请求 | ${inventory.originalRequestCount} |`,
    `| 原项目未匹配 | ${inventory.original.filter(r => r.status === 'unmatched').length} |`,
    `| 业务契约（connected） | ${businessConnected} |`,
    `| manual-review | ${statusSummary['manual-review'] || 0} |`,
    `| static-asset | ${staticAssets} |`,
    `| 业务请求总数 | ${business} |`,
    '',
    '## 业务契约清单',
    '',
    '| 方法 | 路径 | 源文件 | Controller | 方法 | 编码 | 请求字段 | 响应类型 | 原模板调用点 | 状态 |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const c of manifest) {
    if (c.requestKind !== 'business') continue;
    lines.push(`| ${c.method} | ${escapeCell(c.path)} | ${escapeCell(c.file)} | ${escapeCell(c.controller.replace('oci-server/src/main/java/', ''))} | ${c.methodName} | ${c.encoding} | ${escapeCell(c.requestFields.join(', ') || '—')} | ${escapeCell(c.responseType || '—')} | ${escapeCell((c.originalTemplate || []).join(', ') || '—')} | ${c.status} |`);
  }
  return `${lines.join('\n')}\n`;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const parity = await buildPageParity(projectRoot);
  const inventory = await buildInventory(projectRoot);

  const statusSummary = {};
  for (const c of parity.contracts) statusSummary[c.status] = (statusSummary[c.status] || 0) + 1;
  const manifest = {
    generatedAt: new Date().toISOString(),
    endpointCount: parity.endpointCount,
    // Preserve the generated page-entry baseline while retaining all shared
    // action/service contracts in the manifest for coverage tests.
    modernRequestCount: countPageBaselineRequests(parity.contracts),
    modernRequestCountAll: parity.contracts.length,
    statusSummary,
    contracts: parity.contracts,
  };
  await writeFile(
    resolve(projectRoot, 'docs/modern-ui-contract-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(projectRoot, 'docs/modern-ui-page-parity-matrix.md'),
    renderPageMatrix(parity.pageRows),
  );
  await writeFile(
    resolve(projectRoot, 'docs/modern-ui-contract-matrix.md'),
    renderContractMatrix(parity.contracts, parity.endpointCount, manifest.modernRequestCount, inventory),
  );
  process.stdout.write(`wrote manifest (${parity.contracts.length}) + page-parity matrix + contract matrix\n`);
}
