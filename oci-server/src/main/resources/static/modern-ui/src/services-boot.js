// Boot / grab request constructors.
(function installOciBootServices(global) {
  'use strict';
  const api = global.ociApi;
  const contracts = global.ociContracts;
  const S = {};

  function mark(fn, method, path, encoding) { fn.endpoint = { method: method, path: path, encoding: encoding }; return fn; }
  function formBody(params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) { const v = params[k]; if (v !== undefined && v !== null && v !== '') usp.set(k, String(v)); }
    return usp;
  }
  function queryPath(path, params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) { const v = params[k]; if (v !== undefined && v !== null && v !== '') usp.set(k, String(v)); }
    const s = usp.toString();
    return s ? path + '?' + s : path;
  }

  S.fullBootList = mark(function fullBootList(input) {
    const o = input || {};
    return api.getPage('/boot/fullBootList/json', { size: o.size, page: o.page, tenantId: o.tenantId });
  }, 'GET', '/boot/fullBootList/json', 'query-string');

  S.batchStop = mark(function batchStop() {
    return api.request('/boot/batchStop', { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/batchStop', 'query-string');

  S.batchStart = mark(function batchStart() {
    return api.request('/boot/batchStart', { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/batchStart', 'query-string');

  S.batchInitFailCount = mark(function batchInitFailCount() {
    return api.request('/boot/batchInitFailCount', { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/batchInitFailCount', 'query-string');

  S.startBoot = mark(function startBoot(input) {
    const o = input || {};
    return api.request('/boot/startBoot?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/startBoot', 'query-string');

  S.startCloneBoot = mark(function startCloneBoot(input) {
    const o = input || {};
    return api.request('/boot/startCloneBoot?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/startCloneBoot', 'query-string');

  S.manualBoot = mark(function manualBoot(input) {
    const o = input || {};
    return api.request('/boot/manualBoot?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/manualBoot', 'query-string');

  S.stopBoot = mark(function stopBoot(input) {
    const o = input || {};
    return api.request('/boot/stopBoot?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/stopBoot', 'query-string');

  S.deleteBoot = mark(function deleteBoot(input) {
    const o = input || {};
    return api.request('/boot/deleteBoot?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/deleteBoot', 'query-string');

  S.dashboardStats = mark(function dashboardStats() {
    return api.request('/boot/dashboard-stats');
  }, 'GET', '/boot/dashboard-stats', 'query-string');

  S.stats = mark(function stats() {
    return api.request('/boot/stats');
  }, 'GET', '/boot/stats', 'query-string');

  S.bootDetail = mark(function bootDetail(input) {
    const o = input || {};
    return api.request('/boot/bootDetail?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')));
  }, 'GET', '/boot/bootDetail', 'query-string');

  S.bootDetailList = mark(function bootDetailList(input) {
    const o = input || {};
    return api.request('/boot/bootDetailList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: contracts.id(o.tenantId, 'tenantId'),
        architecture: String(o.architecture || ''),
      }),
    });
  }, 'POST', '/boot/bootDetailList', 'application/json');

  S.toggleStatus = mark(function toggleStatus(input) {
    const o = input || {};
    return api.request('/boot/toggleStatus?id=' + encodeURIComponent(contracts.id(o.id, 'id')) + '&status=' + encodeURIComponent(String(o.status)), { method: 'POST', body: formBody({}) });
  }, 'POST', '/boot/toggleStatus', 'query-string');

  S.deleteBootDetail = mark(function deleteBootDetail(input) {
    const o = input || {};
    return api.request('/boot/deleteBootDetail?bootId=' + encodeURIComponent(contracts.id(o.bootId, 'bootId')), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }, 'POST', '/boot/deleteBootDetail', 'query-string');

  S.updateBoot = mark(function updateBoot(input) {
    const o = input || {};
    return api.request('/boot/updateBoot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: contracts.id(o.id, 'id'),
        ocpu: o.ocpu,
        memory: o.memory,
        disk: o.disk,
        loopTime: o.loopTime,
        rootPassword: o.rootPassword,
        dayGap: o.dayGap,
      }),
    });
  }, 'POST', '/boot/updateBoot', 'application/json');

  global.ociServices = global.ociServices || {};
  global.ociServices.boot = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
