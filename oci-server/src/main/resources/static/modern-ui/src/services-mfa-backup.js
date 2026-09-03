// MFA vault request constructors, matching OTPController exactly.
(function installOciMfaBackupServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function id(value, label) {
    if (value === undefined || value === null || String(value).trim() === '') throw new Error('缺少' + label);
    return String(value);
  }

  S.listKeys = mark(function listKeys() {
    return api.request('/api/mfa/keys');
  }, 'GET', '/api/mfa/keys', 'query-string');

  S.saveSecret = mark(function saveSecret(input) {
    const o = input || {};
    const body = new FormData();
    if (o.keyName !== undefined && o.keyName !== null && String(o.keyName) !== '') body.append('keyName', String(o.keyName));
    if (o.secretKey !== undefined && o.secretKey !== null && String(o.secretKey) !== '') body.append('secretKey', String(o.secretKey));
    if (o.qrCode) body.append('qrCode', o.qrCode);
    if (o.qrUrl) body.append('qrUrl', String(o.qrUrl));
    if (!body.get('secretKey') && !body.get('qrCode') && !body.get('qrUrl')) throw new Error('缺少密钥或二维码');
    return api.request('/save-secret', { method: 'POST', body });
  }, 'POST', '/save-secret', 'multipart/form-data');

  S.generateOtp = mark(function generateOtp(input) {
    const secretKey = id((input || {}).secretKey, 'secretKey');
    return api.request('/generate-otp?secretKey=' + encodeURIComponent(secretKey));
  }, 'GET', '/generate-otp', 'query-string');

  S.generateOtpBatch = mark(function generateOtpBatch(input) {
    const keys = (input || {}).secretKeys;
    if (!Array.isArray(keys)) throw new Error('secretKeys 必须是数组');
    return api.request('/generate-otp-batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secretKeys: keys }),
    });
  }, 'POST', '/generate-otp-batch', 'application/json');

  S.deleteKey = mark(function deleteKey(input) {
    const keyName = id((input || {}).keyName, 'keyName');
    return api.request('/delete-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyName }),
    });
  }, 'POST', '/delete-key', 'application/json');

  S.exportData = mark(function exportData() {
    return api.request('/export-data', { responseType: 'blob' });
  }, 'GET', '/export-data', 'query-string');

  global.ociServices = global.ociServices || {};
  global.ociServices.mfaBackup = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
