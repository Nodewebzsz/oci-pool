// Actions for Proxy / Logs / Topbar / Regions

// ─── Proxy actions ─────────────────────────────────────────────

function useProxyEditModal(onSaved) {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(async (existing) => {
    const isNew = !existing;
    const state = existing ? { ...existing, username: existing.proxyUsername || '', password: '', tenants: existing.tenantIds || [], tenantOptions: [], loadingTenants: true } : {
      name: '', type: 'SOCKS5', host: '', port: 1080,
      username: '', password: '', tenants: [], tenantOptions: [], loadingTenants: true,
    };
    const render = () => {
      shell.openModal({
        title: isNew ? tr('proxy.add.title') : tr('proxy.edit.title').replace('{name}', existing.name),
        subtitle: tr('proxy.subtitle'),
        icon: 'shuffle',
        iconColor: 'var(--cyan)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <FormRow label={tr("proxy.name")} required>
              <TextInput value={state.name} onChange={v => { state.name = v; render(); }} placeholder={tr("proxy.namePh")} />
            </FormRow>

            <FormRow label={tr("proxy.protocol")}>
              <RadioGroup
                value={state.type}
                onChange={v => { state.type = v; render(); }}
                options={[
                  { value: 'SOCKS5', label: 'SOCKS5', icon: 'shuffle' },
                  { value: 'HTTP', label: 'HTTP', icon: 'globe' },
                  { value: 'HTTPS', label: 'HTTPS', icon: 'shield' },
                ]}
              />
            </FormRow>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <FormRow label={tr("proxy.host")} required>
                <TextInput mono value={state.host} onChange={v => { state.host = v; render(); }} placeholder={tr("proxy.hostPh")} />
              </FormRow>
              <FormRow label={tr("proxy.port")} required>
                <NumberInput value={state.port} onChange={v => { state.port = v; render(); }} min={1} max={65535} />
              </FormRow>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormRow label={tr("proxy.usernameOptional")}>
                <TextInput mono value={state.username} onChange={v => { state.username = v; render(); }} placeholder={tr("proxy.usernamePh")} />
              </FormRow>
              <FormRow label={tr("proxy.passwordOptional")}>
                <TextInput mono value={state.password} onChange={v => { state.password = v; render(); }} placeholder="••••••••" />
              </FormRow>
            </div>

            <FormRow label={tr('proxy.bindTenants').replace('{n}', state.tenants.length)} hint={tr('proxy.bindTenantsHint')}>
              <CheckboxGroup
                value={state.tenants}
                onChange={v => { state.tenants = v; render(); }}
                columns={2}
                options={state.loadingTenants ? [] : state.tenantOptions.map(t => ({
                  value: t.id, label: `${t.name} · ${getTenantName(t).slice(0, 20)}`,
                }))}
              />
            </FormRow>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
            <Button variant="outline" size="md" icon="wifi" disabled={!state.host || !state.id} onClick={async () => {
              try {
                const result = await window.ociServices.proxy.testConnection({ id: state.id });
                if (result && result.success === false) throw new Error(result.message || tr('proxy.test.fail'));
                const connected = result?.data?.connected ?? result?.connected;
                shell.showToast(connected ? tr('proxy.connected') : tr('proxy.unavailable'), { kind: connected ? 'success' : 'error' });
                if (onSaved) await onSaved();
              } catch (e) { shell.showToast(e.message || tr('proxy.test.fail'), { kind: 'error' }); }
            }}>{tr('proxy.testConn')}</Button>
            <Button
              variant="primary" size="md" icon="check"
              disabled={!state.name || !state.host || !state.port}
              onClick={async () => {
                try {
                  const result = await window.ociServices.proxy.saveOrUpdate({
                    id: isNew ? undefined : state.id,
                    proxyType: state.type,
                    proxyHost: state.host,
                    proxyPort: Number(state.port),
                    proxyUsername: state.username || '',
                    proxyPassword: state.password || undefined,
                    availableStatus: state.availableStatus == null ? 1 : Number(state.availableStatus),
                    forceProxy: state.forceProxy == null ? 0 : Number(state.forceProxy),
                    tenantIds: state.tenants || [],
                    customName: state.name,
                  });
                  if (result && result.success === false) throw new Error(result.message || tr('proxy.save.fail'));
                  shell.closeModal();
                  if (onSaved) await onSaved();
                  shell.showToast(isNew ? tr('proxy.added').replace('{name}', state.name) : tr('proxy.updated').replace('{name}', state.name), { kind: 'success' });
                } catch (e) { shell.showToast(e.message || tr('proxy.save.fail'), { kind: 'error' }); }
              }}
            >{isNew ? tr('proxy.add') : tr('common.save')}</Button>
          </>
        ),
      });
    };
    render();
    (async () => {
      try {
        const pageData = await window.ociApi.getPage('/tenants/list/json', { page: 0, size: 500, cloudType: 1 });
        state.tenantOptions = (pageData.content || []).filter(t => t.isActive !== false);
      } catch (e) { state.tenantOptions = []; }
      state.loadingTenants = false;
      render();
    })();
  }, [shell, onSaved]);
}

