import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const SRC = new URL('../oci-server/src/main/resources/static/modern-ui/src/', import.meta.url);
const MANIFEST_URL = new URL('../docs/modern-ui-contract-manifest.json', import.meta.url);

async function loadContracts() {
  const src = await readFile(new URL('contracts.js', SRC), 'utf8');
  const window = {};
  vm.runInNewContext(src, { window });
  return window.ociContracts;
}

function buildApiMock() {
  const calls = [];
  const api = {
    request(path, options = {}) {
      calls.push({ type: 'request', path, options });
      return Promise.resolve({});
    },
    getPage(path, query = {}) {
      calls.push({ type: 'getPage', path, options: { method: 'GET', query } });
      return Promise.resolve({ content: [] });
    },
  };
  return { api, calls };
}

async function loadServices() {
  const files = ['services-auth.js', 'services-tenant.js', 'services-instance.js', 'services-boot.js', 'services-system.js', 'services-ai.js', 'services-migration.js', 'services-mfa-backup.js', 'services-proxy.js', 'services-token.js', 'services-notify.js', 'services-memo.js', 'services-mail.js', 'services-storage.js'];
  const contracts = await loadContracts();
  const { api, calls } = buildApiMock();
  const window = { URLSearchParams, FormData, ociApi: api, ociContracts: contracts };
  for (const f of files) {
    const src = await readFile(new URL(f, SRC), 'utf8');
    vm.runInNewContext(src, { window, URLSearchParams, FormData });
  }
  return { services: window.ociServices, calls, contracts };
}

function* serviceFns(obj, prefix = '') {
  for (const [name, value] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'function') yield [key, value];
    else if (value && typeof value === 'object') yield* serviceFns(value, key);
  }
}

test('contracts.id preserves 0 and rejects empty ids', async () => {
  const c = await loadContracts();
  assert.equal(c.id(0), '0');
  assert.equal(c.id('42'), '42');
  assert.equal(c.id(42), '42');
  assert.throws(() => c.id(undefined));
  assert.throws(() => c.id(null));
  assert.throws(() => c.id(''));
  assert.throws(() => c.id('   '));
});

test('contracts.page rejects invalid envelopes', async () => {
  const c = await loadContracts();
  assert.ok(c.page({ content: [] }));
  assert.ok(c.page({ content: [1, 2] }));
  assert.throws(() => c.page(null));
  assert.throws(() => c.page({}));
  assert.throws(() => c.page({ content: 'x' }));
  assert.throws(() => c.page([]));
});

test('contracts.record and contracts.api reject null/primitive', async () => {
  const c = await loadContracts();
  assert.ok(c.record({ a: 1 }));
  assert.ok(c.api({ code: 0 }));
  assert.throws(() => c.record(null));
  assert.throws(() => c.record('x'));
  assert.throws(() => c.api(null));
});

test('auth.login builds exact form keys with optional factor fields', async () => {
  const { services, calls } = await loadServices();
  await services.auth.login({ username: 'u', password: 'p', verificationCode: '123456', remember: true });
  const login = calls.find(c => c.type === 'request' && c.path === '/perform_login');
  assert.ok(login);
  assert.equal(login.options.method, 'POST');
  const body = login.options.body;
  assert.equal(body.get('username'), 'u');
  assert.equal(body.get('password'), 'p');
  assert.equal(body.get('verificationCode'), '123456');
  assert.equal(body.get('remember-me'), 'on');
  assert.equal(body.get('mfaCode'), null);
});

test('every service constructor maps to a manifest endpoint with matching encoding', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'));
  const byKey = new Map();
  for (const c of manifest.contracts) {
    if (c.requestKind !== 'business') continue;
    byKey.set(`${c.method} ${c.path}`, c);
  }
  const { services } = await loadServices();
  let count = 0;
  for (const [name, fn] of serviceFns(services)) {
    const ep = fn.endpoint;
    assert.ok(ep, `service ${name} missing endpoint metadata`);
    const contract = byKey.get(`${ep.method} ${ep.path}`);
    assert.ok(contract, `no manifest contract for ${name} ${ep.method} ${ep.path}`);
    assert.equal(contract.encoding, ep.encoding, `encoding mismatch for ${name} ${ep.method} ${ep.path}`);
    count++;
  }
  assert.ok(count >= 40, `expected at least 40 service constructors, got ${count}`);
});

test('tenants.updateCustomName builds the exact JSON request', async () => {
  const { services, calls } = await loadServices();
  await services.tenant.updateCustomName({ tenantId: '42', defName: '测试别名' });
  const call = calls.find(c => c.type === 'request' && c.path === '/tenants/updateCustomName');
  assert.ok(call);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.equal(call.options.body, JSON.stringify({ tenantId: '42', defName: '测试别名' }));
});

test('tenants.updateAccountCost builds the exact backend DTO body', async () => {
  const { services, calls } = await loadServices();
  await services.tenant.updateAccountCost({ tenantId: '90071992547409931234', accountCost: '0' });
  const call = calls.find(c => c.type === 'request' && c.path === '/tenants/updateAccountCost');
  assert.ok(call);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.equal(
    call.options.body,
    JSON.stringify({ tenantId: '90071992547409931234', accountCost: '0' }),
  );
});

