// 租户详情 · 独立页面
// 由 ⋯ 菜单跳入,替代原 useTenantDetailDrawer 弹窗方案。
// - 顶部:面包屑 + 返回按钮 + 页头 + 7 项操作按钮组(点击弹侧边 drawer/子 modal)
// - 中部:核心表格(单区域行) + 4 项指标 MiniMetric
// - 多区域:顶部有"切换区域"下拉,切换后表格 + 指标随之刷新
// - 依赖 window.__ocipNavigate(page, ctx) 完成回退到租户列表
const { useState: useStateTD, useMemo: useMemoTD, useEffect: useEffectTD } = React;

function TenantDetailPage({ density, ctx, navigate, updateDetailCtx }) {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const openAddBoot = useAddBootModal();
  const apiImport = useApiImportModal();

  const [regionRows, setRegionRows] = useStateTD([]);
  const [instances, setInstances] = useStateTD([]);
  const [bootTasks, setBootTasks] = useStateTD([]);
  const [loading, setLoading] = useStateTD(true);
  const [loadError, setLoadError] = useStateTD('');
  const [syncingRegionId, setSyncingRegionId] = useStateTD('');

  useEffectTD(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx?.tenantId || '')}`)
      .then(rows => {
        if (!active) return;
        const normalized = (Array.isArray(rows) ? rows : []).map(row => window.ociTenantRow.normalize(row, REGIONS));
        setRegionRows(normalized);
      })
      .catch(error => {
        if (active) {
          setRegionRows([]);
          setLoadError(error.message || tr('td.err.regions'));
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ctx?.tenantId]);

  const tenant = useMemoTD(() => (
    regionRows.find(row => String(row.id) === String(ctx?.tenantId))
      || regionRows.find(row => row.isHomeRegion)
      || regionRows[0]
  ), [regionRows, ctx?.tenantId]);
  const regionOptions = useMemoTD(() => regionRows.map(row => ({
    ...row,
    code: getTenantRegion(row),
    syncStatus: syncingRegionId === String(row.id)
      ? 'syncing'
      : (row.apiSynced === true ? 'synced' : 'not-synced'),
  })), [regionRows, syncingRegionId]);
  const activeRegionCode = ctx?.regionCode || getTenantRegion(tenant);
  const selectedRegion = useMemoTD(() => (
    regionOptions.find(option => option.code === activeRegionCode) || regionOptions[0]
  ), [regionOptions, activeRegionCode]);

  const loadScopedResources = React.useCallback(async (tenantId) => {
    if (!tenantId) return;
    try {
      const [instancePage, bootPage] = await Promise.all([
        window.ociApi.getPage('/oci/list/json', { page: 0, size: 500, tenantId }),
        window.ociApi.getPage('/boot/fullBootList/json', { page: 0, size: 500, tenantId }),
      ]);
      setInstances(instancePage.content.map(normalizeInstanceRow));
      setBootTasks(bootPage.content);
      return { instanceCount: instancePage.content.length, bootCount: bootPage.content.length };
    } catch (error) {
      setInstances([]);
      setBootTasks([]);
      setLoadError(error.message || tr('td.err.resources'));
      throw error;
    }
  }, []);

  useEffectTD(() => {
    loadScopedResources(selectedRegion?.id).catch(error => {
      console.warn(tr('td.err.resources'), error);
    });
  }, [selectedRegion?.id, loadScopedResources]);

  const activeRow = useMemoTD(() => {
    if (!selectedRegion || !tenant) return null;
    return {
      ...selectedRegion,
      seq: regionOptions.indexOf(selectedRegion) + 1,
      name: getTenantName(selectedRegion) || '',
      custom: getTenantAlias(selectedRegion),
      tenancyName: selectedRegion.tenancyName,
      tasks: bootTasks.length,
      region: selectedRegion.code,
      isHomeRegion: Boolean(selectedRegion.isHomeRegion),
      syncStatus: selectedRegion.syncStatus,
      createdAt: selectedRegion.createdAt,
    };
  }, [tenant, regionOptions, selectedRegion, bootTasks]);

  // 区域切换下拉的开关状态
  const [regionMenuOpen, setRegionMenuOpen] = useStateTD(false);
  // 敏感信息脱敏切换
  const [masked, setMasked] = useStateTD(true);

  // 若 tenant 不存在(数据变化/直链非法),让 app 层已经处理了回退,这里兜底
  if (loading) {
    return <div role="status" style={{ padding: 24, color: 'var(--fg-2)' }}>{tr('td.loading')}</div>;
  }
  if (!tenant || !activeRow) {
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

  // ── 7 项操作分发(顶部按钮组) ───────────────────
  const runSubAction = (id) => {
    switch (id) {
      case 'sync-instance': {
        (async () => {
          try {
            setSyncingRegionId(String(activeRow.id));
            shell.showToast(tr('td.sync.starting').replace('{name}', getTenantName(tenant) || '').replace('{region}', activeRegionCode), { kind: 'info' });
            const result = await window.ociApi.request(`/tenants/syncOci?tenantId=${encodeURIComponent(activeRow.id)}`);
            if (typeof result === 'object' && result?.status !== 'success') throw new Error(result?.message || tr('td.sync.fail'));
            const latestRows = await window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx?.tenantId || '')}`);
            setRegionRows((Array.isArray(latestRows) ? latestRows : []).map(row => window.ociTenantRow.normalize(row, REGIONS)));
            const counts = await loadScopedResources(activeRow.id);
            shell.showToast(tr('td.sync.done').replace('{n}', counts.instanceCount), { kind: 'success' });
          } catch (error) {
            shell.showToast(tr('td.sync.failMsg').replace('{err}', error.message || error), { kind: 'error' });
          } finally {
            setSyncingRegionId('');
          }
        })();
        return;
      }
      case 'add-boot': {
        // 复用现有的 add-boot modal(预填此租户)
        openAddBoot(selectedRegion);
        return;
      }
      case 'view-boot':
        // 跳转到独立的"查看开机"页面(预开列表)
        navigate('tenant-grab', {
          tenantId: tenant.id,
          regionTenantId: activeRow.id,
          tab: 'grab',
          regionCode: activeRegionCode,
        });
        return;
      case 'resource-list':
        // 跳转到独立的"资源列表"页面(OCI 实例管理)
        navigate('tenant-resources', {
          tenantId: tenant.id,
          regionTenantId: activeRow.id,
          tab: 'resources',
          regionCode: activeRegionCode,
        });
        return;
      case 'disk-info':      return showDiskModal(shell, selectedRegion, activeRow);
      case 'security-rules': return showSecurityModal(shell, selectedRegion, activeRow);
      case 'storage-case':   return showStorageModal(shell, selectedRegion, activeRow);
    }
  };

  const SUB_ACTIONS = [
    { id: 'sync-instance',  label: tr('td.action.sync'), icon: 'refresh-cw', variant: 'primary'   },
    { id: 'add-boot',       label: tr('td.action.addBoot'), icon: 'plus',       variant: 'outline'   },
    { id: 'view-boot',      label: tr('td.action.viewBoot'), icon: 'eye',        variant: 'outline'   },
    { id: 'disk-info',      label: tr('td.action.disk'), icon: 'hard-drive', variant: 'outline'   },
    { id: 'security-rules', label: tr('td.action.rules'), icon: 'shield',     variant: 'outline'   },
    { id: 'resource-list',  label: tr('td.action.resources'), icon: 'list',       variant: 'outline'   },
    { id: 'storage-case',   label: tr('td.action.storage'), icon: 'database',   variant: 'outline'   },
  ];

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
          onClick={() => navigate('tenants')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--fg-1)',
            fontFamily: 'inherit', fontSize: 12,
            cursor: 'pointer',
            transition: 'background 100ms, border-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-1)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          title={tr('td.back')}
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
          >
            {tr('nav.tenants')}
          </a>
          <Icon name="chevron-right" size={12} style={{ color: 'var(--fg-3)' }} />
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>
            {tr('td.detail')} · <span className="mono">{masked ? (getTenantName(tenant) || '') : (getTenantName(tenant) || '').replace('***', 'user')}</span>
          </span>
        </nav>
      </div>

      {/* ── 页头(标题 + 副标题 + 顶部工具组) ─────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="diamond" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--fg-0)', letterSpacing: -0.2 }}>
                {getTenantName(tenant)}
              </h1>
              <span className="mono" style={{
                padding: '2px 8px', background: 'var(--bg-3)',
                borderRadius: 4, fontSize: 11, color: 'var(--fg-1)', fontWeight: 500,
              }}>
                {masked ? (getTenantName(tenant) || '') : (getTenantName(tenant) || '').replace('***', 'user')}
              </span>
              <StatusPill status={tenant._ui.status === 'active' ? 'active' : tenant._ui.status} label={tr('status.' + tenant._ui.status)} />
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{tenant._ui.hasChildren ? tr('td.multiRegion') : tr('td.singleRegion')}</span>
              <span style={{ color: 'var(--fg-3)' }}>·</span>
              <span>{(tenant.accountTypeName && tenant.accountTypeName !== '未知' && tenant.accountTypeName !== '未知账号/权限不足' && tenant.accountTypeName !== 'Unknown' && tenant.accountTypeName !== tr('tenants.type.unknown')) ? tenant.accountTypeName : (tenant._ui.hasChildren ? tr('tenants.type.multi-region') : tr('tenants.type.unknown'))}</span>
              <span style={{ color: 'var(--fg-3)' }}>·</span>
              <span>{tr('td.uptimePrefix')}<span className="num" style={{ color: 'var(--fg-1)' }}>{getTenantDays(tenant)}</span>{tr('td.uptimeSuffix')}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {/* 区域切换器(仅多区域账号) */}
        {tenant._ui.hasChildren && (
          <RegionSwitcher
            options={regionOptions}
            activeCode={activeRegionCode}
            lang={lang}
            onChange={code => updateDetailCtx({ regionCode: code })}
            open={regionMenuOpen}
            setOpen={setRegionMenuOpen}
          />
        )}

        {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>}

        <IconButton
          icon={masked ? 'eye' : 'eye-off'}
          onClick={() => setMasked(!masked)}
          tooltip={tr('td.toggleMask')}
          size={32}
          style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}
        />
        <Button size="md" variant="primary" icon="zap" onClick={apiImport}>{tr('tenants.action.apiImport')}</Button>
      </div>

      {/* ── 7 项操作按钮组 ─────────────────────────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 20px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--fg-3)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.5,
          marginRight: 4,
        }}>
          <Icon name="settings-2" size={12} />
          <span>{tr('td.regionActions')}</span>
        </div>
        {SUB_ACTIONS.map(a => (
          <Button
            key={a.id}
            size="sm"
            variant={a.variant}
            icon={a.icon}
            onClick={() => runSubAction(a.id)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {/* ── 主体:表格 + 指标 ───────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* 核心表格(只显示当前选中的区域行) */}
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 12,
          }}>
            <thead>
              <tr>
                {['td.col.seq','td.col.tenant','td.col.name','td.col.tasks','td.col.region','td.col.home','td.col.sync','common.createdAt'].map((key, i) => {
                  const h = tr(key);
                  return (
                  <th key={i} style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'var(--bg-2)',
                    color: 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 14px', color: 'var(--fg-2)' }}>
                  <span className="num">{activeRow.seq}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span className="mono" style={{
                    padding: '2px 6px', background: 'var(--bg-3)',
                    borderRadius: 3, fontSize: 11, color: 'var(--fg-1)',
                  }}>{masked ? (activeRow.name || '') : (activeRow.name || '').replace('***', 'user')}</span>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--fg-0)' }}>{getTenantName(activeRow)}</td>
                <td style={{ padding: '12px 14px' }}>
                  {activeRow.tasks > 0
                    ? <span style={{
                        padding: '1px 8px', background: 'var(--info-soft)', color: 'var(--info)',
                        borderRadius: 3, fontSize: 11, fontWeight: 500,
                      }}>{activeRow.tasks}{tr('td.task.countSuffix')}</span>
                    : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('td.task.none')}</span>
                  }
                </td>
                <td style={{ padding: '12px 14px' }}><RegionBadge code={activeRow.region} lang={lang} /></td>
                <td style={{ padding: '12px 14px' }}>
                  {activeRow.isHomeRegion
                    ? <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '1px 8px', background: 'var(--accent-soft)', color: 'var(--accent)',
                        borderRadius: 3, fontSize: 11, fontWeight: 500,
                      }}><Icon name="check" size={10} strokeWidth={3} />{tr('common.yes')}</span>
                    : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('common.no')}</span>
                  }
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {activeRow.syncStatus === 'synced' ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', background: 'var(--accent-soft)', color: 'var(--accent)',
                      borderRadius: 3, fontSize: 11, fontWeight: 500,
                    }}><StatusDot status="running" size={5} />{tr('td.sync.synced')}</span>
                  ) : activeRow.syncStatus === 'syncing' ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', background: 'var(--info-soft)', color: 'var(--info)',
                      borderRadius: 3, fontSize: 11, fontWeight: 500,
                    }}><Icon name="loader" size={10} />{tr('td.sync.syncing')}</span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', background: 'var(--bg-3)', color: 'var(--fg-3)',
                      borderRadius: 3, fontSize: 11,
                    }}>{tr('td.sync.unsynced')}</span>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{activeRow.createdAt}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4 项指标 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        }}>
          <MiniMetric label={tr('td.metric.instances')}  value={instances.length} color="var(--cyan)"   />
          <MiniMetric label={tr('status.running')}    value={instances.filter(i => getInstanceStatus(i) === 'running').length} color="var(--accent)" />
          <MiniMetric label={tr('td.metric.tasks')}  value={bootTasks.length} color="var(--info)"   />
          <MiniMetric label={tr('td.metric.cost')}  value={`$${tenant.accountCost ?? tenant.cost ?? 0}`} color="var(--orange)" />
        </div>
      </div>
    </div>
  );
}

