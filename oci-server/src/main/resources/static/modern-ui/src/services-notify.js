// System notification request constructors.
(function installOciNotifyServices(global) {
  'use strict';
  const api = global.ociApi;
  const S = {};
  function mark(fn, method, path, encoding) { fn.endpoint = { method, path, encoding }; return fn; }
  function json(input) {
    const o = input || {}, out = {};
    ['id','businessId','messageType','readStatus','subject','content','updateTime','createTime','pageNum','pageSize','sort','order'].forEach(k => { if (o[k] !== undefined) out[k] = o[k]; });
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
  }
  function jsonBody(input) {
    const o = input || {};
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) };
  }
  S.list = mark(function list(input) { return api.request('/sysMessage/list', json(input)); }, 'POST', '/sysMessage/list', 'application/json');
  S.get = mark(function get(input) { return api.request('/sysMessage/get', json(input)); }, 'POST', '/sysMessage/get', 'application/json');
  S.readAll = mark(function readAll() { return api.request('/sysMessage/read', { method: 'POST' }); }, 'POST', '/sysMessage/read', 'query-string');
  S.countUnread = mark(function countUnread() { return api.request('/sysMessage/countUnread', { method: 'POST' }); }, 'POST', '/sysMessage/countUnread', 'query-string');
  S.remove = mark(function remove(input) {
    const o = input || {};
    return api.request('/sysMessage/del', json({ businessId: o.businessId, id: o.id }));
  }, 'POST', '/sysMessage/del', 'application/json');
  S.configs = mark(function configs() { return api.request('/api/system/notifyConfigs'); }, 'GET', '/api/system/notifyConfigs', 'query-string');
  S.updateTelegram = mark(function updateTelegram(input) {
    const o = input || {};
    return api.request('/api/system/updateTelegramConfig', jsonBody({ botToken: o.botToken, chatId: o.chatId, chatName: o.chatName, enabled: !!o.enabled }));
  }, 'POST', '/api/system/updateTelegramConfig', 'application/json');
  S.updateDingTalk = mark(function updateDingTalk(input) {
    const o = input || {};
    return api.request('/api/system/updateDingTalkConfig', jsonBody({ enabled: !!o.enabled, webhook: o.webhook, secret: o.secret }));
  }, 'POST', '/api/system/updateDingTalkConfig', 'application/json');
  S.updateBark = mark(function updateBark(input) {
    const o = input || {};
    return api.request('/api/system/updateBarkConfig', jsonBody({ enabled: !!o.enabled, url: o.url, deviceKey: o.deviceKey }));
  }, 'POST', '/api/system/updateBarkConfig', 'application/json');
  S.updateFeishu = mark(function updateFeishu(input) {
    const o = input || {};
    return api.request('/api/system/updateFeishuConfig', jsonBody({ enabled: !!o.enabled, webhook: o.webhook, secret: o.secret }));
  }, 'POST', '/api/system/updateFeishuConfig', 'application/json');
  S.updateProxy = mark(function updateProxy(input) {
    const o = input || {};
    return api.request('/api/system/updateProxyConfig', jsonBody({ enabled: !!o.enabled, type: o.type, host: o.host, port: Number(o.port || 0), username: o.username, password: o.password }));
  }, 'POST', '/api/system/updateProxyConfig', 'application/json');
  S.updateTask = mark(function updateTask(input) {
    const o = input || {};
    return api.request('/api/system/updateTaskConfig', jsonBody({ enabled: !!o.enabled, executeHour: Number(o.executeHour || 0), notificationSecret: o.notificationSecret, enableAccountCheck: !!o.enableAccountCheck, enableBootLog: !!o.enableBootLog, enableCostCheck: !!o.enableCostCheck }));
  }, 'POST', '/api/system/updateTaskConfig', 'application/json');
  S.testTelegram = mark(function testTelegram() { return api.request('/api/system/testTgTalk', { method: 'POST' }); }, 'POST', '/api/system/testTgTalk', 'query-string');
  S.testDingTalk = mark(function testDingTalk() { return api.request('/api/system/testDingTalk', { method: 'POST' }); }, 'POST', '/api/system/testDingTalk', 'query-string');
  S.testBark = mark(function testBark() { return api.request('/api/system/testBark', { method: 'POST' }); }, 'POST', '/api/system/testBark', 'query-string');
  S.testFeishu = mark(function testFeishu() { return api.request('/api/system/testFeishu', { method: 'POST' }); }, 'POST', '/api/system/testFeishu', 'query-string');
  S.testProxy = mark(function testProxy(input) {
    const o = input || {};
    return api.request('/api/system/testProxyConnection', jsonBody({ enabled: !!o.enabled, type: o.type, host: o.host, port: Number(o.port || 0), username: o.username, password: o.password }));
  }, 'POST', '/api/system/testProxyConnection', 'application/json');
  global.ociServices = global.ociServices || {};
  global.ociServices.notify = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
