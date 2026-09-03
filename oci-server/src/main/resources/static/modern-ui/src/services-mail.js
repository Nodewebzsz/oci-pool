// Email management request constructors. Field names mirror EmailController DTOs.
(function installOciMailServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function json(input, keys) {
    const o = input || {}, out = {};
    (keys || Object.keys(o)).forEach(k => { if (o[k] !== undefined) out[k] = o[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
  S.tenantList = mark(i => api.request('/email/tenant/list', json(i, ['id','tenantId','pageNum','pageSize','sort','order'])), 'POST', '/email/tenant/list', 'application/json');
  S.tenantGet = mark(i => api.request('/email/tenant/get', json(i, ['tenantId'])), 'POST', '/email/tenant/get', 'application/json');
  S.receiveList = mark(i => api.request('/email/receive/list', json(i, ['email','name','pageNum','pageSize','sort','order'])), 'POST', '/email/receive/list', 'application/json');
  S.receiveAdd = mark(i => api.request('/email/receive/add', json(i, ['name','email'])), 'POST', '/email/receive/add', 'application/json');
  S.receiveDelete = mark(i => api.request('/email/receive/delete?id=' + encodeURIComponent(String(i.id)), { method: 'POST' }), 'POST', '/email/receive/delete', 'query-string');
  S.bodyList = mark(i => api.request('/email/body/list', json(i, ['id','pageNum','pageSize','sort','order'])), 'POST', '/email/body/list', 'application/json');
  S.bodyBatchDelete = mark(() => api.request('/email/body/batchDelete', { method: 'POST' }), 'POST', '/email/body/batchDelete', 'query-string');
  S.bodyDelete = mark(i => api.request('/email/body/delete', json(i, ['id'])), 'POST', '/email/body/delete', 'application/json');
  S.send = mark(i => api.request('/email/send', json(i, ['title','content','tenantEmailConfigId','emailReceiveIds'])), 'POST', '/email/send', 'application/json');
  S.disable = mark(i => api.request('/email/disable', json(i, ['tenantId'])), 'POST', '/email/disable', 'application/json');
  global.ociServices = global.ociServices || {};
  global.ociServices.mail = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
