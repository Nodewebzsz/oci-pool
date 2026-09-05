// Instances page — with row action menu + wired toolbar buttons
const { useState: useStateIn, useEffect: useEffectIn } = React;

function normalizeInstanceRow(i, index) {
  const state = (i.state || '').toLowerCase();
  const tenantDbId = [i.tenantIdStr, i.tenantId]
    .find(value => value !== null && value !== undefined && String(value) !== '');
  const createdAt = i.createTime || '';
  const createdDate = createdAt
    ? (() => {
        const d = new Date(createdAt);
        if (Number.isNaN(d.getTime())) return String(createdAt);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })()
    : '';
  return {
    ...i,
    seq: index + 1,
    id: i.id,
    dbId: i.id,
    instanceId: i.instanceId,
    tenantId: String(tenantDbId ?? ''),
    // 原项目列直接渲染 InstanceDetailsRes.tenancyName；缺失时保持空，不回退到 userName。
    tenantName: i.tenancyName ?? '',
    name: i.displayName || '',
    region: i.regionCode || i.regionName || '',
    status: state,
    ocpu: i.ocpus,
    memory: i.memoryInGBs,
    arch: i.architecture,
    shape: i.shape,
    disk: i.bootVolumeSizeInGBs,
    // 原项目模板使用 instance.vpusPerGB!0；保留真实 0，并将缺失值显示为 0。
    vpu: i.vpusPerGB == null || i.vpusPerGB === '' ? 0 : i.vpusPerGB,
    bootVolumeId: i.bootVolumeId,
    publicIp: i.publicIps || '',
    privateIp: i.privateIps || '',
    ipv4: i.publicIps || '',
    ipv6: (Array.isArray(i.ipv6Addresses) ? i.ipv6Addresses.length > 0 : Boolean(i.ipv6Addresses)) ? 'enabled' : 'disabled',
    ipv6Addresses: i.ipv6Addresses || '',
    vcnId: i.vcnId,
    subnetId: i.subnetId,
    compartmentId: i.compartmentId,
    createdAt: createdDate,
    cpuAndMem: i.cpuAndMem,
  };
}

// 实例页的租户下拉沿用原项目排序/显示语义：优先 Tenant.userName，
// 再取 OCI tenancyName；数据库 id 只作为 option value 发送给后端。
function instanceTenantDisplayName(t) {
  return t?.userName || getTenantName(t) || t?.tenancyName || '';
}

function instanceTenantDisplayAlias(t) {
  const alias = getTenantAlias(t);
  if (!alias) return '';
  const sameAsBackendField = [t?.userName, t?.tenancyName, t?.tenantId, t?.idStr]
    .some(v => v !== null && v !== undefined && String(v) === String(alias));
  return sameAsBackendField ? '' : alias;
}

