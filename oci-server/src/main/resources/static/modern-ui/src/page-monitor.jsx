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

  // 方案 A：智能在线时长与圆环进度（不足 1 天显示小时/分钟，圆环平滑反映当前阶段进度）
  let smartUptimeVal = 0;
  let smartUptimeUnitKey = 'monitor.sys.days';
  let smartUptimeMax = 90;
  let smartUptimeProgress = 0;

  if (days >= 1) {
    smartUptimeVal = days;
    smartUptimeUnitKey = 'monitor.sys.days';
    smartUptimeMax = 90;
    smartUptimeProgress = Math.min(90, days);
  } else if (hours >= 1) {
    smartUptimeVal = hours;
    smartUptimeUnitKey = 'monitor.sys.hours';
    smartUptimeMax = 24;
    smartUptimeProgress = hours;
  } else {
    smartUptimeVal = Math.max(1, mins);
    smartUptimeUnitKey = 'monitor.sys.mins';
    smartUptimeMax = 60;
    smartUptimeProgress = Math.max(1, mins);
  }

  const rawOs = mem.osName || '';
  const cleanOs = rawOs
    .replace(/^Linux\s+(?=Ubuntu|Debian|CentOS|Rocky|Alma|Alpine|Fedora|RHEL|Arch)/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+build\b.*/i, '')
    .trim();
  const rawHost = mem.hostname || '';
  const cleanHost = rawHost.replace(/\.local$/i, '').trim();

  // 运行时间：对齐规范展示（如 16min / 2h 2min / 1d 2h 16min）
  let uptimeFormatted = '';
  if (days > 0) {
    uptimeFormatted = `${days}d ${hours}h ${mins}min`;
  } else if (hours > 0) {
    uptimeFormatted = `${hours}h ${mins}min`;
  } else {
    uptimeFormatted = `${mins}min`;
  }

  return {
    cpu: { cpuUsage: mem.cpuUsage ?? null, cpuTemperature: mem.cpuTemperature ?? null, cpuPhysicalCount: mem.cpuPhysicalCount, cpuLogicalCount: mem.cpuLogicalCount, cpuModel: mem.cpuModel || '', cpuFrequency: cpuFreq ?? 0, cpuVendor: mem.cpuVendor || '' },
    memory: { memoryUsage: mem.memoryUsage ?? null, totalMemory: mem.totalMemory || 0, availableMemory: mem.availableMemory || 0, usedMemory: mem.usedMemory || 0, swapUsage: mem.swapUsage ?? null, swapTotal: mem.swapTotal || 0, swapUsed: mem.swapUsed || 0 },
    disk: { diskUsage: mem.diskUsage ?? null, diskTotal: mem.diskTotal || 0, diskUsed: mem.diskUsed || 0, diskFree: mem.diskFree || 0 },
    network: { uploadSpeed: mem.uploadSpeed ?? null, downloadSpeed: mem.downloadSpeed ?? null, totalUploadBytes: mem.totalUploadBytes || 0, totalDownloadBytes: mem.totalDownloadBytes || 0 },
    system: { totalProcesses: mem.totalProcesses, threadCount: mem.threadCount, systemUptime: uptimeSec, osName: cleanOs, osArch: mem.osArch || '', hostname: cleanHost, javaVersion: mem.javaVersion || 'JDK 17' },
    timestamp: String(mem.timestamp || '').replace('T', ' ').slice(0, 19),
    dashboard: { totalApiCalls: dash.totalApiCalls ?? 0, totalBootInstances: dash.totalBootInstances ?? 0, totalAttempts: dash.totalAttempts ?? 0, successfulAttempts: dash.successfulAttempts ?? 0, failCounts: dash.failCounts ?? 0, successRate: dash.successRate ?? 0 },
    _display: {
      memTotalGB: _mbToGB(mem.totalMemory || 0), memUsedGB: _mbToGB(mem.usedMemory || 0), memAvailMB: (mem.availableMemory || 0) + ' MB',
      swapDisplay: (mem.swapUsed || 0) + 'MB / ' + (mem.swapTotal || 0) + 'MB',
      diskTotalGB: _fmtGB(mem.diskTotal || 0), diskUsedGB: _fmtGB(mem.diskUsed || 0), diskFreeGB: _fmtGB(mem.diskFree || 0),
      uptimeStr: uptimeFormatted,
      smartUptimeVal,
      smartUptimeUnitKey,
      smartUptimeMax,
      smartUptimeProgress,
      cpuFreqDisplay: Number.isFinite(Number(cpuFreq)) && Number(cpuFreq) > 0 ? `${cpuFreq} GHz` : 'N/A',
    },
  };
}

