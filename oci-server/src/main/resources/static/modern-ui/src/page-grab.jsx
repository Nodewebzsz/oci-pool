// Grab tasks page — every button wired via shell (modal / drawer / confirm / toast)
const { useState: useStateG, useEffect: useEffectG } = React;

function normalizeBootTask(b, index = 0) {
  return {
    ...b,
    id: b.id,
    seq: index + 1,
    bootId: b.bootId,
    tenantId: b.tenantId == null ? '' : String(b.tenantId),
    tenantName: b.tenancyName || '',
    defName: b.defName,
    custom: b.defName,
    region: b.regionName || '',
    openBootFlag: b.openBootFlag,
    status: b.openBootFlag ? 'running' : 'idle',
    executing: Number(b.executingCount || 0),
    totalTasks: Number(b.recordCount || 0),
    addCount: Number(b.addCount || 0),
    failCount: Number(b.failCount || 0),
    successCount: Number(b.successCount || 0),
    currentAttemptCount: Number(b.currentAttemptCount || 0),
    yesterdayAttemptCount: Number(b.yesterdayAttemptCount || 0),
    createdAt: b.createAtStr || '',
  };
}

function GrabPage({ density }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const route = (() => { try { return window.ociRouter?.read?.() || {}; } catch { return {}; } })();
  const routeQuery = route.query || {};
  const routeParams = route.params || {};
  const isSubPage = (route.page === 'tenant-grab') || (routeQuery.from === 'detail') || Boolean(routeParams.tenantDbId);
  const targetTenantId = routeParams.tenantDbId || routeQuery.tenantId || '';
  const [tenantFilter, setTenantFilter] = useStateG(targetTenantId);
  const [regionFilter, setRegionFilter] = useStateG(routeQuery.regionId || routeQuery.region || '');
  const [page, setPage] = useStateG(Math.max(1, Number(routeQuery.page || 1)));
  const [perPage, setPerPage] = useStateG(Math.max(1, Number(routeQuery.size || 20)));
  const [menuFor, setMenuFor] = useStateG(null);
  // 显示/隐藏脱敏 toggle — 打开后 tenantName 列从 z***c 展开为完整 tenancyName
  const [unmask, setUnmask] = useStateG(false);



  // Hooks — 7 project-original + 2 high-frequency additions
  const addBoot   = useAddBootModal();
  const showLogs  = useGrabTaskLogsDrawer();
  const editTask  = useGrabTaskEditModal();
  const cloneTask = useCloneTaskModal();
  const oneShot   = useGrabOneShotModal();
  const showInsts = useTaskInstancesDrawer();

  const [tasks, setTasks] = useStateG([]);
  // 租户/区域筛选下拉独立加载（对齐实例管理：listParentTenants → TenantResp）
  const [tenantOptions, setTenantOptions] = useStateG([]);
  useEffectG(() => {
    let alive = true;
    window.ociServices.tenant.listParentTenants()
      .then(rows => {
        if (!alive) return;
        const normalized = (Array.isArray(rows) ? rows : []).map(row => (window.ociTenantRow ? window.ociTenantRow.normalize(row, REGIONS) : row));
        normalized.sort((a, b) => {
          const na = a.tenancyName || a.name || a.userName || '';
          const nb = b.tenancyName || b.name || b.userName || '';
          return na.localeCompare(nb, undefined, { sensitivity: 'base' });
        });
        setTenantOptions(normalized);
      })
      .catch(() => { if (alive) setTenantOptions([]); });
    return () => { alive = false; };
  }, []);
  // 区域下拉：与实例管理一致 —— 选中租户后调 listRegions 重建区域选项
  const [regionOptions, setRegionOptions] = useStateG([]);
  const [regionLoading, setRegionLoading] = useStateG(false);
  useEffectG(() => {
    let alive = true;
    setRegionOptions([]);
    setTasks([]); // 切换租户时立即清空旧任务，杜绝旧数据残留！
    setLoading(true); // 同步开启 loading，杜绝拉取区域子级选项期间空态抢跑闪现！
    if (!tenantFilter) { setRegionLoading(false); setRegionFilter(''); setLoading(false); return () => { alive = false; }; }
    setRegionLoading(true);
    (async () => {
      try {
        const rows = await window.ociServices.tenant.listRegions({ parentId: tenantFilter });
        if (!alive) return;
        const options = (Array.isArray(rows) ? rows : [])
          .map(row => {
            const base = row.region || row.tenancyName || row.userName || row.id || '';
            // 多区域账户：主区域(add)追加 i18n 主区域标识
            const label = row.isHomeRegion ? `${base} · ${tr('tenants.col.mainRegion')}` : base;
            return { id: String(row.id ?? ''), label, region: row.region || '' };
          })
          .filter(row => row.id);
        setRegionOptions(options);
        const requested = String(regionFilter || '');
        if (requested && options.some(row => row.id === requested)) return;
        if (options.length === 1) { const only = options[0].id; setRegionFilter(only); writeRouteQuery({ regionId: only, page: 1 }); }
        else if (requested) { setRegionFilter(''); writeRouteQuery({ regionId: '', page: 1 }); }
      } catch (err) {
        if (!alive) return;
        setRegionOptions([]); setRegionFilter('');
      } finally {
        if (alive) setRegionLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenantFilter]);
  const [totalElements, setTotalElements] = useStateG(0);
  const [loading, setLoading] = useStateG(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useStateG(false);
  const [loadError, setLoadError] = useStateG('');

  const writeRouteQuery = React.useCallback((patch) => {
    const current = (() => { try { return window.ociRouter?.read?.() || {}; } catch { return {}; } })();
    const curQuery = current.query || {};
    const curParams = current.params || {};
    const pageId = (current.page === 'tenant-grab' || isSubPage) ? 'tenant-grab' : 'grab';
    const nextTenantId = patch.tenantId == null ? tenantFilter : patch.tenantId;
    window.ociRouter?.go(pageId, {
      ...curQuery,
      ...curParams,
      tenantDbId: curParams.tenantDbId || nextTenantId,
      page: patch.page == null ? page : patch.page,
      size: patch.size == null ? perPage : patch.size,
      tenantId: nextTenantId,
      regionId: patch.regionId == null ? regionFilter : patch.regionId,
    }, { replace: true });
  }, [page, perPage, tenantFilter, regionFilter, isSubPage]);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setTasks([]); // 刷新与重新加载时立即清空旧数据，杜绝旧数据与 loading 共存！
    setLoadError('');
    try {
      const pageData = await window.ociServices.boot.fullBootList({
        page: page - 1,
        size: perPage,
        tenantId: tenantFilter || undefined,
      });
      const content = Array.isArray(pageData?.content) ? pageData.content : [];
      setTasks(content.map((task, index) => normalizeBootTask(task, (page - 1) * perPage + index)));
      const total = Number(pageData?.totalElements) || 0;
      const totalPages = Math.max(1, Number(pageData?.totalPages) || Math.ceil(total / perPage));
      setTotalElements(total);
      if (page > totalPages) {
        setPage(totalPages);
        writeRouteQuery({ page: totalPages });
      }
    } catch (error) {
      setTasks([]);
      setLoadError(error.message || tr('grab.err.load'));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [page, perPage, tenantFilter, writeRouteQuery]);

  useEffectG(() => { loadTasks(); }, [loadTasks]);

  // 统计由真实 tasks 计算(替代 mock 随机轮询)
  const liveStats = React.useMemo(() => ({
    totalTasks: tasks.length,
    executing: tasks.filter(t => t.status === 'running').reduce((s, t) => s + (t.executing || 0), 0),
    totalAttempts: tasks.reduce((s, t) => s + getGrabAttempts(t), 0),
    yesterdayAttempts: tasks.reduce((s, t) => s + getGrabYesterday(t), 0),
    todayAttempts: tasks.reduce((s, t) => s + getGrabToday(t), 0),
    failed: tasks.reduce((s, t) => s + getGrabFailed(t), 0),
    success: tasks.reduce((s, t) => s + getGrabSucceeded(t), 0),
  }), [tasks]);

  const filtered = tasks.filter(t => {
    if (tenantFilter && t.tenantId !== tenantFilter) return false;
    if (regionFilter && t.region !== regionFilter) return false;
    return true;
  });
  const paged = filtered;

  const stats = [
    { label: tr('grab.stat.totalTasks'), value: liveStats.totalTasks, icon: 'list-checks', color: 'var(--cyan)' },
    { label: tr('grab.stat.executing'), value: liveStats.executing, icon: 'hourglass', color: 'var(--orange)', pulse: false },
    { label: tr('grab.stat.totalAttempts'), value: liveStats.totalAttempts.toLocaleString(), icon: 'refresh-cw', color: 'var(--info)' },
    { label: tr('grab.stat.yesterday'), value: liveStats.yesterdayAttempts.toLocaleString(), icon: 'clock', color: 'var(--fg-2)' },
    { label: tr('grab.stat.today'), value: liveStats.todayAttempts.toLocaleString(), icon: 'trending-up', color: 'var(--cyan)' },
    { label: tr('grab.stat.failed'), value: liveStats.failed.toLocaleString(), icon: 'x-circle', color: 'var(--danger)' },
    { label: tr('grab.stat.success'), value: liveStats.success, icon: 'check-circle-2', color: 'var(--accent)' },
  ];

  // Toolbar actions
  const stopAll = () => shell.openConfirm({
    title: tr('grab.confirm.stopAll.title'),
    body: <div>{tasks.filter(t => t.status === 'running').length}{tr('grab.confirm.stopAll.body')}</div>,
    confirmLabel: tr('grab.confirm.stopAll.confirm'),
    onConfirm: async () => {
      try {
        const result = await window.ociServices.boot.batchStop();
        if (!result?.success) throw new Error(result?.message || tr('grab.confirm.stopAll.fail'));
        shell.showToast(tr('grab.confirm.stopAll.ok'), { kind: 'warn' });
        await loadTasks();
      } catch (error) {
        shell.showToast(`${tr('grab.confirm.stopAll.fail')}: ${error.message || error}`, { kind: 'error' });
      }
    },
  });
  const resetAll = () => shell.openConfirm({
    title: tr('grab.confirm.resetAll.title'),
    body: <div>{tr('grab.confirm.resetAll.body.1')}<b>{tr('grab.confirm.resetAll.body.2')}</b>{tr('grab.confirm.resetAll.body.3')}</div>,
    danger: true,
    requireText: 'RESET',
    confirmLabel: tr('grab.confirm.resetAll.confirm'),
    onConfirm: async () => {
      try {
        const result = await window.ociServices.boot.batchInitFailCount();
        if (!result?.success) throw new Error(result?.message || tr('grab.confirm.resetAll.fail'));
        shell.showToast(tr('grab.confirm.resetAll.ok'), { kind: 'info' });
        await loadTasks();
      } catch (error) {
        shell.showToast(`${tr('grab.confirm.resetAll.fail')}: ${error.message || error}`, { kind: 'error' });
      }
    },
  });

  // Row action dispatch — 7 project-original + 2 high-frequency additions
  const rowAction = (id, task) => {
    switch (id) {
      case 'clone':    return cloneTask(task);          // 克隆开机
      case 'start':                                        // 开机启动
        (async () => {
          try {
            // 原项目 Web 端:POST /boot/startBoot?bootId=X
            const j = await window.ociServices.boot.startBoot({ bootId: task.id });
            if (j && j.success) shell.showToast(`${tr('grab.toast.startOk')}${task.tenantName || task.bootId} ${tr('grab.toast.started')}`, { kind: 'success' });
            else shell.showToast(`${tr('grab.toast.startFail')}: ${(j && j.message) || ''}`, { kind: 'error' });
            await loadTasks();
          } catch (e) { shell.showToast(`${tr('grab.toast.startFail')}: ${e.message || e}`, { kind: 'error' }); }
        })();
        return;
      case 'stop':                                          // 开机停止
        return shell.openConfirm({
          title: `${tr('grab.confirm.stopTask.title')}${getTenantName(task)}?`,
          body: <div>{tr('grab.confirm.stopTask.body')}</div>,
          confirmLabel: tr('grab.action.stop'),
          onConfirm: async () => {
            try {
              // 原项目 Web 端:POST /boot/stopBoot?bootId=X
              const j = await window.ociServices.boot.stopBoot({ bootId: task.id });
              if (j && j.success) shell.showToast(`${tr('grab.toast.stopOk')}${getTenantName(task)} ${tr('grab.toast.stopped')}`, { kind: 'warn' });
              else shell.showToast(`${tr('grab.toast.stopFail')}: ${(j && j.message) || ''}`, { kind: 'error' });
              await loadTasks();
            } catch (e) { shell.showToast(`${tr('grab.toast.stopFail')}: ${e.message || e}`, { kind: 'error' }); }
          },
        });
      case 'detail':   return showLogs(task);           // 开机详情
      case 'edit':     return editTask(task);           // 开机配置
      case 'delete':                                       // 开机删除
        return shell.openConfirm({
          title: `${tr('grab.confirm.deleteTask.title')}${getTenantName(task)}?`,
          body: <div>{tr('grab.confirm.deleteTask.body')}<b>{tr('grab.confirm.deleteTask.body2')}</b>{tr('grab.confirm.deleteTask.body3')}</div>,
          danger: true,
          requireText: getTenantName(task),
          confirmLabel: tr('grab.confirm.delete'),
          onConfirm: async () => {
            try {
              // 原项目 Web 端:POST /boot/deleteBoot?bootId=X
              const j = await window.ociServices.boot.deleteBoot({ bootId: task.id });
              if (j && j.success) { shell.showToast(`${tr('grab.toast.deleteOk')}${getTenantName(task)}`, { kind: 'warn' }); }
              else shell.showToast(`${tr('grab.toast.deleteFail')}: ${(j && j.message) || ''}`, { kind: 'error' });
              await loadTasks();
            } catch (e) { shell.showToast(`${tr('grab.toast.deleteFail')}: ${e.message || e}`, { kind: 'error' }); }
          },
        });
      case 'one-shot': return oneShot(task);            // 手动开机
      case 'instances':                                  // 已抢实例 (高频新增)
        // 保险:先关任何已打开的 drawer,让新 drawer 从头动画滑入
        shell.closeDrawer?.();
        setTimeout(() => showInsts(task), 0);
        return;
    }
  };

  // Row menu — matches oci-start's 7 items exactly (2-col grid, no section headers)
  // 克隆开机 | 开机启动
  // 开机停止 | 开机详情
  // 开机配置 | 开机删除
  // 手动开机
  // (Note: this is rendered as a 2-col GrabTaskMenu, not a DropdownMenu with sections)

  const columns = [
    { key: 'seq', label: tr('grab.col.seq'), width: 44, minWidth: 44, align: 'center',
      render: r => <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{r.seq}</span> },
    { key: 'tenantName', label: tr('grab.col.tenant'), width: 110, minWidth: 100, tooltip: r => r.tenantName || '',
      render: r => {
        // 与租户管理/实例列表页一致 · 展开时把 *** 替换为 user(z***n → zusern)
        const shownName = unmask ? r.tenantName : window.maskName(r.tenantName);
        return (
          <span
            title={r.tenantName || ''}
            className="mono"
            style={{
              padding: '2px 6px', background: 'var(--bg-3)',
              borderRadius: 4, fontSize: 11, color: 'var(--fg-1)',
              display: 'inline-block', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle',
              cursor: 'pointer',
            }}
          >{shownName}</span>
        );
      } },
    { key: 'custom', label: tr('grab.col.custom'), width: 130, minWidth: 110, tooltip: r => r.defName || getTenantAlias(r) || '',
      render: r => {
        const alias = (r.defName && r.defName !== '未设置') ? r.defName : (getTenantAlias(r) || '');
        return (
          <span
            title={alias || ''}
            className="mono"
            style={{
              color: 'var(--fg-1)', fontWeight: 500,
              display: 'inline-block', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', whiteSpace: 'nowrap',
            }}
          >{alias || '—'}</span>
        );
      } },
    { key: 'region', label: tr('grab.col.region'), width: 80, minWidth: 70,
      render: r => {
        const reg = REGIONS.find(x => x.code === r.region);
        const name = reg ? (reg.simpleName || reg.cn) : r.region;
        return <span style={{ color: 'var(--fg-0)' }}>{name}</span>;
      } },
    { key: 'status', label: tr('grab.col.taskStatus'), width: 84, minWidth: 74, align: 'center',
      render: r => {
        const isRunning = r.openBootFlag === true || r.status === 'running';
        return (
          <span style={{
            padding: '2px 8px',
            background: isRunning ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-3)',
            color: isRunning ? 'var(--accent)' : 'var(--fg-2)',
            borderRadius: 999, fontSize: 11, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {isRunning && <StatusDot status="running" size={5} pulse />}
            {isRunning ? tr('status.running') : '无任务'}
          </span>
        );
      } },
    { key: 'totalTasks', label: tr('grab.col.total'), width: 68, minWidth: 60, align: 'right',
      render: r => <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{r.totalTasks}</span> },
    { key: 'executing', label: tr('grab.col.executing'), width: 68, minWidth: 60, align: 'right',
      render: r => (
        <span className="num" style={{ color: r.executing > 0 ? 'var(--accent)' : 'var(--fg-3)', fontWeight: r.executing > 0 ? 600 : 400 }}>{r.executing}</span>
      ) },
    { key: 'totalAttempts', label: tr('grab.col.attempts'), width: 68, minWidth: 60, align: 'right',
      render: r => <span className="num" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{getGrabAttempts(r).toLocaleString()}</span> },
    { key: 'yesterdayAttempts', label: tr('grab.col.yesterday'), width: 68, minWidth: 60, align: 'right',
      render: r => <span className="num" style={{ color: 'var(--fg-2)' }}>{getGrabYesterday(r)}</span> },
    { key: 'todayAttempts', label: tr('grab.col.today'), width: 68, minWidth: 60, align: 'right',
      render: r => <span className="num" style={{ color: 'var(--cyan)', fontWeight: 500 }}>{getGrabToday(r)}</span> },
    { key: 'failed', label: tr('grab.col.failed'), width: 68, minWidth: 60, align: 'right',
      render: r => <span className="num" style={{ color: 'var(--danger)' }}>{getGrabFailed(r).toLocaleString()}</span> },
    { key: 'succeeded', label: tr('grab.col.success'), width: 68, minWidth: 60, align: 'right',
      render: r => getGrabSucceeded(r) > 0
        ? (
          <button
            type="button"
            className="num"
            onClick={(e) => {
              e.stopPropagation();
              shell.closeDrawer?.();
              setTimeout(() => showInsts(r), 0);
            }}
            title={`${tr('grab.instances.title')}${getGrabSucceeded(r)}${tr('grab.instances.count')}`}
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
        )
        : <span className="num" style={{ color: 'var(--fg-3)' }}>0</span>
    },
    { key: 'arch', label: tr('grab.col.arch'), width: 76, minWidth: 70, align: 'center',
      render: r => <span style={{ padding: '1px 6px', background: getInstanceArch(r) === 'ARM' ? 'var(--info-soft)' : 'var(--violet-soft)', color: getInstanceArch(r) === 'ARM' ? 'var(--info)' : 'var(--violet)', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{getInstanceArch(r)}</span> },
    { key: 'createdAt', label: tr('common.createdAt'), width: 140, minWidth: 130,
      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{r.createdAt}</span> },
    { key: 'actions', label: tr('common.operation'), width: 48, minWidth: 48, align: 'center', ellipsis: false,
      render: r => {
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
            title={tr('grab.col.actions')}
          >
            <Icon name="more-horizontal" size={14} />
          </button>
        );
      },
    },
  ];

  const fromTenant = tenantOptions.find(t => String(t.id) === String(tenantFilter));
  const tenantDisplayName = fromTenant ? (getTenantName(fromTenant) || fromTenant.name || fromTenant.userName || '') : '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <PageHeader
        title={isSubPage && tenantDisplayName
          ? `${tenantDisplayName} · 抢机任务`
          : tr('grab.title')}
        subtitle={isSubPage ? `共 ${tasks.length} 组任务` : null}
        icon="zap"
        iconColor="var(--orange)"
        actions={
          <>
            {!isSubPage ? (
              <Select
                value={tenantFilter}
                onChange={v => { setTenantFilter(v); setRegionOptions([]); setRegionFilter(''); setTasks([]); setLoading(true); setPage(1); writeRouteQuery({ tenantId: v, regionId: '', page: 1 }); }}
                placeholder={tr('common.selectTenant')}
                width={220}
                searchable={tenantOptions.length > 5}
                options={Array.from(new Map(tenantOptions.map(t => [t.id, { value: t.id, label: getTenantLabel(t, lang) }])).values())}
              />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="globe" size={12} />
                <span>当前区域:</span>
              </span>
            )}
            <Select
              value={regionFilter}
              onChange={v => { setRegionFilter(v); setTasks([]); setLoading(true); setPage(1); writeRouteQuery({ regionId: v, page: 1 }); }}
              placeholder={tr('common.selectRegion')}
              width={160}
              disabled={!tenantFilter || regionLoading || regionOptions.length === 0}
              searchable={regionOptions.length > 1}
              options={regionOptions.map(r => ({ value: r.id, label: r.label }))}
            />
            {!isSubPage && (
              <Button variant="primary" size="md" icon="search" onClick={() => shell.showToast(`${tr('grab.filter.result')}${filtered.length}${tr('grab.filter.count')}`, { kind: 'info' })}>{tr('common.search')}</Button>
            )}
            <IconButton
              icon={unmask ? 'eye-off' : 'eye'}
              tooltip={unmask ? tr('grab.tooltip.eyeOn') : tr('grab.tooltip.eyeOff')}
              size={30}
              onClick={() => setUnmask(u => !u)}
              style={{
                border: '1px solid ' + (unmask ? 'var(--accent)' : 'var(--border)'),
                background: unmask ? 'var(--accent-soft)' : 'var(--bg-2)',
                color: unmask ? 'var(--accent)' : undefined,
              }}
            />
            <Button variant="primary" size="md" icon="play-circle" onClick={() => addBoot(null)} style={{ color: '#ffffff' }}>{tr('grab.action.create')}</Button>
            <Button variant="orange" size="md" icon="pause-circle" onClick={stopAll} style={{ color: '#ffffff' }}>批量停止</Button>
            <Button variant="danger" size="md" icon="rotate-ccw" onClick={resetAll} style={{ color: '#ffffff' }}>{tr('grab.action.reset')}</Button>
          </>
        }
      />

      {/* ── 面包屑 + 返回 (租户下钻模式，在页头卡片下方，100% 对齐客户端) ── */}
      {isSubPage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 12, marginBottom: 12,
          fontSize: 12, color: 'var(--fg-2)',
        }}>
          <button
            type="button"
            onClick={() => window.ociRouter.go('tenant-detail', { tenantDbId: tenantFilter })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px',
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--fg-2)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 100ms, border-color 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-1)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title={tr('common.back')}
          >
            <Icon name="chevron-left" size={12} />
            <span>{tr('common.back')}</span>
          </button>
          <span style={{ color: 'var(--fg-3)', opacity: 0.5 }}>›</span>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              onClick={() => window.ociRouter.go('tenants')}
              style={{ cursor: 'pointer', color: 'var(--fg-2)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
            >
              OCI 租户管理
            </a>
            <span style={{ color: 'var(--fg-3)', opacity: 0.5 }}>›</span>
            <a
              onClick={() => window.ociRouter.go('tenant-detail', { tenantDbId: tenantFilter })}
              style={{ cursor: 'pointer', color: 'var(--fg-2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
            >
              <span>租户详情</span>
              {tenantDisplayName && (
                <>
                  <span>·</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{tenantDisplayName}</span>
                </>
              )}
            </a>
            <span style={{ color: 'var(--fg-3)', opacity: 0.5 }}>›</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>查看开机</span>
          </nav>
        </div>
      )}

      {loadError && (
        <div style={{ marginBottom: 12, padding: '10px 14px', border: '1px solid var(--danger)', borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert-circle" size={15} />
          <span style={{ flex: 1 }}>{loadError}</span>
          <Button size="xs" variant="outline" onClick={loadTasks}>{tr('grab.retry')}</Button>
          <button
            type="button"
            onClick={() => setLoadError('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
            title={tr('common.close')}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: s.color, display: 'inline-flex' }}>
                <Icon name={s.icon} size={13} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 500, letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{s.label}</span>
              {s.pulse && s.value > 0 && <StatusDot status="running" size={5} pulse />}
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: -0.5, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
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
          <Table
            columns={columns}
            rows={paged}
            loading={!hasLoadedOnce || loading}
            empty={
              <EmptyState
                icon="play-circle"
                title={!tenantFilter ? '暂无开机任务' : (!regionFilter ? '请选择区域' : '暂无开机任务')}
                subtitle={!tenantFilter
                  ? '可在租户管理中创建抢机配置，或调整筛选后查询'
                  : (!regionFilter ? '当前租户包含多个可用区域，请在上方选择具体区域后查看开机任务' : '当前筛选条件下没有抢机配置')}
                actionLabel="刷新"
                onAction={loadTasks}
              />
            }
            density={density}
            onRowClick={showLogs}
          />
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination
            total={regionFilter ? filtered.length : totalElements}
            page={page}
            perPage={perPage}
            onPageChange={n => { setPage(n); writeRouteQuery({ page: n }); }}
            onPerPageChange={n => { setPerPage(n); setPage(1); writeRouteQuery({ size: n, page: 1 }); }}
            t={tr}
          />
        </div>
      </div>

      {menuFor && (
        <GrabTaskMenu
          task={menuFor.task}
          anchorEl={menuFor.anchorEl}
          onClose={() => setMenuFor(null)}
          onAction={rowAction}
        />
      )}
    </div>
  );
}

// 2-col menu matching the reference screenshot — 7 items, no section headers
// 开机任务行操作菜单 · 使用统一的 <RowActionMenu>(见 shell.jsx)
function GrabTaskMenu({ task, anchorEl, onClose, onAction }) {
  // 开机任务 8 项操作(2 列)- 原项目 7 项 + 已抢实例快捷入口。
  // 原项目没有单任务重置接口，因此不展示会伪造成功的“重置统计”。
  const items = [
    { id: 'clone',      label: tr('grab.menu.clone'), icon: 'copy'      },
    { id: 'start',      label: tr('grab.menu.start'), icon: 'play',       color: 'var(--accent)' },
    { id: 'stop',       label: tr('grab.menu.stop'), icon: 'square'    },
    { id: 'detail',     label: tr('grab.menu.detail'), icon: 'info'      },
    { id: 'edit',       label: tr('grab.menu.edit'), icon: 'settings'  },
    { id: 'delete',     label: tr('grab.menu.delete'), icon: 'trash-2',    color: 'var(--danger)' },
    { id: 'instances',  label: `${tr('grab.menu.instancesCount')} (${getGrabSucceeded(task) || 0})`, icon: 'server', color: 'var(--cyan)' },
    { id: 'one-shot',   label: tr('grab.menu.oneShot'), icon: 'zap',        color: 'var(--orange)' },
  ];
  const header = (
    <>
      <StatusDot status={task.status} size={5} pulse={task.status === 'running'} />
      <span style={{ color: 'var(--fg-0)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
        {getTenantName(task)}
      </span>
    </>
  );
  return (
    <RowActionMenu
      anchorEl={anchorEl}
      header={header}
      items={items}
      onClose={onClose}
      onAction={(id) => onAction(id, task)}
    />
  );
}

Object.assign(window, { GrabPage, GrabTaskMenu });
