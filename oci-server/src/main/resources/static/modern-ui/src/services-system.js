// System, settings, email, VPN proxy, and resource request constructors.
(function installOciSystemServices(global) {
  'use strict';
  const api = global.ociApi;
  const contracts = global.ociContracts;
  const S = {};

  function mark(fn, method, path, encoding) { fn.endpoint = { method: method, path: path, encoding: encoding }; return fn; }
  function jsonBody(obj) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
  }
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

  S.openLogs = mark(function openLogs(input) {
    const o = input || {};
    return api.request(queryPath('/system/openLogs/json', { lines: o.lines }));
  }, 'GET', '/system/openLogs/json', 'query-string');

  S.aiModels = mark(function aiModels() {
    return api.request('/system/aiModels');
  }, 'GET', '/system/aiModels', 'query-string');

  S.getCurrentIp = mark(function getCurrentIp() {
    return api.request('/api/getCurrentIp');
  }, 'GET', '/api/getCurrentIp', 'query-string');

  S.engineStatus = mark(function engineStatus() {
    return api.request('/boot/engine/status');
  }, 'GET', '/boot/engine/status', 'query-string');

  S.enginePause = mark(function enginePause() {
    return api.request('/boot/engine/pause', { method: 'POST' });
  }, 'POST', '/boot/engine/pause', 'application/json');

  S.engineResume = mark(function engineResume() {
    return api.request('/boot/engine/resume', { method: 'POST' });
  }, 'POST', '/boot/engine/resume', 'application/json');

  S.updatePassword = mark(function updatePassword(input) {
    const o = input || {};
    return api.request('/api/system/updatePassword', jsonBody({ currentPassword: o.currentPassword, newUsername: o.newUsername, newPassword: o.newPassword }));
  }, 'POST', '/api/system/updatePassword', 'application/json');

  S.securitySettings = mark(function securitySettings() {
    return api.request('/api/system/securitySettingsConfigs');
  }, 'GET', '/api/system/securitySettingsConfigs', 'query-string');

  S.ipSettings = mark(function ipSettings() {
    return api.request('/api/system/ipSettingsConfigs');
  }, 'GET', '/api/system/ipSettingsConfigs', 'query-string');

  S.updateIpCheckConfig = mark(function updateIpCheckConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateIpCheckConfig', jsonBody({
      enabled: !!o.enabled, checkInterval: Number(o.checkInterval || 0),
      vpsUsername: o.vpsUsername || '', vpsPassword: o.vpsPassword || '', sshPort: Number(o.sshPort || 22),
    }));
  }, 'POST', '/api/system/updateIpCheckConfig', 'application/json');

  S.saveVpsConfig = mark(function saveVpsConfig(input) {
    const o = input || {};
    return api.request('/system/vps/saveConfig', jsonBody({
      type: o.type, enabled: !!o.enabled, serverIp: o.serverIp || '', username: o.username || '', password: o.password || '', sshPort: Number(o.sshPort || 22),
    }));
  }, 'POST', '/system/vps/saveConfig', 'application/json');

  S.testVpsConnection = mark(function testVpsConnection(input) {
    const o = input || {};
    return api.request('/system/vps/testConnection', jsonBody({
      type: o.type, enabled: !!o.enabled, serverIp: o.serverIp || '', username: o.username || '', password: o.password || '', sshPort: Number(o.sshPort || 22),
    }));
  }, 'POST', '/system/vps/testConnection', 'application/json');

  S.deleteMfaConfig = mark(function deleteMfaConfig() {
    return api.request('/api/system/deleteMfaConfig', { method: 'DELETE' });
  }, 'DELETE', '/api/system/deleteMfaConfig', 'query-string');

  S.updateMfaConfig = mark(function updateMfaConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateMfaConfig', jsonBody({ enabled: !!o.enabled, issuer: o.issuer }));
  }, 'POST', '/api/system/updateMfaConfig', 'application/json');
  S.regenerateMfaSecret = mark(function regenerateMfaSecret() {
    return api.request('/api/system/regenerateMfaSecret', { method: 'POST' });
  }, 'POST', '/api/system/regenerateMfaSecret', 'query-string');
  S.verifyMfaCode = mark(function verifyMfaCode(input) {
    const o = input || {};
    return api.request('/api/system/verifyMfaCode', jsonBody({ code: o.code }));
  }, 'POST', '/api/system/verifyMfaCode', 'application/json');

  S.updateGithubConfig = mark(function updateGithubConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateGithubConfig', jsonBody({
      clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri,
      githubId: o.githubId, userName: o.userName, enabled: o.enabled,
    }));
  }, 'POST', '/api/system/updateGithubConfig', 'application/json');

  S.updateGoogleConfig = mark(function updateGoogleConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateGoogleConfig', jsonBody({
      enabled: o.enabled, email: o.email, clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri,
    }));
  }, 'POST', '/api/system/updateGoogleConfig', 'application/json');

  S.updateTurnstileConfig = mark(function updateTurnstileConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateTurnstileConfig', jsonBody({
      enabled: o.enabled, siteKey: o.siteKey, secretKey: o.secretKey,
    }));
  }, 'POST', '/api/system/updateTurnstileConfig', 'application/json');

  S.updateLogo = mark(function updateLogo(input) {
    const o = input || {};
    return api.request('/api/system/settings/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ logoName: o.logoName }),
    });
  }, 'POST', '/api/system/settings/logo', 'application/x-www-form-urlencoded');

  S.updateChannelNotifyConfig = mark(function updateChannelNotifyConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateChannelNotifyConfig', jsonBody({ enabled: !!o.enabled }));
  }, 'POST', '/api/system/updateChannelNotifyConfig', 'application/json');

  S.domainProviderConfigs = mark(function domainProviderConfigs() {
    return api.request('/api/system/domainProviderConfigs');
  }, 'GET', '/api/system/domainProviderConfigs', 'query-string');

  S.updateCloudflareConfig = mark(function updateCloudflareConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateCloudflareConfig', jsonBody({ apiToken: o.apiToken ?? o.apiKey ?? '', zoneId: o.zoneId || '', email: o.email || '', enabled: !!o.enabled }));
  }, 'POST', '/api/system/updateCloudflareConfig', 'application/json');

  S.testCloudflareConnection = mark(function testCloudflareConnection(input) {
    const o = input || {};
    return api.request('/api/system/testCloudflareConnection', jsonBody({ apiToken: o.apiToken ?? o.apiKey ?? '', zoneId: o.zoneId || '', email: o.email || '', enabled: !!o.enabled }));
  }, 'POST', '/api/system/testCloudflareConnection', 'application/json');

  S.updateEdgeOneConfig = mark(function updateEdgeOneConfig(input) {
    const o = input || {};
    return api.request('/api/system/updateEdgeOneConfig', jsonBody({ enabled: !!o.enabled, secretId: o.secretId || '', secretKey: o.secretKey || '', region: o.region || '' }));
  }, 'POST', '/api/system/updateEdgeOneConfig', 'application/json');

  S.testEdgeOneConnection = mark(function testEdgeOneConnection(input) {
    const o = input || {};
    return api.request('/api/system/testEdgeOneConnection', jsonBody({ enabled: !!o.enabled, secretId: o.secretId || '', secretKey: o.secretKey || '', region: o.region || '' }));
  }, 'POST', '/api/system/testEdgeOneConnection', 'application/json');

  S.notifyConfigs = mark(function notifyConfigs() {
    return api.request('/api/system/notifyConfigs');
  }, 'GET', '/api/system/notifyConfigs', 'query-string');

  // Email
  S.emailTenantList = mark(function emailTenantList(input) {
    const o = input || {};
    return api.request('/email/tenant/list', jsonBody({ id: o.id, tenantId: contracts.id(o.tenantId, 'tenantId') }));
  }, 'POST', '/email/tenant/list', 'application/json');

  S.emailSend = mark(function emailSend(input) {
    const o = input || {};
    return api.request('/email/send', jsonBody({
      title: o.title, content: o.content, tenantEmailConfigId: o.tenantEmailConfigId, emailReceiveIds: o.emailReceiveIds,
    }));
  }, 'POST', '/email/send', 'application/json');

  // VPN proxy
  S.vpnSaveOrUpdate = mark(function vpnSaveOrUpdate(input) {
    const o = input || {};
    return api.request('/vpnProxy/saveOrUpdate', jsonBody(vpnFields(o)));
  }, 'POST', '/vpnProxy/saveOrUpdate', 'application/json');

  S.vpnPageList = mark(function vpnPageList(input) {
    const o = input || {};
    return api.request('/vpnProxy/pageList', jsonBody(vpnFields(o)));
  }, 'POST', '/vpnProxy/pageList', 'application/json');

  S.vpnTestConnection = mark(function vpnTestConnection(input) {
    const o = input || {};
    return api.request('/vpnProxy/testConnection', jsonBody(vpnFields(o)));
  }, 'POST', '/vpnProxy/testConnection', 'application/json');

  S.vpnTestAll = mark(function vpnTestAll() {
    return api.request('/vpnProxy/testAll', { method: 'POST', body: formBody({}) });
  }, 'POST', '/vpnProxy/testAll', 'query-string');

  S.vpnDelete = mark(function vpnDelete(input) {
    const o = input || {};
    return api.request('/vpnProxy/delete', jsonBody(vpnFields(o)));
  }, 'POST', '/vpnProxy/delete', 'application/json');

  S.vpnFindByTenant = mark(function vpnFindByTenant(input) {
    const o = input || {};
    const tenantId = contracts.id(o.tenantId, 'tenantId');
    return api.request('/vpnProxy/findByTenant', jsonBody({ tenantId: tenantId }));
  }, 'POST', '/vpnProxy/findByTenant', 'application/json');

  S.vpnBindTenant = mark(function vpnBindTenant(input) {
    const o = input || {};
    const tenantId = contracts.id(o.tenantId, 'tenantId');
    return api.request('/vpnProxy/bindTenant', jsonBody({
      tenantId: tenantId,
      id: o.id === null || o.id === undefined || o.id === '' ? null : o.id,
      expectedBindingRevision: o.expectedBindingRevision || undefined,
    }));
  }, 'POST', '/vpnProxy/bindTenant', 'application/json');

  function vpnFields(o) {
    return {
      id: o.id, proxyType: o.proxyType, proxyHost: o.proxyHost, proxyPort: o.proxyPort,
      proxyUsername: o.proxyUsername, proxyPassword: o.proxyPassword, availableStatus: o.availableStatus,
      forceProxy: o.forceProxy, tenantId: o.tenantId, tenantIds: o.tenantIds, customName: o.customName,
      expectedBindingRevision: o.expectedBindingRevision,
    };
  }

  // Resource
  S.armData = mark(function armData() {
    return api.request('/resource/arm-data');
  }, 'GET', '/resource/arm-data', 'query-string');

  S.myRegions = mark(function myRegions() {
    return api.request('/resource/my-regions');
  }, 'GET', '/resource/my-regions', 'query-string');

  // System messages batch cleanup
  S.deleteBatchMessages = mark(function deleteBatchMessages(input) {
    const o = input || {};
    const ids = Array.isArray(o.ids) ? o.ids : [];
    return api.request('/sysMessage/delBatch', jsonBody({ ids: ids }));
  }, 'POST', '/sysMessage/delBatch', 'application/json');

  S.clearMessages = mark(function clearMessages() {
    return api.request('/sysMessage/clear', { method: 'POST', body: formBody({}) });
  }, 'POST', '/sysMessage/clear', 'query-string');

  // IP Ban Management (P0)
  S.ipBansList = mark(function ipBansList(input) {
    const o = input || {};
    const params = new URLSearchParams();
    if (o.page !== undefined && o.page !== null) params.set('page', String(o.page));
    if (o.size !== undefined && o.size !== null) params.set('size', String(o.size));
    if (o.status !== undefined && o.status !== null && o.status !== '') params.set('status', String(o.status));
    if (o.ip && String(o.ip).trim()) params.set('ip', String(o.ip).trim());
    const qs = params.toString();
    return api.request('/api/system/ip-bans' + (qs ? '?' + qs : ''));
  }, 'GET', '/api/system/ip-bans', 'query-string');

  S.ipBanCreate = mark(function ipBanCreate(input) {
    const o = input || {};
    return api.request('/api/system/ip-bans/ban', jsonBody({ ip: o.ip, reason: o.reason }));
  }, 'POST', '/api/system/ip-bans/ban', 'application/json');

  S.ipBanUnban = mark(function ipBanUnban(id) {
    return api.request('/api/system/ip-bans/' + encodeURIComponent(String(id)) + '/unban', { method: 'POST' });
  }, 'POST', '/api/system/ip-bans/{id}/unban', 'application/json');

  // Network Quality Probe (P1.1)
  S.networkQualityOverview = mark(function networkQualityOverview() {
    return api.request('/api/network-quality/overview');
  }, 'GET', '/api/network-quality/overview', 'query-string');

  S.networkQualityHistory = mark(function networkQualityHistory(input) {
    const o = input || {};
    const params = new URLSearchParams();
    params.set('instanceId', String(o.instanceId));
    params.set('taskId', String(o.taskId));
    params.set('revision', String(o.revision));
    params.set('hours', String(o.hours || 24));
    return api.request('/api/network-quality/history?' + params.toString());
  }, 'GET', '/api/network-quality/history', 'query-string');

  S.networkQualityCreateTask = mark(function networkQualityCreateTask(payload) {
    return api.request('/api/network-quality/tasks', jsonBody(payload || {}));
  }, 'POST', '/api/network-quality/tasks', 'application/json');

  S.networkQualityUpdateTask = mark(function networkQualityUpdateTask(id, payload) {
    return api.request('/api/network-quality/tasks/' + encodeURIComponent(String(id)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
  }, 'PUT', '/api/network-quality/tasks/{id}', 'application/json');

  S.networkQualityDeleteTask = mark(function networkQualityDeleteTask(id, version) {
    return api.request('/api/network-quality/tasks/' + encodeURIComponent(String(id)) + '?version=' + encodeURIComponent(String(version)), {
      method: 'DELETE',
    });
  }, 'DELETE', '/api/network-quality/tasks/{id}', 'query-string');

  S.networkQualityRunTask = mark(function networkQualityRunTask(id, payload) {
    return api.request('/api/network-quality/tasks/' + encodeURIComponent(String(id)) + '/run', jsonBody(payload || {}));
  }, 'POST', '/api/network-quality/tasks/{id}/run', 'application/json');

  // Monitor Agent Install / Uninstall
  S.monitorInstallAgent = mark(function monitorInstallAgent(vpsId) {
    return api.request('/api/monitor/install?vpsId=' + encodeURIComponent(String(vpsId)), { method: 'POST' });
  }, 'POST', '/api/monitor/install', 'query-string');

  S.monitorUninstallAgent = mark(function monitorUninstallAgent(vpsId) {
    return api.request('/api/monitor/uninstall?vpsId=' + encodeURIComponent(String(vpsId)), { method: 'POST' });
  }, 'POST', '/api/monitor/uninstall', 'query-string');

  // VPS Ping Control
  S.vpsEnablePing = mark(function vpsEnablePing() {
    return api.request('/vps/instances/enablePing', { method: 'POST' });
  }, 'POST', '/vps/instances/enablePing', 'query-string');

  S.vpsDisablePing = mark(function vpsDisablePing() {
    return api.request('/vps/instances/disablePing', { method: 'POST' });
  }, 'POST', '/vps/instances/disablePing', 'query-string');

  S.vpsManualPing = mark(function vpsManualPing() {
    return api.request('/vps/instances/ping', { method: 'POST' });
  }, 'POST', '/vps/instances/ping', 'query-string');

  global.ociServices = global.ociServices || {};
  global.ociServices.system = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
