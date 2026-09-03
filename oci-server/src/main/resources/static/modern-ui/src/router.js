// Dependency-free hash router for the Modern UI.
// Exposes window.ociRouter in the browser and module.exports for Node tests.
(function () {
  'use strict';

  var PAGE_ROUTES = {
    monitor:       { path: '/monitor' },
    tenants:       { path: '/tenants', query: ['page', 'size', 'keyword', 'cloudType', 'emailEnable'] },
    'tenant-detail':     { path: '/tenants/:tenantDbId', param: 'tenantDbId', query: ['tab', 'region'] },
    'tenant-grab':       { path: '/tenants/:tenantDbId/grab', param: 'tenantDbId', query: ['page', 'size', 'region', 'bootId'] },
    'tenant-resources':  { path: '/tenants/:tenantDbId/resources', param: 'tenantDbId', query: ['page', 'size', 'region'] },
    instances:     { path: '/instances', query: ['page', 'size', 'tenantId', 'regionId'] },
    grab:          { path: '/grab', query: ['page', 'size', 'tenantId'] },
    regions:       { path: '/regions' },
    logs:          { path: '/boot-logs', query: ['level', 'keyword'] },
    mail:          { path: '/mail', query: ['tenantId', 'page', 'size', 'keyword'] },
    object:        { path: '/object-storage', query: ['tenantId', 'bucket', 'path'] },
    ai:            { path: '/ai', query: ['tenantId', 'model'] },
    link:          { path: '/link-test', query: ['target'] },
    proxyKeyConfig: { path: '/proxy/keys' },
    cfManage:      { path: '/proxy/cloudflare', query: ['zoneId'] },
    eoManage:      { path: '/proxy/edgeone', query: ['zoneId'] },
    keyConfig:     { path: '/developer/tokens' },
    notifyMgmt:    { path: '/tools/notifications' },
    memPage:       { path: '/tools/memos', query: ['page', 'size', 'keyword'] },
    migPage:       { path: '/tools/migration' },
    mfaBackup:     { path: '/tools/mfa-backup' },
    resList:       { path: '/resources', query: ['page', 'size', 'tenantId', 'region', 'keyword'] },
    resCloudInit:  { path: '/resources/cloud-init', query: ['resourceId'] },
    sysIpQuality:  { path: '/system/ip-quality' },
    sysLogs:       { path: '/system/logs', query: ['level', 'keyword'] },
    sysSetting:    { path: '/system/security' },
    sysVpnProxy:   { path: '/system/proxy', query: ['page', 'size', 'keyword'] },
    auth:          { path: '/login', paths: ['/login', '/register', '/forgot-password'] },
  };

  var TENANT_PARAM_ALIAS = 'tenantId';

  // ctx key -> URL query key. The Modern UI uses `regionCode` internally but
  // the original page/URL contract exposes `region` in the query string.
  var QUERY_ALIASES = { regionCode: 'region' };

  var g = (typeof window !== 'undefined') ? window : globalThis;

  function normalizePage(page) {
    return page === 'sysNotify' ? 'notifyMgmt' : page;
  }

  // Given a query key, return the ctx key that supplies its value.
  function sourceKeyFor(queryKey) {
    for (var k in QUERY_ALIASES) {
      if (QUERY_ALIASES[k] === queryKey) return k;
    }
    return queryKey;
  }

  function encode(value) { return encodeURIComponent(String(value)); }

  function href(page, ctx) {
    page = normalizePage(page);
    ctx = ctx || {};
    if (page === 'auth') {
      var view = ctx.authView || ctx.view;
      if (view !== 'register' && view !== 'forgot-password') view = 'login';
      return '/' + view;
    }
    var route = PAGE_ROUTES[page];
    if (!route) return '/';
    var path = route.path;
    if (route.param) {
      var v = ctx[route.param];
      if (v == null) v = ctx[TENANT_PARAM_ALIAS];
      if (v == null) return '/';
      path = path.replace(':' + route.param, encode(v));
    }
    var pairs = [];
    var queryKeys = route.query || [];
    for (var i = 0; i < queryKeys.length; i++) {
      var key = queryKeys[i];
      var sourceKey = sourceKeyFor(key);
      var val = ctx[sourceKey];
      if (val == null || val === '') continue;
      pairs.push(encode(key) + '=' + encode(val));
    }
    return path + (pairs.length ? '?' + pairs.join('&') : '');
  }

  function read() {
    var hash = (g.location && g.location.hash) || '';
    var noPound = hash.replace(/^#/, '');
    var base = noPound || '/monitor';
    var url;
    try { url = new URL(base, 'http://router.local'); } catch (e) {
      return { page: 'monitor', params: {}, query: {}, href: '/monitor' };
    }
    var path = url.pathname;
    var query = {};
    url.searchParams.forEach(function (value, key) { query[key] = value; });
    var order = Object.keys(PAGE_ROUTES);
    for (var i = 0; i < order.length; i++) {
      var pageId = order[i];
      var route = PAGE_ROUTES[pageId];
      if (route.param) {
        var pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
        var re = new RegExp('^' + pattern + '$');
        var m = path.match(re);
        if (m) {
          var paramName = route.param;
          var decoded = decodeURIComponent(m[1]);
          if (paramName === 'tenantDbId' && !/^\d+$/.test(decoded)) continue;
          var params = {};
          params[paramName] = decoded;
          return { page: normalizePage(pageId), params: params, query: query, href: path + (url.search || '') };
        }
      } else {
        var hay = route.paths || [route.path];
        for (var j = 0; j < hay.length; j++) {
          if (hay[j] === path) {
            var params = {};
            if (pageId === 'auth') params.authView = path.replace(/^\//, '');
            return { page: normalizePage(pageId), params: params, query: query, href: path + (url.search || '') };
          }
        }
      }
    }
    return { page: 'monitor', params: {}, query: {}, href: '/monitor', invalid: true };
  }

  var listeners = [];
  function emit() {
    var state = read();
    for (var i = 0; i < listeners.length; i++) listeners[i](state);
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function () {
      var idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  function go(page, ctx, opts) {
    opts = opts || {};
    var h = href(page, ctx);
    var target = '#' + h;
    var method = opts.replace ? 'replaceState' : 'pushState';
    try { if (g.history && typeof g.history[method] === 'function') g.history[method](null, '', target); } catch (e) {}
    if (g.location) {
      if (g.location.hash !== target) g.location.hash = h;
    }
    emit();
  }

  function onHistoryChange() { emit(); }
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onHistoryChange);
    window.addEventListener('hashchange', onHistoryChange);
  }

  var api = { read: read, href: href, go: go, subscribe: subscribe };
  if (typeof window !== 'undefined') window.ociRouter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
