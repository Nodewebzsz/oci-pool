import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildParity } from './modern-ui-parity.mjs';
import { extractFrontendRequests } from './modern-ui-contracts.mjs';

const PAGE_ORIGINAL = {
  monitor: { originalRoutes: ['/metricsPage', '/statistics/monitor', '/dashboard'], templates: ['metrics_page2.ftl', 'oci_monitor.ftl', 'dashboard.ftl'] },
  regions: { originalRoutes: ['/resource/arm-page', '/tenants/regionSubList'], templates: ['arm_records.ftl', 'region_sub.ftl'] },
  tenants: { originalRoutes: ['/tenants/list'], templates: ['tenant_list.ftl'] },
  'tenant-detail': { originalRoutes: ['/tenants/regionList'], templates: ['tenant_region_list.ftl', 'machine_list.ftl', 'oci_cost.ftl'] },
  'tenant-grab': { originalRoutes: ['/boot/fullBootList'], templates: ['full_machine_list.ftl', 'add_boot.ftl'] },
  'tenant-resources': { originalRoutes: ['/oci/list', '/oci-instance-detail'], templates: ['oci_machine_list.ftl', 'oci_ins_network.ftl', 'oci_network_manage.ftl', 'oci_instance_detail.ftl'] },
  instances: { originalRoutes: ['/oci/list', '/oci/total'], templates: ['oci_machine_total_list.ftl', 'oci_machine_list.ftl'] },
  grab: { originalRoutes: ['/boot/fullBootList'], templates: ['full_machine_list.ftl'] },
  mail: { originalRoutes: ['/email/page'], templates: ['email.ftl'] },
  object: { originalRoutes: ['/oci/object-storage'], templates: ['oci_object_storage.ftl'] },
  ai: { originalRoutes: ['/ai/chat', '/system/aiModels'], templates: ['chat.ftl', 'ai_model_config.ftl'] },
  link: { originalRoutes: ['/speedtest'], templates: ['speed_test.ftl'] },
  logs: { originalRoutes: ['/system/openLogs', '/system/log'], templates: ['open_boot_log.ftl', 'sys_log.ftl'] },
  proxyKeyConfig: { originalRoutes: ['/settings/domain'], templates: ['domain_settings.ftl'] },
  cfManage: { originalRoutes: ['/dns/cloudflare'], templates: ['cf_manage.ftl'] },
  eoManage: { originalRoutes: ['/dns/edgeone'], templates: ['eo_manage.ftl'] },
  resList: { originalRoutes: ['/vps/list'], templates: ['vps_list.ftl'] },
  resCloudInit: { originalRoutes: ['/resources/cloud-init'], templates: [] },
  sysIpQuality: { originalRoutes: ['/settings/ip'], templates: ['ip_settings.ftl'] },
  sysLogs: { originalRoutes: ['/system/log'], templates: ['sys_log.ftl'] },
  sysSetting: { originalRoutes: ['/settings/security'], templates: ['system_settings.ftl'] },
  sysVpnProxy: { originalRoutes: ['/vpnProxy/pageList'], templates: ['vpn_proxy.ftl'] },
  notifyMgmt: { originalRoutes: ['/settings/notify'], templates: ['notification_settings.ftl'] },
  memPage: { originalRoutes: ['/system/memo'], templates: ['memo.ftl'] },
  migPage: { originalRoutes: ['/migration'], templates: ['migration.ftl'] },
  mfaBackup: { originalRoutes: ['/mfa/page'], templates: ['mfa.ftl'] },
  keyConfig: { originalRoutes: ['/settings/api-token'], templates: ['api_token_config.ftl'] },
  auth: { originalRoutes: ['/login', '/register'], templates: ['login_user.ftl', 'layout.ftl', 'index.ftl'] },
};

const PAGE_FILES = [
  'page-monitor.jsx', 'page-regions.jsx', 'page-tenants.jsx',
  'page-tenant-detail.jsx', 'page-tenant-grab.jsx', 'page-tenant-resources.jsx',
  'page-instances.jsx', 'page-grab.jsx', 'page-misc.jsx', 'page-proxy.jsx',
  'page-tools.jsx', 'page-logs.jsx', 'page-auth.jsx',
];

const ACTION_FILE_PAGES = {
  'instance-actions.jsx': ['instances'],
  'grab-actions.jsx': ['grab'],
  'tenant-actions.jsx': ['tenants', 'tenant-detail', 'tenant-grab', 'tenant-resources'],
  'misc-actions.jsx': ['mail', 'object', 'ai', 'link', 'logs', 'proxyKeyConfig', 'cfManage', 'eoManage', 'resList', 'resCloudInit', 'sysIpQuality', 'sysLogs', 'sysSetting', 'sysVpnProxy', 'notifyMgmt', 'memPage', 'migPage', 'mfaBackup', 'keyConfig'],
};

