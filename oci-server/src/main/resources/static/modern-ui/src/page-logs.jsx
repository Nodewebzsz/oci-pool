// Grab Logs — real-time streaming terminal
const { useState: useStateLg, useEffect: useEffectLg, useRef: useRefLg } = React;

// 解析后端日志文本行 → { time, level, tenant, region, msg }
function parseLogLine(line) {
  const s = String(line || '');
  const tm = s.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})|(\d{2}:\d{2}:\d{2})/);
  const time = tm ? (tm[1] || tm[2]) : '';
  const lvl = (s.match(/\b(INFO|WARN|ERROR|DEBUG|SUCCESS)\b/) || [])[0] || 'INFO';
  const msg = s.replace(tm ? tm[0] : '', '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim() || s;
  return { time, level: lvl, tenant: '', region: '', msg };
}

// ═══════════════════════════════════════════════════════════════════════
// OCI 开机日志 · 对齐原项目 open_boot_log.ftl
//   /openBoot/log —— 单终端卡片布局
//     ┌────────────────────────────────────────────┐
//     │ ▶ OCI开机日志          [已连接]              │  ← terminal-header
//     ├────────────────────────────────────────────┤
//     │ 20:21:24 [INFO]  ...                          │
//     │ 20:21:26 [WARN]  Out of host capacity ...    │  ← terminal-content
//     │ 20:21:29 [SUCCESS] ✓ 实例创建成功 ...          │    (mono 黑底)
//     ├────────────────────────────────────────────┤
//     │ ⏰ 20:21:32 · 📋 148 条    ☑自动滚动 · 已连接 │  ← terminal-footer
//     └────────────────────────────────────────────┘
//   在此基础上保留项目现有的增强(级别过滤/租户/搜索/暂停等)
// ═══════════════════════════════════════════════════════════════════════
function LogsPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();
  const showLogDetail = useLogDetailDrawer();
  const [logs, setLogs] = useStateLg([]);
  const [paused, setPaused] = useStateLg(false);
  const [levelFilter, setLevelFilter] = useStateLg('all');
  const [keyword, setKeyword] = useStateLg('');
  const [loadError, setLoadError] = useStateLg('');
  const [autoScroll, setAutoScroll] = useStateLg(true);   // 对齐原项目 auto-scroll checkbox
  const [nowTime, setNowTime] = useStateLg(new Date().toTimeString().slice(0, 8));
  const terminalRef = useRefLg(null);

  // 更新 footer 里的当前时间(对齐原项目 #current-time)
  useEffectLg(() => {
    const iv = setInterval(() => setNowTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(iv);
  }, []);

  // 真实后端 · 加载开机日志(GET /system/openLogs/json)并解析为结构化日志
  useEffectLg(() => {
    let alive = true;
    (async () => {
      try {
        const json = await window.ociApi.request('/system/openLogs/json');
        if (!alive || !json) return;
        const lines = json.lines || [];
        setLogs(lines.map(parseLogLine).slice(0, 300));
      } catch (error) {
        if (alive) setLoadError(error.message || tr('logs.err.load'));
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffectLg(() => {
    if (paused) return undefined;
    const stream = new EventSource('/system/streamLogs?isBootLog=true');
    stream.onopen = () => setLoadError('');
    stream.onmessage = event => {
      const row = parseLogLine(event.data);
      setLogs(previous => [row, ...previous].slice(0, 500));
    };
    stream.onerror = () => setLoadError(tr('logs.err.reconnect'));
    return () => stream.close();
  }, [paused]);

  const filtered = logs.filter(l => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    if (keyword && !l.msg.toLowerCase().includes(keyword.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
    }}>
      <PageHeader
        title={tr('logs.title')}
        subtitle={tr('logs.subtitle')}
        icon="terminal"
        iconColor="var(--accent)"
        actions={
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
              <StatusDot status={paused ? 'idle' : 'running'} size={6} pulse={!paused} />
              {paused ? tr('logs.paused') : tr('logs.streaming')}
            </span>
            <Button variant={paused ? 'primary' : 'outline'} size="md" icon={paused ? 'play' : 'pause'} onClick={() => setPaused(!paused)}>
              {paused ? tr('logs.action.resume') : tr('logs.action.pause')}
            </Button>
            <Button variant="outline" size="md" icon="download" onClick={() => {
              const fname = `grab_log_${new Date().toISOString().slice(0, 10)}.txt`;
              const content = filtered.map(l => `${l.time ? `${l.time} ` : ''}[${l.level}] ${l.msg}`).join('\n');
              const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = fname;
              anchor.click();
              URL.revokeObjectURL(url);
              shell.showToast(tr('logs.toast.export').replace('{n}', filtered.length).replace('{fname}', fname), { kind: 'success' });
            }}>{tr('logs.action.download')}</Button>
            <Button variant="danger_soft" size="md" icon="trash" onClick={() => setLogs([])}>{tr('logs.action.clear')}</Button>
          </>
        }
      />

      {loadError && <div role="alert" style={{ marginBottom: 12, color: 'var(--orange)' }}>{loadError}</div>}

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: 12,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'INFO', 'WARN', 'ERROR', 'SUCCESS'].map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              style={{
                padding: '4px 12px',
                background: levelFilter === l ? (l === 'all' ? 'var(--bg-3)' : logColor(l).bg) : 'transparent',
                color: levelFilter === l ? (l === 'all' ? 'var(--fg-0)' : logColor(l).fg) : 'var(--fg-2)',
                border: `1px solid ${levelFilter === l ? (l === 'all' ? 'var(--border-strong)' : logColor(l).fg) : 'var(--border)'}`,
                borderRadius: 4,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {l === 'all' ? tr('common.all') : l}
              {' '}
              <span className="num" style={{ fontSize: 10, opacity: 0.7 }}>
                {l === 'all' ? logs.length : logs.filter(x => x.level === l).length}
              </span>
            </button>
          ))}
        </div>

        <SearchInput
          placeholder={tr('logs.filter.keyword')}
          value={keyword}
          onChange={setKeyword}
          width={220}
        />

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
          {tr('common.total')} <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> / {logs.length} {tr('common.records')}
        </span>
      </div>

      {/* ════ Terminal card · 对齐原项目 open_boot_log.ftl 三段布局 ════ */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        background: 'oklch(0.10 0.008 240)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}>
        {/* ─── terminal-header ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'oklch(0.13 0.010 240)',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{
            display: 'flex', alignItems: 'center', gap: 8, margin: 0,
            fontSize: 13, fontWeight: 600, color: 'var(--fg-0)',
          }}>
            <Icon name="terminal" size={14} style={{ color: 'var(--accent)' }} />
            <span>{tr('logs.terminalTitle')}</span>
            {/* 终端光标动画(对齐原项目 .terminal-cursor) */}
            <span style={{
              display: 'inline-block', width: 7, height: 13,
              background: 'var(--accent)', verticalAlign: 'middle',
              animation: 'pulse-dot 1s infinite',
              marginLeft: 2,
            }} />
          </h2>
          {/* 连接状态徽章(对齐原项目 .connection-status) */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 3,
            background: paused ? 'var(--bg-3)' : 'color-mix(in oklab, var(--accent) 20%, transparent)',
            color: paused ? 'var(--fg-3)' : 'var(--accent)',
            fontSize: 10.5, fontWeight: 600,
            border: '1px solid ' + (paused ? 'var(--border)' : 'var(--accent)'),
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: paused ? 'var(--fg-3)' : 'var(--accent)',
              animation: paused ? 'none' : 'pulse-dot 1.4s infinite',
            }} />
            {paused ? tr('logs.disconnected') : tr('logs.connected')}
          </span>
        </div>

        {/* ─── terminal-content(实际日志滚动区) ─── */}
        <div
          ref={terminalRef}
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            padding: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.65,
          }}
        >
          {filtered.length === 0 && (
            <div style={{ color: 'var(--fg-3)', textAlign: 'center', padding: 40 }}>{tr('logs.noMatch')}</div>
          )}
          {filtered.map((l, i) => (
            <div key={i}
              onClick={() => showLogDetail(l)}
              style={{
                display: 'flex', gap: 10,
                padding: '2px 4px',
                margin: '0 -4px',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'background 80ms',
                animation: i === 0 && !paused ? 'fade-in 300ms' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.16 0.010 240)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'oklch(0.55 0.05 240)', flexShrink: 0 }}>{l.time}</span>
              <span style={{
                color: logColor(l.level).fg,
                fontWeight: 700, minWidth: 66,
                flexShrink: 0,
              }}>[{l.level}]</span>
              <span style={{ color: 'oklch(0.72 0.05 240)', minWidth: 54, flexShrink: 0 }}>{l.tenant}</span>
              <span style={{ color: 'oklch(0.65 0.09 200)', minWidth: 130, flexShrink: 0 }}>{l.region}</span>
              <span style={{ color: 'oklch(0.86 0.008 240)', flex: 1, wordBreak: 'break-all' }}>{l.msg}</span>
            </div>
          ))}
        </div>

        {/* ─── terminal-footer(对齐原项目 .terminal-footer) ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'oklch(0.13 0.010 240)',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
        }}>
          {/* 左:log-info 时间 + 计数 */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: 'var(--fg-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={11} style={{ color: 'var(--fg-3)' }} />
              <span className="mono num">{nowTime}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="list" size={11} style={{ color: 'var(--fg-3)' }} />
              <span>{tr('logs.totalPrefix')}<span className="num" style={{ color: 'var(--fg-0)', fontWeight: 600 }}>{filtered.length}</span>{tr('logs.totalSuffix')}</span>
              {filtered.length !== logs.length && (
                <span style={{ color: 'var(--fg-3)' }}>· {tr('logs.filteredPrefix')}<span className="num">{logs.length - filtered.length}</span>{tr('logs.totalSuffix')}</span>
              )}
            </span>
          </div>
          {/* 右:log-actions 自动滚动 + 状态文字 */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', color: 'var(--fg-2)',
            }}>
              <input type="checkbox" checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                style={{ margin: 0, accentColor: 'var(--accent)' }} />
              <span>{tr('logs.autoScroll')}</span>
            </label>
            <span style={{ color: paused ? 'var(--fg-3)' : 'var(--accent)' }}>
              {paused ? tr('logs.pausedReceiving') : tr('logs.streaming')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LogsPage });
