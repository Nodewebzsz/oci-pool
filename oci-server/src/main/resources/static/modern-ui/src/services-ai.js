// AI configuration request constructors. Fields mirror ChatAiConfigDto and
// SystemSettingsController; responses are intentionally left unwrapped.
(function installOciAiServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function json(input) {
    const o = input || {}, keys = ['id','tenantId','modelId','showModelId','cloudType','modelName','provider','apiKey','baseUrl','enabled','systemPrompt','maxTokens','temperature','maxHistoryMessages','region','userName'];
    const out = {}; keys.forEach(k => { if (o[k] !== undefined) out[k] = o[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
  S.configs = mark(() => api.request('/system/telegramAiConfigs'), 'GET', '/system/telegramAiConfigs', 'query-string');
  S.tenants = mark(() => api.request('/system/ai/tenants'), 'GET', '/system/ai/tenants', 'query-string');
  S.modelsByTenant = mark(input => {
    const id = input && input.tenantId;
    if (id === undefined || id === null || String(id).trim() === '') throw new Error('缺少tenantId');
    return api.request('/system/ai/modelsByTenant?tenantId=' + encodeURIComponent(String(id)));
  }, 'GET', '/system/ai/modelsByTenant', 'query-string');
  S.save = mark(input => api.request('/system/updateTelegramAiConfig', json(input)), 'POST', '/system/updateTelegramAiConfig', 'application/json');
  S.batchToggle = mark(input => api.request('/system/batchToggleTelegramAiConfigs', json({ enabled: !!(input && input.enabled) })), 'POST', '/system/batchToggleTelegramAiConfigs', 'application/json');
  S.remove = mark(input => {
    const id = input && input.id;
    if (id === undefined || id === null || String(id).trim() === '') throw new Error('缺少id');
    return api.request('/system/deleteTelegramAiConfig/' + encodeURIComponent(String(id)), { method: 'DELETE' });
  }, 'DELETE', '/system/deleteTelegramAiConfig/{param}', 'query-string');
  global.ociServices = global.ociServices || {};
  global.ociServices.ai = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
