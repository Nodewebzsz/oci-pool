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
    location: p.location || '',
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
              availableStatus: Number(proxy.availableStatus) === 1 ? 0 : 1,
              forceProxy: proxy.forceProxy,
              tenantIds: proxy.tenantIds || (proxy.tenantId == null ? [] : [proxy.tenantId]),
              customName: proxy.customName,
              expectedBindingRevision: proxy.bindingRevision,
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
    { key: 'location', label: tr('pageMisc.proxyLocation') || '代理归属地',
      render: r => r.location ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-1)', fontSize: 11.5 }}>
          <Icon name="map-pin" size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>{r.location}</span>
        </span>
      ) : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>—</span>,
    },
    { key: 'tenants', label: tr('proxy.col.tenants'),
      render: r => <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{r.tenants}</span>,
    },
    { key: 'latency', label: tr('proxy.col.latency'),
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

// ─── 1. 密钥配置 (API Token) ──────────────────────────
// 严格对齐原项目 api_token_config.ftl · 平台自身 REST API 的 Bearer Token 管理
// 4 张卡:Token 状态 · Token 配置 · API 文档访问 · API 使用说明
function proxyTx(tr, lang, key, zh, en) {
  const v = tr ? tr(key) : key;
  return (v && v !== key) ? v : (lang === 'en' ? en : zh);
}

async function downloadOpenApiSpecJson(shell, tr, lang) {
  const res = await window.ociServices.token.openApiSpec();
  if (res && res.success === false) {
    throw new Error(res.message || proxyTx(tr, lang, 'token.apiDoc.loadFail', '获取 OpenAPI 规范失败', 'Failed to fetch OpenAPI specification'));
  }
  const payload = res?.data || res || {};
  const exportDoc = { ...payload };
  delete exportDoc.endpoints;
  const blob = new Blob([JSON.stringify(exportDoc, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'oci-pool-openapi-3.0.3.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  shell?.showToast?.(
    proxyTx(tr, lang, 'token.apiDoc.exportOk', '✓ 已导出 oci-pool-openapi-3.0.3.json', '✓ Exported oci-pool-openapi-3.0.3.json'),
    { kind: 'success' }
  );
}

function buildEndpointCurl(ep, tokenValue) {
  const method = String(ep?.method || 'GET').toUpperCase();
  const rawPath = String(ep?.path || '/');
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://127.0.0.1:19857';
  const url = rawPath.startsWith('http') ? rawPath : `${origin}${rawPath}`;
  const bearer = (tokenValue && tokenValue.trim()) ? tokenValue.trim() : '<YOUR_API_TOKEN>';
  const lines = [
    `curl -X ${method} "${url}"`,
    `  -H "Authorization: Bearer ${bearer}"`,
  ];
  if (ep?.sampleBody && method !== 'GET') {
    lines.push('  -H "Content-Type: application/json"');
    const escapedBody = String(ep.sampleBody).replace(/'/g, "'\\''");
    lines.push(`  -d '${escapedBody}'`);
  }
  return lines.join(' \\\n');
}

function OpenApiEndpointItem({ ep, activeToken, tr, lang, shell, defaultExpanded = false }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [reqPath, setReqPath] = React.useState(() => String(ep?.path || ''));
  const [reqBody, setReqBody] = React.useState(() => {
    if (!ep?.sampleBody) return '';
    try { return JSON.stringify(JSON.parse(ep.sampleBody), null, 2); }
    catch (_err) { return String(ep.sampleBody); }
  });
  const [running, setRunning] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);

  React.useEffect(() => {
    setReqPath(String(ep?.path || ''));
    if (!ep?.sampleBody) setReqBody('');
    else {
      try { setReqBody(JSON.stringify(JSON.parse(ep.sampleBody), null, 2)); }
      catch (_err) { setReqBody(String(ep.sampleBody)); }
    }
    setTestResult(null);
  }, [ep?.path, ep?.sampleBody]);

  const method = String(ep?.method || 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'DELETE';
  const methodTone = method === 'POST'
    ? { bg: 'var(--violet-soft)', fg: 'var(--violet)' }
    : method === 'DELETE'
      ? { bg: 'var(--danger-soft)', fg: 'var(--danger)' }
      : (method === 'PUT' || method === 'PATCH')
        ? { bg: 'var(--orange-soft)', fg: 'var(--orange)' }
        : { bg: 'var(--info-soft)', fg: 'var(--info)' };

  const curlCmd = React.useMemo(
    () => buildEndpointCurl({ ...ep, path: reqPath || ep?.path, sampleBody: hasBody ? reqBody.replace(/\s*\n\s*/g, ' ').trim() : null }, activeToken),
    [ep, reqPath, reqBody, hasBody, activeToken]
  );

  const copyStr = (txt, label) => {
    navigator.clipboard?.writeText(txt);
    shell.showToast(
      proxyTx(tr, lang, 'token.apiDoc.copiedItem', `已复制 ${label}`, `Copied ${label}`),
      { kind: 'success', duration: 1500 }
    );
  };

  const runLiveRequest = async () => {
    setRunning(true);
    const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    try {
      const target = (reqPath || ep.path || '').trim();
      const headers = { Accept: 'application/json' };
      if (activeToken && activeToken.trim()) {
        headers.Authorization = `Bearer ${activeToken.trim()}`;
      }
      let bodyPayload;
      if (hasBody && reqBody.trim()) {
        try {
          JSON.parse(reqBody);
        } catch (parseErr) {
          shell.showToast(
            proxyTx(tr, lang, 'token.apiDoc.invalidJson', '请求体 JSON 格式有误，请检查后重试', 'Invalid JSON body'),
            { kind: 'warn' }
          );
          setRunning(false);
          return;
        }
        headers['Content-Type'] = 'application/json';
        bodyPayload = reqBody;
      }
      const resp = await fetch(target, { method, headers, body: bodyPayload, credentials: 'same-origin' });
      const elapsedMs = Math.max(1, Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : started + 1) - started));
      const rawText = await resp.text();
      let formatted = rawText;
      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch (_err) {
        formatted = rawText || proxyTx(tr, lang, 'token.apiDoc.emptyResp', '(空响应体)', '(Empty body)');
      }
      setTestResult({
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText || (resp.ok ? 'OK' : 'Error'),
        elapsedMs,
        body: formatted,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        status: 0,
        statusText: 'Network Error',
        elapsedMs: 0,
        body: err?.message || String(err),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid ' + (expanded ? 'var(--border-strong)' : 'var(--border)'),
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      transition: 'border-color 120ms',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: expanded ? 'var(--bg-3)' : 'var(--bg-2)',
      }}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            textAlign: 'left', color: 'var(--fg-0)', fontFamily: 'inherit',
          }}
        >
          <span className="mono" style={{
            padding: '2px 7px', borderRadius: 'var(--radius-sm)', fontSize: 10.5, fontWeight: 700,
            background: methodTone.bg, color: methodTone.fg, flexShrink: 0, minWidth: 46, textAlign: 'center',
            border: '1px solid color-mix(in srgb, ' + methodTone.fg + ' 28%, transparent)',
          }}>
            {method}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ep.path}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>
              {ep.summary}
            </div>
          </div>
          {ep.group && (
            <span style={{
              padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: 'var(--bg-1)', color: 'var(--fg-2)', border: '1px solid var(--border)', flexShrink: 0,
            }}>
              {ep.group}
            </span>
          )}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="copy"
          onClick={() => copyStr(curlCmd, 'cURL')}
        >
          cURL
        </Button>
      </div>

      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-1)' }}>
          {/* Bearer cURL 命令 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>
                {proxyTx(tr, lang, 'token.apiDoc.curlLabel', 'Bearer cURL 命令（已自动带入当前 Token）', 'Bearer cURL Command')}
              </span>
              <Button type="button" variant="outline" size="sm" icon="copy" onClick={() => copyStr(curlCmd, 'cURL')}>
                {proxyTx(tr, lang, 'token.apiDoc.copyCurl', '复制 cURL', 'Copy cURL')}
              </Button>
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--surface-code)', color: 'var(--on-dark)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55,
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {curlCmd}
            </pre>
          </div>

          {/* 在线调试表单 */}
          <div style={{
            padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="terminal" size={13} style={{ color: 'var(--accent)' }} />
                {proxyTx(tr, lang, 'token.apiDoc.tryTitle', '在线测试请求', 'Live Request Runner')}
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon="play"
                loading={running}
                onClick={runLiveRequest}
              >
                {proxyTx(tr, lang, 'token.apiDoc.sendTest', '发送测试请求', 'Send Request')}
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                {proxyTx(tr, lang, 'token.apiDoc.reqPath', '请求路径与查询参数', 'Request Path & Query')}
              </label>
              <input
                type="text"
                value={reqPath}
                onChange={e => setReqPath(e.target.value)}
                className="mono"
                style={{
                  width: '100%', padding: '6px 10px',
                  background: 'var(--bg-1)', color: 'var(--fg-0)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11.5,
                }}
              />
            </div>

            {hasBody && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {proxyTx(tr, lang, 'token.apiDoc.reqBody', 'JSON 请求体 (Body)', 'JSON Request Body')}
                </label>
                <textarea
                  value={reqBody}
                  onChange={e => setReqBody(e.target.value)}
                  rows={4}
                  className="mono"
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: 'var(--bg-1)', color: 'var(--fg-0)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11.5,
                    resize: 'vertical', lineHeight: 1.5,
                  }}
                />
              </div>
            )}

            {testResult && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{
                      padding: '2px 7px', borderRadius: 'var(--radius-sm)', fontSize: 10.5, fontWeight: 700,
                      background: testResult.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
                      color: testResult.ok ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {testResult.status ? `HTTP ${testResult.status} ${testResult.statusText}` : testResult.statusText}
                    </span>
                    {testResult.elapsedMs > 0 && (
                      <span className="mono num" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                        {testResult.elapsedMs} ms
                      </span>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" icon="copy" onClick={() => copyStr(testResult.body, 'JSON')}>
                    {proxyTx(tr, lang, 'common.copy', '复制', 'Copy')}
                  </Button>
                </div>
                <pre style={{
                  margin: 0, padding: '10px 12px', maxHeight: 240, overflow: 'auto',
                  background: 'var(--surface-code)', color: 'var(--on-dark)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {testResult.body}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function tokenAvailabilityLabel(state, lang) {
  const labels = {
    missing: ['未生成', 'Not generated'], disabled: ['已停用', 'Disabled'],
    expired: ['已过期', 'Expired'], unknown: ['有效期未知', 'Expiry unknown'],
    expiring: ['即将到期', 'Expiring soon'], valid: ['有效', 'Valid'],
  };
  return (labels[state] || labels.unknown)[lang === 'en' ? 1 : 0];
}

function OpenApiDocsDrawerBody({ initialToken = '', initialHasToken = false, initialTokenName = '' }) {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [spec, setSpec] = React.useState(null);
  const [activeToken, setActiveToken] = React.useState('');
  const [tokenNotice, setTokenNotice] = React.useState('');
  const [tokenLabel, setTokenLabel] = React.useState(initialTokenName || '');
  const [showBearer, setShowBearer] = React.useState(false);
  const [groupFilter, setGroupFilter] = React.useState('ALL');
  const [keyword, setKeyword] = React.useState('');

  const loadSpec = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.ociServices.token.openApiSpec();
      if (res && res.success === false) {
        throw new Error(res.message || proxyTx(tr, lang, 'token.apiDoc.loadFail', '获取 OpenAPI 规范失败', 'Failed to fetch OpenAPI specification'));
      }
      setSpec(res?.data || res || {});
    } catch (e) {
      setError(e?.message || proxyTx(tr, lang, 'token.apiDoc.loadFail', '获取 OpenAPI 规范失败', 'Failed to fetch OpenAPI specification'));
    } finally {
      setLoading(false);
    }
  }, [tr, lang]);

  React.useEffect(() => {
    loadSpec();
  }, [loadSpec]);

  React.useEffect(() => {
    let alive = true;
    window.ociServices.token.configs().then(res => {
      if (!alive) return;
      const d = res?.data || res || {};
      const c = d.config || d;
      const s = d.status || d;
      const state = window.ociTokenAvailability({ ...s, enabled: s.enabled ?? c.enabled, hasToken: s.hasToken ?? !!c.tokenValue, expiresAt: s.expiresAt || c.expiresAt });
      setTokenNotice(tokenAvailabilityLabel(state, lang));
      if (c?.tokenValue && (state === 'valid' || state === 'expiring')) {
        setActiveToken(c.tokenValue);
        setTokenLabel(s?.tokenName || c?.tokenName || '');
      }
    }).catch(err => {
      console.warn('读取默认 Token 失败:', err);
    });
    return () => { alive = false; };
  }, [initialToken, initialTokenName]);

  const endpoints = React.useMemo(() => {
    if (Array.isArray(spec?.endpoints) && spec.endpoints.length > 0) {
      return spec.endpoints;
    }
    const paths = spec?.paths || {};
    const list = [];
    Object.entries(paths).forEach(([p, methods]) => {
      Object.entries(methods || {}).forEach(([m, op]) => {
        list.push({
          method: String(m).toUpperCase(),
          path: p,
          summary: op?.summary || p,
          group: Array.isArray(op?.tags) && op.tags[0] ? op.tags[0] : 'General',
          sampleBody: null,
        });
      });
    });
    return list;
  }, [spec]);

  const groups = React.useMemo(() => {
    const counts = new Map();
    endpoints.forEach(ep => {
      const g = ep.group || 'General';
      counts.set(g, (counts.get(g) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [endpoints]);

  const filteredEndpoints = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return endpoints.filter(ep => {
      if (groupFilter !== 'ALL' && (ep.group || 'General') !== groupFilter) return false;
      if (!kw) return true;
      return String(ep.path || '').toLowerCase().includes(kw)
        || String(ep.summary || '').toLowerCase().includes(kw)
        || String(ep.method || '').toLowerCase().includes(kw);
    });
  }, [endpoints, groupFilter, keyword]);

  const groupedMap = React.useMemo(() => {
    const map = new Map();
    filteredEndpoints.forEach(ep => {
      const g = ep.group || 'General';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(ep);
    });
    return Array.from(map.entries());
  }, [filteredEndpoints]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 规范元信息与导出 */}
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius)',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
              {spec?.info?.title || 'OCI Pool Manager Open API'}
            </span>
            <span className="mono" style={{
              padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontSize: 10.5, fontWeight: 600,
              background: 'var(--violet-soft)', color: 'var(--violet)',
            }}>
              OpenAPI {spec?.openapi || '3.0.3'}
            </span>
            <span className="mono" style={{
              padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontSize: 10.5, fontWeight: 600,
              background: 'var(--accent-soft)', color: 'var(--accent)',
            }}>
              BearerAuth
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
            {spec?.info?.description || proxyTx(tr, lang, 'token.apiDoc.specDesc', '受平台登录会话与 API Token (Bearer) 双重保护的开放接口规范', 'Protected OpenAPI specification requiring Bearer token')}
          </div>
        </div>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <Button type="button" variant="outline" size="sm" icon="rotate-cw" loading={loading} onClick={loadSpec}>
            {proxyTx(tr, lang, 'common.refresh', '刷新', 'Refresh')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon="download"
            onClick={() => downloadOpenApiSpecJson(shell, tr, lang).catch(e => shell.showToast(e.message, { kind: 'error' }))}
          >
            {proxyTx(tr, lang, 'token.apiDoc.exportShort', '导出 JSON', 'Export JSON')}
          </Button>
        </div>
      </div>

      {/* 当前注入 Bearer Token 栏 */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--radius)',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-1)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="key" size={13} style={{ color: 'var(--accent)' }} />
            {proxyTx(tr, lang, 'token.apiDoc.bearerInject', '自动注入 Bearer Token', 'Injected Bearer Token')}
            {tokenLabel && (
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>({tokenLabel})</span>
            )}
          </span>
          <span style={{
            fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
            background: activeToken.trim() ? 'var(--success-soft)' : 'var(--orange-soft)',
            color: activeToken.trim() ? 'var(--success)' : 'var(--orange)',
          }}>
            {activeToken.trim()
              ? proxyTx(tr, lang, 'token.apiDoc.tokenReady', '已就绪 · 自动生成可直连 cURL', 'Token Ready')
              : (tokenNotice || (initialHasToken
                ? proxyTx(tr, lang, 'token.apiDoc.tokenMasked', '请粘贴明文 Token 以在线调试', 'Paste Token to Test')
                : proxyTx(tr, lang, 'token.apiDoc.tokenMissing', '未生成 Token · 使用占位符', 'No Active Token')))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type={showBearer ? 'text' : 'password'}
            value={activeToken}
            onChange={e => setActiveToken(e.target.value)}
            placeholder={proxyTx(tr, lang, 'token.apiDoc.tokenPh', '自动读取当前平台 API Token，也可手动粘贴调试 Token', 'Auto-filled from active token or paste custom Bearer token')}
            className="mono"
            style={{
              flex: 1, minWidth: 0, padding: '6px 10px',
              background: 'var(--bg-1)', color: 'var(--fg-0)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11.5,
            }}
          />
          <Button type="button" variant="outline" size="sm" icon={showBearer ? 'eye-off' : 'eye'} onClick={() => setShowBearer(v => !v)}>
            {showBearer ? proxyTx(tr, lang, 'common.hide', '隐藏', 'Hide') : proxyTx(tr, lang, 'common.show', '显示', 'Show')}
          </Button>
        </div>
      </div>

      {/* 分组胶囊与搜索 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 'var(--radius)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setGroupFilter('ALL')}
            style={{
              padding: '4px 10px', borderRadius: 'var(--button-radius)', border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
              background: groupFilter === 'ALL' ? 'var(--accent)' : 'transparent',
              color: groupFilter === 'ALL' ? 'var(--accent-fg)' : 'var(--fg-2)',
              transition: 'all 120ms',
            }}
          >
            {proxyTx(tr, lang, 'common.all', '全部', 'All')} ({endpoints.length})
          </button>
          {groups.map(([g, count]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--button-radius)', border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
                background: groupFilter === g ? 'var(--accent)' : 'transparent',
                color: groupFilter === g ? 'var(--accent-fg)' : 'var(--fg-2)',
                transition: 'all 120ms',
              }}
            >
              {g} ({count})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder={proxyTx(tr, lang, 'token.apiDoc.searchPh', '搜索路径 / 接口描述…', 'Filter path or summary...')}
          style={{
            flex: 1, minWidth: 160, padding: '6px 10px',
            background: 'var(--bg-2)', color: 'var(--fg-0)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'inherit',
          }}
        />
      </div>

      {/* 接口分组列表 */}
      {loading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
          <Icon name="loader-2" size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {proxyTx(tr, lang, 'token.apiDoc.loading', '正在加载受保护 OpenAPI 3.0.3 规范…', 'Loading OpenAPI 3.0.3 specification...')}
        </div>
      ) : error ? (
        <div style={{
          padding: '12px 14px', borderRadius: 6,
          background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12,
        }}>
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" icon="rotate-cw" onClick={loadSpec}>
            {proxyTx(tr, lang, 'common.retry', '重试', 'Retry')}
          </Button>
        </div>
      ) : groupedMap.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
          {proxyTx(tr, lang, 'token.apiDoc.noMatch', '未找到匹配的开放接口', 'No matching endpoints')}
        </div>
      ) : (
        groupedMap.map(([groupName, items], gi) => (
          <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-1)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {groupName}
              </span>
              <span className="mono num" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                ({items.length})
              </span>
            </div>
            {items.map((ep, idx) => (
              <OpenApiEndpointItem
                key={`${ep.method}-${ep.path}`}
                ep={ep}
                activeToken={activeToken}
                tr={tr}
                lang={lang}
                shell={shell}
                defaultExpanded={gi === 0 && idx === 0}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function useOpenApiDocsDrawer() {
  const shell = useShell();
  const { t: tr, lang } = useT();
  return React.useCallback((opts = {}) => {
    shell.openDrawer({
      width: 680,
      icon: 'book-open',
      iconColor: 'var(--violet)',
      title: proxyTx(tr, lang, 'token.apiDoc.drawerTitle', '内置交互式 OpenAPI 调试文档', 'Built-in Interactive OpenAPI Docs'),
      subtitle: proxyTx(tr, lang, 'token.apiDoc.drawerSub', 'OpenAPI 3.0.3 · 自动注入当前 Token 生成 Bearer cURL 与在线请求调试', 'OpenAPI 3.0.3 · Auto Bearer cURL & Live Request Runner'),
      body: (
        <OpenApiDocsDrawerBody
          initialToken={opts.tokenValue || ''}
          initialHasToken={!!opts.hasToken}
          initialTokenName={opts.tokenName || ''}
        />
      ),
    });
  }, [shell, tr, lang]);
}

function KeyConfigPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const openApiDocsDrawer = useOpenApiDocsDrawer();
  const [exportingSpec, setExportingSpec] = React.useState(false);

  // ─── Token 配置 state (对应 apiTokenConfig) ───
  const [cfg, setCfg] = React.useState({ tokenName: '', expirationDays: 30, description: '', allowSwaggerAccess: true });

  // ─── Token 状态 (对应 tokenStatus + apiTokenConfig.tokenValue) ───
  const [tokenStatus, setTokenStatus] = React.useState({ enabled: false, hasToken: false, tokenName: '', generatedAt: '', expiresAt: '', daysUntilExpiration: 0, isExpired: false, description: '', tokenValue: '', allowSwaggerAccess: true });
  const tokenAvailability = window.ociTokenAvailability(tokenStatus);
  const tokenUsable = tokenAvailability === 'valid' || tokenAvailability === 'expiring';

  const [showToken, setShowToken] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const hydrateToken = React.useCallback((payload) => {
    const d = payload?.data || payload || {};
    const c = d.config || d;
    const s = d.status || d;
    setCfg({ tokenName: c.tokenName || s.tokenName || '', expirationDays: Number(c.expirationDays ?? 30), description: c.description || s.description || '', allowSwaggerAccess: c.allowSwaggerAccess ?? s.allowSwaggerAccess ?? true });
    setTokenStatus({ enabled: !!(s.enabled ?? c.enabled), hasToken: !!(s.hasToken ?? c.tokenValue), tokenName: s.tokenName || c.tokenName || '', generatedAt: s.createdAt || c.createdAt || '', expiresAt: s.expiresAt || c.expiresAt || '', daysUntilExpiration: Number(s.daysUntilExpiration ?? 0), isExpired: !!s.isExpired, description: s.description || c.description || '', tokenValue: c.tokenValue || '', allowSwaggerAccess: s.allowSwaggerAccess ?? c.allowSwaggerAccess ?? true });
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
              background: tokenUsable ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: tokenUsable ? 'var(--accent)' : 'var(--fg-3)',
              fontSize: 10.5, fontWeight: 600,
              border: '1px solid ' + (tokenUsable ? 'var(--accent)' : 'var(--border)'),
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: tokenUsable ? 'var(--accent)' : 'var(--fg-3)',
                animation: tokenUsable ? 'pulse-dot 2s infinite' : 'none',
              }} />
              {tokenAvailabilityLabel(tokenAvailability, lang)}
            </span>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <TokenInfoItem label={tr("token.info.name")} value={tokenStatus.tokenName || tr("token.unset")} />
            <TokenInfoItem label={tr("token.info.status")} value={tokenAvailabilityLabel(tokenAvailability, lang)} />
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
                    {tokenAvailability === 'expired' || tokenAvailability === 'unknown' ? tokenAvailabilityLabel(tokenAvailability, lang) : tr('token.days').replace('{n}', tokenStatus.daysUntilExpiration)}
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
                height={32} width={160}>
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
            <ApiDocActionRow
              title={proxyTx(tr, lang, 'token.apiDoc.openInteractive', '打开内置交互文档', 'Open Built-in Interactive Docs')}
              subtitle={proxyTx(tr, lang, 'token.apiDoc.interactiveSub', '按分组浏览 6 个开放接口、自动带入当前 Token 复制 cURL 并在线调试', 'Browse 6 Open API endpoints, copy Bearer cURL, and run live requests')}
              badge="OpenAPI 3.0.3"
              icon="terminal"
              trailingIcon="panel-right-open"
              color="var(--violet)"
              onClick={() => openApiDocsDrawer({
                tokenValue: tokenStatus.tokenValue,
                hasToken: tokenStatus.hasToken && tokenStatus.enabled,
                tokenName: tokenStatus.tokenName,
              })}
            />
            <ApiDocActionRow
              title={proxyTx(tr, lang, 'token.apiDoc.exportJson', '导出 OpenAPI 3.0.3 JSON', 'Export OpenAPI 3.0.3 JSON')}
              subtitle={proxyTx(tr, lang, 'token.apiDoc.exportSub', '下载受保护规范文件 oci-pool-openapi-3.0.3.json（支持导入 Postman / Apifox）', 'Download oci-pool-openapi-3.0.3.json for Postman / Apifox')}
              badge="oci-pool-openapi-3.0.3.json"
              icon="download"
              trailingIcon={exportingSpec ? 'loader-2' : 'download'}
              color="var(--info)"
              disabled={exportingSpec}
              onClick={async () => {
                setExportingSpec(true);
                try {
                  await downloadOpenApiSpecJson(shell, tr, lang);
                } catch (e) {
                  shell.showToast(e.message || proxyTx(tr, lang, 'token.apiDoc.loadFail', '获取 OpenAPI 规范失败', 'Failed to export OpenAPI JSON'), { kind: 'error' });
                } finally {
                  setExportingSpec(false);
                }
              }}
            />
          </div>
          <div style={{
            marginTop: 12, padding: 10,
            background: 'var(--info-soft)', color: 'var(--info)',
            border: '1px solid color-mix(in srgb, var(--info) 40%, var(--border))', borderRadius: 'var(--radius-sm)',
            fontSize: 11, lineHeight: 1.6,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Icon name="info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                {proxyTx(
                  tr,
                  lang,
                  'token.apiDoc.protectedNotice',
                  '已关闭匿名公开文档端点，内置交互式文档受平台登录态保护；外部客户端调用 /oci-pool/open-api/v1/** 请携带上方生成的 Bearer Token。',
                  'Anonymous public doc endpoints are disabled. Built-in docs require login; external clients calling /oci-pool/open-api/v1/** must send the Bearer Token.'
                )}
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
                background: 'var(--surface-code)', color: 'var(--on-dark)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: 12, fontFamily: 'var(--font-mono)',
                overflow: 'auto', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--on-dark-soft)' }}>Authorization: </span>
                <span style={{ color: 'var(--on-dark)', fontWeight: 600 }}>Bearer </span>
                <span style={{ color: 'var(--accent)' }}>{'{your_token}'}</span>
              </pre>
              <button type="button"
                onClick={() => copyText('Authorization: Bearer {your_token}', tr('token.usage.copyLabel'))}
                title={tr("common.copy")}
                style={{
                  position: 'absolute', right: 6, top: 6,
                  width: 28, height: 28, padding: 0,
                  background: 'transparent', color: 'var(--on-dark-soft)',
                  border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
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
function FormRow({ label, required, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: 'var(--fg-1)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── 内部组件:API 文档交互操作行 ───
function ApiDocActionRow({ title, subtitle, badge, icon, trailingIcon = 'chevron-right', color, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        padding: '10px 12px',
        background: 'var(--bg-2)', color: 'var(--fg-0)',
        border: '1px solid var(--border)', borderRadius: 'var(--button-radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        transition: 'border-color 100ms, background 100ms',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = 'var(--bg-3)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
        background: 'color-mix(in srgb, ' + color + ' 16%, var(--bg-1))',
        color: color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>{subtitle}</div>
      </div>
      {badge && (
        <div className="mono" style={{
          fontSize: 10, color: 'var(--fg-2)', background: 'var(--bg-1)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', flexShrink: 0,
        }}>
          {badge}
        </div>
      )}
      <Icon name={trailingIcon} size={14} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
    </button>
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

// ─── 1b. 代理密钥配置(域名服务商配置)─────────────────────
// 挂在"域名与 CDN"分组下 · Cloudflare + 腾讯云 EdgeOne 双卡
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
    setConfigError('');
    window.ociServices.system.domainProviderConfigs().then(result => {
      if (!alive) return;
      if (result && result.success === false) throw new Error(result.message || tr('dnsp.load.fail'));
      const d = result?.data || result || {};
      const c = d.cloudflare || {};
      const e = d.edgeOne || d.edgeone || {};
      setCf(v => ({ ...v, enabled: !!c.enabled, connected: null, apiKey: c.apiToken || '', zoneId: c.zoneId || '', email: c.email || '' }));
      setEo(v => ({ ...v, enabled: !!e.enabled, connected: null, secretId: e.secretId || '', secretKey: e.secretKey || '', region: e.region || '' }));
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
      setCf(c => ({ ...c, connected: ok }));
      shell.showToast(ok ? tr('dnsp.cf.testOk') : tr('dnsp.cf.testFail'), { kind: ok ? 'success' : 'error' });
    }
    catch (e) { setCf(c => ({ ...c, connected: false })); shell.showToast(e.message || tr('dnsp.cf.testFail'), { kind: 'error' }); }
    finally { setCfTesting(false); }
  };
  const saveCf = async () => {
    if (cf.enabled && (!cf.apiKey.trim() || !cf.email.trim())) { shell.showToast(tr('dnsp.cf.fill'), { kind: 'warn' }); return; }
    try { await window.ociServices.system.updateCloudflareConfig(cf); shell.showToast(tr('dnsp.cf.saved'), { kind: 'success' }); }
    catch (e) { shell.showToast(e.message || tr('proxy.save.fail'), { kind: 'error' }); }
  };
  const testEo = async () => {
    if (!eo.secretId.trim() || !eo.secretKey.trim()) { shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' }); return; }
    setEoTesting(true);
    try {
      const result = await window.ociServices.system.testEdgeOneConnection(eo);
      const ok = !!(result?.success ?? result?.data?.success);
      setEo(e => ({ ...e, connected: ok }));
      shell.showToast(ok ? tr('dnsp.eo.testOk') : tr('dnsp.eo.testFail'), { kind: ok ? 'success' : 'error' });
    }
    catch (e) { setEo(v => ({ ...v, connected: false })); shell.showToast(e.message || tr('dnsp.eo.testFail'), { kind: 'error' }); }
    finally { setEoTesting(false); }
  };
  const saveEo = async () => {
    if (eo.enabled && (!eo.secretId.trim() || !eo.secretKey.trim())) { shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' }); return; }
    try { await window.ociServices.system.updateEdgeOneConfig(eo); shell.showToast(tr('dnsp.eo.saved'), { kind: 'success' }); }
    catch (e) { shell.showToast(e.message || tr('proxy.save.fail'), { kind: 'error' }); }
  };

  // SecretInput / ProviderHeader 已提取到外部(见文件下方)
  // 避免在父组件内嵌导致 input 每次 render 都重挂 → 密码框刚点击就失焦

  // ─── 服务商卡片头部(标题 + 连接/启用状态徽章 + 启用开关) ───
  const ProviderHeader = ({ icon, iconColor, name, connected, enabled, onToggle }) => {
    let badgeText = tr('dnsp.disabled');
    let badgeColor = 'var(--fg-3)';
    let badgeBg = 'var(--bg-3)';
    let badgeBorder = 'var(--border)';

    if (connected === true) {
      badgeText = tr('dnsp.connected');
      badgeColor = 'var(--accent)';
      badgeBg = 'var(--accent-soft)';
      badgeBorder = 'var(--accent)';
    } else if (connected === false) {
      badgeText = tr('dnsp.disconnected');
      badgeColor = 'var(--danger)';
      badgeBg = 'var(--danger-soft)';
      badgeBorder = 'var(--danger)';
    } else if (enabled) {
      badgeText = tr('dnsp.enabled');
      badgeColor = 'var(--accent)';
      badgeBg = 'var(--accent-soft)';
      badgeBorder = 'var(--accent)';
    }

    return (
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
        {/* 状态徽章 */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 10,
          background: badgeBg,
          color: badgeColor,
          fontSize: 10.5, fontWeight: 600,
          border: '1px solid ' + badgeBorder,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: badgeColor }} />
          {badgeText}
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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.keyConfig')}
        subtitle={tr('dnsp.subtitle')}
        icon="key"
        iconColor="var(--orange)"
        actions={configLoading ? (
          /* 静默后台加载 · 右上角微状态（对齐 UI_STANDARD 1.8：不加全局大遮罩） */
          <span title={tr('dnsp.loading')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              fontSize: 11.5, color: 'var(--fg-2)', whiteSpace: 'nowrap',
            }}>
            <Icon name="loader-2" size={12} className="spin" style={{ opacity: 0.6 }} />
            {tr('dnsp.loading')}
          </span>
        ) : null}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
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
          <div className="provider-grid">
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
                connected={cf.connected}
                enabled={cf.enabled}
                onToggle={e => { setCf(c => ({ ...c, enabled: e.target.checked })); }}
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
                  const hasCred = cf.apiKey.trim() && cf.email.trim();
                  const canSave = !cf.enabled || hasCred;
                  return (
                    <>
                      <Button variant="info" size="sm" icon="zap"
                        loading={cfTesting} disabled={!hasCred}
                        onClick={testCf}>{tr('dnsp.testConn')}</Button>
                      <Button variant="primary" size="sm" icon="save"
                        disabled={!canSave}
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
                connected={eo.connected}
                enabled={eo.enabled}
                onToggle={e => { setEo(ee => ({ ...ee, enabled: e.target.checked })); }}
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
                  const hasCred = eo.secretId.trim() && eo.secretKey.trim();
                  const canSave = !eo.enabled || hasCred;
                  return (
                    <>
                      <Button variant="info" size="sm" icon="zap"
                        loading={eoTesting} disabled={!hasCred}
                        onClick={testEo}>{tr('dnsp.testConn')}</Button>
                      <Button variant="primary" size="sm" icon="save"
                        disabled={!canSave}
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
function extractCloudflarePublicIps(records, { typeFilter = 'ALL', proxyFilter = 'ALL', keyword = '' } = {}) {
  if (!Array.isArray(records)) return [];
  const normType = String(typeFilter || 'ALL').trim().toUpperCase();
  const normProxy = typeof proxyFilter === 'boolean'
    ? (proxyFilter ? 'PROXIED' : 'DNS_ONLY')
    : String(proxyFilter || 'ALL').trim().toUpperCase();
  const kw = String(keyword || '').trim().toLowerCase();
  const seen = new Set();
  const result = [];

  for (let i = 0; i < records.length; i += 1) {
    const r = records[i];
    if (!r || typeof r !== 'object') continue;
    const rType = String(r.type || '').trim().toUpperCase();
    if (rType !== 'A' && rType !== 'AAAA') continue;
    if (normType !== 'ALL' && normType !== '' && rType !== normType) continue;

    const isProxied = Boolean(r.proxied);
    if ((normProxy === 'PROXIED' || normProxy === 'ORANGE' || normProxy === 'TRUE') && !isProxied) continue;
    if ((normProxy === 'DNS_ONLY' || normProxy === 'GREY' || normProxy === 'DIRECT' || normProxy === 'UNPROXIED' || normProxy === 'FALSE') && isProxied) continue;

    if (kw) {
      const domainName = String(r.name || '').toLowerCase();
      if (!domainName.includes(kw)) continue;
    }

    const ip = String(r.content || '').trim();
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    result.push(ip);
  }

  return result;
}
// --- END CF PUBLIC IP HELPERS ---

function CfOfficialIpsDrawerBody() {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState(null);

  const fetchRanges = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.ociServices.proxy.cloudflareOfficialIps();
      if (res && res.success === false) {
        throw new Error(res.message || proxyTx(tr, lang, 'dnsp.cf.officialIpsFail', '获取 Cloudflare 官方回源网段失败', 'Failed to fetch Cloudflare official IP ranges'));
      }
      setData(res?.data || res || {});
    } catch (e) {
      setError(e?.message || proxyTx(tr, lang, 'dnsp.cf.officialIpsFail', '获取 Cloudflare 官方回源网段失败', 'Failed to fetch Cloudflare official IP ranges'));
    } finally {
      setLoading(false);
    }
  }, [tr, lang]);

  React.useEffect(() => {
    fetchRanges();
  }, [fetchRanges]);

  const ipv4Cidrs = Array.isArray(data?.ipv4Cidrs) ? data.ipv4Cidrs : [];
  const ipv6Cidrs = Array.isArray(data?.ipv6Cidrs) ? data.ipv6Cidrs : [];
  const source = String(data?.source || 'fallback');
  const isRemote = source === 'remote';

  const nginxSnippet = React.useMemo(() => {
    if (data?.nginxRealIpSnippet) return String(data.nginxRealIpSnippet);
    const lines = ['# Cloudflare Official Origin Real IP'];
    ipv4Cidrs.forEach(c => lines.push(`set_real_ip_from ${c};`));
    ipv6Cidrs.forEach(c => lines.push(`set_real_ip_from ${c};`));
    lines.push('real_ip_header CF-Connecting-IP;');
    lines.push('real_ip_recursive on;');
    return lines.join('\n');
  }, [data?.nginxRealIpSnippet, ipv4Cidrs, ipv6Cidrs]);

  const copyBlock = (txt, label) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt);
    shell.showToast(proxyTx(tr, lang, 'dnsp.cf.copiedBlock', `已复制 ${label}`, `Copied ${label}`), { kind: 'success', duration: 1600 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 数据源状态栏 */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--radius)',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: isRemote ? 'var(--success-soft)' : 'var(--orange-soft)',
            color: isRemote ? 'var(--success)' : 'var(--orange)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRemote ? 'var(--success)' : 'var(--orange)' }} />
            {isRemote
              ? proxyTx(tr, lang, 'dnsp.cf.sourceRemote', '实时官方网段 (remote)', 'Live Cloudflare API (remote)')
              : proxyTx(tr, lang, 'dnsp.cf.sourceFallback', '内置离线兜底 (fallback)', 'Built-in Fallback (fallback)')}
          </span>
          {data?.fetchedAt && (
            <span className="mono" title={data.fetchedAt} style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
              {formatLocalTimestamp(data.fetchedAt)}
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" icon="rotate-cw" loading={loading} onClick={fetchRanges}>
          {proxyTx(tr, lang, 'common.refresh', '刷新', 'Refresh')}
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
          <Icon name="loader-2" size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {proxyTx(tr, lang, 'dnsp.cf.loadingIps', '正在获取 Cloudflare 官方回源 CIDR 网段…', 'Loading Cloudflare origin CIDRs...')}
        </div>
      ) : error ? (
        <div style={{
          padding: '12px 14px', borderRadius: 6,
          background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12,
        }}>
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" icon="rotate-cw" onClick={fetchRanges}>
            {proxyTx(tr, lang, 'common.retry', '重试', 'Retry')}
          </Button>
        </div>
      ) : (
        <>
          {/* IPv4 / IPv6 分栏 CIDR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
                  IPv4 CIDRs <span className="mono num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({ipv4Cidrs.length})</span>
                </span>
                <Button type="button" variant="outline" size="sm" icon="copy" onClick={() => copyBlock(ipv4Cidrs.join('\n'), 'IPv4 CIDRs')}>
                  {proxyTx(tr, lang, 'common.copy', '复制', 'Copy')}
                </Button>
              </div>
              <pre style={{
                margin: 0, padding: '8px 10px', maxHeight: 190, overflow: 'auto',
                background: 'var(--surface-code)', color: 'var(--on-dark)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55,
              }}>
                {ipv4Cidrs.join('\n') || '—'}
              </pre>
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
                  IPv6 CIDRs <span className="mono num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({ipv6Cidrs.length})</span>
                </span>
                <Button type="button" variant="outline" size="sm" icon="copy" onClick={() => copyBlock(ipv6Cidrs.join('\n'), 'IPv6 CIDRs')}>
                  {proxyTx(tr, lang, 'common.copy', '复制', 'Copy')}
                </Button>
              </div>
              <pre style={{
                margin: 0, padding: '8px 10px', maxHeight: 190, overflow: 'auto',
                background: 'var(--surface-code)', color: 'var(--on-dark)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55,
              }}>
                {ipv6Cidrs.join('\n') || '—'}
              </pre>
            </div>
          </div>

          {/* Nginx real_ip 配置片段 */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>
                  {proxyTx(tr, lang, 'dnsp.cf.nginxTitle', 'Nginx 还原访客真实 IP 配置 (CF-Connecting-IP)', 'Nginx Origin Real IP Snippet (CF-Connecting-IP)')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  {proxyTx(tr, lang, 'dnsp.cf.nginxHint', '放入 http {} 或 server {} 块中（需启用 ngx_http_realip_module）', 'Place inside http {} or server {} block (requires ngx_http_realip_module)')}
                </div>
              </div>
              <Button type="button" variant="primary" size="sm" icon="copy" onClick={() => copyBlock(nginxSnippet, 'Nginx real_ip')}>
                {proxyTx(tr, lang, 'dnsp.cf.copyNginx', '一键复制 Nginx 配置', 'Copy Nginx Config')}
              </Button>
            </div>
            <pre style={{
              margin: 0, padding: '10px 12px', maxHeight: 240, overflow: 'auto',
              background: 'var(--surface-code)', color: 'var(--on-dark)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.55,
            }}>
              {nginxSnippet}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function CfPublicIpExtractDrawerBody({ records, zoneName }) {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const [typeFilter, setTypeFilter] = React.useState('ALL');
  const [proxyFilter, setProxyFilter] = React.useState('ALL');
  const [keyword, setKeyword] = React.useState('');

  const extractedIps = React.useMemo(
    () => extractCloudflarePublicIps(records, { typeFilter, proxyFilter, keyword }),
    [records, typeFilter, proxyFilter, keyword]
  );

  const totalIpRecords = React.useMemo(
    () => (Array.isArray(records) ? records.filter(r => ['A', 'AAAA'].includes(String(r?.type || '').toUpperCase())).length : 0),
    [records]
  );

  const copyBatch = (sep, label) => {
    if (extractedIps.length === 0) {
      shell.showToast(proxyTx(tr, lang, 'dnsp.copy.empty', '内容为空,无法复制', 'Nothing to copy'), { kind: 'warn' });
      return;
    }
    navigator.clipboard?.writeText(extractedIps.join(sep));
    shell.showToast(
      proxyTx(tr, lang, 'dnsp.cf.extractCopied', `✓ 已按${label}复制 ${extractedIps.length} 个公网 IP`, `✓ Copied ${extractedIps.length} IPs (${label})`),
      { kind: 'success' }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 筛选条件 */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-1)' }}>
            {proxyTx(tr, lang, 'dnsp.cf.filterRecordType', '记录类型', 'Record Type')}
          </span>
          <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-1)', padding: 3, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {[
              { id: 'ALL', label: 'ALL (A + AAAA)' },
              { id: 'A', label: 'IPv4 (A)' },
              { id: 'AAAA', label: 'IPv6 (AAAA)' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--button-radius)', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: typeFilter === opt.id ? 'var(--accent)' : 'transparent',
                  color: typeFilter === opt.id ? 'var(--accent-fg)' : 'var(--fg-2)',
                  transition: 'all 120ms',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-1)' }}>
            {proxyTx(tr, lang, 'dnsp.cf.filterProxyMode', '云朵代理状态', 'Proxy Status')}
          </span>
          <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-1)', padding: 3, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {[
              { id: 'ALL', label: proxyTx(tr, lang, 'common.all', '全部状态', 'All') },
              { id: 'PROXIED', label: proxyTx(tr, lang, 'dnsp.cf.orangeCloud', '橙云已代理', 'Proxied (Orange)') },
              { id: 'DNS_ONLY', label: proxyTx(tr, lang, 'dnsp.cf.greyCloud', '灰云仅解析', 'DNS Only (Grey)') },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProxyFilter(opt.id)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--button-radius)', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: proxyFilter === opt.id ? 'var(--accent)' : 'transparent',
                  color: proxyFilter === opt.id ? 'var(--accent-fg)' : 'var(--fg-2)',
                  transition: 'all 120ms',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600 }}>
            {proxyTx(tr, lang, 'dnsp.cf.domainKeyword', '域名前缀 / 关键字过滤', 'Domain Keyword Filter')}
          </label>
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder={zoneName ? `e.g. api.${zoneName}` : 'e.g. api.'}
            style={{
              width: '100%', padding: '7px 10px',
              background: 'var(--bg-1)', color: 'var(--fg-0)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* 操作栏与去重结果 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>
          {proxyTx(tr, lang, 'dnsp.cf.extractCountPrefix', '共去重提取 ', 'Extracted ')}
          <span className="mono num" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{extractedIps.length}</span>
          {proxyTx(tr, lang, 'dnsp.cf.extractCountSuffix', ` 个唯一公网 IP（当前 Zone 共 ${totalIpRecords} 条 A/AAAA 记录）`, ` unique public IPs (from ${totalIpRecords} A/AAAA records)`)}
        </div>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon="copy"
            disabled={extractedIps.length === 0}
            onClick={() => copyBatch('\n', proxyTx(tr, lang, 'dnsp.cf.byNewline', '换行', 'newline'))}
          >
            {proxyTx(tr, lang, 'dnsp.cf.copyNewline', '按换行复制全部', 'Copy (Newline)')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon="copy"
            disabled={extractedIps.length === 0}
            onClick={() => copyBatch(', ', proxyTx(tr, lang, 'dnsp.cf.byComma', '逗号', 'comma'))}
          >
            {proxyTx(tr, lang, 'dnsp.cf.copyComma', '按逗号复制全部', 'Copy (Comma)')}
          </Button>
        </div>
      </div>

      {extractedIps.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center', borderRadius: 'var(--radius)',
          background: 'var(--bg-2)', border: '1px dashed var(--border)',
          color: 'var(--fg-3)', fontSize: 12,
        }}>
          {proxyTx(tr, lang, 'dnsp.cf.extractEmpty', '当前筛选条件下暂无匹配的 A / AAAA 公网 IP 记录', 'No matching A / AAAA public IPs under current filters')}
        </div>
      ) : (
        <>
          <pre style={{
            margin: 0, padding: '12px 14px', maxHeight: 240, overflow: 'auto',
            background: 'var(--surface-code)', color: 'var(--on-dark)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontSize: 11.5, fontFamily: 'var(--font-mono)', lineHeight: 1.6,
          }}>
            {extractedIps.join('\n')}
          </pre>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {extractedIps.map(ip => (
              <button
                key={ip}
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(ip);
                  shell.showToast(`${ip}`, { kind: 'info', duration: 1200 });
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
                className="mono"
                title={proxyTx(tr, lang, 'common.copy', '点击复制', 'Click to copy')}
                style={{
                  padding: '3px 8px', borderRadius: 'var(--button-radius)',
                  background: 'var(--bg-2)', color: 'var(--fg-1)',
                  border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                {ip}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CFManagePage() {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const routeState = window.ociRouter.read();
  const [zones, setZones] = React.useState([]);
  const [zoneId, setZoneId] = React.useState(routeState.query.zoneId || '');
  const currentZone = zones.find(z => z.id === zoneId);
  const [records, setRecords] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isZonesLoading, setIsZonesLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [error, setError] = React.useState('');

  const requireSuccess = (result, fallback) => {
    if (result && result.success === false) throw new Error(result.message || fallback);
    return result;
  };
  const loadRecords = React.useCallback(async () => {
    if (!zoneId) {
      setRecords([]);
      if (!isZonesLoading) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
      return;
    }
    setLoading(true); setRecords([]); setError('');
    try {
      const result = requireSuccess(await window.ociServices.proxy.cloudflareRecords({ zoneId, page: 1, size: 100 }), tr('dnsp.loadFailRecords'));
      const page = result?.data || {};
      setRecords(Array.isArray(page.content) ? page.content : []);
    } catch (e) { setRecords([]); setError(e.message || tr('dnsp.loadFailRecords')); }
    finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [zoneId, isZonesLoading]);
  React.useEffect(() => {
    let alive = true;
    setIsZonesLoading(true);
    window.ociServices.proxy.cloudflareZones().then(result => {
      if (!alive) return;
      requireSuccess(result, tr('dnsp.zoneLoadFail'));
      const next = Array.isArray(result?.data) ? result.data : [];
      setZones(next);
      if (!next.some(z => String(z.id) === String(zoneId))) {
        const first = next[0] ? String(next[0].id) : '';
        setZoneId(first);
        if (first) {
          window.ociRouter.go('cfManage', { zoneId: first }, { replace: true });
        } else {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    }).catch(e => {
      if (alive) {
        setZones([]);
        setError(e.message || tr('dnsp.zoneLoadFail'));
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }).finally(() => {
      if (alive) setIsZonesLoading(false);
    });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => { loadRecords(); }, [loadRecords]);

  const [searchName, setSearchName] = React.useState('');
  const [searchContent, setSearchContent] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('');
  const filtered = records.filter(r =>
    (!selectedType || r.type === selectedType) &&
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
      : { type: 'A', name: '', content: '', ttl: 1, proxied: true, priority: 10 };
    const paint = () => shell.openModal({
      title: isEdit ? tr('dnsp.editRecord') : tr('dnsp.addDnsRecord'),
      icon: isEdit ? 'edit-3' : 'plus',
      iconColor: 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 类型 · 编辑时 readonly */}
          <FormRow label="类型" required>
            {isEdit ? (
              <div style={{
                padding: '0 12px', height: 32, background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span>{s2.type}</span>
                <Icon name="x-circle" size={14} style={{ color: 'var(--fg-3)', opacity: 0.5 }} />
              </div>
            ) : (
              <CustomDropdown value={s2.type} onChange={e => {
                s2.type = e;
                if (!['A', 'AAAA', 'CNAME'].includes(s2.type)) s2.proxied = false;
                paint();
              }} height={32} width="100%">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map(t => <option key={t} value={t}>{t}</option>)}
              </CustomDropdown>
            )}
          </FormRow>

          {/* 记录名 · 编辑时 readonly */}
          <FormRow label="记录名" required>
            {isEdit ? (
              <div style={{
                padding: '0 12px', height: 32, background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 600, fontFamily: 'sans-serif' }}>Aa</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s2.name}</span>
                </div>
                <Icon name="x-circle" size={14} style={{ color: 'var(--fg-3)', opacity: 0.5, flexShrink: 0 }} />
              </div>
            ) : (
              <>
                <TextInput value={s2.name} onChange={v => { s2.name = v; paint(); }} placeholder="@, www, mail" mono />
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>根域名使用 @</div>
              </>
            )}
          </FormRow>

          {/* 记录值 */}
          <FormRow label="记录值" required>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon name="link-2" size={13} style={{ position: 'absolute', left: 10, color: 'var(--fg-3)' }} />
              <input
                type="text"
                value={s2.content}
                onChange={e => { s2.content = e.target.value; paint(); }}
                placeholder="IP 或域名"
                className="mono"
                style={{
                  width: '100%', height: 32, padding: '0 28px 0 30px',
                  background: 'var(--bg-input, var(--bg-2))', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 13, color: 'var(--fg-0)', outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              {s2.content && (
                <button
                  type="button"
                  onClick={() => { s2.content = ''; paint(); }}
                  style={{ position: 'absolute', right: 8, background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', alignItems: 'center' }}
                >
                  <Icon name="x-circle" size={14} />
                </button>
              )}
            </div>
          </FormRow>

          {s2.type === 'MX' && (
            <FormRow label={tr('dnsp.priority')} required>
              <NumberInput value={s2.priority} onChange={v => { s2.priority = v; paint(); }} min={0} max={65535} />
            </FormRow>
          )}

          {/* TTL 与 Cloudflare 代理同行对齐 */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 140, flexShrink: 0 }}>
              <FormRow label="TTL">
                <CustomDropdown value={s2.ttl} onChange={e => { s2.ttl = +e; paint(); }} height={32} width="100%">
                  <option value={1}>{tr('dnsp.auto')}</option>
                  <option value={300}>5 分钟</option>
                  <option value={600}>10 分钟</option>
                  <option value={1800}>30 分钟</option>
                  <option value={3600}>1 小时</option>
                  <option value={7200}>2 小时</option>
                  <option value={18000}>5 小时</option>
                  <option value={43200}>12 小时</option>
                  <option value={86400}>1 天</option>
                </CustomDropdown>
              </FormRow>
            </div>

            {['A', 'AAAA', 'CNAME'].includes(s2.type) && (
              <div style={{ flex: 1 }}>
                <FormRow label="Cloudflare 代理">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
                    <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer', flexShrink: 0, verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={!!s2.proxied}
                        onChange={e => { s2.proxied = e.target.checked; paint(); }}
                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                      />
                      <span style={{
                        position: 'absolute', inset: 0,
                        background: s2.proxied ? '#f38020' : 'var(--bg-3)',
                        border: s2.proxied ? '1px solid #f38020' : '1px solid var(--border)',
                        borderRadius: 999,
                        transition: 'all 150ms ease',
                      }}>
                        <span style={{
                          position: 'absolute', height: 14, width: 14,
                          left: s2.proxied ? 18 : 2, top: 2,
                          background: 'white', borderRadius: '50%',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          transition: 'all 150ms ease',
                        }} />
                      </span>
                    </label>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-3)', userSelect: 'none' }}>
                      橙云代理可隐藏源站 IP
                    </span>
                  </div>
                </FormRow>
              </div>
            )}
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="secondary" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="save"
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
            }}>{isEdit ? tr('common.save') : tr('dnsp.add')}</Button>
        </>
      ),
    });
    paint();
  };

  const openOfficialIpsDrawer = () => {
    shell.openDrawer({
      width: 640,
      icon: 'shield',
      iconColor: 'var(--orange)',
      title: proxyTx(tr, lang, 'dnsp.cf.officialDrawerTitle', 'Cloudflare 官方回源真实 IP / Nginx 配置', 'Cloudflare Official Origin Real IP / Nginx'),
      subtitle: proxyTx(tr, lang, 'dnsp.cf.officialDrawerSub', '获取 Cloudflare IPv4/IPv6 官方回源网段并一键生成 CF-Connecting-IP 还原配置', 'Cloudflare IPv4/IPv6 origin CIDRs & nginxRealIpSnippet generator'),
      body: <CfOfficialIpsDrawerBody />,
    });
  };

  const openExtractIpsDrawer = () => {
    shell.openDrawer({
      width: 580,
      icon: 'copy',
      iconColor: 'var(--cyan)',
      title: proxyTx(tr, lang, 'dnsp.cf.extractDrawerTitle', '解析记录公网 IP 聚合提取', 'DNS Public IP Batch Extractor'),
      subtitle: currentZone?.name
        ? `${currentZone.name} · ${proxyTx(tr, lang, 'dnsp.cf.extractDrawerSub', '按类型、橙云代理与域名前缀筛选去重', 'Filter A/AAAA records & deduplicate preserving order')}`
        : proxyTx(tr, lang, 'dnsp.cf.extractDrawerSub', '按类型、橙云代理与域名前缀筛选去重', 'Filter A/AAAA records & deduplicate preserving order'),
      body: <CfPublicIpExtractDrawerBody records={records} zoneName={currentZone?.name || ''} />,
    });
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
            <span style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{tr('dnsp.zone')}</span>
            <CustomDropdown value={zoneId} onChange={e => { setZoneId(e); setRecords([]); setLoading(true); window.ociRouter.go('cfManage', e ? { zoneId: e } : {}, { replace: true }); }} height={32} width="220px">
              <option value="">{tr('dnsp.selectZone')}</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </CustomDropdown>
            <Button variant="orange" size="md" icon="key" onClick={openConfigModal}>{tr('nav.proxyKeyConfig')}</Button>
            <Button variant="outline" size="md" icon="shield" onClick={openOfficialIpsDrawer}>
              {proxyTx(tr, lang, 'dnsp.cf.officialIpsBtn', '回源 IP / Nginx', 'Origin IP / Nginx')}
            </Button>
            <Button variant="outline" size="md" icon="copy" disabled={!zoneId} onClick={openExtractIpsDrawer}>
              {proxyTx(tr, lang, 'dnsp.cf.extractIpsBtn', '提取公网 IP', 'Extract Public IPs')}
            </Button>
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
      {/* 搜索栏 · 严格对齐客户端 · 类型下拉 + 按名称/按值双输入 + 搜索按钮 + 清除按钮 */}
      <div style={{
        display: 'flex', gap: 10, padding: 10, marginBottom: 12,
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>类型:</span>
        <CustomDropdown
          value={selectedType}
          onChange={t => setSelectedType(t)}
          height={32}
          width="110px"
        >
          <option value="">全部类型</option>
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="CNAME">CNAME</option>
          <option value="MX">MX</option>
          <option value="TXT">TXT</option>
        </CustomDropdown>

        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByName')}</span>
        <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
          placeholder="e.g. www"
          style={{ flex: 1, minWidth: 0, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.searchByValue')}</span>
        <input type="text" value={searchContent} onChange={e => setSearchContent(e.target.value)}
          placeholder="e.g. 192.9"
          style={{ flex: 1, minWidth: 0, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
        <button onClick={() => shell.showToast(tr('dnsp.searchFound').replace('{n}', filtered.length), { kind: 'info' })}
          style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 14px', background: 'var(--info)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="search" size={11} />{tr('dnsp.search')}
        </button>
        <button onClick={() => { setSearchName(''); setSearchContent(''); setSelectedType(''); }}
          disabled={!searchName && !searchContent && !selectedType}
          style={{
            flexShrink: 0, whiteSpace: 'nowrap',
            padding: '6px 12px',
            background: (searchName || searchContent || selectedType) ? 'var(--danger-soft)' : 'var(--bg-2)',
            color: (searchName || searchContent || selectedType) ? 'var(--danger)' : 'var(--fg-3)',
            border: '1px solid ' + ((searchName || searchContent || selectedType) ? 'var(--danger)' : 'var(--border)'),
            borderRadius: 4,
            cursor: (searchName || searchContent || selectedType) ? 'pointer' : 'not-allowed',
            fontSize: 12, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
          <Icon name="x" size={11} />{tr('dnsp.clear')}
        </button>
      </div>

      {/* DNS 记录表格 · 严格 6 列，对齐客户端单行不折叠与绝对居中 */}
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
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                {[
                  { h: tr('dnsp.type'),        w: 80,  align: 'center' },
                  { h: tr('dnsp.name'),        w: 220, align: 'center' },
                  { h: tr('dnsp.value'),               align: 'center' },
                  { h: tr('dnsp.ttl'),         w: 90,  align: 'center' },
                  { h: tr('dnsp.proxyStatus'), w: 100, align: 'center' },
                  { h: tr('dnsp.operation'),   w: 88,  align: 'center' },
                ].map((c, i) => (
                  <th key={i} style={{
                    textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                    background: 'var(--bg-2)', color: 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ opacity: (loading && filtered.length > 0) ? 0.6 : 1, transition: 'opacity 120ms' }}>
              {(loading || !hasLoadedOnce) && filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                    <span style={{ fontSize: 13 }}>{tr('dnsp.loadingRecords')}</span>
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 0 }}>
                  <EmptyState
                    icon="cloud"
                    title={zones.length === 0 ? '暂无可用域名' : (!zoneId ? '请选择域名' : '暂无 DNS 记录')}
                    subtitle={zones.length === 0 ? '请先在「密钥配置」中填写 Cloudflare API Key' : (!zoneId ? '从上方下拉选择要管理的 Zone' : '点击「添加记录」创建解析')}
                    actionLabel={zones.length === 0 ? '密钥配置' : (!zoneId ? null : '添加记录')}
                    onAction={zones.length === 0 ? openConfigModal : (!zoneId ? null : () => openDnsModal(null))}
                  />
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                  {/* 类型 */}
                  <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{
                      padding: '2px 8px', borderRadius: 3,
                      background: 'color-mix(in oklab, ' + (typeColor[r.type] || 'var(--fg-2)') + ' 18%, transparent)',
                      color: typeColor[r.type] || 'var(--fg-2)',
                      fontSize: 10.5, fontWeight: 700,
                    }}>{r.type}</span>
                  </td>

                  {/* 名称 - 单行省略，不换行 */}
                  <td style={{
                    padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)' }} title={r.name}>{r.name}</span>
                  </td>

                  {/* 值 - 单行省略，MX 显示橙色优先级胶囊 */}
                  <td style={{
                    padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflow: 'hidden' }}>
                      <span className="mono" style={{
                        fontSize: 11.5, color: 'var(--fg-1)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={r.content}>
                        {r.content}
                      </span>
                      {r.type === 'MX' && r.priority != null && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 3,
                          background: 'var(--orange-soft)', color: 'var(--orange)',
                          fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          flexShrink: 0,
                        }}>
                          优先级 {r.priority}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* TTL - 严格居中 */}
                  <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{ttlLabel(r.ttl)}</span>
                  </td>

                  {/* 代理状态 - 严格居中，彩色小点 */}
                  <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    {['A', 'AAAA', 'CNAME'].includes(r.type) ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '2px 8px', borderRadius: 10,
                        background: r.proxied ? 'var(--orange-soft)' : 'var(--bg-3)',
                        color: r.proxied ? 'var(--orange)' : 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 500,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.proxied ? 'var(--orange)' : 'var(--fg-3)', flexShrink: 0 }} />
                        {r.proxied ? tr('dnsp.proxied') : tr('dnsp.dnsOnly')}
                      </span>
                    ) : <span style={{ color: 'var(--fg-3)' }}>—</span>}
                  </td>

                  {/* 操作按钮 - 居中对齐 */}
                  <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
                      <button title={tr('common.edit')} onClick={() => openDnsModal(r)}
                        style={{ width: 26, height: 26, background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="edit" size={12} />
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
                        style={{ width: 26, height: 26, background: 'var(--danger-soft)', color: 'var(--danger)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="trash-2" size={12} />
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
//   · 顶部工具:密钥配置 + 同步 + 刷新列表
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
  const [isZonesLoading, setIsZonesLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
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
    if (!zoneId) {
      setDnsRecords([]);
      setDomains([]);
      if (!isZonesLoading) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
      return;
    }
    setLoading(true); setDnsRecords([]); setDomains([]); setError('');
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
    finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [zoneId, isZonesLoading]);
  const reloadZones = React.useCallback(async () => {
    setIsZonesLoading(true);
    setError('');
    try {
      const result = await window.ociServices.proxy.edgeOneZones();
      requireSuccess(result, tr('dnsp.eo.zoneLoadFail'));
      const next = Array.isArray(result?.data) ? result.data : [];
      setZones(next);
      if (!next.some(z => String(z.id) === String(zoneId))) {
        const first = next[0] ? String(next[0].id) : '';
        setZoneId(first);
        if (first) {
          window.ociRouter.go('eoManage', { zoneId: first }, { replace: true });
        } else {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    } catch (e) {
      setZones([]);
      setError(e.message || tr('dnsp.eo.zoneLoadFail'));
      setLoading(false);
      setHasLoadedOnce(true);
    } finally {
      setIsZonesLoading(false);
    }
  }, [zoneId]);

  React.useEffect(() => {
    reloadZones();
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

  const isNotConfigured = Boolean(
    error && (error.includes('未配置') || error.includes('未启用') || error.toLowerCase().includes('not configured'))
  );
  const hasNoZones = Boolean(!isZonesLoading && !isNotConfigured && !error && zones.length === 0);

  const openConfigModal = async () => {
    let cfg = {
      enabled: false,
      secretId: '',
      secretKey: '',
      region: 'ap-beijing',
      showSecretId: false,
      showSecretKey: false,
    };
    let testing = false;
    let saving = false;

    try {
      const resp = await window.ociServices.system.domainProviderConfigs();
      if (resp && resp.edgeOne) {
        cfg.enabled = !!resp.edgeOne.enabled;
        cfg.secretId = resp.edgeOne.secretId || '';
        cfg.secretKey = resp.edgeOne.secretKey || '';
        cfg.region = resp.edgeOne.region || 'ap-beijing';
      }
    } catch (e) {}

    const copy = (val) => {
      if (!val) return;
      navigator.clipboard.writeText(val);
      shell.showToast(tr('common.copied') || '已复制', { kind: 'success' });
    };

    const paint = () => shell.openModal({
      title: 'EdgeOne 密钥配置',
      subtitle: 'Tencent EdgeOne · API 凭据管理',
      icon: 'key',
      iconColor: 'var(--orange)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          {/* 启用开关行 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 6, marginBottom: 14,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>启用 EdgeOne</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>开启后可管理腾讯云 EdgeOne DNS 记录与加速域名</div>
            </div>
            <ToggleSwitch
              value={cfg.enabled}
              onChange={v => { cfg.enabled = v; paint(); }}
            />
          </div>

          {/* SecretId */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 12, color: 'var(--fg-1)' }}>
              <span>SecretId</span>
              <span style={{ color: 'var(--danger)' }}>*</span>
            </div>
            <SecretInputExternal
              value={cfg.secretId}
              onChange={v => { cfg.secretId = v; paint(); }}
              show={cfg.showSecretId}
              onToggleShow={() => { cfg.showSecretId = !cfg.showSecretId; paint(); }}
              placeholder={tr('dnsp.eo.idPh')}
              onCopy={copy}
            />
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
              value={cfg.secretKey}
              onChange={v => { cfg.secretKey = v; paint(); }}
              show={cfg.showSecretKey}
              onToggleShow={() => { cfg.showSecretKey = !cfg.showSecretKey; paint(); }}
              placeholder={tr('dnsp.eo.keyPh')}
              onCopy={copy}
            />
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 5 }}>
              {tr('dnsp.eo.keyHint')}
            </div>
          </div>
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button
            variant="outline"
            size="md"
            icon="zap"
            loading={testing}
            onClick={async () => {
              if (!cfg.secretId.trim() || !cfg.secretKey.trim()) {
                shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' });
                return;
              }
              testing = true; paint();
              try {
                const res = await window.ociServices.system.testEdgeOneConnection(cfg);
                const ok = !!(res?.success ?? res?.data?.success);
                shell.showToast(ok ? tr('dnsp.eo.testOk') : (res?.message || tr('dnsp.eo.testFail')), { kind: ok ? 'success' : 'error' });
              } catch (err) {
                shell.showToast(err.message || tr('dnsp.eo.testFail'), { kind: 'error' });
              } finally {
                testing = false; paint();
              }
            }}
          >
            {tr('dnsp.testConn')}
          </Button>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>
              {tr('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="check"
              loading={saving}
              onClick={async () => {
                if (!cfg.secretId.trim() || !cfg.secretKey.trim()) {
                  shell.showToast(tr('dnsp.eo.fill'), { kind: 'warn' });
                  return;
                }
                saving = true; paint();
                try {
                  await window.ociServices.system.updateEdgeOneConfig(cfg);
                  shell.showToast(tr('dnsp.eo.saved'), { kind: 'success' });
                  shell.closeModal();
                  // 重新拉取域名和列表
                  setError('');
                  window.ociServices.proxy.edgeOneZones().then(result => {
                    const next = Array.isArray(result?.data) ? result.data : [];
                    setZones(next);
                    if (next.length > 0) {
                      const first = String(next[0].id);
                      setZoneId(first);
                      window.ociRouter.go('eoManage', { zoneId: first }, { replace: true });
                    }
                  }).catch(e => {
                    setZones([]);
                    setError(e.message || tr('dnsp.eo.zoneLoadFail'));
                  });
                } catch (err) {
                  shell.showToast(err.message || tr('proxy.save.fail'), { kind: 'error' });
                } finally {
                  saving = false; paint();
                }
              }}
            >
              {tr('dnsp.saveConfig')}
            </Button>
          </div>
        </div>
      ),
    });
    paint();
  };

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
            <span style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{tr('dnsp.zone')}</span>
            <CustomDropdown
              value={zoneId}
              onChange={e => { setZoneId(e); setDnsRecords([]); setDomains([]); setLoading(true); window.ociRouter.go('eoManage', e ? { zoneId: e } : {}, { replace: true }); }}
              height={32}
              width="220px"
              disabled={isNotConfigured || zones.length === 0}
            >
              <option value="">{isNotConfigured ? tr('dnsp.eo.noKeyPh') : (hasNoZones ? tr('dnsp.eo.noZonesPh') : tr('dnsp.selectZone'))}</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </CustomDropdown>
            <Button variant="orange" size="md" icon="key" onClick={openConfigModal}>{tr('nav.proxyKeyConfig')}</Button>
            {tab === 'dns' && <Button variant="primary" size="md" icon="plus" disabled={!zoneId || isNotConfigured} onClick={() => openDnsModal(null)}>{tr('dnsp.addRecord')}</Button>}
            <Button variant="primary" size="md" icon="refresh-cw"
              disabled={!zoneId || isNotConfigured}
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
              disabled={isNotConfigured}
              loading={loading}
              onClick={loadEdgeOneData}
            >{tr('dnsp.refreshList')}</Button>
          </>
        }
      />

      {/* Tab 切换 · 严格对齐 record-type-toggle (外层常驻) */}
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

      {/* 搜索栏 · 外层常驻 */}
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
              style={{ width: 220, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0, marginLeft: 4 }}>{tr('dnsp.searchByValue')}</span>
            <input type="text" value={dnsSearchContent} onChange={e => setDnsSearchContent(e.target.value)}
              placeholder="e.g. 129.146"
              style={{ width: 220, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <button onClick={() => { setDnsSearchName(''); setDnsSearchContent(''); }}
              disabled={!dnsSearchName && !dnsSearchContent}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px',
                background: 'var(--bg-2)', color: (dnsSearchName || dnsSearchContent) ? 'var(--fg-1)' : 'var(--fg-3)',
                border: '1px solid var(--border)', borderRadius: 4,
                cursor: (dnsSearchName || dnsSearchContent) ? 'pointer' : 'not-allowed',
                fontSize: 12, fontFamily: 'inherit',
              }}>{tr('dnsp.clearSearch')}</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>{tr('dnsp.eo.domain')}:</span>
            <input type="text" value={domainSearchName} onChange={e => setDomainSearchName(e.target.value)}
              placeholder="e.g. www.example.com"
              style={{ width: 240, padding: '6px 10px', fontSize: 12, background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0, marginLeft: 4 }}>{tr('dnsp.eo.status')}</span>
            <CustomDropdown
              value={domainStatusFilter}
              onChange={e => setDomainStatusFilter(e)}
              height={32}
              width="130px"
              options={[
                { value: '', label: tr('dnsp.eo.all') },
                { value: 'online', label: tr('dnsp.eo.online') },
                { value: 'offline', label: tr('dnsp.eo.offline') },
                { value: 'pending', label: tr('dnsp.eo.pending') },
              ]}
            />
            <button onClick={() => { setDomainSearchName(''); setDomainStatusFilter(''); }}
              disabled={!domainSearchName && !domainStatusFilter}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px',
                background: 'var(--bg-2)', color: (domainSearchName || domainStatusFilter) ? 'var(--fg-1)' : 'var(--fg-3)',
                border: '1px solid var(--border)', borderRadius: 4,
                cursor: (domainSearchName || domainStatusFilter) ? 'pointer' : 'not-allowed',
                fontSize: 12, fontFamily: 'inherit',
              }}>{tr('dnsp.clearSearch')}</button>
          </>
        )}
      </div>

      {/* 表格卡片 (外层常驻) */}
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
          {(isZonesLoading && !hasLoadedOnce) ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
              <StatusDot status="running" pulse /> 正在加载站点列表…
            </div>
          ) : isNotConfigured ? (
            /* ─── 未配置/未启用引导卡片 ─── */
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 40,
              textAlign: 'center', minHeight: 280,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'color-mix(in oklab, var(--orange) 16%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, color: 'var(--orange)',
              }}>
                <Icon name="key" size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>
                {tr('dnsp.eo.notConfiguredTitle')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-2)', maxWidth: 440, lineHeight: 1.6, marginBottom: 16 }}>
                {tr('dnsp.eo.notConfiguredDesc')}
              </div>
              <Button variant="orange" size="md" icon="key" onClick={openConfigModal}>
                {tr('nav.proxyKeyConfig')}
              </Button>
            </div>
          ) : hasNoZones ? (
            /* ─── 密钥已配置但账号下暂无站点域名引导卡片 ─── */
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 40,
              textAlign: 'center', minHeight: 280,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'color-mix(in oklab, var(--info) 16%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, color: 'var(--info)',
              }}>
                <Icon name="globe" size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>
                {tr('dnsp.eo.noZonesTitle')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-2)', maxWidth: 460, lineHeight: 1.6, marginBottom: 16 }}>
                {tr('dnsp.eo.noZonesDesc')}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="primary" size="md" icon="refresh-cw" onClick={reloadZones}>
                  {tr('dnsp.eo.refreshZones')}
                </Button>
                <Button variant="outline" size="md" icon="key" onClick={openConfigModal}>
                  {tr('nav.proxyKeyConfig')}
                </Button>
              </div>
            </div>
          ) : tab === 'dns' ? (
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
                      textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ opacity: (loading && filteredDns.length > 0) ? 0.6 : 1, transition: 'opacity 120ms' }}>
                {(loading || !hasLoadedOnce) && filteredDns.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 13 }}>{tr('dnsp.eo.loadingRecords')}</span>
                    </div>
                  </td></tr>
                ) : error ? (
                  <tr><td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
                ) : filteredDns.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 0 }}>
                    <EmptyState
                      icon="cloud"
                      title={zones.length === 0 ? '暂无可用域名' : (!zoneId ? '请选择域名' : '暂无 DNS 记录')}
                      subtitle={zones.length === 0 ? '请先在「密钥配置」中填写 EdgeOne API Key' : (!zoneId ? '从上方下拉选择要管理的 Zone' : '点击「添加记录」或「同步记录」')}
                      actionLabel={zones.length === 0 ? '密钥配置' : (!zoneId ? null : '添加记录')}
                      onAction={zones.length === 0 ? openConfigModal : (!zoneId ? null : () => openDnsModal(null))}
                    />
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
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)' }}>{r.name}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{r.content}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
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
                      textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ opacity: (loading && filteredDomains.length > 0) ? 0.6 : 1, transition: 'opacity 120ms' }}>
                {(loading || !hasLoadedOnce) && filteredDomains.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 13 }}>{tr('dnsp.eo.loadingDomains')}</span>
                    </div>
                  </td></tr>
                ) : error ? (
                  <tr><td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>{error}</td></tr>
                ) : filteredDomains.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon="zap"
                      title={zones.length === 0 ? '暂无可用域名' : '暂无加速域名'}
                      subtitle={zones.length === 0 ? '请先在「密钥配置」中填写 EdgeOne API Key' : '点击「同步域名」从腾讯云拉取'}
                      actionLabel={zones.length === 0 ? '密钥配置' : '同步域名'}
                      onAction={zones.length === 0 ? openConfigModal : () => shell.openConfirm({
                        title: tr('dnsp.eo.syncTitle').replace('{name}', currentZone?.name || '').replace('{target}', tr('dnsp.eo.tab.domain')),
                        confirmLabel: tr('dnsp.sync'),
                        onConfirm: async () => { try { requireSuccess(await window.ociServices.proxy.edgeOneSyncDomains({ zoneId, domainName: currentZone?.name || '' }), tr('dnsp.syncFail')); await loadEdgeOneData(); shell.showToast(tr('dnsp.eo.syncOk').replace('{target}', tr('dnsp.eo.tab.domain')), { kind: 'success' }); } catch (e) { shell.showToast(e.message || tr('dnsp.syncFail'), { kind: 'error' }); } }
                      })}
                    />
                  </td></tr>
                ) : filteredDomains.map((d, i) => {
                  const st = statusCfg[d.status] || statusCfg.pending;
                  return (
                    <tr key={d.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
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
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
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


Object.assign(window, {
  ProxyPage,
  KeyConfigPage,
  ProxyKeyConfigPage,
  CFManagePage,
  EOManagePage,
  useOpenApiDocsDrawer,
  extractCloudflarePublicIps,
});
