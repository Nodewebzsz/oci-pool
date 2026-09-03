// MemoController request constructors.
(function installOciMemoServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function jsonBody(input) {
    const o = input || {}, out = {};
    ['title', 'summary', 'content'].forEach(k => { if (o[k] !== undefined) out[k] = o[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
  S.list = mark(function list() { return api.request('/api/memos'); }, 'GET', '/api/memos', 'query-string');
  S.create = mark(function create(input) { return api.request('/api/memos', jsonBody(input)); }, 'POST', '/api/memos', 'application/json');
  S.update = mark(function update(input) {
    const o = input || {};
    if (o.id === undefined || o.id === null || String(o.id).trim() === '') throw new Error('缺少id');
    return api.request('/api/memos/' + encodeURIComponent(String(o.id)), { ...jsonBody(o), method: 'PUT' });
  }, 'PUT', '/api/memos/{param}', 'application/json');
  S.remove = mark(function remove(input) {
    const o = input || {};
    if (o.id === undefined || o.id === null || String(o.id).trim() === '') throw new Error('缺少id');
    return api.request('/api/memos/' + encodeURIComponent(String(o.id)), { method: 'DELETE' });
  }, 'DELETE', '/api/memos/{param}', 'query-string');
  global.ociServices = global.ociServices || {};
  global.ociServices.memo = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
