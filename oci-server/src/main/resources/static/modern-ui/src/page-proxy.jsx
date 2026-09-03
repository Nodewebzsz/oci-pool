// Proxy management page — with real actions wired
const { useState: useStateP } = React;

function ProxyPage({ density }) {
  const { t: tr } = useT();
  const shell = useShell();
  const [page, setPage] = useStateP(1);
  const [perPage, setPerPage] = useStateP(10);
  const [menuFor, setMenuFor] = useStateP(null);
  const [rows, setRows] = useStateP([]);
  const [loading, setLoading] = useStateP(true);
  const [error, setError] = useStateP('');

  const mapProxy = React.useCallback((p) => ({
    ...p,
    name: p.customName || p.proxyHost || tr('proxy.unnamed').replace('{id}', p.id),
    type: p.proxyType || 'HTTP',
    host: p.proxyHost || '',
    port: p.proxyPort ?? '',
    tenants: Array.isArray(p.tenantIds) ? p.tenantIds.length : (p.tenantId == null ? 0 : 1),
    status: Number(p.availableStatus) === 1 ? 'healthy' : 'error',
    latency: null,
  }), []);
  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await window.ociServices.proxy.pageList({ pageNum: page, pageSize: perPage });
      if (result && result.success === false) throw new Error(result.message || tr('proxy.load.fail'));
      const pageData = result?.data || result || {};
      setRows((pageData?.content || []).map(mapProxy));
      setTotal(pageData?.totalElements ?? (pageData?.content || []).length);
    } catch (e) { setRows([]); setTotal(0); setError(e.message || tr('proxy.load.fail')); }
    finally { setLoading(false); }
  }, [page, perPage, mapProxy]);
  const [total, setTotal] = useStateP(0);
  React.useEffect(() => { load(); }, [load]);

  const editProxy = useProxyEditModal(load);
  const testAll   = useProxyTestAllModal(load);
  const testOne   = useProxyTestOneAction(load);

  const rowAction = (id, proxy) => {
    switch (id) {
      case 'test': return testOne(proxy);
      case 'edit': return editProxy(proxy);
      case 'delete':
        return shell.openConfirm({
          title: tr('proxy.delete.title').replace('{name}', proxy.name),
          body: <div>{tr('proxy.delete.body')}</div>,
          danger: true,
          confirmLabel: tr('common.delete'),
          onConfirm: async () => {
            try {
              const result = await window.ociServices.proxy.remove({ id: proxy.id });
              if (result && result.success === false) throw new Error(result.message || tr('proxy.delete.fail'));
              await load(); shell.showToast(tr('proxy.deleted').replace('{name}', proxy.name), { kind: 'warn' });
            }
            catch (e) { shell.showToast(e.message || tr('proxy.delete.fail'), { kind: 'error' }); }
          },
        });
      case 'toggle':
        return (async () => {
          try {
            const result = await window.ociServices.proxy.saveOrUpdate({
              id: proxy.id,
              proxyType: proxy.proxyType,
              proxyHost: proxy.proxyHost,
              proxyPort: proxy.proxyPort,
              proxyUsername: proxy.proxyUsername,
              proxyPassword: proxy.proxyPassword,
              availableStatus: Number(proxy.availableStatus) === 1 ? 0 : 1,
              forceProxy: proxy.forceProxy,
              tenantIds: proxy.tenantIds || (proxy.tenantId == null ? [] : [proxy.tenantId]),
              customName: proxy.customName,
            });
            if (result && result.success === false) throw new Error(result.message || tr('proxy.status.fail'));
            await load(); shell.showToast(tr('proxy.status.toggled').replace('{name}', proxy.name), { kind: 'info' });
          } catch (e) { shell.showToast(e.message || tr('proxy.status.fail'), { kind: 'error' }); }
        })();
      case 'copy':
        if (navigator.clipboard) navigator.clipboard.writeText(`${getProxyType(proxy).toLowerCase()}://${getProxyHost(proxy)}:${getProxyPort(proxy)}`);
        return shell.showToast(tr('proxy.urlCopied'), { kind: 'success' });
    }
  };

  const columns = [
    { key: 'name', label: tr('proxy.col.name'),
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={r.status} size={7} pulse={r.status === 'healthy'} />
          <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{r.name}</span>
        </span>
      ),
    },
    { key: 'type', label: tr('proxy.col.type'),
      render: r => (
        <span style={{
          padding: '1px 6px',
          background: r.type === 'SOCKS5' ? 'var(--accent-soft)' : 'var(--info-soft)',
          color: r.type === 'SOCKS5' ? 'var(--accent)' : 'var(--info)',
          borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        }}>{r.type}</span>
      ),
    },
    { key: 'endpoint', label: tr('proxy.col.endpoint'),
      render: r => <span className="mono" style={{ color: 'var(--cyan)' }}>{getProxyHost(r)}:{getProxyPort(r)}</span>,
    },
    { key: 'tenants', label: tr('proxy.col.tenants'), align: 'right',
      render: r => <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{r.tenants}</span>,
    },
    { key: 'latency', label: tr('proxy.col.latency'), align: 'right',
      render: r => (
        <span className="num" style={{
          color: r.latency == null ? 'var(--fg-3)' : r.latency < 100 ? 'var(--accent)' : r.latency < 200 ? 'var(--orange)' : 'var(--danger)',
          fontWeight: 600,
        }}>{r.latency == null ? '—' : r.latency}</span>
      ),
    },
    { key: 'status', label: tr('common.status'),
      render: r => <StatusPill status={r.status} label={tr('status.' + r.status)} />,
    },
    { key: 'actions', label: tr('common.operation'), width: 100, align: 'center',
      render: r => {
        const isOpen = menuFor?.proxy === r;
        return (
          <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
            <IconButton icon="wifi" tooltip={tr('proxy.action.test')} onClick={() => testOne(r)} />
            <IconButton icon="edit" tooltip={tr('common.edit')} onClick={() => editProxy(r)} />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (isOpen) { setMenuFor(null); return; }
                setMenuFor({ proxy: r, anchorEl: e.currentTarget });
              }}
              style={{
                width: 28, height: 28, borderRadius: 4,
                background: isOpen ? 'var(--accent)' : 'var(--bg-2)',
                border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--border)'),
                color: isOpen ? 'var(--accent-fg)' : 'var(--fg-1)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 100ms',
              }}
              title={tr("proxy.more")}
            >
              <Icon name="more-horizontal" size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  // 5 项操作(与老菜单一致 · 分节头部改为 header + 单一 items 列表)
  const menuItems = menuFor && [
    { id: 'test',   label: tr('proxy.menu.test'),    icon: 'wifi'         },
    { id: 'copy',   label: tr('proxy.menu.copy'),  icon: 'copy',          color: 'var(--info)' },
    { id: 'toggle', label: tr('proxy.menu.toggle'),   icon: 'toggle-right' },
    { id: 'edit',   label: tr('common.edit'),          icon: 'edit'         },
    { id: 'delete', label: tr('common.delete'),          icon: 'trash-2',       color: 'var(--danger)' },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <PageHeader
        title={tr('proxy.title')}
        subtitle={tr('proxy.subtitle')}
        icon="shuffle"
        iconColor="var(--cyan)"
        actions={
          <>
            <Button variant="outline" size="md" icon="wifi" onClick={testAll}>{tr('proxy.action.test')}</Button>
            <Button variant="primary" size="md" icon="plus" onClick={() => editProxy(null)}>{tr('proxy.action.create')}</Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <KPICard label={tr("proxy.kpi.total")} value={total} icon="shuffle" iconColor="var(--cyan)" />
        <KPICard label={tr("proxy.kpi.healthy")} value={rows.filter(p => p.status === 'healthy').length} icon="check-circle-2" iconColor="var(--accent)" />
        <KPICard label={tr("proxy.kpi.latency")} value="—" icon="gauge" iconColor="var(--orange)" />
        <KPICard label={tr("proxy.kpi.tenants")} value={rows.reduce((s, p) => s + (p.tenants || 0), 0)} icon="users" iconColor="var(--info)" />
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('proxy.loading')}</div> : error ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div> : rows.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('proxy.empty')}</div> : <Table columns={columns} rows={rows} density={density} />}
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination
            total={total}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={n => { setPerPage(n); setPage(1); }}
            t={tr}
          />
        </div>
      </div>

      {menuFor && (
        <RowActionMenu
          anchorEl={menuFor.anchorEl}
          header={
            <>
              <StatusDot status={menuFor.proxy.status} size={5} pulse={menuFor.proxy.status === 'healthy'} />
              <span className="mono" style={{
                padding: '1px 6px', borderRadius: 3,
                background: 'var(--bg-3)', color: 'var(--fg-0)',
                fontSize: 11, fontWeight: 500,
              }}>{menuFor.proxy.name}</span>
              <span style={{ color: 'var(--fg-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getProxyHost(menuFor.proxy)}:{getProxyPort(menuFor.proxy)}
              </span>
            </>
          }
          items={menuItems}
          columns={1}
          width={220}
          onClose={() => setMenuFor(null)}
          onAction={(id) => rowAction(id, menuFor.proxy)}
        />
      )}
    </div>
  );
}

