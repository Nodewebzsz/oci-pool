// OCI-POOL Manager v2 — Main app
const { useState: useStateA, useEffect: useEffectA } = React;

const ACCENT_PRESETS = {
  green:  { hue: 155, name: tr('app.d1425a'), nameEn: 'Vitality Green' },
  cyan:   { hue: 200, name: tr('app.963895'), nameEn: 'Ocean Cyan' },
  violet: { hue: 305, name: tr('app.eef286'),   nameEn: 'Violet' },
  orange: { hue: 55,  name: tr('app.d47a64'), nameEn: 'Amber' },
  blue:   { hue: 240, name: tr('app.91345d'), nameEn: 'Classic Blue' },
};
// 挂 window · Topbar 里的强调色切换器要用
window.ACCENT_PRESETS = ACCENT_PRESETS;
window.getAccentColor = (k) => `oklch(0.72 0.16 ${(ACCENT_PRESETS[k] || ACCENT_PRESETS.green).hue})`;

function App() {
  return (
    <LangProvider>
      <ShellProvider>
        <AppInner />
      </ShellProvider>
    </LangProvider>);

}

// 主题解析: dark / light / system → 实际生效的 data-theme
function resolveTheme(theme) {
  if (theme === 'dark' || theme === 'light') return theme;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// 品牌加载页 · authState === 'checking'(刷新后等待 /api/userInfo 返回)时出现,
// 复用品牌云标 + 强调色渐变,替代原先的纯文本占位,让每次刷新都能看到完整品牌首屏。
function BrandLoading() {
  const { t: tr } = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={tr('app.authChecking')}
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes ocip-load-drift { 0%,100%{ transform: translateY(0) scale(1); } 50%{ transform: translateY(-10px) scale(1.04); } }
        @keyframes ocip-load-fade { from{ opacity:0; transform: translateY(12px); } to{ opacity:1; transform: translateY(0); } }
        @keyframes ocip-load-bar { 0%{ left:-30%; width:34%; } 50%{ width:58%; } 100%{ left:112%; width:34%; } }
        @keyframes ocip-load-ring { 0%{ transform: scale(0.9); opacity:0.7; } 60%{ transform: scale(1.25); opacity:0; } 100%{ transform: scale(1.25); opacity:0; } }
      `}</style>

      {/* 环境光晕 */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at 18% 22%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 42%),
          radial-gradient(circle at 82% 78%, color-mix(in oklab, var(--cyan) 14%, transparent), transparent 42%),
          radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--accent) 6%, transparent), transparent 58%)`,
      }} />

      {/* 极淡网格 */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.55,
        backgroundImage: `linear-gradient(to right, color-mix(in oklab, var(--fg-3) 12%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in oklab, var(--fg-3) 12%, transparent) 1px, transparent 1px)`,
        backgroundSize: '46px 46px',
        maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 74%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 74%)',
      }} />

      {/* 居中品牌区 */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'ocip-load-fade 620ms cubic-bezier(0.4, 0, 0.2, 1) both',
      }}>
        {/* 标识 · 呼吸 + 波纹环 */}
        <div style={{ position: 'relative', width: 92, height: 92 }}>
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 26,
            border: '1px solid color-mix(in oklab, var(--accent) 55%, transparent)',
            animation: 'ocip-load-ring 2.4s ease-out infinite',
          }} />
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 26,
            border: '1px solid color-mix(in oklab, var(--accent) 40%, transparent)',
            animation: 'ocip-load-ring 2.4s ease-out infinite',
            animationDelay: '0.8s',
          }} />
          <div style={{
            width: 92, height: 92, borderRadius: 26,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--cyan) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 18px 52px color-mix(in oklab, var(--accent) 35%, transparent)',
            animation: 'ocip-load-drift 5s ease-in-out infinite',
          }}>
            <svg width="50" height="50" viewBox="0 0 36 36" role="img" aria-label={tr('layout.2e9579')}>
              <path d="M10 20.4a4.2 4.2 0 0 1 2.6-7.5 6.1 6.1 0 0 1 11.6 1.2 3.7 3.7 0 0 1 .7 7.3H11.2"
                    fill="none" stroke="oklch(0.14 0.02 155)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="13" cy="25.5" r="1.6" fill="oklch(0.14 0.02 155)" />
              <circle cx="18" cy="25.5" r="1.6" fill="oklch(0.14 0.02 155)" />
              <circle cx="23" cy="25.5" r="1.6" fill="oklch(0.14 0.02 155)" />
              <path d="M13 23.9v-2.5" stroke="oklch(0.14 0.02 155)" strokeWidth="1.4" />
              <path d="M18 23.9v-2.5" stroke="oklch(0.14 0.02 155)" strokeWidth="1.4" />
              <path d="M23 23.9v-2.5" stroke="oklch(0.14 0.02 155)" strokeWidth="1.4" />
            </svg>
          </div>
        </div>

        {/* 品牌名 */}
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <div style={{
            fontSize: 27, fontWeight: 800, letterSpacing: 4.5,
            color: 'var(--fg-0)', fontFamily: 'var(--font-sans)',
          }}>
            {tr('brand.name')}
          </div>
          <div style={{
            marginTop: 7, fontSize: 12, letterSpacing: 2.2,
            color: 'var(--fg-2)', fontFamily: 'var(--font-sans)',
          }}>
            {tr('brand.tagline')}
          </div>
        </div>

        {/* 加载条 */}
        <div style={{
          width: 190, height: 3, borderRadius: 999, marginTop: 22,
          background: 'var(--bg-2)', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative', height: '100%' }}>
            <div style={{
              position: 'absolute', top: 0, height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent), var(--cyan))',
              animation: 'ocip-load-bar 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>

        {/* 状态说明 */}
        <div style={{
          marginTop: 16, fontSize: 11, letterSpacing: 0.8, color: 'var(--fg-3)',
          fontFamily: 'var(--font-mono)',
        }}>
          {tr('app.authChecking')}
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const { lang, setLang, t: tr } = useT();
  const tk = useTweaks(window.OCI_TWEAK_DEFAULTS);
  const [tweaks, setTweak] = [tk[0], tk[1]];

  // 后端 sa-token 会话是唯一登录依据；本地存储只保留纯 UI 偏好。
  const [authState, setAuthState] = useStateA('checking');
  const login = React.useCallback(() => {
    setAuthState('authenticated');
    // 登录成功后回到登录前想访问的受保护页;没有则回到监控面板
    let target = null;
    try {
      const raw = window.sessionStorage.getItem('ocip-auth-target');
      if (raw) { target = JSON.parse(raw); window.sessionStorage.removeItem('ocip-auth-target'); }
    } catch (e) { /* ignore malformed target */ }
    if (target && target.page && target.page !== 'auth') {
      window.ociRouter.go(target.page, { ...(target.params || {}), ...(target.query || {}) }, { replace: true });
    } else {
      window.ociRouter.go('monitor', {}, { replace: true });
    }
  }, []);
  const logout = React.useCallback(() => {
    setAuthState('anonymous');
    window.sessionStorage.removeItem('ocip-auth-target');
    window.ociApi.request('/perform_logout', { method: 'POST' }).catch((error) => {
      console.warn(tr('app.27fc95'), error);
    });
    window.ociRouter.go('auth', {}, { replace: true });
  }, []);
  React.useEffect(() => {
    let active = true;
    // 让品牌加载页至少展示一小段时间,避免本地/快速响应时只闪一瞬就消失。
    const MIN_SPLASH_MS = 420;
    const started = Date.now();
    const settle = (state) => {
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      setTimeout(() => { if (active) setAuthState(state); }, wait);
    };
    window.ociApi.request('/api/userInfo')
      .then((response) => {
        if (!active) return;
        settle(response?.success && response?.code === 200 ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (active) settle('anonymous');
      });
    const onUnauthorized = () => setAuthState('anonymous');
    window.addEventListener('ocip:unauthorized', onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener('ocip:unauthorized', onUnauthorized);
    };
  }, []);
  React.useEffect(() => {
    window.__ocipLogout = logout;
    return () => { window.__ocipLogout = null; };
  }, [logout]);

  // 路由状态来源:hash(#/...) → { page, params, query, href }
  const [route, setRoute] = useStateA(() => window.ociRouter.read());
  React.useEffect(() => {
    const un = window.ociRouter.subscribe((next) => {
      setRoute(next);
      // 页面切换时关闭所有浮层,防止上一页面的 modal/drawer 残留到新页面
      if (window.__ocipShell) window.__ocipShell.closeAll();
      // 非法/未知路由统一归一化到 /#/monitor,避免地址栏残留死链
      if (next.invalid) window.ociRouter.go('monitor', {}, { replace: true });
    });
    // 首次挂载时若落在非法路由,同样归一化一次
    if (window.ociRouter.read().invalid) window.ociRouter.go('monitor', {}, { replace: true });
    return un;
  }, []);

  // 未登录时访问非 auth 路由 → 记录目标页并回到登录页;登录成功后回到该页
  // 已登录时访问 auth 路由 → 直接去监控面板
  React.useEffect(() => {
    if (authState === 'anonymous' && route.page !== 'auth') {
      window.sessionStorage.setItem('ocip-auth-target', JSON.stringify({
        page: route.page, params: route.params, query: route.query,
      }));
      window.ociRouter.go('auth', {}, { replace: true });
    } else if (authState === 'authenticated' && route.page === 'auth') {
      window.ociRouter.go('monitor', {}, { replace: true });
    }
  }, [authState, route]);

  const page = route.page;
  // 子页面上下文(tenant-detail/grab/resources):从路由参数/查询还原
  const CHILD_PAGE_IDS = ['tenant-detail', 'tenant-grab', 'tenant-resources'];
  const detailCtx = CHILD_PAGE_IDS.includes(page)
    ? {
        tenantId: route.params.tenantDbId,
        regionTenantId: route.params.tenantDbId,
        tab: route.query.tab,
        regionCode: route.query.region,
        ...route.query,
      }
    : null;

  const navigate = (p, ctx) => {
    // 页面切换时关闭所有浮层
    if (window.__ocipShell) window.__ocipShell.closeAll();
    window.ociRouter.go(p, ctx);
  };
  // 更新详情页 tab/region(不切页,只改 hash query,用 replace 避免污染历史)
  const updateDetailCtx = (patch) => {
    window.ociRouter.go(page, { ...route.query, tenantDbId: route.params.tenantDbId, ...patch }, { replace: true });
  };
  // 挂到 window 方便非 React 位置(如租户列表菜单)也能触发跳转
  React.useEffect(() => {
    window.__ocipNavigate = navigate;
    window.__ocipDetailCtx = detailCtx;
    return () => { window.__ocipNavigate = null; };
  }, [detailCtx, navigate]);
  const [now, setNow] = useStateA(() => formatTime(new Date()));
  useEffectA(() => {
    const iv = setInterval(() => setNow(formatTime(new Date())), 1000);
    return () => clearInterval(iv);
  }, []);


  // Apply theme
  useEffectA(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolveTheme(tweaks.theme));
    apply();
    if (tweaks.theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => apply();
      mq.addEventListener && mq.addEventListener('change', onChange);
      return () => { mq.removeEventListener && mq.removeEventListener('change', onChange); };
    }
  }, [tweaks.theme]);

  // Apply accent
  useEffectA(() => {
    // tweaks.accent 存的可能是 preset key(旧字段)、preset 对象、或早期版本存的 { value, color, label }
    const accentKey =
      typeof tweaks.accent === 'string' ? tweaks.accent :
      (tweaks.accent && (tweaks.accent.value || tweaks.accent.key)) || 'green';
    const preset = ACCENT_PRESETS[accentKey] || ACCENT_PRESETS.green;
    const hue = preset.hue;
    const root = document.documentElement;
    root.style.setProperty('--accent', `oklch(0.72 0.16 ${hue})`);
    const resolvedTheme = resolveTheme(tweaks.theme);
    root.style.setProperty('--accent-soft', resolvedTheme === 'light' ?
    `oklch(0.93 0.06 ${hue})` :
    `oklch(0.30 0.10 ${hue})`);
    root.style.setProperty('--accent-fg', resolvedTheme === 'light' ?
    'white' :
    `oklch(0.14 0.02 ${hue})`);
  }, [tweaks.accent, tweaks.theme]);

  // Icons re-render on every update
  useEffectA(() => {
    const id = requestAnimationFrame(() => {
      if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
      }
    });
    return () => cancelAnimationFrame(id);
  });

  const commonProps = { density: tweaks.density };
  const PAGES = {
    monitor: MonitorPage,
    tenants: TenantsPage,
    'tenant-detail': TenantDetailPage,
    'tenant-grab': TenantGrabPage,
    'tenant-resources': TenantResourcesPage,
    instances: InstancesPage,
    grab: GrabPage,
    regions: RegionsPage,
    logs: LogsPage,
    // 代理管理 3 子菜单 · 秘钥配置(域名服务商) / CF / EO
    proxyKeyConfig: ProxyKeyConfigPage,
    cfManage:       CFManagePage,
    eoManage:       EOManagePage,
    // 开发配置 · 对齐原项目 sidebar.dev.config
    keyConfig: KeyConfigPage,
    // 我的工具 4 子菜单 · 对齐原项目 sidebar.my.tools
    notifyMgmt: NotifyMgmtPage,
    memPage:    MemPage,
    migPage:    MigPage,
    mfaBackup:  MfaBackupPage,
    mail: MailPage,
    object: ObjectPage,
    ai: AIPage,
    link: LinkPage,
    resList: ResListPage,
    resCloudInit: ResCloudInitPage,
    // 系统管理 4 子菜单 · 严格对齐原项目
    sysIpQuality: SysIpQualityPage,
    sysLogs:      SysLogsPage,
    sysSetting:   SysSettingPage,
    sysVpnProxy:  SysVpnProxyPage,
    // 保留旧路由 · 兼容(此前叫 sysNotify)
    sysNotify:    NotifyPage,
  };
  // 子页 → 父级 nav 高亮映射:子页在侧边栏不出现,但要让父项保持 active 态
  const CHILD_PAGES = {
    'tenant-detail': 'tenants',
    'tenant-grab': 'tenants',      // 从租户菜单进的"查看开机"归属"租户管理"
    'tenant-resources': 'tenants', // 资源列表也是租户的下钻
  };
  // 若上次停在依赖 ctx 的子页但 ctx 丢了,回退到 tenants 列表。
  // 租户是否仍存在由详情页对应的后端请求判定，不能依赖本地模拟列表。
  let effectivePage = page;
  const isChildPage = page in CHILD_PAGES;
  if (isChildPage && !detailCtx?.tenantId) effectivePage = 'tenants';
  const PageComp = PAGES[effectivePage] || MonitorPage;
  // 侧边栏高亮:子页归属父项
  const activeNavId = CHILD_PAGES[effectivePage] || effectivePage;
  // 子页需要额外注入 ctx + 导航函数
  const pageProps = (effectivePage in CHILD_PAGES)
    ? { ...commonProps, ctx: detailCtx, navigate, updateDetailCtx }
    : commonProps;

  // Not signed in → render the auth SPA and skip the whole app shell.
  // The auth page still respects theme/accent/lang because those are set on
  // <html>/CSS variables above and via LangProvider around this component.
  if (authState === 'checking') {
    return <BrandLoading />;
  }
  if (authState === 'anonymous') {
    return <AuthPage
      onLogin={login}
      authView={route.params.authView || 'login'}
      onAuthViewChange={(v) => window.ociRouter.go('auth', { authView: v })} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Sidebar
        activePage={activeNavId}
        onNavigate={navigate}
        collapsed={tweaks.sidebarCollapsed} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          theme={tweaks.theme}
          onChangeTheme={(v) => setTweak('theme', v)}
          lang={lang}
          onToggleLang={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          collapsed={tweaks.sidebarCollapsed}
          onToggleCollapse={() => setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed)}
          accent={
            typeof tweaks.accent === 'string' && ACCENT_PRESETS[tweaks.accent] ? tweaks.accent :
            (tweaks.accent && (tweaks.accent.value || tweaks.accent.key)) || 'green'
          }
          onChangeAccent={(k) => setTweak('accent', k)}
          density={tweaks.density}
          onToggleDensity={() => setTweak('density', tweaks.density === 'compact' ? 'comfortable' : 'compact')}
          currentTime={now} />
        
        <main style={{
          flex: 1,
          padding: "16px",
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          <div key={effectivePage} data-screen-label={labelFor(effectivePage)} className="page-anim" style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}>
            <PageComp {...pageProps} />
          </div>
        </main>
      </div>

      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title={tr('tw.section.language')}>
          <TweakRadio
            label={tr('tw.lang')}
            value={lang}
            onChange={(v) => setLang(v)}
            options={[
            { value: 'zh', label: tr('tw.lang.zh') },
            { value: 'en', label: tr('tw.lang.en') }]
            } />
          
        </TweakSection>

        <TweakSection title={tr('tw.section.theme')}>
          <TweakRadio
            label={tr('tw.mode')}
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
            { value: 'dark', label: tr('tw.mode.dark') },
            { value: 'light', label: tr('tw.mode.light') },
            { value: 'system', label: tr('theme.system') }]
            } />
          
          {(() => {
            // TweakColor 只支持"色值字符串" or "色值字符串数组"两种 option 形态
            // 所以我们:options 传色值字符串;value 用当前 preset 对应的色值字符串;onChange 时反查回 preset key
            const colorOf = (k) => `oklch(0.72 0.16 ${ACCENT_PRESETS[k].hue})`;
            const accentOptions = Object.keys(ACCENT_PRESETS).map(colorOf);
            // 归一化:把可能是 string/旧对象 的 tweaks.accent 收敛到 preset key
            const currentKey =
              typeof tweaks.accent === 'string' && ACCENT_PRESETS[tweaks.accent] ? tweaks.accent :
              (tweaks.accent && (tweaks.accent.value || tweaks.accent.key)) || 'green';
            const currentColor = colorOf(ACCENT_PRESETS[currentKey] ? currentKey : 'green');
            const colorToKey = Object.fromEntries(Object.keys(ACCENT_PRESETS).map(k => [colorOf(k), k]));
            return (
              <TweakColor
                label={tr('tw.accent')}
                value={currentColor}
                onChange={(v) => setTweak('accent', colorToKey[v] || 'green')}
                options={accentOptions}
              />
            );
          })()}
          
        </TweakSection>

        <TweakSection title={tr('tw.section.layout')}>
          <TweakRadio
            label={tr('tw.density')}
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[
            { value: 'compact', label: tr('tw.density.compact') },
            { value: 'comfortable', label: tr('tw.density.comfortable') }]
            } />
          
          <TweakToggle
            label={tr('tw.sidebarCollapsed')}
            value={tweaks.sidebarCollapsed}
            onChange={(v) => setTweak('sidebarCollapsed', v)} />
          
        </TweakSection>

        <TweakSuggestionBar
          suggestions={[
          tr('tw.suggestion.grabRate'),
          tr('tw.suggestion.usdCost'),
          tr('tw.suggestion.ipSearch'),
          tr('tw.suggestion.grabRateGauge'),
          tr('tw.suggestion.tenantDays')]
          } />
        
      </TweaksPanel>
    </div>);

}

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function labelFor(page) {
  const map = {
    monitor: tr('app.ba76c3'), tenants: tr('app.f0f7e8'),
    'tenant-detail': tr('app.6046be'),
    'tenant-grab': tr('app.2f047d'),
    'tenant-resources': tr('app.73d1f1'),
    instances: tr('app.cd50e3'),
    grab: tr('app.8c19ed'), regions: tr('app.d3d0e3'), logs: tr('app.61eb6d'),
    proxyKeyConfig: tr('app.215666'), cfManage: tr('app.ed4f87'), eoManage: tr('app.4c89a3'),
    resList: tr('app.2451f9'),
    sysIpQuality: tr('app.fe8d16'), sysLogs: tr('app.642fc2'),
    sysSetting: tr('app.b6225b'), sysVpnProxy: tr('app.a57f7d'),
    notifyMgmt: tr('app.4dda7a'), memPage: tr('app.84aae6'),
    migPage: tr('app.2a0005'), mfaBackup: tr('app.0c7c83'),
    keyConfig: tr('app.a10eb8'),
  };
  return map[page] || page;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