function InstancesPage({ density }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const routeQuery = (() => { try { return window.ociRouter?.read?.().query || {}; } catch { return {}; } })();
  const [tenantFilter, setTenantFilter] = useStateIn(routeQuery.tenantId || '');
  const [regionFilter, setRegionFilter] = useStateIn(routeQuery.regionId || '');
  const [nameFilter, setNameFilter]   = useStateIn('');   // 精确实例名过滤(由外部跳转设置)
  const [page, setPage] = useStateIn(Math.max(1, Number(routeQuery.page || 1)));
  const [perPage, setPerPage] = useStateIn(Math.max(1, Number(routeQuery.size || 10)));
  const [menuFor, setMenuFor] = useStateIn(null);
  // 脱敏开关 — 对齐租户管理页的眼睛切换交互
  const [masked, setMasked] = useStateIn(true);
  const [instances, setInstances] = useStateIn([]);
  const [totalElements, setTotalElements] = useStateIn(0);
  const [tenantOptions, setTenantOptions] = useStateIn([]);
  const [regionOptions, setRegionOptions] = useStateIn([]);
  const [regionLoading, setRegionLoading] = useStateIn(false);
  const [loading, setLoading] = useStateIn(true);
  const [loadError, setLoadError] = useStateIn('');
  const [refreshToken, setRefreshToken] = useStateIn(0);

  // 原项目先加载父租户列表；区域选项不来自静态 REGIONS，而来自当前父租户的子租户记录。
  useEffectIn(() => {
    let alive = true;
    (async () => {
      try {
        const tenantRows = await window.ociServices.tenant.listParentTenants();
        if (!alive) return;
        setTenantOptions((Array.isArray(tenantRows) ? tenantRows : []).map(row => window.ociTenantRow.normalize(row, REGIONS)));
      } catch (error) {
        if (!alive) return;
        setTenantOptions([]);
        setLoadError(error.message || tr('instances.err.tenants'));
      }
    })();
    return () => { alive = false; };
  }, [refreshToken]);

  // 原项目 /tenants/listRegions?parentId=...：父租户改变后重建区域下拉，并校验深链接中的区域。
  useEffectIn(() => {
    let alive = true;
    setRegionOptions([]);
    if (!tenantFilter) {
      setRegionLoading(false);
      setRegionFilter('');
      return () => { alive = false; };
    }
    setRegionLoading(true);
    (async () => {
      try {
        const rows = await window.ociServices.tenant.listRegions({ parentId: tenantFilter });
        if (!alive) return;
        const options = (Array.isArray(rows) ? rows : [])
          .map(row => ({
            id: String(row.id ?? ''),
            label: row.region || row.tenancyName || row.userName || row.tenantId || row.id || '',
            region: row.region || '',
          }))
          .filter(row => row.id);
        setRegionOptions(options);
        const requested = String(regionFilter || '');
        if (requested && options.some(row => row.id === requested)) return;
        if (options.length === 1) {
          const only = options[0].id;
          setRegionFilter(only);
          writeRouteQuery({ regionId: only, page: 1 });
        } else if (requested) {
          setRegionFilter('');
          writeRouteQuery({ regionId: '', page: 1 });
        }
      } catch (error) {
        if (!alive) return;
        setRegionOptions([]);
        setRegionFilter('');
        setLoadError(error.message || tr('instances.err.regions'));
      } finally {
        if (alive) setRegionLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenantFilter, refreshToken]);

  // 真实后端 · 实例查询的 tenantId 必须是选中的区域子租户数据库 id。
  useEffectIn(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        // 原项目 Web 端实例列表:GET /oci/list/json → {content,totalPages,totalElements}。
        // page 在 Modern UI 中为 1-based，Spring Controller 为 0-based，此处只转换一次。
        const json = await window.ociApi.getPage('/oci/list/json', {
          page: page - 1,
          size: perPage,
          tenantId: regionFilter || undefined,
        });
        if (!alive || !json) return;
        setInstances(json.content.map(normalizeInstanceRow));
        const total = Number(json.totalElements) || 0;
        const totalPages = Math.max(1, Number(json.totalPages) || Math.ceil(total / perPage));
        setTotalElements(total);
        if (page > totalPages) {
          // 深链接可能携带已失效页码；回到后端允许的最后一页并保持地址栏一致。
          setPage(totalPages);
          const current = (() => { try { return window.ociRouter?.read?.().query || {}; } catch { return {}; } })();
          window.ociRouter?.go('instances', {
            ...current,
            page: totalPages,
            size: perPage,
            tenantId: tenantFilter || undefined,
            regionId: regionFilter || undefined,
          }, { replace: true });
        }
      } catch (error) {
        if (!alive) return;
        setInstances([]);
        setTotalElements(0);
        setLoadError(error.message || tr('instances.err.load'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [refreshToken, regionFilter, page, perPage]);

  const showDetail  = useInstanceDetailDrawer();
  const showVnc     = useVncModal();
  const showReinstall = useReinstallModal();
  const showSnapshot = useSnapshotModal();

  React.useEffect(() => {
    const onRefresh = () => setRefreshToken(v => v + 1);
    const onVnc = e => e.detail && showVnc(e.detail);
    const onSsh = e => e.detail && window.openSshConfigModal && window.openSshConfigModal(shell, e.detail);
    const onRoute = () => {
      const state = window.ociRouter?.read?.();
      if (!state || state.page !== 'instances') return;
      const q = state.query || {};
      setPage(Math.max(1, Number(q.page || 1)));
      setPerPage(Math.max(1, Number(q.size || 10)));
      setTenantFilter(q.tenantId || '');
      setRegionFilter(q.regionId || '');
    };
    window.addEventListener('oci:instances-changed', onRefresh);
    window.addEventListener('oci:open-vnc', onVnc);
    window.addEventListener('oci:open-ssh', onSsh);
    const unsub = window.ociRouter?.subscribe?.(onRoute);
    return () => {
      window.removeEventListener('oci:instances-changed', onRefresh);
      window.removeEventListener('oci:open-vnc', onVnc);
      window.removeEventListener('oci:open-ssh', onSsh);
      unsub?.();
    };
  }, [showVnc]);

  const writeRouteQuery = React.useCallback((patch) => {
    const current = (() => { try { return window.ociRouter?.read?.().query || {}; } catch { return {}; } })();
    window.ociRouter?.go('instances', {
      ...current,
      page: patch.page == null ? page : patch.page,
      size: patch.size == null ? perPage : patch.size,
      tenantId: patch.tenantId == null ? tenantFilter : patch.tenantId,
      regionId: patch.regionId == null ? regionFilter : patch.regionId,
    }, { replace: true });
  }, [page, perPage, tenantFilter, regionFilter]);

  const filtered = instances.filter(i => {
    // 区域下拉的 value 是区域子租户数据库 id；父租户只用于加载区域选项。
    if (regionFilter && i.tenantId !== regionFilter) return false;
    if (nameFilter && i.name !== nameFilter) return false;
    return true;
  });
  // 后端已经按 page/size 返回当前页；仅对区域/名称的本地展示筛选再做一次过滤。
  const paged = filtered;
  const hasFilter = Boolean(tenantFilter || regionFilter || nameFilter);

  // 使用与"资源列表"页完全一致的 16 项 InstanceRowActionMenu(见 instance-actions.jsx)
  // - 表格行点击仍然打开"实例详情" drawer(onRowClick={showDetail})
  // - 行末 ⋯ 按钮弹出 16 项 2 列菜单(对齐原项目 oci_machine_list.ftl)
  const rowAction = (id, inst) => {
    // 交给统一的 dispatch(makeInstanceActionRunner 挂在 window)
    return window.makeInstanceActionRunner(shell, inst)(id);
  };

  const columns = [
    { key: 'seq', label: tr('instances.col.seq'), width: 40,
      render: r => <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{r.seq}</span> },
    { key: 'tenantName', label: tr('instances.col.tenant'),
      render: r => {
        // 展开时显示反脱敏名 + 自定义名（对齐租户页的行为）
        const t = tenantOptions.find(x => String(x.id) === String(r.tenantId));
        // 后端只返回一个租户显示字段；未提供明文时不能在前端猜测或拼接名称。
        const shownName = r.tenantName;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={t ? `${r.tenantName} · ${getTenantName(t)}` : r.tenantName}>
            <span className="mono" style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4, fontSize: 11, color: 'var(--fg-1)' }}>{shownName}</span>
            <Icon name="link" size={11} style={{ color: 'var(--fg-3)' }} />
          </span>
        );
      },
    },
    { key: 'region', label: tr('instances.col.region'), width: 100, render: r => <RegionBadge code={r.region} lang={lang} /> },
    { key: 'name', label: tr('instances.col.name'), width: 160,
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <StatusDot status={r.status} size={7} pulse={r.status === 'running'} />
          <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{r.name}</span>
        </span>
      ),
    },
    { key: 'cpuMem', label: tr('instances.col.cpuMem'),
      render: r => <span className="mono" style={{ color: 'var(--fg-1)' }}>{r.cpuAndMem == null || r.cpuAndMem === '' ? '—' : r.cpuAndMem}</span> },
    { key: 'arch', label: tr('instances.col.arch'),
      render: r => (
        <span style={{
          padding: '1px 6px',
          background: getInstanceArch(r) === 'ARM' ? 'var(--info-soft)' : 'var(--violet-soft)',
          color: getInstanceArch(r) === 'ARM' ? 'var(--info)' : 'var(--violet)',
          borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        }}>{getInstanceArch(r)}</span>
      ),
    },
    { key: 'diskVpu', label: tr('instances.col.diskVpu'),
      render: r => <span className="mono" style={{ color: 'var(--fg-1)' }}>{r.disk}GB/{r.vpu}</span> },
    { key: 'ipv4', label: tr('instances.col.ipv4'),
      render: r => <span className="mono" style={{ color: 'var(--cyan)', fontSize: 11.5 }}>{getInstanceIp(r)}</span> },
    { key: 'ipv6', label: tr('instances.col.ipv6'),
      render: r => r.ipv6 === 'enabled'
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
            <Icon name="check" size={11} />{tr('status.enabled')}
          </span>
        : <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{tr('status.disabled')}</span>,
    },
    { key: 'createdAt', label: tr('instances.col.createdAt'),
      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{r.createdAt}</span> },
    { key: 'actions', label: tr('common.operation'), width: 40, align: 'center',
      render: r => (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            // 若已打开同一行 → 关闭
            if (menuFor?.inst === r) { setMenuFor(null); return; }
            setMenuFor({ inst: r, anchorEl: e.currentTarget });
          }}
          style={{
            width: 28, height: 28, borderRadius: 4,
            background: menuFor?.inst === r ? 'var(--accent)' : 'var(--bg-2)',
            border: '1px solid ' + (menuFor?.inst === r ? 'var(--accent)' : 'var(--border)'),
            color: menuFor?.inst === r ? 'var(--accent-fg)' : 'var(--fg-1)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 100ms',
          }}
          title={tr('common.operation')}
        >
          <Icon name="more-horizontal" size={14} />
        </button>
      ),
    },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <PageHeader
        title={tr('instances.title')}
        icon="server"
        iconColor="var(--cyan)"
        actions={
          <>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('common.selectPlaceholder')}:</span>
            <Select
              value={tenantFilter}
              onChange={v => {
                setTenantFilter(v);
                setRegionFilter('');
                setRegionOptions([]);
                setPage(1);
                writeRouteQuery({ tenantId: v, regionId: '', page: 1 });
              }}
              placeholder={tr('common.selectTenant')}
              width={160}
            options={tenantOptions.map(t => ({
              value: getTenantDbId(t),
              label: `${instanceTenantDisplayName(t) || getTenantDbId(t)} · ${instanceTenantDisplayAlias(t) || t.region || ''}`,
            }))}
            />
            <Select
              value={regionFilter}
              onChange={v => { setRegionFilter(v); setPage(1); writeRouteQuery({ regionId: v, page: 1 }); }}
              placeholder={tr('common.selectRegion')}
              width={160}
              disabled={!tenantFilter || regionLoading || regionOptions.length === 0}
              searchable={regionOptions.length > 1}
              options={regionOptions.map(r => ({ value: r.id, label: r.label }))}
            />
            <IconButton
              icon={masked ? 'eye' : 'eye-off'}
              onClick={() => setMasked(!masked)}
              tooltip={masked ? tr('instances.mask.show') : tr('instances.mask.hide')}
              size={30}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}
            />
            <Button variant="primary" size="md" icon="search" disabled={!regionFilter} onClick={() => shell.showToast(tr('instances.filter.applied').replace('{n}', filtered.length), { kind: 'info' })}>{tr('instances.action.view')}</Button>
            <Button variant="orange" size="md" icon="download" onClick={() => {
              // 原项目 confirmExportInstances 明确提示导出内容包含所有租户的
              // 明文 Root 密码；必须确认后才调用真实 /oci/export。
              shell.openConfirm({
                title: tr('instances.export.warnTitle'),
                body: (
                  <div style={{ lineHeight: 1.7, fontSize: 12 }}>
                    {tr('instances.export.warnBody')}
                  </div>
                ),
                danger: true,
                confirmLabel: tr('instances.export.confirm'),
                onConfirm: async () => {
                  try {
                    const blob = await window.ociServices.instance.export();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `oci-instances-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    shell.showToast(tr('instances.export.ok'), { kind: 'success' });
                  } catch (error) {
                    shell.showToast(tr('instances.export.fail').replace('{err}', error.message || error), { kind: 'error' });
                  }
                },
              });
            }}>{tr('instances.action.export')}</Button>
          </>
        }
      />

      <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 12px', marginBottom: 12,
          background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 45%, transparent)',
          borderRadius: 6, fontSize: 12,
        }}>
          <Icon name="filter" size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{tr('instances.filter.current')}</span>
          {nameFilter && (
            <span style={{ padding: '2px 8px', background: 'var(--bg-1)', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-0)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('instances.filter.name')}</span>
              <span className="mono">{nameFilter}</span>
                <button onClick={() => { setNameFilter(''); setPage(1); writeRouteQuery({ page: 1 }); }} style={{
                width: 14, height: 14, borderRadius: 3, background: 'transparent',
                border: 'none', color: 'var(--fg-3)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="x" size={10} />
              </button>
            </span>
          )}
          {tenantFilter && !nameFilter && (
            <span style={{ padding: '2px 8px', background: 'var(--bg-1)', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-0)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('instances.filter.tenant')}</span>
              {(() => {
                const selected = tenantOptions.find(t => getTenantDbId(t) === String(tenantFilter));
                const label = selected && (instanceTenantDisplayAlias(selected) || instanceTenantDisplayName(selected));
                return <span className="mono">{label || tenantFilter}</span>;
              })()}
            </span>
          )}
          {regionFilter && (
            <span style={{ padding: '2px 8px', background: 'var(--bg-1)', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-0)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('instances.filter.region')}</span>
              <span className="mono">{regionOptions.find(r => r.id === String(regionFilter))?.label || regionFilter}</span>
            </span>
          )}
          {!hasFilter && (
            <>
              <span style={{ padding: '2px 8px', background: 'var(--bg-1)', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-0)' }}>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('instances.filter.tenant')}</span>
                <span className="mono">{tr('instances.filter.unselected')}</span>
              </span>
              <span style={{ padding: '2px 8px', background: 'var(--bg-1)', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--fg-0)' }}>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('instances.filter.region')}</span>
                <span className="mono">{tr('instances.filter.unselected')}</span>
              </span>
            </>
          )}
          <span style={{ color: 'var(--fg-2)' }}>· {tr('instances.filter.matchedPrefix')}<b style={{ color: 'var(--accent)' }}>{filtered.length}</b>{tr('instances.filter.matchedSuffix')}</span>
          <div style={{ flex: 1 }} />
          <Button size="xs" variant="outline" icon="rotate-ccw"
          disabled={!hasFilter}
          onClick={() => { setTenantFilter(''); setRegionFilter(''); setRegionOptions([]); setNameFilter(''); setPage(1); writeRouteQuery({ tenantId: '', regionId: '', page: 1 }); }}
          >{tr('instances.filter.clear')}</Button>
      </div>

      {loadError && (
        <div style={{ marginBottom: 12, padding: '10px 14px', border: '1px solid var(--danger)', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-circle" size={15} />
          <span style={{ flex: 1 }}>{loadError}</span>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 14,
      }}>
        <KPICard label={tr('instances.kpi.total')} value={totalElements} icon="server" iconColor="var(--cyan)" />
        <KPICard label={tr('status.running')} value={instances.filter(i => i.status === 'running').length} icon="play-circle" iconColor="var(--accent)" />
        <KPICard label={tr('instances.kpi.arm')} value={instances.filter(i => getInstanceArch(i) === 'ARM').length} icon="cpu" iconColor="var(--info)" />
        <KPICard label={tr('instances.kpi.regions')} value={new Set(instances.map(i => i.region)).size} icon="globe" iconColor="var(--violet)" />
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
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-2)' }}>{tr('instances.loading')}</div>
            : <Table columns={columns} rows={paged} density={density} onRowClick={showDetail} />}
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination
          total={regionFilter || nameFilter ? filtered.length : totalElements}
          page={page}
          perPage={perPage}
          onPageChange={n => { setPage(n); writeRouteQuery({ page: n }); }}
          onPerPageChange={n => { setPerPage(n); setPage(1); writeRouteQuery({ size: n, page: 1 }); }}
          t={tr}
        />
        </div>
      </div>

      {menuFor && (
        <InstanceRowActionMenu
          inst={menuFor.inst}
          anchorEl={menuFor.anchorEl}
          onClose={() => setMenuFor(null)}
          onAction={rowAction}
        />
      )}
    </div>
  );
}

Object.assign(window, { InstancesPage });
