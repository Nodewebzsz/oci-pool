// Grab task actions — for the "..." menu on the Grab (预开) page

function useGrabTaskEditModal() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback((task) => {
    const state = { ...task, cpu: task.cpu ?? task.ocpu, mem: task.mem ?? task.memory, saving: false };
    const render = () => {
      shell.openModal({
        title: tr('ga.edit.title').replace('{name}', getTenantName(task)),
        subtitle: tr('ga.edit.subtitle'),
        icon: 'edit',
        iconColor: 'var(--cyan)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <FormRow label="OCPU"><NumberInput value={state.cpu} onChange={v => { state.cpu = v; render(); }} min={1} max={78} /></FormRow>
              <FormRow label={tr("ga.memGB")}><NumberInput value={state.mem} onChange={v => { state.mem = v; render(); }} min={1} max={480} /></FormRow>
              <FormRow label={tr("ga.diskGB")}><NumberInput value={state.disk} onChange={v => { state.disk = v; render(); }} min={47} max={32768} /></FormRow>
              <FormRow label={tr("ga.targetCount")}><NumberInput value={state.totalTasks} onChange={v => { state.totalTasks = v; render(); }} min={1} max={10} /></FormRow>
            </div>
            <FormRow label={tr("ga.remark")}>
              <TextInput mono value={state.custom} onChange={v => { state.custom = v; render(); }} />
            </FormRow>
            <div style={{ padding: 10, background: 'var(--orange-soft)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-1)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="alert-triangle" size={13} style={{ color: 'var(--orange)', marginTop: 2 }} />
              <div>{task.status === 'running' ? tr('ga.edit.runningHint') : tr('ga.edit.stoppedHint')}</div>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
            <Button variant="primary" size="md" icon="check" loading={state.saving} disabled={state.saving} onClick={async () => {
              state.saving = true;
              render();
              try {
                const result = await window.ociServices.boot.updateBoot({
                  id: task.id, ocpu: state.cpu, memory: state.mem, disk: state.disk,
                  loopTime: state.loopTime, rootPassword: state.rootPassword, dayGap: state.dayGap,
                });
                if (!result?.success) throw new Error(result?.message || tr('ga.save.fail'));
                shell.closeModal();
                shell.showToast(tr('ga.edit.ok').replace('{name}', state.custom), { kind: 'success' });
              } catch (error) {
                state.saving = false;
                render();
                shell.showToast(tr('ga.save.failMsg').replace('{err}', error.message || error), { kind: 'error' });
              }
            }}>{tr('common.save')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

function useCloneTaskModal() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(async (task) => {
    const state = {
      saving: false,
    };
    const render = () => {
      shell.openModal({
        title: tr('ga.clone.title').replace('{name}', getTenantName(task)),
        subtitle: tr('ga.clone.subtitle'),
        icon: 'copy',
        iconColor: 'var(--info)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <div style={{ padding: 10, background: 'var(--info-soft)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-1)' }}>
              <Icon name="info" size={12} style={{ color: 'var(--info)', verticalAlign: 'text-top', marginRight: 4 }} />
              {tr('ga.clone.hint')}
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
            <Button variant="primary" size="md" icon="copy" disabled={state.saving} loading={state.saving} onClick={async () => {
              state.saving = true;
              render();
              try {
                const result = await window.ociServices.boot.startCloneBoot({ bootId: task.id });
                if (!result?.success) throw new Error(result?.message || tr('ga.clone.fail'));
                shell.closeModal();
                shell.showToast(tr('ga.clone.ok'), { kind: 'success' });
              } catch (error) {
                state.saving = false;
                render();
                shell.showToast(tr('ga.clone.failMsg').replace('{err}', error.message || error), { kind: 'error' });
              }
            }}>{tr('ga.clone.action')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

function useGrabTaskLogsDrawer() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((task) => {
    // Same as before — full drawer with live logs
    shell.openDrawer({
      title: getTenantName(task),
      subtitle: <span><span className="mono">{task.tenantName}</span> · <RegionBadge code={task.region} lang={lang} style={{ display: 'inline-flex' }} /></span>,
      icon: 'zap',
      iconColor: 'var(--orange)',
      statusDot: task.status,
      width: 760,
      body: <GrabTaskDrawerBody task={task} />,
    });
  }, [shell, lang]);
}

// Body used inside the drawer — has its own live-log state.
// Successes are visually elevated: hero card + banner in log stream + flashing stat.
function GrabTaskDrawerBody({ task }) {
  const shell = useShell();
  const { t: tr } = useT();
  const openInstancesDrawer = useTaskInstancesDrawer();
  const [logs, setLogs] = React.useState([]);
  const [loadingLogs, setLoadingLogs] = React.useState(true);
  const [logError, setLogError] = React.useState('');

  // 开机日志必须来自后端日志文件；没有 bootId 级日志接口时不按租户/区域猜测，避免展示错任务。
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingLogs(true);
      setLogError('');
      try {
        const result = await window.ociServices.system.openLogs({ lines: 300 });
        const lines = Array.isArray(result?.lines) ? result.lines : [];
        const parsed = lines.map(line => typeof parseLogLine === 'function'
          ? parseLogLine(line)
          : { time: '', level: 'INFO', msg: String(line || '') });
        if (alive) setLogs(parsed);
      } catch (error) {
        if (alive) setLogError(error.message || tr('ga.log.load.fail'));
      } finally {
        if (alive) setLoadingLogs(false);
      }
    })();
    return () => { alive = false; };
  }, [task.id]);

  const successCount = getGrabSucceeded(task);
  const latestSuccess = logs.find(l => l.level === 'SUCCESS');
  const successHistory = logs.filter(l => l.level === 'SUCCESS');

  return (
    <div>
      {latestSuccess && (
        <div style={{
          padding: 14,
          background: 'linear-gradient(135deg, var(--accent-soft), color-mix(in oklab, var(--accent-soft) 60%, transparent))',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative pulse ring */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 6px color-mix(in oklab, var(--accent) 25%, transparent)',
            animation: 'pulse-dot 2s infinite',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="check" size={15} strokeWidth={2.5} /></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: 0.3 }}>{tr('ga.latestSuccess')}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{latestSuccess.time}</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            fontSize: 11.5,
          }}>
            <SuccessKV label={tr("ga.logTime")} value={<span className="mono">{latestSuccess.time || '—'}</span>} />
            <SuccessKV label={tr("ga.level")} value={<span className="mono">SUCCESS</span>} />
            <SuccessKV label={tr("ga.successCount")} value={<span className="mono">{successCount}</span>} />
            <SuccessKV label={tr("ga.logSuccessCount")} value={<span className="mono">{successHistory.length}</span>} />
          </div>
          <div style={{
            marginTop: 10, padding: '6px 8px',
            background: 'oklch(0.10 0.008 240 / 0.5)', borderRadius: 5,
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--fg-2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'var(--fg-3)', flexShrink: 0 }}>OCID</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-1)' }}>{tr('ga.logFullBelow')}</span>
          </div>
          {successHistory.length > 1 && (
            <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {tr('ga.logTotalSuccess').replace('{n}', successHistory.length)}
              <button
                onClick={() => {
                  // 保险:先关掉当前(日志)drawer,让"已抢实例"drawer 从右侧重新滑入
                  shell.closeDrawer?.();
                  setTimeout(() => openInstancesDrawer(task), 0);
                }}
                style={{
                  padding: '2px 8px',
                  background: 'transparent',
                  border: '1px solid var(--accent)',
                  borderRadius: 4,
                  color: 'var(--accent)',
                  fontFamily: 'inherit',
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 4,
                  transition: 'all 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon name="server" size={11} />
                {tr('ga.viewInstances')}
                <Icon name="arrow-right" size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      <SectionLabel>{tr('ga.realtimeStats')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        <MiniStatBox label={tr("ga.totalGrabs")} value={getGrabAttempts(task).toLocaleString()} color="var(--info)" />
        <MiniStatBox label={tr("ga.today")} value={getGrabToday(task)} color="var(--cyan)" />
        <MiniStatBox label={tr("ga.failed")} value={getGrabFailed(task).toLocaleString()} color="var(--danger)" />
        <MiniStatBox
          label={tr("ga.success")}
          value={successCount}
          color="var(--accent)"
        />
      </div>

      {/* {tr('ga.bootRecords')}表格 — matches oci-start's 开机详情 modal */}
      <SectionLabel>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tr('ga.bootRecords')}
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-2)', fontWeight: 500 }}>
            {tr('ga.countItems').replace('{n}', task.totalTasks ?? 0)}
          </span>
        </span>
      </SectionLabel>
      <BootRecordsTable task={task} />

      <SectionLabel style={{ marginTop: 20 }}>{tr('ga.taskConfig')}</SectionLabel>
      <KVList columns={2} items={[
        { label: 'Shape', value: <span className="mono">{task.shape}</span> },
        { label: tr('ga.arch'), value: <span className="mono">{getInstanceArch(task)}</span> },
        { label: 'OCPU', value: <span className="mono">{getInstanceCpu(task)}</span> },
        { label: tr('ga.memory'), value: <span className="mono">{getInstanceMem(task)} GB</span> },
        { label: tr('ga.disk'), value: <span className="mono">{task.disk} GB</span> },
        { label: tr('ga.retryInterval'), value: <span className="mono">{task.loopTime ?? '—'} {tr('ga.seconds')}</span> },
        { label: tr('ga.timeRange'), value: <span className="mono">{task.dayGap || tr('ga.allDay')}</span> },
        { label: tr('ga.notifyStatus'), value: <span className="mono">{task.notifyFlag || '—'}</span> },
      ]} />

      {(() => {
        // 状态映射:running=LIVE 绿 · paused=已暂停 橙 · failed=已停止 红 · idle/其他=历史 灰
        const st = task.status;
        const badge =
          st === 'running' ? { label: 'LIVE',   color: 'var(--accent)',  dot: 'running',  pulse: true  } :
          st === 'paused'  ? { label: tr('ga.paused'), color: 'var(--orange)',  dot: 'paused',   pulse: false } :
          st === 'failed'  ? { label: tr('ga.stopped'), color: 'var(--danger)',  dot: 'failed',   pulse: false } :
                             { label: tr('ga.history'),   color: 'var(--fg-3)',    dot: 'stopped',  pulse: false };
        return (
          <SectionLabel style={{ marginTop: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {st === 'running' ? tr('ga.liveLogs') : tr('ga.bootLogs')}
              <StatusDot status={badge.dot} size={6} pulse={badge.pulse} />
              <span style={{ fontSize: 10, color: badge.color, fontWeight: 500 }}>{badge.label}</span>
            </span>
          </SectionLabel>
        );
      })()}
      {task.status !== 'running' && (
        <div style={{
          padding: '8px 10px', marginBottom: 8,
          background: 'var(--bg-2)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 6,
          fontSize: 11, color: 'var(--fg-2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="info" size={13} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
          <span>
            {tr('ga.taskNow')}
            <span style={{ color: 'var(--fg-0)', margin: '0 3px', fontWeight: 500 }}>
              {task.status === 'paused' ? tr('ga.paused') : task.status === 'failed' ? tr('ga.failedStatus') : tr('ga.idle')}
            </span>
            {tr('ga.taskNoNewLogs')}
          </span>
        </div>
      )}
      <div style={{
        background: 'oklch(0.10 0.008 240)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 12,
        maxHeight: 320, overflowY: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.6,
      }}>
        {loadingLogs && <div style={{ color: 'var(--fg-3)', textAlign: 'center', padding: 28 }}>{tr('ga.loadingLogs')}</div>}
        {!loadingLogs && logError && <div role="alert" style={{ color: 'var(--danger)', textAlign: 'center', padding: 28 }}>{logError}</div>}
        {!loadingLogs && !logError && logs.length === 0 && <div style={{ color: 'var(--fg-3)', textAlign: 'center', padding: 28 }}>{tr('ga.noLogs')}</div>}
        {!loadingLogs && !logError && logs.map((l, i) => {
          const isSuccess = l.level === 'SUCCESS';
          return (
            <div key={i} style={{
              display: 'flex', gap: 8,
              padding: isSuccess ? '5px 8px' : '2px 0',
              margin: isSuccess ? '3px -4px' : 0,
              background: isSuccess ? 'oklch(0.30 0.10 155 / 0.35)' : 'transparent',
              borderLeft: isSuccess ? '3px solid var(--accent)' : '3px solid transparent',
              borderRadius: isSuccess ? 4 : 0,
              animation: 'none',
            }}>
              <span style={{ color: 'oklch(0.55 0.05 240)', flexShrink: 0 }}>{l.time}</span>
              <span style={{
                color: logColor(l.level).fg,
                fontWeight: 700,
                minWidth: 62, flexShrink: 0,
              }}>[{l.level}]</span>
              <span style={{
                color: isSuccess ? 'oklch(0.85 0.12 155)' : 'oklch(0.86 0.008 240)',
                fontWeight: isSuccess ? 600 : 400,
                wordBreak: 'break-all',
              }}>{l.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuccessKV({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

// Boot records table — 每 worker 一行 · 只展示数据 · 顶部工具条含"记录删除"批量操作
function BootRecordsTable({ task }) {
  const shell = useShell();
  const { t: tr } = useT();
  const [selected, setSelected] = React.useState([]);  // ids of selected rows
  const [revealedPw, setRevealedPw] = React.useState({}); // { id: bool } — which passwords are shown as plaintext
  const [menuFor, setMenuFor] = React.useState(null);  // { row, anchorEl } · 菜单契约 · MIGRATION §10.1
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  const normalizeRecord = React.useCallback((record, index) => ({
    ...record,
    id: String(record.id),
    workerNo: index + 1,
    yesterday: Number(record.yesterdayAttemptCount ?? 0),
    today: Number(record.currentAttemptCount ?? 0),
    failed: Number(record.failCount ?? 0),
    os: [record.operatingSystem, record.operatingSystemVersion].filter(Boolean).join('/') || '—',
    shape: [record.ocpu, record.memory, record.disk, record.architecture].map(v => v ?? '—').join('/'),
    range: record.dayGap || '-',
    interval: record.loopTime ?? 0,
    rootPassword: record.rootPassword || '',
    ipv4: record.publicIp || '',
    status: Number(record.status) === 2 ? 'succeeded' : Number(record.status) === 1 ? 'running' : 'idle',
    startedAt: record.createdAt || '',
  }), []);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await window.ociServices.boot.bootDetail({ bootId: task.id });
      if (!result?.success) throw new Error(result?.message || tr('ga.detail.fail'));
      const content = Array.isArray(result.data) ? result.data : [];
      setRows(content.map(normalizeRecord));
    } catch (error) {
      setRows([]);
      setLoadError(error.message || tr('ga.detail.fail'));
    } finally {
      setLoading(false);
    }
  }, [task.id, normalizeRecord]);

  React.useEffect(() => { loadRows(); }, [loadRows]);

  // Click password → toggle reveal + copy to clipboard + toast
  const revealAndCopy = (record, e) => {
    e.stopPropagation();
    setRevealedPw(prev => ({ ...prev, [record.id]: !prev[record.id] }));
    if (navigator.clipboard) navigator.clipboard.writeText(record.rootPassword);
    shell.showToast(tr('ga.pwCopied').replace('{pw}', record.rootPassword), { kind: 'success', duration: 4000 });
    // Auto-hide after 8 seconds for security
    setTimeout(() => {
      setRevealedPw(prev => {
        if (!prev[record.id]) return prev;
        return { ...prev, [record.id]: false };
      });
    }, 8000);
  };

  const toggleRow = (id) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };
  const toggleAll = () => {
    setSelected(sel => sel.length === rows.length ? [] : rows.map(r => r.id));
  };

  const deleteSelected = () => {
    shell.openConfirm({
      title: tr('ga.deleteRecords.title').replace('{n}', selected.length),
      body: (
        <div>
          {tr('ga.deleteRecords.body')}
          <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>{tr('ga.deleteRecords.tip')}</div>
        </div>
      ),
      danger: true,
      confirmLabel: tr('ga.delete'),
      onConfirm: () => {
        (async () => {
          try {
            for (const id of selected) {
              const result = await window.ociServices.boot.deleteBootDetail({ bootId: id });
              if (!result?.success) throw new Error(result?.message || tr('ga.delete.fail'));
            }
            shell.showToast(tr('ga.deleteRecords.ok').replace('{n}', selected.length), { kind: 'warn' });
            setSelected([]);
            await loadRows();
          } catch (error) {
            shell.showToast(tr('ga.delete.failMsg').replace('{err}', error.message || error), { kind: 'error' });
          }
        })();
      },
    });
  };

  // ═════ 行操作:开机启动 / 停止 / 配置修改 / 记录删除 ═════
  // 对齐原项目开机详情 modal 的行操作菜单
  const startBoot = async (row) => {
    try {
      const result = await window.ociServices.boot.toggleStatus({ id: row.id, status: 1 });
      if (!result?.success) throw new Error(result?.message || tr('ga.start.fail'));
      shell.showToast(tr('ga.worker.started').replace('{n}', row.workerNo), { kind: 'success' });
      await loadRows();
    } catch (error) { shell.showToast(tr('ga.start.failMsg').replace('{err}', error.message || error), { kind: 'error' }); }
  };
  const stopBoot = async (row) => {
    try {
      const result = await window.ociServices.boot.toggleStatus({ id: row.id, status: 0 });
      if (!result?.success) throw new Error(result?.message || tr('ga.stop.fail'));
      shell.showToast(tr('ga.worker.stopped').replace('{n}', row.workerNo), { kind: 'warn' });
      await loadRows();
    } catch (error) { shell.showToast(tr('ga.stop.failMsg').replace('{err}', error.message || error), { kind: 'error' }); }
  };
  const deleteRow = (row) => {
    shell.openConfirm({
      title: tr('ga.deleteWorker.title').replace('{n}', row.workerNo),
      body: (
        <div>
          {tr('ga.deleteRecords.body')}
          {row.status === 'succeeded' && getInstanceIp(row) && (
            <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>
              {tr('ga.deleteWorker.ip')} <span className="mono" style={{ color: 'var(--cyan)' }}>{getInstanceIp(row)}</span> · {tr('ga.deleteWorker.ipTip')}
            </div>
          )}
        </div>
      ),
      danger: true, confirmLabel: tr('ga.delete'),
      onConfirm: async () => {
        try {
          const result = await window.ociServices.boot.deleteBootDetail({ bootId: row.id });
          if (!result?.success) throw new Error(result?.message || tr('ga.delete.fail'));
          shell.showToast(tr('ga.worker.deleted').replace('{n}', row.workerNo), { kind: 'warn' });
          await loadRows();
        } catch (error) { shell.showToast(tr('ga.delete.failMsg').replace('{err}', error.message || error), { kind: 'error' }); }
      },
    });
  };
  // "修改" 子 modal · 严格对齐原项目 openEditDetailModal(id, ocpu, memory, disk, loopTime, rootPassword, dayGap)
  //   6 字段:OCPU · 内存(GB) · 磁盘(GB) · 循环时间(秒) · 范围(dayGap) · Root 密码
  const openEditConfig = (row) => {
    const s2 = {
      ocpu: getInstanceCpu(task),
      memory: getInstanceMem(task),
      disk: task.disk,
      loopTime: row.interval,
      dayGap: row.range === '-' ? '' : row.range,
      rootPassword: row.rootPassword,
      showPass: false,
    };
    const paint = () => shell.openModal({
      title: tr('ga.editBoot.title'),
      subtitle: <span>{tr('ga.editBoot.subtitle').replace('{n}', row.workerNo)}</span>,
      icon: 'edit',
      iconColor: 'var(--info)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          {/* OCPU / 内存 / 磁盘 · 3 列并排 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 }}>
            <FormRow label="OCPU" required>
              <NumberInput value={s2.ocpu} onChange={v => { s2.ocpu = Math.max(1, v); paint(); }} min={1} step={1} />
            </FormRow>
            <FormRow label={tr("ga.memGB")} required>
              <NumberInput value={s2.memory} onChange={v => { s2.memory = Math.max(1, v); paint(); }} min={1} step={1} />
            </FormRow>
            <FormRow label={tr("ga.diskGB")} required>
              <NumberInput value={s2.disk} onChange={v => { s2.disk = Math.max(1, v); paint(); }} min={1} step={1} />
            </FormRow>
          </div>

          {/* 循环时间 + 快选 chips */}
          <FormRow label={tr("ga.loopSeconds")} required hint={tr("ga.loopSecondsHint")}>
            <NumberInput value={s2.loopTime} onChange={v => { s2.loopTime = Math.max(1, v); paint(); }} min={1} step={1} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[10, 30, 60, 200, 500].map(p => (
                <button key={p} type="button"
                  onClick={() => { s2.loopTime = p; paint(); }}
                  style={{
                    padding: '3px 10px',
                    background: s2.loopTime === p ? 'var(--accent-soft)' : 'var(--bg-2)',
                    border: '1px solid ' + (s2.loopTime === p ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 3,
                    color: s2.loopTime === p ? 'var(--accent)' : 'var(--fg-2)',
                    fontSize: 11, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}>{p}s</button>
              ))}
            </div>
          </FormRow>

          {/* 范围 (dayGap) · 严格按原项目校验 H-H · 0-23 : 1-24 · start<end */}
          <FormRow label={tr("ga.range")} hint={tr("ga.rangeHint")}>
            <TextInput value={s2.dayGap} onChange={v => { s2.dayGap = v; paint(); }}
              placeholder={tr("ga.rangePh")} />
          </FormRow>

          {/* Root 密码 · 可切换显示/隐藏 */}
          <FormRow label={tr("ga.rootPassword")} required>
            <div style={{ position: 'relative' }}>
              <input type={s2.showPass ? 'text' : 'password'}
                value={s2.rootPassword}
                onChange={e => { s2.rootPassword = e.target.value; paint(); }}
                placeholder={tr("ga.pwKeep")}
                style={{
                  width: '100%',
                  padding: '7px 40px 7px 10px',
                  background: 'var(--bg-2)',
                  color: 'var(--fg-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  outline: 'none',
                }}
              />
              <button type="button"
                onClick={() => { s2.showPass = !s2.showPass; paint(); }}
                title={s2.showPass ? tr('common.hide') : tr('common.show')}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 26, height: 26, padding: 0,
                  background: 'transparent', color: 'var(--fg-2)',
                  border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3,
                }}>
                <Icon name={s2.showPass ? 'eye-off' : 'eye'} size={13} />
              </button>
            </div>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={() => {
              // dayGap 严格校验 · 对齐原项目 handleEditDetail
              const dg = s2.dayGap.trim();
              if (dg) {
                const m = dg.match(/^(\d{1,2})-(\d{1,2})$/);
                if (!m) { shell.showToast(tr('ga.range.format'), { kind: 'warn' }); return; }
                const start = parseInt(m[1]); const end = parseInt(m[2]);
                if (start < 0 || start > 23 || end < 1 || end > 24) {
                  shell.showToast(tr('ga.range.outOf'), { kind: 'warn' }); return;
                }
                if (start >= end) {
                  shell.showToast(tr('ga.range.crossDay'), { kind: 'warn' }); return;
                }
              }
              if (!s2.rootPassword.trim()) {
                shell.showToast(tr('ga.pwRequired'), { kind: 'warn' }); return;
              }
              (async () => {
                try {
                  const result = await window.ociServices.boot.updateBoot({
                    id: row.id,
                    ocpu: s2.ocpu,
                    memory: s2.memory,
                    disk: s2.disk,
                    loopTime: s2.loopTime,
                    rootPassword: s2.rootPassword,
                    dayGap: dg,
                  });
                  if (!result?.success) throw new Error(result?.message || tr('ga.save.fail'));
                  shell.showToast(tr('ga.worker.configUpdated').replace('{n}', row.workerNo), { kind: 'success' });
                  shell.closeModal();
                  await loadRows();
                } catch (error) { shell.showToast(tr('ga.save.failMsg').replace('{err}', error.message || error), { kind: 'error' }); }
              })();
            }}
          >{tr('grab.be5fbb')}</Button>
        </>
      ),
    });
    paint();
  };
  // 开机日志 · 关闭当前 modal 并跳转到该任务的日志页(项目已有 useGrabTaskLogsDrawer,可通过全局导航)
  const showBootLog = (row) => {
    shell.showToast(tr('ga.worker.logOpened').replace('{n}', row.workerNo), { kind: 'info' });
    // 项目当前把日志和开机详情合并在一个 modal,直接滚动到底部
    setTimeout(() => {
      const modal = document.querySelector('[data-om-validate]') || document.querySelector('[style*="overflow-y"]');
      if (modal) modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const allSelected = selected.length === rows.length && rows.length > 0;

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 6, marginBottom: 20, overflow: 'hidden',
    }}>
      {/* Toolbar row — 记录删除 batch action */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--bg-3)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>
          {selected.length > 0
            ? <>{tr('ga.selectedCount').replace('{n}', selected.length)} / {tr('ga.countItems').replace('{n}', rows.length)}</>
            : <>{tr('ga.workerCount').replace('{n}', rows.length)}</>}
        </span>
        <Button
          size="xs"
          variant={selected.length > 0 ? 'danger' : 'ghost'}
          icon="trash-2"
          disabled={selected.length === 0}
          onClick={deleteSelected}
        >{tr('ga.recordDelete')}</Button>
      </div>

      {loading && <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('ga.loadingRecords')}</div>}
      {!loading && loadError && <div role="alert" style={{ padding: 28, textAlign: 'center', color: 'var(--danger)' }}>{loadError}</div>}
      {!loading && !loadError && rows.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-3)' }}>{tr('ga.noRecords')}</div>}
      {!loading && !loadError && rows.length > 0 && <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 30, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer', margin: 0 }}
                />
              </th>
              {[tr('grab.23c9bc'), tr('grab.296304'), tr('grab.acd5cb'), tr('grab.8a8b89'), tr('grab.224e2c'), tr('grab.df0116'), tr('grab.2cd98a'), tr('grab.a1d4e6'), tr('grab.f667d7'), tr('grab.3fea7c'), tr('grab.592c59')].map(h => { const hk = tr('ga.recordCols.' + ({ '昨日':'yesterday','今日':'today','失败':'failed','系统':'os','配置':'shape','范围':'range','循环时间(秒)':'loop','公网 IP':'ip','Root 密码':'rootPw','状态':'status','开始时间':'started'}[h] || h)); return (
                <th key={h} style={headStyle}>{hk}</th>
              ); })}
              <th style={{ ...headStyle, width: 50, textAlign: 'center' }}>{tr('ga.operation')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isChecked = selected.includes(r.id);
              return (
                <tr key={r.id} style={{
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isChecked ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'background 100ms',
                }}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRow(r.id)}
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                  </td>
                  <td style={cellStyle}><span className="num" style={{ color: r.yesterday > 0 ? 'var(--fg-1)' : 'var(--fg-3)' }}>{r.yesterday}</span></td>
                  <td style={cellStyle}><span className="num" style={{ color: r.today > 0 ? 'var(--cyan)' : 'var(--fg-3)', fontWeight: r.today > 0 ? 600 : 400 }}>{r.today}</span></td>
                  <td style={cellStyle}><span className="num" style={{ color: getGrabFailed(r) > 0 ? 'var(--danger)' : 'var(--fg-3)' }}>{getGrabFailed(r)}</span></td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }}>{r.os}</td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }}>{r.shape}</td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{r.range}</td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)' }}>{r.interval}</td>
                  <td style={cellStyle}>
                    {getInstanceIp(r) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (navigator.clipboard) navigator.clipboard.writeText(getInstanceIp(r));
                          shell.showToast(tr('ga.ipCopied').replace('{ip}', getInstanceIp(r)), { kind: 'success' });
                        }}
                        title={tr("ga.copy")}
                        style={{
                          padding: '2px 6px',
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: 3,
                          color: 'var(--cyan)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          fontWeight: 600,
                          transition: 'all 100ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--cyan-soft)'; e.currentTarget.style.borderColor = 'var(--cyan)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >{getInstanceIp(r)}</button>
                    ) : (
                      <span style={{ color: 'var(--fg-3)' }}>—</span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {(() => {
                      const revealed = revealedPw[r.id];
                      return (
                        <button
                          onClick={(e) => revealAndCopy(r, e)}
                          title={revealed ? tr('ga.hideCopied') : tr('ga.viewCopy')}
                          style={{
                            padding: '3px 8px',
                            background: revealed ? 'var(--accent-soft)' : 'transparent',
                            border: `1px solid ${revealed ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 4,
                            color: revealed ? 'var(--accent)' : 'var(--cyan)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: revealed ? 11 : 11.5,
                            letterSpacing: revealed ? 0 : 1.5,
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontWeight: revealed ? 600 : 400,
                            transition: 'all 120ms',
                          }}
                          onMouseEnter={e => { if (!revealed) e.currentTarget.style.color = 'var(--fg-0)'; }}
                          onMouseLeave={e => { if (!revealed) e.currentTarget.style.color = 'var(--cyan)'; }}
                        >
                          <Icon name={revealed ? 'eye-off' : 'eye'} size={11} />
                          {revealed ? r.rootPassword : '••••••••'}
                        </button>
                      );
                    })()}
                  </td>
                  <td style={cellStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: r.status === 'succeeded' ? 'var(--accent-soft)'
                        : r.status === 'running' ? 'var(--info-soft)'
                        : r.status === 'failed' ? 'var(--danger-soft)' : 'var(--bg-3)',
                      color: r.status === 'succeeded' ? 'var(--accent)'
                        : r.status === 'running' ? 'var(--info)'
                        : r.status === 'failed' ? 'var(--danger)' : 'var(--fg-2)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      whiteSpace: 'nowrap',
                    }}>
                      {r.status === 'running' && <StatusDot status="running" size={5} pulse />}
                      {r.status === 'succeeded' ? tr('ga.booted') : r.status === 'running' ? tr('ga.grabbing') : r.status === 'failed' ? tr('ga.failed') : tr('ga.pending')}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)' }}>{r.startedAt}</td>
                  {/* 操作按钮 · 菜单契约 MIGRATION §10.1 · 绿色选中态 */}
                  <td style={{ ...cellStyle, textAlign: 'center', padding: '6px 8px' }}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (menuFor?.row === r) { setMenuFor(null); return; }
                        setMenuFor({ row: r, anchorEl: e.currentTarget });
                      }}
                      style={{
                        width: 26, height: 26, borderRadius: 4,
                        background: menuFor?.row === r ? 'var(--accent)' : 'var(--bg-2)',
                        border: '1px solid ' + (menuFor?.row === r ? 'var(--accent)' : 'var(--border)'),
                        color: menuFor?.row === r ? 'var(--accent-fg)' : 'var(--fg-1)',
                        cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 100ms',
                      }}
                      title={tr('ga.operation')}>
                      <Icon name="more-horizontal" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}

      {/* 行操作菜单 · 严格遵循 MIGRATION §10.1 菜单契约 */}
      {menuFor && (() => {
        const r = menuFor.row;
        const isRunning = r.status === 'running';
        // 5 项操作 · 严格对齐原项目 full_machine_list.js openDetailModal 内 dropdown
        //   openBoot_stopOpen  → 停止开机 (fa-stop)   toggleBootStatus(id, 0)
        //   openBoot_startOpen → 启动开机 (fa-play)   toggleBootStatus(id, 1)
        //   openBoot_log       → 开机日志 (fa-file-alt) openBootLogDrawer
        //   openBoot_updateConfig → 修改   (fa-edit)  openEditDetailModal
        //   openBoot_delete    → 删除     (fa-trash) handleDetailDelete
        const items = [
          { id: 'stop',   label: tr('ga.action.stop'), icon: 'square',    color: 'var(--orange)', disabled: !isRunning },
          { id: 'start',  label: tr('ga.action.start'), icon: 'play',      color: 'var(--accent)', disabled: isRunning },
          { id: 'log',    label: tr('ga.action.log'), icon: 'file-text' },
          { id: 'config', label: tr('ga.action.config'), icon: 'edit',      color: 'var(--info)' },
          { id: 'delete', label: tr('ga.action.deleteRecord'), icon: 'trash-2',   color: 'var(--danger)' },
        ];
        const header = (
          <>
            <span style={{
              padding: '1px 6px', borderRadius: 3, fontSize: 9.5, fontWeight: 700,
              background: r.status === 'succeeded' ? 'var(--accent-soft)'
                : r.status === 'running' ? 'var(--info-soft)'
                : r.status === 'failed' ? 'var(--danger-soft)' : 'var(--bg-3)',
              color: r.status === 'succeeded' ? 'var(--accent)'
                : r.status === 'running' ? 'var(--info)'
                : r.status === 'failed' ? 'var(--danger)' : 'var(--fg-2)',
            }}>{r.status === 'succeeded' ? tr('ga.booted') : r.status === 'running' ? tr('ga.grabbing') : r.status === 'failed' ? tr('ga.failed') : tr('ga.pending')}</span>
            <span className="mono" style={{
              color: 'var(--fg-0)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }}>Worker #{r.workerNo}</span>
            <span style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {tr('ga.itemCount').replace('{n}', items.length)}
            </span>
          </>
        );
        return (
          <RowActionMenu
            anchorEl={menuFor.anchorEl}
            header={header}
            items={items}
            columns={2}
            width={260}
            onClose={() => setMenuFor(null)}
            onAction={(id) => {
              setMenuFor(null);
              switch (id) {
                case 'start':  startBoot(r); break;
                case 'stop':   stopBoot(r); break;
                case 'log':    showBootLog(r); break;
                case 'config': openEditConfig(r); break;
                case 'delete': deleteRow(r); break;
              }
            }}
          />
        );
      })()}
    </div>
  );
}

const cellStyle = { padding: '9px 8px', color: 'var(--fg-1)', verticalAlign: 'middle', whiteSpace: 'nowrap' };
const headStyle = {
  textAlign: 'left',
  padding: '8px 8px',
  fontSize: 10.5, fontWeight: 600,
  color: 'var(--fg-3)',
  textTransform: 'uppercase', letterSpacing: 0.5,
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-3)',
  whiteSpace: 'nowrap',
};

function MiniStatBox({ label, value, color, flash }) {
  return (
    <div style={{
      padding: 10,
      background: flash ? 'color-mix(in oklab, var(--accent) 20%, var(--bg-2))' : 'var(--bg-2)',
      border: `1px solid ${flash ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      boxShadow: flash ? '0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)' : 'none',
      transition: 'all 300ms',
      position: 'relative',
    }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{
        fontSize: 18, fontWeight: 700, color, letterSpacing: -0.3,
        transform: flash ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>{value}</div>
      {flash && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          padding: '1px 6px',
          background: 'var(--accent)', color: 'var(--accent-fg)',
          borderRadius: 999,
          fontSize: 9, fontWeight: 700,
          animation: 'fade-in 200ms',
        }}>+1</span>
      )}
    </div>
  );
}

// ─── 立即抢一次 (Dry-Fire / One-Shot Grab) ───────────────────────

function useGrabOneShotModal() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((task) => {
    // 真实单次开机请求；阶段仅用于展示请求生命周期，不生成本地成功/失败结果。
    const state = { phase: 'preparing', result: null };
    let ended = false;

    const render = () => {
      shell.openModal({
        title: tr('ga.oneShot.title').replace('{name}', getTenantName(task)),
        subtitle: tr('ga.oneShot.subtitle'),
        icon: 'zap',
        iconColor: 'var(--orange)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <ConfigMini label={tr("ga.tenant")} value={task.tenantName} mono />
              <ConfigMini label={tr("ga.region")} value={<RegionBadge code={task.region} lang={lang} style={{ display: 'inline-flex' }} />} />
              <ConfigMini label="Shape" value={task.shape} mono />
              <ConfigMini label={tr("ga.spec")} value={`${getInstanceCpu(task)}C ${getInstanceMem(task)}G · ${task.disk}GB`} mono />
            </div>

            <SectionLabel>{tr('ga.progress')}</SectionLabel>
            <div style={{
              background: 'oklch(0.10 0.008 240)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              lineHeight: 1.7,
              color: 'oklch(0.86 0.008 240)',
              minHeight: 180,
            }}>
              <PhaseLine done={['preparing', 'requesting', 'waiting', 'done'].indexOf(state.phase) > 0} active={state.phase === 'preparing'}>
                {tr('ga.phase.prepare')}
              </PhaseLine>
              <PhaseLine done={['requesting', 'waiting', 'done'].indexOf(state.phase) > 0} active={state.phase === 'requesting'}>
                [ 2/4 ] POST /boot/manualBoot?bootId={task.id}
              </PhaseLine>
              <PhaseLine done={['waiting', 'done'].indexOf(state.phase) > 0} active={state.phase === 'waiting'}>
                {tr('ga.phase.wait')}
              </PhaseLine>
              <PhaseLine done={state.phase === 'done'} active={false}>
                {tr('ga.phase.parse')}
              </PhaseLine>

              {state.result && (
                <div style={{
                  marginTop: 12, padding: 10,
                  background: state.result.success ? 'var(--accent-soft)' : 'var(--danger-soft)',
                  borderRadius: 5,
                  color: state.result.success ? 'var(--accent)' : 'var(--danger)',
                  fontWeight: 600,
                }}>
                  {state.result.success ? '✓ ' : '✗ '}{state.result.msg}
                </div>
              )}
            </div>
          </div>
        ),
        footer: state.phase === 'done'
          ? <Button variant="primary" size="md" icon="check" onClick={shell.closeModal}>{tr('common.close')}</Button>
          : <Button variant="ghost" size="md" onClick={() => { ended = true; shell.closeModal(); }}>{tr('common.cancel')}</Button>,
      });
    };
    render();

    (async () => {
      state.phase = 'requesting';
      render();
      try {
        const result = await window.ociServices.boot.manualBoot({ bootId: task.id });
        if (!result?.success) throw new Error(result?.message || tr('ga.oneShot.fail'));
        state.phase = 'waiting';
        render();
        state.phase = 'done';
        state.result = { success: true, msg: result.message || tr('ga.oneShot.submitted') };
        render();
        shell.showToast(tr('ga.oneShot.ok').replace('{name}', getTenantName(task)), { kind: 'success' });
      } catch (error) {
        if (ended) return;
        state.phase = 'done';
        state.result = { success: false, msg: error.message || String(error) };
        render();
      }
    })();
  }, [shell, lang]);
}

function PhaseLine({ done, active, children }) {
  const color = done ? 'oklch(0.72 0.16 155)' : active ? 'oklch(0.72 0.16 55)' : 'oklch(0.5 0.02 240)';
  return (
    <div style={{ color, display: 'flex', gap: 8, padding: '2px 0' }}>
      <span style={{ display: 'inline-flex' }}>
        {done ? <Icon name="check" size={12} color="oklch(0.72 0.16 155)" />
          : active ? <Icon name="loader" size={12} color="oklch(0.72 0.16 55)" />
          : <Icon name="circle" size={12} color="oklch(0.5 0.02 240)" />}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ConfigMini({ label, value, mono }) {
  return (
    <div style={{ padding: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ─── 查看关联实例 ──────────────────────────────────────────────

function useTaskInstancesDrawer() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((task) => {
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
    });
    const open = (related) => {
      shell.openDrawer({
        title: tr('ga.instances.title').replace('{name}', getTenantName(task)),
        subtitle: <span>{tr('ga.instances.subtitle').replace('{grabbed}', getGrabSucceeded(task)).replace('{n}', related.length)}</span>,
        icon: 'server',
        iconColor: 'var(--cyan)',
        width: 700,
        body: (
          <div>
            {related.length === 0 ? (
              <div style={{
                padding: '40px 20px', textAlign: 'center',
                background: 'var(--bg-2)', borderRadius: 8, border: '1px dashed var(--border)',
              }}>
                <Icon name="server-off" size={30} style={{ color: 'var(--fg-3)' }} />
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-2)' }}>{tr('ga.instances.none')}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-3)' }}>{tr('ga.instances.attempts').replace('{attempts}', getGrabAttempts(task).toLocaleString()).replace('{failed}', getGrabFailed(task).toLocaleString())}</div>
              </div>
            ) : (
              related.map((inst, i) => (
                <div key={i} style={{
                  padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 6, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <StatusDot status={inst.status} size={7} pulse={inst.status === 'running'} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{inst.name}</span>
                    <span className="mono" style={{
                      padding: '1px 6px', background: getInstanceArch(inst) === 'ARM' ? 'var(--info-soft)' : 'var(--violet-soft)',
                      color: getInstanceArch(inst) === 'ARM' ? 'var(--info)' : 'var(--violet)',
                      borderRadius: 3, fontSize: 10, fontWeight: 600,
                    }}>{getInstanceArch(inst)}</span>
                    <div style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{inst.createdAt}</span>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                    fontSize: 11.5,
                  }}>
                    <ConfigMini label={tr("ga.spec")} value={`${getInstanceCpu(inst)}C ${getInstanceMem(inst)}G`} mono />
                    <ConfigMini label={tr('ga.disk')} value={`${inst.disk} GB · ${inst.vpu} VPU`} mono />
                    <ConfigMini label="IPv4" value={<span style={{ color: 'var(--cyan)' }}>{getInstanceIp(inst)}</span>} mono />
                    <ConfigMini label="IPv6" value={inst.ipv6 === 'enabled' ? tr('ga.enabled') : tr('ga.disabled')} />
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    <Button size="xs" variant="outline" icon="terminal" onClick={() => {
                      const cmd = `ssh -i ~/.ssh/oci_key ubuntu@${getInstanceIp(inst)}`;
                      if (navigator.clipboard) navigator.clipboard.writeText(cmd);
                      shell.showToast(tr('ga.sshCopied'), { kind: 'success' });
                    }}>{tr('ga.copySsh')}</Button>
                    <Button size="xs" variant="outline" icon="monitor" onClick={() => shell.showToast(tr('ga.openVnc').replace('{name}', inst.name), { kind: 'info' })}>VNC</Button>
                    <div style={{ flex: 1 }} />
                    <Button size="xs" variant="ghost" icon="external-link"
                      onClick={() => {
                        try {
                          sessionStorage.setItem('ocip-instance-filter', JSON.stringify({
                            tenantId: inst.tenantId,
                            instanceName: inst.name,
                          }));
                        } catch {}
                        shell.closeModal();
                        window.__ocipNavigate?.('instances');
                      }}
                    >{tr('ga.gotoInstances')}</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ),
      });
    };
    // 加载真实 OCI 实例(属于该任务租户)
    (async () => {
      let related = [];
      try {
        const pageData = await window.ociApi.getPage('/oci/list/json', { page: 0, size: 500, tenantId: task.tenantId });
        related = (pageData.content || []).map(normInstance);
      } catch (e) { related = []; }
      open(related);
    })();
  }, [shell, lang]);
}

// ─── 查看该任务日志 ────────────────────────────────────────────

function useTaskLogsFilterDrawer() {
  const shell = useShell();
  const { lang, t: tr } = useT();
  return React.useCallback((task) => {
    shell.openDrawer({
      title: tr('ga.taskLogs.title').replace('{name}', getTenantName(task)),
      subtitle: <span>{tr('ga.taskLogs.subtitle')} <span className="mono">tenant={task.tenantName}</span> · <span className="mono">region={task.region}</span></span>,
      icon: 'terminal',
      iconColor: 'var(--cyan)',
      width: 720,
      body: <TaskLogDrawerBody task={task} />,
      actions: (
        <>
          <Button size="sm" variant="outline" icon="external-link" onClick={() => window.__ocipNavigate?.('logs')}>{tr('ga.viewFullLogs')}</Button>
        </>
      ),
    });
  }, [shell, lang]);
}

function TaskLogDrawerBody() {
  const { t: tr } = useT();
  const [logs, setLogs] = React.useState([]);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    window.ociServices.system.openLogs({ lines: 300 }).then(result => {
      if (!alive) return;
      const lines = Array.isArray(result?.lines) ? result.lines : [];
      setLogs(lines.map(line => typeof parseLogLine === 'function' ? parseLogLine(line) : { time: '', level: 'INFO', msg: String(line || '') }));
    }).catch(e => alive && setError(e.message || tr('ga.log.load.fail')));
    return () => { alive = false; };
  }, []);
  return (
    <div style={{ padding: 4 }}>
      {error && <div role="alert" style={{ color: 'var(--danger)', padding: 20 }}>{error}</div>}
      {!error && logs.length === 0 && <div style={{ color: 'var(--fg-3)', padding: 20, textAlign: 'center' }}>{tr('ga.noLogs')}</div>}
      <div style={{ background: 'oklch(0.10 0.008 240)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, maxHeight: 480, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
            <span style={{ color: 'oklch(0.55 0.05 240)', flexShrink: 0 }}>{l.time}</span>
            <span style={{ color: logColor(l.level).fg, fontWeight: 700, minWidth: 62, flexShrink: 0 }}>[{l.level}]</span>
            <span style={{ color: 'oklch(0.86 0.008 240)', wordBreak: 'break-all' }}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 导出/导入任务配置 ────────────────────────────────────────

function useExportTaskAction() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback((task) => {
    shell.showToast(tr('ga.export.unavailable'), { kind: 'warn' });
  }, [shell]);
}

function useImportTasksModal() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback(() => {
    let dragOver = false;
    let file = null;
    const render = () => {
      shell.openModal({
        title: tr('ga.import.title'),
        subtitle: tr('ga.import.subtitle'),
        icon: 'upload',
        iconColor: 'var(--info)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <label
              onDragOver={e => { e.preventDefault(); if (!dragOver) { dragOver = true; render(); } }}
              onDragLeave={() => { dragOver = false; render(); }}
              onDrop={e => {
                e.preventDefault();
                dragOver = false;
                if (e.dataTransfer.files.length) { file = e.dataTransfer.files[0]; render(); }
              }}
              style={{
                display: 'block',
                padding: 32, textAlign: 'center',
                background: dragOver ? 'var(--accent-soft)' : 'var(--bg-2)',
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <Icon name="upload-cloud" size={32} style={{ color: dragOver ? 'var(--accent)' : 'var(--fg-3)' }} />
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>
                {file ? file.name : tr('ga.import.drop')}
              </div>
              <input type="file" style={{ display: 'none' }} accept=".json" onChange={e => { if (e.target.files[0]) { file = e.target.files[0]; render(); } }} />
            </label>
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
              {tr('ga.import.example')}<br />
              <span className="mono" style={{ color: 'var(--fg-1)' }}>[{'{'}"tenantAlias":"kr1","region":"ap-chuncheon-1","shape":"VM.Standard.A1.Flex","cpu":4,"mem":24,"disk":200,"interval":12{'}'},...]</span>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
            <Button variant="primary" size="md" icon="upload" disabled={!file} onClick={() => {
              shell.showToast(tr('ga.import.unavailable'), { kind: 'warn' });
            }}>{tr('ga.import.start')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

// ─── 修改并发数 (Worker 池调整) ──────────────────────────────

function useAdjustConcurrencyModal() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback((task) => {
    const state = { workers: task.executing || 1, priority: 'normal' };
    const render = () => {
      shell.openModal({
        title: tr('ga.concurrency.title').replace('{name}', getTenantName(task)),
        subtitle: tr('ga.concurrency.subtitle'),
        icon: 'sliders-horizontal',
        iconColor: 'var(--cyan)',
        size: 'sm',
        body: (
          <div style={{ padding: 22 }}>
            <FormRow label={tr('ga.concurrency.workers').replace('{n}', state.workers)} hint={tr('ga.concurrency.hint')}>
              <input
                type="range"
                min="1" max="10" step="1"
                value={state.workers}
                onChange={e => { state.workers = +e.target.value; render(); }}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                <span>1</span><span>{tr('ga.concurrency.safe')}</span><span>5</span><span>{tr('ga.concurrency.aggressive')}</span><span>10</span>
              </div>
            </FormRow>

            <FormRow label={tr("ga.priority")}>
              <RadioGroup
                value={state.priority}
                onChange={v => { state.priority = v; render(); }}
                options={[
                  { value: 'low', label: tr('ga.priority.low'), icon: 'chevron-down' },
                  { value: 'normal', label: tr('ga.priority.normal'), icon: 'minus' },
                  { value: 'high', label: tr('ga.priority.high'), icon: 'chevron-up' },
                ]}
              />
            </FormRow>

            <div style={{ padding: 10, background: state.workers > 5 ? 'var(--danger-soft)' : state.workers > 3 ? 'var(--orange-soft)' : 'var(--info-soft)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-1)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name={state.workers > 3 ? 'alert-triangle' : 'info'} size={13} style={{ color: state.workers > 5 ? 'var(--danger)' : state.workers > 3 ? 'var(--orange)' : 'var(--info)', marginTop: 2, flexShrink: 0 }} />
              <div>
                {state.workers > 5 ? tr('ga.concurrency.danger')
                  : state.workers > 3 ? tr('ga.concurrency.warn')
                  : tr('ga.concurrency.safeHint')}
              </div>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
            <Button variant="primary" size="md" icon="check" onClick={() => {
              shell.showToast(tr('ga.concurrency.unavailable'), { kind: 'warn' });
            }}>{tr('ga.apply')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

// ─── 发送测试通知 ──────────────────────────────────────────────

function useTestNotificationAction() {
  const shell = useShell();
  const { t: tr } = useT();
  return React.useCallback((task) => {
    shell.showToast(tr('ga.notify.unavailable'), { kind: 'warn' });
  }, [shell]);
}

Object.assign(window, {
  useGrabTaskEditModal, useCloneTaskModal, useGrabTaskLogsDrawer,
  useGrabOneShotModal, useTaskInstancesDrawer, useTaskLogsFilterDrawer,
  useExportTaskAction, useImportTasksModal, useAdjustConcurrencyModal,
  useTestNotificationAction,
});
