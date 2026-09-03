// Platform API token request constructors.
(function installOciTokenServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function json(input) {
    const o = input || {};
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: !!o.enabled,
        tokenName: o.tokenName,
        expirationDays: o.expirationDays,
        description: o.description,
        allowSwaggerAccess: o.allowSwaggerAccess,
      }),
    };
  }
  S.configs = mark(function configs() { return api.request('/api/system/apiTokenConfigs'); }, 'GET', '/api/system/apiTokenConfigs', 'query-string');
  S.status = mark(function status() { return api.request('/api/system/apiTokenStatus'); }, 'GET', '/api/system/apiTokenStatus', 'query-string');
  S.generate = mark(function generate(input) { return api.request('/api/system/generateApiToken', json(input)); }, 'POST', '/api/system/generateApiToken', 'application/json');
  S.revoke = mark(function revoke() { return api.request('/api/system/revokeApiToken', { method: 'POST' }); }, 'POST', '/api/system/revokeApiToken', 'query-string');
  global.ociServices = global.ociServices || {};
  global.ociServices.token = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
