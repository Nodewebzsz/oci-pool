// System Monitor Page — matches reference screenshot 1
const { useState: useStateM, useEffect: useEffectM } = React;

// 用后端 SystemMetrics + DashboardStats 构建 MonitorPage 所需的 s 结构(含 _display 派生字段)
function _fmtGB(bytes) { return (bytes / 1073741824).toFixed(2) + ' GB'; }
function _mbToGB(mb) { return (mb / 1024).toFixed(2) + ' GB'; }

function buildMonitorState(m, d) {
  const mem = m || {}; const dash = d || {};
  const uptimeSec = mem.systemUptime || 0;
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);
  const cpuFreq = mem.cpuFrequency;
  return {
    cpu: { cpuUsage: mem.cpuUsage ?? null, cpuTemperature: mem.cpuTemperature ?? null, cpuPhysicalCount: mem.cpuPhysicalCount, cpuLogicalCount: mem.cpuLogicalCount, cpuModel: mem.cpuModel || '', cpuFrequency: cpuFreq ?? 0, cpuVendor: mem.cpuVendor || '' },
    memory: { memoryUsage: mem.memoryUsage ?? null, totalMemory: mem.totalMemory || 0, availableMemory: mem.availableMemory || 0, usedMemory: mem.usedMemory || 0, swapUsage: mem.swapUsage ?? null, swapTotal: mem.swapTotal || 0, swapUsed: mem.swapUsed || 0 },
    disk: { diskUsage: mem.diskUsage ?? null, diskTotal: mem.diskTotal || 0, diskUsed: mem.diskUsed || 0, diskFree: mem.diskFree || 0 },
    network: { uploadSpeed: mem.uploadSpeed ?? null, downloadSpeed: mem.downloadSpeed ?? null, totalUploadBytes: mem.totalUploadBytes || 0, totalDownloadBytes: mem.totalDownloadBytes || 0 },
    system: { totalProcesses: mem.totalProcesses, threadCount: mem.threadCount, systemUptime: uptimeSec, osName: mem.osName || '', osArch: mem.osArch || '', hostname: mem.hostname || '' },
    timestamp: String(mem.timestamp || '').replace('T', ' ').slice(0, 19),
    dashboard: { totalApiCalls: dash.totalApiCalls ?? 0, totalBootInstances: dash.totalBootInstances ?? 0, totalAttempts: dash.totalAttempts ?? 0, successfulAttempts: dash.successfulAttempts ?? 0, failCounts: dash.failCounts ?? 0, successRate: dash.successRate ?? 0 },
    _display: {
      memTotalGB: _mbToGB(mem.totalMemory || 0), memUsedGB: _mbToGB(mem.usedMemory || 0), memAvailMB: (mem.availableMemory || 0) + ' MB',
      swapDisplay: (mem.swapUsed || 0) + 'MB / ' + (mem.swapTotal || 0) + 'MB',
      diskTotalGB: _fmtGB(mem.diskTotal || 0), diskUsedGB: _fmtGB(mem.diskUsed || 0), diskFreeGB: _fmtGB(mem.diskFree || 0),
      uptimeStr: days + 'day ' + hours + 'hour ' + mins + 'min', uptimeDays: days,
      cpuFreqDisplay: Number.isFinite(Number(cpuFreq)) && Number(cpuFreq) > 0 ? `${cpuFreq} GHz` : 'N/A',
    },
  };
}

