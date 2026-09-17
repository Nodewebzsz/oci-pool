// HTML5 History router for the Modern UI (No '#' in URL).
// Exposes window.ociRouter in the browser and module.exports for Node tests.
(function () {
  'use strict';

  var PAGE_ROUTES = {
    monitor:       { path: '/monitor' },
    tenants:       { path: '/tenants', query: ['page', 'size', 'keyword', 'cloudType', 'emailEnable'] },
    'tenant-detail':     { path: '/tenants/:tenantDbId', param: 'tenantDbId', query: ['tab', 'region'] },
    'tenant-grab':       { path: '/tenants/:tenantDbId/grab', param: 'tenantDbId', query: ['page', 'size', 'region', 'bootId'] },
    'tenant-resources':  { path: '/tenants/:tenantDbId/resources', param: 'tenantDbId', query: ['page', 'size', 'region'] },
    'tenant-traffic':    { path: '/tenants/:tenantDbId/traffic', param: 'tenantDbId', query: ['region', 'regionId', 'from'] },
    'tenant-audit':      { path: '/tenants/:tenantDbId/audit', param: 'tenantDbId', query: ['from'] },
    'tenant-cost':       { path: '/tenants/:tenantDbId/cost', param: 'tenantDbId', query: ['from'] },
    'tenant-quota':      { path: '/tenants/:tenantDbId/quota', param: 'tenantDbId', query: ['from'] },
    'tenant-boot-create': { path: '/tenants/:tenantDbId/boot-create', param: 'tenantDbId', query: ['region', 'from'] },
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
    aiChat:        { path: '/tools/ai-chat', query: ['tenantId'] },
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
    var loc = g.location || {};
    var pathname = loc.pathname || '';
    var search = loc.search || '';
    var hash = loc.hash || '';

    // 自愈清洗：如果 search 只是孤立的 '?'，通过 replaceState 清除地址栏末尾的问号
    if (search === '?') {
      search = '';
      try {
        if (g.history && typeof g.history.replaceState === 'function') {
          g.history.replaceState(null, '', pathname || '/monitor');
        }
      } catch (e) {}
    } else if (search && search.charAt(0) !== '?') {
      search = '?' + search;
    }

    // 平滑自愈兼容：如果检测到 URL 中带有旧版 Hash 路由（如 /#/tenants 或 #/monitor）
    if (hash && (hash.indexOf('#/') === 0 || hash.indexOf('#') === 0)) {
      var noPound = hash.replace(/^#/, '');
      if (noPound) {
        try {
          if (g.history && typeof g.history.replaceState === 'function') {
            g.history.replaceState(null, '', noPound);
          }
        } catch (e) {}
        try {
          var u = new URL(noPound, 'http://router.local');
          pathname = u.pathname;
          search = u.search || '';
        } catch (e) {
          pathname = noPound;
        }
      }
    }

    var base = (pathname === '' || pathname === '/' || pathname === '/index') ? '/monitor' : (pathname + search);
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
    var method = opts.replace ? 'replaceState' : 'pushState';
    try {
      if (g.history && typeof g.history[method] === 'function') {
        g.history[method](null, '', h);
      }
    } catch (e) {}

    // 仅在 Node 测试模拟环境中更新 mock location 对象；
    // 严禁在真实浏览器中向 window.location 属性直接赋值（向 location.search 赋值空字符串会导致浏览器导航至带'?'的URL并触发整页刷新）
    if (typeof window === 'undefined' && g.location && typeof g.location === 'object') {
      try {
        var parsed = new URL(h, 'http://router.local');
        g.location.pathname = parsed.pathname;
        g.location.search = parsed.search || '';
        g.location.hash = '';
      } catch (e) {}
    }
    emit();
  }

  function onHistoryChange() { emit(); }
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onHistoryChange);
    window.addEventListener('hashchange', onHistoryChange);

    // 全局内部链接自动转 History 路由，防浏览器重新刷新整页
    if (typeof document !== 'undefined') {
      document.addEventListener('click', function (e) {
        var el = e.target;
        while (el && el.tagName !== 'A') {
          el = el.parentElement;
        }
        if (!el) return;
        var h = el.getAttribute('href');
        if (!h || h.startsWith('http://') || h.startsWith('https://') || h.startsWith('//') || h.startsWith('javascript:') || el.target === '_blank') {
          return;
        }
        if (h.startsWith('#/')) {
          e.preventDefault();
          var clean = h.replace(/^#/, '');
          try { g.history.pushState(null, '', clean); } catch (err) {}
          emit();
          return;
        }
        if (h.startsWith('/')) {
          e.preventDefault();
          try { g.history.pushState(null, '', h); } catch (err) {}
          emit();
        }
      });
    }
  }

  var api = { read: read, href: href, go: go, subscribe: subscribe };
  if (typeof window !== 'undefined') window.ociRouter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
