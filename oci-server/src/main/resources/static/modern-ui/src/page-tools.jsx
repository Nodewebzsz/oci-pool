// ═══════════════════════════════════════════════════════════════════════
// 「我的工具」4 子菜单 · 严格对齐原项目
//   1. 通知管理 (NotifyMgmtPage) → notification_settings.ftl · /system/notifySettings
//   2. 笔记管理 (MemPage)         → memo.ftl                 · /system/memPage
//   3. 数据迁移 (MigPage)         → migration.ftl            · /migration/migPage
//   4. MFA 备份 (MfaBackupPage)   → mfa.ftl                  · /mfa/page
// ═══════════════════════════════════════════════════════════════════════

// ─── 通用小组件:设置卡片 (与 page-misc.jsx SettingsCard 保持一致的视觉) ────
function ToolSettingsCard({ title, subtitle, icon, iconColor = 'var(--fg-2)', actions, children, footer, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      ...style,
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {icon && <Icon name={icon} size={13} style={{ color: iconColor }} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fg-3)', marginLeft: 4 }}>{subtitle}</span>}
        </div>
        {actions}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {footer && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─── FormRow: 通用双列表单行 (带必填红星支持) ────────────────────────
function ToolFormRow({ label, required = false, hint, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12, ...style }}>
      <label style={{ fontSize: 11.5, color: 'var(--fg-2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

// ─── Switch: 简单原生 checkbox → toggle ────────────────────────────
function ToolSwitch({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11.5, color: 'var(--fg-1)' }}>
      <span style={{
        position: 'relative',
        width: 32, height: 18,
        background: checked ? 'var(--accent)' : 'var(--bg-3)',
        borderRadius: 999,
        transition: 'background 150ms',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%', background: 'white',
          transition: 'left 150ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

// ─── Text Input: 极简一致的输入框 (带眼睛 + 一键清空) ─────────────────
function ToolInput({ value, onChange, placeholder, type = 'text', mono = false, style = {}, disabled = false, readOnly = false, allowClear = true, ...rest }) {
  const [reveal, setReveal] = React.useState(false);
  const isPass = type === 'password';
  const effType = isPass && reveal ? 'text' : type;
  const hasVal = Boolean(value !== undefined && value !== null && String(value).length > 0 && !disabled && !readOnly && typeof onChange === 'function' && allowClear);

  const padRight = isPass
    ? (allowClear ? '54px' : '36px')
    : (allowClear ? '30px' : '10px');

  const inputStyle = {
    width: '100%',
    padding: `7px ${padRight} 7px 10px`,
    background: disabled || readOnly ? 'var(--bg-3)' : 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: disabled ? 'var(--fg-3)' : 'var(--fg-0)',
    fontFamily: mono || isPass ? 'var(--font-mono)' : 'inherit',
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 120ms',
    boxSizing: 'border-box',
    ...style,
  };
  const inputEl = (
    <input
      type={effType}
      value={value ?? ''}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={mono || isPass ? 'mono' : ''}
      autoComplete={isPass ? 'off' : undefined}
      disabled={disabled}
      readOnly={readOnly}
      style={inputStyle}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...rest}
    />
  );
  return (
    <div style={{
      position: 'relative',
      width: style.width || '100%',
      flex: style.flex,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      display: style.display || (style.width && style.width !== '100%' ? 'inline-block' : 'block'),
    }}>
      {inputEl}
      {hasVal && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => onChange && onChange('')}
          tabIndex={-1}
          title={typeof tr === 'function' ? (tr('logs.action.clear') || 'Clear') : 'Clear'}
          style={{
            position: 'absolute',
            right: isPass ? 28 : 5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 22,
            height: 22,
            padding: 0,
            background: 'transparent',
            color: 'var(--fg-3)',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.65,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--fg-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.65'; e.currentTarget.style.color = 'var(--fg-3)'; }}
        >
          <Icon name="x-circle" size={13} />
        </button>
      )}
      {isPass && (
        <button
          type="button"
          onClick={() => setReveal(!reveal)}
          tabIndex={-1}
          title={reveal ? (typeof tr === 'function' ? tr('common.hide') : 'Hide') : (typeof tr === 'function' ? tr('common.show') : 'Show')}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, padding: 0,
            background: 'transparent', color: 'var(--fg-2)',
            border: 'none', cursor: 'pointer', borderRadius: 3,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={reveal ? 'eye-off' : 'eye'} size={13} />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. NotifyMgmtPage 通知管理
//   严格对齐客户端标准 (方案 B · 双列分组紧凑自适应高度流):
//     ┌ 顶部: 通知任务全宽独立卡 (执行时间 + 3 个大瓷砖卡片 + 密钥 + 保存)
//     ├ 组 1: Telegram 联动双列 (Telegram + Telegram 代理)
//     ├ 组 2: 轻量推送双列 (Bark 通知 + 钉钉机器人，紧凑自适应无多余空高)
//     └ 组 3: 飞书机器人单卡 (紧凑自适应无拉伸)
// ═══════════════════════════════════════════════════════════════════════

function TaskOptionTile({ title, subtitle, icon, accent, checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--bg-2)',
        border: '1px solid ' + (checked ? accent : 'var(--border)'),
        cursor: 'pointer',
        transition: 'all 120ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 88,
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: `color-mix(in srgb, ${accent} 15%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          <Icon name={icon} size={14} />
        </div>
        <ToolSwitch checked={checked} onChange={onChange} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.3 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function NotifyMgmtPage() {
  const { t: tr } = useT();
  const shell = useShell();

  // 定时任务
  const [task, setTask] = React.useState({
    enabled: false, hour: 8,
    account: false, bootLog: false, cost: false,
    secret: '',
  });
  const [hourPickerOpen, setHourPickerOpen] = React.useState(false);
  const hourRef = React.useRef(null);
  React.useEffect(() => {
    if (!hourPickerOpen) return;
    const h = e => { if (!hourRef.current?.contains(e.target)) setHourPickerOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [hourPickerOpen]);

  // 5 个通道
  const authCfg = (window.getAuthConfig && window.getAuthConfig()) || { channels: {}, mfaEnabled: false };
  const [tg, setTg]         = React.useState({ enabled: authCfg.channels.tg  ?? false, botToken: '', chatId: '', chatName: '' });
  const [tgProxy, setTgProxy] = React.useState({ enabled: false, type: 'SOCKS5', host: '', port: '1080', username: '', password: '' });
  const [bark, setBark]     = React.useState({ enabled: authCfg.channels.bark ?? false, url: '', deviceKey: '' });
  const [dd, setDd]         = React.useState({ enabled: authCfg.channels.dd   ?? false, webhook: '', secret: '' });
  const [fs, setFs]         = React.useState({ enabled: false, webhook: '', secret: '' });

  // 操作状态
  const [testingKey, setTestingKey] = React.useState(null);
  const [savingKey, setSavingKey] = React.useState(null);
  const [taskSaving, setTaskSaving] = React.useState(false);
  const [regBotLoading, setRegBotLoading] = React.useState(false);

  // 通道必填字段校验（严格对齐客户端与 UI 标准第五章前置禁用规范）
  const taskReady = Boolean(task.account || task.bootLog || task.cost);
  const tgReady = Boolean(tg.botToken.trim() && tg.chatId.trim());
  const tgProxyReady = Boolean(tgProxy.host.trim() && String(tgProxy.port).trim() && (parseInt(tgProxy.port, 10) > 0));
  const barkReady = Boolean(bark.url.trim() && bark.deviceKey.trim());
  const ddReady = Boolean(dd.webhook.trim());
  const fsReady = Boolean(fs.webhook.trim());

  // ── 真实后端 · 加载通知配置 ──
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const json = await window.ociServices.notify.configs();
        if (!alive || !json || !json.success) return;
        const d = json.data || {};
        if (d.telegram) setTg(p => ({ ...p, enabled: !!d.telegram.enabled, botToken: d.telegram.botToken || '', chatId: d.telegram.chatId || '', chatName: d.telegram.chatName || '' }));
        if (d.proxy)    setTgProxy(p => ({ ...p, enabled: !!d.proxy.enabled, type: d.proxy.type || p.type, host: d.proxy.host || '', port: String(d.proxy.port ?? p.port), username: d.proxy.username || '', password: d.proxy.password || '' }));
        if (d.bark)     setBark(p => ({ ...p, enabled: !!d.bark.enabled, url: d.bark.url || p.url, deviceKey: d.bark.deviceKey || '' }));
        if (d.dingTalk) setDd(p => ({ ...p, enabled: !!d.dingTalk.enabled, webhook: d.dingTalk.webhook || '', secret: d.dingTalk.secret || '' }));
        if (d.feishu)   setFs(p => ({ ...p, enabled: !!d.feishu.enabled, webhook: d.feishu.webhook || '', secret: d.feishu.secret || '' }));
        if (d.task)     setTask(p => ({ ...p, enabled: !!d.task.enabled, hour: d.task.executeHour ?? p.hour, account: !!d.task.enableAccountCheck, bootLog: !!d.task.enableBootLog, cost: !!d.task.enableCostCheck, secret: d.task.notificationSecret || p.secret }));
      } catch (e) { if (alive) shell.showToast(e.message || tr('notify.load.fail'), { kind: 'error' }); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 仅把当前表单值持久化到后端(不弹提示)。测试 / 保存共用。
  const persistChannel = async (name) => {
    if (name === 'Telegram') {
      await window.ociServices.notify.updateTelegram({ botToken: tg.botToken, chatId: tg.chatId, chatName: tg.chatName || null, enabled: tg.enabled });
      window.setAuthConfigFlag && window.setAuthConfigFlag('tg', tg.enabled);
    } else if (name === 'DingTalk') {
      await window.ociServices.notify.updateDingTalk({ enabled: dd.enabled, webhook: dd.webhook, secret: dd.secret });
      window.setAuthConfigFlag && window.setAuthConfigFlag('dd', dd.enabled);
    } else if (name === 'Bark') {
      await window.ociServices.notify.updateBark({ enabled: bark.enabled, url: bark.url, deviceKey: bark.deviceKey });
      window.setAuthConfigFlag && window.setAuthConfigFlag('bark', bark.enabled);
    } else if (name === 'Feishu') {
      await window.ociServices.notify.updateFeishu({ enabled: fs.enabled, webhook: fs.webhook, secret: fs.secret });
    } else if (name === 'TG Proxy') {
      await window.ociServices.notify.updateProxy({ enabled: tgProxy.enabled, type: tgProxy.type, host: tgProxy.host, port: parseInt(tgProxy.port, 10) || 0, username: tgProxy.username, password: tgProxy.password });
    }
  };

  const saveChannel = async (name) => {
    setSavingKey(name);
    try {
      await persistChannel(name);
      shell.showToast(tr('notify.saved').replace('{name}', name), { kind: 'success' });
    } catch (e) {
      shell.showToast(tr('notify.save.fail').replace('{name}', name).replace('{err}', e.message || e), { kind: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  const testChannel = async (name) => {
    setTestingKey(name);
    try {
      await persistChannel(name);
      if (name === 'Telegram') await window.ociServices.notify.testTelegram();
      else if (name === 'DingTalk') await window.ociServices.notify.testDingTalk();
      else if (name === 'Bark') await window.ociServices.notify.testBark();
      else if (name === 'Feishu') await window.ociServices.notify.testFeishu();
      else if (name === 'TG Proxy') {
        const result = await window.ociServices.notify.testProxy({
          enabled: tgProxy.enabled,
          type: tgProxy.type,
          host: tgProxy.host,
          port: parseInt(tgProxy.port, 10) || 0,
          username: tgProxy.username,
          password: tgProxy.password
        });
        if (!result?.success) throw new Error(result?.message || tr('notify.proxy.test.fail'));
        shell.showToast(tr('notify.conn.ok').replace('{name}', name), { kind: 'success' });
        return;
      }
      shell.showToast(tr('notify.sent.toast').replace('{name}', name), { kind: 'success' });
    } catch (e) {
      shell.showToast(tr('notify.test.fail').replace('{name}', name).replace('{err}', e.message || e), { kind: 'error' });
    } finally {
      setTestingKey(null);
    }
  };

  // 注册 Telegram 机器人（对接真实后端接口 POST /system/startTgRobot）
  const registerTgBot = async () => {
    if (!tg.botToken.trim()) return;
    setRegBotLoading(true);
    try {
      await persistChannel('Telegram');
      const res = await fetch('/system/startTgRobot', { method: 'POST' });
      if (res.ok) {
        shell.showToast(tr('notify.regBot.ok') || '✓ Telegram 机器人注册成功', { kind: 'success' });
      } else {
        const txt = await res.text();
        shell.showToast(txt || '注册机器人失败', { kind: 'error' });
      }
    } catch (e) {
      shell.showToast(e.message || '注册机器人失败', { kind: 'error' });
    } finally {
      setRegBotLoading(false);
    }
  };

  // 定时通知任务保存
  const saveTask = async () => {
    if (!taskReady) {
      shell.showToast(tr('notify.select.required'), { kind: 'warn' });
      return;
    }
    setTaskSaving(true);
    try {
      await window.ociServices.notify.updateTask({
        enabled: task.enabled,
        executeHour: task.hour,
        notificationSecret: task.secret || null,
        enableAccountCheck: task.account,
        enableBootLog: task.bootLog,
        enableCostCheck: task.cost
      });
      shell.showToast(task.enabled ? tr('notify.task.saved') : tr('notify.task.disabled.saved'), { kind: 'success' });
    } catch (e) {
      shell.showToast(tr('notify.task.save.fail').replace('{err}', e.message || e), { kind: 'error' });
    } finally {
      setTaskSaving(false);
    }
  };

  // ── 顶部时钟面板 · 系统时间 / 北京时间 / 时差 ──
  const [clocksOpen, setClocksOpen] = React.useState(false);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!clocksOpen) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [clocksOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('nav.notifyMgmt')}
        subtitle="通知设置"
        icon="bell"
        iconColor="var(--orange)"
        actions={
          <button onClick={() => setClocksOpen(o => !o)} title={tr("notify.clock.tooltip")}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', height: 32,
              background: clocksOpen ? 'var(--info-soft)' : 'var(--bg-2)',
              border: '1px solid ' + (clocksOpen ? 'var(--info)' : 'var(--border)'),
              borderRadius: 5,
              color: clocksOpen ? 'var(--info)' : 'var(--fg-1)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 120ms',
            }}
          >
            <Icon name="clock" size={13} />
            <span>{tr('notify.clock.title')}</span>
            <Icon name={clocksOpen ? 'chevron-up' : 'chevron-down'} size={11} />
          </button>
        }
      />

      {/* 时钟面板(可展开) */}
      {clocksOpen && <ClockPanel nowTick={nowTick} />}

      {/* 全局滚动区 */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>

        {/* ══ 1. 定时任务（全宽独立区） ══ */}
        <ToolSettingsCard
          title="通知任务"
          subtitle="每天固定时刻执行所选检测任务"
          icon="clock"
          iconColor="var(--info)"
          actions={<ToolSwitch checked={task.enabled} onChange={v => setTask({ ...task, enabled: v })} />}
          footer={
            <Button
              variant="primary"
              size="sm"
              icon="save"
              onClick={saveTask}
              disabled={!taskReady}
              loading={taskSaving}
            >
              {tr('notify.action.save') || '保存配置'}
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 执行时间 */}
            <ToolFormRow label="执行时间">
              <div ref={hourRef} style={{ position: 'relative', width: 180 }}>
                <button type="button" onClick={() => setHourPickerOpen(o => !o)} style={{
                  width: '100%', padding: '7px 10px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5,
                  color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 12,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                }}>
                  <span className="mono">{String(task.hour).padStart(2, '0')}:00</span>
                  <Icon name="chevron-down" size={12} style={{ color: 'var(--fg-3)' }} />
                </button>
                {hourPickerOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: 220, marginTop: 4,
                    background: 'var(--bg-1)', border: '1px solid var(--border-strong)',
                    borderRadius: 6, boxShadow: 'var(--shadow-md)', padding: 6,
                    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3,
                    zIndex: 20,
                  }}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <button key={h} type="button" onClick={() => { setTask({ ...task, hour: h }); setHourPickerOpen(false); }}
                        className="mono"
                        style={{
                          padding: '5px 0', fontSize: 11, borderRadius: 4,
                          background: task.hour === h ? 'var(--accent)' : 'transparent',
                          color: task.hour === h ? 'var(--accent-fg)' : 'var(--fg-1)',
                          border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                          fontWeight: task.hour === h ? 600 : 400,
                        }}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                {`系统时区下每天 ${String(task.hour).padStart(2, '0')}:00 触发`}
              </div>
            </ToolFormRow>

            {/* 任务项目三等分瓷砖卡片 */}
            <ToolFormRow label="任务项目">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <TaskOptionTile
                  title="账号测活"
                  subtitle="检测租户账号可用性"
                  icon="user-check"
                  accent="var(--accent)"
                  checked={task.account}
                  onChange={v => setTask({ ...task, account: v })}
                />
                <TaskOptionTile
                  title="抢机日志"
                  subtitle="汇总抢机/开机日志"
                  icon="terminal"
                  accent="var(--info)"
                  checked={task.bootLog}
                  onChange={v => setTask({ ...task, bootLog: v })}
                />
                <TaskOptionTile
                  title="OCI 花费 (Payg)"
                  subtitle="检查账单与费用异常"
                  icon="credit-card"
                  accent="var(--orange)"
                  checked={task.cost}
                  onChange={v => setTask({ ...task, cost: v })}
                />
              </div>
            </ToolFormRow>

            {/* 通知密钥 */}
            <ToolFormRow label="通知密钥" hint="用于验证通知来源">
              <ToolInput
                value={task.secret}
                onChange={v => setTask({ ...task, secret: v })}
                type="password"
                placeholder="用于验证通知来源"
                mono
              />
            </ToolFormRow>
          </div>
        </ToolSettingsCard>

        {/* ══ 组 1 · Telegram 联动组（双列） ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
          {/* Telegram */}
          <ToolSettingsCard
            title="Telegram"
            subtitle="Bot 消息推送"
            icon="send"
            iconColor="#2aabee"
            actions={<ToolSwitch checked={tg.enabled} onChange={v => setTg({ ...tg, enabled: v })} />}
            footer={<>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="outline" size="sm" icon="send" onClick={() => testChannel('Telegram')} disabled={!tgReady} loading={testingKey === 'Telegram'}>{tr('notify.action.test')}</Button>
                <Button variant="outline" size="sm" icon="refresh-cw" onClick={registerTgBot} disabled={!tg.botToken.trim()} loading={regBotLoading}>{tr('notify.tg.regBot') || '注册机器人'}</Button>
              </div>
              <div style={{ flex: 1 }} />
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Telegram')} disabled={!tgReady} loading={savingKey === 'Telegram'}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label="Bot Token" required hint={tr("notify.tg.botFather") || "从 @BotFather 获取"}>
              <ToolInput value={tg.botToken} onChange={v => setTg({ ...tg, botToken: v })} placeholder="从 @BotFather 获取" mono />
            </ToolFormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ToolFormRow label="Chat ID" required>
                <ToolInput value={tg.chatId} onChange={v => setTg({ ...tg, chatId: v })} placeholder="会话 ID" mono />
              </ToolFormRow>
              <ToolFormRow label="Chat Name">
                <ToolInput value={tg.chatName} onChange={v => setTg({ ...tg, chatName: v })} placeholder="可选备注名" />
              </ToolFormRow>
            </div>
          </ToolSettingsCard>

          {/* TG Proxy */}
          <ToolSettingsCard
            title="Telegram 代理"
            subtitle="访问 Telegram API 的出站代理"
            icon="globe"
            iconColor="#9b59b6"
            actions={<ToolSwitch checked={tgProxy.enabled} onChange={v => setTgProxy({ ...tgProxy, enabled: v })} />}
            footer={<>
              <Button variant="outline" size="sm" icon="network" onClick={() => testChannel('TG Proxy')} disabled={!tgProxyReady} loading={testingKey === 'TG Proxy'}>{tr('notify.action.test')}</Button>
              <div style={{ flex: 1 }} />
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('TG Proxy')} disabled={!tgProxyReady} loading={savingKey === 'TG Proxy'}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label={tr('notify.tg.proxyType') || '代理类型'}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['HTTP', 'HTTPS', 'SOCKS5'].map(t => (
                  <button key={t} type="button" onClick={() => setTgProxy({ ...tgProxy, type: t })}
                    className="mono"
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 5,
                      background: tgProxy.type === t ? 'var(--accent)' : 'var(--bg-2)',
                      color: tgProxy.type === t ? 'var(--accent-fg)' : 'var(--fg-1)',
                      border: '1px solid ' + (tgProxy.type === t ? 'var(--accent)' : 'var(--border)'),
                      cursor: 'pointer', fontWeight: 500,
                    }}
                  >{t}</button>
                ))}
              </div>
            </ToolFormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <ToolFormRow label="地址" required>
                <ToolInput value={tgProxy.host} onChange={v => setTgProxy({ ...tgProxy, host: v })} placeholder="127.0.0.1" mono />
              </ToolFormRow>
              <ToolFormRow label="端口" required>
                <ToolInput value={tgProxy.port} onChange={v => setTgProxy({ ...tgProxy, port: v })} placeholder="7890" mono />
              </ToolFormRow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ToolFormRow label="用户名">
                <ToolInput value={tgProxy.username} onChange={v => setTgProxy({ ...tgProxy, username: v })} placeholder="可选" />
              </ToolFormRow>
              <ToolFormRow label="密码">
                <ToolInput value={tgProxy.password} onChange={v => setTgProxy({ ...tgProxy, password: v })} type="password" placeholder="可选" />
              </ToolFormRow>
            </div>
          </ToolSettingsCard>
        </div>

        {/* ══ 组 2 · Webhook 推送组（Bark / 钉钉 / 飞书 方案 B: 双列流，飞书单独占半宽） ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
          {/* Bark */}
          <ToolSettingsCard
            title="Bark 通知"
            subtitle="iOS 推送通知"
            icon="bell"
            iconColor="var(--orange)"
            actions={<ToolSwitch checked={bark.enabled} onChange={v => setBark({ ...bark, enabled: v })} />}
            footer={<>
              <Button variant="outline" size="sm" icon="send" onClick={() => testChannel('Bark')} disabled={!barkReady} loading={testingKey === 'Bark'}>{tr('notify.action.test')}</Button>
              <div style={{ flex: 1 }} />
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Bark')} disabled={!barkReady} loading={savingKey === 'Bark'}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label="服务 URL" required>
              <ToolInput value={bark.url} onChange={v => setBark({ ...bark, url: v })} placeholder="https://api.day.app" mono />
            </ToolFormRow>
            <ToolFormRow label="Device Key" required>
              <ToolInput value={bark.deviceKey} onChange={v => setBark({ ...bark, deviceKey: v })} placeholder="设备密钥" mono />
            </ToolFormRow>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.4 }}>
              用于 iOS Bark App 接收推送；服务 URL 可自建。
            </div>
          </ToolSettingsCard>

          {/* DingTalk */}
          <ToolSettingsCard
            title="钉钉机器人"
            subtitle="群机器人 Webhook"
            icon="message-square"
            iconColor="#0089ff"
            actions={<ToolSwitch checked={dd.enabled} onChange={v => setDd({ ...dd, enabled: v })} />}
            footer={<>
              <Button variant="outline" size="sm" icon="send" onClick={() => testChannel('DingTalk')} disabled={!ddReady} loading={testingKey === 'DingTalk'}>{tr('notify.action.test')}</Button>
              <div style={{ flex: 1 }} />
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('DingTalk')} disabled={!ddReady} loading={savingKey === 'DingTalk'}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label="Webhook" required>
              <ToolInput value={dd.webhook} onChange={v => setDd({ ...dd, webhook: v })} placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." mono />
            </ToolFormRow>
            <ToolFormRow label="签名密钥">
              <ToolInput value={dd.secret} onChange={v => setDd({ ...dd, secret: v })} placeholder="可选 Secret" type="password" mono />
            </ToolFormRow>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.4 }}>
              在钉钉群「智能群助手」中添加自定义机器人获取 Webhook。
            </div>
          </ToolSettingsCard>

          {/* Feishu (方案 B: 单独占半宽) */}
          <div style={{ gridColumn: '1 / span 1' }}>
            <ToolSettingsCard
              title="飞书机器人"
              subtitle="群机器人 Webhook"
              icon="message-square"
              iconColor="#00D6B9"
              actions={<ToolSwitch checked={fs.enabled} onChange={v => setFs({ ...fs, enabled: v })} />}
              footer={<>
                <Button variant="outline" size="sm" icon="send" onClick={() => testChannel('Feishu')} disabled={!fsReady} loading={testingKey === 'Feishu'}>{tr('notify.action.test')}</Button>
                <div style={{ flex: 1 }} />
                <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Feishu')} disabled={!fsReady} loading={savingKey === 'Feishu'}>{tr('notify.action.save')}</Button>
              </>}
            >
              <ToolFormRow label="Webhook" required>
                <ToolInput value={fs.webhook} onChange={v => setFs({ ...fs, webhook: v })} placeholder="https://open.feishu.cn/..." mono />
              </ToolFormRow>
              <ToolFormRow label="签名密钥">
                <ToolInput value={fs.secret} onChange={v => setFs({ ...fs, secret: v })} placeholder="可选 Secret" type="password" mono />
              </ToolFormRow>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, lineHeight: 1.4 }}>
                在飞书群「设置 → 群机器人」中添加自定义机器人。
              </div>
            </ToolSettingsCard>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. MemPage 笔记管理
//   现代化知识便签美学（对齐 macOS 客户端 Bento 笔记卡片 + 模态创作弹窗）
// ═══════════════════════════════════════════════════════════════════════

function MemoCard({ note, onEdit, onDelete, onView }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    const text = note.content || note.summary;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const displayTime = (note.updated || '').length >= 16 ? note.updated.slice(0, 16) : (note.updated || '-');

  return (
    <div
      onClick={() => onView && onView(note)}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 180,
        cursor: 'pointer',
        transition: 'border-color 140ms, transform 140ms, box-shadow 140ms',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 55%, var(--border))';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* 头部: 图标 + 标题 + 字数徽章 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 8px' }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)', flexShrink: 0,
        }}>
          <Icon name="file-text" size={13} />
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--fg-0)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {note.title || '无标题'}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)',
          color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 14%, transparent)',
          padding: '2px 6px', borderRadius: 999, flexShrink: 0,
        }}>
          {(note.content || '').length} 字
        </div>
      </div>

      {/* 摘要栏 (若有) */}
      {note.summary && (
        <div style={{ padding: '0 14px 8px' }}>
          <div style={{
            display: 'flex', gap: 6, padding: '6px 8px',
            background: 'color-mix(in srgb, var(--bg-2) 80%, transparent)',
            borderRadius: 6, borderLeft: '3px solid var(--orange)',
            fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.45,
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {note.summary}
            </div>
          </div>
        </div>
      )}

      {/* 正文预览 */}
      <div style={{
        padding: '0 14px', flex: 1, fontSize: 12, color: 'var(--fg-1)',
        lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
      }}>
        {note.content || <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>（无正文内容）</span>}
      </div>

      {/* 底部: 时间戳 + 三联快捷操作栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', marginTop: 10,
        borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          <Icon name="clock" size={10} />
          <span>{displayTime}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
          {/* 一键复制 */}
          <button
            type="button"
            onClick={handleCopy}
            title="复制正文"
            style={{
              padding: '3px 7px', borderRadius: 4,
              background: copied ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent',
              border: '1px solid ' + (copied ? 'var(--accent)' : 'var(--border)'),
              color: copied ? 'var(--accent)' : 'var(--fg-2)',
              fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              transition: 'all 120ms',
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={11} />
            <span>{copied ? '已复制' : '复制'}</span>
          </button>

          {/* 编辑 */}
          <button
            type="button"
            onClick={() => onEdit(note)}
            title="编辑笔记"
            style={{
              width: 24, height: 24, borderRadius: 4,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--fg-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="edit" size={11} />
          </button>

          {/* 删除 */}
          <button
            type="button"
            onClick={() => onDelete(note)}
            title="删除笔记"
            style={{
              width: 24, height: 24, borderRadius: 4,
              background: 'transparent', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
              color: 'var(--danger)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="trash-2" size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// 笔记编辑创作弹窗 Body
function MemoEditorModalBody({ initial, onSaved, onClose }) {
  const { t: tr } = useT();
  const shell = useShell();
  const isNew = !initial?.id;

  const [title, setTitle] = React.useState(initial?.title || '');
  const [summary, setSummary] = React.useState(initial?.summary || '');
  const [content, setContent] = React.useState(initial?.content || '');
  const [saving, setSaving] = React.useState(false);

  const canSave = Boolean(title.trim() && content.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { title: title.trim(), summary: summary.trim(), content };
      if (!isNew) {
        await window.ociServices.memo.update({ id: initial.id, ...payload });
      } else {
        await window.ociServices.memo.create(payload);
      }
      shell.showToast(!isNew ? (tr('memo.updated') || '笔记已更新') : (tr('memo.saved') || '笔记已创建'), { kind: 'success' });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      shell.showToast(e.message || (tr('memo.save.fail') || '保存失败'), { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 滚动表单内容区 */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
        <ToolFormRow label="笔记标题" required>
          <ToolInput value={title} onChange={setTitle} placeholder="输入清晰醒目的标题..." />
        </ToolFormRow>

        <ToolFormRow label="摘要说明" hint="可选，一两句话概括笔记核心要点（200 字内）">
          <ToolInput value={summary} onChange={setSummary} placeholder="可选，简要摘要..." />
        </ToolFormRow>

        <ToolFormRow label="正文内容" required>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="输入笔记详细内容，支持记录指令、多行脚本或配置..."
              rows={8}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--fg-0)', fontFamily: 'inherit',
                fontSize: 12.5, lineHeight: 1.6, resize: 'vertical', outline: 'none',
                minHeight: 180, maxHeight: 320, boxSizing: 'border-box',
              }}
            />
            <div style={{ alignSelf: 'flex-end', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {content.length} 字符
            </div>
          </div>
        </ToolFormRow>
      </div>

      {/* 模态底部操作栏 */}
      <div style={{
        padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
      }}>
        <Button variant="secondary" size="md" onClick={onClose}>取消</Button>
        <Button variant="primary" size="md" icon="save" onClick={handleSave} disabled={!canSave} loading={saving}>
          保存笔记
        </Button>
      </div>
    </div>
  );
}

// 笔记详情只读阅读弹窗 Body
function MemoDetailModalBody({ note, onEdit, onClose }) {
  const shell = useShell();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = note.content || note.summary;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    shell.showToast('已复制笔记正文', { kind: 'success' });
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 滚动阅读区 */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.4 }}>
          {note.title || '无标题'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="clock" size={12} />
            <span>更新于 {note.updated || '-'}</span>
          </div>
          <div style={{
            fontSize: 10.5, color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 14%, transparent)',
            padding: '2px 8px', borderRadius: 999, fontWeight: 600,
          }}>
            {(note.content || '').length} 字符
          </div>
        </div>

        {note.summary && (
          <div style={{
            display: 'flex', gap: 8, padding: '10px 12px',
            background: 'var(--bg-2)', borderRadius: 6,
            borderLeft: '3px solid var(--orange)',
            fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5,
          }}>
            {note.summary}
          </div>
        )}

        <div style={{
          padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 12.5, color: 'var(--fg-0)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 180, maxHeight: 360, overflowY: 'auto',
        }}>
          {note.content || <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>（无正文内容）</span>}
        </div>
      </div>

      {/* 模态底部操作栏 */}
      <div style={{
        padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Button variant="outline" size="md" icon={copied ? 'check' : 'copy'} onClick={handleCopy}>
          {copied ? '已复制正文' : '复制正文'}
        </Button>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>关闭</Button>
          <Button variant="primary" size="md" icon="edit" onClick={() => { onClose && onClose(); onEdit && onEdit(note); }}>
            编辑此笔记
          </Button>
        </div>
      </div>
    </div>
  );
}

function MemPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [notes, setNotes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [filter, setFilter] = React.useState('all'); // all | recent
  const [q, setQ] = React.useState('');

  const loadNotes = React.useCallback(async () => {
    setLoading(true);
    setNotes([]); // 刷新与加载时立即清空旧数据，杜绝旧数据与 loading 共存！
    setLoadError('');
    try {
      const data = await window.ociServices.memo.list();
      setNotes(Array.isArray(data) ? data.map(n => ({
        id: n.id,
        title: n.title || '',
        summary: n.summary || '',
        content: n.content || '',
        updated: n.updateTime || n.createTime || '',
      })) : []);
    } catch (error) {
      setNotes([]);
      setLoadError(error.message || tr('memo.load.fail') || '加载笔记失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadNotes(); }, [loadNotes]);

  // 打开新建/编辑弹窗
  const openEditor = (n) => {
    shell.openModal({
      title: n?.id ? '编辑笔记' : '新建笔记',
      subtitle: '知识与备忘随时记录',
      icon: 'square-pen',
      iconColor: 'var(--accent)',
      size: 'lg',
      body: <MemoEditorModalBody initial={n} onSaved={loadNotes} onClose={() => shell.closeModal()} />,
      footer: null,
    });
  };

  // 打开详情阅读弹窗
  const openView = (n) => {
    shell.openModal({
      title: '笔记详情',
      subtitle: '完整预览与快速复制',
      icon: 'book-open',
      iconColor: 'var(--info)',
      size: 'lg',
      body: <MemoDetailModalBody note={n} onEdit={openEditor} onClose={() => shell.closeModal()} />,
      footer: null,
    });
  };

  // 删除确认
  const del = (n) => {
    shell.openConfirm({
      title: '删除笔记',
      body: `确定删除「${n.title || '此笔记'}」？此操作不可恢复。`,
      danger: true,
      confirmLabel: '删除',
      onConfirm: async () => {
        try {
          await window.ociServices.memo.remove({ id: n.id });
          setNotes(list => list.filter(x => x.id !== n.id));
          shell.showToast('笔记已删除', { kind: 'success' });
        } catch (error) {
          shell.showToast(error.message || '删除失败', { kind: 'error' });
        }
      },
    });
  };

  // 排序与全维度检索（支持标题、摘要、正文三维匹配）
  const shown = React.useMemo(() => {
    let arr = [...notes];
    if (filter === 'recent') {
      arr.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    }
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter(n =>
        (n.title || '').toLowerCase().includes(k) ||
        (n.summary || '').toLowerCase().includes(k) ||
        (n.content || '').toLowerCase().includes(k)
      );
    }
    return arr;
  }, [notes, filter, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('memo.title') || '笔记管理'}
        subtitle={`${notes.length} 条笔记`}
        icon="book-open"
        iconColor="var(--info)"
        actions={<>
          <Button variant="primary" icon="plus" size="sm" onClick={() => openEditor(null)}>
            新建笔记
          </Button>
          <Button variant="outline" icon="refresh-cw" size="sm" onClick={loadNotes} loading={loading}>
            刷新
          </Button>
        </>}
      />

      {/* 现代筛选与搜索栏 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 胶囊切换 Tab */}
        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
        }}>
          {[
            { k: 'all', label: '全部笔记', count: notes.length },
            { k: 'recent', label: '最近更新' },
          ].map(f => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k)}
              style={{
                padding: '4px 10px', fontSize: 11.5, borderRadius: 6,
                background: filter === f.k ? 'var(--bg-1)' : 'transparent',
                color: filter === f.k ? 'var(--fg-0)' : 'var(--fg-2)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: filter === f.k ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                boxShadow: filter === f.k ? 'var(--shadow-sm)' : 'none',
                transition: 'all 120ms',
              }}
            >
              <span>{f.label}</span>
              {f.count !== undefined && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 999,
                  background: filter === f.k ? 'var(--accent-soft)' : 'var(--bg-3)',
                  color: filter === f.k ? 'var(--accent)' : 'var(--fg-2)',
                }}>{f.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* 定宽灵动搜索框（支持正文检索 + 一键清空） */}
        <div style={{ width: 280 }}>
          <SearchInput placeholder="搜索标题、摘要或正文..." value={q} onChange={setQ} width="100%" size="sm" />
        </div>

        {q.trim() && (
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
            已找到 {shown.length} 条匹配
          </div>
        )}
      </div>

      {/* 笔记卡片网格区 */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        {loading && notes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', color: 'var(--fg-3)', gap: 10 }}>
            <Icon name="loader-2" size={20} className="spin" style={{ opacity: 0.6 }} />
            <span style={{ fontSize: 13 }}>正在加载笔记…</span>
          </div>
        ) : loadError ? (
          <div role="alert" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>{loadError}</div>
        ) : shown.length === 0 ? (
          /* 插画级高级空状态 */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 20px', color: 'var(--fg-3)',
          }}>
            <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                position: 'absolute', width: 56, height: 56, borderRadius: 12,
                background: 'color-mix(in srgb, var(--orange) 20%, transparent)',
                transform: 'rotate(-8deg)',
              }} />
              <div style={{
                position: 'absolute', width: 56, height: 56, borderRadius: 12,
                background: 'var(--bg-1)', border: '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--info)',
              }}>
                <Icon name="book-open" size={24} />
              </div>
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 6 }}>
              {q.trim() ? '无匹配笔记' : '灵感与备忘随手记'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', maxWidth: 360, textAlign: 'center', lineHeight: 1.5, marginBottom: 16 }}>
              {q.trim() ? '试试换一个关键词，或清空搜索查看全部' : '快速记录租户配置、常用 SSH 指令或重要凭据，安全存储随时查阅'}
            </div>

            {q.trim() ? (
              <Button variant="outline" size="sm" onClick={() => setQ('')}>清除搜索条件</Button>
            ) : (
              <Button variant="primary" size="sm" icon="plus" onClick={() => openEditor(null)}>
                创建第一篇笔记
              </Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14, paddingBottom: 16 }}>
            {shown.map(n => (
              <MemoCard
                key={n.id}
                note={n}
                onEdit={openEditor}
                onDelete={del}
                onView={openView}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function _iconBtnStyle(color) {
  return {
    width: 22, height: 22, borderRadius: 4,
    background: 'transparent', border: '1px solid var(--border)',
    color, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 100ms',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 3. MigPage 数据迁移
//   对齐 migration.ftl: 左"数据导出"绿 + 右"数据导入"橙 双卡布局
// ═══════════════════════════════════════════════════════════════════════
function MigPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [file, setFile] = React.useState(null);
  const [masterKey, setMasterKey] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [lastMasterKey, setLastMasterKey] = React.useState('');
  const [copiedKey, setCopiedKey] = React.useState(false);

  const isEnc = !file || file.name.toLowerCase().endsWith('.enc');
  const canImport = Boolean(file && (!isEnc || masterKey.trim()));

  const downloadResponse = async (response, fallbackName) => {
    const blob = await response.blob();
    const disposition = response.headers?.get?.('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const generateBackup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await window.ociServices.migration.exportEncrypted();
      let key = '';
      if (response?.headers) {
        key = response.headers.get('x-master-key') || response.headers.get('X-MASTER-KEY') || '';
      }
      if (key) {
        setLastMasterKey(key);
      }
      await downloadResponse(response, `oci-pool-backup-${new Date().toISOString().slice(0, 10)}.enc`);
      if (key) {
        shell.openConfirm({
          title: '导出成功 · 请妥善保存密钥',
          body: `加密备份文件已生成并开始下载。\n\nMaster Key（解密密钥，仅生成一次）：\n${key}\n\n⚠️ 导入该备份时必须输入此密钥，请立即妥善保存！`,
          confirmLabel: '复制密钥并确认',
          cancelLabel: '我知道了',
          onConfirm: () => {
            navigator.clipboard.writeText(key);
            shell.showToast('已复制 Master Key 到剪贴板', { kind: 'success' });
          },
        });
      } else {
        shell.showToast(tr('mig.export.ok') || '导出成功', { kind: 'success' });
      }
    } catch (e) {
      shell.showToast((tr('mig.export.fail') || '导出失败').replace('{err}', e.message || e), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const startImport = () => {
    if (!canImport) return;
    shell.openConfirm({
      title: tr('mig.import.confirmTitle') || '确认导入',
      body: (tr('mig.import.confirmBody') || '导入将覆盖当前数据库中的对应数据，请确认已做好备份。').replace('{file}', file.name),
      danger: true,
      confirmLabel: tr('mig.import.confirm') || '确认导入',
      onConfirm: async () => {
        try {
          setBusy(true);
          await window.ociServices.migration.importEncrypted({ file, masterKey: masterKey.trim() });
          shell.showToast(tr('mig.import.ok') || '导入成功', { kind: 'success' });
          setFile(null);
          setMasterKey('');
        } catch (e) {
          shell.showToast((tr('mig.import.fail') || '导入失败').replace('{err}', e.message || e), { kind: 'error' });
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('mig.title')}
        subtitle={tr('mig.subtitle')}
        icon="arrow-left-right"
        iconColor="var(--info)"
      />

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>

          {/* 数据导出 */}
          <ToolSettingsCard
            title={tr('mig.export.title')}
            subtitle="生成加密 .enc 备份"
            icon="file-down"
            iconColor="var(--accent)"
            footer={
              <Button
                variant="primary"
                size="sm"
                icon="lock"
                loading={busy}
                disabled={busy}
                onClick={generateBackup}
              >
                {tr('mig.export.btn')}
              </Button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
              {[
                { icon: 'shield', text: '采用 AES-256 CBC 高强度动态加密，导出时生成一次性随机 Master Key。' },
                { icon: 'check-circle', text: '备份覆盖租户凭据、出站代理、通知配置、备忘笔记及系统全局设置。' },
                { icon: 'filter', text: '自动剔除临时心跳日志与运行时流量监控，备份轻量安全。' },
                { icon: 'key', text: '务必妥善保存导出的 Master Key，密钥丢失将无法解密恢复。' },
              ].map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, flexShrink: 0, marginTop: 1,
                  }}>
                    <Icon name={s.icon} size={12} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.6 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </ToolSettingsCard>

          {/* 数据导入 */}
          <ToolSettingsCard
            title={tr('mig.import.title')}
            subtitle="上传 .enc 并填写密钥"
            icon="file-up"
            iconColor="var(--orange)"
            footer={
              <Button
                variant="orange"
                size="sm"
                icon="upload"
                loading={busy}
                disabled={!canImport || busy}
                onClick={startImport}
              >
                {tr('mig.import.btn')}
              </Button>
            }
          >
            <ToolFormRow label="备份文件" required>
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px 16px', borderRadius: 6,
                  background: dragOver ? 'var(--orange-soft)' : 'var(--bg-2)',
                  border: '1px dashed ' + (dragOver ? 'var(--orange)' : (file ? 'var(--accent)' : 'var(--border-strong)')),
                  cursor: 'pointer', transition: 'all 120ms',
                  gap: 6, minHeight: 116,
                }}>
                <Icon name="upload-cloud" size={24} style={{ color: dragOver ? 'var(--orange)' : (file ? 'var(--accent)' : 'var(--fg-3)') }} />
                {file ? (
                  <>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }} className="mono">{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>拖拽备份文件到此处 · 或点击选择</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>支持 .enc 加密备份或 .sql 数据库文件</div>
                  </>
                )}
                <input type="file" accept=".enc,.sql" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </ToolFormRow>

            <ToolFormRow label="Master Key" required={isEnc} hint={isEnc ? "解密 .enc 备份必需密钥" : "明文备份无需密钥"}>
              <ToolInput
                value={masterKey}
                onChange={setMasterKey}
                type="password"
                placeholder="ABCD1234EFGH5678IJKL9012MNOP3456"
                mono
              />
            </ToolFormRow>

            <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4, marginTop: 4 }}>
              导入会覆盖当前库中相关数据，操作前请确认已备份。
            </div>
          </ToolSettingsCard>

        </div>

        {/* 最近一次导出的 Master Key Banner */}
        {lastMasterKey && (
          <div style={{
            marginTop: 14, padding: '14px 16px',
            background: 'var(--bg-2)', border: '1px solid var(--accent)',
            borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="key" size={14} style={{ color: 'var(--accent)' }} />
                <span>最近一次导出的 Master Key</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={copiedKey ? 'check' : 'copy'}
                onClick={() => {
                  navigator.clipboard.writeText(lastMasterKey);
                  setCopiedKey(true);
                  shell.showToast('已复制 Master Key', { kind: 'success' });
                  setTimeout(() => setCopiedKey(false), 1400);
                }}
              >
                {copiedKey ? '已复制' : '复制密钥'}
              </Button>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)',
              padding: '8px 12px', background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 6, wordBreak: 'break-all', userSelect: 'all',
            }}>
              {lastMasterKey}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              此密钥用于解密恢复该 .enc 备份文件，请妥善保存至密码管理器或安全介质中。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4. MfaBackupPage MFA 备份
//   对齐 mfa.ftl:表格 + QR + 每 30 秒刷新 OTP + 添加/导出/搜索
//   列表、保存、删除、导出全部来自 OTPController，不预置密钥。
// ═══════════════════════════════════════════════════════════════════════

// ─── 真实 TOTP (RFC 6238) 实现 · 使用浏览器 Web Crypto ──────────────
// 输入密钥必须是 Base32(RFC 4648) 编码 · 无 padding 或带 = 均可
// 计数器 = floor(unixSecond / 30) · HMAC-SHA1 → 动态截断 → 31 位数 % 1000000
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(str) {
  const s = String(str || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const ch of s) {
    const v = BASE32_ALPHABET.indexOf(ch);
    if (v < 0) continue; // 跳过非 base32 字符(容错)
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

// 计数器 (unix / 30) 转为 8 字节大端
function counterToBytes(counter) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // JS Number 是 53 位,足够容纳到 3000 年之后的计数
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  return new Uint8Array(buf);
}

async function computeTotp(secretBase32, unixSecond) {
  try {
    const keyBytes = base32Decode(secretBase32);
    if (keyBytes.length === 0) return '------';
    const counter = Math.floor(unixSecond / 30);
    const msg = counterToBytes(counter);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false, ['sign']
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
    // 动态截断:取最后 1 字节的低 4 位作为 offset
    const offset = sig[sig.length - 1] & 0x0f;
    const bin = ((sig[offset] & 0x7f) << 24) |
                ((sig[offset + 1] & 0xff) << 16) |
                ((sig[offset + 2] & 0xff) << 8) |
                 (sig[offset + 3] & 0xff);
    return String(bin % 1000000).padStart(6, '0');
  } catch (e) {
    return '------';
  }
}

function useTick30() {
  // 每秒更新一次剩余秒数;每 30 秒 tick + 1
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const tick = Math.floor(now / 30000);
  const rem = 30 - Math.floor((now / 1000) % 30);
  return { tick, rem, unixSecond: Math.floor(now / 1000) };
}

// 通过 OTPController 生成 OTP；tick 变化时重新请求，避免本地密钥状态与后端不一致。
function useOtpMap(keys, tick, unixSecond) {
  const [map, setMap] = React.useState({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = Array.isArray(keys) ? keys : [];
      const entries = await Promise.all(list.map(async k => {
        try {
          const response = await window.ociServices.mfaBackup.generateOtp({ secretKey: k.secret });
          const value = response?.otpCode || response?.otp || response?.code || response?.data?.otp || response?.data || '';
          return [k.id, String(value || '------')];
        } catch (_) { return [k.id, '------']; }
      }));
      if (!cancelled) setMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // 只在 tick(30 秒边界) 或 keys 数组变化时重算
  }, [tick, keys]);
  return map;
}

function BackendQr({ qrCode, size = 40 }) {
  if (!qrCode) return <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>—</span>;
  const src = String(qrCode).startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
  return <img src={src} width={size} height={size} alt="MFA QR" style={{ borderRadius: 4, background: '#fff', display: 'block' }} />;
}

// 添加 MFA 密钥弹窗 Body（支持智能解析与第五章前置校验）
function MfaAddModalBody({ onSaved, onClose }) {
  const { t: tr } = useT();
  const shell = useShell();
  const [name, setName] = React.useState('');
  const [issuer, setIssuer] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [otpauthUrl, setOtpauthUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const handleUrlChange = (v) => {
    setOtpauthUrl(v);
    const trimmed = v.trim();
    if (trimmed.toLowerCase().startsWith('otpauth://')) {
      try {
        const u = new URL(trimmed);
        const s = u.searchParams.get('secret');
        const is = u.searchParams.get('issuer');
        let n = decodeURIComponent(u.pathname.replace(/^\/\/?(totp|hotp)\/?/i, ''));
        if (n.includes(':')) {
          const parts = n.split(':');
          if (!is) setIssuer(parts[0]);
          n = parts[1];
        }
        if (n && !name) setName(n);
        if (is) setIssuer(is);
        if (s) setSecret(s);
        shell.showToast('已自动识别提取密钥与账号名称', { kind: 'success' });
      } catch (_) {}
    }
  };

  const canSave = Boolean(secret.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
      const cleanName = name.trim() || `${Date.now()}`;
      await window.ociServices.mfaBackup.saveSecret({
        keyName: cleanName,
        secretKey: cleanSecret,
        issuer: issuer.trim() || 'mfa-oci-pool',
      });
      shell.showToast(tr('mfa.added') || 'MFA 密钥添加成功', { kind: 'success' });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      shell.showToast(e.message || (tr('mfa.add.fail') || '添加失败'), { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
        <ToolFormRow label="智能粘贴链接" hint="支持直接粘贴 otpauth://totp/... 链接自动提取参数">
          <ToolInput
            value={otpauthUrl}
            onChange={handleUrlChange}
            placeholder="粘贴 otpauth://totp/... 快速填入"
            mono
          />
        </ToolFormRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ToolFormRow label={tr('mfa.form.name') || '账号名称'}>
            <ToolInput value={name} onChange={setName} placeholder={tr('mfa.form.namePh') || '留空则使用时间戳'} />
          </ToolFormRow>
          <ToolFormRow label={tr('mfa.form.issuer') || '发行方'}>
            <ToolInput value={issuer} onChange={setIssuer} placeholder="Google · GitHub · Aliyun" />
          </ToolFormRow>
        </div>

        <ToolFormRow label={tr('mfa.form.secret') || '密钥 (Base32)'} required hint={tr('mfa.secret.hint') || '支持输入 16 位或 32 位 Base32 格式密钥'}>
          <ToolInput
            value={secret}
            onChange={setSecret}
            placeholder={tr('mfa.form.secretPh') || '例如 JBSWY3DPEHPK3PXP'}
            mono
          />
        </ToolFormRow>
      </div>

      <div style={{
        padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
      }}>
        <Button variant="secondary" size="md" onClick={onClose}>取消</Button>
        <Button variant="primary" size="md" icon="save" onClick={handleSave} disabled={!canSave} loading={saving}>
          保存密钥
        </Button>
      </div>
    </div>
  );
}

// 二维码大图预览弹窗 Body（100% 对齐客户端 MfaQrPreviewSheet：165×165 缩略图、提示文案、完成按钮）
function MfaQrModalBody({ row, onClose }) {
  const shell = useShell();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!row?.secret) return;
    navigator.clipboard?.writeText(row.secret);
    setCopied(true);
    shell.showToast('已复制密钥', { kind: 'success' });
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 16px', gap: 12 }}>
      <div style={{
        padding: 6, background: '#fff', borderRadius: 8, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)', display: 'inline-flex',
      }}>
        <BackendQr qrCode={row.qrCode} size={165} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg-0)' }}>{row.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>发行方：{row.issuer || 'mfa-oci-pool'}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>请使用手机 Authenticator App 对准屏幕扫描</div>
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <Button variant="outline" size="sm" icon={copied ? 'check' : 'copy'} onClick={handleCopy}>
          {copied ? '已复制密钥' : '复制密钥'}
        </Button>
        <Button variant="primary" size="sm" onClick={onClose}>完成</Button>
      </div>
    </div>
  );
}

function MfaBackupPage() {
  const { t: tr } = useT();
  const shell = useShell();
  const [keys, setKeys] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [reveal, setReveal] = React.useState({}); // id -> bool
  const [copiedOtpId, setCopiedOtpId] = React.useState(null);
  const { tick, rem, unixSecond } = useTick30();
  const otpMap = useOtpMap(keys, tick, unixSecond);

  const loadKeys = React.useCallback(async () => {
    setLoading(true);
    setKeys([]); // 严格清空旧数据，杜绝旧数据与 loading 共存！
    try {
      const res = await window.ociServices.mfaBackup.listKeys();
      const raw = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
      const normalized = raw.map((item, idx) => ({
        id: item.id || `${item.keyName || item.name || idx}`,
        name: item.name || item.keyName || '',
        secret: item.secret || item.secretKey || '',
        issuer: item.issuer || 'mfa-oci-pool',
        qrCode: item.qrCode || '',
      }));
      setKeys(normalized);
    } catch (e) {
      shell.showToast(tr('mfa.load.fail').replace('{err}', e.message || e), { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [shell, tr]);

  React.useEffect(() => { loadKeys(); }, [loadKeys]);

  const shown = React.useMemo(() => {
    if (!q.trim()) return keys;
    const k = q.trim().toLowerCase();
    return keys.filter(x => (x.name || '').toLowerCase().includes(k) || (x.issuer || '').toLowerCase().includes(k));
  }, [keys, q]);

  const openAddModal = () => {
    shell.openModal({
      title: tr('mfa.form.title') || '添加 MFA 密钥',
      subtitle: '支持 Base32 密钥录入与 otpauth 智能解析',
      icon: 'lock',
      iconColor: 'var(--accent)',
      size: 'md',
      body: <MfaAddModalBody onSaved={loadKeys} onClose={() => shell.closeModal()} />,
      footer: null,
    });
  };

  const openQrModal = (k) => {
    shell.openModal({
      title: 'MFA 二维码扫描',
      subtitle: '请使用 Authenticator App 扫描',
      icon: 'qrcode',
      iconColor: 'var(--accent)',
      size: 'sm',
      body: <MfaQrModalBody row={k} onClose={() => shell.closeModal()} />,
      footer: null,
    });
  };

  const copyOtp = (row) => {
    const code = otpMap[row.id] || '';
    if (!code || code === '------') return;
    navigator.clipboard?.writeText(code);
    setCopiedOtpId(row.id);
    shell.showToast(`已复制动态码 ${code}`, { kind: 'success' });
    setTimeout(() => setCopiedOtpId(null), 1200);
  };

  const copySecret = (secret) => {
    if (!secret) return;
    navigator.clipboard?.writeText(secret);
    shell.showToast(tr('mfa.secret.copied') || '已复制密钥', { kind: 'success' });
  };

  const del = (row) => {
    shell.confirmModal({
      title: tr('mfa.delete.confirm.title') || '删除 MFA 密钥',
      message: `确定要删除 MFA 密钥「${row.name}」吗？删除后将无法恢复动态口令！`,
      danger: true,
      onConfirm: async () => {
        try {
          await window.ociServices.mfaBackup.deleteKey({ keyName: row.name });
          await loadKeys();
          shell.showToast('已删除密钥', { kind: 'success' });
        } catch (e) {
          shell.showToast(tr('mfa.delete.fail').replace('{err}', e.message || e), { kind: 'error' });
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 12 }}>
      {/* 顶部 PageHeader：100% 对齐客户端图标、标题、副标题与按钮顺序 */}
      <PageHeader
        title={tr('mfa.title') || 'MFA 密钥备份'}
        subtitle={`${keys.length} 个两步验证密钥`}
        icon="smartphone"
        iconColor="var(--accent)"
        actions={<>
          <Button variant="primary" size="sm" icon="plus" onClick={openAddModal}>{tr('mfa.action.add') || '添加密钥'}</Button>
          <Button variant="outline" size="sm" icon="download" onClick={async () => {
            try {
              const blob = await window.ociServices.mfaBackup.exportData();
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'otp_keys.csv'; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 0); shell.showToast(tr('mfa.export.ok') || '已导出全部密钥', { kind: 'success' });
            } catch (e) { shell.showToast(tr('mig.export.fail').replace('{err}', e.message || e), { kind: 'error' }); }
          }}>{tr('mfa.action.export') || '导出全部'}</Button>
          <Button variant="outline" size="sm" icon="refresh-cw" onClick={loadKeys} loading={loading}>刷新</Button>
        </>}
      />

      {/* 顶部常驻控制台：左定宽搜索框 + 右 30 秒平滑倒计时进度条与微胶囊（100% 对齐客户端） */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ width: 220 }}>
          <SearchInput placeholder={tr('mfa.searchPh') || '按名称或发行方搜索…'} value={q} onChange={setQ} size="sm" width="100%" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-2)' }}>
            <Icon name="clock" size={13} style={{ color: 'var(--fg-3)' }} />
            <span style={{ fontSize: 11.5 }}>{tr('mfa.currentOtpLeft') || '动态码刷新'}</span>
          </div>
          <div style={{
            width: 110, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${(rem / 30) * 100}%`, height: '100%',
              background: rem <= 5 ? 'var(--danger)' : 'var(--accent)',
              transition: 'width 900ms linear',
            }} />
          </div>
          <span className="mono num" style={{
            padding: '1.5px 8px', borderRadius: 999,
            background: rem <= 5 ? 'var(--danger-soft)' : 'var(--accent-soft)',
            color: rem <= 5 ? 'var(--danger)' : 'var(--accent)',
            fontSize: 11, fontWeight: 700,
          }}>{rem}s</span>
        </div>
      </div>

      {/* 核心表格区域（100% 对齐客户端：表头独立置顶常驻 + 列宽比例均衡 + 全列居中对齐） */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
      }}>
        {/* 1. 表头独立置顶常驻 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(170px, 28fr) minmax(130px, 22fr) minmax(280px, 50fr) 85px 160px 80px',
          padding: '8px 14px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>账号</div>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>发行方</div>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>密钥</div>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>二维码</div>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>当前 OTP</div>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)' }}>操作</div>
        </div>

        {/* 2. 表体内容区（滚动数据 / 居中全屏 Loading / 空态） */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240, gap: 12, color: 'var(--fg-3)' }}>
              <div className="spinner" style={{ width: 22, height: 22 }} />
              <div style={{ fontSize: 12 }}>正在加载 MFA 密钥…</div>
            </div>
          ) : shown.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240, gap: 12, color: 'var(--fg-3)' }}>
              <Icon name="key" size={34} style={{ color: 'var(--fg-3)', opacity: 0.5 }} />
              <div style={{ fontSize: 12.5 }}>{q.trim() ? '无匹配结果' : '暂无 MFA 密钥 · 点右上「添加密钥」开始'}</div>
            </div>
          ) : (
            shown.map((k) => {
              const otp = otpMap[k.id] || '------';
              const isCopied = copiedOtpId === k.id;
              return (
                <div key={k.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(170px, 28fr) minmax(130px, 22fr) minmax(280px, 50fr) 85px 160px 80px',
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  minHeight: 52,
                  boxSizing: 'border-box',
                  transition: 'background 120ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* 1. 账号 - 适度比例 + 居中截断 + 移除圆点 */}
                  <div style={{ textAlign: 'center', padding: '0 8px', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.name}>
                      {k.name}
                    </span>
                  </div>

                  {/* 2. 发行方 - 主题色胶囊居中 */}
                  <div style={{ textAlign: 'center', padding: '0 8px', overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '2.5px 8px', borderRadius: 4,
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      display: 'inline-block', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={k.issuer || 'mfa-oci-pool'}>
                      {k.issuer || 'mfa-oci-pool'}
                    </span>
                  </div>

                  {/* 3. 密钥 - 三段式微容器居中，充分宽度展示 32 位 Base32 密钥 */}
                  <div style={{ textAlign: 'center', padding: '0 8px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', width: '100%', maxWidth: 420, height: 28,
                      background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, padding: '0 4px',
                      boxSizing: 'border-box',
                    }}>
                      <button
                        onClick={() => setReveal(s => ({ ...s, [k.id]: !s[k.id] }))}
                        title={reveal[k.id] ? '隐藏密钥' : '显示密钥'}
                        style={{
                          width: 26, height: 26, background: 'transparent', border: 'none',
                          color: 'var(--fg-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 4, flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-1)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-3)'}
                      >
                        <Icon name={reveal[k.id] ? 'eye-off' : 'eye'} size={11.5} />
                      </button>

                      <div
                        style={{
                          flex: 1, minWidth: 0, padding: '0 6px', textAlign: 'center',
                          fontFamily: 'var(--font-mono)', fontSize: 11.5,
                          color: reveal[k.id] ? 'var(--fg-0)' : 'var(--fg-3)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={k.secret}
                      >
                        {reveal[k.id] ? k.secret : '••••••••••••••••'}
                      </div>

                      <button
                        onClick={() => copySecret(k.secret)}
                        title="复制密钥"
                        style={{
                          width: 26, height: 26, background: 'transparent', border: 'none',
                          color: 'var(--fg-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 4, flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-3)' }}
                      >
                        <Icon name="copy" size={11.5} />
                      </button>
                    </div>
                  </div>

                  {/* 4. 二维码 - 居中缩略图 */}
                  <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <div
                      onClick={() => openQrModal(k)}
                      style={{
                        cursor: 'pointer', width: 36, height: 36, borderRadius: 4, overflow: 'hidden',
                        border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="点击放大二维码扫码"
                    >
                      <BackendQr qrCode={k.qrCode} size={36} />
                    </div>
                  </div>

                  {/* 5. 当前 OTP - 16px 粗体等宽 + 倒计时微胶囊 + 点击复制 */}
                  <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => copyOtp(k)}
                      title="点击复制动态码"
                      className="mono num"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 9px', borderRadius: 6,
                        background: isCopied ? 'var(--accent-soft)' : 'var(--bg-2)',
                        border: isCopied ? '1px solid var(--accent)' : '1px solid var(--border)',
                        color: isCopied ? 'var(--accent)' : 'var(--fg-0)',
                        cursor: 'pointer', transition: 'all 120ms',
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.5, fontFamily: 'var(--font-mono)' }}>
                        {otp.length === 6 ? `${otp.slice(0, 3)} ${otp.slice(3)}` : otp}
                      </span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 600, padding: '1.5px 5px', borderRadius: 999,
                        background: rem <= 5 ? 'var(--danger-soft)' : 'var(--bg-3)',
                        color: rem <= 5 ? 'var(--danger)' : 'var(--fg-2)',
                        minWidth: 20, textAlign: 'center',
                      }}>
                        {rem}s
                      </span>
                    </button>
                  </div>

                  {/* 6. 操作 - 28x28 居中危险红删除按钮 */}
                  <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                    <button
                      title="删除密钥"
                      onClick={() => del(k)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--danger-soft)', border: 'none',
                        color: 'var(--danger)', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name="trash-2" size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ClockPanel · 顶部展开的时钟面板(对齐原项目 clockPanel)
//   系统时间(浏览器本地) / 北京时间(Asia/Shanghai) / 时差(单位:秒)
// ═══════════════════════════════════════════════════════════════════════
function ClockPanel({ nowTick }) {
  const d = new Date(nowTick);
  // 系统时间(浏览器本地)
  const sysZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const fmtSys = new Intl.DateTimeFormat('en-CA', {
    timeZone: sysZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(',', '');
  // 北京时间
  const fmtCn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d).replace(',', '');

  // 时差(秒) · 用两地时区 offset 差值
  const offsetOf = (tz) => {
    // 通过对齐日期计算 offset 分钟数
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(d)
      .find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = s.match(/GMT([+-])(\d{1,2}):?(\d{0,2})/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10));
  };
  const diffMin = offsetOf(sysZone) - offsetOf('Asia/Shanghai');
  const diffLabel = diffMin === 0
    ? tr('clock.same')
    : tr('clock.diff').replace('{sign}', diffMin > 0 ? '+' : '').replace('{hours}', Math.round(diffMin / 60 * 10) / 10).replace('{dir}', diffMin > 0 ? tr('clock.later') : tr('clock.earlier'));

  const Clock = ({ label, subLabel, timeStr, color }) => {
    const [date, time] = timeStr.split(' ');
    return (
      <div style={{
        flex: 1, minWidth: 0,
        padding: 14, borderRadius: 8,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 3,
          background: color,
        }} />
        <div style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={11} style={{ color }} /> {label}
        </div>
        <div className="mono num" style={{ fontSize: 22, color: 'var(--fg-0)', fontWeight: 600, lineHeight: 1.15, letterSpacing: 1 }}>
          {time}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4, letterSpacing: 0.5 }}>
          {date} · {subLabel}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'stretch', flexShrink: 0,
    }}>
      <Clock label={tr("clock.system")}   subLabel={sysZone}       timeStr={fmtSys} color="var(--info)"   />
      <Clock label={tr("clock.beijing")}   subLabel="Asia/Shanghai"  timeStr={fmtCn}  color="var(--accent)" />
      <div style={{
        flex: 1, minWidth: 0,
        padding: 14, borderRadius: 8,
        background: 'linear-gradient(135deg, var(--violet-soft), var(--bg-2))',
        border: '1px solid var(--violet)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="git-compare" size={11} style={{ color: 'var(--violet)' }} /> {tr('clock.diffTitle')}
        </div>
        <div className="mono num" style={{ fontSize: 22, color: 'var(--fg-0)', fontWeight: 600, lineHeight: 1.15 }}>
          {diffMin === 0 ? '00:00' : `${diffMin > 0 ? '+' : '-'}${String(Math.floor(Math.abs(diffMin)/60)).padStart(2,'0')}:${String(Math.abs(diffMin)%60).padStart(2,'0')}`}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
          {diffLabel}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AiConfigModalBody · 双面板(对齐原项目 aiConfigModal · openAiConfigModal)
//   顶部:租户选择
//   左:可用 AI 模型列表(点 + 添加)
//   右:已配置模型(可切 enabled / 删除)
// ═══════════════════════════════════════════════════════════════════════
function AiConfigModalBody() {
  const shell = useShell();
  const [tenants, setTenants] = React.useState([]);
  const [configs, setConfigs] = React.useState([]);
  const [tenantId, setTenantId] = React.useState('');
  const [available, setAvailable] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const loadConfigs = React.useCallback(async () => {
    try {
      const arr = await window.ociServices.ai.configs();
      setConfigs(Array.isArray(arr) ? arr : []);
    } catch (_) {}
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tenRes, cfgRes] = await Promise.all([
          window.ociServices.ai.tenants(),
          window.ociServices.ai.configs(),
        ]);
        const tArr = Array.isArray(tenRes) ? tenRes : [];
        const cArr = Array.isArray(cfgRes) ? cfgRes : [];
        if (!alive) return;
        setTenants(tArr.map(t => ({ ...t, id: String(t.id) })));
        setConfigs(cArr);
        if (tArr.length) setTenantId(String(tArr[0].id));
      } catch (_) {}
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const colorFor = (s) => {
    const c = (s || '').toLowerCase();
    if (/openai|gpt/.test(c)) return '#10a37f';
    if (/anthropic|claude/.test(c)) return '#c96442';
    if (/google|gemini/.test(c)) return '#4285f4';
    if (/qwen|alibaba/.test(c)) return '#ff6a00';
    if (/deepseek/.test(c)) return '#4d6bfe';
    if (/moonshot|kimi/.test(c)) return '#5b3ff0';
    if (/cohere/.test(c)) return '#d97757';
    if (/meta|llama/.test(c)) return '#0668e1';
    return '#7c7ce0';
  };
  const vendorOf = (s) => (s || 'OCI');

  React.useEffect(() => {
    if (!tenantId) { setAvailable([]); return; }
    let alive = true;
    window.ociServices.ai.modelsByTenant({ tenantId })
      .then(arr => {
        if (!alive) return;
        setAvailable((Array.isArray(arr) ? arr : []).map(m => ({
          id: m.id,
          label: m.name || m.modelName || m.id,
          vendor: m.provider || 'OCI',
          desc: m.description || m.name || '',
        })));
      })
      .catch(() => { if (alive) setAvailable([]); });
    return () => { alive = false; };
  }, [tenantId]);

  const tenant = tenants.find(t => String(t.id) === String(tenantId));
  const myConfigured = configs.filter(c => String(c.tenantId) === String(tenantId));

  const addModel = async (m) => {
    if (myConfigured.some(x => x.modelId === m.id)) { shell.showToast(tr('ai.dup').replace('{label}', m.label), { kind: 'warn' }); return; }
    try {
      await window.ociServices.ai.save({ tenantId, modelId: m.id, modelName: m.label, provider: m.vendor, enabled: true, cloudType: 1, userName: '' });
      await loadConfigs();
      shell.showToast(tr('ai.add.ok').replace('{label}', m.label), { kind: 'success', duration: 1500 });
    } catch (e) { shell.showToast(e.message || tr('ai.save.fail'), { kind: 'error' }); }
  };
  const toggleModel = async (cm) => {
    try {
      await window.ociServices.ai.save({ id: cm.id, enabled: !cm.enabled });
      await loadConfigs();
    } catch (e) { shell.showToast(e.message || tr('ai.toggle.fail'), { kind: 'error' }); }
  };
  const removeModel = async (cm) => {
    try {
      await window.ociServices.ai.remove({ id: cm.id });
      await loadConfigs();
      shell.showToast(tr('ai.removed'), { kind: 'success', duration: 1500 });
    } catch (e) { shell.showToast(e.message || tr('ai.delete.fail'), { kind: 'error' }); }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-3)', fontSize:12 }}>
        <Icon name="loader" size={16} /> {tr('ai.config.loading')}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 480 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--border)',
      }}>
        <Icon name="building-2" size={13} style={{ color: 'var(--info)' }} />
        <span style={{ fontSize: 12, color: 'var(--fg-2)', flexShrink: 0 }}>{tr('ai.selectTenant')}</span>
        <CustomDropdown value={tenantId} onChange={e => setTenantId(e)} height={32} width="100%">
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </CustomDropdown>
        {tenant && (
          <span className="mono" style={{
            fontSize: 10.5, padding: '2px 8px', borderRadius: 3,
            background: 'var(--info-soft)', color: 'var(--info)', fontWeight: 500,
          }}>{getTenantRegion(tenant) || tr('ai.global')}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="bot" size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('ai.available')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('ai.availableCount').replace('{n}', available.length)}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {available.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--fg-3)', fontSize:12 }}>{tr('ai.noneAvailable')}</div>
            ) : available.map(m => {
              const color = colorFor(m.vendor);
              const already = myConfigured.some(x => x.modelId === m.id);
              return (
                <div key={m.id} style={{
                  padding: 10, marginBottom: 6, borderRadius: 5,
                  background: 'var(--bg-1)', border: '1px solid var(--border)',
                  display: 'flex', gap: 10, alignItems: 'center',
                  opacity: already ? 0.55 : 1, transition: 'all 120ms',
                }}
                  onMouseEnter={e => !already && (e.currentTarget.style.borderColor = color)}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: color + '22', color: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                  }}>{(m.vendor || 'O')[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.label}
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-3)', fontWeight: 400 }}>{m.vendor}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{m.desc}</div>
                  </div>
                  <button onClick={() => addModel(m)} disabled={already}
                    title={already ? tr('ai.added') : tr('ai.addToTenant')}
                    style={{
                      width: 28, height: 28, borderRadius: 4,
                      background: already ? 'var(--bg-3)' : color + '22',
                      color: already ? 'var(--fg-3)' : color,
                      border: '1px solid ' + (already ? 'var(--border)' : color + '55'),
                      cursor: already ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={already ? 'check' : 'plus'} size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="settings-2" size={13} style={{ color: 'var(--info)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('ai.configured')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('ai.availableCount').replace('{n}', myConfigured.length)}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {myConfigured.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 20px', color: 'var(--fg-3)', fontSize: 12,
              }}>
                <Icon name="inbox" size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
                <div>{tr('ai.noneConfigured')}</div>
                <div style={{ fontSize: 10.5, marginTop: 4 }}>{tr('ai.addHint')}</div>
              </div>
            ) : myConfigured.map(cm => {
              const m = available.find(x => x.id === cm.modelId);
              const color = colorFor(cm.provider || (m && m.vendor));
              const label = cm.modelName || (m && m.label) || cm.modelId;
              const vendor = cm.provider || (m && m.vendor) || 'OCI';
              return (
                <div key={cm.id} style={{
                  padding: 10, marginBottom: 6, borderRadius: 5,
                  background: 'var(--bg-1)', border: '1px solid ' + (cm.enabled ? 'var(--accent)' : 'var(--border)'),
                  display: 'flex', gap: 10, alignItems: 'center',
                  transition: 'border-color 120ms',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: color + '22', color: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                  }}>{vendor[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg-0)' }}>{label}</div>
                    <div style={{ fontSize: 10.5, color: cm.enabled ? 'var(--accent)' : 'var(--fg-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cm.enabled ? 'var(--accent)' : 'var(--fg-3)' }} />
                      {cm.enabled ? tr('ai.enabled') : tr('ai.disabled')}
                    </div>
                  </div>
                  <ToolSwitch checked={cm.enabled} onChange={() => toggleModel(cm)} />
                  <button onClick={() => removeModel(cm)} title={tr("ai.remove")}
                    style={{
                      width: 26, height: 26, borderRadius: 4,
                      background: 'var(--bg-2)', border: '1px solid var(--border)',
                      color: 'var(--danger)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name="trash-2" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{
        padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 5, fontSize: 11, color: 'var(--fg-3)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="info" size={11} />
        <span>{tr('ai.footer')}</span>
      </div>
    </div>
  );
}

Object.assign(window, { NotifyMgmtPage, MemPage, MigPage, MfaBackupPage, ClockPanel, AiConfigModalBody });
