// Object storage request constructors. The backend intentionally has no object-list endpoint.
(function installOciStorageServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function json(input, keys) { const o = input || {}, out = {}; (keys || Object.keys(o)).forEach(k => { if (o[k] !== undefined) out[k] = o[k]; }); return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }; }
  function queryString(input) { const q = new URLSearchParams(); Object.entries(input || {}).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }); return q.toString(); }
  S.buckets = mark(i => api.request('/oci/storage/buckets?' + queryString(i)), 'GET', '/oci/storage/buckets', 'query-string');
  S.createBucket = mark(i => api.request('/oci/storage/bucket/create', json(i, ['tenantId','bucketName','publicAccessType'])), 'POST', '/oci/storage/bucket/create', 'application/json');
  S.presigned = mark(i => api.request('/oci/storage/object/presigned', json(i, ['tenantId','namespace','bucketName','objectName','validitySeconds'])), 'POST', '/oci/storage/object/presigned', 'application/json');
  S.deleteBucket = mark(i => api.request('/oci/storage/bucket/delete', json(i, ['tenantId','namespace','bucketName'])), 'POST', '/oci/storage/bucket/delete', 'application/json');
  S.upload = mark(i => { const fd = new FormData(); ['tenantId','namespace','bucketName','objectName','file'].forEach(k => { if (i?.[k] !== undefined) fd.append(k, i[k]); }); return api.request('/oci/storage/object/upload', { method: 'POST', body: fd }); }, 'POST', '/oci/storage/object/upload', 'multipart/form-data');
  S.download = mark(i => api.request('/oci/storage/object/download?' + queryString(i)), 'GET', '/oci/storage/object/download', 'query-string');
  S.preview = mark(i => api.request('/oci/storage/object/preview?' + queryString(i)), 'GET', '/oci/storage/object/preview', 'query-string');
  S.deleteObject = mark(i => api.request('/oci/storage/object/delete', json(i, ['tenantId','namespace','bucketName','objectName'])), 'POST', '/oci/storage/object/delete', 'application/json');
  global.ociServices = global.ociServices || {};
  global.ociServices.storage = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
