// ═══════════════════════════════════════════════════════════════════════
// 「我的工具」4 子菜单 · 严格对齐原项目
//   1. 通知管理 (NotifyMgmtPage) → notification_settings.ftl · /system/notifySettings
//   2. 笔记管理 (MemPage)         → memo.ftl                 · /system/memPage
//   3. 数据迁移 (MigPage)         → migration.ftl            · /migration/migPage
//   4. MFA 备份 (MfaBackupPage)   → mfa.ftl                  · /mfa/page
// ═══════════════════════════════════════════════════════════════════════

// ─── 通用小组件:设置卡片 (与 page-misc.jsx SettingsCard 保持一致的视觉) ────
function ToolSettingsCard({ title, icon, iconColor = 'var(--fg-2)', actions, children, footer, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 8, overflow: 'hidden', flexShrink: 0,
      ...style,
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <Icon name={icon} size={13} style={{ color: iconColor }} />}
          {title}
        </div>
        {actions}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
      {footer && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─── FormRow: 通用双列表单行 ────────────────────────────────────────
function ToolFormRow({ label, hint, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12, ...style }}>
      <label style={{ fontSize: 11.5, color: 'var(--fg-2)', fontWeight: 500 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{hint}</div>}
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

// ─── Text Input: 极简一致的输入框 ────────────────────────────────
function ToolInput({ value, onChange, placeholder, type = 'text', mono = false, style = {}, ...rest }) {
  const [reveal, setReveal] = React.useState(false);
  const isPass = type === 'password';
  const effType = isPass && reveal ? 'text' : type;
  const inputStyle = {
    width: '100%',
    padding: isPass ? '7px 36px 7px 10px' : '7px 10px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: 'var(--fg-0)',
    fontFamily: mono || isPass ? 'var(--font-mono)' : 'inherit',
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 120ms',
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
      style={inputStyle}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...rest}
    />
  );
  if (!isPass) return inputEl;
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {inputEl}
      <button type="button"
        onClick={() => setReveal(!reveal)}
        tabIndex={-1}
        title={reveal ? tr('common.hide') : tr('common.show')}
        style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          width: 26, height: 26, padding: 0,
          background: 'transparent', color: 'var(--fg-2)',
          border: 'none', cursor: 'pointer', borderRadius: 3,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name={reveal ? 'eye-off' : 'eye'} size={13} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. NotifyMgmtPage 通知管理
//   对齐 notification_settings.ftl:
//     ┌ 顶部:通知任务(执行时间 hourPicker + 3 checkbox + 密钥)
//     └ 下方 grid 5 张通道卡(Telegram / TG Proxy / Bark / DingTalk / Feishu)
// ═══════════════════════════════════════════════════════════════════════
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

  // 5 个通道 · 3 个影响登录验证(tg/dd/bark)的初始 enabled 从 localStorage 读,
  // 与 AuthPage 共享 → 通道开启后登录页会显示"消息验证码"步骤
  // (对齐原项目 LoginController.isMessageEnabled)
  const authCfg = (window.getAuthConfig && window.getAuthConfig()) || { channels: {}, mfaEnabled: false };
  const [tg, setTg]         = React.useState({ enabled: authCfg.channels.tg  ?? false, botToken: '', chatId: '', chatName: '' });
  const [tgProxy, setTgProxy] = React.useState({ enabled: false, type: 'SOCKS5', host: '', port: '1080', username: '', password: '' });
  const [bark, setBark]     = React.useState({ enabled: authCfg.channels.bark ?? false, url: '', deviceKey: '' });
  const [dd, setDd]         = React.useState({ enabled: authCfg.channels.dd   ?? false, webhook: '', secret: '' });
  const [fs, setFs]         = React.useState({ enabled: false, webhook: '', secret: '' });

  // 通道必填字段是否齐全（必填为空时禁用「测试发送 / 保存配置」）
  const tgReady = !!(tg.botToken.trim() && tg.chatId.trim());
  const tgProxyReady = !!(tgProxy.host.trim() && tgProxy.port.trim());
  const barkReady = !!bark.deviceKey.trim();
  const ddReady = !!dd.webhook.trim();
  const fsReady = !!fs.webhook.trim();

  // ── 真实后端 · 加载通知配置(填充表单 · 替代 mock 占位) ──
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
    try { await persistChannel(name); shell.showToast(tr('notify.saved').replace('{name}', name), { kind: 'success' }); }
    catch (e) { shell.showToast(tr('notify.save.fail').replace('{name}', name).replace('{err}', e.message || e), { kind: 'error' }); }
  };

  const testChannel = async (name) => {
    try {
      // 测试发送走"已保存配置" → 先保存当前表单值再测试,保证用刚填的 Token/ChatId
      await persistChannel(name);
      if (name === 'Telegram') await window.ociServices.notify.testTelegram();
      else if (name === 'DingTalk') await window.ociServices.notify.testDingTalk();
      else if (name === 'Bark') await window.ociServices.notify.testBark();
      else if (name === 'Feishu') await window.ociServices.notify.testFeishu();
      else if (name === 'TG Proxy') {
        const result = await window.ociServices.notify.testProxy({ enabled: tgProxy.enabled, type: tgProxy.type, host: tgProxy.host, port: parseInt(tgProxy.port, 10) || 0, username: tgProxy.username, password: tgProxy.password });
        if (!result?.success) throw new Error(result?.message || tr('notify.proxy.test.fail'));
        shell.showToast(tr('notify.conn.ok').replace('{name}', name), { kind: 'success' });
        return;
      }
      shell.showToast(tr('notify.sent.toast').replace('{name}', name), { kind: 'success' });
    } catch (e) {
      shell.showToast(tr('notify.test.fail').replace('{name}', name).replace('{err}', e.message || e), { kind: 'error' });
    }
  };

  // 定时通知任务保存
  const saveTask = async () => {
    if (!(task.account || task.bootLog || task.cost)) {
      shell.showToast(tr('notify.select.required'), { kind: 'warn' });
      return;
    }
    try {
      await window.ociServices.notify.updateTask({ enabled: task.enabled, executeHour: task.hour, notificationSecret: task.secret || null, enableAccountCheck: task.account, enableBootLog: task.bootLog, enableCostCheck: task.cost });
      shell.showToast(task.enabled ? tr('notify.task.saved') : tr('notify.task.disabled.saved'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('notify.task.save.fail').replace('{err}', e.message || e), { kind: 'error' }); }
  };

  // ── 顶部时钟面板 · 系统时间 / 北京时间 / 时差(对齐原项目 clockPanel) ──
  const [clocksOpen, setClocksOpen] = React.useState(false);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!clocksOpen) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [clocksOpen]);

  // 上传 AI 配置 Modal(对齐原项目 aiConfigModal:双面板)
  const openAiConfigModal = () => {

    shell.openModal({
      title: tr('notify.tg.aiCfg'),
      subtitle: tr('notify.ai.subtitle'),
      icon: 'brain-circuit',
      iconColor: 'var(--orange)',
      size: 'xl',
      body: <AiConfigModalBody />,
      footer: null,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('nav.notifyMgmt')}
        subtitle={tr('notify.title')}
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

        {/* ══ 通知任务 ══ */}
        <ToolSettingsCard
          title={tr('notify.task.title')}
          icon="calendar-check"
          iconColor="var(--info)"
          actions={<ToolSwitch checked={task.enabled} onChange={v => setTask({ ...task, enabled: v })} />}
          footer={<Button variant="primary" size="sm" icon="save" onClick={saveTask} disabled={!(task.account || task.bootLog || task.cost)}>{tr('notify.action.save')}</Button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>

            {/* 执行时间(hour picker) */}
            <ToolFormRow label={tr('notify.task.everyDay')} hint={tr("notify.everyDay.hint")}>
              <div ref={hourRef} style={{ position: 'relative' }}>
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
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
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
            </ToolFormRow>

            {/* 项目 */}
            <ToolFormRow label={tr('notify.task.project')} hint={tr('notify.task.selectTip')}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap', padding: '4px 0' }}>
                {[
                  { key: 'account', label: tr('notify.task.account'), icon: 'user-check' },
                  { key: 'bootLog', label: tr('notify.task.bootLog'), icon: 'terminal' },
                  { key: 'cost',    label: tr('notify.task.cost'),    icon: 'dollar-sign' },
                ].map(it => (
                  <label key={it.key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 9px', borderRadius: 4,
                    background: task[it.key] ? 'var(--accent-soft)' : 'var(--bg-2)',
                    border: '1px solid ' + (task[it.key] ? 'var(--accent)' : 'var(--border)'),
                    cursor: 'pointer', fontSize: 11.5,
                    color: task[it.key] ? 'var(--accent)' : 'var(--fg-1)',
                    transition: 'all 100ms',
                  }}>
                    <input type="checkbox" checked={task[it.key]} onChange={e => setTask({ ...task, [it.key]: e.target.checked })}
                      style={{ display: 'none' }} />
                    <Icon name={it.icon} size={11} />
                    <span>{it.label}</span>
                  </label>
                ))}
              </div>
            </ToolFormRow>

            {/* 密钥 */}
            <ToolFormRow label={tr('notify.task.secret')} hint={tr('notify.task.secretPh')} style={{ gridColumn: '1 / -1' }}>
              <ToolInput value={task.secret} onChange={v => setTask({ ...task, secret: v })} mono />
            </ToolFormRow>
          </div>
        </ToolSettingsCard>

        {/* ══ 通知通道 · 5 卡 ══ */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="bell" size={14} style={{ color: 'var(--orange)' }} />
          {tr('notify.channel.title')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>

          {/* Telegram */}
          <ToolSettingsCard
            title={tr('notify.tg')} icon="send" iconColor="#0088cc"
            actions={<ToolSwitch checked={tg.enabled} onChange={v => setTg({ ...tg, enabled: v })} />}
            footer={<>
              <Button variant="info" size="sm" icon="send" onClick={() => testChannel('Telegram')} disabled={!tgReady}>{tr('notify.action.test')}</Button>
              <Button variant="outline" size="sm" icon="bot" onClick={() => shell.showToast(tr('notify.regBot.toast'), { kind: 'info' })}>{tr('notify.tg.regBot')}</Button>
              <Button variant="orange" size="sm" icon="brain-circuit" onClick={openAiConfigModal}>{tr('notify.tg.aiCfg')}</Button>
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Telegram')} disabled={!tgReady}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label="Bot Token" hint={tr("notify.tg.botFather")}>
              <ToolInput value={tg.botToken} onChange={v => setTg({ ...tg, botToken: v })} mono />
            </ToolFormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ToolFormRow label="Chat ID">
                <ToolInput value={tg.chatId} onChange={v => setTg({ ...tg, chatId: v })} mono />
              </ToolFormRow>
              <ToolFormRow label="Chat Name">
                <ToolInput value={tg.chatName} onChange={v => setTg({ ...tg, chatName: v })} />
              </ToolFormRow>
            </div>
          </ToolSettingsCard>

          {/* TG Proxy */}
          <ToolSettingsCard
            title={tr('notify.tg.proxy')} icon="globe" iconColor="var(--cyan)"
            actions={<ToolSwitch checked={tgProxy.enabled} onChange={v => setTgProxy({ ...tgProxy, enabled: v })} />}
            footer={<>
              <Button variant="info" size="sm" icon="wifi" onClick={() => testChannel('TG Proxy')} disabled={!tgProxyReady}>{tr('notify.action.test')}</Button>
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('TG Proxy')} disabled={!tgProxyReady}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label={tr('notify.tg.proxyType')}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['HTTP', 'HTTPS', 'SOCKS5'].map(t => (
                  <button key={t} onClick={() => setTgProxy({ ...tgProxy, type: t })}
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
              <ToolFormRow label={tr('notify.tg.address')}>
                <ToolInput value={tgProxy.host} onChange={v => setTgProxy({ ...tgProxy, host: v })} placeholder="127.0.0.1" mono />
              </ToolFormRow>
              <ToolFormRow label={tr('notify.tg.port')}>
                <ToolInput value={tgProxy.port} onChange={v => setTgProxy({ ...tgProxy, port: v })} mono />
              </ToolFormRow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ToolFormRow label={tr("notify.tg.userOptional")}>
                <ToolInput value={tgProxy.username} onChange={v => setTgProxy({ ...tgProxy, username: v })} placeholder={tr("notify.tg.noAuth")} />
              </ToolFormRow>
              <ToolFormRow label={tr("notify.tg.pwdOptional")}>
                <ToolInput value={tgProxy.password} onChange={v => setTgProxy({ ...tgProxy, password: v })} type="password" />
              </ToolFormRow>
            </div>
          </ToolSettingsCard>

          {/* Bark */}
          <ToolSettingsCard
            title={tr('notify.bark')} icon="bell" iconColor="var(--danger)"
            actions={<ToolSwitch checked={bark.enabled} onChange={v => setBark({ ...bark, enabled: v })} />}
            footer={<>
              <Button variant="info" size="sm" icon="send" onClick={() => testChannel('Bark')} disabled={!barkReady}>{tr('notify.action.test')}</Button>
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Bark')} disabled={!barkReady}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label="Bark URL" hint={tr("notify.bark.url.hint")}>
              <ToolInput value={bark.url} onChange={v => setBark({ ...bark, url: v })} mono />
            </ToolFormRow>
            <ToolFormRow label={tr('notify.deviceKey')} hint={tr("notify.bark.deviceHint")}>
              <ToolInput value={bark.deviceKey} onChange={v => setBark({ ...bark, deviceKey: v })} placeholder="jY3xxxxxxxxx" mono />
            </ToolFormRow>
          </ToolSettingsCard>

          {/* DingTalk */}
          <ToolSettingsCard
            title={tr('notify.dd')} icon="message-square" iconColor="#3296FA"
            actions={<ToolSwitch checked={dd.enabled} onChange={v => setDd({ ...dd, enabled: v })} />}
            footer={<>
              <Button variant="info" size="sm" icon="send" onClick={() => testChannel('DingTalk')} disabled={!ddReady}>{tr('notify.action.test')}</Button>
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('DingTalk')} disabled={!ddReady}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label={tr('notify.webhook')}>
              <ToolInput value={dd.webhook} onChange={v => setDd({ ...dd, webhook: v })} placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." mono />
            </ToolFormRow>
            <ToolFormRow label={tr('notify.secret')}>
              <ToolInput value={dd.secret} onChange={v => setDd({ ...dd, secret: v })} mono type="password" />
            </ToolFormRow>
          </ToolSettingsCard>

          {/* Feishu */}
          <ToolSettingsCard
            title={tr('notify.fs')} icon="message-square" iconColor="#00D6B9"
            actions={<ToolSwitch checked={fs.enabled} onChange={v => setFs({ ...fs, enabled: v })} />}
            footer={<>
              <Button variant="info" size="sm" icon="send" onClick={() => testChannel('Feishu')} disabled={!fsReady}>{tr('notify.action.test')}</Button>
              <Button variant="primary" size="sm" icon="save" onClick={() => saveChannel('Feishu')} disabled={!fsReady}>{tr('notify.action.save')}</Button>
            </>}
          >
            <ToolFormRow label={tr('notify.webhook')}>
              <ToolInput value={fs.webhook} onChange={v => setFs({ ...fs, webhook: v })} mono />
            </ToolFormRow>
            <ToolFormRow label={tr('notify.secret')}>
              <ToolInput value={fs.secret} onChange={v => setFs({ ...fs, secret: v })} mono type="password" />
            </ToolFormRow>
          </ToolSettingsCard>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. MemPage 笔记管理
//   对齐 memo.ftl:标题栏 + 编辑器面板(隐藏/展开) + 笔记网格
// ═══════════════════════════════════════════════════════════════════════
function MemPage() {
  const { t: tr } = useT();
  const shell = useShell();
  const [notes, setNotes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null); // 正在编辑的 note.id
  const [form, setForm] = React.useState({ title: '', summary: '', content: '' });
  const [filter, setFilter] = React.useState('all'); // all | recent
  const [q, setQ] = React.useState('');

  const loadNotes = React.useCallback(async () => {
    setLoading(true);
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
      setLoadError(error.message || tr('memo.load.fail'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadNotes(); }, [loadNotes]);

  const openEditor = (n) => {
    setEditing(n?.id ?? null);
    setForm({
      title: n?.title || '',
      summary: n?.summary || '',
      content: n?.content || '',
    });
    setEditorOpen(true);
  };
  const closeEditor = () => { setEditorOpen(false); setEditing(null); setForm({ title: '', summary: '', content: '' }); };

  const save = async () => {
    if (!form.title.trim()) { shell.showToast(tr('memo.title.required'), { kind: 'warn' }); return; }
    const payload = { title: form.title.trim(), summary: form.summary.trim(), content: form.content };
    try {
      if (editing != null) await window.ociServices.memo.update({ id: editing, ...payload });
      else await window.ociServices.memo.create(payload);
      await loadNotes();
      shell.showToast(editing != null ? tr('memo.updated') : tr('memo.saved'), { kind: 'success' });
      closeEditor();
    } catch (error) {
      shell.showToast(error.message || tr('memo.save.fail'), { kind: 'error' });
    }
  };

  const del = (n) => {
    shell.openConfirm({
      title: tr('memo.confirm.delete'),
      body: tr('memo.confirm.deleteBody'),
      danger: true,
      confirmText: tr('memo.btn.delete'),
      onConfirm: async () => {
        try {
          await window.ociServices.memo.remove({ id: n.id });
          setNotes(list => list.filter(x => x.id !== n.id));
          shell.showToast(tr('memo.deleted'), { kind: 'success' });
        } catch (error) {
          shell.showToast(error.message || tr('memo.delete.fail'), { kind: 'error' });
        }
      },
    });
  };

  const shown = React.useMemo(() => {
    let arr = notes;
    if (filter === 'recent') arr = [...arr].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter(n =>
        n.title.toLowerCase().includes(k) ||
        (n.summary || '').toLowerCase().includes(k));
    }
    return arr;
  }, [notes, filter, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('memo.title')}
        subtitle={tr('memo.count').replace('{n}', notes.length)}
        icon="book-open"
        iconColor="var(--info)"
        actions={<>
          <Button variant={editorOpen ? 'outline' : 'primary'} icon={editorOpen ? 'x' : 'plus'} size="sm"
            onClick={() => editorOpen ? closeEditor() : openEditor(null)}
          >
            {editorOpen ? tr('memo.close') : tr('memo.new')}
          </Button>
        </>}
      />

      {/* 编辑器面板 */}
      {editorOpen && (
        <ToolSettingsCard
          title={editing != null ? tr('memo.btn.edit') : tr('memo.new')}
          icon="pen-line"
          iconColor="var(--accent)"
          footer={<>
            <Button variant="ghost" size="sm" onClick={closeEditor}>{tr('memo.btn.cancel')}</Button>
            <Button variant="outline" size="sm" icon="eraser" onClick={() => setForm({ title: '', summary: '', content: '' })}>{tr('memo.btn.clear')}</Button>
            <Button variant="primary" size="sm" icon="save" onClick={save}>
              {editing != null ? tr('memo.btn.update') : tr('memo.btn.save')}
            </Button>
          </>}
        >
          <ToolFormRow label={tr('memo.form.title')}>
            <ToolInput value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder={tr('memo.form.titlePh')} />
          </ToolFormRow>
          <ToolFormRow label={tr('memo.form.summary')} hint={tr("memo.summary.hint")}>
            <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
              placeholder={tr('memo.form.summaryPh')} maxLength={200} rows={2}
              style={{
                width: '100%', padding: '7px 10px',
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5,
                color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 12, resize: 'vertical', outline: 'none',
              }} />
          </ToolFormRow>
          <ToolFormRow label={tr('memo.form.content')} hint={tr("memo.content.hint")}>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder={tr('memo.form.contentPh')} rows={8}
              style={{
                width: '100%', padding: 10,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 12, resize: 'vertical', outline: 'none',
                minHeight: 160,
              }} />
          </ToolFormRow>
        </ToolSettingsCard>
      )}

      {/* 过滤 + 搜索 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
              {[
            { k: 'all',    label: tr('memo.filter.all'),    icon: 'grid-3x3' },
            { k: 'recent', label: tr('memo.filter.recent'), icon: 'clock' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: '4px 10px', fontSize: 11.5, borderRadius: 4,
              background: filter === f.k ? 'var(--bg-1)' : 'transparent',
              color: filter === f.k ? 'var(--fg-0)' : 'var(--fg-2)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: filter === f.k ? 500 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name={f.icon} size={11} /> {f.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <SearchInput placeholder={tr('memo.searchPh')} value={q} onChange={setQ} width="100%" size="sm" />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--fg-3)' }}>
          {tr('memo.countLine').replace('{shown}', shown.length).replace('{total}', notes.length)}
        </div>
      </div>

      {/* 网格 */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        {loading ? (
          <div role="status" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{tr('memo.loading')}</div>
        ) : loadError ? (
          <div role="alert" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>{loadError}</div>
        ) : shown.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 20px', color: 'var(--fg-3)', fontSize: 13,
            border: '1px dashed var(--border)', borderRadius: 8,
          }}>
            <Icon name="sticky-note" size={40} style={{ color: 'var(--fg-3)', marginBottom: 10 }} />
            <div>{tr('memo.status.empty')}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {shown.map(n => (
              <div key={n.id} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 14, position: 'relative',
                transition: 'border-color 120ms, transform 120ms',
                display: 'flex', flexDirection: 'column', gap: 8,
                minHeight: 140,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.35 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.55, flex: 1, minHeight: 0,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {n.summary || <span style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>{tr('memo.noSummary')}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flex: 1 }}>{n.updated}</div>
                  <button title={tr('memo.btn.edit')} onClick={() => openEditor(n)} style={_iconBtnStyle('var(--info)')}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button title={tr('memo.btn.delete')} onClick={() => del(n)} style={_iconBtnStyle('var(--danger)')}>
                    <Icon name="trash-2" size={12} />
                  </button>
                </div>
              </div>
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
//   对齐 migration.ftl:左"数据导出"绿 + 右"数据导入"橙 双卡布局
// ═══════════════════════════════════════════════════════════════════════
function MigPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [file, setFile] = React.useState(null);
  const [masterKey, setMasterKey] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);

  const [busy, setBusy] = React.useState(false);

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
      await downloadResponse(response, `oci-pool-backup-${new Date().toISOString().slice(0, 10)}.enc`);
      shell.showToast(tr('mig.export.ok'), { kind: 'success' });
    } catch (e) {
      shell.showToast(tr('mig.export.fail').replace('{err}', e.message || e), { kind: 'error' });
    } finally { setBusy(false); }
  };

  const startImport = () => {
    if (!file) { shell.showToast(tr('mig.import.selectFirst'), { kind: 'warn' }); return; }
    if (!masterKey.trim()) { shell.showToast(tr('mig.import.keyRequired'), { kind: 'warn' }); return; }
    shell.openConfirm({
      title: tr('mig.import.confirmTitle'),
      body: tr('mig.import.confirmBody').replace('{file}', file.name),
      danger: false,
      confirmText: tr('mig.import.confirm'),
      onConfirm: async () => {
        try {
          setBusy(true);
          await window.ociServices.migration.importEncrypted({ file, masterKey: masterKey.trim() });
          shell.showToast(tr('mig.import.ok'), { kind: 'success' });
          setFile(null); setMasterKey('');
        } catch (e) { shell.showToast(tr('mig.import.fail').replace('{err}', e.message || e), { kind: 'error' }); }
        finally { setBusy(false); }
      },
    });
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
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

      {/* 顶部隐私提示 */}
      <div style={{
        padding: '10px 14px', background: 'var(--info-soft)', border: '1px solid var(--info)',
        borderRadius: 6, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--info)',
      }}>
        <Icon name="shield-check" size={14} style={{ flexShrink: 0 }} />
        <span>{tr('mig.notice')}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>

          {/* 数据导出 */}
          <ToolSettingsCard
            title={tr('mig.export.title')}
            icon="file-down"
            iconColor="var(--accent)"
            actions={
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 3,
                background: 'var(--accent-soft)', color: 'var(--accent)',
                fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                <Icon name="download" size={9} style={{ marginRight: 3 }} /> {tr('mig.export.badge')}
              </span>
            }
            footer={<Button variant="primary" size="sm" icon="lock" loading={busy} disabled={busy} onClick={generateBackup}>{tr('mig.export.btn')}</Button>}
          >
            <div style={{
              padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, marginBottom: 12,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="info" size={13} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.6 }}>{tr('mig.export.desc')}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { n: 1, text: tr('mig.export.step1') },
                { n: 2, text: tr('mig.export.step2') },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.6, paddingTop: 2 }}>{s.text}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--fg-3)', fontSize: 11 }}>
              {tr('mig.export.notice')}
            </div>
          </ToolSettingsCard>

          {/* 数据导入 */}
          <ToolSettingsCard
            title={tr('mig.import.title')}
            icon="file-up"
            iconColor="var(--orange)"
            actions={
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 3,
                background: 'var(--orange-soft)', color: 'var(--orange)',
                fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                <Icon name="upload" size={9} style={{ marginRight: 3 }} /> {tr('mig.import.badge')}
              </span>
            }
            footer={<Button variant="orange" size="sm" icon="upload" loading={busy} disabled={busy} onClick={startImport}>{tr('mig.import.btn')}</Button>}
          >
            <div style={{
              padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, marginBottom: 12,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="info" size={13} style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.6 }}>{tr('mig.import.desc')}</div>
            </div>

            <ToolFormRow label={tr('mig.import.mode')}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '5px 12px', borderRadius: 5,
                background: 'var(--orange-soft)', color: 'var(--orange)',
                border: '1px solid var(--orange)', fontSize: 11.5, fontWeight: 500,
                cursor: 'default',
              }}>
                <Icon name="file-archive" size={11} /> {tr('mig.import.mode.file')}
              </div>
            </ToolFormRow>

            <ToolFormRow label={tr('mig.import.selectFile')}>
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px 16px', borderRadius: 6,
                  background: dragOver ? 'var(--orange-soft)' : 'var(--bg-2)',
                  border: '1px dashed ' + (dragOver ? 'var(--orange)' : 'var(--border-strong)'),
                  cursor: 'pointer', transition: 'all 120ms',
                  gap: 6, minHeight: 100,
                }}>
                <Icon name="upload-cloud" size={22} style={{ color: dragOver ? 'var(--orange)' : 'var(--fg-3)' }} />
                {file ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }} className="mono">{file.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('mig.file.changed').replace('{n}', (file.size / 1024).toFixed(1))}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{tr('mig.import.dropTip')}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('mig.file.onlyEnc')}</div>
                  </>
                )}
                <input type="file" accept=".enc" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </ToolFormRow>

            <ToolFormRow label={tr('mig.import.masterKey')} hint={tr('mig.import.masterKeyPh')}>
              <div style={{ position: 'relative' }}>
                <Icon name="lock" size={12} style={{ position: 'absolute', top: 9, left: 10, color: 'var(--fg-3)' }} />
                <ToolInput value={masterKey} onChange={setMasterKey}
                  placeholder="ABCD1234EFGH5678IJKL9012MNOP3456"
                  mono style={{ paddingLeft: 30 }} />
              </div>
            </ToolFormRow>
          </ToolSettingsCard>

        </div>
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
      const entries = await Promise.all(keys.map(async k => {
        try {
          const response = await window.ociServices.mfaBackup.generateOtp({ secretKey: k.secret });
          const value = response?.otp || response?.code || response?.data?.otp || response?.data || '';
          return [k.id, String(value || '------')];
        } catch (_) { return [k.id, '------']; }
      }));
      if (!cancelled) setMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // 只在 tick(30 秒边界) 或 keys 数组变化时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, keys]);
  return map;
}