function useProxyTestAllModal(onFinished) {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(() => {
    const results = [];
    const render = () => {
      shell.openModal({
        title: tr('proxy.testAll.title'),
        subtitle: tr('proxy.testAll.subtitle'),
        icon: 'wifi',
        iconColor: 'var(--cyan)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            {results.map((p, i) => (
              <div key={p.id} style={{
                padding: '10px 12px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ minWidth: 20 }}>
                  {p.status === 'testing'
                    ? <Icon name="loader" size={14} style={{ color: 'var(--fg-3)' }} />
                    : p.status === 'healthy'
                      ? <Icon name="check-circle-2" size={14} style={{ color: 'var(--accent)' }} />
                      : p.status === 'warning'
                        ? <Icon name="alert-triangle" size={14} style={{ color: 'var(--orange)' }} />
                        : <Icon name="x-circle" size={14} style={{ color: 'var(--danger)' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{getProxyHost(p)}:{getProxyPort(p)}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>
                    {p.status === 'testing' ? tr('proxy.testing') : (p.status === 'healthy' ? tr('proxy.connected') : tr('proxy.unavailable'))}
                  </div>
                </div>
                <div style={{ minWidth: 80, textAlign: 'right' }}>
                  {p.latency !== null && (
                    <div className="num" style={{
                      fontSize: 14, fontWeight: 700,
                      color: p.latency < 100 ? 'var(--accent)' : p.latency < 200 ? 'var(--orange)' : 'var(--danger)',
                    }}>{p.latency}<span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}> ms</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ),
        footer: <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('engine.close')}</Button>,
      });
    };
    render();

    (async () => {
      try {
        const summary = await window.ociServices.proxy.testAll();
        if (summary && summary.success === false) throw new Error(summary.message || tr('proxy.testAll.fail'));
        const data = summary?.data || summary || {};
        const actual = Array.isArray(data.results) ? data.results : [];
        results.splice(0, results.length, ...actual.map(p => ({ ...p, name: p.customName || p.proxyHost || tr('proxy.unnamed').replace('{id}', p.id), type: p.proxyType, host: p.proxyHost, port: p.proxyPort, status: p.connected ? 'healthy' : 'error', latency: null })));
        render();
        if (onFinished) await onFinished();
      } catch (e) { shell.showToast(e.message || tr('proxy.testAll.fail'), { kind: 'error' }); }
    })();
  }, [shell, onFinished]);
}

function useProxyTestOneAction(onFinished) {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback((proxy) => {
    (async () => {
      try {
        const result = await window.ociServices.proxy.testConnection({ id: proxy.id });
        if (result && result.success === false) throw new Error(result.message || tr('proxy.test.fail'));
        const connected = result?.data?.connected ?? result?.connected;
        shell.showToast(tr('proxy.oneResult').replace('{name}', proxy.name).replace('{status}', connected ? tr('proxy.ok') : tr('proxy.bad')), { kind: connected ? 'success' : 'error' });
        if (onFinished) await onFinished();
      } catch (e) { shell.showToast(e.message || tr('proxy.test.fail'), { kind: 'error' }); }
    })();
  }, [shell, onFinished]);
}

// ─── Log actions ───────────────────────────────────────────────

function useLogDetailDrawer() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((log) => {
    const stack = Array.isArray(log.stack) && log.stack.length ? log.stack : null;
    const bodyResponse = log.response && typeof log.response === 'object' ? log.response : null;

    shell.openDrawer({
      title: tr('log.detailTitle').replace('{level}', log.level),
      subtitle: <span><span className="mono">{log.time}</span> · <span className="mono">{log.tenant}</span> · <RegionBadge code={log.region} lang={lang} style={{ display: 'inline-flex' }} /></span>,
      icon: 'file-text',
      iconColor: logColor(log.level).fg,
      width: 640,
      body: (
        <div>
          <SectionLabel>{tr('log.section.message')}</SectionLabel>
          <div style={{
            padding: 14,
            background: 'oklch(0.10 0.008 240)',
            border: `1px solid ${logColor(log.level).fg}`,
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'oklch(0.86 0.008 240)',
            lineHeight: 1.6,
          }}>
            <span style={{ color: logColor(log.level).fg, fontWeight: 700 }}>[{log.level}]</span>{' '}
            {log.msg}
          </div>

          <SectionLabel style={{ marginTop: 18 }}>{tr('log.section.request')}</SectionLabel>
          <KVList columns={1} items={[
            { label: 'API', value: <span className="mono">{log.api || '—'}</span> },
            { label: 'Endpoint', value: <span className="mono" style={{ fontSize: 10.5 }}>{log.endpoint || '—'}</span> },
            { label: 'Request-ID', value: <span className="mono" style={{ fontSize: 10.5 }}>{log.requestId || '—'}</span> },
            { label: tr('log.startTime'), value: <span className="mono">{log.time}</span> },
            { label: tr('log.duration'), value: <span className="mono">{log.durationMs == null ? '—' : `${log.durationMs} ms`}</span> },
          ]} />

          {bodyResponse && (
            <>
              <SectionLabel style={{ marginTop: 18 }}>{tr('log.section.response')}</SectionLabel>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  padding: '2px 8px',
                  background: bodyResponse.status < 300 ? 'var(--accent-soft)' : bodyResponse.status < 500 ? 'var(--orange-soft)' : 'var(--danger-soft)',
                  color: bodyResponse.status < 300 ? 'var(--accent)' : bodyResponse.status < 500 ? 'var(--orange)' : 'var(--danger)',
                  borderRadius: 4, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                }}>HTTP {bodyResponse.status}</span>
              </div>
              <div style={{
                padding: 12,
                background: 'oklch(0.10 0.008 240)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: 'oklch(0.72 0.05 240)',
                overflowX: 'auto',
                lineHeight: 1.6,
              }}>
                <pre style={{ margin: 0 }}>{JSON.stringify(bodyResponse.body, null, 2)}</pre>
              </div>
            </>
          )}

          {stack && (
            <>
              <SectionLabel style={{ marginTop: 18 }}>{tr('log.section.stack')}</SectionLabel>
              <div style={{
                padding: 12,
                background: 'oklch(0.10 0.008 240)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'oklch(0.72 0.05 240)',
                lineHeight: 1.7,
              }}>
                {stack.map((line, i) => (
                  <div key={i} style={{ color: i === 0 ? 'oklch(0.72 0.05 240)' : 'oklch(0.55 0.05 240)' }}>{line}</div>
                ))}
              </div>
            </>
          )}
        </div>
      ),
      actions: (
        <>
          <Button size="sm" variant="outline" icon="copy" onClick={() => shell.showToast(tr('log.copied'), { kind: 'success' })}>{tr('log.copy')}</Button>
          <Button size="sm" variant="outline" icon="link">{tr('log.gotoTask')}</Button>
        </>
      ),
    });
  }, [shell, lang]);
}

// ─── Topbar popovers ───────────────────────────────────────────

function normalizeNotification(raw, index = 0, tr = (k) => k) {
  const createdAt = raw?.createTime || raw?.updateTime || '';
  const ts = createdAt ? Date.parse(createdAt) || 0 : 0;
  const age = ts ? Math.max(0, Date.now() - ts) : 0;
  const time = !ts ? '—' : age < 60e3 ? tr('notify.time.justNow') : age < 3600e3 ? tr('notify.time.minutes').replace('{n}', Math.floor(age / 60e3)) : age < 86400e3 ? tr('notify.time.hours').replace('{n}', Math.floor(age / 3600e3)) : tr('notify.time.days').replace('{n}', Math.floor(age / 86400e3));
  const type = String(raw?.messageType || '').toLowerCase();
  const level = type.includes('error') || type.includes('fail') ? 'error' : type.includes('warn') ? 'warning' : type.includes('success') ? 'success' : 'info';
  return {
    id: raw?.businessId || raw?.id || `message-${index}`,
    level,
    title: raw?.subject || tr('notify.system'),
    source: raw?.messageType || 'system',
    desc: raw?.content || '',
    time,
    ts,
    read: Number(raw?.readStatus) === 1,
  };
}

function NotificationItems({ items, compact = false, onRead }) {
  const { t: tr } = useT();
  const styleFor = (lv) => {
    if (lv === 'success') return { c: 'var(--accent)', soft: 'var(--accent-soft)', icon: 'check-circle-2' };
    if (lv === 'warning') return { c: 'var(--orange)', soft: 'var(--orange-soft)', icon: 'alert-triangle' };
    if (lv === 'error') return { c: 'var(--danger)', soft: 'var(--danger-soft)', icon: 'alert-octagon' };
    return { c: 'var(--info)', soft: 'var(--info-soft)', icon: 'info' };
  };
  if (!items.length) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}><Icon name="inbox" size={22} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />{tr('notify.none')}</div>;
  return <div>{items.map((n, i) => {
    const s = styleFor(n.level);
    return <div key={n.id} onClick={() => onRead && !n.read && onRead(n)} style={{ padding: compact ? '12px 22px' : '12px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: n.read ? 'default' : 'pointer', background: n.read ? 'transparent' : 'oklch(from var(--info) l c h / 0.06)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: s.soft, color: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={s.icon} size={14} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 600, color: 'var(--fg-0)' }}>{n.title}</span><span className="mono" style={{ fontSize: 9.5, color: s.c }}>{n.source}</span><div style={{ flex: 1 }} /><span style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{n.time}</span></div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.6 }}>{n.desc || '—'}</div>
      </div>
    </div>;
  })}</div>;
}