test('vpn proxy tenant binding constructors preserve backend request fields', async () => {
  const { services, calls } = await loadServices();
  await services.system.vpnFindByTenant({ tenantId: '42' });
  await services.system.vpnBindTenant({ tenantId: '42', id: 7 });
  const findCall = calls.find(c => c.type === 'request' && c.path === '/vpnProxy/findByTenant');
  const bindCall = calls.find(c => c.type === 'request' && c.path === '/vpnProxy/bindTenant');
  assert.ok(findCall);
  assert.ok(bindCall);
  assert.equal(findCall.options.method, 'POST');
  assert.equal(bindCall.options.method, 'POST');
  assert.equal(findCall.options.headers['Content-Type'], 'application/json');
  assert.equal(bindCall.options.headers['Content-Type'], 'application/json');
  assert.equal(findCall.options.body, JSON.stringify({ tenantId: '42' }));
  assert.equal(bindCall.options.body, JSON.stringify({ tenantId: '42', id: 7 }));
});

test('migration constructors preserve download/upload endpoints and multipart fields', async () => {
  const { services, calls } = await loadServices();
  await services.migration.exportDatabase();
  await services.migration.exportEncrypted();
  await services.migration.importEncrypted({ file: new Blob(['backup']), masterKey: 'MASTER' });
  assert.equal(calls.find(c => c.path === '/migration/export').options.responseType, 'blob');
  assert.equal(calls.find(c => c.path === '/migration/exportEncrypted').options.responseType, 'raw');
  const upload = calls.find(c => c.path === '/migration/importEncrypted');
  assert.equal(upload.options.method, 'POST');
  assert.equal(upload.options.body.get('file') instanceof Blob, true);
  assert.equal(upload.options.body.get('masterKey'), 'MASTER');
});

test('mfa constructors preserve original form/query fields', async () => {
  const { services, calls } = await loadServices();
  await services.mfaBackup.listKeys();
  await services.mfaBackup.saveSecret({ keyName: 'GitHub', secretKey: 'ABC123' });
  await services.mfaBackup.generateOtp({ secretKey: 'ABC123' });
  await services.mfaBackup.deleteKey({ keyName: 'GitHub' });
  await services.mfaBackup.exportData();
  assert.equal(calls.find(c => c.path === '/api/mfa/keys').options.method, undefined);
  const save = calls.find(c => c.path === '/save-secret');
  assert.equal(save.options.method, 'POST');
  assert.equal(save.options.body.get('keyName'), 'GitHub');
  assert.equal(save.options.body.get('secretKey'), 'ABC123');
  assert.equal(calls.find(c => c.path === '/generate-otp?secretKey=ABC123').options.method, undefined);
  const del = calls.find(c => c.path === '/delete-key');
  assert.equal(del.options.body, JSON.stringify({ keyName: 'GitHub' }));
  assert.equal(calls.find(c => c.path === '/export-data').options.responseType, 'blob');
});

test('proxy service constructors preserve page request fields and response endpoints', async () => {
  const { services, calls } = await loadServices();
  await services.proxy.pageList({ pageNum: 1, pageSize: 10 });
  await services.proxy.saveOrUpdate({ id: 7, proxyType: 'SOCKS5', proxyHost: 'proxy.example', proxyPort: 1080, availableStatus: 1, forceProxy: 0, tenantIds: [42] });
  await services.proxy.testConnection({ id: 7 });
  await services.proxy.testAll();
  await services.proxy.remove({ id: 7 });
  assert.equal(calls.find(c => c.path === '/vpnProxy/pageList').options.body, JSON.stringify({ pageNum: 1, pageSize: 10 }));
  assert.equal(calls.find(c => c.path === '/vpnProxy/saveOrUpdate').options.body, JSON.stringify({ id: 7, proxyType: 'SOCKS5', proxyHost: 'proxy.example', proxyPort: 1080, availableStatus: 1, forceProxy: 0, tenantIds: [42] }));
  assert.equal(calls.find(c => c.path === '/vpnProxy/testConnection').options.body, JSON.stringify({ id: 7 }));
  assert.equal(calls.find(c => c.path === '/vpnProxy/testAll').options.method, 'POST');
  assert.equal(calls.find(c => c.path === '/vpnProxy/delete').options.body, JSON.stringify({ id: 7 }));
});

test('domain provider services translate the Cloudflare UI alias to the backend DTO', async () => {
  const { services, calls } = await loadServices();
  await services.system.updateCloudflareConfig({ apiKey: 'global-key', zoneId: 'zone-1', email: 'u@example.com', enabled: true });
  await services.system.testCloudflareConnection({ apiKey: 'global-key', zoneId: 'zone-1', email: 'u@example.com', enabled: true });
  await services.system.updateEdgeOneConfig({ secretId: 'sid', secretKey: 'skey', region: '', enabled: false });
  const expectedCloudflare = JSON.stringify({ apiToken: 'global-key', zoneId: 'zone-1', email: 'u@example.com', enabled: true });
  assert.equal(calls.find(c => c.path === '/api/system/updateCloudflareConfig').options.body, expectedCloudflare);
  assert.equal(calls.find(c => c.path === '/api/system/testCloudflareConnection').options.body, expectedCloudflare);
  assert.equal(calls.find(c => c.path === '/api/system/updateEdgeOneConfig').options.body, JSON.stringify({ enabled: false, secretId: 'sid', secretKey: 'skey', region: '' }));
});

