// Tenants page — every button/menu wired to real modals/drawers/confirms.
const { useState: useStateT, useEffect: useEffectT } = React;

function TenantsPage({ density }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  // 分页/筛选状态与 URL hash 查询同步(/#/tenants?page=&size=&keyword=&cloudType=)
  // 初始值从 hash 查询读取,便于分享/刷新保持;后续用户交互回写 hash 查询。
  const initialRoute = (typeof window !== 'undefined' && window.ociRouter) ? window.ociRouter.read() : { query: {} };
  const initSearch = initialRoute.query.keyword || '';
  const initPage = (initialRoute.query.page !== undefined && initialRoute.query.page !== '') ? Math.max(1, Number(initialRoute.query.page) + 1) : 1;
  const initSize = (initialRoute.query.size !== undefined && initialRoute.query.size !== '') ? Math.max(1, Number(initialRoute.query.size)) : 10;
  const initCloudType = (initialRoute.query.cloudType !== undefined && initialRoute.query.cloudType !== '') ? Number(initialRoute.query.cloudType) : 1;

  const [search, setSearch] = useStateT(initSearch);
  const [page, setPage] = useStateT(initPage);
  const [perPage, setPerPage] = useStateT(initSize);
  const [cloudType, setCloudType] = useStateT(initCloudType);
  const [masked, setMasked] = useStateT(true);
  const [checking, setChecking] = useStateT(false);
  const [checkProgress, setCheckProgress] = useStateT(0);
  const [exportCode, setExportCode] = useStateT('');
  const [menuFor, setMenuFor] = useStateT(null);
  const [tenants, setTenants] = useStateT([]);
  const [totalElements, setTotalElements] = useStateT(0);
  const [loading, setLoading] = useStateT(true);
  const [loadError, setLoadError] = useStateT('');

  // 编辑自定义名称 — 对齐原项目 editCustomName / saveCustomName(POST /tenants/updateCustomName)
  // 使用本地 state 对象 + 重新 openModal 刷新输入框(与 tenant-actions 的 render() 模式一致)
  const editCustomName = React.useCallback((row) => {
    // 未设置过自定义名称时(defName 缺失或回落为 userName/OCID),输入框默认为空
    const currentAlias = getTenantAlias(row) || '';
    const initialAlias = (currentAlias && currentAlias !== row.userName) ? currentAlias : '';
    const state = { value: initialAlias, saving: false };

    const save = async () => {
      if (state.saving) return;
      state.saving = true;
      const newName = state.value.trim();
      try {
        const j = await window.ociServices.tenant.updateCustomName({
          tenantId: getTenantDbId(row),
          defName: newName,
        });
        if (j && j.success) {
          shell.showToast('✓ ' + tr('tenants.editCustom.saved'), { kind: 'success' });
          shell.closeModal();
          // 重新拉取后端权威数据,避免本地臆造 defName。
          if (loadTenantsRef.current) loadTenantsRef.current();
        } else {
          shell.showToast((j && j.message) || tr('tenants.editCustom.failed'), { kind: 'error' });
        }
      } catch (e) {
        shell.showToast(e.message || e, { kind: 'error' });
      } finally {
        state.saving = false;
      }
    };

    const render = () => {
      shell.openModal({
        title: tr('tenants.editCustom.title'),
        subtitle: tr('tenants.editCustom.subtitle'),
        icon: 'edit', iconColor: 'var(--accent)', size: 'sm',
        body: (
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 11.5, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 6 }}>
              {tr('tenants.col.custom')}
            </div>
            <TextInput
              value={state.value}
              onChange={v => { state.value = v; render(); }}
              placeholder={tr('tenants.editCustom.placeholder')}
              maxLength={100}
              style={{ fontWeight: 500 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-3)' }}>{tr('tenants.editCustom.limit')}</div>
          </div>
        ),
        footer: (
          <React.Fragment>
            <Button variant='ghost' size='md' onClick={() => shell.closeModal()}>{tr('common.cancel')}</Button>
            <Button variant='primary' size='md' icon='save' disabled={state.saving} onClick={save}>{tr('common.save')}</Button>
          </React.Fragment>
        ),
      });
    };

    render();
  }, [tr, shell, setTenants]);

  // 编辑账号成本 — 对齐原项目 editAccountCost/saveAccountCost。
  const editAccountCost = React.useCallback((row) => {
    const state = { value: row.accountCost ?? '', saving: false };
    const save = async () => {
      if (state.saving) return;
      state.saving = true;
      try {
        const j = await window.ociServices.tenant.updateAccountCost({
          tenantId: getTenantDbId(row),
          accountCost: state.value.trim(),
        });
        if (j && j.success) {
          shell.showToast(tr('tenants.cost.updated'), { kind: 'success' });
          shell.closeModal();
          if (loadTenantsRef.current) loadTenantsRef.current();
        } else {
          shell.showToast((j && j.message) || tr('tenants.cost.updateFail'), { kind: 'error' });
        }
      } catch (error) {
        shell.showToast(error.message || error, { kind: 'error' });
      } finally {
        state.saving = false;
      }
    };
    const render = () => shell.openModal({
      title: tr('tenants.cost.editTitle'),
      subtitle: getTenantName(row) || row._ui.name,
      icon: 'dollar-sign', iconColor: 'var(--orange)', size: 'sm',
      body: (
        <div style={{ padding: 6 }}>
          <TextInput
            value={state.value}
            onChange={value => { state.value = value; render(); }}
            placeholder={tr('tenants.cost.placeholder')}
            maxLength={100}
          />
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={() => shell.closeModal()}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="save" disabled={state.saving} onClick={save}>{tr('common.save')}</Button>
        </>
      ),
    });
    render();
  }, [shell, tr]);

  // 真实后端 · 加载租户列表(GET /tenants/list/json,原项目 Web 端)并映射为页面所需形状
  const loadTenants = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const json = await window.ociApi.getPage('/tenants/list/json', {
        page: page - 1,
        size: perPage,
        keyword: search.trim(),
        cloudType,
      });
      setTenants(json.content.map(row => window.ociTenantRow.normalize(row, REGIONS)));
      setTotalElements(Number(json.totalElements) || 0);
    } catch (error) {
      setTenants([]);
      setTotalElements(0);
      setLoadError(error.message || tr('tenants.err.load'));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, cloudType]);

  // 供先定义的 editCustomName 在保存后重新拉取最新列表(避免依赖声明顺序带来的 TDZ 问题)。
  const loadTenantsRef = React.useRef(loadTenants);
  useEffectT(() => { loadTenantsRef.current = loadTenants; }, [loadTenants]);

  // 初始加载 + 监听全局"刷新增页数据"事件(导入成功后由 tenant-actions 派发,避免整页 reload)
  useEffectT(() => {
    const timer = setTimeout(loadTenants, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadTenants, search]);
  useEffectT(() => {
    const onRefresh = (e) => {
      if (!e.detail || e.detail === 'tenants') loadTenants();
    };
    window.addEventListener('ocip-refresh-page', onRefresh);
    return () => window.removeEventListener('ocip-refresh-page', onRefresh);
  }, [loadTenants]);

  // 分页/筛选回写 hash 查询:地址栏可分享/刷新保持,与原始 Web 页 URL 参数语义一致。
  // 用 replace 避免污染历史;删除/自定义名称保存后通过 loadTenants 重新拉取后端权威数据。
  useEffectT(() => {
    if (typeof window === 'undefined' || !window.ociRouter) return;
    const q = { cloudType };
    if (perPage !== 10) q.size = perPage;
    if (search.trim()) q.keyword = search.trim();
    if (page > 1) q.page = page - 1;
    window.ociRouter.go('tenants', q, { replace: true });
  }, [page, perPage, search, cloudType]);

  // Modal / drawer hooks
  const addBoot          = useAddBootModal();
  const proxyQuick       = useTenantProxyQuickModal();
  const apiImport        = useApiImportModal();
  const importTenants    = useImportTenantsModal();
  // 租户详情已改为独立页面(见 page-tenant-detail.jsx),不再用 Modal
  // 保留 useTenantDetailDrawer 代码以防回退,但入口走 window.__ocipNavigate
  const quota            = useQuotaDrawer();
  const cost             = useCostDrawer();
  const traffic          = useTrafficDrawer();
  const audit            = useAuditDrawer();
  const userManage       = useUserManageModal();
  const regionSubscribe  = useRegionSubscribeModal();
  const trafficAlert     = useTrafficAlertModal();
  const mail             = useMailModal();
  const socialConfig     = useSocialConfigModal();
  const updateAccount    = useUpdateAccountModal();
  const exportTenant     = useExportTenantModal();

  const filtered = tenants;
  const paged = tenants;

  const runBatchCheck = async () => {
    setChecking(true);
    setCheckProgress(0);
    try {
      const res = await fetch('/tenants/checkAccounts', { headers: { 'Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, credentials: 'include' });
      const j = await res.json();
      setChecking(false);
      setCheckProgress(100);
      shell.showToast(tr('tenants.check.done').replace('{total}', j.totalAccounts).replace('{active}', j.activeAccounts).replace('{inactive}', j.inactiveAccounts), { kind: j.inactiveAccounts > 0 ? 'warn' : 'success' });
      setTimeout(() => setCheckProgress(0), 600);
    } catch (e) { setChecking(false); setCheckProgress(0); shell.showToast(tr('tenants.check.fail').replace('{err}', e.message || e), { kind: 'error' }); }
  };

  const exportAll = async () => {
    // 1) 发送导出验证码到管理员渠道
    try {
      await window.ociApi.request('/tenants/verify/sendExportCode', { method: 'POST' });
    } catch (error) {
      shell.showToast(tr('tenants.export.codeFail').replace('{err}', error.message || error), { kind: 'error' });
      return;
    }
    setExportCode('');
    shell.openModal({
      title: tr('tenants.export.title'),
      subtitle: tr('tenants.export.subtitle'),
      icon: 'download', iconColor: 'var(--accent)', size: 'sm',
      body: (
        <div style={{ padding: 8 }}>
          <input autoFocus value={exportCode}
            onChange={e => setExportCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={tr('tenants.export.codePh')} maxLength={6}
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 16, fontFamily: 'var(--font-mono)', letterSpacing: 6, textAlign: 'center', outline: 'none' }} />
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="download" disabled={exportCode.length !== 6} onClick={async () => {
            try {
              const res = await fetch('/tenants/export', { method: 'GET', headers: { 'X-Verify-Code': exportCode, 'Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, credentials: 'include' });
              if (res.ok) {
                const blob = await res.blob(); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `tenants_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
                shell.showToast(tr('tenants.export.ok'), { kind: 'success' });
              } else shell.showToast(tr('tenants.export.fail').replace('{err}', res.status), { kind: 'error' });
            } catch (e) { shell.showToast(tr('tenants.export.fail').replace('{err}', e.message || e), { kind: 'error' }); }
            shell.closeModal();
          }}>{tr('tenants.export.submit')}</Button>
        </>
      ),
    });
  };

  // Action dispatch for the row menu
  const runAction = (id, tenant) => {
    switch (id) {
      case 'add-boot':         return addBoot(tenant);
      case 'update-account':    return updateAccount(tenant);
      case 'tenant-detail':
        // 跳转到独立的租户详情页
        if (window.__ocipNavigate) {
          window.__ocipNavigate('tenant-detail', { tenantId: getTenantDbId(tenant), tab: 'overview', regionCode: getTenantRegion(tenant) });
        }
        return;
      case 'region-subscribe': return regionSubscribe(tenant);
      case 'user-manage':      return userManage(tenant);
      case 'traffic-alert':    return trafficAlert(tenant);
      case 'traffic-query':    return traffic(tenant);
      case 'audit-log':        return audit(tenant);
      case 'cost':             return cost(tenant);
      case 'export':           return exportTenant(tenant);
      case 'mail':             return mail(tenant);
      case 'social':           return socialConfig(tenant);
      case 'quota':            return quota(tenant);
      case 'delete':
        shell.openConfirm({
          title: tr('tenants.delete.title').replace('{name}', tenant._ui.name),
          body: (
            <div>
              {tr('tenants.delete.body')}
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 16 }}>
                <li>{tr('tenants.delete.item.api')}</li>
                <li>{tr('tenants.delete.item.tasks')}</li>
                <li>{tr('tenants.delete.item.alerts')}</li>
              </ul>
              <div style={{ marginTop: 8, color: 'var(--fg-3)' }}>{tr('tenants.delete.note')}</div>
            </div>
          ),
          danger: true,
          requireText: tenant._ui.name,
          confirmLabel: tr('tenants.delete.confirm'),
          onConfirm: async () => {
            try {
              const j = await window.ociApi.request(`/tenants/deleteApi?tenantId=${encodeURIComponent(getTenantDbId(tenant))}`);
              if (j && j.success) { shell.showToast(tr('tenants.delete.ok').replace('{name}', tenant._ui.name), { kind: 'success' }); loadTenants(); }
              else shell.showToast(tr('tenants.delete.fail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
            } catch (e) { shell.showToast(tr('tenants.delete.fail').replace('{err}', e.message || e), { kind: 'error' }); }
          },
        });
        return;
    }
  };

  const columns = [
    { key: 'proxy', label: tr('tenants.col.proxy'), width: 40, align: 'center', render: r => {
      const forced = r.proxyForce === true || r.proxyForce === 1 || r.proxyForce === '1';
      const bound = forced || r.proxyBound === true || r.proxyBound === 1 || r.proxyBound === '1';
      return (
        <button
          type="button"
          aria-label={tr('tenants.proxy.aria')}
          title={forced ? tr('tenants.proxy.forced') : bound ? tr('tenants.proxy.bound') : tr('tenants.proxy.unbound')}
          onClick={e => { e.stopPropagation(); proxyQuick(r); }}
          style={{ width: 26, height: 26, border: 0, background: 'transparent', color: forced ? 'var(--orange)' : bound ? 'var(--accent)' : 'var(--fg-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        ><Icon name="shield" size={15} /></button>
      );
    } },
    { key: 'name', label: tr('tenants.col.name'),
      render: r => <span className="mono" style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4, fontSize: 11, color: 'var(--fg-1)', fontWeight: 500 }}>{masked ? r._ui.name : r._ui.name.replace('***', 'user')}</span>,
    },
    { key: 'custom', label: tr('tenants.col.custom'), render: r => {
      const alias = getTenantAlias(r);
      // 未设置过自定义名称时(defName 缺失或回落为 userName/OCID),显示为空(—)
      // 后端历史数据会把未设置的 defName 回填为 userName/OCID；这些值仍应按“未设置”显示为空。
      const hasCustomName = alias !== ''
        && alias !== r.userName
        && alias !== r.idStr
        && alias !== r.tenantId;
      return (
        <a
          role="button"
          tabIndex={0}
          title={alias || ''}
          onClick={e => { e.stopPropagation(); editCustomName(r); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); editCustomName(r); } }}
          style={{
            color: alias ? 'var(--fg-1)' : 'var(--fg-3)',
            fontWeight: 500,
            textDecoration: 'none',
            borderBottom: alias ? '1px dashed rgba(150,160,170,0.55)' : '1px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {/* 未设置自定义名称时默认为空，对齐原项目 defName 为空时的空白展示 */}
          {hasCustomName ? window.truncateDisplayName(alias, 14) : ''}
        </a>
      );
    } },
    { key: 'cost', label: tr('tenants.col.cost'),
      render: r => (
        <button
          type="button"
          onClick={event => { event.stopPropagation(); editAccountCost(r); }}
          title={tr('tenants.cost.editTitle')}
          className="num"
          style={{
            padding: 0,
            border: 0,
            borderBottom: '1px dashed rgba(150,160,170,0.55)',
            background: 'transparent',
            color: r._ui.accountCost === 0 ? 'var(--accent)' : 'var(--orange)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {r._ui.accountCost === 0 ? '0' : `$${r._ui.accountCost}`}
        </button>
      ),
    },
    { key: 'days', label: tr('tenants.col.days'),
      render: r => <span style={{ padding: '2px 8px', background: 'var(--info-soft)', color: 'var(--info)', borderRadius: 4, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{getTenantDays(r)}</span>,
    },
    { key: 'task', label: tr('tenants.col.task'),
      render: r => <span style={{ padding: '2px 8px', background: r._ui.hasBootTask ? 'var(--accent-soft)' : 'var(--bg-3)', color: r._ui.hasBootTask ? 'var(--accent)' : 'var(--fg-2)', borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {r._ui.hasBootTask && <StatusDot status="running" size={5} pulse />}
        {r._ui.hasBootTask ? tr('tenants.task.active') : tr('tenants.task.none')}
      </span>,
    },
    { key: 'mainRegion', label: tr('tenants.col.mainRegion'), render: r => <RegionBadge code={getTenantRegion(r)} lang={lang} /> },
    { key: 'multiRegion', label: tr('tenants.col.multiRegion'),
      render: r => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: r._ui.hasChildren ? 'var(--accent)' : 'var(--fg-3)' }}>
        <StatusDot status={r._ui.hasChildren ? 'active' : 'idle'} size={6} />
        <span style={{ fontSize: 12 }}>{r._ui.hasChildren ? tr('tenants.col.multi.yes') : tr('tenants.col.multi.no')}</span>
      </span>,
    },
    { key: 'accountType', label: tr('tenants.col.accountType'),
      render: r => {
        const _unknownType = (n) => !n || n === '未知' || n === '未知账号/权限不足' || n === 'Unknown' || n === tr('tenants.type.unknown');
        const known = r.accountTypeName && !_unknownType(r.accountTypeName);
        const typeText = known ? r.accountTypeName : (r._ui.hasChildren ? tr('tenants.type.multi-region') : tr('tenants.type.unknown'));
        const isTrial = r.accountType === 'trial' || typeText === tr('tenants.type.trial');
        const isOfficial = r.accountType === 'official' || typeText === tr('tenants.type.official');
        return (
          <span style={{
            padding: '2px 8px',
            background: isTrial ? 'var(--violet-soft)' : isOfficial ? 'var(--cyan-soft)' : 'var(--orange-soft)',
            color: isTrial ? 'var(--violet)' : isOfficial ? 'var(--cyan)' : 'var(--orange)',
            borderRadius: 4, fontSize: 11, fontWeight: 500,
          }}>{typeText}</span>
        );
      },
    },
    { key: 'instOp', label: tr('tenants.col.instOp'),
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); addBoot(r); }}
          style={{
            background: 'var(--orange)', color: 'oklch(0.14 0.02 55)',
            border: 'none', borderRadius: 4,
            padding: '4px 10px',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            transition: 'filter 100ms',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          <Icon name="zap" size={11} strokeWidth={2.2} />
          {tr('tenants.createInstance')}
        </button>
      ),
    },
    { key: 'createdAt', label: tr('tenants.col.createdAt'), render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{r._ui.createdAt}</span> },
    { key: 'status', label: tr('tenants.col.status'),
      render: r => <StatusPill status={r._ui.status === 'active' ? 'active' : r._ui.status} label={tr('status.' + r._ui.status)} />,
    },
    { key: 'actions', label: tr('common.operation'), width: 40, align: 'center',
      render: r => {
        const isOpen = menuFor?.tenant === r;
        return (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              // 已打开同一行 → 关闭
              if (isOpen) { setMenuFor(null); return; }
              setMenuFor({ tenant: r, anchorEl: e.currentTarget });
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
      },
    },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <PageHeader
        title={tr('tenants.title')}
        icon="users"
        iconColor="var(--accent)"
        actions={
          <>
            <SearchInput placeholder={tr('tenants.search')} value={search} onChange={value => { setSearch(value); setPage(1); }} width={280} />
            <IconButton
              icon={masked ? 'eye' : 'eye-off'}
              onClick={() => setMasked(!masked)}
              tooltip={tr('tenants.action.toggleMasked')}
              size={30}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}
            />
            <Button variant="primary" size="md" icon="zap" onClick={apiImport}>{tr('tenants.action.apiImport')}</Button>
            <Button variant="cyan" size="md" icon="download" onClick={exportAll}>{tr('tenants.action.exportData')}</Button>
            <Button variant="info" size="md" icon="upload" onClick={importTenants}>{tr('tenants.action.importData')}</Button>
            <Button variant="orange" size="md" icon="shield-check" onClick={runBatchCheck} disabled={checking}>
              {checking ? tr('tenants.check.progress').replace('{p}', checkProgress) : tr('tenants.action.batchCheck')}
            </Button>
          </>
        }
      />

      {checking && (
        <div style={{
          marginBottom: 12,
          padding: '10px 14px',
          background: 'var(--bg-1)',
          border: '1px solid var(--orange)',
          borderRadius: 'var(--radius)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Icon name="loader" size={16} style={{ color: 'var(--orange)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-1)', marginBottom: 4 }}>
              {tr('tenants.check.count')}{tenants.length}{tr('tenants.check.donePrefix')}<span className="num" style={{ color: 'var(--orange)', fontWeight: 600 }}>{Math.floor(tenants.length * checkProgress / 100)}</span>
            </div>
            <ProgressBar value={checkProgress} max={100} color="var(--orange)" height={4} />
          </div>
        </div>
      )}

      {loadError && (
        <div style={{ marginBottom: 12, padding: '10px 14px', border: '1px solid var(--danger)', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-circle" size={15} />
          <span style={{ flex: 1 }}>{loadError}</span>
          <Button size="xs" variant="outline" onClick={loadTenants}>{tr('common.retry')}</Button>
        </div>
      )}

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
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-2)' }}>{tr('tenants.loading')}</div>
            : <Table columns={columns} rows={paged} density={density} />}
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination
            total={totalElements}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={n => { setPerPage(n); setPage(1); }}
            t={tr}
          />
        </div>
      </div>

      {menuFor && (
        <TenantActionMenu
          tenant={menuFor.tenant}
          anchorEl={menuFor.anchorEl}
          onClose={() => setMenuFor(null)}
          onAction={runAction}
        />
      )}
    </div>
  );
}

// The 14-item action grid — same look as before, now dispatches real actions.
// 租户 14 项操作菜单 · 使用统一的 <RowActionMenu>(见 shell.jsx)
function TenantActionMenu({ tenant, anchorEl, onClose, onAction }) {
  const items = [
    { id: 'add-boot',         label: tr('tenants.menu.addBoot'), icon: 'plus'        },
    { id: 'tenant-detail',    label: tr('tenants.menu.detail'), icon: 'info'        },
    { id: 'user-manage',      label: tr('tenants.menu.userManage'), icon: 'users'       },
    { id: 'traffic-query',    label: tr('tenants.menu.trafficQuery'), icon: 'bar-chart-3' },
    { id: 'cost',             label: tr('tenants.menu.cost'), icon: 'info'        },
    { id: 'mail',             label: tr('tenants.menu.mail'), icon: 'mail'        },
    { id: 'quota',            label: tr('tenants.menu.quota'), icon: 'bar-chart-3', color: 'var(--accent)' },
    { id: 'update-account',   label: tr('tenants.menu.updateAccount'), icon: 'refresh-cw'  },
    { id: 'region-subscribe', label: tr('tenants.menu.regionSubscribe'), icon: 'globe'       },
    { id: 'traffic-alert',    label: tr('tenants.menu.trafficAlert'), icon: 'bell'        },
    { id: 'audit-log',        label: tr('tenants.menu.auditLog'), icon: 'file-text'   },
    { id: 'export',           label: tr('tenants.menu.export'), icon: 'download'    },
    { id: 'social',           label: tr('tenants.menu.social'), icon: 'share-2'     },
    { id: 'delete',           label: tr('tenants.menu.delete'), icon: 'trash-2',    color: 'var(--danger)' },
  ];
  const header = (
    <>
      <StatusDot status={tenant._ui.status} size={5} pulse={tenant._ui.status === 'active'} />
      <span className="mono" style={{
        padding: '1px 6px', borderRadius: 3,
        background: 'var(--bg-3)', color: 'var(--fg-0)',
        fontSize: 11, fontWeight: 500,
      }}>{tenant._ui.name}</span>
      <span style={{ color: 'var(--fg-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {getTenantName(tenant)}
      </span>
    </>
  );
  return (
    <RowActionMenu
      anchorEl={anchorEl}
      header={header}
      items={items}
      onClose={onClose}
      onAction={(id) => onAction(id, tenant)}
    />
  );
}

Object.assign(window, { TenantsPage });