function BackendQr({ qrCode, size = 40 }) {
  if (!qrCode) return <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>—</span>;
  const src = String(qrCode).startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
  return <img src={src} width={size} height={size} alt="MFA QR" style={{ borderRadius: 3, background: '#fff' }} />;
}

function MfaBackupPage() {
  const { t: tr } = useT();
  const shell = useShell();
  const [keys, setKeys] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [reveal, setReveal] = React.useState({}); // id -> bool
  const { tick, rem, unixSecond } = useTick30();
  const otpMap = useOtpMap(keys, tick, unixSecond);
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', issuer: '', secret: '' });

  const loadKeys = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.ociServices.mfaBackup.listKeys();
      const rows = res?.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setKeys(rows.map((k, index) => ({
        id: k.id ?? `${k.keyName || 'mfa'}-${index}`,
        name: k.keyName || '', issuer: k.issuer || 'Default',
        secret: k.secretKey || '', qrCode: k.qrCode || '', color: 'var(--violet)',
      })));
    } catch (e) { setKeys([]); shell.showToast(tr('mfa.load.fail').replace('{err}', e.message || e), { kind: 'error' }); }
    finally { setLoading(false); }
  }, [shell]);
  React.useEffect(() => { loadKeys(); }, [loadKeys]);

  const shown = React.useMemo(() => {
    if (!q.trim()) return keys;
    const k = q.trim().toLowerCase();
    return keys.filter(x => x.name.toLowerCase().includes(k) || x.issuer.toLowerCase().includes(k));
  }, [keys, q]);

  const copyOtp = (row) => {
    const otp = otpMap[row.id] || '------';
    if (otp === '------') { shell.showToast(tr('mfa.otp.pending'), { kind: 'warn', duration: 1500 }); return; }
    navigator.clipboard?.writeText(otp);
    shell.showToast(tr('mfa.otp.copied').replace('{otp}', otp), { kind: 'success', duration: 1500 });
  };
  const copySecret = (secret) => {
    navigator.clipboard?.writeText(secret);
    shell.showToast(tr('mfa.secret.copied'), { kind: 'success', duration: 1500 });
  };
  const del = (row) => {
    shell.openConfirm({
      title: tr('mfa.confirm.delete'),
      body: tr('mfa.confirm.deleteBody'),
      danger: true,
      requireText: row.name,
      confirmText: tr('mfa.confirmText'),
      onConfirm: async () => {
        try { await window.ociServices.mfaBackup.deleteKey({ keyName: row.name }); await loadKeys(); shell.showToast(tr('memo.deleted'), { kind: 'success' }); }
        catch (e) { shell.showToast(tr('mfa.delete.fail').replace('{err}', e.message || e), { kind: 'error' }); }
      },
    });
  };
  const saveAdd = async () => {
    if (!form.name.trim() || !form.secret.trim()) { shell.showToast(tr('mfa.required'), { kind: 'warn' }); return; }
    try {
      await window.ociServices.mfaBackup.saveSecret({ keyName: form.name.trim(), secretKey: form.secret.replace(/\s/g, '').toUpperCase() });
      await loadKeys(); setForm({ name: '', issuer: '', secret: '' }); setAddOpen(false);
      shell.showToast(tr('mfa.added'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('mfa.add.fail').replace('{err}', e.message || e), { kind: 'error' }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 14 }}>
      <PageHeader
        title={tr('mfa.title')}
        subtitle={tr('mfa.subtitle')}
        icon="smartphone"
        iconColor="var(--violet)"
        actions={<>
          <Button variant="outline" size="sm" icon="download" onClick={async () => {
            try {
              const blob = await window.ociServices.mfaBackup.exportData();
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'otp_keys.csv'; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 0); shell.showToast(tr('mfa.export.ok'), { kind: 'success' });
            } catch (e) { shell.showToast(tr('mig.export.fail').replace('{err}', e.message || e), { kind: 'error' }); }
          }}>{tr('mfa.action.export')}</Button>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setAddOpen(o => !o)}>{tr('mfa.action.add')}</Button>
        </>}
      />

      {/* 顶部提示条 · 剩余秒数 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 14px', background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-1)' }}>
          <Icon name="clock" size={12} style={{ color: 'var(--info)' }} />
          <span>{tr('mfa.currentOtpLeft')}</span>
          <span className="mono num" style={{
            padding: '1px 8px', borderRadius: 3,
            background: rem <= 5 ? 'var(--danger-soft)' : 'var(--info-soft)',
            color: rem <= 5 ? 'var(--danger)' : 'var(--info)',
            fontWeight: 600,
          }}>{rem}s</span>
        </div>
        <div style={{
          flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden',
          maxWidth: 240,
        }}>
          <div style={{
            width: `${(rem / 30) * 100}%`, height: '100%',
            background: rem <= 5 ? 'var(--danger)' : 'var(--info)',
            transition: 'width 900ms linear',
          }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 220 }}>
            <SearchInput placeholder={tr('mfa.searchPh')} value={q} onChange={setQ} size="sm" width="100%" />
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
            {tr('mfa.stats.count').replace('{n}', keys.length)}
          </span>
        </div>
      </div>

      {/* 添加表单 */}
      {addOpen && (
        <ToolSettingsCard
          title={tr('mfa.form.title')}
          icon="plus-circle"
          iconColor="var(--accent)"
          footer={<>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>{tr('memo.btn.cancel')}</Button>
            <Button variant="primary" size="sm" icon="save" onClick={saveAdd}>{tr('memo.btn.save')}</Button>
          </>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ToolFormRow label={tr('mfa.form.name')}>
              <ToolInput value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder={tr('mfa.form.namePh')} />
            </ToolFormRow>
            <ToolFormRow label={tr('mfa.form.issuer')}>
              <ToolInput value={form.issuer} onChange={v => setForm({ ...form, issuer: v })} placeholder="Google · GitHub · Aliyun ..." />
            </ToolFormRow>
          </div>
          <ToolFormRow label={tr('mfa.form.secret')} hint={tr("mfa.secret.hint")}>
            <ToolInput value={form.secret} onChange={v => setForm({ ...form, secret: v })} placeholder={tr('mfa.form.secretPh')} mono />
          </ToolFormRow>
          <div style={{
            padding: 10, background: 'var(--bg-2)', borderRadius: 5,
            display: 'flex', gap: 10, alignItems: 'center', fontSize: 11.5, color: 'var(--fg-2)',
          }}>
            <Icon name="clipboard" size={12} />
            <span>{tr('mfa.qr.hint').replace('{url}', 'otpauth://totp/...')}</span>
          </div>
        </ToolSettingsCard>
      )}

      {/* 密钥表格 */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                {[
                  tr('mfa.col.name'), tr('mfa.col.issuer'), tr('mfa.col.secret'),
                  tr('mfa.col.qr'), tr('mfa.col.otp'), tr('mfa.col.action'),
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500,
                    color: 'var(--fg-2)', borderBottom: '1px solid var(--border)',
                    textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>{tr('mfa.loading')}</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
                  <Icon name="key" size={32} style={{ color: 'var(--fg-3)', marginBottom: 10 }} />
                  <div>{tr('mfa.empty')}</div>
                </td></tr>
              ) : shown.map(k => {
                const otp = otpMap[k.id] || '------';
                return (
                  <tr key={k.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 100ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--fg-0)', fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: k.color, boxShadow: `0 0 0 2px ${k.color}30` }} />
                        {k.name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 10.5, padding: '2px 8px', borderRadius: 3,
                        background: k.color + '20', color: k.color,
                        border: '1px solid ' + k.color + '40', fontWeight: 500,
                      }}>{k.issuer}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {/* 三段式:眼睛切显隐 · 密钥文本区点击复制 · 复制小图标(明确的复制入口) */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'stretch',
                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                        borderRadius: 4, overflow: 'hidden',
                        transition: 'border-color 100ms',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <button
                          onClick={() => setReveal(s => ({ ...s, [k.id]: !s[k.id] }))}
                          title={reveal[k.id] ? tr('mfa.hide') : tr('mfa.tip.clickShow')}
                          style={{
                            padding: '4px 8px', background: 'transparent', border: 'none',
                            borderRight: '1px solid var(--border)',
                            color: 'var(--fg-2)', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Icon name={reveal[k.id] ? 'eye-off' : 'eye'} size={11} />
                        </button>
                        <button
                          onClick={() => copySecret(k.secret)}
                          title={tr("mfa.copySecret")}
                          className="mono"
                          style={{
                            flex: 1, padding: '3px 10px',
                            background: 'transparent', border: 'none',
                            color: reveal[k.id] ? 'var(--fg-0)' : 'var(--fg-2)',
                            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                            letterSpacing: reveal[k.id] ? 0 : 2,
                            minWidth: 150, textAlign: 'left',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {reveal[k.id] ? k.secret : '••••••••••••••••'}
                        </button>
                        <button
                          onClick={() => copySecret(k.secret)}
                          title={tr("mfa.copySecretShort")}
                          style={{
                            padding: '4px 8px', background: 'transparent', border: 'none',
                            borderLeft: '1px solid var(--border)',
                            color: 'var(--fg-2)', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-2)'; }}
                        >
                          <Icon name="copy" size={11} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <BackendQr qrCode={k.qrCode} size={40} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => copyOtp(k)} title={tr('mfa.tip.clickCopy')}
                        className="mono num"
                        style={{
                          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10,
                          padding: '6px 10px', borderRadius: 5,
                          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                          color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                          cursor: 'pointer',
                        }}>
                        <span style={{ fontSize: 16, letterSpacing: 3, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {otp.slice(0, 3)} {otp.slice(3)}
                        </span>
                        <span style={{
                          fontSize: 9.5, opacity: 0.75, letterSpacing: 0.3, fontWeight: 500,
                          padding: '2px 6px', borderRadius: 3,
                          background: 'rgba(0,0,0,0.15)', minWidth: 28, textAlign: 'center',
                        }}>{rem}s</span>
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button title={tr('memo.btn.delete')} onClick={() => del(k)} style={{
                        width: 26, height: 26, borderRadius: 4,
                        background: 'var(--bg-2)', border: '1px solid var(--border)',
                        color: 'var(--danger)', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <Icon name="trash-2" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