function NotificationPopoverBody({ shell }) {
  const { t: tr } = useT();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    window.ociServices.notify.list({ pageNum: 1, pageSize: 6, sort: 'createTime', order: 'desc' })
      .then(result => {
        const page = result?.data || result;
        if (active) setItems((page?.content || []).map(x => normalizeNotification(x, 0, tr)));
      })
      .catch(e => { if (active) setError(e.message || tr('notify.load.fail')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('notify.loading')}</div>;
  if (error) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)', fontSize: 12 }}>{error}</div>;
  const markAll = async () => {
    try { await window.ociServices.notify.readAll(); setItems(prev => prev.map(n => ({ ...n, read: true }))); shell.showToast(tr('notify.markAllOk'), { kind: 'success' }); }
    catch (e) { shell.showToast(e.message || tr('notify.markFail'), { kind: 'error' }); }
  };
  const markOne = async (item) => {
    try { await window.ociServices.notify.get({ businessId: item.id }); setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n)); }
    catch (e) { shell.showToast(e.message || tr('notify.markFail'), { kind: 'error' }); }
  };
  return <div><NotificationItems items={items} compact onRead={markOne} /><div style={{ padding: '10px 22px', borderTop: '1px solid var(--border)', textAlign: 'right' }}><Button variant="ghost" size="sm" onClick={markAll}>{tr('notify.markAll')}</Button></div></div>;
}

