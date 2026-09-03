// 租户 · 资源列表(OCI 实例管理)· 独立页面
// 从 tenant-detail 页的"资源列表"按钮进入。
// 视觉与原 showResourceModal 一致,但改为独立页面以避免多级弹窗嵌套。
const { useState: useStateTR, useMemo: useMemoTR, useEffect: useEffectTR } = React;

function TenantResourcesPage({ density, ctx, navigate, updateDetailCtx }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [regionRows, setRegionRows] = useStateTR([]);
  const [instances, setInstances] = useStateTR([]);
  const [loading, setLoading] = useStateTR(true);
  const [loadError, setLoadError] = useStateTR('');

  useEffectTR(() => {
    let active = true;
    setLoading(true);
    window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx?.tenantId || '')}`)
      .then(rows => {
        if (active) setRegionRows((Array.isArray(rows) ? rows : []).map(row => window.ociTenantRow.normalize(row, REGIONS)));
      })
      .catch(error => {
        if (active) setLoadError(error.message || tr('td.err.regions'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ctx?.tenantId]);

  const tenant = useMemoTR(() => (
    regionRows.find(row => String(row.id) === String(ctx?.tenantId))
      || regionRows.find(row => row.isHomeRegion)
      || regionRows[0]
  ), [regionRows, ctx?.tenantId]);

  const regionOptions = useMemoTR(() => regionRows.map(getTenantRegion).filter(Boolean), [regionRows]);

  const [regionSel, setRegionSel] = useStateTR(ctx?.regionCode || tenant?.mainRegion || '');
  const [masked, setMasked] = useStateTR(true);
  const [page, setPage] = useStateTR(1);
  const [perPage, setPerPage] = useStateTR(10);
  const [exporting, setExporting] = useStateTR(false);
  // 行级操作菜单:{ inst, anchorRect } | null
  const [rowMenu, setRowMenu] = useStateTR(null);

  const selectedRegion = useMemoTR(() => (
    regionRows.find(row => getTenantRegion(row) === regionSel)
      || regionRows.find(row => String(row.id) === String(ctx?.regionTenantId))
      || tenant
  ), [regionRows, ctx?.regionTenantId, regionSel, tenant]);

  const resetResourceFilters = () => {
    const defaultRegion = regionRows.find(row => row.isHomeRegion) || regionRows[0];
    const nextRegion = defaultRegion ? getTenantRegion(defaultRegion) : '';
    setRegionSel(nextRegion);
    setPage(1);
    updateDetailCtx?.({ ...(ctx || {}), regionCode: nextRegion, regionTenantId: defaultRegion?.id });
  };

  const exportInstances = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await window.ociServices.instance.export();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `oci-instances-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      shell.showToast(tr('instances.export.ok'), { kind: 'success' });
    } catch (error) {
      shell.showToast(tr('instances.export.fail').replace('{err}', error.message || error), { kind: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const loadInstances = React.useCallback(async () => {
    if (!selectedRegion?.id) return;
    setLoading(true);
    setLoadError('');
    try {
      const pageData = await window.ociApi.getPage('/oci/list/json', {
        page: 0,
        size: 500,
        tenantId: selectedRegion.id,
      });
      setInstances(pageData.content.map(normalizeInstanceRow));
    } catch (error) {
      setInstances([]);
      setLoadError(error.message || tr('tr.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [selectedRegion?.id]);

  useEffectTR(() => { loadInstances(); }, [loadInstances]);

  const filtered = useMemoTR(() => {
    if (!tenant) return [];
    return instances;
  }, [tenant, instances]);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const regionShortLabel = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  if (loading && !tenant) {
    return <div role="status" style={{ padding: 24, color: 'var(--fg-2)' }}>{tr('tr.loading')}</div>;
  }
  if (!tenant) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 0,
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-2)',
      }}>
        <Icon name="alert-triangle" size={32} style={{ color: 'var(--orange)', marginBottom: 8 }} />
        <div style={{ marginBottom: 12 }}>{tr('td.missing')}</div>
        <Button variant="outline" size="md" icon="arrow-left" onClick={() => navigate('tenants')}>{tr('td.back')}</Button>
      </div>

    );
  }

  const goBack = () => {
    navigate('tenant-detail', {
      tenantId: tenant.id,
      tab: 'overview',
      regionCode: ctx?.regionCode || getTenantRegion(tenant),
    });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      {/* ── 面包屑 + 返回 ─────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 10,
        fontSize: 12, color: 'var(--fg-2)',
      }}>
        <button
          type="button"
          onClick={goBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--fg-1)',
            fontFamily: 'inherit', fontSize: 12,
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-1)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          title={tr('tg.backDetail')}
        >
          <Icon name="arrow-left" size={13} />
          <span>{tr('common.back')}</span>
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a
            onClick={() => navigate('tenants')}
            style={{ cursor: 'pointer', color: 'var(--fg-2)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
          >{tr('nav.tenants')}</a>
          <Icon name="chevron-right" size={12} style={{ color: 'var(--fg-3)' }} />
          <a
            onClick={goBack}
            style={{ cursor: 'pointer', color: 'var(--fg-2)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
          >
            {tr('td.detail')} · <span className="mono">{getTenantName(tenant) || ''}</span>
          </a>
          <Icon name="chevron-right" size={12} style={{ color: 'var(--fg-3)' }} />
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{tr('tr.title')}</span>
        </nav>
      </div>

      {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>}

      {/* ── 页头 + 筛选栏(单行) ─────────────────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 16px',
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'color-mix(in oklab, var(--cyan) 18%, transparent)',
            color: 'var(--cyan)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="cloud" size={13} />
          </div>
          <h2 style={{
            fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--fg-0)',
          }}>{tr('instances.title')}</h2>
          <span style={{ fontSize: 12, color: 'var(--fg-3)', marginLeft: 4 }}>
            {getTenantName(tenant)} · {tr('tr.instanceCountPrefix')}<span className="num" style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{filtered.length}</span>{tr('tr.instanceCountSuffix')}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('common.selectPlaceholder')}:</span>
        <CustomDropdown
          value={getTenantName(tenant) || ''}
          disabled width={140} height={32}
        >
          <option>{getTenantName(tenant) || ''}</option>
        </CustomDropdown>
        <CustomDropdown
          value={regionSel}
          onChange={v => {
            setRegionSel(v);
            const row = regionRows.find(item => getTenantRegion(item) === v);
            updateDetailCtx?.({ ...(ctx || {}), regionCode: v, regionTenantId: row?.id });
            setPage(1);
          }} width={140} height={32}
        >
          {regionOptions.map(code => (
            <option key={code} value={code}>{regionShortLabel(code)}</option>
          ))}
        </CustomDropdown>
        <Button size="sm" variant="primary" icon="search"
          onClick={() => shell.showToast(tr('tr.refreshOk').replace('{n}', filtered.length), { kind: 'info' })}
        >{tr('instances.action.view')}</Button>
        <Button size="sm" variant="ghost" icon="x"
          onClick={resetResourceFilters}
        >{tr('common.reset')}</Button>
        <Button size="sm" variant="outline" icon="download"
          loading={exporting}
          disabled={exporting}
          onClick={() => shell.openConfirm({
            title: tr('instances.export.warnTitle'),
            body: <div style={{ lineHeight: 1.7, fontSize: 12 }}>
              {tr('instances.export.warnBody')}
            </div>,
            danger: true,
            confirmLabel: tr('instances.export.confirm'),
            onConfirm: exportInstances,
          })}
        >{tr('instances.action.export')}</Button>
      </div>

      {/* ── 表格 + 分页 ────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'separate', borderSpacing: 0,
            fontSize: 12,
          }}>
            <thead>
              <tr>
                {[
                  { h: '#', w: 44 },
                  { h: (
                    <span>{tr('td.col.tenant')} <Icon name={masked ? 'eye-off' : 'eye'} size={10} style={{ marginLeft: 4, verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setMasked(!masked)} /></span>
                  ), w: 110 },
                  { h: tr('tr.col.region'), w: 120 },
                  { h: tr('tr.col.name') },
                  { h: 'CPU/MEM', w: 90 },
                  { h: tr('tr.col.arch'), w: 70 },
                  { h: tr('tr.col.diskVpu'), w: 100 },
                  { h: tr('tr.col.ipv4'), w: 140 },
                  { h: 'IPV6', w: 80 },
                  { h: tr('common.createdAt'), w: 130 },
                  { h: tr('common.operation'), w: 70, align: 'center' },
                ].map((c, i) => (
                  <th key={i} style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    textAlign: c.align || 'left',
                    padding: '10px 12px',
                    width: c.w,
                    background: 'var(--bg-2)',
                    color: 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Icon name="inbox" size={28} style={{ color: 'var(--fg-3)' }} />
                      <div>{tr('tr.noInstances')}</div>
                    </div>
                  </td>
                </tr>
              ) : paged.map((inst, i) => (
                <tr key={inst.seq || i} style={{
                  background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                }}>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}>
                    <span className="num">{(page - 1) * perPage + i + 1}</span>
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{
                      padding: '2px 6px', background: 'var(--bg-3)',
                      borderRadius: 3, fontSize: 11, color: 'var(--fg-1)',
                    }}>{inst.tenantName}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)' }}>
                    {regionShortLabel(inst.region || getTenantRegion(tenant))}
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <StatusDot status={inst.status} size={5} pulse={inst.status === 'running'} />
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>{inst.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                    {getInstanceCpu(inst)}C{getInstanceMem(inst)}G
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      padding: '1px 6px',
                      background: 'var(--info-soft)', color: 'var(--info)',
                      borderRadius: 3, fontSize: 10, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}>{getInstanceArch(inst)}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                    {inst.disk}GB/{inst.vpu == null || inst.vpu === '' ? 0 : inst.vpu}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                    {getInstanceIp(inst) || '—'}
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    {inst.ipv6 === 'enabled'
                      ? <span style={{
                          padding: '1px 6px', background: 'var(--accent-soft)', color: 'var(--accent)',
                          borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                        }}>{tr('status.enabled')}</span>
                      : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('status.disabled')}</span>
                    }
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{inst.createdAt}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={e => {
                        // 若已打开同一行 → 关闭
                        if (rowMenu?.inst === inst) { setRowMenu(null); return; }
                        setRowMenu({ inst, anchorEl: e.currentTarget });
                      }}
                      style={{
                        width: 28, height: 28, borderRadius: 4,
                        background: rowMenu?.inst === inst ? 'var(--accent)' : 'var(--bg-2)',
                        border: '1px solid ' + (rowMenu?.inst === inst ? 'var(--accent)' : 'var(--border)'),
                        color: rowMenu?.inst === inst ? 'var(--accent-fg)' : 'var(--fg-1)',
                        cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 100ms',
                      }}
                      title={tr('common.operation')}
                    >
                      <Icon name="more-horizontal" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination
            total={filtered.length}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={n => { setPerPage(n); setPage(1); }}
            t={tr}
          />
        </div>
      </div>

      {/* ── 行级操作浮动菜单(16 项 · 2 列 · portal 挂 body) ── */}
      {rowMenu && (
        <InstanceRowActionMenu
          inst={rowMenu.inst}
          anchorEl={rowMenu.anchorEl}
          onClose={() => setRowMenu(null)}
          onAction={(actionId, inst) => makeInstanceActionRunner(shell, inst, tenant)(actionId)}
        />
      )}
    </div>
  );
}

Object.assign(window, { TenantResourcesPage });