test('token service constructors use persisted config/status endpoints and exact DTO fields', async () => {
  const { services, calls } = await loadServices();
  await services.token.configs();
  await services.token.generate({ enabled: true, tokenName: 'test', expirationDays: 30, description: 'd', allowSwaggerAccess: true });
  await services.token.revoke();
  const configs = calls.find(c => c.path === '/api/system/apiTokenConfigs');
  const generate = calls.find(c => c.path === '/api/system/generateApiToken');
  const revoke = calls.find(c => c.path === '/api/system/revokeApiToken');
  assert.ok(configs);
  assert.equal(generate.options.body, JSON.stringify({ enabled: true, tokenName: 'test', expirationDays: 30, description: 'd', allowSwaggerAccess: true }));
  assert.equal(revoke.options.method, 'POST');
});

test('notification service constructors preserve SystemMessage request fields', async () => {
  const { services, calls } = await loadServices();
  await services.notify.list({ pageNum: 1, pageSize: 20, readStatus: 0, subject: 'OCI' });
  await services.notify.get({ businessId: 'biz-9' });
  await services.notify.readAll();
  await services.notify.countUnread();
  await services.notify.remove({ businessId: 'biz-9' });
  assert.equal(calls.find(c => c.path === '/sysMessage/list').options.body, JSON.stringify({ readStatus: 0, subject: 'OCI', pageNum: 1, pageSize: 20 }));
  assert.equal(calls.find(c => c.path === '/sysMessage/get').options.body, JSON.stringify({ businessId: 'biz-9' }));
  assert.equal(calls.find(c => c.path === '/sysMessage/read').options.method, 'POST');
  assert.equal(calls.find(c => c.path === '/sysMessage/countUnread').options.method, 'POST');
  assert.equal(calls.find(c => c.path === '/sysMessage/del').options.body, JSON.stringify({ businessId: 'biz-9' }));
});

test('mail and storage constructors preserve controller fields and encodings', async () => {
  const { services, calls } = await loadServices();
  await services.mail.receiveAdd({ name: '用户', email: 'u@example.com' });
  await services.mail.receiveDelete({ id: 7 });
  await services.mail.send({ title: '主题', content: '正文', tenantEmailConfigId: 3, emailReceiveIds: [7] });
  await services.mail.disable({ tenantId: '42' });
  await services.storage.buckets({ tenantId: 42, limit: 10 });
  await services.storage.createBucket({ tenantId: 42, bucketName: 'b', publicAccessType: 'NoPublicAccess' });
  await services.storage.upload({ tenantId: 42, namespace: 'ns', bucketName: 'b', objectName: 'a.txt', file: new Blob(['a']) });
  assert.equal(calls.find(c => c.path === '/email/receive/add').options.body, JSON.stringify({ name: '用户', email: 'u@example.com' }));
  assert.equal(calls.find(c => c.path === '/email/receive/delete?id=7').options.method, 'POST');
  assert.equal(calls.find(c => c.path === '/email/send').options.body, JSON.stringify({ title: '主题', content: '正文', tenantEmailConfigId: 3, emailReceiveIds: [7] }));
  assert.equal(calls.find(c => c.path === '/oci/storage/bucket/create').options.body, JSON.stringify({ tenantId: 42, bucketName: 'b', publicAccessType: 'NoPublicAccess' }));
  assert.equal(calls.find(c => c.path === '/oci/storage/object/upload').options.body.get('objectName'), 'a.txt');
});

test('AI service constructors preserve ChatAiConfigDto fields and endpoints', async () => {
  const { services, calls } = await loadServices();
  await services.ai.configs();
  await services.ai.tenants();
  await services.ai.modelsByTenant({ tenantId: '42' });
  await services.ai.save({
    id: 7,
    tenantId: '42',
    modelId: 'cohere.command-r-plus',
    showModelId: 'Command R+',
    cloudType: 1,
    modelName: 'Command R+',
    provider: 'OCI',
    apiKey: 'secret',
    baseUrl: 'https://example.test',
    enabled: false,
    systemPrompt: 'system',
    maxTokens: 2048,
    temperature: '0.2',
    maxHistoryMessages: 12,
    region: 'us-phoenix-1',
    userName: 'user',
  });
  await services.ai.batchToggle({ enabled: true });
  await services.ai.remove({ id: 7 });

  assert.equal(calls.find(c => c.path === '/system/telegramAiConfigs').type, 'request');
  assert.equal(calls.find(c => c.path === '/system/ai/tenants').type, 'request');
  assert.equal(calls.find(c => c.path === '/system/ai/modelsByTenant?tenantId=42').type, 'request');
  const save = calls.find(c => c.path === '/system/updateTelegramAiConfig');
  assert.equal(save.options.method, 'POST');
  assert.equal(save.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(save.options.body), {
    id: 7,
    tenantId: '42',
    modelId: 'cohere.command-r-plus',
    showModelId: 'Command R+',
    cloudType: 1,
    modelName: 'Command R+',
    provider: 'OCI',
    apiKey: 'secret',
    baseUrl: 'https://example.test',
    enabled: false,
    systemPrompt: 'system',
    maxTokens: 2048,
    temperature: '0.2',
    maxHistoryMessages: 12,
    region: 'us-phoenix-1',
    userName: 'user',
  });
  const batch = calls.find(c => c.path === '/system/batchToggleTelegramAiConfigs');
  assert.equal(batch.options.body, JSON.stringify({ enabled: true }));
  const remove = calls.find(c => c.path === '/system/deleteTelegramAiConfig/7');
  assert.equal(remove.options.method, 'DELETE');
});