function MonitorPage({ density }) {
  const { t: tr, lang } = useT();
  const [s, setS] = useStateM(() => buildMonitorState({}, {}));
  const [activityLogs, setActivityLogs] = useStateM([]);
  const [loadError, setLoadError] = useStateM('');

  // 真实后端 · 加载仪表盘统计(GET /boot/dashboard-stats) + 系统指标(GET /boot/stats)
  const loadMonitor = React.useCallback(async () => {
    try {
      const [dashboardResponse, metricsResponse, logResponse] = await Promise.all([
        window.ociApi.request('/boot/dashboard-stats'),
        window.ociApi.request('/boot/stats'),
        window.ociApi.request('/system/openLogs/json'),
      ]);
      if (!dashboardResponse?.success) throw new Error(dashboardResponse?.message || tr('monitor.err.dashboard'));
      if (!metricsResponse?.success) throw new Error(metricsResponse?.message || tr('monitor.err.metrics'));
      const next = buildMonitorState(metricsResponse.data || {}, dashboardResponse.data || {});
      setS(next);
      setActivityLogs((logResponse?.lines || []).slice(0, 10).map(parseLogLine));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || tr('monitor.err.load'));
    }
  }, []);

  useEffectM(() => {
    loadMonitor();
    const timer = setInterval(loadMonitor, 10000);
    return () => clearInterval(timer);
  }, [loadMonitor]);

  // 对齐原项目 DashboardStats(totalApiCalls / totalBootInstances / totalAttempts / successfulAttempts / failCounts / successRate)
  const d = s.dashboard;
  const kpis = [
    { label: tr('monitor.kpi.api'),     value: d.totalApiCalls,       icon: 'list',        color: 'var(--cyan)' },
    { label: tr('monitor.kpi.boot'),    value: d.totalBootInstances,  icon: 'server',      color: 'var(--accent)' },
    { label: tr('monitor.kpi.total'),   value: d.totalAttempts,       icon: 'refresh-cw',  color: 'var(--info)' },
    { label: tr('monitor.kpi.success'), value: d.successfulAttempts,  icon: 'check-circle', color: 'var(--accent)' },
    { label: tr('monitor.kpi.failed'),  value: d.failCounts,          icon: 'x-circle',    color: 'var(--danger)' },
  ];

  const timeLabels = ['24h', '18h', '12h', '6h', '3h', 'now'];

  return (
    <div>
      <PageHeader
        title={tr('monitor.title')}
        icon="activity"
        actions={
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
              <StatusDot status="running" size={6} pulse />
              <span className="mono" style={{ color: 'var(--fg-1)' }}>{s.timestamp}</span>
            </span>
            <Button variant="outline" size="md" icon="refresh-cw" onClick={loadMonitor}>{tr('common.refresh')}</Button>
          </>
        }
      />

      {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>}

      {/* Top KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginBottom: 14,
      }}>
        {kpis.map((k, i) => (
          <KPICard key={i} label={k.label} value={k.value} icon={k.icon} iconColor={k.color} />
        ))}
      </div>

      {/* Four gauges row · CPU / 内存 / 磁盘 / 系统信息 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14,
        marginBottom: 14,
      }}>
        {/* CPU · SystemMetrics {cpuUsage, cpuPhysicalCount, cpuLogicalCount, cpuTemperature, cpuFrequency, cpuModel} */}
        <Card title={tr('monitor.cpu.title')} subtitle={s.cpu.cpuModel || tr('monitor.cpu.sub')} headerIcon="cpu" headerIconColor="var(--accent)">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge value={s.cpu.cpuUsage} max={100} color="var(--accent)" size={180} thickness={14} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.cpu.physical')} value={<span className="mono">{s.cpu.cpuPhysicalCount} C</span>} />
            <SysRow label={tr('monitor.cpu.logical')}  value={<span className="mono">{s.cpu.cpuLogicalCount} C</span>} />
            <SysRow label={tr('monitor.cpu.temp')}     value={<span className="mono" style={{ color: s.cpu.cpuTemperature == null ? 'var(--fg-3)' : 'var(--fg-1)' }}>{s.cpu.cpuTemperature == null ? 'N/A' : `${s.cpu.cpuTemperature} °C`}</span>} />
            <SysRow label={tr('monitor.cpu.freq')}     value={<span className="mono">{s._display.cpuFreqDisplay}</span>} />
          </div>
        </Card>

        {/* Memory · SystemMetrics {memoryUsage %, totalMemory MB, usedMemory MB, availableMemory MB, swap*} */}
        <Card title={tr('monitor.mem.title')} subtitle={`${tr('monitor.mem.totalLabel')}${s._display.memTotalGB}`} headerIcon="database" headerIconColor="var(--orange)">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge value={s.memory.memoryUsage} max={100} color="var(--orange)" size={180} thickness={14} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.mem.total')} value={<span className="mono">{s._display.memTotalGB}</span>} />
            <SysRow label={tr('monitor.mem.used')}  value={<span className="mono">{s._display.memUsedGB}</span>} />
            <SysRow label={tr('monitor.mem.avail')} value={<span className="mono">{s._display.memAvailMB}</span>} />
            <SysRow label={tr('monitor.mem.swap')}  value={<span className="mono">{s._display.swapDisplay}</span>} />
          </div>
        </Card>

        {/* Disk · SystemMetrics {diskUsage %, diskTotal / diskUsed / diskFree in Bytes} */}
        <Card title={tr('monitor.disk.title')} subtitle={tr('monitor.disk.sub')} headerIcon="hard-drive" headerIconColor="var(--danger)">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge value={s.disk.diskUsage} max={100} color="var(--danger)" size={180} thickness={14} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.disk.total')} value={<span className="mono">{s._display.diskTotalGB}</span>} />
            <SysRow label={tr('monitor.disk.used')}  value={<span className="mono">{s._display.diskUsedGB}</span>} />
            <SysRow label={tr('monitor.disk.avail')} value={<span className="mono">{s._display.diskFreeGB}</span>} />
            <SysRow label={tr('monitor.disk.fs')}    value={<span className="mono" style={{ color: 'var(--fg-3)' }}>{tr('monitor.disk.na')}</span>} />
          </div>
        </Card>

        {/* System · SystemMetrics {totalProcesses, threadCount, systemUptime, osName, osArch, hostname} */}
        <Card title={tr('monitor.sys.title')} subtitle={<span className="mono" style={{ fontSize: 10 }}>{s.system.hostname}</span>} headerIcon="server" headerIconColor="var(--accent)">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge
              value={s._display.uptimeDays}
              max={90}
              color="var(--accent)"
              size={180}
              thickness={14}
              unit=""
              valueSize={30}
              label={<span style={{ color: 'var(--fg-3)' }}>{lang === 'zh' ? tr('monitor.sys.days') : 'days'}</span>}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.sys.os')}     value={<span style={{ fontSize: 11, color: 'var(--fg-1)', textAlign: 'right', maxWidth: 220, wordBreak: 'break-word' }}>{s.system.osName}</span>} />
            <SysRow label={tr('monitor.sys.arch')}   value={<span className="mono">{s.system.osArch}</span>} />
            <SysRow label={tr('monitor.sys.uptime')} value={<span className="mono">{s._display.uptimeStr}</span>} />
          </div>
        </Card>
      </div>

      {/* Bottom charts row: Grab trend + activity feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gap: 14,
      }}>
        <Card
          title={tr('monitor.chart.grabRate')}
          subtitle={tr('monitor.chart.subtitle')}
          headerIcon="bar-chart-3"
          headerIconColor="var(--cyan)"
          padding={0}
          action={
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cyan)' }} />
                {tr('monitor.chart.attempts')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                {tr('monitor.chart.success')}
              </span>
            </div>
          }
        >
          <div style={{ padding: '16px 20px' }}>
            <BarChart
              data={[]}
              successAt={[]}
              height={200}
              maxY={120}
              xLabels={timeLabels.concat(['', '', '']).slice(0, 6)}
            />
          </div>
        </Card>

        <Card title={tr('monitor.chart.activity')} headerIcon="radio" headerIconColor="var(--accent)" padding={0}>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {activityLogs.map((l, i) => (
              <div key={i} style={{
                padding: '10px 16px',
                borderBottom: i < 9 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                fontSize: 11.5,
              }}>
                <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 10, flexShrink: 0, marginTop: 2 }}>{l.time}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 3,
                  minWidth: 46, textAlign: 'center',
                  background: logColor(l.level).bg,
                  color: logColor(l.level).fg,
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}>{l.level}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--fg-1)', lineHeight: 1.4 }}>{l.msg}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                    <span className="mono">{l.tenant}</span> · <span className="mono">{l.region}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SysRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function logColor(level) {
  const m = {
    INFO:    { bg: 'var(--cyan-soft)', fg: 'var(--cyan)' },
    WARN:    { bg: 'var(--orange-soft)', fg: 'var(--orange)' },
    ERROR:   { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    SUCCESS: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    DEBUG:   { bg: 'var(--bg-3)', fg: 'var(--fg-2)' },
  };
  return m[level] || m.INFO;
}

Object.assign(window, { MonitorPage, logColor });