function useNotificationPopover() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(() => {
    shell.openModal({
      title: tr('notify.center'),
      subtitle: tr('notify.centerSub'),
      icon: 'bell',
      iconColor: 'var(--orange)',
      size: 'md',
      body: <NotificationPopoverBody shell={shell} />,
      footer: <Button variant="outline" size="md" onClick={shell.closeModal}>{tr('common.close')}</Button>,
    });
  }, [shell]);
}

function EngineStatusBody() {
  const { t: tr } = useT();
  const shell = useShell();
  const [state, setState] = React.useState({ loading: true, error: '', data: null, busy: false });

  const load = React.useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const res = await window.ociServices.system.engineStatus();
      const ok = res && (res.success !== false);
      const data = ok ? (res.data || res || {}) : {};
      setState({ loading: false, error: ok ? '' : (res.message || tr('engine.err.load')), data, busy: false });
    } catch (e) {
      setState({ loading: false, error: e.message || tr('engine.err.load'), data: null, busy: false });
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const act = async (kind) => {
    if (state.busy) return;
    setState(s => ({ ...s, busy: true }));
    try {
      const res = kind === 'pause'
        ? await window.ociServices.system.enginePause()
        : await window.ociServices.system.engineResume();
      const ok = !res || res.success !== false;
      shell.showToast(ok
        ? (kind === 'pause' ? tr('engine.paused.toast') : tr('engine.resumed.toast'))
        : (res && res.message) || tr('engine.err.action'), { kind: ok ? 'success' : 'error' });
      await load();
    } catch (e) {
      shell.showToast(e.message || tr('engine.err.action'), { kind: 'error' });
      setState(s => ({ ...s, busy: false }));
    }
  };

  const d = state.data || {};
  const running = !!(d.running !== undefined ? d.running : true);
  const totalTasks = d.totalTasks ?? 0;
  const runningTasks = d.runningTasks ?? 0;
  const activeKeyCount = d.activeKeyCount ?? 0;
  const batchSize = d.batchSize ?? 0;
  const parentPool = d.parentPool || {};
  const ociApiPool = d.ociApiPool || {};

  if (state.loading) {
    return <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('engine.loading')}</div>;
  }

  return (
    <div style={{ padding: 22 }}>
      {state.error && <div role="alert" style={{ marginBottom: 12, padding: '8px 10px', border: '1px solid var(--danger)', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12 }}>{state.error}</div>}

      <div style={{
        padding: 14, borderRadius: 8, marginBottom: 14,
        border: '1px solid ' + (running ? 'var(--accent)' : 'var(--danger)'),
        background: running ? 'var(--accent-soft)' : 'var(--danger-soft)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <StatusDot status={running ? 'running' : 'stopped'} size={10} pulse={running} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: running ? 'var(--accent)' : 'var(--danger)' }}>
            {running ? tr('top.engine.active') : tr('top.engine.paused')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>
            {running ? tr('engine.running.desc') : tr('engine.paused.desc')}
          </div>
        </div>
      </div>

      <KVList columns={1} items={[
        { label: tr('engine.totalTasks'), value: <span className="num">{totalTasks}</span> },
        { label: tr('engine.runningTasks'), value: <span className="num">{runningTasks}</span> },
        { label: tr('engine.activeKeyCount'), value: <span className="num">{activeKeyCount}</span> },
        { label: tr('engine.batchSize'), value: <span className="num">{batchSize}</span> },
        { label: tr('engine.parentPool'), value: <span className="mono">{parentPool.activeThreads ?? 0} / {parentPool.queueSize ?? 0} / {parentPool.poolSize ?? 0}</span> },
        { label: tr('engine.ociPool'), value: <span className="mono">{ociApiPool.activeThreads ?? 0} / {ociApiPool.queueSize ?? 0} / {ociApiPool.poolSize ?? 0}</span> },
      ]} />

      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        {running ? (
          <Button variant="outline" size="md" icon="pause" loading={state.busy} onClick={() => act('pause')}>{tr('engine.pause')}</Button>
        ) : (
          <Button variant="primary" size="md" icon="play" loading={state.busy} onClick={() => act('resume')}>{tr('engine.resume')}</Button>
        )}
        <Button variant="ghost" size="md" icon="refresh-cw" onClick={load}>{tr('engine.refresh')}</Button>
      </div>
    </div>
  );
}

function useEngineStatusPopover() {
  const { t: tr } = useT();
  const shell = useShell();
  return React.useCallback(() => {
    shell.openModal({
      title: tr('top.engine'),
      subtitle: tr('engine.subtitle'),
      icon: 'zap',
      iconColor: 'var(--accent)',
      size: 'sm',
      body: <EngineStatusBody />,
      footer: <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('engine.close')}</Button>,
    });
  }, [shell]);
}


function useUserMenuPopover() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(() => {
    shell.openModal({
      title: 'AD Administrator',
      subtitle: 'admin@oci-pool.local · ' + tr('user.superAdmin'),
      icon: 'user',
      iconColor: 'var(--accent)',
      size: 'sm',
      body: (
        <div>
          <div style={{ padding: '4px 6px' }}>
            {[
              { icon: 'user', label: tr('user.profile'), color: 'var(--fg-1)' },
              { icon: 'shield', label: tr('user.security'), color: 'var(--fg-1)' },
              { icon: 'key', label: 'API Token', color: 'var(--fg-1)' },
              { icon: 'palette', label: tr('user.preferences'), color: 'var(--fg-1)' },
              { icon: 'help-circle', label: tr('user.help'), color: 'var(--fg-1)' },
              { icon: 'log-out', label: tr('user.logout'), color: 'var(--danger)' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => {
                  shell.closeModal();
                  if (item.label === tr('user.logout')) {
                    shell.openConfirm({
                      title: tr('user.logoutTitle'),
                      body: <div>{tr('user.logoutBody')}</div>,
                      confirmLabel: tr('user.logout'),
                      danger: true,
                      // 复用顶栏头像菜单同一路径 · 含 150ms watchdog 兜底
                      onConfirm: () => {
                        if (typeof window.__ocipLogout === 'function') {
                          window.__ocipLogout();
                          setTimeout(() => {
                            if (document.querySelector('aside')) {
                              try { localStorage.removeItem('ocip-authed'); } catch (_) {}
                              window.location.reload();
                            }
                          }, 150);
                          return;
                        }
                        try { localStorage.removeItem('ocip-authed'); } catch (_) {}
                        window.location.reload();
                      },
                    });
                  } else {
                    shell.showToast(tr('user.open').replace('{label}', item.label), { kind: 'info' });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: item.color,
                  fontFamily: 'inherit',
                  fontSize: 12.5, fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = item.color === 'var(--danger)' ? 'var(--danger-soft)' : 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon name={item.icon} size={14} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ),
    });
  }, [shell]);
}

// ─── Region detail drawer ──────────────────────────────────────

function useRegionDetailDrawer() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((region) => {
    const normTenant = (t) => ({ ...t, status: (t.status || 'active').toLowerCase(), name: t.name, region: getTenantRegion(t) });
    const normInstance = (i) => ({
      id: i.id,
      tenantId: String(i.tenantIdStr || i.tenantId || ''),
      name: i.displayName || '',
      status: (i.state || '').toLowerCase(),
      ocpu: i.ocpus,
      memory: i.memoryInGBs,
      disk: i.bootVolumeSizeInGBs,
      vpu: i.vpusPerGB,
      publicIp: i.publicIps || '',
      ipv6: i.ipv6Addresses ? 'enabled' : 'disabled',
      architecture: i.architecture,
      createdAt: i.timeCreated || i.createTime || '',
      region: i.regionCode || i.regionName || '',
    });
    const open = (relatedTenants, relatedInstances) => {
    shell.openDrawer({
      title: <span>{region.flag} {lang === 'zh' ? getRegionSimpleName(region) : region.en}</span>,
      subtitle: <span className="mono">{region.code}</span>,
      icon: 'globe',
      iconColor: 'var(--info)',
      statusDot: region.released ? 'active' : 'idle',
      width: 680,
      body: (
        <div>
          <SectionLabel>{tr('region.overview')}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            <MetricBox label={tr("region.totalGrabs")} value={region.totalGrabs} color={region.totalGrabs > 100 ? 'var(--accent)' : 'var(--fg-1)'} />
            <MetricBox label={tr("region.todayGrabs")} value={region.todayGrabs} color={region.todayGrabs > 0 ? 'var(--orange)' : 'var(--fg-3)'} />
            <MetricBox label={tr("region.relatedTenants")} value={relatedTenants.length} color="var(--cyan)" />
          </div>

          <SectionLabel>{tr('region.trend30')}</SectionLabel>
          <div style={{ padding: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 18, color: 'var(--fg-3)', fontSize: 12, textAlign: 'center' }}>
            {tr('region.noTrend')}
          </div>

          <SectionLabel>{tr('region.relatedTenants')} ({relatedTenants.length})</SectionLabel>
          {relatedTenants.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('region.noTenants')}</div>
          )}
          {relatedTenants.map((t, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12,
            }}>
              <StatusDot status={t.status === 'active' ? 'active' : t.status} size={5} pulse={t.status === 'active'} />
              <span className="mono" style={{ padding: '1px 5px', background: 'var(--bg-3)', borderRadius: 3, fontSize: 10.5, color: 'var(--fg-1)' }}>{t.name}</span>
              <span style={{ color: 'var(--fg-0)', flex: 1 }}>{getTenantName(t)}</span>
              <span className="num" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{getTenantDays(t)}{tr('region.days')}</span>
            </div>
          ))}

          {relatedInstances.length > 0 && (
            <>
              <SectionLabel style={{ marginTop: 18 }}>{tr('region.grabbedInstances')} ({relatedInstances.length})</SectionLabel>
              {relatedInstances.map((inst, i) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 6, marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12,
                }}>
                  <StatusDot status={inst.status} size={5} pulse={inst.status === 'running'} />
                  <span style={{ color: 'var(--fg-0)', flex: 1 }}>{inst.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{getInstanceCpu(inst)}C{getInstanceMem(inst)}G</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>{getInstanceIp(inst)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      ),
      actions: (
        <>
          <Button size="sm" variant="primary" icon="zap">{tr('region.grabHere')}</Button>
          <Button size="sm" variant="outline" icon="bell">{tr('region.subscribe')}</Button>
        </>
      ),
    });
    };
    // 真实加载:关联租户 + 关联实例
    (async () => {
      let relatedTenants = [];
      let relatedInstances = [];
      try {
        const [tPage, iPage] = await Promise.all([
          window.ociApi.getPage('/tenants/list/json', { page: 0, size: 500, cloudType: 1 }),
          window.ociApi.getPage('/oci/list/json', { page: 0, size: 500 }),
        ]);
        relatedTenants = (tPage.content || []).map(normTenant).filter(t => t.region === region.code);
        relatedInstances = (iPage.content || []).map(normInstance).filter(i => i.region === region.code);
      } catch (e) {
        relatedTenants = [];
        relatedInstances = [];
      }
      open(relatedTenants, relatedInstances);
    })();
  }, [shell, lang]);
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{ padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
    </div>
  );
}


// Body 组件 · 自持 state · 避免 imperative render 导致 input 失焦
function NotifyHistoryBody({ shell }) {
  const { t: tr } = useT();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [level, setLevel] = React.useState('all');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    let active = true;
    window.ociServices.notify.list({ pageNum: 1, pageSize: 200, sort: 'createTime', order: 'desc' })
      .then(result => {
        const page = result?.data || result;
        if (active) setItems((page?.content || []).map(x => normalizeNotification(x, 0, tr)));
      })
      .catch(e => { if (active) setError(e.message || tr('notify.load.fail')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = items.filter(n => {
    if (level !== 'all' && n.level !== level) return false;
    if (unreadOnly && n.read) return false;
    if (q) {
      const lq = q.toLowerCase();
      if (!n.title.toLowerCase().includes(lq) &&
          !n.desc.toLowerCase().includes(lq) &&
          !n.source.toLowerCase().includes(lq)) return false;
    }
    return true;
  });

  const totals = {
    all:    items.length,
    unread: items.filter(n => !n.read).length,
    error:  items.filter(n => n.level === 'error').length,
    today:  items.filter(n => Date.now() - n.ts < 86400e3).length,
  };

  const styleFor = (lv) => {
    if (lv === 'success') return { c: 'var(--accent)', soft: 'var(--accent-soft)', icon: 'check-circle-2' };
    if (lv === 'warning') return { c: 'var(--orange)', soft: 'var(--orange-soft)', icon: 'alert-triangle' };
    if (lv === 'error')   return { c: 'var(--danger)', soft: 'var(--danger-soft)', icon: 'alert-octagon' };
    return { c: 'var(--info)', soft: 'var(--info-soft)', icon: 'info' };
  };

  const markOne = async (item) => {
    try {
      await window.ociServices.notify.get({ businessId: item.id });
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    } catch (e) { shell.showToast(e.message || tr('notify.markFail'), { kind: 'error' }); }
  };
  const markAll = async () => {
    try {
      await window.ociServices.notify.readAll();
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      shell.showToast(tr('notify.markAllOk'), { kind: 'success' });
    } catch (e) { shell.showToast(e.message || tr('notify.markFail'), { kind: 'error' }); }
  };

  // 暴露到外部让 footer 按钮能访问(通过 window.__notifyBodyMarkAll)
  React.useEffect(() => {
    window.__notifyBodyMarkAll = markAll;
    return () => { window.__notifyBodyMarkAll = null; };
  }, [items]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('notify.loading')}</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)', fontSize: 12 }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 22px 8px' }}>
      {/* KPI 4 张 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: tr('notify.total'), value: totals.all,    color: 'var(--fg-0)',   icon: 'bell'          },
          { label: tr('notify.unread'),   value: totals.unread, color: 'var(--info)',   icon: 'mail'          },
          { label: tr('notify.error'),   value: totals.error,  color: 'var(--danger)', icon: 'alert-octagon' },
          { label: tr('notify.today'),   value: totals.today,  color: 'var(--accent)', icon: 'calendar'      },
        ].map(k => (
          <div key={k.label} style={{
            padding: '10px 12px',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name={k.icon} size={12} style={{ color: k.color }} />
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 500, letterSpacing: 0.3 }}>{k.label}</span>
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
          {[
            { id: 'all',     label: tr('notify.filter.all'), color: 'var(--fg-1)'   },
            { id: 'success', label: tr('notify.filter.success'), color: 'var(--accent)' },
            { id: 'warning', label: tr('notify.filter.warning'), color: 'var(--orange)' },
            { id: 'error',   label: tr('notify.filter.error'), color: 'var(--danger)' },
            { id: 'info',    label: tr('notify.filter.info'), color: 'var(--info)'   },
          ].map(c => {
            const on = level === c.id;
            return (
              <button key={c.id} type="button"
                onClick={() => setLevel(c.id)}
                style={{
                  padding: '3px 10px', borderRadius: 4,
                  background: on ? c.color : 'transparent',
                  border: 'none',
                  color: on ? (c.id === 'all' ? 'var(--bg-1)' : 'var(--accent-fg)') : c.color,
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >{c.label}</button>
            );
          })}
        </div>

        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          background: unreadOnly ? 'var(--info-soft)' : 'var(--bg-2)',
          border: '1px solid ' + (unreadOnly ? 'var(--info)' : 'var(--border)'),
          borderRadius: 6,
          fontSize: 11, color: unreadOnly ? 'var(--info)' : 'var(--fg-1)',
          cursor: 'pointer', fontWeight: 500,
          transition: 'all 100ms',
        }}>
          <input type="checkbox" checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)}
            style={{ margin: 0 }}
          />
          {tr('notify.onlyUnread')}
        </label>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0 10px', height: 28, flex: 1, minWidth: 180,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
        }}>
          <Icon name="search" size={12} style={{ color: 'var(--fg-3)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tr("notify.searchPh")}
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'inherit', fontSize: 12, color: 'var(--fg-0)',
            }}
          />
          {q && (
            <button type="button"
              onClick={() => setQ('')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fg-3)', padding: 2,
                display: 'inline-flex', alignItems: 'center',
              }}
            ><Icon name="x" size={11} /></button>
          )}
        </div>
      </div>

      {/* 结果计数 */}
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{tr('notify.showCount').replace('{shown}', filtered.length).replace('{total}', items.length)}</span>
        {filtered.length === 0 && <span>{tr('notify.noMatch')}</span>}
      </div>

      {/* 通知列表 */}
      <div style={{
        maxHeight: 'calc(100vh - 420px)', minHeight: 240,
        overflowY: 'auto',
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
            <Icon name="inbox" size={22} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
            {tr('notify.noMatch')}
          </div>
        ) : filtered.map((n, i) => {
          const s = styleFor(n.level);
          return (
            <div key={n.id}
              onClick={() => { if (!n.read) markOne(n); }}
              style={{
                padding: '12px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'oklch(from var(--info) l c h / 0.06)',
                transition: 'background 100ms',
                position: 'relative',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
              onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'oklch(from var(--info) l c h / 0.06)'}
            >
              {!n.read && (
                <span style={{
                  position: 'absolute', left: 0, top: 12, bottom: 12, width: 2,
                  background: 'var(--info)', borderRadius: 999,
                }} />
              )}
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: s.soft, color: s.c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={s.icon} size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 12.5,
                    fontWeight: n.read ? 500 : 600,
                    color: 'var(--fg-0)',
                  }}>{n.title}</span>
                  <span className="mono" style={{
                    fontSize: 9.5, color: s.c,
                    padding: '1px 5px', borderRadius: 3,
                    background: s.soft,
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{n.source}</span>
                  {!n.read && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--info)',
                    }} />
                  )}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>{n.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useNotifyHistoryModal() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(() => {
    shell.openModal({
      title: tr('notify.center'),
      subtitle: tr('notify.historySub'),
      icon: 'bell',
      iconColor: 'var(--orange)',
      size: 'xl',
      body: <NotifyHistoryBody shell={shell} />,
      footer: (
        <>
          <Button variant="ghost" size="md" icon="check-circle-2"
            onClick={() => { window.__notifyBodyMarkAll && window.__notifyBodyMarkAll(); }}
          >{tr('notify.markAll')}</Button>
          <div style={{ flex: 1 }} />
          <Button variant="outline" size="md" onClick={shell.closeModal}>{tr('common.close')}</Button>
        </>
      ),
    });
  }, [shell]);
}

Object.assign(window, {
  useProxyEditModal, useProxyTestAllModal, useProxyTestOneAction,
  useLogDetailDrawer,
  useNotificationPopover, useEngineStatusPopover, useUserMenuPopover,
  useNotifyHistoryModal,
  useRegionDetailDrawer,
});