test('security settings constructors preserve OAuth, Turnstile, logo and channel DTO fields', async () => {
  const { services, calls } = await loadServices();
  await services.system.updateGithubConfig({
    enabled: false,
    userName: 'octocat',
    githubId: '583231',
    clientId: 'github-client',
    clientSecret: 'github-secret',
    redirectUri: 'https://example.test/api/github/callback',
  });
  await services.system.updateGoogleConfig({
    enabled: true,
    email: 'user@example.test',
    clientId: 'google-client',
    clientSecret: 'google-secret',
    redirectUri: 'https://example.test/api/google/callback',
  });
  await services.system.updateTurnstileConfig({ enabled: false, siteKey: '', secretKey: '' });
  await services.system.updateLogo({ logoName: 'OCI-POOL' });
  await services.system.updateChannelNotifyConfig({ enabled: false });

  assert.equal(calls.find(c => c.path === '/api/system/updateGithubConfig').options.body, JSON.stringify({
    clientId: 'github-client', clientSecret: 'github-secret', redirectUri: 'https://example.test/api/github/callback',
    githubId: '583231', userName: 'octocat', enabled: false,
  }));
  assert.equal(calls.find(c => c.path === '/api/system/updateGoogleConfig').options.body, JSON.stringify({
    enabled: true, email: 'user@example.test', clientId: 'google-client', clientSecret: 'google-secret', redirectUri: 'https://example.test/api/google/callback',
  }));
  assert.equal(calls.find(c => c.path === '/api/system/updateTurnstileConfig').options.body, JSON.stringify({ enabled: false, siteKey: '', secretKey: '' }));
  const logo = calls.find(c => c.path === '/api/system/settings/logo');
  assert.equal(logo.options.method, 'POST');
  assert.equal(logo.options.body.get('logoName'), 'OCI-POOL');
  assert.equal(calls.find(c => c.path === '/api/system/updateChannelNotifyConfig').options.body, JSON.stringify({ enabled: false }));
});