// ─── 1. 秘钥配置 (API Token) ──────────────────────────
// 严格对齐原项目 api_token_config.ftl · 平台自身 REST API 的 Bearer Token 管理
// 4 张卡:Token 状态 · Token 配置 · API 文档访问 · API 使用说明
function KeyConfigPage() {
  const { t: tr } = useT();
  const shell = useShell();

  // ─── Token 配置 state (对应 apiTokenConfig) ───
  const [cfg, setCfg] = React.useState({ tokenName: '', expirationDays: 30, description: '', allowSwaggerAccess: true });

  // ─── Token 状态 (对应 tokenStatus + apiTokenConfig.tokenValue) ───
  const [tokenStatus, setTokenStatus] = React.useState({ enabled: false, hasToken: false, tokenName: '', generatedAt: '', expiresAt: '', daysUntilExpiration: 0, description: '', tokenValue: '', allowSwaggerAccess: true });

  const [showToken, setShowToken] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const hydrateToken = React.useCallback((payload) => {
    const d = payload?.data || payload || {};
    const c = d.config || d;
    const s = d.status || d;
    setCfg({ tokenName: c.tokenName || s.tokenName || '', expirationDays: Number(c.expirationDays ?? 30), description: c.description || s.description || '', allowSwaggerAccess: c.allowSwaggerAccess ?? s.allowSwaggerAccess ?? true });
    setTokenStatus({ enabled: !!(s.enabled ?? c.enabled), hasToken: !!(s.hasToken ?? c.tokenValue), tokenName: s.tokenName || c.tokenName || '', generatedAt: s.createdAt || c.createdAt || '', expiresAt: s.expiresAt || c.expiresAt || '', daysUntilExpiration: Number(s.daysUntilExpiration ?? 0), description: s.description || c.description || '', tokenValue: c.tokenValue || '', allowSwaggerAccess: s.allowSwaggerAccess ?? c.allowSwaggerAccess ?? true });
  }, []);
  React.useEffect(() => {
    let alive = true;
    window.ociServices.token.configs().then(data => { if (alive) hydrateToken(data); }).catch(() => {});
    return () => { alive = false; };
  }, [hydrateToken]);

  // ─── actions ───
  const copyToken = () => {
    if (!tokenStatus.tokenValue) { shell.showToast(tr('token.missing'), { kind: 'warn' }); return; }
    navigator.clipboard.writeText(tokenStatus.tokenValue);
    shell.showToast(tr('token.copied'), { kind: 'success', duration: 1500 });
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    shell.showToast(tr('token.copiedLabel').replace('{label}', label), { kind: 'info', duration: 1500 });
  };

  const generateToken = () => {
    if (!cfg.tokenName.trim()) { shell.showToast(tr('token.nameRequired'), { kind: 'warn' }); return; }
    shell.openConfirm({
      title: tr('token.generate.title'),
      body: <div style={{ color: 'var(--fg-1)', lineHeight: 1.6 }}>
        {tr('token.generate.body1')}
        {tr('token.generate.body2')}
      </div>,
      danger: false,
      confirmText: tr('token.generate.confirm'),
      onConfirm: async () => {
        setGenerating(true);
        try { const data = await window.ociServices.token.generate({ ...cfg, enabled: true }); hydrateToken(data); setShowToken(true); shell.showToast(tr('token.generated'), { kind: 'success', duration: 3000 }); }
        catch (e) { shell.showToast(e.message || tr('token.generate.fail'), { kind: 'error' }); }
        finally { setGenerating(false); }
      },
    });
  };

  const revokeToken = () => {
    if (!tokenStatus.enabled) { shell.showToast(tr('token.notEnabled'), { kind: 'warn' }); return; }
    shell.openConfirm({
      title: tr('token.revoke.title'),
      body: <div style={{ color: 'var(--fg-1)', lineHeight: 1.6 }}>
        {tr('token.revoke.body1')}
        {tr('token.revoke.body2')}
      </div>,
      danger: true,
      requireText: tokenStatus.tokenName,
      confirmText: tr('token.revoke.confirm'),
      onConfirm: async () => {
        try { await window.ociServices.token.revoke(); setTokenStatus(s => ({ ...s, enabled: false, hasToken: false, tokenValue: '' })); shell.showToast(tr('token.revoked').replace('{name}', tokenStatus.tokenName), { kind: 'warn' }); }
        catch (e) { shell.showToast(e.message || tr('token.revoke.fail'), { kind: 'error' }); }
      },
    });
  };

  // ─── 派生:剩余天数颜色警示 ───
  const daysColor = tokenStatus.daysUntilExpiration < 7 ? 'var(--danger)'
                  : tokenStatus.daysUntilExpiration < 30 ? 'var(--orange)'
                  : 'var(--fg-0)';

  // ─── 页面 ───
  return (
    <>
      <PageHeader
        icon="key"
        iconColor="var(--accent)"
        title={tr("token.title")}
        subtitle={tr("token.subtitle")}
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14,
        alignContent: 'start',
      }}>
        {/* ─── 卡 1:Token 状态 ─── */}
        <SettingsCard
          title={tr("token.status.title")}
          icon="info"
          iconColor="var(--info)"
          actions={
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 10,
              background: tokenStatus.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: tokenStatus.enabled ? 'var(--accent)' : 'var(--fg-3)',
              fontSize: 10.5, fontWeight: 600,
              border: '1px solid ' + (tokenStatus.enabled ? 'var(--accent)' : 'var(--border)'),
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: tokenStatus.enabled ? 'var(--accent)' : 'var(--fg-3)',
                animation: tokenStatus.enabled ? 'pulse-dot 2s infinite' : 'none',
              }} />
              {tokenStatus.enabled ? tr('token.enabled') : tr('token.disabled')}
            </span>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <TokenInfoItem label={tr("token.info.name")} value={tokenStatus.tokenName || tr("token.unset")} />
            <TokenInfoItem label={tr("token.info.status")} value={tokenStatus.hasToken ? tr("token.generatedStatus") : tr("token.notGenerated")} />
            {!tokenStatus.hasToken && (
              <div style={{ gridColumn: '1 / -1', marginTop: 6, padding: '10px 12px', background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>
                {tr('token.empty')}
              </div>
            )}
            {tokenStatus.hasToken && (
              <>
                <TokenInfoItem label={tr("token.info.generatedAt")} value={tokenStatus.generatedAt} mono />
                <TokenInfoItem label={tr("token.info.expiresAt")} value={tokenStatus.expiresAt} mono />
                <TokenInfoItem label={tr("token.info.daysLeft")} value={
                  <span className="num" style={{ color: daysColor, fontWeight: 600 }}>
                    {tr('token.days').replace('{n}', tokenStatus.daysUntilExpiration)}
                  </span>
                } />
                <TokenInfoItem label={tr("token.info.desc")} value={tokenStatus.description || tr("token.none")} span={2} />

                {/* {tr('token.current')} 展示 · 只在 enabled 时显示 */}
                {tokenStatus.enabled && (
                  <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                      {tr('token.current')}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input type={showToken ? 'text' : 'password'}
                        value={tokenStatus.tokenValue} readOnly
                        style={{
                          width: '100%', padding: '8px 74px 8px 12px',
                          background: 'var(--bg-2)', color: 'var(--accent)',
                          border: '1px solid var(--border)', borderRadius: 4,
                          fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                          letterSpacing: 0.5,
                        }} />
                      <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', gap: 2 }}>
                        <button type="button" onClick={() => setShowToken(!showToken)} title={showToken ? tr('common.hide') : tr('common.show')}
                          style={{ width: 28, height: 28, padding: 0, background: 'transparent', color: 'var(--fg-2)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={showToken ? 'eye-off' : 'eye'} size={13} />
                        </button>
                        <button type="button" onClick={copyToken} title={tr("common.copy")}
                          style={{ width: 28, height: 28, padding: 0, background: 'transparent', color: 'var(--fg-2)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="copy" size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SettingsCard>

        {/* ─── 卡 2:Token 配置 ─── */}
        <SettingsCard
          title={tr("token.title")}
          icon="settings"
          iconColor="var(--cyan)"
          footer={
            <>
              <Button variant="danger_soft" size="md" icon="x-circle" onClick={revokeToken} disabled={!tokenStatus.enabled}>
                {tr('token.revoke.action')}
              </Button>
              <Button variant="primary" size="md" icon={generating ? 'loader' : 'key'} onClick={generateToken} disabled={generating || !cfg.tokenName.trim()}>
                {generating ? tr('token.generating') : tr('token.generate.action')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormRow label={tr("token.form.name")} required>
              <TextInput value={cfg.tokenName}
                onChange={v => setCfg(c => ({ ...c, tokenName: v }))}
                placeholder={tr("token.form.namePh")} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                {tr('token.form.nameHint')}
              </div>
            </FormRow>
            <FormRow label={tr("token.form.expiry")} required>
              <CustomDropdown value={String(cfg.expirationDays)}
                onChange={v => setCfg(c => ({ ...c, expirationDays: +v }))}
                height={32} width="100%">
                <option value="7">{tr('token.form.expiryDays').replace('{n}', 7)}</option>
                <option value="30">{tr('token.form.expiryDays').replace('{n}', 30)}</option>
                <option value="90">{tr('token.form.expiryDays').replace('{n}', 90)}</option>
                <option value="180">{tr('token.form.expiryDays').replace('{n}', 180)}</option>
                <option value="365">{tr('token.form.expiryDays').replace('{n}', 365)}</option>
              </CustomDropdown>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                {tr('token.form.expiryHint')}
              </div>
            </FormRow>
            <FormRow label={tr('token.form.desc')}>
              <textarea value={cfg.description}
                onChange={e => setCfg(c => ({ ...c, description: e.target.value }))}
                rows={3}
                placeholder={tr('token.form.descPh')}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--bg-2)', color: 'var(--fg-0)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  fontSize: 12, fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical', minHeight: 64,
                }} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                {tr('token.form.descHint')}
              </div>
            </FormRow>
          </div>
        </SettingsCard>

        {/* ─── 卡 3:API 文档访问 ─── */}
        <SettingsCard
          title={tr('token.apiDoc.title')}
          icon="book-open"
          iconColor="var(--violet)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ApiDocLink
              title="Swagger UI"
              subtitle={tr('token.apiDoc.subtitle')}
              url="/swagger-ui/index.html"
              icon="layout"
              color="var(--violet)"
              onOpen={() => shell.showToast(tr('token.apiDoc.openSwagger'), { kind: 'info' })}
            />
            <ApiDocLink
              title="OpenAPI JSON"
              subtitle={tr('token.apiDoc.subtitle2')}
              url="/v3/api-docs"
              icon="code"
              color="var(--info)"
              onOpen={() => shell.showToast(tr('token.apiDoc.openOpenapi'), { kind: 'info' })}
            />
          </div>
          <div style={{
            marginTop: 12, padding: 10,
            background: 'var(--info-soft)', color: 'var(--info)',
            border: '1px solid var(--info)', borderRadius: 4,
            fontSize: 11, lineHeight: 1.6,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Icon name="info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                {tr('token.apiDoc.notice')}
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* ─── 卡 4:API 使用说明 ─── */}
        <SettingsCard
          title={tr('token.usage.title')}
          icon="terminal"
          iconColor="var(--orange)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.6 }}>
              {tr('token.usage.desc')}
            </div>

            {/* code 示例 · 单行 */}
            <div style={{ position: 'relative' }}>
              <pre style={{
                margin: 0, padding: '12px 44px 12px 14px',
                background: '#0f1419', color: '#a2d2ff',
                border: '1px solid var(--border)', borderRadius: 4,
                fontSize: 12, fontFamily: 'var(--font-mono)',
                overflow: 'auto', lineHeight: 1.5,
              }}>
                <span style={{ color: '#c792ea' }}>Authorization: </span>
                <span style={{ color: '#82aaff' }}>Bearer </span>
                <span style={{ color: '#f78c6c' }}>{'{your_token}'}</span>
              </pre>
              <button type="button"
                onClick={() => copyText('Authorization: Bearer {your_token}', tr('token.usage.copyLabel'))}
                title={tr("common.copy")}
                style={{
                  position: 'absolute', right: 6, top: 6,
                  width: 28, height: 28, padding: 0,
                  background: 'transparent', color: 'var(--fg-2)',
                  border: 'none', cursor: 'pointer', borderRadius: 3,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Icon name="copy" size={13} />
              </button>
            </div>

            <div style={{
              padding: 10,
              background: 'var(--bg-2)', color: 'var(--fg-2)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 11, lineHeight: 1.65,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4 }}>{tr('token.usage.security')}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{tr('token.usage.li1')}</li>
                <li>{tr('token.usage.li2')}</li>
                <li>{tr('token.usage.li3')} <span className="mono" style={{ color: 'var(--danger)' }}>401</span></li>
              </ul>
            </div>
          </div>
        </SettingsCard>
      </div>
    </>
  );
}

// ─── 内部组件:Token 信息项 ───
function TokenInfoItem({ label, value, mono, span }) {
  return (
    <div style={{
      gridColumn: span === 2 ? '1 / -1' : 'auto',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{
        fontSize: mono ? 11.5 : 12,
        color: typeof value === 'string' ? 'var(--fg-0)' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── 内部组件:表单行 ───
function FormRow({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11.5, fontWeight: 500, color: 'var(--fg-1)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── 内部组件:API 文档链接卡 ───
function ApiDocLink({ title, subtitle, url, icon, color, onOpen }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'var(--bg-2)', color: 'var(--fg-0)',
        border: '1px solid var(--border)', borderRadius: 4,
        textDecoration: 'none', cursor: 'pointer',
        transition: 'border-color 100ms, background 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--bg-3)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 5,
        background: 'color-mix(in oklab, ' + color + ' 20%, transparent)',
        color: color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>{subtitle}</div>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', flexShrink: 0 }}>{url}</div>
      <Icon name="external-link" size={13} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
    </a>
  );
}

// 通用组件:带 眼睛 + 复制 的敏感输入框
// ⚠ 定义在外部,不能内嵌到父组件 —— 内嵌会让 input 每次 render 都重挂 → 焦点丢失
function SecretInputExternal({ value, onChange, show, onToggleShow, placeholder, onCopy }) {
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '8px 66px 8px 12px',
          background: 'var(--bg-2)',
          color: 'var(--fg-0)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          outline: 'none',
        }} />
      <div style={{
        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
        display: 'inline-flex', gap: 2,
      }}>
        <button type="button" onClick={onToggleShow} tabIndex={-1}
          title={show ? tr('common.hide') : tr('common.show')}
          style={{ width: 26, height: 26, padding: 0, background: 'transparent', color: 'var(--fg-2)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={show ? 'eye-off' : 'eye'} size={13} />
        </button>
        <button type="button" onClick={() => onCopy?.(value)} tabIndex={-1}
          title={tr("common.copy")}
          style={{ width: 26, height: 26, padding: 0, background: 'transparent', color: 'var(--fg-2)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="copy" size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── 1b. 代理秘钥配置(域名服务商配置)─────────────────────
// 挂在"代理管理"分组下 · Cloudflare + 腾讯云 EdgeOne 双卡
// 保留原有实现,只改名 KeyConfigPage → ProxyKeyConfigPage
function ProxyKeyConfigPage() {
  const { t: tr } = useT();
  const shell = useShell();

  // ─── Cloudflare 配置 ───
  const [cf, setCf] = React.useState({
    enabled: false,
    connected: false,
    apiKey: '',
    zoneId: '',
    email: '',
    showApiKey: false,
  });
  const [cfTesting, setCfTesting] = React.useState(false);

  // ─── 腾讯云 EdgeOne 配置 ───
  const [eo, setEo] = React.useState({
    enabled: false,
    connected: false,
    secretId: '',
    secretKey: '',
    region: '',
    showSecretId: false,
    showSecretKey: false,
  });
  const [eoTesting, setEoTesting] = React.useState(false);
  const [configLoading, setConfigLoading] = React.useState(true);
  const [configError, setConfigError] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    setConfigLoading(true);
    setConfigError('');
    window.ociServices.system.domainProviderConfigs().then(result => {
      if (!alive) return;
      if (result && result.success === false) throw new Error(result.message || tr('dnsp.load.fail'));
      const d = result?.data || result || {};
      const c = d.cloudflare || {};
      const e = d.edgeOne || d.edgeone || {};
      setCf(v => ({ ...v, enabled: !!c.enabled, connected: !!c.enabled, apiKey: c.apiToken || '', zoneId: c.zoneId || '', email: c.email || '' }));
      setEo(v => ({ ...v, enabled: !!e.enabled, connected: !!e.enabled, secretId: e.secretId || '', secretKey: e.secretKey || '', region: e.region || '' }));
    }).catch(e => {
      if (alive) setConfigError(e.message || tr('dnsp.load.fail'));
    }).finally(() => {
      if (alive) setConfigLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const copy = (text, label) => {
    if (!text) { shell.showToast(tr('dnsp.copy.empty'), { kind: 'warn' }); return; }
    navigator.clipboard.writeText(text);
    shell.showToast(tr('dnsp.copied') + (label ? ' · ' + label : ''), { kind: 'info', duration: 1500 });
  };

  const testCf = async () => {
    if (!cf.apiKey.trim() || !cf.email.trim()) { shell.showToast(tr('dnsp.cf.fill'), { kind: 'warn' }); return; }
    setCfTesting(true);
    try {
      const result = await window.ociServices.system.testCloudflareConnection(cf);
      const ok = !!(result?.success ?? result?.data?.success);
      setCf(c => ({ ...c, connected: ok, enabled: ok ? true : c.enabled }));
      if (ok) {
        window.ociServices.system.updateCloudflareConfig({ ...cf, enabled: true }).catch(() => {});
      }
      shell.showToast(ok ? tr('dnsp.cf.testOk') : tr('dnsp.cf.testFail'), { kind: ok ? 'success' : 'error' });
    }
    catch (e) { setCf(c => ({ ...c, connected: false })); shell.showToast(e.message || tr('dnsp.cf.testFail'), { kind: 'error' }); }
    finally { setCfTesting(false); }
  };
  const saveCf = async () => {
    if (!cf.apiKey.trim() || !cf.email.trim()) { shell.showToast(tr('dnsp.cf.fill'), { kind: 'warn' }); return; }
    try { await window.ociServices.system.updateCloudflareConfig(cf); shell.showToast(tr('dnsp.cf.saved'), { kind: 'success' }); }
    catch (e) { shell.showToast(e.message || tr('proxy.save.fail'), { kind: 'error' }); }
  };
  const testEo = async () => {
    if (!eo.secretId.trim() || !eo.secretKey.trim()) { shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' }); return; }
    setEoTesting(true);
    try {
      const result = await window.ociServices.system.testEdgeOneConnection(eo);
      const ok = !!(result?.success ?? result?.data?.success);
      setEo(e => ({ ...e, connected: ok, enabled: ok ? true : e.enabled }));
      if (ok) {
        window.ociServices.system.updateEdgeOneConfig({ ...eo, enabled: true }).catch(() => {});
      }
      shell.showToast(ok ? tr('dnsp.eo.testOk') : tr('dnsp.eo.testFail'), { kind: ok ? 'success' : 'error' });
    }
    catch (e) { setEo(v => ({ ...v, connected: false })); shell.showToast(e.message || tr('dnsp.eo.testFail'), { kind: 'error' }); }
    finally { setEoTesting(false); }
  };
  const saveEo = async () => {
    if (!eo.secretId.trim() || !eo.secretKey.trim()) { shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' }); return; }
    try { await window.ociServices.system.updateEdgeOneConfig(eo); shell.showToast(tr('dnsp.eo.saved'), { kind: 'success' }); }
    catch (e) { shell.showToast(e.message || tr('proxy.save.fail'), { kind: 'error' }); }
  };

  // SecretInput / ProviderHeader 已提取到外部(见文件下方)
  // 避免在父组件内嵌导致 input 每次 render 都重挂 → 密码框刚点击就失焦

  // ─── 服务商卡片头部(标题 + 连接状态徽章 + 启用开关) ───
  const ProviderHeader = ({ icon, iconColor, name, connected, enabled, onToggle }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-2)',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 5,
        background: `color-mix(in oklab, ${iconColor} 22%, transparent)`,
        color: iconColor,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={14} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{name}</span>
      {/* 连接状态徽章 */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 10,
        background: connected ? 'var(--accent-soft)' : 'var(--danger-soft)',
        color: connected ? 'var(--accent)' : 'var(--danger)',
        fontSize: 10.5, fontWeight: 600,
        border: '1px solid ' + (connected ? 'var(--accent)' : 'var(--danger)'),
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: connected ? 'var(--accent)' : 'var(--danger)' }} />
        {connected ? tr('dnsp.connected') : tr('dnsp.disconnected')}
      </span>
      <div style={{ flex: 1 }} />
      {/* 启用开关 */}
      <label style={{
        position: 'relative', display: 'inline-block',
        width: 36, height: 20, cursor: 'pointer', flexShrink: 0,
      }}>
        <input type="checkbox" checked={enabled} onChange={onToggle}
          style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
          position: 'absolute', inset: 0,
          background: enabled ? 'var(--accent)' : 'var(--bg-3)',
          borderRadius: 10, transition: 'background 200ms',
        }} />
        <span style={{
          position: 'absolute',
          left: enabled ? 18 : 2, top: 2,
          width: 16, height: 16, borderRadius: '50%',
          background: 'white',
          transition: 'left 200ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </label>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.keyConfig')}
        subtitle={tr('dnsp.subtitle')}
        icon="key"
        iconColor="var(--orange)"
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {configLoading && <div style={{ padding: '10px 12px', marginBottom: 10, border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-2)', fontSize: 12 }}>{tr('dnsp.loading')}</div>}
        {configError && <div role="alert" style={{ padding: '10px 12px', marginBottom: 10, border: '1px solid var(--danger)', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12 }}>{configError}</div>}
        {/* ─── 域名服务商配置 · 分组容器 ─── */}
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 14,
            fontSize: 13, fontWeight: 600, color: 'var(--fg-0)',
          }}>
            <Icon name="globe" size={14} style={{ color: 'var(--info)' }} />
            {tr('dnsp.title')}
          </div>

          {/* 3 卡并排:CF + EO + 占位 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {/* ─── Cloudflare 卡 ─── */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden',
              opacity: cf.enabled ? 1 : 0.6,
              transition: 'opacity 200ms',
            }}>
              <ProviderHeader
                icon="cloud" iconColor="var(--orange)"
                name={tr('dnsp.cf.name')}
                connected={cf.enabled && cf.connected}
                enabled={cf.enabled}
                onToggle={e => { const enabled = e.target.checked; setCf(c => ({ ...c, enabled })); window.ociServices.system.updateCloudflareConfig({ ...cf, enabled }).catch(err => { setCf(c => ({ ...c, enabled: !enabled })); shell.showToast(err.message || tr('dnsp.statusSaveFail'), { kind: 'error' }); }); }}
              />
              <div style={{ padding: 14 }}>
                {/* API Key */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                    <span>API Key</span>
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <SecretInputExternal
                    value={cf.apiKey}
                    onChange={v => setCf(c => ({ ...c, apiKey: v }))}
                    show={cf.showApiKey}
                    onToggleShow={() => setCf(c => ({ ...c, showApiKey: !c.showApiKey }))}
                    placeholder={tr('dnsp.cf.keyPh')}
                   onCopy={copy} />
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 5 }}>
                    {tr('dnsp.cf.keyHint')}
                  </div>
                </div>
                {/* 邮箱地址 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                    <span>{tr('dnsp.email')}</span>
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <input type="email" value={cf.email}
                    onChange={e => setCf(c => ({ ...c, email: e.target.value }))}
                    placeholder="your@email.com"
                    style={{
                      width: '100%', padding: '8px 12px',
                      background: 'var(--bg-1)', color: 'var(--fg-0)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      fontSize: 12, fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }} />
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 5 }}>
                    {tr('dnsp.email.hint')}
                  </div>
                </div>
              </div>
              {/* footer */}
              <div style={{
                padding: '10px 14px', borderTop: '1px solid var(--border)',
                background: 'var(--bg-1)',
                display: 'flex', gap: 8, justifyContent: 'flex-end',
              }}>
                {(() => {
                  const canSubmit = cf.apiKey.trim() && cf.email.trim();
                  return (
                    <>
                      <Button variant="info" size="sm" icon="zap"
                        loading={cfTesting} disabled={!canSubmit}
                        onClick={testCf}>{tr('dnsp.testConn')}</Button>
                      <Button variant="primary" size="sm" icon="save"
                        disabled={!canSubmit}
                        onClick={saveCf}>{tr('dnsp.saveConfig')}</Button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ─── 腾讯云 EdgeOne 卡 ─── */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden',
              opacity: eo.enabled ? 1 : 0.6,
              transition: 'opacity 200ms',
            }}>
              <ProviderHeader
                icon="droplet" iconColor="var(--info)"
                name={tr('dnsp.eo.name')}
                connected={eo.enabled && eo.connected}
                enabled={eo.enabled}
                onToggle={e => { const enabled = e.target.checked; setEo(ee => ({ ...ee, enabled })); window.ociServices.system.updateEdgeOneConfig({ ...eo, enabled }).catch(err => { setEo(ee => ({ ...ee, enabled: !enabled })); shell.showToast(err.message || tr('dnsp.statusSaveFail'), { kind: 'error' }); }); }}
              />
              <div style={{ padding: 14 }}>
                {/* SecretId */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                    <span>SecretId</span>
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <SecretInputExternal
                    value={eo.secretId}
                    onChange={v => setEo(e => ({ ...e, secretId: v }))}
                    show={eo.showSecretId}
                    onToggleShow={() => setEo(e => ({ ...e, showSecretId: !e.showSecretId }))}
                    placeholder={tr('dnsp.eo.idPh')}
                   onCopy={copy} />
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 5 }}>
                    {tr('dnsp.eo.idHint')}
                  </div>
                </div>
                {/* SecretKey */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                    <span>SecretKey</span>
                    <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <SecretInputExternal
                    value={eo.secretKey}
                    onChange={v => setEo(e => ({ ...e, secretKey: v }))}
                    show={eo.showSecretKey}
                    onToggleShow={() => setEo(e => ({ ...e, showSecretKey: !e.showSecretKey }))}
                    placeholder={tr('dnsp.eo.keyPh')}
                   onCopy={copy} />
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 5 }}>
                    {tr('dnsp.eo.keyHint')}
                  </div>
                </div>
              </div>
              {/* footer */}
              <div style={{
                padding: '10px 14px', borderTop: '1px solid var(--border)',
                background: 'var(--bg-1)',
                display: 'flex', gap: 8, justifyContent: 'flex-end',
              }}>
                {(() => {
                  const canSubmit = eo.secretId.trim() && eo.secretKey.trim();
                  return (
                    <>
                      <Button variant="info" size="sm" icon="zap"
                        loading={eoTesting} disabled={!canSubmit}
                        onClick={testEo}>{tr('dnsp.testConn')}</Button>
                      <Button variant="primary" size="sm" icon="save"
                        disabled={!canSubmit}
                        onClick={saveEo}>{tr('dnsp.saveConfig')}</Button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ─── 更多服务商占位卡 ─── */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1.5px dashed var(--border-strong)',
              borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 40,
              minHeight: 340,
              color: 'var(--fg-3)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--bg-3)', color: 'var(--fg-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
                fontSize: 22,
              }}>+</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)' }}>{tr('dnsp.more')}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>{tr('dnsp.comingSoon')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── 2. CF 管理 ─────────────────────────────────────
//   DNS 记录管理:域名选择 + 添加/编辑/删除 · 表格 6 列
function CFManagePage() {
  const { t: tr } = useT();
  const shell = useShell();

  const routeState = window.ociRouter.read();
  const [zones, setZones] = React.useState([]);
  const [zoneId, setZoneId] = React.useState(routeState.query.zoneId || '');
  const currentZone = zones.find(z => z.id === zoneId);
  const [records, setRecords] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const requireSuccess = (result, fallback) => {
    if (result && result.success === false) throw new Error(result.message || fallback);
    return result;
  };
  const loadRecords = React.useCallback(async () => {
    if (!zoneId) { setRecords([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = requireSuccess(await window.ociServices.proxy.cloudflareRecords({ zoneId, page: 1, size: 100 }), tr('dnsp.loadFailRecords'));
      const page = result?.data || {};
      setRecords(Array.isArray(page.content) ? page.content : []);
    } catch (e) { setRecords([]); setError(e.message || tr('dnsp.loadFailRecords')); }
    finally { setLoading(false); }
  }, [zoneId]);
  React.useEffect(() => {
    let alive = true;
    window.ociServices.proxy.cloudflareZones().then(result => {
      if (!alive) return;
      requireSuccess(result, tr('dnsp.zoneLoadFail'));
      const next = Array.isArray(result?.data) ? result.data : [];
      setZones(next);
      if (!next.some(z => String(z.id) === String(zoneId))) {
        const first = next[0] ? String(next[0].id) : '';
        setZoneId(first);
        window.ociRouter.go('cfManage', first ? { zoneId: first } : {}, { replace: true });
      }
    }).catch(e => { if (alive) { setZones([]); setError(e.message || tr('dnsp.zoneLoadFail')); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => { loadRecords(); }, [loadRecords]);

  const [searchName, setSearchName] = React.useState('');
  const [searchContent, setSearchContent] = React.useState('');
  const filtered = records.filter(r =>
    (!searchName || r.name.toLowerCase().includes(searchName.toLowerCase())) &&
    (!searchContent || r.content.toLowerCase().includes(searchContent.toLowerCase()))
  );

  const typeColor = {
    A:     'var(--info)',
    AAAA:  'var(--cyan)',
    CNAME: 'var(--accent)',
    MX:    'var(--orange)',
    TXT:   'var(--fg-2)',
    NS:    'var(--violet)',
  };
  const ttlLabel = (ttl) => ttl === 1 ? tr('dnsp.auto') : ttl >= 3600 ? tr('dnsp.hours').replace('{n}', ttl/3600) : ttl >= 60 ? tr('dnsp.minutes').replace('{n}', ttl/60) : tr('dnsp.seconds').replace('{n}', ttl);

  const openConfigModal = () => window.__ocipNavigate('proxyKeyConfig');

  const openDnsModal = (existing) => {
    const isEdit = !!existing;
    const s2 = existing
      ? { ...existing }
      : { type: 'A', name: '', content: '', ttl: 300, proxied: true, priority: 10 };
    const paint = () => shell.openModal({
      title: isEdit ? tr('dnsp.editRecord') : tr('dnsp.addDnsRecord'),
      subtitle: currentZone ? tr('dnsp.zone') + ' ' + currentZone.name : '',
      icon: isEdit ? 'edit' : 'plus',
      iconColor: isEdit ? 'var(--info)' : 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          {/* 类型 · 编辑时 readonly · 严格 5 类 A-IPv4/AAAA-IPv6/CNAME/MX/TXT */}
          <FormRow label={tr('dnsp.recordType')} required>
            {isEdit ? (
              <div style={{ padding: '7px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                {{ A: 'A-IPv4', AAAA: 'AAAA-IPv6' }[s2.type] || s2.type}
              </div>
            ) : (
              <CustomDropdown value={s2.type} onChange={e => { s2.type = e; paint(); }} height={32} width="100%">
                <option value="A">A-IPv4</option>
                <option value="AAAA">AAAA-IPv6</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="TXT">TXT</option>
              </CustomDropdown>
            )}
          </FormRow>
          {/* 名称 · 编辑时 readonly */}
          <FormRow label={tr('dnsp.recordName')} required hint={isEdit ? '' : tr('dnsp.nameHint')}>
            {isEdit ? (
              <div style={{ padding: '7px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>
                {s2.name}
              </div>
            ) : (
              <TextInput value={s2.name} onChange={v => { s2.name = v; paint(); }} placeholder="@, www, mail" mono />
            )}
          </FormRow>
          <FormRow label={s2.type === 'CNAME' ? tr('dnsp.targetDomain') : s2.type === 'MX' ? tr('dnsp.mailServer') : s2.type === 'TXT' ? tr('dnsp.txtContent') : tr('dnsp.ipAddress')} required>
            <TextInput value={s2.content} onChange={v => { s2.content = v; paint(); }}
              placeholder={s2.type === 'CNAME' ? 'target.example.com' : s2.type === 'A' ? '192.0.2.1' : s2.type === 'AAAA' ? '2001:db8::1' : s2.type === 'MX' ? 'mail.example.com' : 'v=spf1 include:_spf.example.com ~all'}
              mono />
          </FormRow>
          {s2.type === 'MX' && (
            <FormRow label={tr('dnsp.priority')} required>
              <NumberInput value={s2.priority} onChange={v => { s2.priority = v; paint(); }} min={0} max={65535} />
            </FormRow>
          )}
          {/* TTL · 9 档,严格对齐原项目 */}
          <FormRow label={tr('dnsp.ttl')} hint={tr('dnsp.ttlHint')}>
            <CustomDropdown value={s2.ttl} onChange={e => { s2.ttl = +e; paint(); }} height={32} width="100%">
              <option value={1}>{tr('dnsp.auto')}</option>
              <option value={300}>5min</option>
              <option value={600}>10min</option>
              <option value={1800}>30min</option>
              <option value={3600}>1h</option>
              <option value={7200}>2h</option>
              <option value={18000}>5h</option>
              <option value={43200}>12h</option>
              <option value={86400}>1day</option>
            </CustomDropdown>
          </FormRow>
          {/* 代理状态 · 对齐原项目 · 无类型限制(TXT/MX 也显示) */}
          <FormRow label={tr('dnsp.proxyStatus')} hint={tr('dnsp.proxyHint')}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={s2.proxied} onChange={e => { s2.proxied = e.target.checked; paint(); }} />
              <span style={{ fontSize: 12, color: s2.proxied ? 'var(--orange)' : 'var(--fg-2)' }}>
                {s2.proxied ? tr('dnsp.proxied') : tr('dnsp.dnsOnly')}
              </span>
            </label>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={async () => {
              if (!s2.name.trim() || !s2.content.trim()) { shell.showToast(tr('dnsp.required'), { kind: 'warn' }); return; }
              try {
                const result = isEdit
                  ? await window.ociServices.proxy.cloudflareUpdateRecord({ recordId: s2.id, zoneId, recordType: s2.type, recordName: s2.name, content: s2.content, ttl: Number(s2.ttl), proxied: !!s2.proxied })
                  : await window.ociServices.proxy.cloudflareAddRecord({ zoneId, type: s2.type, name: s2.name, content: s2.content, ttl: Number(s2.ttl), proxied: !!s2.proxied });
                requireSuccess(result, isEdit ? tr('dnsp.updateFail') : tr('dnsp.addFail'));
                await loadRecords();
                shell.showToast((isEdit ? tr('dnsp.updated') : tr('dnsp.added')).replace('{type}', s2.type), { kind: 'success' });
                shell.closeModal();
              } catch (e) {
                shell.showToast(e.message || (isEdit ? tr('dnsp.updateFail') : tr('dnsp.addFail')), { kind: 'error' });
              }
            }}>{isEdit ? tr('dnsp.save') : tr('dnsp.add')}</Button>
        </>
      ),
    });
    paint();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.cfManage')}
        subtitle={tr('dnsp.cf.subtitle')}
        icon="globe"
        iconColor="var(--orange)"
        actions={
          <>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('dnsp.zone')}</span>
            <CustomDropdown value={zoneId} onChange={e => { setZoneId(e); window.ociRouter.go('cfManage', e ? { zoneId: e } : {}, { replace: true }); }} height={32} width="100%">
              <option value="">{tr('dnsp.selectZone')}</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </CustomDropdown>
            <Button variant="orange" size="md" icon="key" onClick={openConfigModal}>{tr('nav.proxyKeyConfig')}</Button>
            <Button variant="primary" size="md" icon="plus" disabled={!zoneId} onClick={() => openDnsModal(null)}>{tr('dnsp.addRecord')}</Button>
            <Button variant="info" size="md" icon="refresh-cw" disabled={!zoneId} onClick={() => shell.openConfirm({
              title: tr('dnsp.syncCf.title').replace('{name}', currentZone?.name || ''), confirmLabel: tr('dnsp.sync'),
              onConfirm: async () => { try { requireSuccess(await window.ociServices.proxy.cloudflareSync({ zoneId, domainName: currentZone?.name || '' }), tr('dnsp.syncFail')); await loadRecords(); shell.showToast(tr('dnsp.syncCf.ok'), { kind: 'success' }); } catch (e) { shell.showToast(e.message || tr('dnsp.syncFail'), { kind: 'error' }); } },
            })}>{tr('dnsp.syncRecord')}</Button>
            <Button variant="outline" size="md" icon="rotate-ccw" loading={loading} onClick={loadRecords}>{tr('dnsp.refreshList')}</Button>
          </>
        }
      />

      {/* 搜索栏 */}
      {/* 搜索栏 · 严格对齐 · 双输入 + 搜索按钮 + 清除按钮 */}
      <div style={{
        display: 'flex', gap: 10, padding: 10, marginBottom: 12,
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByName')}</span>
        <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
          placeholder="e.g. www"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByValue')}</span>
        <input type="text" value={searchContent} onChange={e => setSearchContent(e.target.value)}
          placeholder="e.g. 192.9"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
        <button onClick={() => shell.showToast(tr('dnsp.searchFound').replace('{n}', filtered.length), { kind: 'info' })}
          style={{ padding: '6px 14px', background: 'var(--info)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="search" size={11} />{tr('dnsp.search')}
        </button>
        <button onClick={() => { setSearchName(''); setSearchContent(''); }}
          disabled={!searchName && !searchContent}
          style={{
            padding: '6px 12px',
            background: (searchName || searchContent) ? 'var(--danger-soft)' : 'var(--bg-2)',
            color: (searchName || searchContent) ? 'var(--danger)' : 'var(--fg-3)',
            border: '1px solid ' + ((searchName || searchContent) ? 'var(--danger)' : 'var(--border)'),
            borderRadius: 4,
            cursor: (searchName || searchContent) ? 'pointer' : 'not-allowed',
            fontSize: 12, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
          <Icon name="x" size={11} />{tr('dnsp.clear')}
        </button>
      </div>

      {/* DNS 记录表格 · 严格 6 列 */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="list" size={13} style={{ color: 'var(--fg-2)' }} />
          {tr('dnsp.dnsRecords')}
          <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({filtered.length}/{records.length})</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                {[
                  { h: tr('dnsp.type'),    w: 80,  align: 'center' },
                  { h: tr('dnsp.name'),    w: 200 },
                  { h: tr('dnsp.value') },
                  { h: tr('dnsp.ttl'),     w: 100 },
                  { h: tr('dnsp.proxyStatus'), w: 110, align: 'center' },
                  { h: tr('dnsp.operation'),    w: 100, align: 'center' },
                ].map((c, i) => (
                  <th key={i} style={{
                    textAlign: c.align || 'left', padding: '9px 12px', width: c.w,
                    background: 'var(--bg-2)', color: 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0,
                  }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('dnsp.loadingRecords')}</td></tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                  <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                  <div style={{ marginTop: 6 }}>{tr('dnsp.noRecords')}</div>
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{
                      padding: '2px 8px', borderRadius: 3,
                      background: 'color-mix(in oklab, ' + (typeColor[r.type] || 'var(--fg-2)') + ' 18%, transparent)',
                      color: typeColor[r.type] || 'var(--fg-2)',
                      fontSize: 10.5, fontWeight: 700,
                    }}>{r.type}</span>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)' }}>{r.name}</span>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }} title={r.content}>{r.content}</span>
                    {r.type === 'MX' && r.priority != null && (
                      <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('dnsp.priorityHint')} <span className="num">{r.priority}</span></span>
                    )}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{ttlLabel(r.ttl)}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    {['A', 'AAAA', 'CNAME'].includes(r.type) ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 3,
                        background: r.proxied ? 'var(--orange-soft)' : 'var(--bg-3)',
                        color: r.proxied ? 'var(--orange)' : 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 500,
                      }}>
                        {r.proxied ? tr('dnsp.proxied') : tr('dnsp.dnsOnly')}
                      </span>
                    ) : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button title={tr('common.edit')} onClick={() => openDnsModal(r)}
                        style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="edit" size={11} />
                      </button>
                      <button title={tr('common.delete')} onClick={() => shell.openConfirm({
                        title: tr('dnsp.deleteRecord.title').replace('{type}', r.type),
                        body: <div><span className="mono">{r.name}</span> → <span className="mono">{r.content}</span><div style={{ marginTop: 4, color: 'var(--fg-3)' }}>{tr('dnsp.deleteImmediate')}</div></div>,
                        danger: true, confirmLabel: tr('common.delete'),
                        onConfirm: async () => {
                          try {
                            requireSuccess(await window.ociServices.proxy.cloudflareDeleteRecord({ recordId: r.id, zoneId }), tr('dnsp.deleteFail'));
                            await loadRecords();
                            shell.showToast(tr('dnsp.deleted'), { kind: 'warn' });
                          } catch (e) { shell.showToast(e.message || tr('proxy.delete.fail'), { kind: 'error' }); }
                        },
                      })}
                        style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="trash-2" size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 3. EO 管理 ─────────────────────────────────────
//   Tencent EdgeOne · 严格对齐原项目 eo_manage.ftl
//   · Tab: DNS 记录 / 加速域名 (record-type-toggle)
//   · DNS 6 列: 类型/名称/值/TTL/优先级/操作
//   · 加速域名 5 列: 域名/状态/CNAME/协议/操作
//   · 状态严格 3 态: online / offline / pending
//   · DNS 搜索: 名称 + 值 双输入
//   · 域名搜索: 域名 + 状态 select
//   · 顶部工具:秘钥配置 + 同步 + 刷新列表
function EOManagePage() {
  const { t: tr } = useT();
  const shell = useShell();

  const routeState = window.ociRouter.read();
  const [zones, setZones] = React.useState([]);
  const [zoneId, setZoneId] = React.useState(routeState.query.zoneId || '');
  const [tab, setTab] = React.useState('dns');  // dns | domain
  const currentZone = zones.find(z => String(z.id) === String(zoneId));
  const [dnsRecords, setDnsRecords] = React.useState([]);
  const [domains, setDomains] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const requireSuccess = (result, fallback) => {
    if (result && result.success === false) throw new Error(result.message || fallback);
    return result;
  };
  const mapDomain = d => {
    const http = d.http === true || String(d.http).toLowerCase() === 'on';
    const https = d.https === true || String(d.https).toLowerCase() === 'on';
    return {
      ...d,
      domain: d.domainName ?? d.domain ?? '',
      status: String(d.status ?? 'pending').toLowerCase(),
      cname: d.cname ?? '',
      protocol: http && https ? 'HTTP/HTTPS' : https ? 'HTTPS' : http ? 'HTTP' : '—',
    };
  };
  const loadEdgeOneData = React.useCallback(async () => {
    if (!zoneId) { setDnsRecords([]); setDomains([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [dnsResult, domainResult] = await Promise.all([
        window.ociServices.proxy.edgeOneRecords({ zoneId, type: 'dns' }),
        window.ociServices.proxy.edgeOneDomains({ zoneId }),
      ]);
      requireSuccess(dnsResult, tr('dnsp.eo.recordLoadFail'));
      requireSuccess(domainResult, tr('dnsp.eo.domainLoadFail'));
      setDnsRecords(Array.isArray(dnsResult?.data) ? dnsResult.data : []);
      setDomains(Array.isArray(domainResult?.data) ? domainResult.data.map(mapDomain) : []);
    } catch (e) { setDnsRecords([]); setDomains([]); setError(e.message || tr('dnsp.eo.dataLoadFail')); }
    finally { setLoading(false); }
  }, [zoneId]);
  React.useEffect(() => {
    let alive = true;
    window.ociServices.proxy.edgeOneZones().then(result => {
      if (!alive) return;
      requireSuccess(result, tr('dnsp.eo.zoneLoadFail'));
      const next = Array.isArray(result?.data) ? result.data : [];
      setZones(next);
      if (!next.some(z => String(z.id) === String(zoneId))) {
        const first = next[0] ? String(next[0].id) : '';
        setZoneId(first);
        window.ociRouter.go('eoManage', first ? { zoneId: first } : {}, { replace: true });
      }
    }).catch(e => { if (alive) { setZones([]); setError(e.message || tr('dnsp.eo.zoneLoadFail')); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => { loadEdgeOneData(); }, [loadEdgeOneData]);

  // DNS 搜索(严格对齐原项目 · 双字段)
  const [dnsSearchName, setDnsSearchName]     = React.useState('');
  const [dnsSearchContent, setDnsSearchContent] = React.useState('');
  // 加速域名搜索(严格对齐原项目 · 域名 + 状态)
  const [domainSearchName, setDomainSearchName] = React.useState('');
  const [domainStatusFilter, setDomainStatusFilter] = React.useState('');

  const filteredDns = dnsRecords.filter(r =>
    (!dnsSearchName || r.name.toLowerCase().includes(dnsSearchName.toLowerCase())) &&
    (!dnsSearchContent || r.content.toLowerCase().includes(dnsSearchContent.toLowerCase()))
  );
  const filteredDomains = domains.filter(d =>
    (!domainSearchName || d.domain.toLowerCase().includes(domainSearchName.toLowerCase())) &&
    (!domainStatusFilter || d.status === domainStatusFilter)
  );

  const typeColor = { A: 'var(--info)', AAAA: 'var(--cyan)', CNAME: 'var(--accent)', MX: 'var(--orange)', TXT: 'var(--fg-2)' };
  // 状态严格 3 态 · 对齐 tecent.online / offline / execting
  const statusCfg = {
    online:  { label: tr('dnsp.eo.online'),   color: 'var(--accent)', bg: 'var(--accent-soft)', icon: 'check-circle' },
    offline: { label: tr('dnsp.eo.offline'),   color: 'var(--fg-3)',   bg: 'var(--bg-3)',        icon: 'x-circle' },
    pending: { label: tr('dnsp.eo.pending'), color: 'var(--info)',   bg: 'var(--info-soft)',   icon: 'loader' },
  };

  const openConfigModal = () => window.__ocipNavigate('proxyKeyConfig');

  // 添加/编辑 DNS，字段严格对应 EdgeOneController 的 Map 读取键。
  const openDnsModal = (r) => {
    const isEdit = !!r;
    const s2 = r ? { ...r } : { type: 'A', name: '', content: '', ttl: 300, priority: 0 };
    const paint = () => shell.openModal({
      title: isEdit ? tr('dnsp.editDomainRecord') : tr('dnsp.addDnsRecord'),
      subtitle: isEdit ? <span>{tr('dnsp.type')} <span className="mono">{r.type}</span> · <span className="mono">{r.name}</span></span> : '',
      icon: isEdit ? 'edit' : 'plus',
      iconColor: isEdit ? 'var(--info)' : 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label={tr('dnsp.recordType')} required>
            {isEdit ? <div style={{ padding: '7px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>{s2.type}</div> : (
              <CustomDropdown value={s2.type} onChange={e => { s2.type = e; paint(); }} height={32} width="100%">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map(type => <option key={type} value={type}>{type}</option>)}
              </CustomDropdown>
            )}
          </FormRow>
          <FormRow label={tr('dnsp.recordName')} required>
            <TextInput value={s2.name} onChange={v => { s2.name = v; paint(); }} placeholder="@, www, mail" mono />
          </FormRow>
          <FormRow label={tr('dnsp.recordValue')} required>
            <TextInput value={s2.content} onChange={v => { s2.content = v; paint(); }} mono />
          </FormRow>
          <FormRow label={tr('dnsp.ttl')}>
            <CustomDropdown value={s2.ttl} onChange={e => { s2.ttl = +e; paint(); }} height={32} width="100%">
              <option value={60}>{tr('dnsp.eo.ttl.seconds').replace('{n}', 60)}</option>
              <option value={300}>{tr('dnsp.eo.ttl.minutes').replace('{n}', 5)}</option>
              <option value={1800}>{tr('dnsp.eo.ttl.minutes').replace('{n}', 30)}</option>
              <option value={3600}>{tr('dnsp.eo.ttl.hours').replace('{n}', 1)}</option>
              <option value={86400}>{tr('dnsp.eo.ttl.days').replace('{n}', 1)}</option>
            </CustomDropdown>
          </FormRow>
          {s2.type === 'MX' && (
            <FormRow label={tr('dnsp.priority')} required>
              <NumberInput value={s2.priority === '-' ? 10 : s2.priority} onChange={v => { s2.priority = v; paint(); }} min={0} max={65535} />
            </FormRow>
          )}
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={async () => {
              if (!s2.name.trim() || !s2.content.trim()) { shell.showToast(tr('dnsp.required'), { kind: 'warn' }); return; }
              try {
                const result = isEdit
                  ? await window.ociServices.proxy.edgeOneUpdateRecord({ recordId: s2.id, zoneId, recordType: s2.type, recordName: s2.name, content: s2.content, ttl: Number(s2.ttl), priority: Number(s2.priority || 0) })
                  : await window.ociServices.proxy.edgeOneAddRecord({ zoneId, type: s2.type, name: s2.name, content: s2.content, ttl: Number(s2.ttl), priority: Number(s2.priority || 0) });
                requireSuccess(result, isEdit ? tr('dnsp.updateFail') : tr('dnsp.addFail'));
                await loadEdgeOneData();
                shell.showToast((isEdit ? tr('dnsp.updated') : tr('dnsp.added')).replace('{type}', s2.type), { kind: 'success' });
                shell.closeModal();
              } catch (e) { shell.showToast(e.message || (isEdit ? tr('dnsp.updateFail') : tr('dnsp.addFail')), { kind: 'error' }); }
            }}>{isEdit ? tr('dnsp.save') : tr('dnsp.add')}</Button>
        </>
      ),
    });
    paint();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.eoManage')}
        subtitle={tr('dnsp.eo.subtitle')}
        icon="globe"
        iconColor="var(--info)"
        actions={
          <>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('dnsp.zone')}</span>
            <CustomDropdown value={zoneId} onChange={e => { setZoneId(e); window.ociRouter.go('eoManage', e ? { zoneId: e } : {}, { replace: true }); }} height={32} width="100%">
              <option value="">{tr('dnsp.selectZone')}</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </CustomDropdown>
            <Button variant="orange" size="md" icon="key" onClick={openConfigModal}>{tr('nav.proxyKeyConfig')}</Button>
            {tab === 'dns' && <Button variant="primary" size="md" icon="plus" disabled={!zoneId} onClick={() => openDnsModal(null)}>{tr('dnsp.addRecord')}</Button>}
            <Button variant="primary" size="md" icon="refresh-cw"
              disabled={!zoneId}
              onClick={() => shell.openConfirm({
                title: tr('dnsp.eo.syncTitle').replace('{name}', currentZone?.name || '').replace('{target}', tab === 'dns' ? tr('dnsp.eo.tab.dns') : tr('dnsp.eo.tab.domain')),
                confirmLabel: tr('dnsp.sync'),
                onConfirm: async () => {
                  try {
                    const result = tab === 'dns'
                      ? await window.ociServices.proxy.edgeOneSync({ zoneId, domainName: currentZone?.name || '' })
                      : await window.ociServices.proxy.edgeOneSyncDomains({ zoneId, domainName: currentZone?.name || '' });
                    requireSuccess(result, tr('dnsp.syncFail'));
                    await loadEdgeOneData();
                    shell.showToast(tr('dnsp.eo.syncOk').replace('{target}', tab === 'dns' ? tr('dnsp.eo.tab.dns') : tr('dnsp.eo.tab.domain')), { kind: 'success' });
                  } catch (e) { shell.showToast(e.message || tr('dnsp.syncFail'), { kind: 'error' }); }
                },
              })}
            >{tr('dnsp.eo.syncBtn').replace('{target}', tab === 'dns' ? tr('dnsp.eo.syncDns') : tr('dnsp.eo.syncDomain'))}</Button>
            <Button variant="outline" size="md" icon="refresh-cw"
              loading={loading}
              onClick={loadEdgeOneData}
            >{tr('dnsp.refreshList')}</Button>
          </>
        }
      />

      {/* Tab 切换 · 严格对齐 record-type-toggle */}
      <div style={{
        display: 'inline-flex', padding: 3, marginBottom: 12,
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6,
        width: 'fit-content',
      }}>
        {[
          { id: 'dns',    label: tr('dnsp.eo.tab.dns'),   icon: 'server' },
          { id: 'domain', label: tr('dnsp.eo.tab.domain'),   icon: 'zap' },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); }}
            style={{
              padding: '6px 14px',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'var(--accent-fg)' : 'var(--fg-1)',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit',
              fontWeight: tab === t.id ? 600 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'background 120ms',
            }}>
            <Icon name={t.icon} size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* 搜索栏 · DNS 时 2 输入,加速域名时 1 输入 + 状态 select */}
      <div style={{
        display: 'flex', gap: 10, padding: 10, marginBottom: 12,
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
        alignItems: 'center',
      }}>
        {tab === 'dns' ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByName')}</span>
            <input type="text" value={dnsSearchName} onChange={e => setDnsSearchName(e.target.value)}
              placeholder="e.g. www"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByValue')}</span>
            <input type="text" value={dnsSearchContent} onChange={e => setDnsSearchContent(e.target.value)}
              placeholder="e.g. 129.146"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <button onClick={() => { setDnsSearchName(''); setDnsSearchContent(''); }}
              style={{ padding: '6px 12px', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{tr('dnsp.clearSearch')}</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.eo.domain')}:</span>
            <input type="text" value={domainSearchName} onChange={e => setDomainSearchName(e.target.value)}
              placeholder="e.g. www.example.com"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.eo.status')}</span>
            <CustomDropdown value={domainStatusFilter} onChange={e => setDomainStatusFilter(e)} height={32} width="100%">
              <option value="">{tr('dnsp.eo.all')}</option>
              <option value="online">{tr('dnsp.eo.online')}</option>
              <option value="offline">{tr('dnsp.eo.offline')}</option>
              <option value="pending">{tr('dnsp.eo.pending')}</option>
            </CustomDropdown>
            <button onClick={() => { setDomainSearchName(''); setDomainStatusFilter(''); }}
              style={{ padding: '6px 12px', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{tr('dnsp.clearSearch')}</button>
          </>
        )}
      </div>

      {/* 表格 */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name={tab === 'dns' ? 'list' : 'zap'} size={13} style={{ color: 'var(--fg-2)' }} />
          {tab === 'dns' ? tr('dnsp.eo.tab.dns') : tr('dnsp.eo.tab.domain')}
          <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>
            ({tab === 'dns' ? filteredDns.length : filteredDomains.length})
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {tab === 'dns' ? (
            /* ═══ DNS 记录 6 列:类型 / 名称 / 值 / TTL / 优先级 / 操作 ═══ */
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { h: tr('dnsp.type'),   w: 80,  align: 'center' },
                    { h: tr('dnsp.name'),   w: 180 },
                    { h: tr('dnsp.value') },
                    { h: tr('dnsp.ttl'),    w: 100 },
                    { h: tr('dnsp.priority'), w: 90,  align: 'center' },
                    { h: tr('dnsp.operation'),   w: 100, align: 'center' },
                  ].map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'left', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('dnsp.eo.loadingRecords')}</td></tr>
                ) : error ? (
                  <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
                ) : filteredDns.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                    <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                    <div style={{ marginTop: 6 }}>{tr('dnsp.noRecords')}</div>
                  </td></tr>
                ) : filteredDns.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{
                        padding: '2px 8px', borderRadius: 3,
                        background: 'color-mix(in oklab, ' + (typeColor[r.type] || 'var(--fg-2)') + ' 18%, transparent)',
                        color: typeColor[r.type] || 'var(--fg-2)',
                        fontSize: 10.5, fontWeight: 700,
                      }}>{r.type}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)' }}>{r.name}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{r.content}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="num" style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{r.ttl}s</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="num mono" style={{ fontSize: 11.5, color: r.priority === '-' ? 'var(--fg-3)' : 'var(--orange)' }}>
                        {r.priority}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button title={tr('common.edit')} onClick={() => openDnsModal(r)}
                          style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="edit" size={11} />
                        </button>
                        <button title={tr('common.delete')} onClick={() => shell.openConfirm({
                          title: tr('dnsp.deleteRecord.title').replace('{type}', r.type),
                          body: <div><span className="mono">{r.name}</span> → <span className="mono">{r.content}</span></div>,
                          danger: true, confirmLabel: tr('common.delete'),
                          onConfirm: async () => {
                            try {
                              requireSuccess(await window.ociServices.proxy.edgeOneDeleteRecord({ recordId: r.id }), tr('dnsp.deleteFail'));
                              await loadEdgeOneData();
                              shell.showToast(tr('dnsp.deleted'), { kind: 'warn' });
                            } catch (e) { shell.showToast(e.message || tr('proxy.delete.fail'), { kind: 'error' }); }
                          },
                        })}
                          style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="trash-2" size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ═══ 加速域名 5 列:域名 / 状态 / CNAME / 协议 / 操作 ═══ */
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { h: tr('dnsp.eo.domain') },
                    { h: tr('dnsp.eo.status'),   w: 100, align: 'center' },
                    { h: tr('dnsp.eo.cname') },
                    { h: tr('dnsp.eo.protocol'),   w: 130, align: 'center' },
                    { h: tr('dnsp.operation'),   w: 100, align: 'center' },
                  ].map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'left', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('dnsp.eo.loadingDomains')}</td></tr>
                ) : error ? (
                  <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
                ) : filteredDomains.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                    <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                    <div style={{ marginTop: 6 }}>{tr('dnsp.eo.noDomains')}</div>
                  </td></tr>
                ) : filteredDomains.map((d, i) => {
                  const st = statusCfg[d.status] || statusCfg.pending;
                  return (
                    <tr key={d.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{d.domain}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 3,
                          background: st.bg, color: st.color,
                          fontSize: 10.5, fontWeight: 500,
                        }}>
                          <Icon name={st.icon} size={9} />{st.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{d.cname}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{
                          padding: '2px 8px', borderRadius: 3,
                          background: String(d.protocol).includes('HTTPS') ? 'var(--accent-soft)' : 'var(--bg-3)',
                          color: String(d.protocol).includes('HTTPS') ? 'var(--accent)' : 'var(--fg-2)',
                          fontSize: 10.5, fontWeight: 600,
                        }}>{d.protocol}</span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button title={tr('dnsp.eo.editUnavailable')} disabled
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--fg-3)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'not-allowed', opacity: 0.5, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="edit" size={11} />
                          </button>
                          <button title={tr('common.delete')} onClick={() => shell.openConfirm({
                            title: tr('dnsp.eo.deleteDomain.title').replace('{name}', d.domain),
                            body: <div>{tr('dnsp.eo.deleteDomain.body')}</div>,
                            danger: true, confirmLabel: tr('common.delete'),
                            onConfirm: async () => {
                              try {
                                requireSuccess(await window.ociServices.proxy.edgeOneDeleteDomain({ domainId: d.id }), tr('dnsp.eo.deleteDomainFail'));
                                await loadEdgeOneData();
                                shell.showToast(tr('dnsp.eo.deleteDomainOk'), { kind: 'warn' });
                              } catch (e) { shell.showToast(e.message || tr('dnsp.eo.deleteDomainFail'), { kind: 'error' }); }
                            },
                          })}
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="trash-2" size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


Object.assign(window, { ProxyPage, KeyConfigPage, ProxyKeyConfigPage, CFManagePage, EOManagePage });
