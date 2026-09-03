// 租户 · 查看开机(预开列表)· 独立页面
// 从 tenant-detail 页的"查看开机"按钮进入。
// - 精简 UI:面包屑 + 页头 + 单行筛选/操作栏 + 表格 + 分页
// - 通过 ctx.tenantId + ctx.regionCode 预筛选
const { useState: useStateTG, useMemo: useMemoTG, useEffect: useEffectTG } = React;

function TenantGrabPage({ density, ctx, navigate, updateDetailCtx }) {
  const { t: tr, lang } = useT();
  const shell = useShell();
  // 与主"开机管理"页对齐:用同一个 hook 打开"已抢实例"drawer
  const showInsts = useTaskInstancesDrawer();
  const openAddBoot = useAddBootModal();
  const [regionRows, setRegionRows] = useStateTG([]);
  const [tasks, setTasks] = useStateTG([]);
  const [loading, setLoading] = useStateTG(true);
  const [loadError, setLoadError] = useStateTG('');

  useEffectTG(() => {
    let active = true;
    setLoading(true);
    window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx?.tenantId || '')}`)
      .then(rows => {
        if (active) setRegionRows((Array.isArray(rows) ? rows : []).map(row => window.ociTenantRow.normalize(row, REGIONS)));
      })
      .catch(error => {
        if (active) setLoadError(error.message || tr('tg.err.regions'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ctx?.tenantId]);

  const tenant = useMemoTG(() => (
    regionRows.find(row => String(row.id) === String(ctx?.tenantId))
      || regionRows.find(row => row.isHomeRegion)
      || regionRows[0]
  ), [regionRows, ctx?.tenantId]);

  const regionOptions = useMemoTG(() => regionRows.map(getTenantRegion).filter(Boolean), [regionRows]);

  const [regionSel, setRegionSel] = useStateTG(ctx?.regionCode || tenant?.mainRegion || '');
  const [page, setPage] = useStateTG(1);
  const [perPage, setPerPage] = useStateTG(20);
  const [jumpPage, setJumpPage] = useStateTG(1);
  // 行操作菜单
  const [menuFor, setMenuFor] = useStateTG(null);

  const selectedRegion = useMemoTG(() => (
    regionRows.find(row => String(row.id) === String(ctx?.regionTenantId))
      || regionRows.find(row => getTenantRegion(row) === regionSel)
      || tenant
  ), [regionRows, ctx?.regionTenantId, regionSel, tenant]);

  const loadTasks = React.useCallback(async () => {
    if (!selectedRegion?.id) return;
    setLoading(true);
    setLoadError('');
    try {
      const pageData = await window.ociApi.getPage('/boot/fullBootList/json', {
        page: 0,
        size: 500,
        tenantId: selectedRegion.id,
      });
      setTasks(pageData.content.map(normalizeBootTask));
    } catch (error) {
      setTasks([]);
      setLoadError(error.message || tr('tg.err.load'));
    } finally {
      setLoading(false);
    }
  }, [selectedRegion?.id]);

  useEffectTG(() => { loadTasks(); }, [loadTasks]);

  // 过滤:按 tenantId + region
  const filtered = useMemoTG(() => {
    if (!tenant) return [];
    return tasks;
  }, [tenant, tasks]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  // 区域标签(去掉外层大区括号:us-sanjose-1 → 美西 圣何塞 → 圣何塞)
  const regionShortLabel = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  if (loading && !tenant) {
    return <div role="status" style={{ padding: 24, color: 'var(--fg-2)' }}>{tr('tg.loading')}</div>;
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

  // 返回租户详情(如果之前来自那里)
  const goBack = () => {
    navigate('tenant-detail', {
      tenantId: tenant.id,
      tab: 'overview',
      regionCode: ctx?.regionCode || getTenantRegion(tenant),
    });
  };

  // 操作:预开(添加开机 modal)/ 停止 / 重置
  const runPreBoot = () => openAddBoot(selectedRegion || tenant);
  const runStop = () => shell.openConfirm({
    title: tr('tg.confirm.stopTitle'),
    body: <div><b>{getTenantName(tenant)}</b> · {regionShortLabel(regionSel)} {tr('tg.confirm.stopBody').replace('{n}', filtered.length)}</div>,
    confirmLabel: tr('grab.confirm.stopAll.confirm'),
    onConfirm: async () => {
      try {
        const results = await Promise.all(filtered.map(task =>
          window.ociApi.request(`/boot/stopBoot?bootId=${encodeURIComponent(task.id)}`, { method: 'POST' })
        ));
        const failure = results.find(result => !result?.success);
        if (failure) throw new Error(failure.message || tr('tg.stopFail'));
        shell.showToast(tr('tg.stopOk').replace('{n}', filtered.length), { kind: 'warn' });
        await loadTasks();
      } catch (error) {
        shell.showToast(tr('tg.stopFailMsg').replace('{err}', error.message || error), { kind: 'error' });
      }
    },
  });
  const runReset = () => shell.openConfirm({
    title: tr('tg.confirm.resetTitle'),
    body: <div>{tr('tg.confirm.resetBody')}</div>,
    confirmLabel: tr('common.reset'),
    onConfirm: async () => {
      try {
        const result = await window.ociApi.request('/boot/batchInitFailCount', { method: 'POST' });
        if (!result?.success) throw new Error(result?.message || tr('tg.resetFail'));
        shell.showToast(tr('tg.resetOk'), { kind: 'info' });
        await loadTasks();
      } catch (error) {
        shell.showToast(tr('tg.resetFailMsg').replace('{err}', error.message || error), { kind: 'error' });
      }
    },
  });

  const requestTaskAction = async (path, task, successMessage) => {
    const result = await window.ociApi.request(`${path}?bootId=${encodeURIComponent(task.id)}`, { method: 'POST' });
    if (!result?.success) throw new Error(result?.message || tr('tg.opFail'));
    shell.showToast(successMessage, { kind: 'success' });
    await loadTasks();
  };

  const handleTaskAction = (id, task) => {
    if (id === 'instances') {
      shell.closeDrawer?.();
      setTimeout(() => showInsts(task), 0);
      return;
    }
    if (id === 'delete') {
      shell.openConfirm({
        title: tr('tg.confirm.deleteTitle').replace('{name}', getTenantName(task)),
        body: <div>{tr('tg.confirm.deleteBody')}</div>,
        danger: true,
        confirmLabel: tr('common.delete'),
        onConfirm: async () => {
          try {
            await requestTaskAction('/boot/deleteBoot', task, tr('tg.deleteOk').replace('{name}', getTenantName(task)));
          } catch (error) {
            shell.showToast(tr('tg.deleteFail').replace('{err}', error.message || error), { kind: 'error' });
          }
        },
      });
      return;
    }
    const endpoints = {
      start: ['/boot/startBoot', tr('tg.startOk').replace('{name}', getTenantName(task))],
      stop: ['/boot/stopBoot', tr('tg.stopTaskOk').replace('{name}', getTenantName(task))],
      clone: ['/boot/startCloneBoot', tr('tg.cloneOk').replace('{name}', getTenantName(task))],
      'one-shot': ['/boot/manualBoot', tr('tg.oneShotOk').replace('{name}', getTenantName(task))],
    };
    if (endpoints[id]) {
      const [path, message] = endpoints[id];
      requestTaskAction(path, task, message).catch(error => {
        shell.showToast(tr('tg.opFailMsg').replace('{err}', error.message || error), { kind: 'error' });
      });
      return;
    }
    if (id === 'detail') {
      window.ociApi.request(`/boot/bootDetail?bootId=${encodeURIComponent(task.id)}`)
        .then(result => {
          if (!result?.success) throw new Error(result?.message || tr('tg.detailFail'));
          shell.openModal({
            title: tr('tg.detailTitle').replace('{name}', getTenantName(task)),
            size: 'lg',
            body: <pre style={{ padding: 18, overflow: 'auto', color: 'var(--fg-1)' }}>{JSON.stringify(result.data || [], null, 2)}</pre>,
          });
        })
        .catch(error => shell.showToast(tr('tg.detailFailMsg').replace('{err}', error.message || error), { kind: 'error' }));
      return;
    }
    if (id === 'reset') runReset();
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
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{tr('tg.viewBoot')}</span>
        </nav>
      </div>

      {/* ── 页头 + 筛选/操作栏(单行) ─────────────── */}
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
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="zap" size={13} />
          </div>
          <h2 style={{
            fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--fg-0)',
          }}>{tr('grab.title')}</h2>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('common.selectPlaceholder')}:</span>
        <CustomDropdown
          value={(getTenantName(tenant) || '').replace(/\*/g, '')}
          disabled width={140} height={32}
        >
          <option>{(getTenantName(tenant) || '').replace(/\*/g, '')}</option>
        </CustomDropdown>
        <CustomDropdown
          value={regionSel}
          onChange={v => { setRegionSel(v); setPage(1); }} width={140} height={32}
        >
          {regionOptions.map(code => (
            <option key={code} value={code}>{regionShortLabel(code)}</option>
          ))}
        </CustomDropdown>
        <Button size="sm" variant="info" icon="search"
          onClick={() => shell.showToast(tr('tg.refreshOk').replace('{n}', filtered.length), { kind: 'info' })}
        >{tr('common.search')}</Button>
        <IconButton icon="eye" size={28} tooltip={tr('td.toggleMask')}
          style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}
      />

      {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>}
        <Button size="sm" variant="primary" icon="zap" onClick={runPreBoot}>{tr('grab.action.create')}</Button>
        <Button size="sm" variant="orange" icon="square" onClick={runStop}>{tr('grab.action.stop')}</Button>
        <Button size="sm" variant="danger" icon="rotate-ccw" onClick={runReset}>{tr('grab.action.reset')}</Button>
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
                  { h: tr('tg.col.seq'), w: 50 },
                  { h: tr('tg.col.tenant'), w: 100 },
                  { h: tr('tg.col.custom') },
                  { h: tr('tg.col.region'), w: 120 },
                  { h: tr('tg.col.status'), w: 100 },
                  { h: tr('tg.col.total'), w: 84, align: 'center' },
                  { h: tr('tg.col.executing'), w: 84, align: 'center' },
                  { h: tr('tg.col.attempts'), w: 90, align: 'center' },
                  { h: tr('tg.col.yesterday'), w: 84, align: 'center' },
                  { h: tr('tg.col.today'), w: 84, align: 'center' },
                  { h: tr('tg.col.failed'), w: 84, align: 'center' },
                  { h: tr('tg.col.success'), w: 84, align: 'center' },
                  { h: tr('tg.col.arch'), w: 84 },
                  { h: tr('common.createdAt'), w: 130 },
                  { h: tr('common.operation'), w: 60, align: 'center' },
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
              {(loading ? [] : paged).length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Icon name="inbox" size={28} style={{ color: 'var(--fg-3)' }} />
                      <div>{tr('tg.noTasks')}</div>
                      <Button size="sm" variant="primary" icon="plus" onClick={runPreBoot}>{tr('tg.addBoot')}</Button>
                    </div>
                  </td>
                </tr>
              ) : paged.map((r, i) => (
                <tr key={r.seq} style={{
                  background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                }}>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-2)', borderBottom: '1px solid var(--border)' }}>
                    <span className="num">{(page - 1) * perPage + i + 1}</span>
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{
                      padding: '2px 6px', background: 'var(--bg-3)',
                      borderRadius: 3, fontSize: 11, color: 'var(--fg-1)',
                    }}>{r.tenantName}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getTenantName(r)}
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <RegionBadge code={r.region} lang={lang} />
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <TaskStatusPill status={r.status} />
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{r.totalTasks}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: r.executing > 0 ? 'var(--accent)' : 'var(--fg-3)', fontWeight: r.executing > 0 ? 600 : 400 }}>{r.executing}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{getGrabAttempts(r).toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: getGrabYesterday(r) > 0 ? 'var(--fg-1)' : 'var(--fg-3)' }}>{getGrabYesterday(r).toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: getGrabToday(r) > 0 ? 'var(--cyan)' : 'var(--fg-3)', fontWeight: getGrabToday(r) > 0 ? 600 : 400 }}>{getGrabToday(r).toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span className="num" style={{ color: getGrabFailed(r) > 0 ? 'var(--danger)' : 'var(--fg-3)' }}>{getGrabFailed(r).toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    {getGrabSucceeded(r) > 0 ? (
                      <button
                        type="button"
                        className="num"
                        onClick={(e) => {
                          e.stopPropagation();
                          shell.closeDrawer?.();
                          setTimeout(() => showInsts(r), 0);
                        }}
                        title={tr('tg.instancesTip').replace('{n}', getGrabSucceeded(r))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '1px 8px', borderRadius: 4,
                          background: 'var(--accent-soft)',
                          border: '1px solid transparent',
                          color: 'var(--accent)', fontWeight: 600,
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          cursor: 'pointer', transition: 'all 120ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {getGrabSucceeded(r)}
                        <Icon name="external-link" size={9} />
                      </button>
                    ) : (
                      <span className="num" style={{ color: 'var(--fg-3)' }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      padding: '1px 6px',
                      background: 'var(--info-soft)', color: 'var(--info)',
                      borderRadius: 3, fontSize: 10, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}>{getInstanceArch(r)}</span>
                  </td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{r.createdAt}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    {(() => {
                      const isOpen = menuFor?.task === r;
                      return (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (isOpen) { setMenuFor(null); return; }
                            setMenuFor({ task: r, anchorEl: e.currentTarget });
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
                          title={tr('common.operation')}
                        >
                          <Icon name="more-horizontal" size={14} />
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 分页栏 */}
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

      {/* 行操作菜单 · 复用 page-grab.jsx 里定义的 GrabTaskMenu(9 项) */}
      {menuFor && (
        <GrabTaskMenu
          task={menuFor.task}
          anchorEl={menuFor.anchorEl}
          onClose={() => setMenuFor(null)}
          onAction={handleTaskAction}
        />
      )}
    </div>
  );
}

// 任务状态徽章 —— 与 grab 页保持一致
function TaskStatusPill({ status }) {
  const cfg = {
    running: { label: tr('status.running'),  color: 'var(--accent)', bg: 'var(--accent-soft)', dot: true },
    idle:    { label: tr('tg.status.idle'),  color: 'var(--fg-2)',   bg: 'var(--bg-3)',        dot: false },
    paused:  { label: tr('tg.status.paused'),  color: 'var(--orange)', bg: 'var(--orange-soft)', dot: false },
    failed:  { label: tr('tg.status.failed'),    color: 'var(--danger)', bg: 'var(--danger-soft)', dot: false },
  }[status] || { label: status, color: 'var(--fg-2)', bg: 'var(--bg-3)', dot: false };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px',
      background: cfg.bg, color: cfg.color,
      borderRadius: 4, fontSize: 11, fontWeight: 500,
    }}>
      {cfg.dot && <StatusDot status="running" size={5} pulse />}
      {cfg.label}
    </span>
  );
}

Object.assign(window, { TenantGrabPage });
