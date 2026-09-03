// Tenant request constructors.
(function installOciTenantServices(global) {
  'use strict';
  const api = global.ociApi;
  const contracts = global.ociContracts;
  const S = {};

  function mark(fn, method, path, encoding) { fn.endpoint = { method: method, path: path, encoding: encoding }; return fn; }
  function queryPath(path, params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? path + '?' + s : path;
  }
  function jsonBody(obj) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
  }

  S.list = mark(function list(input) {
    const o = input || {};
    return api.getPage('/tenants/list/json', { size: o.size, page: o.page, keyword: o.keyword, cloudType: o.cloudType, emailEnable: o.emailEnable });
  }, 'GET', '/tenants/list/json', 'query-string');

  S.listParentTenants = mark(function listParentTenants() {
    return api.request('/tenants/listParentTenants');
  }, 'GET', '/tenants/listParentTenants', 'query-string');

  // 原项目实例页级联筛选：parentId 为父租户数据库 id，返回其区域子租户。
  S.listRegions = mark(function listRegions(input) {
    const o = input || {};
    return api.request(queryPath('/tenants/listRegions', {
      parentId: contracts.id(o.parentId, 'parentId'),
    }));
  }, 'GET', '/tenants/listRegions', 'query-string');

  S.regionList = mark(function regionList(input) {
    const o = input || {};
    return api.request(queryPath('/tenants/regionList/json', { tenantId: contracts.id(o.tenantId, 'tenantId') }));
  }, 'GET', '/tenants/regionList/json', 'query-string');

  S.syncOci = mark(function syncOci(input) {
    const o = input || {};
    return api.request(queryPath('/tenants/syncOci', { tenantId: contracts.id(o.tenantId, 'tenantId') }));
  }, 'GET', '/tenants/syncOci', 'query-string');

  S.updateCustomName = mark(function updateCustomName(input) {
    const o = input || {};
    return api.request('/tenants/updateCustomName', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: contracts.id(o.tenantId, 'tenantId'), defName: o.defName, accountCost: o.accountCost }),
    });
  }, 'POST', '/tenants/updateCustomName', 'application/json');

  S.checkCustomName = mark(function checkCustomName(input) {
    const o = input || {};
    const params = new URLSearchParams();
    if (o.name !== undefined && o.name !== null && o.name !== '') params.set('name', String(o.name));
    if (o.cloudType !== undefined && o.cloudType !== null && o.cloudType !== '') params.set('cloudType', String(o.cloudType));
    if (o.excludeTenantId !== undefined && o.excludeTenantId !== null && o.excludeTenantId !== '') params.set('excludeTenantId', String(o.excludeTenantId));
    if (o.excludeTenancy !== undefined && o.excludeTenancy !== null && o.excludeTenancy !== '') params.set('excludeTenancy', String(o.excludeTenancy));
    return api.request(`/tenants/checkCustomName?${params.toString()}`);
  }, 'GET', '/tenants/checkCustomName', 'query-string');

  S.updateAccountCost = mark(function updateAccountCost(input) {
    const o = input || {};
    return api.request('/tenants/updateAccountCost', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: contracts.id(o.tenantId, 'tenantId'), accountCost: o.accountCost }),
    });
  }, 'POST', '/tenants/updateAccountCost', 'application/json');

  S.checkAccounts = mark(function checkAccounts() {
    return api.request('/tenants/checkAccounts');
  }, 'GET', '/tenants/checkAccounts', 'query-string');

  S.sendExportCode = mark(function sendExportCode() {
    return api.request('/tenants/verify/sendExportCode', { method: 'POST', body: formBody({}) });
  }, 'POST', '/tenants/verify/sendExportCode', 'query-string');
  function formBody(params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) { const v = params[k]; if (v !== undefined && v !== null && v !== '') usp.set(k, String(v)); }
    return usp;
  }

  S.export = mark(function exportTenants(input) {
    const o = input || {};
    const headers = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (o.exportCode) headers['X-Verify-Code'] = o.exportCode;
    return api.request('/tenants/export', { method: 'GET', headers: headers });
  }, 'GET', '/tenants/export', 'query-string');

  S.deleteApi = mark(function deleteApi(input) {
    const o = input || {};
    return api.request(queryPath('/tenants/deleteApi', { tenantId: contracts.id(o.tenantId, 'tenantId') }));
  }, 'GET', '/tenants/deleteApi', 'query-string');

  S.bootSave = mark(function bootSave(input) {
    const o = input || {};
    return api.request('/tenants/boot/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        tenantId: contracts.id(o.tenantId, 'tenantId'),
        architecture: o.architecture,
        ocpu: o.ocpu,
        memory: o.memory,
        disk: o.disk,
        instanceCount: o.instanceCount,
        loopTime: o.loopTime,
        operatingSystem: o.operatingSystem,
        operatingSystemVersion: o.operatingSystemVersion,
        imageId: o.imageId,
        rootPassword: o.rootPassword,
        remark: o.remark,
        cloudType: o.cloudType,
      }),
    });
  }, 'POST', '/tenants/boot/save', 'query-string');

  S.importTenants = mark(function importTenants(input) {
    const o = input || {};
    return api.request('/tenants/import', jsonBody(o.body || o));
  }, 'POST', '/tenants/import', 'application/json');

  S.oracleUsers = mark(function oracleUsers(input) {
    const o = input || {};
    return api.request('/tenants/oracle-users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: contracts.id(o.tenantId, 'tenantId'), username: o.username, email: o.email, groupId: o.groupId }),
    });
  }, 'POST', '/tenants/oracle-users', 'application/json');

  S.subscribeRegions = mark(function subscribeRegions(input) {
    const o = input || {};
    return api.request('/tenants/subscribe-regions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: contracts.id(o.tenantId, 'tenantId'), regionKeys: o.regionKeys }),
    });
  }, 'POST', '/tenants/subscribe-regions', 'application/json');

  global.ociServices = global.ociServices || {};
  global.ociServices.tenant = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
