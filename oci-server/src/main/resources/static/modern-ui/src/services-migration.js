// Data migration request constructors. The controller streams files and accepts
// multipart uploads; callers decide when it is safe to trigger the download.
(function installOciMigrationServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }

  S.exportDatabase = mark(function exportDatabase() {
    return api.request('/migration/export', { responseType: 'blob' });
  }, 'GET', '/migration/export', 'query-string');

  S.exportEncrypted = mark(function exportEncrypted() {
    // The endpoint writes headers and bytes directly; keep the raw Response so
    // the UI can preserve Content-Disposition and stream it as a Blob.
    return api.request('/migration/exportEncrypted', { responseType: 'raw' });
  }, 'GET', '/migration/exportEncrypted', 'query-string');

  S.importEncrypted = mark(function importEncrypted(input) {
    const o = input || {};
    if (!o.file) throw new Error('缺少备份文件');
    const body = new FormData();
    body.append('file', o.file);
    if (o.masterKey !== undefined && o.masterKey !== null && String(o.masterKey) !== '') {
      body.append('masterKey', String(o.masterKey));
    }
    return api.request('/migration/importEncrypted', { method: 'POST', body });
  }, 'POST', '/migration/importEncrypted', 'multipart/form-data');

  S.importPlain = mark(function importPlain(input) {
    const o = input || {};
    if (!o.file) throw new Error('缺少 SQL 文件');
    const body = new FormData();
    body.append('file', o.file);
    return api.request('/migration/import', { method: 'POST', body });
  }, 'POST', '/migration/import', 'multipart/form-data');

  global.ociServices = global.ociServices || {};
  global.ociServices.migration = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