// ─── 区域切换下拉(仅多区域账号使用) ─────────────
function RegionSwitcher({ options, activeCode, lang, onChange, open, setOpen }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  const activeOpt = options.find(o => o.code === activeCode) || options[0];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 8px',
          background: open ? 'var(--bg-3)' : 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--fg-1)',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--bg-3)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'var(--bg-2)'; }}
      >
        <Icon name="globe" size={13} style={{ color: 'var(--fg-2)' }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{tr('td.region')}</span>
        <RegionBadge code={activeOpt.code} lang={lang} />
        <Icon name="chevron-down" size={13} style={{ color: 'var(--fg-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          minWidth: 260,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          zIndex: 20,
          padding: 4,
        }}>
          <div style={{
            padding: '6px 10px 4px',
            fontSize: 10, fontWeight: 600,
            color: 'var(--fg-3)',
            textTransform: 'uppercase', letterSpacing: 0.5,
            borderBottom: '1px solid var(--border)',
            marginBottom: 2,
          }}>
            {tr('td.switchRegion')} · {options.length}
          </div>
          {options.map(opt => {
            const isActive = opt.code === activeCode;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => { onChange(opt.code); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  color: isActive ? 'var(--accent)' : 'var(--fg-1)',
                  fontFamily: 'inherit', fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 80ms',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <RegionBadge code={opt.code} lang={lang} />
                {opt.isHomeRegion && (
                  <span style={{
                    padding: '1px 6px',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    borderRadius: 3, fontSize: 10, fontWeight: 500,
                  }}>{tr('td.col.home')}</span>
                )}
                <div style={{ flex: 1 }} />
                {opt.syncStatus === 'synced' && <span style={{ fontSize: 10.5, color: 'var(--accent)' }}>{tr('td.sync.synced')}</span>}
                {opt.syncStatus === 'syncing' && <span style={{ fontSize: 10.5, color: 'var(--info)' }}>{tr('td.sync.syncing')}</span>}
                {opt.syncStatus === 'not-synced' && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('td.sync.unsynced')}</span>}
                {isActive && <Icon name="check" size={12} style={{ color: 'var(--accent)', marginLeft: 4 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TenantDetailPage });