function MonitorPage({ density }) {
  const { t: tr, lang } = useT();
  const [s, setS] = useStateM(() => buildMonitorState({}, {}));
  const [portrait, setPortrait] = useStateM(null);
  const [portraitError, setPortraitError] = useStateM('');
  const [activityLogs, setActivityLogs] = useStateM([]);
  const [loadError, setLoadError] = useStateM('');

  // 真实后端 · 加载仪表盘统计(GET /boot/dashboard-stats) + 系统指标(GET /boot/stats)
  const loadMonitor = React.useCallback(async () => {
    try {
      const portraitPromise = (
        window.ociServices?.boot?.tenantPortrait
          ? window.ociServices.boot.tenantPortrait()
          : window.ociApi.request('/boot/tenant-portrait')
      ).catch(error => ({ success: false, message: error.message }));
      const [dashboardResponse, metricsResponse, logResponse, portraitResponse] = await Promise.all([
        window.ociApi.request('/boot/dashboard-stats'),
        window.ociApi.request('/boot/stats'),
        window.ociApi.request('/system/openLogs/json'),
        portraitPromise,
      ]);
      if (!dashboardResponse?.success) throw new Error(dashboardResponse?.message || tr('monitor.err.dashboard'));
      if (!metricsResponse?.success) throw new Error(metricsResponse?.message || tr('monitor.err.metrics'));
      const next = buildMonitorState(metricsResponse.data || {}, dashboardResponse.data || {});
      setS(next);
      if (portraitResponse?.success && portraitResponse.data) {
        setPortrait(portraitResponse.data);
        setPortraitError('');
      } else if (portraitResponse && typeof portraitResponse.totalMainTenants === 'number') {
        setPortrait(portraitResponse);
        setPortraitError('');
      } else {
        setPortraitError(lang === 'en' ? 'Tenant portrait could not be loaded. Try again later.' : '主账号画像加载失败，请稍后重试');
      }
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
    <div className="monitor-page" style={{ paddingBottom: 16 }}>
      <div className="monitor-header">
        <PageHeader
          title={tr('monitor.title')}
          icon="activity"
          actions={
            <>
              <span className="monitor-timestamp" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
                <StatusDot status="running" size={6} pulse />
                <span className="mono" style={{ color: 'var(--fg-1)' }}>{s.timestamp}</span>
              </span>
              <Button variant="outline" size="md" icon="refresh-cw" onClick={loadMonitor}>{tr('common.refresh')}</Button>
            </>
          }
        />
      </div>

      {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>}

      {/* Top KPI strip */}
      <div className="monitor-kpi-grid">
        {kpis.map((k, i) => (
          <KPICard key={i} label={k.label} value={k.value} icon={k.icon} iconColor={k.color} />
        ))}
      </div>

      {/* Four gauges row · CPU / 内存 / 磁盘 / 系统信息 */}
      <div className="monitor-resource-grid">
        {/* CPU · SystemMetrics {cpuUsage, cpuPhysicalCount, cpuLogicalCount, cpuTemperature, cpuFrequency, cpuModel} */}
        <Card className="monitor-resource-card" title={tr('monitor.cpu.title')} subtitle={s.cpu.cpuModel || tr('monitor.cpu.sub')} headerIcon="cpu" headerIconColor="var(--accent)">
          <div className="monitor-gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
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
        <Card className="monitor-resource-card" title={tr('monitor.mem.title')} subtitle={`${tr('monitor.mem.totalLabel')}${s._display.memTotalGB}`} headerIcon="database" headerIconColor="var(--orange)">
          <div className="monitor-gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
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
        <Card className="monitor-resource-card" title={tr('monitor.disk.title')} subtitle={tr('monitor.disk.sub')} headerIcon="hard-drive" headerIconColor="var(--danger)">
          <div className="monitor-gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge value={s.disk.diskUsage} max={100} color="var(--danger)" size={180} thickness={14} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.disk.total')} value={<span className="mono">{s._display.diskTotalGB}</span>} />
            <SysRow label={tr('monitor.disk.used')}  value={<span className="mono">{s._display.diskUsedGB}</span>} />
            <SysRow label={tr('monitor.disk.avail')} value={<span className="mono">{s._display.diskFreeGB}</span>} />
            <SysRow label={tr('monitor.disk.fs')}    value={<span className="mono" style={{ color: 'var(--fg-3)' }}>{tr('monitor.disk.na')}</span>} />
          </div>
        </Card>

        {/* System · SystemMetrics {totalProcesses, threadCount, systemUptime, osName, osArch, hostname, javaVersion} */}
        <Card className="monitor-resource-card" title={tr('monitor.sys.title')} subtitle={<span className="mono" style={{ fontSize: 10 }}>{s.system.hostname}</span>} headerIcon="server" headerIconColor="var(--accent)">
          <div className="monitor-gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 8px' }}>
            <CircularGauge
              value={s._display.smartUptimeProgress}
              max={s._display.smartUptimeMax}
              color="var(--accent)"
              size={180}
              thickness={14}
              unit=""
              valueSize={30}
              displayValue={s._display.smartUptimeVal}
              label={<span style={{ color: 'var(--fg-3)' }}>{tr(s._display.smartUptimeUnitKey)}</span>}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SysRow label={tr('monitor.sys.os')}     value={<span className="mono" title={s.system.osName}>{s.system.osName}</span>} />
            <SysRow label={tr('monitor.sys.arch')}   value={<span className="mono">{s.system.osArch}</span>} />
            <SysRow label={tr('monitor.sys.uptime')} value={<span className="mono">{s._display.uptimeStr}</span>} />
            <SysRow label={tr('monitor.sys.java')}   value={<span className="mono">{s.system.javaVersion}</span>} />
          </div>
        </Card>
      </div>

      {/* 号池主账号多维画像 */}
      <TenantPortraitSection portrait={portrait} error={portraitError} tr={tr} lang={lang} />

      {/* Bottom charts row: Grab trend + activity feed */}
      <div className="monitor-bottom-grid">
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
            {activityLogs.length ? activityLogs.map((l, i) => (
              <div key={i} className="monitor-activity-row" style={{
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
            )) : (
              <div className="monitor-activity-empty">
                {tr('monitor.chart.activityEmpty')}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function _trOr(tr, key, zh, en, lang) {
  const val = tr ? tr(key) : key;
  if (val && val !== key) return val;
  return lang === 'en' ? en : zh;
}

function TenantPortraitSection({ portrait, error, tr, lang }) {
  const total = Number(portrait?.totalMainTenants || 0);
  const inactive = Number(portrait?.inactiveCount || 0);
  const upgraded = Number(portrait?.upgradedCount || 0);
  const free = Number(portrait?.freeCount || 0);
  const unknownPlan = Number(portrait?.unknownPlanCount || 0);
  const corporate = Number(portrait?.corporateCount || 0);
  const personal = Number(portrait?.personalCount || 0);
  const unknownEntity = Number(portrait?.unknownEntityCount || 0);
  const overHalfYear = Number(portrait?.overHalfYearCount || 0);
  const overOneYear = Number(portrait?.overOneYearCount || 0);
  const multiRegion = Number(portrait?.multiRegionCount || 0);

  const pct = (num) => (total > 0 ? ((num / total) * 100).toFixed(1) + '%' : '0.0%');
  const ageBuckets = portrait?.ageBuckets || {};
  const regionBuckets = portrait?.regionCountBuckets || {};

  const ageChartItems = [
    { label: _trOr(tr, 'monitor.portrait.age.lt30d', '< 30 天', '< 30d', lang), value: Number(ageBuckets.lt30d || 0), color: 'var(--info)' },
    { label: _trOr(tr, 'monitor.portrait.age.d30To180', '30–180 天', '30–180d', lang), value: Number(ageBuckets.d30To180 || 0), color: 'var(--cyan)' },
    { label: _trOr(tr, 'monitor.portrait.age.d180To365', '180–365 天', '180–365d', lang), value: Number(ageBuckets.d180To365 || 0), color: 'var(--accent)' },
    { label: _trOr(tr, 'monitor.portrait.age.gt365d', '> 1 年', '> 1 yr', lang), value: Number(ageBuckets.gt365d || 0), color: 'var(--violet)' },
  ];

  const regionChartItems = [
    { label: _trOr(tr, 'monitor.portrait.region.r1', '单区域 (1)', '1 Region', lang), value: Number(regionBuckets.r1 || 0), color: 'var(--cyan)' },
    { label: _trOr(tr, 'monitor.portrait.region.r2', '双区域 (2)', '2 Regions', lang), value: Number(regionBuckets.r2 || 0), color: 'var(--accent)' },
    { label: _trOr(tr, 'monitor.portrait.region.r3Plus', '3+ 多区域', '3+ Regions', lang), value: Number(regionBuckets.r3Plus || 0), color: 'var(--orange)' },
  ];

  const ratioCards = [
    {
      title: _trOr(tr, 'monitor.portrait.upgradedRatio', '升级号占比', 'Upgraded Ratio', lang),
      main: pct(upgraded),
      sub: unknownPlan > 0
        ? `${_trOr(tr, 'monitor.portrait.paid', '升级号', 'Paid', lang)} ${upgraded} · ${_trOr(tr, 'monitor.portrait.free', '免费号', 'Free', lang)} ${free} · ${_trOr(tr, 'monitor.portrait.unverified', '待同步', 'Unsynced', lang)} ${unknownPlan}`
        : `${_trOr(tr, 'monitor.portrait.paid', '升级号', 'Paid', lang)} ${upgraded} · ${_trOr(tr, 'monitor.portrait.free', '免费号', 'Free', lang)} ${free}`,
      ratio: total > 0 ? upgraded / total : 0,
      color: 'var(--accent)',
      icon: 'award',
    },
    {
      title: _trOr(tr, 'monitor.portrait.entityMix', '个人 / 企业主体', 'Personal / Corporate', lang),
      main: `${personal} / ${corporate}`,
      sub: unknownEntity > 0
        ? `${_trOr(tr, 'monitor.portrait.corpPct', '企业占比', 'Corp', lang)} ${pct(corporate)} · ${_trOr(tr, 'monitor.portrait.unverified', '待同步', 'Unsynced', lang)} ${unknownEntity}`
        : `${_trOr(tr, 'monitor.portrait.corpPct', '企业占比', 'Corp', lang)} ${pct(corporate)} · ${_trOr(tr, 'monitor.portrait.personalPct', '个人占比', 'Personal', lang)} ${pct(personal)}`,
      ratio: total > 0 ? (personal + corporate) / total : 0,
      color: 'var(--violet)',
      icon: 'building-2',
    },
    {
      title: _trOr(tr, 'monitor.portrait.veteranRate', '老号存活率 (>180天)', 'Veteran (>180d)', lang),
      main: pct(overHalfYear),
      sub: `≥180d: ${overHalfYear} · ≥1y: ${overOneYear} (${pct(overOneYear)})`,
      ratio: total > 0 ? overHalfYear / total : 0,
      color: 'var(--cyan)',
      icon: 'shield-check',
    },
    {
      title: _trOr(tr, 'monitor.portrait.multiRegionRatio', '多区域拓展率', 'Multi-Region Ratio', lang),
      main: pct(multiRegion),
      sub: `${_trOr(tr, 'monitor.portrait.multiRegionSub', '已订阅 ≥2 个区域', '≥2 Subscribed Regions', lang)}: ${multiRegion} / ${total}`,
      ratio: total > 0 ? multiRegion / total : 0,
      color: 'var(--orange)',
      icon: 'globe',
    },
  ];

  return (
    <div style={{ marginBottom: 14 }}>
      <Card
        title={_trOr(tr, 'monitor.portrait.title', '号池主账号多维画像', 'Main Tenant Pool Portrait', lang)}
        subtitle={_trOr(tr, 'monitor.portrait.subtitle', '基于有效主区域租户聚合等级、注册主体、存活账龄与多区订阅分布（自动排除子区映射与失效账号）', 'Aggregated by active home-region accounts across tier, entity type, account age, and subscribed regions', lang)}
        headerIcon="users"
        headerIconColor="var(--accent)"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{
              fontSize: 11, color: 'var(--fg-2)',
              padding: '3px 9px', borderRadius: 999,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
            }}>
              {_trOr(tr, 'monitor.portrait.mainTotal', '有效主账号', 'Active Main', lang)}: <b style={{ color: 'var(--fg-0)' }}>{total}</b>
            </span>
            {inactive > 0 && (
              <span className="mono" style={{
                fontSize: 11, color: 'var(--danger, #dc2626)',
                padding: '3px 9px', borderRadius: 999,
                background: 'color-mix(in srgb, var(--danger, #dc2626) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger, #dc2626) 24%, transparent)',
              }}>
                {lang === 'en' ? `Inactive excluded: ${inactive}` : `失效已排除: ${inactive}`}
              </span>
            )}
          </div>
        }
      >
        {error || !portrait ? (
          <div role={error ? 'alert' : 'status'} style={{ padding: '20px 16px', color: error ? 'var(--orange)' : 'var(--fg-3)', fontSize: 12 }}>
            {error || (lang === 'en' ? 'Loading tenant portrait…' : '正在加载主账号画像…')}
          </div>
        ) : total === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--bg-2)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <Icon name="users" size={22} style={{ color: 'var(--fg-3)', opacity: 0.6 }} />
            <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>
              {_trOr(tr, 'monitor.portrait.empty', '当前号池暂无主区域账号数据，添加 OCI 租户后自动生成多维画像', 'No home-region tenants in pool yet. Add OCI tenants to view multi-dimensional portrait.', lang)}
            </div>
            <Button
              size="sm"
              variant="outline"
              icon="plus"
              onClick={() => {
                if (window.ociRouter?.navigate) window.ociRouter.navigate('/tenants');
                else window.location.hash = '#/tenants';
              }}
            >
              {_trOr(tr, 'monitor.portrait.goTenants', '前往租户管理', 'Go to Tenants', lang)}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 顶部四维比例卡片 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {ratioCards.map((card, idx) => (
                <div key={idx} style={{
                  padding: '12px 14px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  minWidth: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-2)', fontWeight: 500 }}>{card.title}</span>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: `color-mix(in oklab, ${card.color} 15%, transparent)`,
                      color: card.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name={card.icon} size={13} />
                    </span>
                  </div>
                  <div className="num mono" style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.15 }}>
                    {card.main}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'var(--bg-3)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, card.ratio * 100))}%`,
                      height: '100%',
                      background: card.color,
                      borderRadius: 999,
                      transition: 'width 320ms ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={card.sub}>
                    {card.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* 底部双分布柱状图 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
            }}>
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
                    {_trOr(tr, 'monitor.portrait.ageChartTitle', '账号存活账龄分布', 'Account Age Distribution', lang)}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                    {_trOr(tr, 'monitor.portrait.ageChartUnit', '按注册/存活天数分档', 'Grouped by active days', lang)}
                  </span>
                </div>
                <CategoryBarChart items={ageChartItems} height={148} />
              </div>

              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
                    {_trOr(tr, 'monitor.portrait.regionChartTitle', '主账号订阅区域数分布', 'Subscribed Regions per Tenant', lang)}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                    {_trOr(tr, 'monitor.portrait.regionChartUnit', '主区域 + 子区域总数', 'Home + subscribed regions', lang)}
                  </span>
                </div>
                <CategoryBarChart items={regionChartItems} height={148} />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SysRow({ label, value }) {
  return (
    <div className="monitor-system-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
      <span style={{ fontSize: 11.5, color: 'var(--fg-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, textAlign: 'right', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
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