test('security page routes every internal save through system services and starts OAuth fields empty', async () => {
  const source = await readFile(new URL('page-misc.jsx', SRC), 'utf8');
  assert.match(source, /useState\(\{ enabled: false, githubUser: '', githubId: '', clientId: '', clientSecret: '', webhookUrl: '', fetching: false \}\)/);
  assert.match(source, /useState\(\{ enabled: false, email: '', clientId: '', clientSecret: '', webhookUrl: '' \}\)/);
  for (const serviceName of ['updateGithubConfig', 'updateGoogleConfig', 'updateTurnstileConfig', 'updateLogo', 'updateChannelNotifyConfig']) {
    assert.match(source, new RegExp(`window\\.ociServices\\.system\\.${serviceName}\\(`), `missing service call ${serviceName}`);
  }
  assert.doesNotMatch(source, /fetch\('\/api\/system\/(?:updateGithubConfig|updateGoogleConfig|updateTurnstileConfig|settings\/logo|updateChannelNotifyConfig)'/);
  assert.doesNotMatch(source, /const postJson\s*=/);
});

test('DNS provider constructors preserve Cloudflare and EdgeOne controller fields', async () => {
  const { services, calls } = await loadServices();
  await services.proxy.cloudflareZones();
  await services.proxy.cloudflareRecords({ zoneId: 'cf-zone', page: 2, size: 20 });
  await services.proxy.cloudflareAddRecord({ zoneId: 'cf-zone', type: 'A', name: 'www', content: '192.0.2.1', ttl: 300, proxied: false });
  await services.proxy.cloudflareUpdateRecord({ recordId: 'cf-record', zoneId: 'cf-zone', recordType: 'A', recordName: 'www', content: '192.0.2.2', ttl: 600, proxied: true });
  await services.proxy.cloudflareDeleteRecord({ recordId: 'cf-record', zoneId: 'cf-zone' });
  await services.proxy.cloudflareSync({ zoneId: 'cf-zone', domainName: 'example.test' });
  await services.proxy.edgeOneZones();
  await services.proxy.edgeOneRecords({ zoneId: 'eo-zone', type: 'dns' });
  await services.proxy.edgeOneAddRecord({ zoneId: 'eo-zone', type: 'MX', name: '@', content: 'mail.example.test', ttl: 300, priority: 10 });
  await services.proxy.edgeOneUpdateRecord({ recordId: 'eo-record', zoneId: 'eo-zone', recordType: 'MX', recordName: '@', content: 'mx.example.test', ttl: 600, priority: 20 });
  await services.proxy.edgeOneDeleteRecord({ recordId: 'eo-record' });
  await services.proxy.edgeOneSync({ zoneId: 'eo-zone', domainName: 'example.test' });
  await services.proxy.edgeOneDomains({ zoneId: 'eo-zone' });
  await services.proxy.edgeOneDeleteDomain({ domainId: 'eo-zone_example.test' });
  await services.proxy.edgeOneSyncDomains({ zoneId: 'eo-zone', domainName: 'example.test' });

  const byPath = path => calls.find(c => c.path === path);
  assert.equal(byPath('/dns/cloudflare/api/zones/cf-zone/records?page=2&size=20').options.method, undefined);
  assert.equal(byPath('/dns/cloudflare/api/records').options.body, JSON.stringify({ zoneId: 'cf-zone', type: 'A', name: 'www', content: '192.0.2.1', ttl: 300, proxied: false }));
  assert.equal(byPath('/dns/cloudflare/api/records/cf-record').options.body, JSON.stringify({ content: '192.0.2.2', ttl: 600, proxied: true, recordType: 'A', recordName: 'www', zoneId: 'cf-zone' }));
  assert.equal(byPath('/dns/cloudflare/api/records/cf-record?zoneId=cf-zone').options.method, 'DELETE');
  assert.equal(byPath('/dns/cloudflare/api/zones/cf-zone/sync').options.body, JSON.stringify({ domainName: 'example.test' }));
  assert.equal(byPath('/dns/edgeone/api/records?zoneId=eo-zone&type=dns').options.method, undefined);
  assert.equal(byPath('/dns/edgeone/api/records').options.body, JSON.stringify({ zoneId: 'eo-zone', type: 'MX', name: '@', content: 'mail.example.test', ttl: 300, priority: 10 }));
  assert.equal(byPath('/dns/edgeone/api/records/eo-record').options.body, JSON.stringify({ content: 'mx.example.test', recordType: 'MX', recordName: '@', ttl: 600, zoneId: 'eo-zone', priority: 20 }));
  assert.equal(byPath('/dns/edgeone/api/domains/eo-zone_example.test').options.method, 'DELETE');
  assert.equal(byPath('/dns/edgeone/api/zones/eo-zone/sync-domains').options.body, JSON.stringify({ domainName: 'example.test' }));
});

test('DNS management pages contain no provider fixtures or local-only mutation success', async () => {
  const source = await readFile(new URL('page-proxy.jsx', SRC), 'utf8');
  const cf = source.slice(source.indexOf('function CFManagePage()'), source.indexOf('// ─── 3. EO 管理'));
  const eo = source.slice(source.indexOf('function EOManagePage()'), source.indexOf('Object.assign(window'));
  for (const name of ['cloudflareZones', 'cloudflareRecords', 'cloudflareAddRecord', 'cloudflareUpdateRecord', 'cloudflareDeleteRecord', 'cloudflareSync']) {
    assert.match(cf, new RegExp(`ociServices\\.proxy\\.${name}\\(`), `CF page missing ${name}`);
  }
  for (const name of ['edgeOneZones', 'edgeOneRecords', 'edgeOneAddRecord', 'edgeOneUpdateRecord', 'edgeOneDeleteRecord', 'edgeOneSync', 'edgeOneDomains', 'edgeOneDeleteDomain', 'edgeOneSyncDomains']) {
    assert.match(eo, new RegExp(`ociServices\\.proxy\\.${name}\\(`), `EdgeOne page missing ${name}`);
  }
  assert.doesNotMatch(cf, /129\.146\.127\.126|my-oci-tools\.dev|Date\.now\(\)/);
  assert.doesNotMatch(eo, /129\.146\.127\.126|edgeone\.tencentcloud\.com|setDnsRecords\(prev => prev\.filter|setDomains\(prev => prev\.filter/);
});

test('VPN proxy UI uses only VpnProxyRecord fields and preserves the full record when toggling status', async () => {
  const pageSource = await readFile(new URL('page-proxy.jsx', SRC), 'utf8');
  const actionsSource = await readFile(new URL('misc-actions.jsx', SRC), 'utf8');
  const miscPageSource = await readFile(new URL('page-misc.jsx', SRC), 'utf8');
  const page = pageSource.slice(pageSource.indexOf('function ProxyPage'), pageSource.indexOf('// ─── 1. 秘钥配置'));
  const edit = actionsSource.slice(actionsSource.indexOf('function useProxyEditModal'), actionsSource.indexOf('function useProxyTestAllModal'));
  const routedPage = miscPageSource.slice(miscPageSource.indexOf('function SysVpnProxyPage'), miscPageSource.indexOf('Object.assign(window'));
  assert.doesNotMatch(page, /p\.region|key: 'region'/);
  for (const field of ['proxyType', 'proxyHost', 'proxyPort', 'proxyUsername', 'proxyPassword', 'customName']) {
    assert.match(page, new RegExp(`${field}: proxy\\.${field}`), `status toggle must preserve ${field}`);
    assert.match(routedPage, new RegExp(`${field}: p\\.${field}`), `routed proxy page toggle must preserve ${field}`);
  }
  assert.match(page, /availableStatus: Number\(proxy\.availableStatus\) === 1 \? 0 : 1/);
  assert.match(page, /tenantIds: proxy\.tenantIds \|\| \(proxy\.tenantId == null \? \[\] : \[proxy\.tenantId\]\)/);
  assert.match(routedPage, /availableStatus: p\.availableStatus/);
  assert.match(routedPage, /forceProxy: next/);
  assert.match(routedPage, /tenantIds: tIds/);
  assert.doesNotMatch(edit, /出口地区|state\.region/);
  assert.match(edit, /t\.isActive !== false/);
  assert.doesNotMatch(edit, /\.slice\(0, 8\)/);
  assert.doesNotMatch(actionsSource, /TCP 握手成功 · TLS 完成 · HTTP GET 200/);
  assert.match(edit, /result && result\.success === false/);
  assert.match(actionsSource.slice(actionsSource.indexOf('function useProxyTestAllModal'), actionsSource.indexOf('// ─── Log actions')), /(?:summary|result) && (?:summary|result)\.success === false/);
  for (const name of ['pageList', 'saveOrUpdate', 'testConnection', 'testAll', 'remove']) {
    assert.match(routedPage, new RegExp(`ociServices\\.proxy\\.${name}\\(`), `routed proxy page missing ${name} service`);
  }
  assert.match(routedPage, /ociServices\.tenant\.listParentTenants\(\)/);
  assert.doesNotMatch(routedPage, /ociApi\.request\('\/vpnProxy\//);
  assert.match(routedPage, /(?:result|res) && (?:result|res)\.success === false/);
});

test('domain provider page exposes backend load failures instead of silently swallowing them', async () => {
  const pageSource = await readFile(new URL('page-proxy.jsx', SRC), 'utf8');
  const page = pageSource.slice(pageSource.indexOf('function ProxyKeyConfigPage'), pageSource.indexOf('// ─── 2. CF 管理'));
  assert.match(page, /configError/);
  assert.match(page, /setConfigError\(e\.message \|\| '域名服务商配置加载失败'\)/);
  assert.doesNotMatch(page, /domainProviderConfigs\(\)[\s\S]*?\.catch\(\(\) => \{\}\)/);
});

test('notification and memo service constructors preserve controller fields', async () => {
  const { services, calls } = await loadServices();
  await services.notify.configs();
  await services.notify.updateTelegram({ botToken: 'token', chatId: 'chat', chatName: null, enabled: true });
  await services.notify.updateDingTalk({ enabled: false, webhook: 'https://dingtalk', secret: 'secret' });
  await services.notify.updateBark({ enabled: true, url: 'https://bark', deviceKey: 'key' });
  await services.notify.updateFeishu({ enabled: true, webhook: 'https://feishu', secret: 'sig' });
  await services.notify.updateProxy({ enabled: true, type: 'SOCKS5', host: '127.0.0.1', port: 1080, username: 'u', password: 'p' });
  await services.notify.updateTask({ enabled: true, executeHour: 8, notificationSecret: 'n', enableAccountCheck: true, enableBootLog: false, enableCostCheck: true });
  await services.notify.testTelegram();
  await services.notify.testDingTalk();
  await services.notify.testBark();
  await services.notify.testFeishu();
  await services.notify.testProxy({ enabled: true, type: 'SOCKS5', host: '127.0.0.1', port: 1080, username: 'u', password: 'p' });
  await services.memo.list();
  await services.memo.create({ title: '标题', summary: '摘要', content: '正文', ignored: 'x' });
  await services.memo.update({ id: 9, title: '新标题', summary: '', content: '新正文' });
  await services.memo.remove({ id: 9 });

  const telegram = calls.find(c => c.path === '/api/system/updateTelegramConfig');
  assert.equal(telegram.options.body, JSON.stringify({ botToken: 'token', chatId: 'chat', chatName: null, enabled: true }));
  const task = calls.find(c => c.path === '/api/system/updateTaskConfig');
  assert.equal(task.options.body, JSON.stringify({ enabled: true, executeHour: 8, notificationSecret: 'n', enableAccountCheck: true, enableBootLog: false, enableCostCheck: true }));
  const proxyTest = calls.find(c => c.path === '/api/system/testProxyConnection');
  assert.equal(proxyTest.options.body, JSON.stringify({ enabled: true, type: 'SOCKS5', host: '127.0.0.1', port: 1080, username: 'u', password: 'p' }));
  const memoCreate = calls.find(c => c.path === '/api/memos' && c.options.method === 'POST');
  assert.equal(memoCreate.options.body, JSON.stringify({ title: '标题', summary: '摘要', content: '正文' }));
  const memoUpdate = calls.find(c => c.path === '/api/memos/9');
  assert.equal(memoUpdate.options.method, 'PUT');
  assert.equal(memoUpdate.options.body, JSON.stringify({ title: '新标题', summary: '', content: '新正文' }));
});

test('validators reject missing required fields inside service constructors', async () => {
  const { services } = await loadServices();
  assert.throws(() => services.tenant.updateCustomName({ defName: 'x' }));
  assert.throws(() => services.auth.sendVerificationCode({}));
  assert.throws(() => services.boot.startBoot({}));
  assert.throws(() => services.instance.stop({}));
});

test('boot detail constructors preserve controller query parameters and status fields', async () => {
  const { services, calls } = await loadServices();
  await services.boot.bootDetail({ bootId: '42' });
  await services.boot.bootDetailList({ tenantId: '101', architecture: 'aarch64' });
  await services.boot.toggleStatus({ id: '43', status: 1 });
  await services.boot.deleteBootDetail({ bootId: '44' });
  const detail = calls.find(c => c.type === 'request' && c.path === '/boot/bootDetail?bootId=42');
  const list = calls.find(c => c.type === 'request' && c.path === '/boot/bootDetailList');
  const toggle = calls.find(c => c.type === 'request' && c.path === '/boot/toggleStatus?id=43&status=1');
  const remove = calls.find(c => c.type === 'request' && c.path === '/boot/deleteBootDetail?bootId=44');
  assert.ok(detail);
  assert.ok(list);
  assert.ok(toggle);
  assert.ok(remove);
  assert.equal(list.options.method, 'POST');
  assert.equal(list.options.headers['Content-Type'], 'application/json');
  assert.equal(list.options.body, JSON.stringify({ tenantId: '101', architecture: 'aarch64' }));
  assert.equal(toggle.options.method, 'POST');
  assert.equal(remove.options.method, 'POST');
  assert.equal(remove.options.headers['Content-Type'], 'application/json');
});

test('list constructors use the page envelope path and query', async () => {
  const { services, calls } = await loadServices();
  await services.tenant.list({ page: '1', size: '10', keyword: 'a' });
  const call = calls.find(c => c.type === 'getPage' && c.path === '/tenants/list/json');
  assert.ok(call);
  assert.equal(call.options.query.size, '10');
  assert.equal(call.options.query.page, '1');
  assert.equal(call.options.query.keyword, 'a');
  assert.equal(call.options.query.cloudType, undefined);
  assert.equal(call.options.query.emailEnable, undefined);
});

test('tenant bootSave preserves the BootInstance form fields', async () => {
  const { services, calls } = await loadServices();
  await services.tenant.bootSave({
    tenantId: '42', architecture: 'ARM', ocpu: 4, memory: 24, disk: 200,
    instanceCount: 2, loopTime: 60, operatingSystem: 'Ubuntu',
    operatingSystemVersion: '22.04', imageId: '', rootPassword: 'secret123',
    remark: '主任务', cloudType: 1,
  });
  const call = calls.find(c => c.type === 'request' && c.path === '/tenants/boot/save');
  assert.ok(call);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(call.options.body.get('tenantId'), '42');
  assert.equal(call.options.body.get('architecture'), 'ARM');
  assert.equal(call.options.body.get('instanceCount'), '2');
  assert.equal(call.options.body.get('rootPassword'), 'secret123');
  assert.equal(call.options.body.get('cloudType'), '1');
});

test('instance mutation constructors preserve original Controller JSON fields', async () => {
  const { services, calls } = await loadServices();
  await services.instance.updateRemark({ instanceId: '101', remark: '备注' });
  await services.instance.updateName({ instanceId: '101', newName: '新名称' });
  await services.instance.updateConfig({ instanceId: '101', cpu: 2, memory: 8 });
  await services.instance.updateBootVolume({ instanceId: '101', bootVolumeSize: 80, expand: true });
  const byPath = path => calls.find(c => c.type === 'request' && c.path === path);
  assert.equal(byPath('/oci/updateRemark').options.body, JSON.stringify({ instanceId: '101', remark: '备注' }));
  assert.equal(byPath('/oci/updateName').options.body, JSON.stringify({ instanceId: '101', newName: '新名称' }));
  assert.equal(byPath('/oci/updateConfig').options.body, JSON.stringify({ instanceId: '101', cpu: 2, memory: 8 }));
  assert.equal(byPath('/oci/updateBootVolume').options.body, JSON.stringify({ instanceId: '101', bootVolumeSize: 80, expand: true }));
});

test('instance export constructor requests the plaintext file as a blob', async () => {
  const { services, calls } = await loadServices();
  await services.instance.export();
  const call = calls.find(c => c.type === 'request' && c.path === '/oci/export');
  assert.ok(call);
  assert.equal(call.options.method, undefined);
  assert.equal(call.options.responseType, 'blob');
});

test('instance VPU constructor uses the real tenant boot-volume endpoint and DTO fields', async () => {
  const { services, calls } = await loadServices();
  await services.instance.updateVpu({
    bootVolumeId: 'boot.ocid.1',
    tenantId: '101',
    vpusPerGB: 60,
    displayName: '实例名称',
    instanceDetailId: 202,
  });
  const call = calls.find(c => c.type === 'request' && c.path === '/tenants/update-volumes/boot.ocid.1');
  assert.ok(call);
  assert.equal(call.options.method, 'PUT');
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.equal(call.options.body, JSON.stringify({
    vpusPerGB: 60,
    tenantId: '101',
    displayName: '实例名称',
    instanceDetailId: 202,
  }));
});

test('instance network constructors use database ids and original field names', async () => {
  const { services, calls } = await loadServices();
  // IpSwitchRequest.instanceId is Java Long and the original page sends the
  // database record id as tenantId; an OCI OCID must never be put in that
  // numeric field because Jackson rejects it before the Controller executes.
  await services.instance.changeSpecIp({ instanceId: 'ocid1.instance.oc1..real', tenantId: '101', cidrRanges: ['10.0.0.0/24'] });
  await services.instance.enableIpv6({ tenantId: '101' });
  await services.instance.sendVerificationCode({ instanceId: '101' });
  const byPath = path => calls.find(c => c.type === 'request' && c.path === path);
  assert.equal(byPath('/oci/changeSpecIp').options.body, JSON.stringify({ tenantId: '101', cidrRanges: ['10.0.0.0/24'] }));
  assert.equal(byPath('/oci/enableIpv6').options.body, JSON.stringify({ tenantId: '101' }));
  assert.equal(byPath('/oci/sendVerificationCode').options.body, JSON.stringify({ instanceId: '101' }));
});

test('vnic constructors preserve original VnicManagementController fields', async () => {
  const { services, calls } = await loadServices();
  await services.instance.vnicLoadData({ instanceId: 'ocid.instance.1' });
  await services.instance.vnicCreate({ instanceId: 'ocid.instance.1', subnetId: 'subnet.1', vnicCount: 1, ipv6CountPerVnic: 0 });
  await services.instance.vnicCreateIpv6({ instanceId: 'ocid.instance.1', vnicId: 'vnic.1', ipv6Count: 2 });
  const load = calls.find(c => c.path.startsWith('/oci/vnic/loadData?'));
  const create = calls.find(c => c.path === '/oci/vnic/create');
  const ipv6 = calls.find(c => c.path === '/oci/vnic/createIpv6');
  assert.ok(load);
  assert.equal(create.options.body, JSON.stringify({ instanceId: 'ocid.instance.1', subnetId: 'subnet.1', vnicCount: 1, ipv6CountPerVnic: 0 }));
  assert.equal(ipv6.options.body, JSON.stringify({ instanceId: 'ocid.instance.1', vnicId: 'vnic.1', ipv6Count: 2 }));
});

test('vnic IP switch sends the original request fields without inferred tenant data', async () => {
  const { services, calls } = await loadServices();
  await services.instance.vnicChangeSpecIp({ instanceId: 'ocid.instance.1', vnicId: 'vnic.1', cidrRanges: [] });
  const call = calls.find(c => c.type === 'request' && c.path === '/oci/vnic/changeSpecIp');
  assert.ok(call);
  assert.equal(call.options.body, JSON.stringify({
    instanceId: 'ocid.instance.1', vnicId: 'vnic.1', cidrRanges: [], preferredIp: null,
  }));
});

test('SSH SFTP constructors preserve original multipart and JSON fields', async () => {
  const { services, calls } = await loadServices();
  const file = new Blob(['hello'], { type: 'text/plain' });
  await services.instance.sftpUpload({ host: '198.51.100.10', port: 22, username: 'root', password: 'pw', remotePath: '/tmp/', file });
  await services.instance.sftpDownload({ host: '198.51.100.10', port: 22, username: 'root', password: 'pw', remotePath: '/tmp/a.txt' });
  const upload = calls.find(c => c.path === '/oci/sftp/upload');
  const download = calls.find(c => c.path === '/oci/sftp/download');
  assert.ok(upload);
  assert.equal(upload.options.method, 'POST');
  assert.equal(upload.options.body.get('host'), '198.51.100.10');
  assert.equal(upload.options.body.get('port'), '22');
  assert.equal(upload.options.body.get('remotePath'), '/tmp/');
  assert.ok(download);
  assert.equal(download.options.responseType, 'blob');
  assert.equal(download.options.body, JSON.stringify({ host: '198.51.100.10', port: 22, username: 'root', password: 'pw', remotePath: '/tmp/a.txt' }));
});

test('SSH configuration constructors use the database instance id and backend field names', async () => {
  const { services, calls } = await loadServices();
  await services.instance.getSshConfig({ instanceId: '101' });
  await services.instance.saveSshConfig({ instanceId: '101', username: 'ubuntu', port: 22, password: 'pw' });
  const getCall = calls.find(c => c.type === 'request' && c.path === '/oci/ssh/config/101');
  const saveCall = calls.find(c => c.type === 'request' && c.path === '/oci/ssh/config');
  assert.ok(getCall);
  assert.equal(saveCall.options.method, 'POST');
  assert.equal(saveCall.options.headers['Content-Type'], 'application/json');
  assert.equal(saveCall.options.body, JSON.stringify({
    instanceId: '101', username: 'ubuntu', port: '22', password: 'pw',
  }));
});

test('instance credential constructors reject missing required backend fields', async () => {
  const { services } = await loadServices();
  assert.throws(
    () => services.instance.saveSshConfig({ instanceId: '101', username: 'ubuntu', port: 22, password: '' }),
    /缺少password/,
  );
  assert.throws(
    () => services.instance.quickDD2({ instanceId: '101', osType: 'ubuntu', osVersion: '22.04', ddPassword: '' }),
    /缺少ddPassword/,
  );
  assert.throws(
    () => services.instance.sftpUpload({ port: 22, username: 'ubuntu', password: 'pw', remotePath: '/tmp/a' }),
    /缺少host/,
  );
  assert.throws(
    () => services.instance.sftpDownload({ host: '198.51.100.10', port: 22, username: 'ubuntu', password: '', remotePath: '/tmp/a' }),
    /缺少password/,
  );
});