// Consume a component function's parameter list (which may be destructured,
// e.g. MonitorPage({ density })) and return the index of the body's opening
// brace, or -1 if it is not a recognizable function body.
function functionBodyOpen(source, match) {
  const openParen = match.index + match[0].length - 1;
  let i = openParen;
  let depth = 0;
  let quote = null;
  const BACKTICK = String.fromCharCode(96);
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote && source[i - 1] !== '\\') quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === BACKTICK) { quote = ch; i += 1; continue; }
    if (ch === '(') { depth += 1; i += 1; continue; }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
      i += 1;
      continue;
    }
    i += 1;
  }
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return source[i] === '{' ? i : -1;
}

// Attribute each page file's requests to the page component that contains them,
// so pages in shared files (page-misc/page-proxy/page-tools/page-logs) get
// accurate fields/actions instead of an aggregate of every shared request.
async function buildFeatureRequests(projectRoot, componentToPage) {
  const map = new Map();
  for (const fileName of PAGE_FILES) {
    const source = await readFile(
      resolve(projectRoot, `oci-server/src/main/resources/static/modern-ui/src/${fileName}`),
      'utf8',
    );
    // `page-auth.jsx` hosts login/register/forgot; attribute the whole file to auth.
    if (fileName === 'page-auth.jsx') {
      for (const req of extractFrontendRequests(source, fileName)) {
        const set = map.get('auth') || new Set();
        set.add(`${req.method} ${req.path}`);
        map.set('auth', set);
      }
      continue;
    }
    const fnRe = /\bfunction\s+(\w+)\s*\(/g;
    for (const match of source.matchAll(fnRe)) {
      const name = match[1];
      const page = componentToPage.get(name);
      if (!page) continue;
      const open = functionBodyOpen(source, match);
      if (open < 0) continue;
      let depth = 0;
      let close = open;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) { close = i; break; }
        }
      }
      const span = source.slice(open + 1, close);
      const requests = extractFrontendRequests(span, fileName);
      const set = map.get(page) || new Set();
      for (const req of requests) set.add(`${req.method} ${req.path}`);
      map.set(page, set);
    }
  }
  return map;
}

function pageStatusFor(page, contracts, featureRequests) {
  const actionFiles = Object.keys(ACTION_FILE_PAGES).filter(f => ACTION_FILE_PAGES[f].includes(page));
  const rows = contracts.filter(c => {
    const baseName = c.file.split('/').pop();
    if (PAGE_FILES.includes(baseName)) {
      const allowed = featureRequests.get(page);
      return allowed ? allowed.has(`${c.method} ${c.path}`) : false;
    }
    return actionFiles.includes(baseName);
  });
  if (!rows.length) return { status: 'no-direct-requests', requests: [], unresolved: [] };
  const unresolved = rows.filter(r => r.status === 'manual-review');
  if (unresolved.length) return { status: 'manual-review', requests: rows, unresolved };
  return { status: 'connected', requests: rows, unresolved: [] };
}

export async function buildPageParity(projectRoot) {
  const parity = await buildParity(projectRoot);
  const appSource = await readFile(resolve(projectRoot, 'oci-server/src/main/resources/static/modern-ui/src/app.jsx'), 'utf8');
  const pagesBody = appSource.match(/const PAGES = \{([\s\S]*?)\n  \};/);
  const pageIds = pagesBody
    ? [...pagesBody[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*))\s*:/gm)].map(m => m[1] || m[2])
    : [];
  const componentToPage = new Map();
  if (pagesBody) {
    for (const m of pagesBody[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*))\s*:\s*(\w+)\s*,/gm)) {
      componentToPage.set(m[3], m[1] || m[2]);
    }
  }
  const featureRequests = await buildFeatureRequests(projectRoot, componentToPage);
  const ordered = [...new Set([...pageIds, 'auth'])];
  const rows = ordered.map(page => {
    const original = PAGE_ORIGINAL[page] || { originalRoutes: [], templates: [] };
    const review = pageStatusFor(page, parity.contracts, featureRequests);
    const visibleFields = [...new Set(review.requests.flatMap(r => r.responseFields || []))];
    const actions = review.requests.map(r => `${r.method} ${r.path}`);
    const actionDetail = review.requests.map(r =>
      `${r.method} ${r.path}${r.encoding ? ' [' + r.encoding + ']' : ''}${r.originalTemplate && r.originalTemplate.length ? ' <- ' + r.originalTemplate.join(',') : ''}`);
    return {
      modernPageId: page,
      originalRoutes: original.originalRoutes,
      templates: original.templates,
      requestCount: review.requests.length,
      connectedCount: review.requests.filter(r => r.status === 'connected').length,
      status: review.status,
      actions: actionDetail,
      visibleFields,
      requestPaths: actions,
      unresolved: review.unresolved.map(r => r.method + ' ' + r.path),
    };
  });
  return { pageRows: rows, endpointCount: parity.endpointCount, contracts: parity.contracts };
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const result = await buildPageParity(projectRoot);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
