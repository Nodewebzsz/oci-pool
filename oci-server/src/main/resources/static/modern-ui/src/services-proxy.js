// VPN proxy request constructors. Keep the DTO field names identical to
// VpnProxyRecordRequest; UI-only aliases are translated at the page boundary.
(function installOciProxyServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function id(value, label) { return encodeURIComponent(global.ociContracts.id(value, label)); }
  function json(method, value) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
  }
  function body(input) {
    const o = input || {};
    const out = {};
    ['id','proxyType','proxyHost','proxyPort','proxyUsername','proxyPassword','availableStatus','forceProxy','tenantId','tenantIds','customName','pageNum','pageSize','sort','order']
      .forEach(k => { if (o[k] !== undefined) out[k] = o[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
  S.pageList = mark(function pageList(input) { return api.request('/vpnProxy/pageList', body(input)); }, 'POST', '/vpnProxy/pageList', 'application/json');
  S.saveOrUpdate = mark(function saveOrUpdate(input) { return api.request('/vpnProxy/saveOrUpdate', body(input)); }, 'POST', '/vpnProxy/saveOrUpdate', 'application/json');
  S.testConnection = mark(function testConnection(input) { return api.request('/vpnProxy/testConnection', body(input)); }, 'POST', '/vpnProxy/testConnection', 'application/json');
  S.testAll = mark(function testAll() { return api.request('/vpnProxy/testAll', { method: 'POST' }); }, 'POST', '/vpnProxy/testAll', 'query-string');
  S.remove = mark(function remove(input) { return api.request('/vpnProxy/delete', body(input)); }, 'POST', '/vpnProxy/delete', 'application/json');

  S.cloudflareZones = mark(function cloudflareZones() {
    return api.request('/dns/cloudflare/api/zones');
  }, 'GET', '/dns/cloudflare/api/zones', 'query-string');
  S.cloudflareRecords = mark(function cloudflareRecords(input) {
    const o = input || {};
    return api.request('/dns/cloudflare/api/zones/' + id(o.zoneId, 'zoneId') + '/records?' + new URLSearchParams({ page: String(o.page || 1), size: String(o.size || 20) }));
  }, 'GET', '/dns/cloudflare/api/zones/{param}/records', 'query-string');
  S.cloudflareAddRecord = mark(function cloudflareAddRecord(input) {
    const o = input || {};
    return api.request('/dns/cloudflare/api/records', json('POST', {
      zoneId: o.zoneId, type: o.type, name: o.name, content: o.content, ttl: o.ttl, proxied: !!o.proxied,
    }));
  }, 'POST', '/dns/cloudflare/api/records', 'application/json');
  S.cloudflareUpdateRecord = mark(function cloudflareUpdateRecord(input) {
    const o = input || {};
    return api.request('/dns/cloudflare/api/records/' + id(o.recordId, 'recordId'), json('PUT', {
      content: o.content, ttl: o.ttl, proxied: !!o.proxied,
      recordType: o.recordType, recordName: o.recordName, zoneId: o.zoneId,
    }));
  }, 'PUT', '/dns/cloudflare/api/records/{param}', 'application/json');
  S.cloudflareDeleteRecord = mark(function cloudflareDeleteRecord(input) {
    const o = input || {};
    return api.request('/dns/cloudflare/api/records/' + id(o.recordId, 'recordId') + '?zoneId=' + id(o.zoneId, 'zoneId'), { method: 'DELETE' });
  }, 'DELETE', '/dns/cloudflare/api/records/{param}', 'query-string');
  S.cloudflareSync = mark(function cloudflareSync(input) {
    const o = input || {};
    return api.request('/dns/cloudflare/api/zones/' + id(o.zoneId, 'zoneId') + '/sync', json('POST', { domainName: o.domainName }));
  }, 'POST', '/dns/cloudflare/api/zones/{param}/sync', 'application/json');

  S.edgeOneZones = mark(function edgeOneZones() {
    return api.request('/dns/edgeone/api/zones');
  }, 'GET', '/dns/edgeone/api/zones', 'query-string');
  S.edgeOneRecords = mark(function edgeOneRecords(input) {
    const o = input || {};
    return api.request('/dns/edgeone/api/records?' + new URLSearchParams({ zoneId: global.ociContracts.id(o.zoneId, 'zoneId'), type: o.type || 'dns' }));
  }, 'GET', '/dns/edgeone/api/records', 'query-string');
  S.edgeOneAddRecord = mark(function edgeOneAddRecord(input) {
    const o = input || {};
    return api.request('/dns/edgeone/api/records', json('POST', {
      zoneId: o.zoneId, type: o.type, name: o.name, content: o.content, ttl: o.ttl, priority: o.priority,
    }));
  }, 'POST', '/dns/edgeone/api/records', 'application/json');
  S.edgeOneUpdateRecord = mark(function edgeOneUpdateRecord(input) {
    const o = input || {};
    return api.request('/dns/edgeone/api/records/' + id(o.recordId, 'recordId'), json('PUT', {
      content: o.content, recordType: o.recordType, recordName: o.recordName,
      ttl: o.ttl, zoneId: o.zoneId, priority: o.priority,
    }));
  }, 'PUT', '/dns/edgeone/api/records/{param}', 'application/json');
  S.edgeOneDeleteRecord = mark(function edgeOneDeleteRecord(input) {
    return api.request('/dns/edgeone/api/records/' + id((input || {}).recordId, 'recordId'), { method: 'DELETE' });
  }, 'DELETE', '/dns/edgeone/api/records/{param}', 'query-string');
  S.edgeOneSync = mark(function edgeOneSync(input) {
    const o = input || {};
    return api.request('/dns/edgeone/api/zones/' + id(o.zoneId, 'zoneId') + '/sync', json('POST', { domainName: o.domainName }));
  }, 'POST', '/dns/edgeone/api/zones/{param}/sync', 'application/json');
  S.edgeOneDomains = mark(function edgeOneDomains(input) {
    return api.request('/dns/edgeone/api/domains?zoneId=' + id((input || {}).zoneId, 'zoneId'));
  }, 'GET', '/dns/edgeone/api/domains', 'query-string');
  S.edgeOneDeleteDomain = mark(function edgeOneDeleteDomain(input) {
    return api.request('/dns/edgeone/api/domains/' + id((input || {}).domainId, 'domainId'), { method: 'DELETE' });
  }, 'DELETE', '/dns/edgeone/api/domains/{param}', 'query-string');
  S.edgeOneSyncDomains = mark(function edgeOneSyncDomains(input) {
    const o = input || {};
    return api.request('/dns/edgeone/api/zones/' + id(o.zoneId, 'zoneId') + '/sync-domains', json('POST', { domainName: o.domainName }));
  }, 'POST', '/dns/edgeone/api/zones/{param}/sync-domains', 'application/json');
  global.ociServices = global.ociServices || {};
  global.ociServices.proxy = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
