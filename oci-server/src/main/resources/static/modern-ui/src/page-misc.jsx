// Miscellaneous placeholder pages: Mail / Object / AI / Link / Proxy Pool / Notification / Settings / Resource pages
// These are secondary features — shown as elegant "coming soon" placeholders that make sense in the product

function PlaceholderPage({ title, subtitle, icon, iconColor = 'var(--fg-2)', description, features }) {
  const { t: tr } = useT();
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        iconColor={iconColor}
        actions={<Button variant="outline" size="md" icon="refresh-cw">{tr('common.refresh')}</Button>}
      />
      <Card>
        <div style={{
          padding: '50px 40px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: `color-mix(in oklab, ${iconColor} 15%, transparent)`,
            color: iconColor,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Icon name={icon} size={30} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-2)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>{description}</div>
          {features && (
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 520, margin: '24px auto 0' }}>
              {features.map((f, i) => (
                <div key={i} style={{
                  padding: 12, textAlign: 'left',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <Icon name={f.icon} size={14} style={{ color: iconColor, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OCI 邮箱服务 · 整页 · 严格对齐原项目 email.ftl
//   /email —— 3 区域布局:
//     ┌──────────────────────┬───────────────────────┐
//     │ 左:租户邮件服务       │ 右:联系人管理          │
//     │  · 已开启/未开启 tab │  · 增删 + 分页          │
//     │  · 搜索 + 分页       │                        │
//     ├──────────────────────┴────────────────────────┤
//     │ 下:邮件发送记录 · 分页                          │
//     └───────────────────────────────────────────────┘
//   顶部「写邮件」按钮 → 弹 compose 子 modal
//   与 useMailModal 的核心差异:此处不预选任何租户,发件人在写信时选
// ═══════════════════════════════════════════════════════════════════════
function MailPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();

  // ─── 真实后端 · 全部租户(含未开启) + 已开启邮件配置 ─────────────
  const [tenants, setTenants] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tenantRows, emailJson] = await Promise.all([
          window.ociServices.tenant.listParentTenants().catch(() => []),
          window.ociServices.mail.tenantList({ pageNum: 1, pageSize: 500, sort: 'createdTime', order: 'desc' }),
        ]);
        if (!alive) return;
        const allTenants = (Array.isArray(tenantRows) ? tenantRows : []).map(t => ({ ...t, id: String(t.id), name: t.tenancyName || t.userName || '', tname: window.getTenantLabel(t, lang) }));
        const content = (emailJson && emailJson.data && Array.isArray(emailJson.data.content)) ? emailJson.data.content : [];
        const byTenant = new Map(content.map(c => [String(c.tenantId), c]));
        setTenants(allTenants.map(t => {
          const c = byTenant.get(t.id);
          const enabled = !!(c && c.active);
          return {
            tenantId: t.id,
            tenant: t,
            configId: c ? c.id : null,
            enabled,
            domain: c ? (c.domainName || '') : '',
            senderEmail: c ? (c.senderEmail || '') : '',
            smtpUser: c ? (c.smtpUsername || '') : '',
            smtpHost: c ? (c.smtpHost || '') : '',
            smtpPort: c ? (c.smtpPort || '') : '',
            verified: enabled,
          };
        }));
      } catch (e) { if (alive) shell.showToast(e.message || tr('mail.loadTenantsFail'), { kind: 'error' }); }
      finally { if (alive) setHasLoadedOnce(true); }
    })();
    return () => { alive = false; };
  }, []);

  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);

  // ─── 真实后端 · 联系人列表(POST /email/receive/list) ──────
  const [contacts, setContacts] = React.useState([]);
  const [contactTotalElements, setContactTotalElements] = React.useState(0);
  const [contactPageTotal, setContactPageTotal] = React.useState(1);

  // ─── 真实后端 · 邮件发送记录(POST /email/body/list) ──────
  const [records, setRecords] = React.useState([]);
  const [recordTotalElements, setRecordTotalElements] = React.useState(0);
  const [recordPageTotal, setRecordPageTotal] = React.useState(1);

  // ─── UI state ─────────────────────────────────────
  const [tenantTab, setTenantTab] = React.useState('enabled');
  const [tenantSearch, setTenantSearch] = React.useState('');
  const [tenantPage, setTenantPage] = React.useState(1);
  const [contactPage, setContactPage] = React.useState(1);
  const [recordPage, setRecordPage] = React.useState(1);
  // 对齐 UI_STANDARD.md 4.1：统一默认每页 20 条
  const tenantPageSize = 20;
  const contactPageSize = 20;
  const recordPageSize = 20;

  const reloadContacts = React.useCallback(async () => {
    try {
      const json = await window.ociServices.mail.receiveList({ pageNum: contactPage, pageSize: contactPageSize, sort: 'createTime', order: 'desc' });
      if (!json || !json.success) return;
      const data = json.data || {};
      setContacts((data.content || []).map(c => ({ id: c.id, name: c.name || '', email: c.email || '', addedAt: c.createTime || '' })));
      setContactTotalElements(data.totalElements || 0);
      setContactPageTotal(Math.max(1, data.totalPages || 1));
    } catch (e) { shell.showToast(e.message || tr('mail.loadContactsFail'), { kind: 'error' }); }
  }, [contactPage, contactPageSize]);

  React.useEffect(() => { reloadContacts(); }, [reloadContacts]);

  const reloadRecords = React.useCallback(async () => {
    try {
      const json = await window.ociServices.mail.bodyList({ pageNum: recordPage, pageSize: recordPageSize, sort: 'createTime', order: 'desc' });
      if (!json || !json.success) return;
      const data = json.data || {};
      setRecords((data.content || []).map(r => {
        const succ = r.receiveSuccessTotal || 0, fail = r.receiveFailTotal || 0;
        const status = succ > 0 && fail === 0 ? 'sent' : fail > 0 ? 'failed' : 'pending';
        return { id: r.id, emailBodyId: r.emailBodyId, subject: r.title || '', sender: r.senderEmail || '', recipients: r.receiveTotal || 0, status, sentAt: r.createTime || '' };
      }));
      setRecordTotalElements(data.totalElements || 0);
      setRecordPageTotal(Math.max(1, data.totalPages || 1));
    } catch (e) { shell.showToast(e.message || tr('mail.loadRecordsFail'), { kind: 'error' }); }
  }, [recordPage, recordPageSize]);

  React.useEffect(() => { reloadRecords(); }, [reloadRecords]);


  const enabledCount = tenants.filter(r => r.enabled).length;
  const disabledCount = tenants.length - enabledCount;

  const filteredTenants = tenants.filter(r => {
    if (tenantTab === 'enabled' && !r.enabled) return false;
    if (tenantTab === 'disabled' && r.enabled) return false;
    if (tenantSearch) {
      const q = tenantSearch.toLowerCase();
      if (!r.tenant.name.toLowerCase().includes(q) && !getTenantName(r.tenant).toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const tenantTotalPages = Math.max(1, Math.ceil(filteredTenants.length / tenantPageSize));
  const tenantPageRows = filteredTenants.slice((Math.min(tenantPage, tenantTotalPages) - 1) * tenantPageSize, Math.min(tenantPage, tenantTotalPages) * tenantPageSize);

  const contactTotalPages = contactPageTotal;
  const contactPageRows = contacts;

  const recordTotalPages = recordPageTotal;
  const recordPageRows = records;

  const statusMap = {
    sent:    { label: tr('mail.status.sent'), color: 'var(--accent)', bg: 'var(--accent-soft)', icon: 'check-circle' },
    failed:  { label: tr('mail.status.failed'),   color: 'var(--danger)', bg: 'var(--danger-soft)', icon: 'alert-circle' },
    pending: { label: tr('mail.status.pending'), color: 'var(--info)',   bg: 'var(--info-soft)',   icon: 'loader' },
  };

  // ─── 子 modal:启用邮件服务 ─────────────────────────
  const openEnableModal = (row) => {
    if (!row.enabled) {
      shell.showToast(tr('mail.noEnableApi'), { kind: 'info' });
      return;
    }
    const s2 = { input: row.domain || `mail.${row.tenant.name.replace(/\*/g, 'x')}.com` };
    const paint = () => shell.openModal({
      title: row.enabled ? tr('mail.editService') : tr('mail.enableService'),
      subtitle: <span><span className="mono">{row.tenant.name}</span> · {getTenantName(row.tenant)} · Oracle Cloud Email Delivery</span>,
      icon: 'mail',
      iconColor: 'var(--info)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <div style={{
            padding: '10px 12px', background: 'var(--info-soft)',
            border: '1px solid var(--info)', borderRadius: 6, marginBottom: 14,
          }}>
            <div style={{ fontSize: 11.5, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600 }}>
              <Icon name="info" size={12} />{tr('mail.infoTitle')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.7 }}>
              <li>{tr('mail.info1')}<b>{tr('mail.info1b')}</b>{tr('mail.info1end')}</li>
              <li>{tr('mail.info2')}<b>{tr('mail.info2b')}</b></li>
              <li>{tr('mail.info3')}<b>{tr('mail.info3b')}</b>{tr('mail.info3end')}<span className="mono">mail.example.com</span>)</li>
            </ul>
          </div>
          <FormRow label={tr('mail.domainLabel')} required hint={tr('mail.domainHint')}>
            <TextInput value={s2.input} onChange={v => { s2.input = v.replace(/^https?:\/\//, ''); paint(); }}
              placeholder="mail.example.com" mono />
          </FormRow>
          {row.enabled && (
            <div style={{
              padding: 12, background: 'var(--bg-2)',
              border: '1px solid var(--border)', borderRadius: 6, marginTop: 14,
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{tr('mail.smtpCredentials')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 50, fontSize: 11, color: 'var(--fg-2)' }}>Host</span>
                  <span className="mono" style={{ flex: 1, fontSize: 11, color: 'var(--fg-0)' }}>{row.smtpHost || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 50, fontSize: 11, color: 'var(--fg-2)' }}>Port</span>
                  <span className="mono" style={{ flex: 1, fontSize: 11, color: 'var(--fg-0)' }}>{row.smtpPort || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 50, fontSize: 11, color: 'var(--fg-2)' }}>User</span>
                  <span className="mono" style={{ flex: 1, fontSize: 10.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.smtpUser}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={async () => {
              try {
                const j = await window.ociServices.mail.disable({ tenantId: row.tenantId });
                if (!j?.success) throw new Error(j?.message || tr('mail.disableFail'));
                setTenants(prev => prev.map(x => x.tenantId === row.tenantId ? { ...x, enabled: false } : x));
                shell.showToast(tr('mail.disabledToast').replace('{name}', getTenantName(row.tenant)), { kind: 'success' });
                shell.closeModal();
              } catch (e) { shell.showToast(e.message || tr('mail.disableFail'), { kind: 'error' }); }
            }}
          >{tr('mail.disableAction')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:添加联系人 ────────────────────────────
  const openAddContact = () => {
    const s2 = { name: '', email: '' };
    const paint = () => shell.openModal({
      title: tr('mail.addContact'),
      subtitle: tr('mail.addContactSubtitle'),
      icon: 'user-plus',
      iconColor: 'var(--accent)',
      size: 'sm',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label={tr('mail.contactName')} required>
            <TextInput value={s2.name} onChange={v => { s2.name = v; paint(); }} placeholder={tr('mail.namePh')} />
          </FormRow>
          <FormRow label={tr('mail.emailLabel')} required>
            <TextInput value={s2.email} onChange={v => { s2.email = v; paint(); }} placeholder="user@example.com" mono />
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={() => {
              if (!s2.name.trim() || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s2.email)) {
                shell.showToast(tr('mail.validRequired'), { kind: 'warn' }); return;
              }
              (async () => {
                try {
                  const json = await window.ociServices.mail.receiveAdd({ name: s2.name.trim(), email: s2.email.trim() });
                  if (!json?.success) throw new Error(json?.message || tr('mail.addFail'));
                  await reloadContacts();
                  shell.showToast(tr('mail.added').replace('{name}', s2.name), { kind: 'success' });
                  shell.closeModal();
                } catch (e) { shell.showToast(e.message || tr('mail.addFail'), { kind: 'error' }); }
              })();
            }}
          >{tr('mail.add')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:写邮件 ──────────────────────────────
  const openCompose = () => {
    const enabledSenders = tenants.filter(t => t.enabled);
    const s2 = {
      subject: '',
      content: '',
      senderId: enabledSenders[0]?.configId,
      selected: new Set(),
    };
    const paint = () => shell.openModal({
      title: tr('mail.compose'),
      subtitle: tr('mail.composeSubtitle'),
      icon: 'edit',
      iconColor: 'var(--info)',
      size: 'lg',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label={tr('mail.sender')} required>
            <CustomDropdown value={s2.senderId == null ? '' : String(s2.senderId)} onChange={e => { s2.senderId = e; paint(); }} height={32} width="100%">
              {enabledSenders.length === 0 && <option value="">{tr('mail.noSender')}</option>}
              {enabledSenders.map(t => (
                <option key={t.configId} value={t.configId}>{getTenantLabel(t.tenant, lang)} · {t.senderEmail}</option>
              ))}
            </CustomDropdown>
          </FormRow>
          <FormRow label={tr('mail.subject')} required>
            <TextInput value={s2.subject} onChange={v => { s2.subject = v; paint(); }} placeholder={tr('mail.subjectPh')} />
          </FormRow>
          <FormRow label={tr('mail.body')} required>
            <textarea value={s2.content} onChange={e => { s2.content = e.target.value; paint(); }}
              rows={6} placeholder={tr('mail.bodyPh')}
              style={{ width: '100%', padding: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 12, resize: 'vertical' }} />
          </FormRow>
          <FormRow label={tr('mail.recipientsLabel').replace('{n}', s2.selected.size).replace('{total}', contactTotalElements)}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button type="button" onClick={() => { s2.selected = new Set(contacts.map(c => c.id)); paint(); }}
                style={{ padding: '3px 8px', background: 'var(--info-soft)', color: 'var(--info)', border: '1px solid var(--info)', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>{tr('mail.selectAll')}</button>
              <button type="button" onClick={() => { s2.selected = new Set(); paint(); }}
                style={{ padding: '3px 8px', background: 'var(--bg-2)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>{tr('mail.clear')}</button>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: 6 }}>
              {contacts.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', cursor: 'pointer', borderRadius: 3 }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-3)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <input type="checkbox" checked={s2.selected.has(c.id)}
                    onChange={e => { e.target.checked ? s2.selected.add(c.id) : s2.selected.delete(c.id); paint(); }} />
                  <span style={{ fontSize: 12, color: 'var(--fg-0)' }}>{c.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>· {c.email}</span>
                </label>
              ))}
            </div>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="send"
            onClick={async () => {
              if (!s2.senderId) { shell.showToast(tr('mail.senderRequired'), { kind: 'warn' }); return; }
              if (!s2.subject.trim()) { shell.showToast(tr('mail.subjectRequired'), { kind: 'warn' }); return; }
              if (!s2.content.trim()) { shell.showToast(tr('mail.bodyRequired'), { kind: 'warn' }); return; }
              if (s2.selected.size === 0) { shell.showToast(tr('mail.recipientRequired'), { kind: 'warn' }); return; }
              const sender = tenants.find(t => String(t.configId) === String(s2.senderId));
              try {
                const j = await window.ociServices.mail.send({ title: s2.subject.trim(), content: s2.content.trim(), tenantEmailConfigId: sender?.configId, emailReceiveIds: Array.from(s2.selected) });
                if (j && j.success) {
                  setRecords(prev => [{ id: Date.now(), subject: s2.subject.trim(), sender: sender?.senderEmail || '', recipients: s2.selected.size, status: 'sent', sentAt: new Date().toISOString().slice(0, 16).replace('T', ' ') }, ...prev]);
                  shell.showToast(tr('mail.sentToast').replace('{n}', s2.selected.size), { kind: 'success' });
                  shell.closeModal();
                } else shell.showToast(tr('mail.sendFail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
              } catch (e) { shell.showToast(tr('mail.sendFail').replace('{err}', e.message || e), { kind: 'error' }); }
            }}
          >{tr('mail.sendAction')}</Button>
        </>
      ),
    });
    paint();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.mail')}
        subtitle={<>{tr('mail.subtitle').replace('{enabled}', enabledCount).replace('{contacts}', contactTotalElements).replace('{records}', recordTotalElements)}</>}
        icon="mail"
        iconColor="var(--cyan)"
        actions={
          <Button variant="primary" size="md" icon="edit" onClick={openCompose}>{tr('mail.compose')}</Button>
        }
      />

      {/* KPI 卡片行 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 14,
      }}>
        <KPICard label={tr('mail.kpi.enabledTenants')} value={enabledCount} icon="check-circle" iconColor="var(--accent)" />
        <KPICard label={tr('mail.kpi.disabled')} value={disabledCount} icon="circle" iconColor="var(--fg-3)" />
        <KPICard label={tr('mail.kpi.contacts')} value={contactTotalElements} icon="users" iconColor="var(--info)" />
        <KPICard label={tr('mail.kpi.sentMonth')} value={records.filter(r => r.status === 'sent').length} icon="send" iconColor="var(--cyan)" />
      </div>

      {/* 主内容区 flex:1 内部滚动 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {/* 上半:租户 + 联系人 双栏 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* ═══ 左:租户邮件服务 ═══ */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="server" size={13} style={{ color: 'var(--fg-2)' }} />
                {tr('mail.availableTenants')}
              </div>
              <button onClick={() => shell.showToast(tr('mail.refreshTenantsOk'), { kind: 'info' })}
                style={{ padding: '2px 8px', background: 'var(--bg-1)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 10.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="refresh-cw" size={10} />{tr('mail.refresh')}
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              {[
                { id: 'enabled',  label: tr('mail.tab.enabled'), count: enabledCount,  icon: 'check-circle', color: 'var(--accent)' },
                { id: 'disabled', label: tr('mail.tab.disabled'), count: disabledCount, icon: 'circle',       color: 'var(--fg-3)' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => { setTenantTab(t.id); setTenantPage(1); }}
                  style={{
                    flex: 1, padding: '9px 10px', background: 'transparent',
                    color: tenantTab === t.id ? t.color : 'var(--fg-2)',
                    border: 'none',
                    borderBottom: '2px solid ' + (tenantTab === t.id ? t.color : 'transparent'),
                    cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    fontWeight: tenantTab === t.id ? 600 : 400,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 120ms',
                  }}>
                  <Icon name={t.icon} size={12} />
                  {t.label}
                  <span style={{
                    minWidth: 18, padding: '0 5px', height: 16, borderRadius: 8,
                    background: tenantTab === t.id ? t.color : 'var(--bg-3)',
                    color: tenantTab === t.id ? 'var(--accent-fg)' : 'var(--fg-3)',
                    fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }} className="num">{t.count}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <SearchInput value={tenantSearch}
                onChange={v => { setTenantSearch(v); setTenantPage(1); }}
                placeholder={tr('mail.searchPh')}
                width="100%" size="sm" />
            </div>

            {/* Tenant rows */}
            <div style={{ minHeight: 340 }}>
              {!hasLoadedOnce ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: 13 }}>加载中…</span>
                </div>
              ) : tenantPageRows.length === 0 ? (
                <EmptyState
                  icon={tenantTab === 'enabled' ? 'server' : 'check-circle'}
                  title={tenantTab === 'enabled' ? '暂无已开启租户' : '全部租户均已开启'}
                  subtitle={tenantTab === 'enabled' ? '可在「未开启」中为租户启用邮件服务' : '没有待开启的租户'}
                />
              ) : tenantPageRows.map((r, i) => (
                <div key={r.tenantId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < tenantPageRows.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 100ms',
                }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 5,
                    background: r.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
                    color: r.enabled ? 'var(--accent)' : 'var(--fg-3)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name={r.enabled ? 'check-circle' : 'circle'} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500 }}>{r.tenant.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getTenantName(r.tenant)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.enabled ? <span className="mono">{r.senderEmail}</span> : tr('mail.noDomain')}
                    </div>
                  </div>
                  {r.enabled ? (
                    <button onClick={() => openEnableModal(r)}
                      style={{ padding: '4px 12px', background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                      {tr('mail.edit')}
                    </button>
                  ) : (
                    <button onClick={() => openEnableModal(r)}
                      style={{ padding: '4px 12px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
                      {tr('mail.enable')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Tenant pagination */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }} className="num">
                {tr('mail.tenantsCount').replace('{n}', filteredTenants.length)}
              </span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button onClick={() => setTenantPage(p => Math.max(1, p - 1))}
                  disabled={tenantPage <= 1}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: tenantPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: tenantPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>‹</button>
                <span className="num" style={{ padding: '2px 10px', fontSize: 11, color: 'var(--fg-2)' }}>{Math.min(tenantPage, tenantTotalPages)} / {tenantTotalPages}</span>
                <button onClick={() => setTenantPage(p => Math.min(tenantTotalPages, p + 1))}
                  disabled={tenantPage >= tenantTotalPages}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: tenantPage >= tenantTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: tenantPage >= tenantTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>›</button>
              </div>
            </div>
          </div>

          {/* ═══ 右:联系人管理 ═══ */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="users" size={13} style={{ color: 'var(--fg-2)' }} />
                {tr('mail.contactsTitle')}
                <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({contactTotalElements})</span>
              </div>
              <button onClick={openAddContact}
                style={{ padding: '3px 10px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="plus" size={10} />{tr('mail.addContactAction')}
              </button>
            </div>

            <div style={{ minHeight: 390 }}>
              {!hasLoadedOnce ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: 13 }}>加载中…</span>
                </div>
              ) : contactPageRows.length === 0 ? (
                <EmptyState
                  icon="users"
                  title="暂无收件人"
                  subtitle="添加收件人后即可发送邮件"
                  actionLabel="添加收件人"
                  onAction={openAddContact}
                />
              ) : contactPageRows.map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < contactPageRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'color-mix(in oklab, var(--info) 20%, transparent)',
                    color: 'var(--info)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{c.name.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{c.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{c.addedAt.slice(0, 10)}</span>
                  <button onClick={() => shell.openConfirm({
                    title: tr('mail.deleteContactTitle').replace('{name}', c.name),
                    body: <div><span className="mono">{c.email}</span>{tr('mail.deleteContactBody')}</div>,
                    danger: true, confirmLabel: tr('mail.delete'),
                    onConfirm: async () => {
                      try {
                        const json = await window.ociServices.mail.receiveDelete({ id: c.id });
                        if (!json?.success) throw new Error(json?.message || tr('mail.deleteFail'));
                        await reloadContacts();
                        shell.showToast(tr('mail.deleted').replace('{name}', c.name), { kind: 'warn' });
                      } catch (e) { shell.showToast(e.message || tr('mail.deleteFail'), { kind: 'error' }); }
                    },
                  })}
                    style={{ width: 24, height: 24, background: 'transparent', color: 'var(--fg-3)', border: 'none', cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)'; }}>
                    <Icon name="trash-2" size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }} className="num">
                {tr('mail.contactsCount').replace('{n}', contactTotalElements)}
              </span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button onClick={() => setContactPage(p => Math.max(1, p - 1))}
                  disabled={contactPage <= 1}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: contactPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: contactPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>‹</button>
                <span className="num" style={{ padding: '2px 10px', fontSize: 11, color: 'var(--fg-2)' }}>{Math.min(contactPage, contactTotalPages)} / {contactTotalPages}</span>
                <button onClick={() => setContactPage(p => Math.min(contactTotalPages, p + 1))}
                  disabled={contactPage >= contactTotalPages}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: contactPage >= contactTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: contactPage >= contactTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>›</button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 下:邮件发送记录 ═══ */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={13} style={{ color: 'var(--fg-2)' }} />
              {tr('mail.recordsTitle')}
              <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({recordTotalElements})</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { reloadRecords(); shell.showToast(tr('mail.refreshRecordsOk'), { kind: 'info' }); }}
                style={{ padding: '3px 8px', background: 'var(--bg-1)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 10.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="refresh-cw" size={10} />{tr('mail.refresh')}
              </button>
              <button onClick={() => shell.openConfirm({
                title: tr('mail.clearTitle'),
                body: <div>{tr('mail.clearBody')}<b>{recordTotalElements}</b>{tr('mail.clearBodyEnd')}</div>,
                danger: true, confirmLabel: tr('mail.clearConfirm'),
                onConfirm: async () => { try { const json = await window.ociServices.mail.bodyBatchDelete(); if (!json?.success) throw new Error(json?.message || tr('mail.clearFail')); await reloadRecords(); shell.showToast(tr('mail.cleared'), { kind: 'warn' }); } catch (e) { shell.showToast(e.message || tr('mail.clearFail'), { kind: 'error' }); } },
              })}
                style={{ padding: '3px 8px', background: 'var(--bg-1)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 10.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trash-2" size={10} />{tr('mail.clearConfirm')}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { h: tr('mail.col.subject'), align: 'center' },
                    { h: tr('mail.col.sender'),    w: 260, align: 'center' },
                    { h: tr('mail.col.recipients'),    w: 80,  align: 'center' },
                    { h: tr('mail.col.status'),      w: 100, align: 'center' },
                    { h: tr('mail.col.sentAt'),  w: 160, align: 'center' },
                  ].map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!hasLoadedOnce ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: 13 }}>加载中…</span>
                      </div>
                    </td>
                  </tr>
                ) : recordPageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <EmptyState
                        icon="mail"
                        title="暂无发送记录"
                        subtitle="发送邮件后此处将显示历史发送日志"
                      />
                    </td>
                  </tr>
                ) : recordPageRows.map((r, i) => {
                  const s = statusMap[r.status];
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--fg-0)' }}>
                        <span title={r.subject} style={{ fontSize: 11.5 }}>{r.subject}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" title={r.sender} style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{r.sender}</span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                        <span className="num" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{r.recipients}</span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                          background: s.bg, color: s.color,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <Icon name={s.icon} size={9} />{s.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{r.sentAt}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {recordTotalElements > recordPageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }} className="num">
                {tr('mail.recordsSummary').replace('{total}', recordTotalElements).replace('{page}', Math.min(recordPage, recordTotalPages)).replace('{pages}', recordTotalPages)}
              </span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button onClick={() => setRecordPage(p => Math.max(1, p - 1))}
                  disabled={recordPage <= 1}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: recordPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: recordPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>‹</button>
                <button onClick={() => setRecordPage(p => Math.min(recordTotalPages, p + 1))}
                  disabled={recordPage >= recordTotalPages}
                  style={{ padding: '2px 8px', background: 'var(--bg-1)', color: recordPage >= recordTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: recordPage >= recordTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OCI 对象存储 · 整页 · 严格对齐原项目 oci_object_storage.ftl
//   /oci/storage —— 双面板布局:
//     ┌──────────────┬───────────────────────────────┐
//     │ 左:存储桶     │ 右:对象列表                     │
//     │  · 搜索       │  · 上传 + 刷新                  │
//     │  · 3 态访问   │  · 4 列表格                     │
//     │  · 创建/删除  │  · 预览/下载/预签名 URL/删除    │
//     └──────────────┴───────────────────────────────┘
//   顶部:租户选择 + 刷新
//   与租户菜单 showStorageModal 差异:此处允许用户切换任意租户,不预选
// ═══════════════════════════════════════════════════════════════════════
function ObjectPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [tenants, setTenants] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    // 与实例列表一致：走 listParentTenants（TenantResp：id/tenancyName/region编码），
    // 避免 /tenants/list/json 的 region 被覆盖成中文导致下拉无法匹配。
    window.ociServices.tenant.listParentTenants()
      .then(rows => {
        if (!alive) return;
        const normalized = (Array.isArray(rows) ? rows : []).map(t => ({ ...t, id: String(t.id) }));
        normalized.sort((a, b) => {
          const na = a.tenancyName || a.name || a.userName || '';
          const nb = b.tenancyName || b.name || b.userName || '';
          return na.localeCompare(nb, undefined, { sensitivity: 'base' });
        });
        setTenants(normalized);
      })
      .catch(() => { if (alive) setTenants([]); });
    return () => { alive = false; };
  }, []);

  // ─── 页面级 state ────────────────────────────────────
  const [tenantId, setTenantId] = React.useState('');
  const [bucketSearch, setBucketSearch] = React.useState('');
  const [activeBucket, setActiveBucket] = React.useState(null);
  const [objectPage, setObjectPage] = React.useState(1);
  const objectPageSize = 20;

  const currentTenant = tenants.find(t => t.id === tenantId);

  // ─── 真实后端 · buckets(/oci/storage/buckets?tenantId=) ───
  const [localBuckets, setLocalBuckets] = React.useState([]);
  const loadBuckets = React.useCallback(async () => {
    if (!tenantId) { setLocalBuckets([]); return; }
    try {
      const json = await window.ociServices.storage.buckets({ tenantId, limit: 100 });
      if (!json || !json.success) return;
      const items = (json.data && json.data.items) || [];
      setLocalBuckets(items.map(b => ({ name: b.name, namespace: b.namespace, access: b.publicAccess || 'NoPublicAccess', size: '', objects: 0, timeCreated: b.timeCreated || '', created: b.timeCreated || '' })));
    } catch (e) { shell.showToast(e.message || tr('obj.loadBucketsFail'), { kind: 'error' }); }
  }, [tenantId]);
  React.useEffect(() => { setActiveBucket(null); setObjectPage(1); loadBuckets(); }, [loadBuckets]);

  const filteredBuckets = localBuckets.filter(b =>
    !bucketSearch || b.name.toLowerCase().includes(bucketSearch.toLowerCase())
  );

  const namespace = activeBucket?.namespace || (localBuckets[0] && localBuckets[0].namespace) || '';

  // 后端当前未暴露对象列表接口；不要调用已注释的 /oci/storage/objects。
  const [objectsMap, setObjectsMap] = React.useState({});
  const [objectsUnavailable, setObjectsUnavailable] = React.useState(false);
  React.useEffect(() => {
    if (!activeBucket || !tenantId) { setObjectsUnavailable(false); return; }
    setObjectsMap(m => ({ ...m, [activeBucket]: [] }));
    setObjectsUnavailable(true);
    setObjectPage(1);
  }, [activeBucket, tenantId, localBuckets]);
  const objects = activeBucket ? (objectsMap[activeBucket] || []) : [];

  const objectTotalPages = Math.max(1, Math.ceil(objects.length / objectPageSize));
  const objectPageRows = objects.slice((Math.min(objectPage, objectTotalPages) - 1) * objectPageSize, Math.min(objectPage, objectTotalPages) * objectPageSize);

  // ─── 工具 ─────────────────────────────────────
  const accessCfg = {
    NoPublicAccess:        { label: tr('obj.access.private'),           color: 'var(--fg-2)',   bg: 'var(--bg-3)',        icon: 'lock' },
    ObjectRead:            { label: tr('obj.access.publicRead'),         color: 'var(--info)',   bg: 'var(--info-soft)',   icon: 'globe' },
    ObjectReadWithoutList: { label: tr('obj.access.publicReadNoList'), color: 'var(--orange)', bg: 'var(--orange-soft)', icon: 'eye-off' },
  };

  const objTypeInfo = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return { icon: 'image',     color: 'var(--cyan)',   preview: true };
    if (['mp4','mov','webm','mkv','avi'].includes(ext))              return { icon: 'video',     color: 'var(--violet)', preview: true };
    if (['pdf'].includes(ext))                                       return { icon: 'file-text', color: 'var(--danger)', preview: true };
    if (['json','yaml','yml','toml','xml','html'].includes(ext))     return { icon: 'file-code', color: 'var(--info)',   preview: true };
    if (['js','ts','jsx','tsx','py','go','rs','java'].includes(ext)) return { icon: 'file-code', color: 'var(--orange)', preview: true };
    if (['zip','tar','gz','bz2','7z','rar'].includes(ext))           return { icon: 'archive',   color: 'var(--fg-2)',   preview: false };
    if (['log','txt','md'].includes(ext))                            return { icon: 'file-text', color: 'var(--fg-1)',   preview: true };
    if (['xlsx','xls','csv'].includes(ext))                          return { icon: 'sheet',     color: 'var(--accent)', preview: false };
    return { icon: 'file', color: 'var(--fg-2)', preview: false };
  };

  // ─── 子 modal:新建 Bucket ─────────────────────
  const openCreateBucket = () => {
    const form = { name: '', access: 'NoPublicAccess' };
    const paint = () => shell.openModal({
      title: tr('obj.createBucket'),
      subtitle: <span><span className="mono">{currentTenant.name}</span> · Namespace <span className="mono" style={{ color: 'var(--fg-2)' }}>{namespace}</span></span>,
      icon: 'plus-circle',
      iconColor: 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label={tr('obj.bucketName')} required>
            <TextInput value={form.name}
              onChange={v => { form.name = v.replace(/[^a-zA-Z0-9._-]/g, ''); paint(); }}
              placeholder={tr('obj.bucketNamePh')}
              mono />
          </FormRow>
          <FormRow label={tr('obj.accessType')} hint={tr('obj.accessTypeHint')}>
            <CustomDropdown value={form.access} onChange={e => { form.access = e; paint(); }} height={32} width="100%">
              <option value="NoPublicAccess">{tr('obj.opt.private')}</option>
              <option value="ObjectRead">{tr('obj.opt.publicRead')}</option>
              <option value="ObjectReadWithoutList">{tr('obj.opt.publicReadNoList')}</option>
            </CustomDropdown>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={async () => {
              if (!form.name.trim() || form.name.length < 3) {
                shell.showToast(tr('obj.nameMin'), { kind: 'warn' }); return;
              }
              if (localBuckets.some(b => b.name === form.name)) {
                shell.showToast(tr('obj.nameExists'), { kind: 'warn' }); return;
              }
              try {
                const j = await window.ociServices.storage.createBucket({ tenantId, bucketName: form.name, publicAccessType: form.access });
                if (j && j.success) {
                  setLocalBuckets(prev => [{ name: form.name, access: form.access, size: '0 KB', objects: 0, created: new Date().toISOString().slice(0, 16).replace('T', ' ') }, ...prev]);
                  shell.showToast(tr('obj.created').replace('{name}', form.name), { kind: 'success' });
                  shell.closeModal();
                } else shell.showToast(tr('obj.createFail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
              } catch (e) { shell.showToast(tr('obj.createFail').replace('{err}', e.message || e), { kind: 'error' }); }
            }}
          >{tr('obj.create')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:预签名 URL ─────────────────────
  const openPresignedUrl = async (obj) => {
    let url = tr('obj.presignedGenerating');
    try {
      const bucket = localBuckets.find(b => b.name === activeBucket);
      const ns = bucket ? bucket.namespace : '';
      const j = await window.ociServices.storage.presigned({ tenantId, namespace: ns, bucketName: activeBucket, objectName: obj.name, validitySeconds: 24 * 3600 });
      if (j && j.success && j.data && j.data.url) url = j.data.url;
    } catch (e) { shell.showToast(e.message || tr('obj.presignedFail'), { kind: 'error' }); }
    const ttl = { hours: 24 };
    shell.openModal({
      title: tr('obj.presignedTitle'),
      subtitle: <span><span className="mono">{obj.name}</span></span>,
      icon: 'link',
      iconColor: 'var(--cyan)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label={tr('obj.validHours')}>
            <NumberInput value={ttl.hours} onChange={v => { ttl.hours = Math.max(1, Math.min(168, v)); }}
              min={1} max={168} />
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
              {tr('obj.validHoursHint')}
            </div>
          </FormRow>
          <FormRow label={tr('obj.presignedUrl')}>
            <div style={{
              padding: 10, background: 'var(--bg-2)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--fg-1)', wordBreak: 'break-all',
              maxHeight: 100, overflowY: 'auto',
            }}>{url}</div>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('obj.close')}</Button>
          <Button variant="primary" size="md" icon="copy"
            onClick={() => {
              navigator.clipboard.writeText(url);
              shell.showToast(tr('obj.presignedCopied'), { kind: 'success' });
              shell.closeModal();
            }}
          >{tr('obj.copyLink')}</Button>
        </>
      ),
    });
  };

  // ─── KPI 统计 ────────────────────────────────
  const totalBuckets = localBuckets.length;
  const totalObjects = localBuckets.reduce((s, b) => s + b.objects, 0);
  const publicBuckets = localBuckets.filter(b => b.access !== 'NoPublicAccess').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.object')}
        subtitle={tr('obj.subtitle')}
        icon="database"
        iconColor="var(--info)"
        actions={
          <>
            <span style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{tr('obj.selectTenant')}</span>
            <CustomDropdown value={tenantId} onChange={e => setTenantId(e)} height={32} width="240px" searchable={tenants.length > 5}>
              <option value="">{tr('obj.selectTenantPh')}</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{getTenantLabel(t, lang)}</option>
              ))}
            </CustomDropdown>
            <Button variant="outline" size="md" icon="refresh-cw"
              disabled={!currentTenant}
              onClick={() => { loadBuckets(); shell.showToast(tr('obj.refreshed'), { kind: 'info' }); }}
            >{tr('obj.refresh')}</Button>
          </>
        }
      />

      {/* KPI · 仅在选中租户时展示 */}
      {currentTenant && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12, marginBottom: 14,
        }}>
          <KPICard label={tr('obj.kpi.buckets')} value={totalBuckets} icon="database" iconColor="var(--info)" />
          <KPICard label={tr('obj.kpi.objects')} value={totalObjects.toLocaleString()} icon="package" iconColor="var(--cyan)" />
          <KPICard label={tr('obj.kpi.public')} value={publicBuckets} icon="globe" iconColor={publicBuckets > 0 ? 'var(--orange)' : 'var(--fg-3)'} />
          <KPICard label="Namespace" value={<span className="mono" style={{ fontSize: 13 }}>{namespace}</span>} icon="hash" iconColor="var(--violet)" />
        </div>
      )}

      {/* 双栏内容 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 340px) 1fr',
        gap: 12,
      }}>
        {/* ═══ 左:存储桶列表 ═══ */}
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="database" size={13} style={{ color: 'var(--fg-2)' }} />
              {tr('obj.bucketsTitle')}
              <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({filteredBuckets.length})</span>
            </div>
            <button onClick={openCreateBucket}
              disabled={!currentTenant}
              style={{
                padding: '3px 10px',
                background: currentTenant ? 'var(--accent)' : 'var(--bg-3)',
                color: currentTenant ? 'var(--accent-fg)' : 'var(--fg-3)',
                border: 'none', borderRadius: 3,
                cursor: currentTenant ? 'pointer' : 'not-allowed',
                fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <Icon name="plus" size={10} />{tr('obj.newBucket')}
            </button>
          </div>

          {/* 搜索框 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <SearchInput value={bucketSearch}
              onChange={setBucketSearch}
              placeholder={tr('obj.searchPh')}
              width="100%" size="sm" />
          </div>

          {/* Bucket 列表 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!currentTenant ? (
              <div style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="cloud" size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                <div>{tr('obj.selectTenantFirst')}</div>
              </div>
            ) : filteredBuckets.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="inbox" size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                <div>{bucketSearch ? tr('obj.noMatch') : tr('obj.noBuckets')}</div>
              </div>
            ) : filteredBuckets.map(b => {
              const ac = accessCfg[b.access];
              const active = activeBucket === b.name;
              return (
                <div key={b.name}
                  onClick={() => { setActiveBucket(b.name); setObjectPage(1); }}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    borderLeft: '3px solid ' + (active ? 'var(--accent)' : 'transparent'),
                    cursor: 'pointer', transition: 'background 100ms',
                  }}
                  onMouseOver={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="database" size={13} style={{ color: active ? 'var(--accent)' : 'var(--fg-2)', flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{b.name}</span>
                    <button onClick={e => {
                      e.stopPropagation();
                      shell.openConfirm({
                        title: tr('obj.deleteBucketTitle').replace('{name}', b.name),
                        body: (
                          <div>
                            {tr('obj.deleteBucketBody')}<b>{b.objects}</b>{tr('obj.deleteBucketBodyEnd')}<b>{b.size}</b>{tr('obj.deleteBucketSizeEnd')}
                            <div style={{ marginTop: 6, color: 'var(--danger)' }}>{tr('obj.deleteBucketWarn')}</div>
                          </div>
                        ),
                        danger: true, requireText: b.name, confirmLabel: tr('obj.deleteBucketConfirm'),
                        onConfirm: async () => {
                          try {
                            const ns = b.namespace || namespace;
                            const j = await window.ociServices.storage.deleteBucket({ tenantId, namespace: ns, bucketName: b.name });
                            if (j && j.success) { setLocalBuckets(prev => prev.filter(x => x.name !== b.name)); if (activeBucket === b.name) setActiveBucket(null); shell.showToast(tr('obj.deletedBucket').replace('{name}', b.name), { kind: 'warn' }); }
                            else shell.showToast(tr('obj.deleteFail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
                          } catch (e) { shell.showToast(tr('obj.deleteFail').replace('{err}', e.message || e), { kind: 'error' }); }
                        },
                      });
                    }}
                      title={tr('obj.deleteBucketBtn')}
                      style={{
                        width: 22, height: 22, padding: 0,
                        background: 'transparent', color: 'var(--fg-3)',
                        border: 'none', cursor: 'pointer', borderRadius: 3,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)'; }}>
                      <Icon name="trash-2" size={11} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '1px 6px', borderRadius: 3,
                      background: ac.bg, color: ac.color,
                      fontSize: 9.5, fontWeight: 600,
                    }}>
                      <Icon name={ac.icon} size={9} />{ac.label}
                    </span>
                    <span className="num mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{b.size}</span>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>·</span>
                    <span className="num" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{tr('obj.objectsCount').replace('{n}', b.objects.toLocaleString())}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ 右:对象列表 ═══ */}
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Icon name="folder-open" size={13} style={{ color: 'var(--fg-2)', flexShrink: 0 }} />
              {tr('obj.objectsTitle')}
              {activeBucket && (
                <>
                  <span style={{ color: 'var(--fg-3)' }}>/</span>
                  <span className="mono" style={{ color: 'var(--fg-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeBucket}</span>
                  <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400, flexShrink: 0 }}>({objects.length})</span>
                </>
              )}
            </div>
            {activeBucket && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    try {
                      const bucket = localBuckets.find(b => b.name === activeBucket);
                      const ns = bucket ? bucket.namespace : '';
                      const j = await window.ociServices.storage.upload({ tenantId, namespace: ns, bucketName: activeBucket, objectName: file.name, file });
                      if (j && j.success) { const n = { name: file.name, size: '', modified: new Date().toISOString().slice(0,16).replace('T',' ') }; setObjectsMap(m => ({ ...m, [activeBucket]: [n, ...(m[activeBucket] || [])] })); shell.showToast(tr('obj.uploaded').replace('{name}', activeBucket), { kind: 'success' }); }
                      else shell.showToast(tr('obj.uploadFail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
                    } catch (e) { shell.showToast(tr('obj.uploadFail').replace('{err}', e.message || e), { kind: 'error' }); }
                  };
                  input.click();
                }}
                  style={{
                    padding: '3px 10px', background: 'var(--accent)', color: 'var(--accent-fg)',
                    border: 'none', borderRadius: 3, cursor: 'pointer',
                    fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <Icon name="upload" size={10} />{tr('obj.upload')}
                </button>
                <button onClick={() => {
                  setObjectsMap(m => { const c = { ...m }; delete c[activeBucket]; return c; });
                  shell.showToast(tr('obj.objectsRefreshed'), { kind: 'info' });
                }}
                  style={{
                    padding: '3px 10px', background: 'var(--bg-1)', color: 'var(--fg-2)',
                    border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                    fontSize: 11, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <Icon name="refresh-cw" size={10} />{tr('obj.refresh')}
                </button>
              </div>
            )}
          </div>

          {/* 对象表格 / 空态 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {!activeBucket ? (
              <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="arrow-left-circle" size={30} style={{ opacity: 0.35, marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{tr('obj.selectBucket')}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-3)' }}>
                  {tr('obj.selectBucketHint')}
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    {[
                      { h: tr('obj.col.name') },
                      { h: tr('obj.col.size'), w: 100 },
                      { h: tr('obj.col.modified'), w: 150 },
                      { h: tr('obj.col.action'), w: 160, align: 'center' },
                    ].map((c, i) => (
                      <th key={i} style={{
                        textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                        position: 'sticky', top: 0, zIndex: 1,
                        background: 'var(--bg-2)', color: 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid var(--border)',
                      }}>{c.h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {objectPageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                        <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                        <div style={{ marginTop: 6 }}>{objectsUnavailable ? tr('obj.objectsUnavailable') : tr('obj.noObjects')}</div>
                      </td>
                    </tr>
                  ) : objectPageRows.map((obj, i) => {
                    const info = objTypeInfo(obj.name);
                    return (
                      <tr key={obj.name} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Icon name={info.icon} size={13} style={{ color: info.color, flexShrink: 0 }} />
                            <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>{obj.name}</span>
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span className="num mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{obj.size}</span>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{obj.modified}</span>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {info.preview && (
                              <button title={tr('obj.preview')}
                                onClick={() => shell.showToast(tr('obj.previewToast').replace('{name}', obj.name), { kind: 'info' })}
                                style={{
                                  width: 26, height: 26, background: 'var(--bg-2)',
                                  color: 'var(--fg-2)', border: '1px solid var(--border)',
                                  borderRadius: 3, cursor: 'pointer', padding: 0,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                <Icon name="eye" size={11} />
                              </button>
                            )}
                            <button title={tr('obj.download')}
                              onClick={() => shell.showToast(tr('obj.downloadToast').replace('{name}', obj.name), { kind: 'success' })}
                              style={{
                                width: 26, height: 26, background: 'var(--bg-2)',
                                color: 'var(--info)', border: '1px solid var(--border)',
                                borderRadius: 3, cursor: 'pointer', padding: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <Icon name="download" size={11} />
                            </button>
                            <button title={tr('obj.presignedLink')}
                              onClick={() => openPresignedUrl(obj)}
                              style={{
                                width: 26, height: 26, background: 'var(--bg-2)',
                                color: 'var(--cyan)', border: '1px solid var(--border)',
                                borderRadius: 3, cursor: 'pointer', padding: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <Icon name="link" size={11} />
                            </button>
                            <button title={tr('obj.delete')}
                              onClick={() => shell.openConfirm({
                                title: tr('obj.deleteTitle'),
                                body: <div><span className="mono">{obj.name}</span><div style={{ marginTop: 4, color: 'var(--fg-3)' }}>{tr('obj.deleteBody').replace('{size}', obj.size)}</div></div>,
                                danger: true, confirmLabel: tr('obj.delete'),
                                onConfirm: async () => {
                                  try {
                                    const bucket = localBuckets.find(b => b.name === activeBucket);
                                    const ns = bucket ? bucket.namespace : '';
                                    const j = await window.ociServices.storage.deleteObject({ tenantId, namespace: ns, bucketName: activeBucket, objectName: obj.name });
                                    if (j && j.success) { setObjectsMap(m => ({ ...m, [activeBucket]: (m[activeBucket] || []).filter(x => x.name !== obj.name) })); shell.showToast(tr('obj.deleted').replace('{name}', obj.name), { kind: 'warn' }); }
                                    else shell.showToast(tr('obj.deleteFail').replace('{err}', (j && j.message) || ''), { kind: 'error' });
                                  } catch (e) { shell.showToast(tr('obj.deleteFail').replace('{err}', e.message || e), { kind: 'error' }); }
                                },
                              })}
                              style={{
                                width: 26, height: 26, background: 'var(--bg-2)',
                                color: 'var(--danger)', border: '1px solid var(--border)',
                                borderRadius: 3, cursor: 'pointer', padding: 0,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <Icon name="trash-2" size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 对象分页 */}
          {activeBucket && objects.length > objectPageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }} className="num">
                {tr('obj.summary').replace('{total}', objects.length).replace('{page}', Math.min(objectPage, objectTotalPages)).replace('{pages}', objectTotalPages)}
              </span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button onClick={() => setObjectPage(p => Math.max(1, p - 1))}
                  disabled={objectPage <= 1}
                  style={{ padding: '2px 10px', background: 'var(--bg-1)', color: objectPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: objectPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>{tr('common.prev')}</button>
                <button onClick={() => setObjectPage(p => Math.min(objectTotalPages, p + 1))}
                  disabled={objectPage >= objectTotalPages}
                  style={{ padding: '2px 10px', background: 'var(--bg-1)', color: objectPage >= objectTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: objectPage >= objectTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>{tr('common.next')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OCI AI 管理 · 整页 · 严格对齐原项目 ai_model_config.ftl
//   /ai/modelConfig —— 双面板布局:
//     ┌──────────────────────┬───────────────────────┐
//     │ 左:可用 AI 模型      │ 右:已配置的模型         │
//     │  · 模型卡片 + 分页   │  · 关联租户开关         │
//     │  · 添加配置          │  · 启用/禁用全部       │
//     │                      │  · 刷新                 │
//     └──────────────────────┴───────────────────────┘
//   顶部:租户选择
//   点击 "AI 对话" 按钮 → 跳转 chat drawer(对应原 /ai/chat)
// ═══════════════════════════════════════════════════════════════════════
function AIPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [tenants, setTenants] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    window.ociServices.ai.tenants()
      .then(rows => { if (alive) setTenants((Array.isArray(rows) ? rows : []).map(t => ({ ...t, id: String(t.id), name: t.name || '', tname: t.tname || '' }))); })
      .catch(() => { if (alive) setTenants([]); });
    return () => { alive = false; };
  }, []);
  const [tenantId, setTenantId] = React.useState('');
  const currentTenant = tenants.find(t => t.id === tenantId);

  // ─── 可用模型元数据表(仅用于补齐 category/params/ctx 展示) ──
  // ─── 真实后端 · 当前租户可选模型(GET /system/ai/modelsByTenant) ──
  const [availableModels, setAvailableModels] = React.useState([]);
  React.useEffect(() => {
    if (!currentTenant) { setAvailableModels([]); return; }
    let alive = true;
    window.ociServices.ai.modelsByTenant({ tenantId: currentTenant.id })
      .then(arr => {
        if (!alive) return;
        const list = (Array.isArray(arr) ? arr : []).map(m => {
          return {
            id: m.id,
            model: m.id,
            name: m.name || m.modelName || m.id,
            provider: m.provider || 'OCI',
            category: 'chat',
            params: '?',
            ctx: '?',
          };
        });
        setAvailableModels(list);
      })
      .catch(() => { if (alive) setAvailableModels([]); });
    return () => { alive = false; };
  }, [currentTenant]);

  // ─── 真实后端 · 已配置的 AI 记录(GET /system/telegramAiConfigs) ──
  const [tenantLinkOn, setTenantLinkOn] = React.useState(true);
  const [configs, setConfigs] = React.useState([]);
  const loadConfigs = React.useCallback(async () => {
    try {
      const arr = await window.ociServices.ai.configs();
      setConfigs((Array.isArray(arr) ? arr : []).map(c => ({
        id: c.id, tenantId: c.tenantId, provider: c.provider || 'OCI',
        model: c.modelId || c.modelName, name: c.modelName || c.modelId || '',
        region: c.region || '', enabled: !!c.enabled, addedAt: '', modelId: c.modelId || '',
      })));
    } catch (_) {}
  }, []);
  React.useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const allMyConfigs = currentTenant ? configs.filter(c => String(c.tenantId) === String(currentTenant.id)) : [];
  const myConfigs = tenantLinkOn ? allMyConfigs : configs;
  const configuredModelIds = new Set(myConfigs.map(c => c.modelId || c.model));

  // ─── 分页 ───────────────────────────────────────
  const [modelPage, setModelPage] = React.useState(1);
  const [configPage, setConfigPage] = React.useState(1);
  const pageSize = 4;
  React.useEffect(() => { setModelPage(1); setConfigPage(1); }, [tenantId]);

  const modelTotalPages = Math.max(1, Math.ceil(availableModels.length / pageSize));
  const modelPageRows = availableModels.slice((modelPage - 1) * pageSize, modelPage * pageSize);
  const configTotalPages = Math.max(1, Math.ceil(myConfigs.length / pageSize));
  const configPageRows = myConfigs.slice((configPage - 1) * pageSize, configPage * pageSize);

  // ─── 操作(真实后端) ─────────────────────────────
  const addConfig = async (m) => {
    if (!currentTenant) return;
    try {
      await window.ociServices.ai.save({ tenantId: currentTenant.id, modelId: m.id, modelName: m.name, provider: m.provider, enabled: true, cloudType: 1, userName: '' });
      await loadConfigs();
      shell.showToast(tr('pageMisc.8b5b5b').replace('{0}',m.name), { kind: 'success' });
    } catch (e) { shell.showToast(e.message || tr('pageMisc.6452a0'), { kind: 'error' }); }
  };

  const removeConfig = (cfg) => {
    shell.openConfirm({
      title: tr('pageMisc.c10b12').replace('{0}',cfg.name),
      body: <div>{tr('pageMisc.bf468e')} <b>{getTenantName(currentTenant)}</b> {tr('pageMisc.8099ae')}<br/>{tr('pageMisc.cff08f')}</div>,
      danger: true, confirmLabel: tr('pageMisc.2f4aad'),
      onConfirm: async () => {
        try {
          await window.ociServices.ai.remove({ id: cfg.id });
          await loadConfigs();
          shell.showToast(tr('pageMisc.39fda4').replace('{0}',cfg.name), { kind: 'warn' });
        } catch (e) { shell.showToast(e.message || tr('pageMisc.acf066'), { kind: 'error' }); }
      },
    });
  };

  const toggleConfig = async (cfg) => {
    try {
      await window.ociServices.ai.save({ id: cfg.id, enabled: !cfg.enabled });
      await loadConfigs();
    } catch (e) { shell.showToast(e.message || tr('pageMisc.2d5fba'), { kind: 'error' }); }
  };

  const toggleAll = async (enable) => {
    try {
      await window.ociServices.ai.batchToggle({ enabled: enable });
      await loadConfigs();
      shell.showToast(enable ? tr('pageMisc.62c6cd') : tr('pageMisc.593b4b'), { kind: enable ? 'success' : 'warn' });
    } catch (e) { shell.showToast(e.message || tr('pageMisc.5fa802'), { kind: 'error' }); }
  };

  // ─── AI 对话 drawer(对齐原 /ai/chat) ───────────────
  const openChatDrawer = () => {
    if (!currentTenant) { shell.showToast(tr('pageMisc.6554d5'), { kind: 'warn' }); return; }
    const enabledConfigs = allMyConfigs.filter(c => c.enabled);
    if (enabledConfigs.length === 0) { shell.showToast(tr('pageMisc.7ea67b'), { kind: 'warn' }); return; }
    openChatDrawerFor(shell, currentTenant, enabledConfigs, tr);
  };

  // ─── 分类徽章 ──────────────────────────────────
  const catCfg = {
    chat:      { label: tr('pageMisc.859362'),      color: 'var(--info)',   bg: 'var(--info-soft)',   icon: 'message-square' },
    vision:    { label: tr('pageMisc.7992ac'),      color: 'var(--violet)', bg: 'var(--violet-soft)', icon: 'eye' },
    embedding: { label: tr('pageMisc.970055'),      color: 'var(--cyan)',   bg: 'var(--cyan-soft)',   icon: 'grid' },
  };
  const providerColor = {
    Cohere:    'var(--cyan)',
    Meta:      'var(--info)',
    Anthropic: 'var(--orange)',
  };

  // ─── KPI ───────────────────────────────────────
  const enabledCount = myConfigs.filter(c => c.enabled).length;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.ai')}
        subtitle={tr('pageMisc.f3bc1a')}
        icon="cpu"
        iconColor="var(--violet)"
        actions={
          <>
            <span style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{tr('pageMisc.25d3ff')}</span>
            <CustomDropdown value={tenantId} onChange={e => setTenantId(e)} height={32} width="240px">
              <option value="">{tr('pageMisc.6c7d53')}</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.tname || getTenantLabel(t, lang)}</option>
              ))}
            </CustomDropdown>
            <Button variant="violet" size="md" icon="message-square" disabled={!currentTenant}
              onClick={() => {
                // 跳转全屏 AI 对话工作台并预选租户（对齐 macOS 客户端 AiChatView）
                try { window.ociRouter?.go('aiChat', { tenantId: String(currentTenant.id) }); }
                catch (_) { shell.showToast(tr('pageMisc.6554d5'), { kind: 'warn' }); }
              }}
            >{tr('pageMisc.5a36be')}</Button>
          </>
        }
      />

      {/* KPI · 仅在选中租户时展示 */}
      {currentTenant && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12, marginBottom: 14,
        }}>
          <KPICard label={tr('pageMisc.133887')} value={availableModels.length} icon="cpu" iconColor="var(--info)" />
          <KPICard label={tr('pageMisc.da208e')} value={myConfigs.length} icon="check-circle" iconColor="var(--accent)" />
          <KPICard label={tr('pageMisc.53ace4')} value={enabledCount} icon="zap" iconColor="var(--violet)" />
          <KPICard label={tr('pageMisc.d2ccf9')} value={<span className="mono" style={{ fontSize: 13 }}>{getTenantRegion(currentTenant)}</span>} icon="globe" iconColor="var(--cyan)" />
        </div>
      )}

      {/* 双栏 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        {/* ═══ 左:可用 AI 模型 ═══ */}
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="cpu" size={13} style={{ color: 'var(--fg-2)' }} />
              {tr('pageMisc.7bf2cb')}
              {currentTenant && <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({availableModels.length})</span>}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!currentTenant ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="hand" size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                <div>{tr('pageMisc.9a44e5')}</div>
              </div>
            ) : modelPageRows.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                <div style={{ marginTop: 6 }}>{tr('pageMisc.1b5dd9')}</div>
              </div>
            ) : modelPageRows.map(m => {
              const added = configuredModelIds.has(m.model);
              const cat = catCfg[m.category];
              return (
                <div key={m.id} style={{
                  padding: '12px 14px',
                  background: 'var(--bg-2)',
                  border: '1px solid ' + (added ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 8,
                  transition: 'border-color 120ms',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: 'color-mix(in oklab, ' + (providerColor[m.provider] || 'var(--fg-2)') + ' 20%, transparent)',
                      color: providerColor[m.provider] || 'var(--fg-2)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon name="cpu" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{m.name}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 6px', borderRadius: 3,
                          background: cat.bg, color: cat.color,
                          fontSize: 9.5, fontWeight: 600,
                        }}>
                          <Icon name={cat.icon} size={9} />{cat.label}
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)', marginTop: 3 }}>{m.model}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10.5, color: 'var(--fg-3)' }}>
                        <span>{tr('pageMisc.8da5f7')} <span style={{ color: providerColor[m.provider] || 'var(--fg-1)', fontWeight: 500 }}>{m.provider}</span></span>
                        <span>·</span>
                        <span>{tr('pageMisc.3d0a2d')} <span className="num" style={{ color: 'var(--fg-1)' }}>{m.params}</span></span>
                        <span>·</span>
                        <span>{tr('pageMisc.50f198')} <span className="num" style={{ color: 'var(--fg-1)' }}>{m.ctx}</span></span>
                      </div>
                    </div>
                    {added ? (
                      <button disabled
                        style={{
                          padding: '5px 12px',
                          background: 'var(--accent-soft)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          borderRadius: 4, cursor: 'not-allowed',
                          fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          whiteSpace: 'nowrap',
                        }}>
                        <Icon name="check" size={11} />{tr('pageMisc.b18955')}
                      </button>
                    ) : (
                      <button onClick={() => addConfig(m)}
                        style={{
                          padding: '5px 12px',
                          background: 'var(--accent)',
                          color: 'var(--accent-fg)',
                          border: 'none', borderRadius: 4, cursor: 'pointer',
                          fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          whiteSpace: 'nowrap',
                        }}>
                        <Icon name="plus" size={11} />{tr('pageMisc.11e5e6')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          {currentTenant && availableModels.length > pageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
              gap: 8,
            }}>
              <button onClick={() => setModelPage(p => Math.max(1, p - 1))}
                disabled={modelPage <= 1}
                style={{ padding: '3px 10px', background: 'var(--bg-1)', color: modelPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: modelPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>‹</button>
              <span className="num" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{modelPage} / {modelTotalPages}</span>
              <button onClick={() => setModelPage(p => Math.min(modelTotalPages, p + 1))}
                disabled={modelPage >= modelTotalPages}
                style={{ padding: '3px 10px', background: 'var(--bg-1)', color: modelPage >= modelTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: modelPage >= modelTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>›</button>
            </div>
          )}
        </div>

        {/* ═══ 右:已配置的模型 ═══ */}
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="settings-2" size={13} style={{ color: 'var(--fg-2)' }} />
              {tr('pageMisc.9beff6')}
              {currentTenant && <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({myConfigs.length})</span>}
            </div>
            {/* 头部 actions:关联租户 + 主开关 + 刷新 · 对齐原项目 panel-actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10.5, color: 'var(--fg-2)', cursor: currentTenant ? 'pointer' : 'not-allowed',
              }} title={tr('pageMisc.b6c4d7')}>
                <Icon name="link" size={10} />
                <span>{tr('pageMisc.b6c4d7')}</span>
                <input type="checkbox" checked={tenantLinkOn} disabled={!currentTenant}
                  onChange={e => setTenantLinkOn(e.target.checked)}
                  style={{ margin: 0, cursor: currentTenant ? 'pointer' : 'not-allowed' }} />
              </label>
              <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10.5, color: 'var(--fg-2)', cursor: currentTenant && myConfigs.length ? 'pointer' : 'not-allowed',
              }} title={enabledCount === myConfigs.length && myConfigs.length > 0 ? tr('pageMisc.4b0580') : tr('pageMisc.f379a9')}>
                <Icon name="zap" size={10} />
                <span>{tr('pageMisc.f379a9')}</span>
                <input type="checkbox"
                  checked={myConfigs.length > 0 && enabledCount === myConfigs.length}
                  disabled={!currentTenant || !myConfigs.length}
                  onChange={e => toggleAll(e.target.checked)}
                  style={{ margin: 0, cursor: currentTenant && myConfigs.length ? 'pointer' : 'not-allowed' }} />
              </label>
              <button onClick={() => { loadConfigs(); shell.showToast(tr('pageMisc.9beca9'), { kind: 'info' }); }}
                disabled={!currentTenant}
                title={tr('pageMisc.694fc5')}
                style={{
                  padding: '3px 8px', background: 'var(--bg-1)',
                  color: currentTenant ? 'var(--fg-2)' : 'var(--fg-3)',
                  border: '1px solid var(--border)', borderRadius: 3,
                  cursor: currentTenant ? 'pointer' : 'not-allowed',
                  fontSize: 10.5, fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center',
                }}>
                <Icon name="refresh-cw" size={10} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!currentTenant ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="settings-2" size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                <div>{tr('pageMisc.956cfd')}</div>
              </div>
            ) : configPageRows.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                <div style={{ marginTop: 6 }}>{tr('pageMisc.dc29bd')}</div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {tr('pageMisc.bb75c0')}
                </div>
              </div>
            ) : configPageRows.map(c => (
              <div key={c.id} style={{
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '1px solid ' + (c.enabled ? 'var(--border)' : 'var(--border)'),
                borderLeft: '3px solid ' + (c.enabled ? 'var(--accent)' : 'var(--fg-3)'),
                borderRadius: 6,
                opacity: c.enabled ? 1 : 0.6,
                transition: 'opacity 120ms',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: 'color-mix(in oklab, ' + (providerColor[c.provider] || 'var(--fg-2)') + ' 20%, transparent)',
                    color: providerColor[c.provider] || 'var(--fg-2)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name="cpu" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{c.name}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 3,
                        background: c.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
                        color: c.enabled ? 'var(--accent)' : 'var(--fg-3)',
                        fontSize: 9.5, fontWeight: 700,
                      }}>{c.enabled ? tr('pageMisc.53ace4') : tr('pageMisc.1c1ed9')}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)', marginTop: 3 }}>{c.model}</div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10.5, color: 'var(--fg-3)' }}>
                      <span>{tr('pageMisc.8da5f7')} <span style={{ color: providerColor[c.provider] || 'var(--fg-1)', fontWeight: 500 }}>{c.provider}</span></span>
                      <span>·</span>
                      <span className="mono">{tr('pageMisc.d3ce40')} {c.region}</span>
                      <span>·</span>
                      <span>{tr('pageMisc.b3d03f')} <span className="mono">{c.addedAt}</span></span>
                    </div>
                  </div>
                  {/* 启用/禁用 toggle + 删除 */}
                  <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleConfig(c)}
                      title={c.enabled ? tr('pageMisc.710ad0') : tr('pageMisc.7854b5')}
                      style={{
                        padding: '5px 10px',
                        background: c.enabled ? 'var(--orange-soft)' : 'var(--accent-soft)',
                        color: c.enabled ? 'var(--orange)' : 'var(--accent)',
                        border: '1px solid ' + (c.enabled ? 'var(--orange)' : 'var(--accent)'),
                        borderRadius: 4, cursor: 'pointer',
                        fontSize: 10.5, fontFamily: 'inherit', fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                      <Icon name={c.enabled ? 'square' : 'play'} size={10} />
                      {c.enabled ? tr('pageMisc.710ad0') : tr('pageMisc.7854b5')}
                    </button>
                    <button onClick={() => removeConfig(c)}
                      title={tr('pageMisc.2f4aad')}
                      style={{
                        width: 28, height: 28, background: 'transparent',
                        color: 'var(--fg-3)', border: '1px solid var(--border)',
                        borderRadius: 4, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                      <Icon name="trash-2" size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {currentTenant && myConfigs.length > pageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
              gap: 8,
            }}>
              <button onClick={() => setConfigPage(p => Math.max(1, p - 1))}
                disabled={configPage <= 1}
                style={{ padding: '3px 10px', background: 'var(--bg-1)', color: configPage <= 1 ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: configPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>‹</button>
              <span className="num" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{configPage} / {configTotalPages}</span>
              <button onClick={() => setConfigPage(p => Math.min(configTotalPages, p + 1))}
                disabled={configPage >= configTotalPages}
                style={{ padding: '3px 10px', background: 'var(--bg-1)', color: configPage >= configTotalPages ? 'var(--fg-3)' : 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 3, cursor: configPage >= configTotalPages ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AI 对话 · 全屏沉浸式工作台（100% 对齐 macOS 客户端 AiChatView）
//   /tools/ai-chat?tenantId=...
//     ┌────────────┬──────────────────────────────────────────────┐
//     │ 左租户轨    │  顶栏:租户切换 · 模型选择 · 上下文 · 清空/复制 │
//     │ (280px 可折 │──────────────────────────────────────────────│
//     │  叠,Hero 头 │  消息流:用户右侧气泡 / AI 左侧全宽块 / 三点动画 │
//     │  像+搜索+列 │──────────────────────────────────────────────│
//     │  表+底部提示)│  Hero 空态:渐变图标 + 灵感 chip · 自适应输入栏 │
//     └────────────┴──────────────────────────────────────────────┘
//   WS 协议: /ws/aiChat · init → chat(isChunk 流式)/chat_end/error
// ═══════════════════════════════════════════════════════════════════════
function AiChatPage() {
  const { t: tr } = useT();
  const shell = useShell();
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [tenants, setTenants] = React.useState([]);
  const [selectedTenantId, setSelectedTenantId] = React.useState(null);
  const [models, setModels] = React.useState([]);
  const [selectedModelId, setSelectedModelId] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [useHistory, setUseHistory] = React.useState(true);
  const [statusText, setStatusText] = React.useState('请选择租户');
  const [isConnected, setIsConnected] = React.useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = React.useState(true);
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [errorText, setErrorText] = React.useState('');
  const [tenantSearch, setTenantSearch] = React.useState('');
  const [showTenantRail, setShowTenantRail] = React.useState(true);
  const [inputHeight, setInputHeight] = React.useState(24);
  const [streamIdx, setStreamIdx] = React.useState(0); // 流式拼接刷新令牌

  const wsRef = React.useRef(null);
  const currentTenantIdRef = React.useRef(0);
  const canvasRef = React.useRef(null);
  const pendingTenantRef = React.useRef(null);

  const selectedTenant = tenants.find(t => String(t.id) === String(selectedTenantId)) || null;

  const filteredTenants = React.useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t =>
      (t.name || '').toLowerCase().includes(q) || (t.region || '').toLowerCase().includes(q));
  }, [tenants, tenantSearch]);

  const seedWelcome = () => setMessages([
    { id: 'welcome', role: 'ai', content: '你好！我是 OCI AI 助手。选择左侧租户与模型后，即可开始对话。', time: new Date().toTimeString().slice(0, 5) },
  ]);

  // ─── 加载租户(对齐客户端 /tenants/list/json · supportAI 过滤) ──
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoadingTenants(true);
      try {
        const rows = await window.ociServices.tenant.listParentTenants();
        if (!alive) return;
        const list = (Array.isArray(rows) ? rows : []).map(row => window.ociTenantRow.normalize(row, []));
        setTenants(list);
        // 深链接预选:URL tenantId → 列表首个
        let initial = null;
        const routeTenant = (() => { try { return window.ociRouter?.read?.().query?.tenantId || ''; } catch { return ''; } })();
        if (routeTenant) initial = list.find(t => String(t.id) === String(routeTenant)) || null;
        if (!initial && list.length) initial = list[0];
        if (initial) {
          setSelectedTenantId(String(initial.id));
          currentTenantIdRef.current = initial.id;
        }
      } catch (e) {
        if (alive) { setErrorText(e.message || '加载租户失败'); }
      } finally {
        if (alive) { setIsLoadingTenants(false); setHasLoadedOnce(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // ─── 加载模型 + 建立 WS(对齐客户端 /ai/models) ──
  const connectWS = React.useCallback((tenantId, modelId) => {
    if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} wsRef.current = null; }
    if (!tenantId || !modelId) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = location.host === '9857' || location.port === '9857' ? `${location.hostname}:9857` : location.host;
    let ws;
    try { ws = new WebSocket(`${proto}://${base}/ws/aiChat`); } catch (e) { setStatusText('连接失败'); return; }
    wsRef.current = ws;
    setStatusText('连接中…');
    ws.onopen = () => {
      // 对齐客户端:连接建立后 250ms 发送 init
      setTimeout(() => {
        if (wsRef.current !== ws) return;
        ws.send(JSON.stringify({
          type: 'init',
          tenant: { tenantId: String(tenantId), modelId },
        }));
      }, 250);
    };
    ws.onmessage = (ev) => {
      let obj;
      try { obj = JSON.parse(ev.data); } catch (_) { return; }
      const type = obj.type || '';
      if (type === 'init') {
        if (obj.status && obj.status !== 'success') {
          setIsConnected(false);
          setStatusText(obj.message || '初始化失败');
        } else {
          setIsConnected(true);
          setStatusText('已连接');
        }
      } else if (type === 'chat') {
        const role = obj.role || '';
        const msg = obj.message || '';
        if (role !== 'assistant' || !msg) return;
        const isChunk = obj.isChunk === true;
        setMessages(prev => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (isChunk) {
            if (last && last.role === 'assistant' && last.streaming) {
              next[next.length - 1] = { ...last, content: last.content + msg };
            } else {
              next.push({ id: `a-${Date.now()}`, role: 'ai', content: msg, time: new Date().toTimeString().slice(0, 5), streaming: true });
            }
          } else if (last && last.role === 'assistant' && last.streaming) {
            next[next.length - 1] = { ...last, content: msg, streaming: false };
          } else {
            next.push({ id: `a-${Date.now()}`, role: 'ai', content: msg, time: new Date().toTimeString().slice(0, 5) });
          }
          return next;
        });
        setStreamIdx(v => v + 1);
      } else if (type === 'chat_end') {
        setMessages(prev => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.role === 'assistant' && last.streaming) {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
        setIsSending(false);
        setIsConnected(true);
        setStatusText('已连接');
      } else if (type === 'error') {
        setIsSending(false);
        const m = obj.message || 'AI 错误';
        setStatusText(m);
        shell.showToast(m, { kind: 'error' });
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'system', content: m, time: new Date().toTimeString().slice(0, 5) }]);
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) {
        setIsConnected(false);
        setIsSending(false);
        setStatusText('已断开');
      }
    };
    ws.onerror = () => { if (wsRef.current === ws) setStatusText('连接异常'); };
  }, [shell]);

  // 切换租户 → 立即清空消息与模型并重建连接（杜绝旧会话残留）
  React.useEffect(() => {
    if (!selectedTenantId) return;
    setMessages([]);
    seedWelcome();
    setModels([]);
    setSelectedModelId('');
    setIsConnected(false);
    setIsLoadingModels(true);
    setStatusText('加载模型…');
    let alive = true;
    (async () => {
      try {
        const j = await window.ociApi.request('/ai/models?tenantId=' + encodeURIComponent(String(selectedTenantId)));
        if (!alive) return;
        if (j && j.success === false) throw new Error(j.message || '获取模型失败');
        const list = (j?.models || []).map(m => ({ id: m.id, name: m.displayName || m.id, version: m.version || '' }));
        setModels(list);
        const first = list[0]?.id || '';
        setSelectedModelId(first);
        if (list.length === 0) setStatusText('该租户暂无可用模型');
        else connectWS(selectedTenantId, first);
      } catch (e) {
        if (alive) { setStatusText(e.message || '获取模型失败'); shell.showToast(e.message || '获取模型失败', { kind: 'error' }); }
      } finally {
        if (alive) setIsLoadingModels(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedTenantId, connectWS, shell]);

  // 模型切换 → 重连
  const onModelChanged = (modelId) => {
    setSelectedModelId(modelId);
    if (selectedTenantId && modelId) connectWS(selectedTenantId, modelId);
  };

  // 卸载时关闭 WS
  React.useEffect(() => () => { if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} } }, []);

  // 消息自动滚动到底部
  React.useEffect(() => {
    const el = canvasRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, streamIdx]);

  const canSend = isConnected && !isSending && input.trim().length > 0 && !!selectedModelId;

  const send = () => {
    const text = input.trim();
    if (!text) return;
    if (!isConnected) { shell.showToast('WebSocket 未连接', { kind: 'error' }); return; }
    if (!selectedModelId) { shell.showToast('请选择模型', { kind: 'error' }); return; }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) { shell.showToast('WebSocket 未连接', { kind: 'error' }); return; }
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text, time: new Date().toTimeString().slice(0, 5) }]);
    setInput('');
    setInputHeight(24);
    setIsSending(true);
    setStatusText('AI 思考中…');
    ws.send(JSON.stringify({
      type: 'chat',
      message: text,
      modelId: selectedModelId,
      tenantId: String(selectedTenantId),
      useHistory,
    }));
  };

  const clearChat = () => {
    setMessages([]);
    seedWelcome();
    setIsSending(false);
  };

  const copyLastAssistant = () => {
    const last = [...messages].reverse().find(m => m.role === 'ai');
    if (!last) { shell.showToast('暂无回复可复制', { kind: 'error' }); return; }
    navigator.clipboard?.writeText(last.content);
    shell.showToast('已复制 AI 回复', { kind: 'success' });
  };

  const statusColor = isConnected ? 'var(--accent)' : (statusText.includes('断开') || statusText.includes('失败') || statusText.includes('异常')) ? 'var(--danger)' : 'var(--orange)';
  const showHeroEmpty = messages.length <= 1 && !isSending && (messages.length === 0 || messages[0].role === 'ai');

  const suggestChip = (title) => (
    <button
      onClick={() => { if (!canSend) return; setInput(title); setTimeout(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: title, time: new Date().toTimeString().slice(0, 5) }]);
        setInput(''); setIsSending(true); setStatusText('AI 思考中…');
        ws.send(JSON.stringify({ type: 'chat', message: title, modelId: selectedModelId, tenantId: String(selectedTenantId), useHistory }));
      }, 0); }}
      disabled={!canSend}
      style={{
        padding: '8px 12px', fontSize: 12, borderRadius: 999,
        background: 'var(--bg-2)', color: canSend ? 'var(--fg-1)' : 'var(--fg-3)',
        border: '1px solid var(--border)', cursor: canSend ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit', opacity: canSend ? 1 : 0.45,
      }}
    >{title}</button>
  );

  // ─── 左侧租户轨 ──
  const tenantRail = (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--bg-1)', borderRight: '1px solid var(--border)',
    }}>
      {/* Hero 头部 */}
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--violet) 100%)',
            boxShadow: '0 3px 10px color-mix(in oklab, var(--accent) 35%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Icon name="sparkles" size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>OCI AI</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>智能助手 · 按租户对话</div>
          </div>
          <button
            onClick={() => setShowTenantRail(false)}
            title="收起租户列"
            style={{
              width: 28, height: 28, borderRadius: 7, background: 'var(--bg-2)',
              color: 'var(--fg-2)', border: '1px solid var(--border)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="panel-left-close" size={13} />
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <SearchInput placeholder="搜索租户或区域…" value={tenantSearch} onChange={setTenantSearch} size="sm" width="100%" />
        </div>
      </div>

      {/* 租户列表 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {isLoadingTenants ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: 'var(--fg-3)', fontSize: 12.5 }}>
            <Icon name="loader-2" size={16} className="spin" />加载租户…
          </div>
        ) : filteredTenants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-3)', fontSize: 12 }}>无匹配租户</div>
        ) : filteredTenants.map(t => {
          const selected = String(t.id) === String(selectedTenantId);
          return (
            <div key={t.id}
              onClick={() => { setSelectedTenantId(String(t.id)); currentTenantIdRef.current = t.id; setShowTenantRail(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px', borderRadius: 10, cursor: 'pointer',
                marginBottom: 4,
                background: selected ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
                border: '1px solid ' + (selected ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'transparent'),
                transition: 'background 120ms',
              }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: selected
                  ? 'linear-gradient(135deg, var(--accent) 0%, var(--violet) 90%)'
                  : 'var(--bg-3)',
                color: selected ? '#fff' : 'var(--fg-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>{(t.name || '?').charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--fg-3)', marginTop: 3 }}>
                  <Icon name="map-pin" size={9} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{window.getTenantRegion(t) || '未知区域'}</span>
                </div>
              </div>
              <Icon name="sparkles" size={11} style={{ color: selected ? 'var(--accent)' : 'color-mix(in oklab, var(--accent) 55%, transparent)', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div style={{ padding: '10px 14px', fontSize: 10, color: 'var(--fg-3)', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="info" size={10} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>从租户列表点 AI 可直达本页</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
      {showTenantRail && tenantRail}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-0)' }}>
        {/* 顶栏 */}
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          {!showTenantRail && (
            <button
              onClick={() => setShowTenantRail(true)}
              title="展开租户列"
              style={{
                width: 32, height: 32, borderRadius: 9, background: 'var(--bg-2)',
                color: 'var(--fg-2)', border: '1px solid var(--border)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Icon name="panel-left-open" size={14} />
            </button>
          )}
          <button
            onClick={() => setShowTenantRail(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, padding: '4px 10px 4px 4px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10,
            }}
            title="切换租户"
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--violet) 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
            }}>
              {selectedTenant ? (selectedTenant.name || '?').charAt(0).toUpperCase() : <Icon name="users" size={13} />}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedTenant ? selectedTenant.name : '未选择租户'}
                <Icon name="chevron-down" size={9} style={{ color: 'var(--fg-3)' }} />
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: statusColor, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: isConnected ? 'pulse-dot 2s infinite' : 'none' }} />
                {statusText}
              </div>
            </div>
          </button>

          <div style={{ flex: 1 }} />

          {isLoadingModels ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-3)', padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 999 }}>
              <Icon name="loader-2" size={12} className="spin" />加载模型…
            </span>
          ) : models.length > 0 ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <Icon name="cpu" size={11} style={{ color: 'var(--violet)' }} />
              <CustomDropdown value={selectedModelId} onChange={onModelChanged} height={30} width={220}>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </CustomDropdown>
            </div>
          ) : selectedTenantId ? (
            <span style={{ fontSize: 11, color: 'var(--orange)', padding: '6px 10px', background: 'color-mix(in oklab, var(--orange) 12%, transparent)', borderRadius: 999 }}>
              暂无可用模型
            </span>
          ) : null}

          <button
            onClick={() => setUseHistory(v => !v)}
            title="是否携带历史消息作为上下文"
            style={{
              padding: '7px 10px', fontSize: 11.5, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              background: useHistory ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'var(--bg-2)',
              border: '1px solid ' + (useHistory ? 'color-mix(in oklab, var(--accent) 35%, transparent)' : 'var(--border)'),
              color: useHistory ? 'var(--accent)' : 'var(--fg-2)',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="history" size={11} />上下文
          </button>
          <button onClick={clearChat} title="清空会话" style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--bg-2)', color: 'var(--fg-2)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="trash-2" size={13} />
          </button>
          <button onClick={copyLastAssistant} title="复制最后回复" style={{
            width: 32, height: 32, borderRadius: 9, background: 'var(--bg-2)', color: 'var(--fg-2)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="copy" size={13} />
          </button>
        </div>

        {/* 消息画布 */}
        <div ref={canvasRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px 88px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%' }}>
            {showHeroEmpty && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, paddingBottom: 24 }}>
                <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 28%, transparent) 0%, color-mix(in oklab, var(--accent) 5%, transparent) 55%, transparent 70%)',
                  }} />
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--violet) 100%)',
                    boxShadow: '0 6px 16px color-mix(in oklab, var(--accent) 40%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}>
                    <Icon name="sparkles" size={26} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 8 }}>有什么可以帮你的？</div>
                <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 18, textAlign: 'center' }}>
                  {selectedTenant ? `正在与 ${selectedTenant.name} 的 OCI AI 模型对话` : '从左侧选择一个租户，开始智能对话'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {suggestChip('解释当前区域配额')}
                  {suggestChip('生成安全组建议')}
                  {suggestChip('总结实例状态')}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (showHeroEmpty && i === 0 && m.role === 'ai' && messages.length === 1) return null;
              if (m.role === 'user') {
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{
                        padding: '9px 12px', borderRadius: 8,
                        background: 'var(--info-soft)', border: '1px solid var(--info)',
                        fontSize: 12.5, color: 'var(--fg-0)', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>{m.content}</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{m.time}</div>
                    </div>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--info-soft)', color: 'var(--info)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="user" size={12} />
                    </div>
                  </div>
                );
              }
              if (m.role === 'system') {
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 12,
                      background: 'color-mix(in oklab, var(--orange) 12%, transparent)',
                      color: '#d97706', fontSize: 13,
                    }}>
                      <Icon name="alert-triangle" size={12} />{m.content}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--violet-soft)', color: 'var(--violet)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="cpu" size={12} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '100%', padding: '9px 12px', borderRadius: 8,
                      background: 'var(--bg-2)', border: '1px solid var(--border)',
                      fontSize: 12.5, color: 'var(--fg-1)', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.content}{m.streaming && <span style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--violet)', marginLeft: 2, verticalAlign: '-2px', animation: 'pulse-dot 1s infinite' }} />}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>{m.time}</div>
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                <Icon name="loader-2" size={14} className="spin" style={{ color: 'var(--fg-3)' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)' }}>AI 正在思考…</span>
              </div>
            )}
          </div>
        </div>

        {/* 输入区 */}
        <div style={{ padding: '10px 20px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0 }}>
          {errorText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>
              <Icon name="alert-circle" size={12} />{errorText}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value);
                const lines = Math.min(4, (e.target.value.split('\n').length || 1));
                setInputHeight(Math.min(96, Math.max(24, lines * 24)));
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="畅所欲问…"
              rows={1}
              style={{
                flex: 1, resize: 'none', height: inputHeight + 20, lineHeight: '20px',
                padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                background: 'var(--bg-2)', color: 'var(--fg-0)',
                border: '1px solid var(--border)', borderRadius: 10, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={send}
              disabled={!canSend}
              title="发送"
              style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: canSend ? 'var(--fg-0)' : 'var(--bg-3)',
                color: canSend ? 'var(--bg-1)' : 'var(--fg-3)',
                border: 'none', cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isSending ? <Icon name="loader-2" size={15} className="spin" /> : <Icon name="arrow-up" size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI 对话 drawer(对齐 /ai/chat) ────────────────
// 从 AI 管理页顶部"AI 对话"按钮和租户菜单"AI 对话"入口打开
function openChatDrawerFor(shell, tenant, enabledConfigs, tr) {
  const state = {
    modelId: enabledConfigs[0]?.id,
    input: '',
    useHistory: true,
    sending: false,
    messages: [],
  };

  const send = () => {
    const q = state.input.trim();
    if (!q) return;
    state.input = '';
    paint();
    shell.showToast(tr('pageMisc.f4fe22'), { kind: 'warn' });
  };

  const paint = () => shell.openDrawer({
    title: tr('pageMisc.5a36be'),
    subtitle: <span><span className="mono">{tenant.name}</span> · {getTenantName(tenant)}</span>,
    icon: 'message-square',
    iconColor: 'var(--violet)',
    width: 720,
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* 顶部:模型选择 + 清空 */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{tr('pageMisc.c1fef6')}</span>
          <CustomDropdown value={state.modelId} onChange={e => { state.modelId = e; paint(); }} height={32} width="100%">
            {enabledConfigs.map(c => (
              <option key={c.id} value={c.id}>{c.name} · {c.provider}</option>
            ))}
          </CustomDropdown>
          <button onClick={() => {
            state.messages = [{ role: 'ai', content: tr('pageMisc.5c020e'), time: new Date().toLocaleTimeString().slice(0, 5) }];
            paint();
          }}
            style={{
              padding: '4px 10px', background: 'var(--bg-1)', color: 'var(--fg-2)',
              border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
              fontSize: 10.5, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            <Icon name="trash-2" size={10} />{tr('pageMisc.288f0c')}
          </button>
        </div>

        {/* 消息区 */}
        <div ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
          style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10,
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: m.role === 'user' ? 'var(--info-soft)' : 'var(--violet-soft)',
                color: m.role === 'user' ? 'var(--info)' : 'var(--violet)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={m.role === 'user' ? 'user' : 'cpu'} size={13} />
              </div>
              <div style={{
                maxWidth: '78%',
                padding: '9px 12px',
                background: m.role === 'user' ? 'var(--info-soft)' : 'var(--bg-2)',
                border: '1px solid ' + (m.role === 'user' ? 'var(--info)' : 'var(--border)'),
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 12.5, color: 'var(--fg-0)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.time}</div>
              </div>
            </div>
          ))}
          {state.sending && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--violet-soft)', color: 'var(--violet)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="cpu" size={13} />
              </div>
              <div style={{
                padding: '9px 12px',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--fg-2)', fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {tr('pageMisc.233d05')}
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--violet)',
                      animation: `pulse-dot 1.4s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={state.useHistory}
                onChange={e => { state.useHistory = e.target.checked; paint(); }}
                style={{ margin: 0 }} />
              {tr('pageMisc.144165')}
            </label>
            <div style={{ flex: 1 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--fg-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-3)' }} />
              {tr('pageMisc.29cb51')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <textarea value={state.input}
              onChange={e => { state.input = e.target.value; paint(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={tr('pageMisc.3720d6')}
              rows={2}
              disabled={state.sending}
              style={{
                flex: 1, padding: 10, resize: 'none',
                background: 'var(--bg-1)', color: 'var(--fg-0)',
                border: '1px solid var(--border)', borderRadius: 6,
                fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={send} disabled={state.sending || !state.input.trim()}
              style={{
                width: 40, height: 40,
                background: (state.sending || !state.input.trim()) ? 'var(--bg-3)' : 'var(--violet)',
                color: (state.sending || !state.input.trim()) ? 'var(--fg-3)' : 'white',
                border: 'none', borderRadius: 6,
                cursor: (state.sending || !state.input.trim()) ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      </div>
    ),
  });
  paint();
}

// ═══════════════════════════════════════════════════════════════════════
// OCI 链路测试 · 整页 · 严格对齐原项目 speed_test.ftl
//   /speedTest —— 从浏览器测到 45 个 OCI 区域的延迟
//     ┌────────────────────────────────────────────┐
//     │ 3 状态卡:当前 IP · 最优区域 · 平均延迟       │
//     ├────────────────────────────────────────────┤
//     │ 🥇 Top 5 排行榜(测速完成后展示)              │
//     ├────────────────────────────────────────────┤
//     │ [ 开始测速 ] 控制条                          │
//     ├────────────────────────────────────────────┤
//     │ 45 个区域网格,每卡:名称 · 代码 · ms · 进度  │
//     └────────────────────────────────────────────┘
//   3 色分档:绿 ≤80ms · 橙 80-250ms · 红 >250ms
// ═══════════════════════════════════════════════════════════════════════
function LinkPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();

  // 客户端 IP + 地理位置 · 从公共 API 拉真实出口 IP
  // 对齐原项目 /api/getCurrentIp 行为(无后端时用第三方 API 兜底)
  // 依次尝试 ipwho.is → ipinfo.io → geojs → ipify(仅 IP),都开放 CORS 且免 key
  const [clientIp, setClientIp] = React.useState(tr('pageMisc.84561c'));
  const [clientLocation, setClientLocation] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;

    // 尝试链:每个 provider 返回 { ip, loc } 或抛错
    const providers = [
      // 后端 /api/getCurrentIp —— 优先(登录后返回公网IP/地址)
      () => fetch('/api/getCurrentIp', { headers: { 'Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, credentials: 'include' }).then(r => r.json()).then(d => {
        if (!d || !d.success) throw new Error('getCurrentIp fail');
        const s = String(d.data || '');
        const i = s.indexOf('/');
        return { ip: i > 0 ? s.slice(0, i) : s, loc: i > 0 ? s.slice(i + 1) : '' };
      }),
      // ipwho.is —— 数据最完整,含 emoji 国旗 + ISP
      () => fetch('https://ipwho.is/').then(r => r.json()).then(d => {
        if (!d.success && d.success !== undefined) throw new Error('ipwho.is fail');
        const parts = [];
        if (d.flag?.emoji) parts.push(d.flag.emoji);
        if (d.city) parts.push(d.city);
        if (d.country) parts.push(d.country);
        const org = d.connection?.isp || d.connection?.org;
        return { ip: d.ip, loc: parts.join(' · ') + (org ? ` · ${org}` : '') };
      }),
      // ipinfo.io —— 备用
      () => fetch('https://ipinfo.io/json').then(r => r.json()).then(d => ({
        ip: d.ip,
        loc: [d.city, d.country].filter(Boolean).join(' · ') + (d.org ? ` · ${d.org.replace(/^AS\d+\s*/, '')}` : ''),
      })),
      // geojs —— 备用
      () => fetch('https://get.geojs.io/v1/ip/geo.json').then(r => r.json()).then(d => ({
        ip: d.ip,
        loc: [d.city, d.country].filter(Boolean).join(' · ') + (d.organization_name ? ` · ${d.organization_name}` : ''),
      })),
      // ipify —— 最后兜底(只有 IP)
      () => fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => ({
        ip: d.ip, loc: tr('pageMisc.a4c020'),
      })),
    ];

    (async () => {
      for (const fn of providers) {
        try {
          const r = await fn();
          if (cancelled) return;
          if (r.ip) {
            setClientIp(r.ip);
            setClientLocation(r.loc || '');
            return;
          }
        } catch {
          // 继续下一个 provider
        }
      }
      if (!cancelled) {
        setClientIp(tr('pageMisc.1622dc'));
        setClientLocation(tr('pageMisc.a41bb5'));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── 测试状态 · latencies: { [regionCode]: number | null | 'testing' | 'timeout' } ───
  const [latencies, setLatencies] = React.useState({});
  const [testing, setTesting] = React.useState(false);
  const [testDone, setTestDone] = React.useState(false);
  const abortRef = React.useRef({ aborted: false });

  const regions = typeof REGIONS !== 'undefined' ? REGIONS : [];

  // 真实 ping 单个 OCI 区域 · 严格对齐原项目思路
  //   objectstorage.<region>.oraclecloud.com 端点是最佳选择:
  //     · 每个区域独立部署,不走 Anycast
  //     · CORS 开放,浏览器能拿到完整 HTTP timing
  //     · 无鉴权即返回 404,响应快无副作用
  //   多次采样取最小值(避免 TLS 握手 + DNS 首次抖动)
  const pingRegion = React.useCallback(async (region) => {
    const url = `https://objectstorage.${region.code}.oraclecloud.com/`;
    let best = Infinity;
    // 3 次采样取最小(第一次含 DNS+TLS,后续走 keep-alive 更准)
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        await fetch(url, { cache: 'no-store', mode: 'cors' });
        const ms = performance.now() - t0;
        if (ms < best) best = ms;
      } catch {
        // 网络失败一次,继续下一轮
      }
      // 采样间隔 30ms,避免高频抖动
      if (i < 2) await new Promise(r => setTimeout(r, 30));
    }
    return best === Infinity ? null : Math.round(best);
  }, []);

  // 完成测试后的统计
  const results = React.useMemo(() => {
    const succeeded = regions
      .filter(r => typeof latencies[r.code] === 'number')
      .map(r => ({ region: r, latency: latencies[r.code] }))
      .sort((a, b) => a.latency - b.latency);
    if (succeeded.length === 0) return null;
    return {
      best: succeeded[0],
      avg: Math.round(succeeded.reduce((s, x) => s + x.latency, 0) / succeeded.length),
      top5: succeeded.slice(0, 5),
    };
  }, [latencies, regions]);

  // ─── 测速逻辑:真实并发 fetch 到每个 OCI 区域端点 ─────────────
  //   限制并发 6,避免浏览器同域限流(实际是不同域,但为求稳)
  const startTest = React.useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setTestDone(false);
    abortRef.current = { aborted: false };
    // 全部置为 testing 态
    const initState = {};
    regions.forEach(r => { initState[r.code] = 'testing'; });
    setLatencies(initState);

    const CONCURRENCY = 6;
    const queue = [...regions];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        if (abortRef.current.aborted) return;
        const region = queue.shift();
        if (!region) return;
        try {
          const ms = await pingRegion(region);
          if (abortRef.current.aborted) return;
          setLatencies(prev => ({
            ...prev,
            [region.code]: ms === null ? 'timeout' : ms,
          }));
        } catch {
          if (abortRef.current.aborted) return;
          setLatencies(prev => ({ ...prev, [region.code]: 'timeout' }));
        }
      }
    });
    await Promise.all(workers);
    if (abortRef.current.aborted) return;
    setTesting(false);
    setTestDone(true);
  }, [regions, testing, pingRegion]);

  // 进入/刷新本页时自动开始一次测速(复用 Start speed test 逻辑)
  const autoStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    startTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTest = () => {
    abortRef.current.aborted = true;
    setTesting(false);
    shell.showToast(tr('pageMisc.1c63a2'), { kind: 'warn' });
  };

  const resetTest = () => {
    abortRef.current.aborted = true;
    setTesting(false);
    setTestDone(false);
    setLatencies({});
  };

  // 3 档颜色
  const latencyColor = (ms) => {
    if (typeof ms !== 'number') return 'var(--fg-3)';
    if (ms <= 80) return 'var(--accent)';
    if (ms <= 250) return 'var(--orange)';
    return 'var(--danger)';
  };
  const latencyLabel = (ms) => {
    if (ms === 'testing') return { text: '...', color: 'var(--fg-3)' };
    if (ms === 'timeout') return { text: 'timeout', color: 'var(--danger)' };
    if (typeof ms === 'number') return { text: ms, color: latencyColor(ms) };
    return { text: '--', color: 'var(--fg-3)' };
  };
  // 进度条 width%: 200ms 满档
  const barWidth = (ms) => {
    if (typeof ms !== 'number') return 0;
    return Math.min(100, Math.max(6, (ms / 300) * 100));
  };

  // ─── 完成后:显示已测过的数量 ─────────
  const testedCount = regions.filter(r => typeof latencies[r.code] === 'number' || latencies[r.code] === 'timeout').length;
  const progress = regions.length > 0 ? (testedCount / regions.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.link')}
        subtitle={tr('pageMisc.bf6956')}
        icon="wifi"
        iconColor="var(--accent)"
        actions={
          <>
            {testDone && (
              <Button variant="ghost" size="md" icon="rotate-ccw" onClick={resetTest}>{tr('pageMisc.4b9c32')}</Button>
            )}
            {testing ? (
              <Button variant="danger" size="md" icon="square" onClick={stopTest}>{tr('pageMisc.095e93')}</Button>
            ) : (
              <Button variant="primary" size="md" icon="zap" onClick={startTest}>
                {testDone ? tr('pageMisc.ef121b') : tr('pageMisc.cb534b')}
              </Button>
            )}
          </>
        }
      />

      {/* 主内容区 · 内部滚动 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>

        {/* ─── 3 状态卡 ─── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, marginBottom: 14,
        }}>
          {/* 当前 IP */}
          <div style={{
            padding: 14, background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.45 }}>
              <Icon name="wifi" size={30} style={{ color: 'var(--info)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr('pageMisc.346ece')}</div>
            <div className="num mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', marginTop: 6 }}>{clientIp}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 3 }}>{clientLocation}</div>
          </div>
          {/* 最优区域 */}
          <div style={{
            padding: 14,
            background: results ? 'linear-gradient(135deg, var(--accent-soft), transparent)' : 'var(--bg-1)',
            border: '1px solid ' + (results ? 'var(--accent)' : 'var(--border)'),
            borderRadius: 8, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.5 }}>
              <Icon name="award" size={30} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr('pageMisc.911b2e')}</div>
            {results ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{results.best.region.flag}</span>
                  {lang === 'zh' ? getRegionSimpleName(results.best.region) : results.best.region.en}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3, fontWeight: 500 }}>
                  <span className="num mono">{results.best.latency}</span> ms · <span className="mono" style={{ color: 'var(--fg-3)' }}>{results.best.region.code}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-3)', marginTop: 6 }}>--</div>
            )}
          </div>
          {/* 平均延迟 */}
          <div style={{
            padding: 14, background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.45 }}>
              <Icon name="gauge" size={30} style={{ color: 'var(--cyan)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr('pageMisc.a1df2e')}</div>
            {results ? (
              <>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, color: latencyColor(results.avg), marginTop: 6 }}>
                  {results.avg}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 4, color: 'var(--fg-3)' }}>ms</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 3 }}>
                  {tr('pageMisc.b85081')} <span className="num" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{regions.filter(r => typeof latencies[r.code] === 'number').length}</span> / {regions.length} {tr('pageMisc.82c9cb')}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-3)', marginTop: 6 }}>--</div>
            )}
          </div>
        </div>

        {/* ─── 测试进度条(仅测试中) ─── */}
        {testing && (
          <div style={{
            padding: '10px 14px', marginBottom: 12,
            background: 'var(--bg-1)',
            border: '1px solid var(--info)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--info)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--info)',
                  animation: 'pulse-dot 1.4s infinite',
                }} />
                {tr('pageMisc.5c35a3')}
              </span>
              <span className="num mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                {testedCount} / {regions.length}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--info), var(--cyan))',
                transition: 'width 300ms',
              }} />
            </div>
          </div>
        )}

        {/* ─── Top 5 排行(测试完成后) ─── */}
        {results && !testing && (
          <div style={{
            padding: 14, marginBottom: 12,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="award" size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('pageMisc.c790ae')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {results.top5.map((item, i) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                const medalColor = i === 0 ? 'var(--accent)' : i === 1 ? 'var(--fg-1)' : i === 2 ? 'var(--orange)' : 'var(--fg-3)';
                return (
                  <div key={item.region.code} style={{
                    padding: 10,
                    background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-2)',
                    border: '1px solid ' + (i === 0 ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{medals[i]}</span>
                      <span style={{ fontSize: 16 }}>{item.region.flag}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lang === 'zh' ? getRegionSimpleName(item.region) : item.region.en}
                    </div>
                    <div className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 2 }}>{item.region.code}</div>
                    <div className="num" style={{
                      fontSize: 15, fontWeight: 700, color: latencyColor(item.latency),
                      marginTop: 6, display: 'inline-flex', alignItems: 'baseline', gap: 2,
                    }}>
                      {item.latency}<span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500 }}>ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── 45 区域网格 ─── */}
        <div style={{
          padding: 14,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="globe" size={13} style={{ color: 'var(--fg-2)' }} />
              {tr('pageMisc.7c5c88')}
              <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({regions.length})</span>
            </div>
            {/* 图例 */}
            <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: 'var(--fg-3)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />
                ≤ 80 ms
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--orange)' }} />
                80-250 ms
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger)' }} />
                &gt; 250 ms
              </span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}>
            {regions.map(r => {
              const val = latencies[r.code];
              const isTesting = val === 'testing';
              const label = latencyLabel(val);
              const isBest = results?.best?.region.code === r.code;
              return (
                <div key={r.code} style={{
                  padding: '11px 12px',
                  background: 'var(--bg-2)',
                  border: '1px solid ' + (isBest ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 6,
                  boxShadow: isBest ? '0 0 12px color-mix(in oklab, var(--accent) 30%, transparent)' : 'none',
                  transition: 'all 200ms',
                  position: 'relative',
                }}>
                  {isBest && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      fontSize: 12,
                    }}>🏆</div>
                  )}
                  {/* 头部:名称 + 代码 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14 }}>{r.flag}</span>
                      <span style={{
                        fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{lang === 'zh' ? (getRegionSimpleName(r).match(/\(([^)]+)\)/)?.[1] || getRegionSimpleName(r)) : r.en}</span>
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', marginBottom: 8 }}>
                    {r.code}
                  </div>

                  {/* 大字延迟 + ms */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 8 }}>
                    <span className="num" style={{
                      fontSize: 22, fontWeight: 700, color: label.color,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: -0.5,
                      animation: isTesting ? 'pulse-dot 1.4s infinite' : 'none',
                    }}>{label.text}</span>
                    {typeof val === 'number' && (
                      <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500 }}>ms</span>
                    )}
                  </div>

                  {/* 进度条 */}
                  <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: isTesting ? '30%' : `${barWidth(val)}%`,
                      height: '100%',
                      background: isTesting
                        ? 'linear-gradient(90deg, transparent, var(--info), transparent)'
                        : label.color,
                      transition: 'width 300ms, background 300ms',
                      animation: isTesting ? 'slide-in-right 1s infinite alternate' : 'none',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProxyPoolPage() {
  const { t: tr } = useT();
  return <PlaceholderPage
    title={tr('nav.proxyPool')}
    subtitle={tr('pageMisc.1b8295')}
    icon="network"
    iconColor="var(--cyan)"
    description={tr('pageMisc.2fc005')}
    features={[
      { icon: 'shuffle', label: tr('pageMisc.cc3e84'), desc: 'Round-robin / Weighted / Latency-first' },
      { icon: 'link', label: tr('pageMisc.c41813'), desc: tr('pageMisc.ff41ed') },
      { icon: 'shield-alert', label: tr('pageMisc.8602e8'), desc: tr('pageMisc.0753ec') },
    ]}
  />;
}

// ═══════════════════════════════════════════════════════════════════════
// 资源列表 · 整页 · 严格对齐原项目 vps_list.ftl · /vps/instances/list
//   VPS 实例监控面板 · 跨云商实例聚合
//     ┌────────────────────────────────────────────┐
//     │ 3 状态卡:服务器总数 · 在线 · 离线            │
//     ├────────────────────────────────────────────┤
//     │ 控制栏:搜索 · 显示 IP/租户 · 延迟测试 · 更多  │
//     ├────────────────────────────────────────────┤
//     │ 服务器卡片网格(每卡:云商图标 + IP + 标签 +   │
//     │  CPU/内存/硬盘 进度 + 网络 + SSH/安装/卸载) │
//     └────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════
function ResListPage() {
  const { t: tr, lang } = useT();
  const shell = useShell();

  // ─── 真实 OCI 实例 → VPS 卡片数据 ──────────────────────
  // ─── 真实 OCI 实例 → VPS 卡片数据 ───────
  const buildCards = (instances) => {
    const regionMap = Object.fromEntries((REGIONS || []).map(r => [r.code, r]));
    return instances.map((inst, i) => {
      const region = regionMap[inst.region];
      const uid = i + 1;
      const seed = uid * 31 + 7;
      const rand = (n) => { const x = Math.sin(seed * n) * 10000; return x - Math.floor(x); };
      const online = inst.status === 'running';
      const monitorInstalled = online && rand(5) > 0.4;
      return {
        id: uid,
        instanceId: `ocid1.instance..${btoa(String(uid) + inst.name).slice(0, 16).toLowerCase()}`,
        cloudType: 1,
        publicIp: getInstanceIp(inst),
        regionCode: inst.region,
        regionName: region ? (lang === 'zh' ? getRegionSimpleName(region) : region.en) : inst.region,
        regionFlag: region?.flag || '🌐',
        architecture: getInstanceArch(inst) || 'ARM',
        ocpu: getInstanceCpu(inst),
        memoryGB: getInstanceMem(inst),
        diskGB: inst.disk,
        tenancyName: inst.tenantName || '',
        tenantCustom: inst.tenantCustom || '',
        online,
        monitorInstalled,
        cpuPct: online ? Math.round(rand(11) * 90) : 0,
        memPct: online ? Math.round(20 + rand(13) * 70) : 0,
        diskPct: online ? Math.round(15 + rand(17) * 60) : 0,
        netRx: online ? (rand(19) * 5).toFixed(2) + ' MB/s' : '0 B/s',
        netTx: online ? (rand(23) * 3).toFixed(2) + ' MB/s' : '0 B/s',
        latency: null,
        latencyStatus: null,
      };
    });
  };

  const [cards, setCards] = React.useState([]);
  const [vpsLoading, setVpsLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    setVpsLoading(true);
    (async () => {
      const normInst = (i) => ({
        id: i.id,
        tenantId: String(i.tenantIdStr || i.tenantId || ''),
        name: i.displayName || '',
        status: (i.state || '').toLowerCase(),
        ocpu: i.ocpus,
        memory: i.memoryInGBs,
        disk: i.bootVolumeSizeInGBs,
        publicIp: i.publicIps || '',
        architecture: i.architecture,
        region: i.regionCode || i.regionName || '',
        tenantName: i.tenancyName || i.userName || '',
      });
      try {
        const pageData = await window.ociApi.getPage('/oci/list/json', { page: 0, size: 500 });
        if (alive) setCards(buildCards((pageData.content || []).map(normInst)));
      } catch (_) { if (alive) setCards([]); }
      if (alive) setVpsLoading(false);
    })();
    return () => { alive = false; };
  }, [lang]);

  // ─── UI 状态 ───────────────────────────
  const [search, setSearch] = React.useState('');
  const [showIp, setShowIp] = React.useState(false);           // 全局 IP 显示切换
  const [showTenant, setShowTenant] = React.useState(false);   // 全局租户显示切换
  const [offlineOnly, setOfflineOnly] = React.useState(false); // 离线卡片点击筛选
  const [testingLatency, setTestingLatency] = React.useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const moreBtnRef = React.useRef(null);

  // ─── 数据统计 ─────────────────────────
  const totalCount   = cards.length;
  const onlineCount  = cards.filter(c => c.online).length;
  const offlineCount = totalCount - onlineCount;

  // ─── 筛选 ─────────────────────────────
  const filtered = cards.filter(c => {
    if (offlineOnly && c.online) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.publicIp?.toLowerCase().includes(q) ||
      c.regionName?.toLowerCase().includes(q) ||
      c.regionCode?.toLowerCase().includes(q) ||
      c.tenancyName?.toLowerCase().includes(q) ||
      c.tenantCustom?.toLowerCase().includes(q)
    );
  });

  // ─── 脱敏工具 ─────────────────────────
  const maskIp = (ip) => {
    if (!ip) return tr('pageMisc.825779');
    const parts = ip.split('.');
    if (parts.length === 4) return parts[0] + '.***.***.***';
    return ip.slice(0, 4) + '****';
  };
  const maskTenant = (t) => {
    if (!t) return '';
    if (t.length <= 2) return t;
    return t[0] + '***' + t[t.length - 1];
  };

  // ─── 延迟测试:并发 ping 6 · 复用链路测试的思路 ─────
  const runLatencyTest = React.useCallback(async () => {
    if (testingLatency) return;
    setTestingLatency(true);
    // 全部标为 testing
    setCards(prev => prev.map(c => ({ ...c, latencyStatus: c.online ? 'testing' : null, latency: null })));
    const targets = cards.filter(c => c.online);
    const CONCURRENCY = 6;
    const queue = [...targets];
    const pingOne = async (c) => {
      const url = `https://objectstorage.${c.regionCode}.oraclecloud.com/`;
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        try {
          await fetch(url, { cache: 'no-store' });
          const ms = performance.now() - t0;
          if (ms < best) best = ms;
        } catch {}
        if (i < 2) await new Promise(r => setTimeout(r, 30));
      }
      return best === Infinity ? null : Math.round(best);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const c = queue.shift();
        const ms = await pingOne(c);
        setCards(prev => prev.map(x => x.id === c.id
          ? { ...x, latency: ms, latencyStatus: ms === null ? 'timeout' : 'done' }
          : x));
      }
    }));
    setTestingLatency(false);
    shell.showToast(tr('pageMisc.861642').replace('{0}',targets.length), { kind: 'success' });
  }, [cards, testingLatency, shell]);

  // 页面加载后 800ms 自动触发一次延迟测试(对齐原项目 setTimeout(pingAllServers, 800))
  const autoPingedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoPingedRef.current) return;
    if (cards.length === 0) return;
    autoPingedRef.current = true;
    const t = setTimeout(() => runLatencyTest(), 800);
    return () => clearTimeout(t);
  }, [cards.length, runLatencyTest]);

  const latencyColor = (ms) => {
    if (ms == null) return 'var(--fg-3)';
    if (ms <= 80) return 'var(--accent)';
    if (ms <= 250) return 'var(--orange)';
    return 'var(--danger)';
  };
  const barColor = (pct) => {
    if (pct >= 90) return 'var(--danger)';
    if (pct >= 70) return 'var(--orange)';
    return 'var(--accent)';
  };
  const archColor = (arch) => {
    const u = (arch || '').toUpperCase();
    if (u.includes('ARM')) return { bg: 'var(--info-soft)', fg: 'var(--info)' };
    if (u.includes('AMD') || u.includes('X86')) return { bg: 'var(--violet-soft)', fg: 'var(--violet)' };
    return { bg: 'var(--bg-3)', fg: 'var(--fg-2)' };
  };

  // 点击卡片外部关闭更多菜单
  React.useEffect(() => {
    if (!moreMenuOpen) return;
    const onDoc = (e) => {
      if (moreBtnRef.current?.contains(e.target)) return;
      setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreMenuOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.resList')}
        subtitle={tr('pageMisc.5c9fd6')}
        icon="server"
        iconColor="var(--violet)"
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
        {/* ── 3 张状态卡(严格对齐 stats-header) ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, marginBottom: 14,
        }}>
          {/* 服务器总数 */}
          <div style={{
            padding: 14, background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--info-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="server" size={22} style={{ color: 'var(--info)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr('pageMisc.25b7b9')}</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', marginTop: 6, letterSpacing: -0.5 }}>{totalCount}</div>
          </div>
          {/* 在线数量 */}
          <div style={{
            padding: 14, background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="wifi" size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr('pageMisc.8dabd1')}</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginTop: 6, letterSpacing: -0.5 }}>{onlineCount}</div>
          </div>
          {/* 离线数量(点击筛选) */}
          <div
            onClick={() => setOfflineOnly(!offlineOnly)}
            title={tr('pageMisc.4a1345')}
            style={{
              padding: 14,
              background: offlineOnly ? 'var(--danger-soft)' : 'var(--bg-1)',
              border: '1px solid ' + (offlineOnly ? 'var(--danger)' : 'var(--border)'),
              borderRadius: 8,
              position: 'relative', overflow: 'hidden', cursor: 'pointer',
              transition: 'all 150ms',
            }}>
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--danger-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="heart-crack" size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ fontSize: 11, color: offlineOnly ? 'var(--danger)' : 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {tr('pageMisc.a282b7')}
              {offlineOnly && <span style={{ padding: '0 5px', background: 'var(--danger)', color: 'white', borderRadius: 2, fontSize: 9, fontWeight: 700 }}>{tr('pageMisc.6e7ef7')}</span>}
            </div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)', marginTop: 6, letterSpacing: -0.5 }}>{offlineCount}</div>
          </div>
        </div>

        {/* ── 控制栏(对齐 control-panel) ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 10, marginBottom: 14,
          background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-0)', fontSize: 12, fontWeight: 600 }}>
            <Icon name="activity" size={13} style={{ color: 'var(--info)' }} />
            {tr('pageMisc.3c515f')}
          </div>
          <div style={{ flex: 1 }} />
          {/* 搜索 */}
          <SearchInput value={search} onChange={setSearch}
            placeholder={tr('pageMisc.4af931')}
            width={220} size="md" />
          <Button variant="outline" size="md" icon={showIp ? 'eye' : 'eye-off'}
            onClick={() => setShowIp(!showIp)}
          >{showIp ? tr('pageMisc.cdc37e') : tr('pageMisc.9f749d')}</Button>
          <Button variant="outline" size="md" icon={showTenant ? 'eye' : 'eye-off'}
            onClick={() => setShowTenant(!showTenant)}
          >{showTenant ? tr('pageMisc.489871') : tr('pageMisc.c00a9f')}</Button>
          <Button variant="primary" size="md" icon="zap"
            loading={testingLatency} onClick={runLatencyTest}
          >{tr('pageMisc.a735f9')}</Button>
          {/* 更多操作 dropdown */}
          <div style={{ position: 'relative' }} ref={moreBtnRef}>
            <Button variant="outline" size="md" icon="settings"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            >{tr('pageMisc.0ec9ea')}</Button>
            {moreMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                minWidth: 200, background: 'var(--bg-1)',
                border: '1px solid var(--border-strong)', borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                padding: 4, zIndex: 30,
              }}>
                {[
                  { icon: 'play',        color: 'var(--accent)', label: tr('pageMisc.defc17'), onClick: () => shell.showToast(tr('pageMisc.280f08'), { kind: 'success' }) },
                  { icon: 'square',      color: 'var(--danger)', label: tr('pageMisc.4d47c3'), onClick: () => shell.showToast(tr('pageMisc.427221'), { kind: 'warn' }) },
                  { icon: 'target',      color: 'var(--info)',   label: tr('pageMisc.a86d27'), onClick: runLatencyTest },
                  { divider: true },
                  { icon: 'refresh-cw',  color: 'var(--fg-2)',   label: tr('pageMisc.39e107'), onClick: () => { setCards(buildCards()); shell.showToast(tr('pageMisc.6d8718'), { kind: 'info' }); } },
                ].map((item, i) => item.divider ? (
                  <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                ) : (
                  <button key={i}
                    onClick={() => { setMoreMenuOpen(false); item.onClick(); }}
                    style={{
                      width: '100%', padding: '7px 10px',
                      background: 'transparent', color: 'var(--fg-1)',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                      fontSize: 12, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 8,
                      textAlign: 'left',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <Icon name={item.icon} size={12} style={{ color: item.color }} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 服务器卡片网格(对齐 server-grid) ── */}
        {filtered.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center', color: 'var(--fg-3)',
            background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <Icon name="server" size={44} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>{tr('pageMisc.ca4553')}</div>
            {search && <div style={{ marginTop: 6, fontSize: 11 }}>{tr('pageMisc.da7716')}{search}{tr('pageMisc.7c8beb')}</div>}
            {offlineOnly && offlineCount === 0 && <div style={{ marginTop: 6, fontSize: 11 }}>{tr('pageMisc.4a9833')}</div>}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}>
            {filtered.map(c => {
              const ac = archColor(c.architecture);
              const monitorNeeded = c.online && !c.monitorInstalled;
              return (
                <div key={c.id} style={{
                  background: 'var(--bg-1)',
                  border: '1px solid ' + (monitorNeeded ? 'var(--orange)' : 'var(--border)'),
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'transform 150ms, border-color 150ms',
                }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  {/* Card body */}
                  <div style={{ padding: 14 }}>
                    {/* 顶部:云商图标 + IP + 状态 */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 6,
                        background: 'color-mix(in oklab, var(--orange) 20%, transparent)',
                        color: 'var(--orange)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        fontSize: 15, fontWeight: 700,
                      }} title="Oracle Cloud">OCI</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* IP + 眼睛切换 */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: c.online ? 'var(--fg-0)' : 'var(--fg-3)' }}>
                            {showIp ? c.publicIp : maskIp(c.publicIp)}
                          </span>
                          <Icon name={showIp ? 'eye' : 'eye-off'} size={11} style={{ color: 'var(--fg-3)' }} />
                        </div>
                        {/* 标签 · 严格两行 · 区域|架构|配置 / 租户|延迟 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {/* 第 1 行 */}
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
                            <span title={c.regionName} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '1px 6px', borderRadius: 3,
                              background: 'var(--bg-3)', color: 'var(--fg-1)',
                              fontSize: 10, fontWeight: 500,
                              flexShrink: 1, minWidth: 0,
                            }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>{c.regionFlag}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.regionName.replace(/^.*?\(([^)]+)\).*$/, '$1') || c.regionName}
                              </span>
                            </span>
                            <span style={{
                              padding: '1px 6px', borderRadius: 3,
                              background: ac.bg, color: ac.fg,
                              fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                              flexShrink: 0,
                            }}>{c.architecture}</span>
                            <span className="mono" style={{
                              padding: '1px 6px', borderRadius: 3,
                              background: 'var(--bg-3)', color: 'var(--fg-1)',
                              fontSize: 10, fontWeight: 500,
                              flexShrink: 0, whiteSpace: 'nowrap',
                            }}>{c.ocpu}C{c.memoryGB}G · {c.diskGB}GB</span>
                          </div>
                          {/* 第 2 行:租户 + 延迟 */}
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
                            {c.tenancyName && (
                              <span
                                title={c.tenantCustom ? `${c.tenancyName.replace('***', 'user')} · ${c.tenantCustom}` : c.tenancyName}
                                style={{
                                  padding: '1px 6px', borderRadius: 3,
                                  background: showTenant ? 'var(--info-soft)' : 'var(--bg-3)',
                                  color: showTenant ? 'var(--info)' : 'var(--fg-1)',
                                  fontSize: 10, fontWeight: 500,
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  transition: 'background 120ms',
                                  flexShrink: 1, minWidth: 0,
                                }}>
                                <Icon name="user" size={9} style={{ color: showTenant ? 'var(--info)' : 'var(--fg-3)', flexShrink: 0 }} />
                                <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{showTenant ? c.tenancyName.replace('***', 'user') : c.tenancyName}</span>
                              </span>
                            )}
                            {/* 延迟 */}
                            {c.latencyStatus === 'testing' && (
                              <span style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--info-soft)', color: 'var(--info)', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                                <Icon name="loader" size={9} /> {tr('pageMisc.33aac6')}
                              </span>
                            )}
                            {c.latencyStatus === 'done' && c.latency != null && (
                              <span className="mono num" style={{
                                padding: '1px 6px', borderRadius: 3,
                                background: 'color-mix(in oklab, ' + latencyColor(c.latency) + ' 18%, transparent)',
                                color: latencyColor(c.latency),
                                fontSize: 10, fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                ⚡ {c.latency}ms
                              </span>
                            )}
                            {c.latencyStatus === 'timeout' && (
                              <span style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                                {tr('pageMisc.e944c7')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 状态徽章 */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 10, flexShrink: 0,
                        background: c.online ? 'var(--accent-soft)' : 'var(--danger-soft)',
                        color: c.online ? 'var(--accent)' : 'var(--danger)',
                        fontSize: 10.5, fontWeight: 700,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: c.online ? 'var(--accent)' : 'var(--danger)',
                          animation: c.online ? 'pulse-dot 1.4s infinite' : 'none',
                        }} />
                        {c.online ? tr('pageMisc.68905c') : tr('pageMisc.50d4a8')}
                      </span>
                    </div>

                    {/* 指标区 · CPU / MEM / DISK 进度 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: 'CPU',  pct: c.cpuPct },
                        { label: tr('pageMisc.993255'), pct: c.memPct },
                        { label: tr('pageMisc.1d650a'), pct: c.diskPct, subLabel: ` ${c.diskGB}GB` },
                      ].map(m => (
                        <div key={m.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, fontSize: 10.5 }}>
                            <span style={{ color: 'var(--fg-2)' }}>
                              {m.label}
                              {m.subLabel && <span style={{ fontSize: 10, color: 'var(--fg-3)', opacity: 0.7 }}>{m.subLabel}</span>}
                            </span>
                            <span className="num mono" style={{ color: c.online ? barColor(m.pct) : 'var(--fg-3)', fontWeight: 600 }}>{m.pct}%</span>
                          </div>
                          <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              width: `${m.pct}%`, height: '100%',
                              background: c.online ? barColor(m.pct) : 'var(--fg-3)',
                              transition: 'width 400ms',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 网络速率 */}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: 'var(--fg-2)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="arrow-down" size={10} style={{ color: 'var(--accent)' }} />
                        <span className="num mono">{c.netRx}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="arrow-up" size={10} style={{ color: 'var(--orange)' }} />
                        <span className="num mono">{c.netTx}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div style={{
                    display: 'flex', gap: 6,
                    padding: '8px 14px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-2)',
                  }}>
                    <button onClick={() => shell.showToast(tr('pageMisc.11d0e4').replace('{0}',c.publicIp), { kind: 'info' })}
                      style={{
                        padding: '4px 10px', background: 'var(--bg-1)',
                        color: 'var(--accent)', border: '1px solid var(--border)',
                        borderRadius: 3, cursor: 'pointer',
                        fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                      <Icon name="terminal" size={10} />SSH
                    </button>
                    {c.online && !c.monitorInstalled && (
                      <button onClick={() => {
                        setCards(prev => prev.map(x => x.id === c.id ? { ...x, monitorInstalled: true } : x));
                        shell.showToast(tr('pageMisc.24361c').replace('{0}',c.publicIp), { kind: 'success' });
                      }}
                        style={{
                          padding: '4px 10px', background: 'var(--info)',
                          color: 'white', border: 'none',
                          borderRadius: 3, cursor: 'pointer',
                          fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                        <Icon name="download" size={10} />{tr('pageMisc.76907a')}
                      </button>
                    )}
                    {c.monitorInstalled && (
                      <button onClick={() => shell.openConfirm({
                        title: tr('pageMisc.1f2ea6').replace('{0}',c.publicIp),
                        body: <div>{tr('pageMisc.e7357c')}</div>,
                        danger: true, confirmLabel: tr('pageMisc.81824c'),
                        onConfirm: () => {
                          setCards(prev => prev.map(x => x.id === c.id ? { ...x, monitorInstalled: false } : x));
                          shell.showToast(tr('pageMisc.f45226').replace('{0}',c.publicIp), { kind: 'warn' });
                        },
                      })}
                        style={{
                          padding: '4px 10px', background: 'var(--bg-1)',
                          color: 'var(--danger)', border: '1px solid var(--border)',
                          borderRadius: 3, cursor: 'pointer',
                          fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                        <Icon name="trash-2" size={10} />{tr('pageMisc.81824c')}
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', alignSelf: 'center' }} title={c.instanceId}>
                      {c.instanceId.slice(-8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ResCloudInitPage() {
  const { t: tr } = useT();
  return <PlaceholderPage
    title={tr('pageMisc.48d067')}
    subtitle={tr('pageMisc.fd5f98')}
    icon="file-code"
    iconColor="var(--info)"
    description={tr('pageMisc.253d9b')}
    features={[
      { icon: 'file-code', label: tr('pageMisc.caa58a'), desc: tr('pageMisc.d6fecd') },
      { icon: 'git-branch', label: tr('pageMisc.fe8627'), desc: tr('pageMisc.7542c6') },
      { icon: 'zap', label: tr('pageMisc.6b7bbc'), desc: tr('pageMisc.275d0d') },
    ]}
  />;
}

function NotifyPage() {
  const { t: tr } = useT();
  return <PlaceholderPage
    title={tr('nav.notification')}
    subtitle="Telegram / DingTalk / Feishu Webhook"
    icon="bell"
    iconColor="var(--orange)"
    description={tr('pageMisc.506e06')}
    features={[
      { icon: 'send', label: 'Telegram Bot', desc: tr('pageMisc.40583f') },
      { icon: 'message-square', label: 'DingTalk / Feishu', desc: tr('pageMisc.40c0b1') },
      { icon: 'webhook', label: tr('pageMisc.42074c'), desc: tr('pageMisc.dee737') },
    ]}
  />;
}

// ═══════════════════════════════════════════════════════════════════════
// 系统管理 4 子菜单 · 严格对齐原项目
//   1. IP 质量管理 (SysIpQualityPage) → ip_settings.ftl · /system/ipSettings
//   2. 系统日志    (SysLogsPage)      → sys_log.ftl     · /system/logs
//   3. 系统设置    (SysSettingPage)   → system_settings.ftl · /system/settings
//   4. 代理配置    (SysVpnProxyPage)  → vpn_proxy.ftl   · /vpnProxy/page
// ═══════════════════════════════════════════════════════════════════════

// ─── 通用小组件:设置卡片 ────────────────────────
function SettingsCard({ title, icon, iconColor = 'var(--fg-2)', actions, children, footer }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 8, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderRadius: '7px 7px 0 0',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <Icon name={icon} size={13} style={{ color: iconColor }} />}
          {title}
        </div>
        {actions}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {footer && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          borderRadius: '0 0 7px 7px',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─── 1. IP 质量管理 ─────────────────────────────
// 对齐客户端 ModuleSettingsCard 规范：1 + 3 标准布局（顶部通栏策略 + 底部三列三大运营商探针）

function SysIpQualityCarrierCard({ name, subtitle, flag, config, setter, iconColor, onTest, onSaveToast }) {
  const { t: tr } = useT();

  let badgeText = tr('pageMisc.463776'); // 未启用
  let badgeColor = 'var(--fg-3)';
  let badgeBg = 'var(--bg-3)';
  let badgeBorder = 'var(--border)';

  if (config.enabled) {
    if (config.connected) {
      badgeText = tr('pageMisc.c5ea9c'); // 已连接
      badgeColor = 'var(--accent)';
      badgeBg = 'var(--accent-soft)';
      badgeBorder = 'var(--accent)';
    } else {
      badgeText = tr('pageMisc.8c852a'); // 连接失败
      badgeColor = 'var(--danger)';
      badgeBg = 'var(--danger-soft)';
      badgeBorder = 'var(--danger)';
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
      overflow: 'hidden', minHeight: 330,
    }}>
      {/* 头部：图标 + 标题 + 副标题 + 状态胶囊 + 右侧 Switch */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: `color-mix(in oklab, ${iconColor} 18%, transparent)`,
            color: iconColor,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="server" size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{name}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '1px 6px', borderRadius: 4,
                background: badgeBg, color: badgeColor,
                fontSize: 10, fontWeight: 600,
                border: '1px solid ' + badgeBorder,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: badgeColor }} />
                {badgeText}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </div>
          </div>
        </div>

        <ToggleSwitch
          value={config.enabled}
          onChange={v => setter(c => ({ ...c, enabled: v }))}
        />
      </div>

      {/* 表单内容区 */}
      <div style={{
        padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <FormRow label="服务器地址" required>
          <TextInput
            value={config.host}
            onChange={v => setter(c => ({ ...c, host: v }))}
            placeholder="IP 或域名"
            mono
          />
        </FormRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
          <FormRow label="用户名" required>
            <TextInput
              value={config.username}
              onChange={v => setter(c => ({ ...c, username: v }))}
              placeholder="root"
              mono
            />
          </FormRow>
          <FormRow label="SSH 端口">
            <NumberInput
              value={config.port}
              onChange={v => setter(c => ({ ...c, port: v }))}
              min={1} max={65535}
            />
          </FormRow>
        </div>

        <FormRow label="SSH 密码">
          <PasswordInput
            value={config.password}
            onChange={v => setter(c => ({ ...c, password: v }))}
            placeholder="留空使用密钥认证"
          />
        </FormRow>
      </div>

      {/* 底部 Footer：左侧测试连接，右侧保存 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)',
      }}>
        <Button
          variant="outline"
          size="sm"
          icon="zap"
          loading={config.testing}
          disabled={!config.host.trim() || !config.username.trim()}
          onClick={onTest}
        >
          {tr('pageMisc.69e747')}
        </Button>

        <Button
          variant="primary"
          size="sm"
          icon="save"
          disabled={!config.host.trim() || !config.username.trim()}
          onClick={onSaveToast}
        >
          {tr('pageMisc.ed7526')}
        </Button>
      </div>
    </div>
  );
}

function SysIpQualityPage() {
  const { t: tr } = useT();
  const shell = useShell();

  // 检测配置（对齐真实后端接口：启用状态 + 周期小时）
  const [checkCfg, setCheckCfg] = React.useState({ enabled: false, intervalHours: 6 });
  const [savingCheck, setSavingCheck] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // 3 家运营商 VPS 配置
  const initCarrier = () => ({
    enabled: false,
    host: '', port: 22, username: '', password: '',
    connected: false,
    testing: false,
  });
  const [telecom, setTelecom] = React.useState(initCarrier());
  const [unicom,  setUnicom]  = React.useState(initCarrier());
  const [mobile,  setMobile]  = React.useState(initCarrier());

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.ociServices.system.ipSettings();
      const d = result?.data || result || {};
      const ip = d.ipCheck || {};
      setCheckCfg(c => ({ ...c, enabled: !!ip.enabled, intervalHours: Number(ip.checkInterval || ip.intervalHours || c.intervalHours) }));
      const map = (v) => ({ enabled: !!v?.enabled, host: v?.serverIp || '', port: Number(v?.sshPort || 22), username: v?.username || '', password: v?.password || '', connected: false, testing: false });
      setTelecom(map(d.telecom)); setUnicom(map(d.unicom)); setMobile(map(d.mobile));
    } catch (e) {
      shell.showToast(e.message || '加载配置失败', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [shell]);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const testConn = (type, carrier, setter) => {
    if (!carrier.host.trim() || !carrier.username.trim()) {
      shell.showToast(tr('pageMisc.b64151'), { kind: 'warn' }); return;
    }
    setter(c => ({ ...c, testing: true }));
    window.ociServices.system.testVpsConnection({ type, enabled: carrier.enabled, serverIp: carrier.host, username: carrier.username, password: carrier.password, sshPort: carrier.port })
      .then(result => { const ok = !!(result?.success ?? result?.data?.success); setter(c => ({ ...c, testing: false, connected: ok })); shell.showToast(ok ? tr('pageMisc.eb0384') : tr('pageMisc.48d8f1'), { kind: ok ? 'success' : 'error' }); })
      .catch(e => { setter(c => ({ ...c, testing: false, connected: false })); shell.showToast(e.message || tr('pageMisc.5a6da1'), { kind: 'error' }); });
  };

  const saveCarrier = async (type, carrier, setter) => {
    try {
      await window.ociServices.system.saveVpsConfig({ type, enabled: carrier.enabled, serverIp: carrier.host, username: carrier.username, password: carrier.password, sshPort: carrier.port });
      setter(c => ({ ...c, password: '', connected: false }));
      shell.showToast(tr('pageMisc.e94729'), { kind: 'success' });
    } catch (e) { shell.showToast(e.message || tr('pageMisc.7f1f79'), { kind: 'error' }); }
  };

  const saveGlobalCheck = async () => {
    setSavingCheck(true);
    try {
      await window.ociServices.system.updateIpCheckConfig({
        enabled: checkCfg.enabled,
        checkInterval: checkCfg.intervalHours,
        vpsUsername: '',
        vpsPassword: '',
        sshPort: 22
      });
      shell.showToast(tr('pageMisc.3b961b'), { kind: 'success' });
    } catch (e) {
      shell.showToast(e.message || tr('pageMisc.7f1f79'), { kind: 'error' });
    } finally {
      setSavingCheck(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.sysIpQuality')}
        subtitle={tr('pageMisc.c06317')}
        icon="shield"
        iconColor="var(--info)"
        actions={
          <Button variant="outline" size="md" icon="refresh-cw" loading={loading} onClick={loadSettings}>
            刷新
          </Button>
        }
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 1. IP 质量检测全局配置通栏卡片（对齐客户端标准） */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8,
          overflow: 'hidden', padding: 14, gap: 12,
        }}>
          {/* 顶部标题行 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'color-mix(in oklab, var(--info) 18%, transparent)',
                color: 'var(--info)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="shield-check" size={16} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>IP 质量检测全局配置</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '1px 7px', borderRadius: 4,
                    background: checkCfg.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
                    color: checkCfg.enabled ? 'var(--accent)' : 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600,
                    border: '1px solid ' + (checkCfg.enabled ? 'var(--accent)' : 'var(--border)'),
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: checkCfg.enabled ? 'var(--accent)' : 'var(--fg-3)' }} />
                    {checkCfg.enabled ? tr('pageMisc.53ace4') : tr('pageMisc.463776')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                  定期检测所有实例的公网 IP 质量，确保链路通畅可用
                </div>
              </div>
            </div>

            <ToggleSwitch
              value={checkCfg.enabled}
              onChange={v => setCheckCfg(c => ({ ...c, enabled: v }))}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

          {/* 核心参数区：周期 + 说明 + 保存按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)' }}>检测周期:</span>
              <CustomDropdown
                value={String(checkCfg.intervalHours)}
                onChange={v => setCheckCfg(c => ({ ...c, intervalHours: Number(v) }))}
                width="110px"
                height={30}
                options={[1, 2, 3, 4, 6, 8, 12, 24].map(h => ({
                  value: String(h),
                  label: `${h} 小时`,
                }))}
              />
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5, flex: 1,
            }}>
              <Icon name="info" size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
              <span>按设定周期自动执行检测；当且仅当所有已配置并启用的运营商探针均检测不可达时，系统将自动分配更换新公网 IP。</span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon="save"
              loading={savingCheck}
              onClick={saveGlobalCheck}
            >
              保存全局配置
            </Button>
          </div>
        </div>

        {/* 2. 3 家运营商 VPS 配置三列并排（对齐客户端标准） */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <SysIpQualityCarrierCard
            name={tr('pageMisc.89a632')}
            subtitle="China Telecom · SSH 探测节点"
            flag="🟢"
            config={telecom}
            setter={setTelecom}
            iconColor="var(--accent)"
            onTest={() => testConn('telecom', telecom, setTelecom)}
            onSaveToast={() => saveCarrier('telecom', telecom, setTelecom)}
          />
          <SysIpQualityCarrierCard
            name={tr('pageMisc.6a883e')}
            subtitle="China Unicom · SSH 探测节点"
            flag="🟡"
            config={unicom}
            setter={setUnicom}
            iconColor="var(--orange)"
            onTest={() => testConn('unicom', unicom, setUnicom)}
            onSaveToast={() => saveCarrier('unicom', unicom, setUnicom)}
          />
          <SysIpQualityCarrierCard
            name={tr('pageMisc.a470d2')}
            subtitle="China Mobile · SSH 探测节点"
            flag="🔴"
            config={mobile}
            setter={setMobile}
            iconColor="var(--danger)"
            onTest={() => testConn('mobile', mobile, setMobile)}
            onSaveToast={() => saveCarrier('mobile', mobile, setMobile)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 2. 系统日志 ─────────────────────────────
// 对齐原项目 sys_log.ftl:终端风格 · header + content + footer 三段
function SysLogsPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [logs, setLogs] = React.useState([]);
  const [loadError, setLoadError] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [connected, setConnected] = React.useState(false);
  const [nowTime, setNowTime] = React.useState(new Date().toTimeString().slice(0, 8));
  const terminalRef = React.useRef(null);

  React.useEffect(() => {
    const iv = setInterval(() => setNowTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(iv);
  }, []);

  // 真实后端日志加载与 SSE 实时流
  React.useEffect(() => {
    let alive = true;
    window.ociServices.system.openLogs({ lines: 300 }).then(payload => {
      if (!alive) return;
      const lines = Array.isArray(payload?.lines) ? payload.lines : [];
      setLogs(lines.map(line => {
        const text = String(line || '');
        const time = (text.match(/(\d{2}:\d{2}:\d{2})/) || [])[1] || '';
        const level = (text.match(/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/) || [])[1] || 'INFO';
        return { time, level, msg: text };
      }));
    }).catch(e => { if (alive) setLoadError(e.message || tr('pageMisc.86370f')); });
    const stream = new EventSource('/system/streamLogs?isBootLog=false');
    stream.onopen = () => { if (alive) { setConnected(true); setLoadError(''); } };
    stream.onmessage = event => {
      if (!alive) return;
      const text = String(event.data || '');
      const time = (text.match(/(\d{2}:\d{2}:\d{2})/) || [])[1] || '';
      const level = (text.match(/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/) || [])[1] || 'INFO';
      setLogs(prev => [...prev.slice(-299), { time, level, msg: text }]);
    };
    stream.onerror = () => { if (alive) { setConnected(false); setLoadError(tr('pageMisc.93817c')); } };
    return () => { alive = false; stream.close(); };
  }, []);

  const levelColor = (lv) => ({
    INFO:  '#79c0ff',
    WARN:  '#f2cc60',
    ERROR: '#ff7b72',
    DEBUG: '#8b949e',
  }[lv] || '#c9d1d9');

  const clearLogs = () => {
    shell.openConfirm({
      title: tr('pageMisc.f5de10'),
      body: <div>{tr('pageMisc.104efc')} <b>{logs.length}</b> {tr('pageMisc.654d0c')}<div style={{ marginTop: 4, color: 'var(--fg-3)' }}>{tr('pageMisc.11cddd')}</div></div>,
      danger: true, confirmLabel: tr('pageMisc.288f0c'),
      onConfirm: () => { setLogs([]); shell.showToast(tr('pageMisc.a764d9'), { kind: 'warn' }); },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.sysLogs')}
        subtitle={tr('pageMisc.240fef')}
        icon="terminal"
        iconColor="var(--accent)"
        actions={
          <>
            <Button variant="danger_soft" size="md" icon="trash" onClick={clearLogs}>{tr('pageMisc.a15a9e')}</Button>
          </>
        }
      />
      {loadError && <div role="alert" style={{ margin: '0 0 10px', color: 'var(--orange)', fontSize: 11.5 }}>{loadError}</div>}
      {/* 终端卡片 · 严格对齐 sys_log.ftl 三段布局 */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        background: 'oklch(0.10 0.008 240)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}>
        {/* 终端 header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'oklch(0.13 0.010 240)',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{
            display: 'flex', alignItems: 'center', gap: 8, margin: 0,
            fontSize: 13, fontWeight: 600, color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
          }}>
            <Icon name="terminal" size={14} style={{ color: 'var(--accent)' }} />
            <span>{tr('pageMisc.c308cb')}</span>
            <span style={{
              display: 'inline-block', width: 7, height: 13,
              background: 'var(--accent)', verticalAlign: 'middle',
              animation: 'pulse-dot 1s infinite',
              marginLeft: 2,
            }} />
          </h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 3,
            background: connected ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : 'var(--bg-3)',
            color: connected ? 'var(--accent)' : 'var(--fg-3)',
            fontSize: 10.5, fontWeight: 600,
            border: '1px solid ' + (connected ? 'var(--accent)' : 'var(--border)'),
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? 'var(--accent)' : 'var(--fg-3)',
              animation: connected ? 'pulse-dot 1.4s infinite' : 'none',
            }} />
            {connected ? tr('pageMisc.c5ea9c') : tr('pageMisc.3842ba')}
          </span>
        </div>

        {/* 终端内容 */}
        <div ref={terminalRef} style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: 14,
          fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65,
        }}>
          {logs.length === 0 && (
            <div style={{ color: 'var(--fg-3)', textAlign: 'center', padding: 40 }}>{tr('pageMisc.8b9c17')}</div>
          )}
          {logs.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '2px 0' }}>
              <span style={{ color: 'oklch(0.55 0.05 240)', flexShrink: 0 }}>{l.time}</span>
              <span style={{ color: levelColor(l.level), fontWeight: 700, minWidth: 55, flexShrink: 0 }}>[{l.level}]</span>
              <span style={{ color: 'oklch(0.86 0.008 240)', flex: 1, wordBreak: 'break-all' }}>{l.msg}</span>
            </div>
          ))}
        </div>

        {/* 终端 footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'oklch(0.13 0.010 240)',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: 'var(--fg-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={11} style={{ color: 'var(--fg-3)' }} />
              <span className="mono num">{nowTime}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="list" size={11} style={{ color: 'var(--fg-3)' }} />
              <span>{tr('pageMisc.fbd2b1')} <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 600 }}>{logs.length}</span> {tr('pageMisc.cc1bac')}</span>
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: 'var(--fg-2)' }}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}
                style={{ margin: 0, accentColor: 'var(--accent)' }} />
              <span>{tr('pageMisc.e0ce74')}</span>
            </label>
            <span style={{ color: 'var(--accent)' }}>{tr('pageMisc.a8a838')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. 系统设置 ─────────────────────────────
// 对齐原项目 system_settings.ftl · 账号 + GitHub OAuth + Google OAuth + MFA + Turnstile 五卡
function SysSettingPage() {
  const { t: tr } = useT();
  const shell = useShell();

  // 严格对齐原项目 system_settings.ftl · 7 张卡布局 · 图标颜色沿用原项目 style="color:..."
  const [account, setAccount] = React.useState({ currentUser: 'admin', currentPass: '', newUser: '', newPass: '', confirmPass: '' });
  const [siteLogo, setSiteLogo] = React.useState('');
  const [github, setGithub] = React.useState({ enabled: false, githubUser: '', githubId: '', clientId: '', clientSecret: '', webhookUrl: '', fetching: false });
  // 严格对齐原项目 googleConfig · 字段顺序:email → clientId → clientSecret → redirectUri
  const [google, setGoogle] = React.useState({ enabled: false, email: '', clientId: '', clientSecret: '', webhookUrl: '' });
  // 严格对齐原项目 mfaConfig · 默认 issuer = "OCI-Pool Verify"
  // secretKey 未设置前只显示应用名字段;点"重新生成"或"启用"后才显示二维码/密钥/验证码测试
  // mfa.enabled 与登录页联动:开启后登录时需要 MFA 验证码
  // (对齐原项目 LoginController.validateAdditionalFactors)
  const _mfaCfg = (window.getAuthConfig && window.getAuthConfig()) || { mfaEnabled: false };
  const [mfa, setMfa]       = React.useState({ enabled: _mfaCfg.mfaEnabled, appName: 'OCI-Pool Verify', secret: '', verifyCode: '', showSecret: false, qr: '', verifyResult: '', verifyStatus: '' });
  // mfa.enabled 任何变化 → 同步 localStorage → AuthPage 下次读到新值
  React.useEffect(() => {
    window.setAuthConfigFlag && window.setAuthConfigFlag('mfa', mfa.enabled);
  }, [mfa.enabled]);
  const [turnstile, setTurnstile] = React.useState({ enabled: false, siteKey: '', secretKey: '' });
  const [channelNotify, setChannelNotify] = React.useState({ enabled: false });
  const [securitySaving, setSecuritySaving] = React.useState('');

  const [loading, setLoading] = React.useState(false);

  // 各卡必填字段是否齐全（严格对齐 UI 标准第五章：必填项未填满时，保存按钮强制置灰禁用）
  const accountReady = !!(account.currentPass.trim()
    && (account.newUser.trim() || account.newPass.trim())
    && (!account.newPass.trim() || (account.newPass.trim().length >= 8 && account.newPass.trim() === account.confirmPass.trim())));
  const githubReady = !!(github.clientId.trim() && github.clientSecret.trim() && github.webhookUrl.trim());
  const googleReady = !!(google.email.trim() && google.clientId.trim() && google.clientSecret.trim() && google.webhookUrl.trim());
  const turnstileReady = !!(turnstile.siteKey.trim() && turnstile.secretKey.trim());
  const mfaReady = !!mfa.appName.trim();

  // 加载安全管理页真实配置(GET /api/system/securitySettingsConfigs)
  const loadSettings = async () => {
    setLoading(true);
    try {
      const json = await window.ociServices.system.securitySettings();
      if (!json || !json.success) return;
      const d = json.data || {};
      if (d.mfa) setMfa(m => ({ ...m, enabled: !!d.mfa.enabled, appName: d.mfa.issuer || m.appName, secret: d.mfa.secretKey || '', qr: d.mfa.qrCode ? 'data:image/png;base64,' + d.mfa.qrCode : '' }));
      if (d.github) setGithub(g => ({ ...g, enabled: !!d.github.enabled, githubUser: d.github.userName ?? '', githubId: d.github.githubId ?? '', clientId: d.github.clientId ?? '', clientSecret: d.github.clientSecret ?? '', webhookUrl: d.github.redirectUri ?? '' }));
      if (d.google) setGoogle(g => ({ ...g, enabled: !!d.google.enabled, email: d.google.email ?? '', clientId: d.google.clientId ?? '', clientSecret: d.google.clientSecret ?? '', webhookUrl: d.google.redirectUri ?? '' }));
      if (d.turnstile) setTurnstile(t => ({ ...t, enabled: !!d.turnstile.enabled, siteKey: d.turnstile.siteKey || '', secretKey: d.turnstile.secretKey || '' }));
      if (d.siteLogoName !== undefined && d.siteLogoName !== null) setSiteLogo(String(d.siteLogoName));
      if (d.channelNotifyEnabled !== undefined && d.channelNotifyEnabled !== null) setChannelNotify({ enabled: !!d.channelNotifyEnabled });
      if (d.currentUsername) setAccount(a => ({ ...a, currentUser: d.currentUsername || a.currentUser }));
    } catch (e) {
      shell.showToast(e.message || tr('pageMisc.118d1d'), { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => { loadSettings(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── 真实后端 · MFA 生成 / 保存 / 验证 / 删除 ──
  const genMfaSecret = async () => {
    try {
      await window.ociServices.system.regenerateMfaSecret();
      await loadSettings();
      shell.showToast(tr('pageMisc.143130'), { kind: 'warn' });
    } catch (e) { shell.showToast(tr('pageMisc.6879c9').replace('{0}',e.message || e), { kind: 'error' }); }
  };

  const saveMfa = async () => {
    try {
      await window.ociServices.system.updateMfaConfig({ enabled: mfa.enabled, issuer: mfa.appName || 'OCI-Pool Verify' });
      if (window.setAuthConfigFlag) window.setAuthConfigFlag('mfa', mfa.enabled);
      await loadSettings();
      shell.showToast(tr('pageMisc.3142e4'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.c1c24b').replace('{0}',e.message || e), { kind: 'error' }); }
  };

  const verifyMfaCode = async () => {
    if (mfa.verifyCode.length !== 6) { shell.showToast(tr('pageMisc.558bd4'), { kind: 'warn' }); return; }
    try {
      const j = await window.ociServices.system.verifyMfaCode({ code: mfa.verifyCode });
      if (j && j.success) {
        shell.showToast(tr('pageMisc.636883'), { kind: 'success' });
        setMfa(m => ({ ...m, verifyCode: '', verifyResult: tr('pageMisc.6efec2'), verifyStatus: 'success' }));
      } else {
        const msg = (j && j.message) ? j.message : tr('pageMisc.e441b1');
        shell.showToast(tr('pageMisc.a07a41').replace('{0}',msg), { kind: 'error' });
        setMfa(m => ({ ...m, verifyCode: '', verifyResult: msg, verifyStatus: 'error' }));
      }
    } catch (e) {
      shell.showToast(tr('pageMisc.a07a41').replace('{0}',e.message || e), { kind: 'error' });
      setMfa(m => ({ ...m, verifyCode: '', verifyResult: e.message || tr('pageMisc.e441b1'), verifyStatus: 'error' }));
    }
  };

  const deleteMfa = async () => {
    try {
      await window.ociServices.system.deleteMfaConfig();
      if (window.setAuthConfigFlag) window.setAuthConfigFlag('mfa', false);
      setMfa(m => ({ ...m, enabled: false, secret: '', qr: '', verifyCode: '' }));
      shell.showToast(tr('pageMisc.ccbbf4'), { kind: 'warn' });
    } catch (e) { shell.showToast(tr('pageMisc.661ba6').replace('{0}',e.message || e), { kind: 'error' }); }
  };

  // ── MFA 绑定向导弹窗（方案 1：独立模态，彻底消除页面垂直跳动与大空洞） ──
  const openMfaSetupModal = async () => {
    let localSecret = mfa.secret;
    let localQr = mfa.qr;
    let localCode = '';
    let localResult = '';
    let localStatus = '';
    let isVerifying = false;

    // 若尚未生成密钥，打开向导时自动初始化生成
    if (!localSecret) {
      try {
        await window.ociServices.system.regenerateMfaSecret();
        const json = await window.ociServices.system.securitySettings();
        if (json && json.data && json.data.mfa) {
          localSecret = json.data.mfa.secretKey || '';
          localQr = json.data.mfa.qrCode ? 'data:image/png;base64,' + json.data.mfa.qrCode : '';
          setMfa(m => ({ ...m, secret: localSecret, qr: localQr }));
        }
      } catch (e) {
        shell.showToast(e.message || '生成密钥失败', { kind: 'error' });
      }
    }

    const paint = () => shell.openModal({
      title: 'MFA 绑定向导',
      subtitle: '使用 Google Authenticator / 微软 Authenticator 扫码绑定',
      icon: 'smartphone',
      iconColor: 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 步骤 1：扫码绑定 */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: 16, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 10 }}>
              步骤 1：打开手机认证器 App 扫描二维码
            </div>
            {localQr ? (
              <img src={localQr} alt="MFA QR" style={{ width: 150, height: 150, background: 'white', borderRadius: 6, padding: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
            ) : (
              <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-3)', borderRadius: 6, color: 'var(--fg-3)', fontSize: 12 }}>
                正在生成二维码…
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8 }}>
              支持 Google Authenticator、Microsoft Authenticator、1Password 等
            </div>
          </div>

          {/* 步骤 2：手动备用密钥 */}
          {localSecret && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginBottom: 6 }}>
                步骤 2：若无法扫码，可手动复制密钥录入
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="text" value={localSecret} readOnly
                  style={{ flex: 1, height: 32, boxSizing: 'border-box', padding: '0 10px', background: 'var(--bg-3)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                <Button variant="outline" size="md" icon="copy" style={{ height: 32, padding: '0 12px', whiteSpace: 'nowrap' }} onClick={() => { navigator.clipboard.writeText(localSecret); shell.showToast('已复制密钥', { kind: 'success' }); }}>
                  复制
                </Button>
              </div>
            </div>
          )}

          {/* 步骤 3：验证动态码 */}
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginBottom: 6 }}>
              步骤 3：输入认证器显示的 6 位动态验证码完成激活
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={localCode}
                onChange={e => { localCode = e.target.value.replace(/\D/g, '').slice(0, 6); localResult = ''; localStatus = ''; paint(); }}
                placeholder="6 位数字" maxLength={6}
                style={{ flex: 1, height: 34, boxSizing: 'border-box', padding: '0 12px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, fontFamily: 'var(--font-mono)', letterSpacing: 4, textAlign: 'center', outline: 'none' }} />
              <Button variant="info" size="md" icon="check"
                loading={isVerifying}
                disabled={localCode.length !== 6}
                style={{ height: 34, padding: '0 14px', whiteSpace: 'nowrap' }}
                onClick={async () => {
                  isVerifying = true; paint();
                  try {
                    const j = await window.ociServices.system.verifyMfaCode({ code: localCode });
                    if (j && j.success) {
                      localStatus = 'success';
                      localResult = '验证成功！MFA 多因子认证已激活启用';
                      paint();
                      setMfa(m => ({ ...m, enabled: true, secret: localSecret, qr: localQr }));
                      await window.ociServices.system.updateMfaConfig({ enabled: true, issuer: mfa.appName || 'OCI-Pool Verify' });
                      shell.showToast('MFA 验证通过并已启用', { kind: 'success' });
                      setTimeout(() => { shell.closeModal(); loadSettings(); }, 1200);
                    } else {
                      localStatus = 'error';
                      localResult = (j && j.message) || '验证码错误，请重新输入';
                      paint();
                    }
                  } catch (err) {
                    localStatus = 'error';
                    localResult = err.message || '验证失败';
                    paint();
                  } finally {
                    isVerifying = false; paint();
                  }
                }}
              >
                验证并启用
              </Button>
            </div>
            {localResult && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                color: localStatus === 'success' ? 'var(--accent)' : 'var(--danger)',
                background: localStatus === 'success' ? 'var(--accent-soft)' : 'var(--danger-soft)',
                border: '1px solid ' + (localStatus === 'success' ? 'var(--accent)' : 'var(--danger)'),
              }}>
                {localStatus === 'success' ? '✓ ' : '✗ '}{localResult}
              </div>
            )}
          </div>
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="outline" size="md" onClick={shell.closeModal}>
            关闭
          </Button>
        </div>
      )
    });

    paint();
  };

  // 账号安全·保存修改 —— 对齐原项目 system_settings.js 的 updateAccount():
  // 校验当前密码必填、至少一处修改、新密码最少 8 位、两次密码一致,然后走真实后端
  // POST /api/system/updatePassword {currentPassword,newUsername,newPassword}。
  // 原接口无最小长度校验,这里在 UI 层强制 8 位以匹配提示文案;改密码成功后登出回登录页。
  const updateAccount = async () => {
    if (!account.currentPass) { shell.showToast(tr('pageMisc.cd043c'), { kind: 'warn' }); return; }
    const newUser = (account.newUser || '').trim();
    const newPass = account.newPass;
    const confirmPass = account.confirmPass;
    if (!newUser && !newPass) { shell.showToast(tr('pageMisc.89abd6'), { kind: 'warn' }); return; }
    if (newPass && newPass.length < 8) { shell.showToast(tr('pageMisc.5a32e2'), { kind: 'warn' }); return; }
    if (newPass && newPass !== confirmPass) { shell.showToast(tr('pageMisc.e21c48'), { kind: 'warn' }); return; }
    try {
      await window.ociServices.system.updatePassword({
        currentPassword: account.currentPass,
        newUsername: newUser || undefined,
        newPassword: newPass || undefined,
      });
      const clearAccount = { currentPass: '', newUser: '', newPass: '', confirmPass: '' };
      if (newPass) {
        shell.showToast(tr('pageMisc.931ad8'), { kind: 'success' });
        setAccount(a => ({ ...a, ...clearAccount }));
        setTimeout(() => { if (typeof window.__ocipLogout === 'function') window.__ocipLogout(); }, 900);
      } else {
        shell.showToast(tr('pageMisc.b1b60e'), { kind: 'success' });
        setAccount(a => ({ ...a, ...clearAccount }));
        setTimeout(() => { window.location.reload(); }, 900);
      }
    } catch (e) {
      shell.showToast(tr('pageMisc.42cf2d').replace('{0}',e.message || e), { kind: 'error' });
    }
  };

  // 对齐原项目 github-fetch-btn:通过用户名获取 GitHub ID
  // 对齐原项目 github-fetch-btn:通过 GitHub 公开 API 获取 GitHub ID
  const fetchGithubId = async () => {
    if (!github.githubUser.trim()) { shell.showToast(tr('pageMisc.70cd15'), { kind: 'warn' }); return; }
    setGithub(g => ({ ...g, fetching: true }));
    try {
      const res = await fetch('https://api.github.com/users/' + encodeURIComponent(github.githubUser.trim()));
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || tr('pageMisc.7b86ea'));
      setGithub(g => ({ ...g, githubId: String(data.id), githubUser: data.login || g.githubUser, fetching: false }));
      shell.showToast(tr('pageMisc.4d80fe').replace('{0}',data.id).replace('{1}',data.login), { kind: 'success' });
    } catch (e) {
      setGithub(g => ({ ...g, fetching: false }));
      shell.showToast(e.message || tr('pageMisc.00679c'), { kind: 'error' });
    }
  };

  const saveGithub = async () => {
    if (!github.githubId || !github.clientId || !github.clientSecret || !github.webhookUrl) {
      shell.showToast(tr('pageMisc.f295ad'), { kind: 'warn' });
      return;
    }
    setSecuritySaving('github');
    try {
      await window.ociServices.system.updateGithubConfig({
        enabled: github.enabled,
        userName: github.githubUser.trim(),
        githubId: github.githubId.trim(),
        clientId: github.clientId.trim(),
        clientSecret: github.clientSecret,
        redirectUri: github.webhookUrl.trim(),
      });
      await loadSettings();
      shell.showToast(tr('pageMisc.c33650'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.b38ee6').replace('{0}',e.message || e), { kind: 'error' }); }
    finally { setSecuritySaving(''); }
  };

  const saveGoogle = async () => {
    if (google.enabled && (!google.email || !google.clientId || !google.clientSecret || !google.webhookUrl)) {
      shell.showToast(tr('pageMisc.873ff5'), { kind: 'warn' });
      return;
    }
    setSecuritySaving('google');
    try {
      await window.ociServices.system.updateGoogleConfig({
        enabled: google.enabled,
        email: google.email.trim(),
        clientId: google.clientId.trim(),
        clientSecret: google.clientSecret,
        redirectUri: google.webhookUrl.trim(),
      });
      await loadSettings();
      shell.showToast(tr('pageMisc.8b38c2'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.b38ee6').replace('{0}',e.message || e), { kind: 'error' }); }
    finally { setSecuritySaving(''); }
  };

  const saveTurnstile = async () => {
    if (turnstile.enabled && (!turnstile.siteKey || !turnstile.secretKey)) {
      shell.showToast(tr('pageMisc.0a63ad'), { kind: 'warn' });
      return;
    }
    setSecuritySaving('turnstile');
    try {
      await window.ociServices.system.updateTurnstileConfig({
        enabled: turnstile.enabled,
        siteKey: turnstile.siteKey.trim(),
        secretKey: turnstile.secretKey,
      });
      await loadSettings();
      shell.showToast(tr('pageMisc.9a7ef4'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.b38ee6').replace('{0}',e.message || e), { kind: 'error' }); }
    finally { setSecuritySaving(''); }
  };

  const saveLogo = async () => {
    const logoName = siteLogo.trim();
    if (!logoName) { shell.showToast(tr('pageMisc.1a92fa'), { kind: 'warn' }); return; }
    if (logoName.length > 15) { shell.showToast(tr('pageMisc.59e04d'), { kind: 'warn' }); return; }
    setSecuritySaving('logo');
    try {
      await window.ociServices.system.updateLogo({ logoName });
      await loadSettings();
      shell.showToast(tr('pageMisc.174c0a'), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.ed237b').replace('{0}',e.message || e), { kind: 'error' }); }
    finally { setSecuritySaving(''); }
  };

  const saveChannelNotify = async () => {
    setSecuritySaving('channelNotify');
    try {
      await window.ociServices.system.updateChannelNotifyConfig({ enabled: channelNotify.enabled });
      await loadSettings();
      shell.showToast(tr('pageMisc.6dd435').replace('{0}',channelNotify.enabled ? tr('pageMisc.enable') : tr('pageMisc.disable')), { kind: 'success' });
    } catch (e) { shell.showToast(tr('pageMisc.d848c8').replace('{0}',e.message || e), { kind: 'error' }); }
    finally { setSecuritySaving(''); }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 顶部标题栏 · 补全刷新按钮 */}
      <PageHeader
        title={tr('pageMisc.140976')}
        subtitle={tr('pageMisc.43a59b')}
        icon="settings"
        iconColor="var(--accent)"
        actions={
          <Button variant="outline" size="md" icon="refresh-cw" loading={loading} onClick={loadSettings}>
            刷新
          </Button>
        }
      />
      {/* 2 列网格布局，同行卡片 Flex 自然撑满等高、底栏水平对齐 */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4, paddingBottom: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 14,
        alignItems: 'stretch',
      }}>

        {/* ① 账号安全卡 · 对齐原项目 sys.security · 图标色 #4a9eff */}
        <SettingsCard title={tr('pageMisc.4404d5')} icon="user" iconColor="#4a9eff"
          footer={<Button variant="primary" size="sm" icon="save" onClick={updateAccount} disabled={!accountReady}>{tr('pageMisc.c5575b')}</Button>}>
          <FormRow label={tr('pageMisc.afd9b0')}>
            <TextInput value={account.currentUser} onChange={v => setAccount(a => ({ ...a, currentUser: v }))} placeholder="admin" mono readOnly />
          </FormRow>
          {/* 对齐原项目:Logo 字段单独一行,含独立"保存"按钮 */}
          <FormRow label="Logo" hint={tr('pageMisc.3b3c2a')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput value={siteLogo} onChange={setSiteLogo} placeholder="OCI-POOL" />
              <Button variant="info" size="sm" icon="check"
                loading={securitySaving === 'logo'}
                disabled={!siteLogo.trim() || siteLogo.trim().length > 15}
                onClick={() => shell.openConfirm({
                  title: tr('pageMisc.fe3d6b'),
                  body: <div>{tr('pageMisc.01a636')} <b>{siteLogo.trim()}</b>。</div>,
                  confirmLabel: tr('pageMisc.be5fbb'),
                  onConfirm: saveLogo,
                })}
              >{tr('pageMisc.be5fbb')}</Button>
            </div>
          </FormRow>
          {/* 密码 4 字段:窄屏(<= 500px)自动降为 1 列 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <FormRow label={tr('pageMisc.a806ce')} required>
              <PasswordInput value={account.currentPass} onChange={v => setAccount(a => ({ ...a, currentPass: v }))} placeholder={tr('pageMisc.4ef2c6')} />
            </FormRow>
            <FormRow label={tr('pageMisc.95f823')} hint={tr('pageMisc.08f020')}>
              <TextInput value={account.newUser} onChange={v => setAccount(a => ({ ...a, newUser: v }))} placeholder={tr('pageMisc.d94157')} mono />
            </FormRow>
            <FormRow label={tr('pageMisc.bf7da0')} hint={tr('pageMisc.08f020')}>
              <PasswordInput value={account.newPass} onChange={v => setAccount(a => ({ ...a, newPass: v }))} placeholder={tr('pageMisc.46cb9d')} />
            </FormRow>
            <FormRow label={tr('pageMisc.670d63')}>
              <PasswordInput value={account.confirmPass} onChange={v => setAccount(a => ({ ...a, confirmPass: v }))} placeholder={tr('pageMisc.ec7b73')} />
            </FormRow>
          </div>
        </SettingsCard>

        {/* GitHub OAuth 卡 */}
        {/* ② GitHub OAuth 卡 · 图标色 #adbac7 */}
        <SettingsCard title={tr('pageMisc.d220de')} icon="github" iconColor="#adbac7"
          actions={
            <ToggleSwitch
              value={github.enabled}
              onChange={v => setGithub(g => ({ ...g, enabled: v }))}
            />
          }
          footer={<Button variant="primary" size="sm" icon="save"
            loading={securitySaving === 'github'}
            disabled={!githubReady}
            onClick={() => shell.openConfirm({ title: tr('pageMisc.89c802'), confirmLabel: tr('pageMisc.be5fbb'), onConfirm: saveGithub })}
          >{tr('pageMisc.ed7526')}</Button>}>
          {/* GitHub 用户名 + 获取 ID 按钮 · 对齐原项目 github-fetch-btn */}
          <FormRow label={tr('pageMisc.391f61')} hint={tr('pageMisc.6bd15e')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput value={github.githubUser} onChange={v => setGithub(g => ({ ...g, githubUser: v }))} placeholder="your-github-username" mono />
              <Button variant="info" size="sm" icon="search"
                loading={github.fetching}
                disabled={!github.githubUser.trim()}
                onClick={fetchGithubId}
              >{tr('pageMisc.f81b9c')}</Button>
            </div>
          </FormRow>
          <FormRow label="GitHub ID" hint={tr('pageMisc.ad28ca')}>
            <input type="text" value={github.githubId} readOnly
              placeholder={tr('pageMisc.b072b0')}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <FormRow label="Client ID" required>
              <TextInput value={github.clientId} onChange={v => setGithub(g => ({ ...g, clientId: v }))} placeholder="Iv1.xxxxxxxxxxxxxxxx" mono />
            </FormRow>
            <FormRow label="Client Secret" required>
              <PasswordInput value={github.clientSecret} onChange={v => setGithub(g => ({ ...g, clientSecret: v }))} placeholder={tr('pageMisc.d08824')} />
            </FormRow>
          </div>
          <FormRow label={tr('pageMisc.e31748')} hint={tr('pageMisc.9ff7c7')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={github.webhookUrl} onChange={e => setGithub(g => ({ ...g, webhookUrl: e.target.value }))}
                placeholder="http(s)://your-domain/api/github/callback"
                style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <button onClick={() => { navigator.clipboard.writeText(github.webhookUrl); shell.showToast(tr('pageMisc.75420d'), { kind: 'info' }); }}
                style={{ padding: '6px 12px', background: 'var(--bg-2)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                {tr('pageMisc.79d3ab')}
              </button>
            </div>
          </FormRow>
        </SettingsCard>

        {/* Google OAuth 卡 */}
        {/* ③ Google OAuth 卡 */}
        <SettingsCard title={tr('pageMisc.260efe')} icon="chrome" iconColor="#4285f4"
          actions={
            <ToggleSwitch
              value={google.enabled}
              onChange={v => setGoogle(g => ({ ...g, enabled: v }))}
            />
          }
          footer={<Button variant="primary" size="sm" icon="save"
            loading={securitySaving === 'google'}
            disabled={!googleReady}
            onClick={() => shell.openConfirm({ title: tr('pageMisc.853ba8'), confirmLabel: tr('pageMisc.be5fbb'), onConfirm: saveGoogle })}
          >{tr('pageMisc.ed7526')}</Button>}>
          {/* ⚠ 允许的邮箱 · 第一位 · 对齐原项目 sys.googleUser * 必填 */}
          <FormRow label={tr('pageMisc.9d1bbb')} required hint={tr('pageMisc.7b3d41')}>
            <input type="email" value={google.email}
              onChange={e => setGoogle(g => ({ ...g, email: e.target.value }))}
              placeholder={tr('pageMisc.f036cd')}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <FormRow label="Client ID" required hint={tr('pageMisc.1058e4')}>
              <TextInput value={google.clientId} onChange={v => setGoogle(g => ({ ...g, clientId: v }))} placeholder={tr('pageMisc.d1341a')} mono />
            </FormRow>
            <FormRow label="Client Secret" required>
              <PasswordInput value={google.clientSecret} onChange={v => setGoogle(g => ({ ...g, clientSecret: v }))} placeholder="Client Secret" />
            </FormRow>
          </div>
          <FormRow label={tr('pageMisc.0b7741')} hint={tr('pageMisc.0a928a')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={google.webhookUrl} onChange={e => setGoogle(g => ({ ...g, webhookUrl: e.target.value }))}
                placeholder="http(s)://your-domain/api/google/callback"
                style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <button onClick={() => { navigator.clipboard.writeText(google.webhookUrl); shell.showToast(tr('pageMisc.75420d'), { kind: 'info' }); }}
                style={{ padding: '6px 12px', background: 'var(--bg-2)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                {tr('pageMisc.79d3ab')}
              </button>
            </div>
          </FormRow>
        </SettingsCard>

        {/* MFA 配置卡（方案 1：向导弹窗流，主卡片永远紧凑恒定，彻底消灭高度跳动与大空洞） */}
        {(() => {
          const isMfaActivated = mfa.enabled && !!mfa.secret;
          return (
            <SettingsCard title={tr('pageMisc.033c7a')} icon="smartphone" iconColor="#1abc9c"
              actions={
                <ToggleSwitch
                  value={mfa.enabled}
                  onChange={v => setMfa(m => ({ ...m, enabled: v }))}
                />
              }
              footer={
                <>
                  {isMfaActivated && (
                    <Button variant="danger" size="sm" icon="trash-2"
                      onClick={() => shell.openConfirm({
                        title: tr('pageMisc.db54f0'),
                        body: <div>{tr('pageMisc.f5e8a7')}<b>{tr('pageMisc.528676')}</b>{tr('pageMisc.5bba60')}</div>,
                        danger: true, confirmLabel: tr('pageMisc.2f4aad'),
                        onConfirm: deleteMfa,
                      })}
                    >{tr('pageMisc.5a288b')}</Button>
                  )}
                  <Button variant="info" size="sm" icon={isMfaActivated ? "refresh-cw" : "key"}
                    onClick={openMfaSetupModal}
                  >{isMfaActivated ? '重新配置' : '配置向导'}</Button>
                  <Button variant="primary" size="sm" icon="save"
                    onClick={saveMfa}
                    disabled={!mfaReady}
                  >{tr('pageMisc.ed7526')}</Button>
                </>
              }>
              {/* 应用名称 */}
              <FormRow label={tr('pageMisc.27c386')} hint={tr('pageMisc.32d037')}>
                <TextInput value={mfa.appName} onChange={v => setMfa(m => ({ ...m, appName: v }))} placeholder="OCI-Pool Verify" />
              </FormRow>

              {/* 设备绑定状态（主卡片恒定展示，必须完成第三步动态码验证才算真正激活绑定） */}
              <FormRow label="设备绑定状态">
                {isMfaActivated ? (
                  <div style={{
                    padding: '9px 12px', background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="check-circle" size={14} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>已绑定 TOTP 认证器</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                        {mfa.showSecret ? mfa.secret : '••••••••••••'}
                      </span>
                      <button onClick={() => setMfa(m => ({ ...m, showSecret: !m.showSecret }))}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', padding: 0 }}>
                        <Icon name={mfa.showSecret ? 'eye-off' : 'eye'} size={12} />
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(mfa.secret); shell.showToast(tr('pageMisc.5e7930'), { kind: 'info' }); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', padding: 0 }}>
                        <Icon name="copy" size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '10px 12px', background: 'var(--bg-2)', border: '1px dashed var(--border)',
                    borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--fg-3)',
                  }}>
                    <Icon name="info" size={13} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                    <span>尚未完成动态验证绑定。点击下方「配置向导」扫码并在第三步完成验证以激活。</span>
                  </div>
                )}
              </FormRow>
            </SettingsCard>
          );
        })()}

        {/* Turnstile 验证码卡 */}
        {/* ⑥ Turnstile 验证码卡 · 图标色 #f0881a */}
        <SettingsCard title={tr('pageMisc.8bad94')} icon="bot" iconColor="#f0881a"
          actions={
            <ToggleSwitch
              value={turnstile.enabled}
              onChange={v => setTurnstile(t => ({ ...t, enabled: v }))}
            />
          }
          footer={<Button variant="primary" size="sm" icon="save"
            loading={securitySaving === 'turnstile'}
            disabled={!turnstileReady}
            onClick={() => shell.openConfirm({
              title: turnstile.enabled ? tr('pageMisc.da23b3') : tr('pageMisc.537bbd'),
              confirmLabel: tr('pageMisc.be5fbb'),
              onConfirm: saveTurnstile,
            })}
          >{tr('pageMisc.ed7526')}</Button>}>
          <div style={{
            padding: '10px 12px', marginBottom: 12,
            background: 'var(--info-soft)', border: '1px solid var(--info)',
            borderRadius: 4, fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.6,
          }}>
            <Icon name="info" size={11} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--info)' }} />
            {tr('pageMisc.241d47')} <b>Cloudflare Dashboard → Turnstile</b> {tr('pageMisc.72b1c3')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <FormRow label="Site Key" required>
              <TextInput value={turnstile.siteKey} onChange={v => setTurnstile(t => ({ ...t, siteKey: v }))} placeholder="0x4AAAAAAAxxxxxxxxxxxxxxx" mono />
            </FormRow>
            <FormRow label="Secret Key" required>
              <PasswordInput value={turnstile.secretKey} onChange={v => setTurnstile(t => ({ ...t, secretKey: v }))} placeholder={tr('pageMisc.2868d2')} />
            </FormRow>
          </div>
        </SettingsCard>

        {/* ⑦ 开机频道通知卡 · 严格对齐原项目 sys.channelNotify · 图标色 #9b59b6 */}
        <SettingsCard title={tr('pageMisc.85fe64')} icon="satellite" iconColor="#9b59b6"
          actions={
            <ToggleSwitch
              value={channelNotify.enabled}
              onChange={v => setChannelNotify(c => ({ ...c, enabled: v }))}
            />
          }
          footer={
            <Button variant="primary" size="sm" icon="save"
              loading={securitySaving === 'channelNotify'}
              onClick={() => shell.openConfirm({
                title: channelNotify.enabled ? tr('pageMisc.6957e4') : tr('pageMisc.734896'),
                confirmLabel: tr('pageMisc.be5fbb'),
                onConfirm: saveChannelNotify,
              })}
            >{tr('pageMisc.ed7526')}</Button>
          }>
          {/* 功能说明 */}
          <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.7, marginBottom: 14 }}>
            {tr('pageMisc.1f0567')} <b>{tr('pageMisc.f7da93')}</b>{tr('pageMisc.840ad8')}
          </div>

          {/* 隐私说明块 */}
          <div style={{
            padding: '12px 14px', marginBottom: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderLeft: '3px solid #9b59b6',
            borderRadius: 4,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--fg-0)',
              marginBottom: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="shield" size={13} style={{ color: '#9b59b6' }} />
              {tr('pageMisc.9d8e80')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.75 }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{tr('pageMisc.7633f2')}</span>
                {' '}{tr('pageMisc.37f0f7')} <span className="mono">ARM 4C24G</span>{tr('pageMisc.b9fa0a')} <span className="mono">us-sanjose-1</span>）
              </div>
              <div>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{tr('pageMisc.314ebd')}</span>
                {' '}{tr('pageMisc.5a1484')}
              </div>
            </div>
          </div>

          {/* 提示 */}
          <div style={{
            padding: '8px 12px',
            background: 'color-mix(in oklab, #9b59b6 10%, transparent)',
            border: '1px dashed #9b59b6',
            borderRadius: 4,
            fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.6,
          }}>
            <Icon name="info" size={11} style={{ verticalAlign: 'middle', marginRight: 5, color: '#9b59b6' }} />
            {tr('pageMisc.a950b3')} <b style={{ color: channelNotify.enabled ? '#9b59b6' : 'var(--fg-3)' }}>{channelNotify.enabled ? tr('pageMisc.1eefe8') : tr('pageMisc.da97c3')}</b>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

// ─── 4. 代理配置 ─────────────────────────────
// 对齐原项目 vpn_proxy.ftl:表格 · 增删改查 · 类型/URL/端口/账号密码/租户/强制/连接状态
function _LegacySysVpnProxyPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [proxies, setProxies] = React.useState(() => [].map((p, i) => ({
    id: p.id || `proxy-${i + 1}`,
    customName: p.name,
    type: p.type,
    url: p.host,
    port: p.port,
    username: 'proxyuser',
    password: 'Pr0xyPass!' + String(p.id || '').slice(-2),
    tenants: p.tenants || 0,
    force: false,
    connStatus: p.status === 'healthy' ? 'connected' : p.status === 'warning' ? 'warning' : 'error',
    latency: p.latency,
  })));

  const testAll = () => {
    shell.showToast(tr('pageMisc.7c2f57').replace('{0}',proxies.length), { kind: 'info' });
    setTimeout(() => shell.showToast(tr('pageMisc.73f6c5'), { kind: 'success' }), 1500);
  };

  const openProxyModal = (existing) => {
    const isEdit = !!existing;
    const s2 = existing ? { ...existing } : {
      customName: '', type: 'SOCKS5', url: '', port: 1080,
      username: '', password: '', tenants: 0, force: false,
    };
    const paint = () => shell.openModal({
      title: isEdit ? tr('pageMisc.df8e67') : tr('pageMisc.22a2f5'),
      icon: isEdit ? 'edit' : 'plus',
      iconColor: isEdit ? 'var(--info)' : 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label={tr('pageMisc.664795')} required>
              <TextInput value={s2.customName} onChange={v => { s2.customName = v; paint(); }} placeholder="e.g. JP-Tokyo-01" />
            </FormRow>
            <FormRow label={tr('pageMisc.89acb7')} required>
              <CustomDropdown value={s2.type} onChange={e => { s2.type = e; paint(); }} height={32} width="100%">
                {['SOCKS5', 'HTTP', 'HTTPS'].map(t => <option key={t} value={t}>{t}</option>)}
              </CustomDropdown>
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <FormRow label="URL / Host" required>
              <TextInput value={s2.url} onChange={v => { s2.url = v; paint(); }} placeholder="proxy.example.com" mono />
            </FormRow>
            <FormRow label={tr('pageMisc.c76cfe')} required>
              <NumberInput value={s2.port} onChange={v => { s2.port = v; paint(); }} min={1} max={65535} />
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label={tr('pageMisc.819767')}>
              <TextInput value={s2.username} onChange={v => { s2.username = v; paint(); }} placeholder={tr('pageMisc.dd5eb8')} mono />
            </FormRow>
            <FormRow label={tr('pageMisc.a81052')}>
              <PasswordInput value={s2.password} onChange={v => { s2.password = v; paint(); }} placeholder={tr('pageMisc.dd5eb8')} />
            </FormRow>
          </div>
          <FormRow label={tr('pageMisc.72243a')} hint={tr('pageMisc.828b6c')}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={s2.force} onChange={e => { s2.force = e.target.checked; paint(); }} />
              <span style={{ fontSize: 12, color: s2.force ? 'var(--orange)' : 'var(--fg-2)' }}>{s2.force ? tr('pageMisc.7f9cf5') : tr('pageMisc.09570c')}</span>
            </label>
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('common.cancel')}</Button>
          <Button variant="primary" size="md" icon="check"
            disabled={!s2.customName.trim() || !s2.url.trim()}
            onClick={() => {
              if (isEdit) {
                setProxies(prev => prev.map(p => p.id === s2.id ? { ...s2 } : p));
                shell.showToast(tr('pageMisc.757c5f').replace('{0}',s2.customName), { kind: 'success' });
              } else {
                setProxies(prev => [...prev, { ...s2, id: `proxy-${Date.now()}`, connStatus: 'unknown' }]);
                shell.showToast(tr('pageMisc.385d4f').replace('{0}',s2.customName), { kind: 'success' });
              }
              shell.closeModal();
            }}>{isEdit ? tr('pageMisc.be5fbb') : tr('pageMisc.b58c75')}</Button>
        </>
      ),
    });
    paint();
  };

  const statusCfg = {
    connected: { label: tr('pageMisc.c5ea9c'),  color: 'var(--accent)', bg: 'var(--accent-soft)', icon: 'check-circle' },
    warning:   { label: tr('pageMisc.900c70'),    color: 'var(--orange)', bg: 'var(--orange-soft)', icon: 'alert-triangle' },
    error:     { label: tr('pageMisc.7030ff'),    color: 'var(--danger)', bg: 'var(--danger-soft)', icon: 'x-circle' },
    unknown:   { label: tr('pageMisc.8c852a'),  color: 'var(--fg-3)',   bg: 'var(--bg-3)',        icon: 'circle' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.sysVpnProxy')}
        subtitle={tr('pageMisc.c17f05')}
        icon="shuffle"
        iconColor="var(--cyan)"
        actions={
          <>
            <Button variant="outline" size="md" icon="zap" onClick={testAll}>{tr('pageMisc.570b66')}</Button>
            <Button variant="primary" size="md" icon="plus" onClick={() => openProxyModal(null)}>{tr('pageMisc.dc0572')}</Button>
          </>
        }
      />

      {/* 代理表格 · 10 列 · 对齐原项目 vpn_proxy.ftl */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="list" size={13} style={{ color: 'var(--fg-2)' }} />
          {tr('pageMisc.54a278')}
          <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({proxies.length})</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                {[
                  { h: tr('pageMisc.664795'), w: 140 },
                  { h: tr('pageMisc.226b09'),      w: 80,  align: 'center' },
                  { h: 'URL' },
                  { h: tr('pageMisc.c76cfe'),      w: 70,  align: 'center' },
                  { h: tr('pageMisc.819767'),    w: 110 },
                  { h: tr('pageMisc.a81052'),      w: 100 },
                  { h: tr('pageMisc.b944fc'),    w: 80,  align: 'center' },
                  { h: tr('pageMisc.4def0b'),      w: 60,  align: 'center' },
                  { h: tr('pageMisc.791261'),  w: 140, align: 'center' },
                  { h: tr('pageMisc.2b6bc0'),      w: 100, align: 'center' },
                ].map((c, i) => (
                  <th key={i} style={{
                    textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                    background: 'var(--bg-2)', color: 'var(--fg-3)',
                    fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proxies.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                  <Icon name="inbox" size={26} style={{ opacity: 0.35 }} />
                  <div style={{ marginTop: 6 }}>{tr('pageMisc.907619')}</div>
                </td></tr>
              ) : proxies.map((p, i) => {
                const st = statusCfg[p.connStatus] || statusCfg.unknown;
                return (
                  <tr key={p.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{p.customName}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{
                        padding: '2px 8px', borderRadius: 3,
                        background: p.type === 'SOCKS5' ? 'var(--info-soft)' : p.type === 'HTTPS' ? 'var(--accent-soft)' : 'var(--orange-soft)',
                        color: p.type === 'SOCKS5' ? 'var(--info)' : p.type === 'HTTPS' ? 'var(--accent)' : 'var(--orange)',
                        fontSize: 10.5, fontWeight: 700,
                      }}>{p.type}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{p.url}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="num mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{p.port}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{p.username || '—'}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.password ? '••••••' : '—'}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="num" style={{ fontSize: 11.5, color: p.tenants > 0 ? 'var(--fg-1)' : 'var(--fg-3)', fontWeight: p.tenants > 0 ? 600 : 400 }}>{p.tenants}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      {p.force ? (
                        <span style={{ padding: '1px 6px', background: 'var(--orange-soft)', color: 'var(--orange)', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>{tr('pageMisc.4def0b')}</span>
                      ) : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 3,
                        background: st.bg, color: st.color,
                        fontSize: 10.5, fontWeight: 500,
                        whiteSpace: 'nowrap',    // 一行显示,不换行
                      }}>
                        <Icon name={st.icon} size={9} />
                        <span>{st.label}</span>
                        {p.latency && <span className="num" style={{ opacity: 0.8 }}>· {p.latency}ms</span>}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button title={tr('pageMisc.db06c7')} onClick={() => {
                          shell.showToast(tr('pageMisc.ae2632').replace('{0}',p.customName), { kind: 'info' });
                          setTimeout(() => shell.showToast(tr('pageMisc.77e098').replace('{0}',p.customName), { kind: 'success' }), 800);
                        }}
                          style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="zap" size={11} />
                        </button>
                        <button title={tr('pageMisc.95b351')} onClick={() => openProxyModal(p)}
                          style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="edit" size={11} />
                        </button>
                        <button title={tr('pageMisc.2f4aad')} onClick={() => shell.openConfirm({
                          title: tr('pageMisc.033e14').replace('{0}',p.customName),
                          body: <div>{tr('pageMisc.edfb54')} <b>{p.tenants}</b> {tr('pageMisc.1c9b4b')}</div>,
                          danger: true, confirmLabel: tr('pageMisc.2f4aad'),
                          onConfirm: () => { setProxies(prev => prev.filter(x => x.id !== p.id)); shell.showToast(tr('pageMisc.0a61f9'), { kind: 'warn' }); },
                        })}
                          style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="trash-2" size={11} />
                        </button>
                      </div>
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

function ProxyFormBody({ existing, parentTenants = [], bodyRef, onSave }) {
  const { t: tr, lang } = useT();
  const [form, setForm] = React.useState(() => ({
    id: existing && existing.id != null ? existing.id : null,
    customName: (existing && existing.customName) || '',
    proxyType: (existing && existing.proxyType) || 'HTTP',
    proxyHost: (existing && existing.proxyHost) || '',
    proxyPort: existing && existing.proxyPort != null ? Number(existing.proxyPort) : 8080,
    proxyUsername: (existing && existing.proxyUsername) || '',
    proxyPassword: (existing && existing.proxyPassword) || '',
    availableStatus: existing && existing.availableStatus != null ? Number(existing.availableStatus) : 1,
    forceProxy: existing && existing.forceProxy != null ? Number(existing.forceProxy) : 0,
    tenantIds: Array.isArray(existing && existing.tenantIds) && existing.tenantIds.length
      ? existing.tenantIds.map(String)
      : (existing && existing.tenantId != null && existing.tenantId !== '' ? [String(existing.tenantId)] : []),
  }));
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [tenantSearch, setTenantSearch] = React.useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectTenant = (id) => {
    if (!id) {
      set('tenantIds', []);
    } else {
      set('tenantIds', [String(id)]);
    }
  };

  const filteredTenants = React.useMemo(() => {
    if (!tenantSearch.trim()) return parentTenants;
    const q = tenantSearch.toLowerCase().trim();
    return parentTenants.filter(t => {
      const name = (t.name || t.tenancyName || t.defName || '').toLowerCase();
      const reg = (t.region || '').toLowerCase();
      return name.includes(q) || reg.includes(q);
    });
  }, [parentTenants, tenantSearch]);

  const testConnection = async () => {
    if (testing) return;
    setTesting(true);
    try {
      let res;
      if (form.id) {
        res = await window.ociServices.proxy.testConnection({ id: form.id });
      } else {
        res = await window.ociServices.proxy.testConnection({
          proxyType: form.proxyType,
          proxyHost: form.proxyHost.trim(),
          proxyPort: Number(form.proxyPort),
          proxyUsername: form.proxyUsername.trim() || undefined,
          proxyPassword: form.proxyPassword || undefined,
        });
      }
      const ok = res && res.success !== false && (res?.data?.connected ?? res?.connected ?? true);
      window.ociShell?.showToast?.(ok ? '✓ 代理连接成功' : '✗ 代理无法连接', { kind: ok ? 'success' : 'warn' });
    } catch (e) {
      window.ociShell?.showToast?.(e.message || '测试连接失败', { kind: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const submit = async () => {
    if (!form.customName.trim() || !form.proxyHost.trim() || !form.proxyPort) {
      onSave && onSave({ error: true, message: tr('pageMisc.27ae89') || '请填写必填项' });
      return;
    }
    if (form.proxyPort < 1 || form.proxyPort > 65535) {
      onSave && onSave({ error: true, message: tr('pageMisc.aaa6c2') || '端口范围不合法' });
      return;
    }
    const tenantIds = form.tenantIds.map(Number).filter(n => !isNaN(n) && n > 0);
    const body = {
      id: form.id,
      proxyType: form.proxyType,
      proxyHost: form.proxyHost.trim(),
      proxyPort: Number(form.proxyPort),
      proxyUsername: form.proxyUsername.trim() || null,
      proxyPassword: form.proxyPassword || null,
      availableStatus: Number(form.availableStatus),
      forceProxy: Number(form.forceProxy),
      customName: form.customName.trim(),
      tenantIds: tenantIds,
      tenantId: tenantIds.length ? tenantIds[0] : null,
    };
    setSaving(true);
    try {
      const res = await window.ociServices.proxy.saveOrUpdate(body);
      if (!res || !res.success) throw new Error((res && res.message) || tr('pageMisc.6de920'));
      onSave && onSave({ success: true, message: tr('pageMisc.d99e24') || '保存成功' });
    } catch (e) {
      onSave && onSave({ error: true, message: e.message || tr('pageMisc.6de920') });
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    if (bodyRef) bodyRef.current = { save: submit, test: testConnection, testing, saving };
    return () => { if (bodyRef) bodyRef.current = null; };
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.45fr) 280px',
      gap: 16,
      padding: '16px 22px 20px',
      minHeight: 440,
    }}>
      {/* ─── 左侧：代理核心参数卡片 (100% 对齐图4客户端 leftPane) ─── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="server" size={14} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>代理参数</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>类型、地址、认证与可用状态</div>
          </div>
        </div>

        <FormRow label="自定义名称">
          <TextInput
            icon="tag"
            value={form.customName}
            onChange={v => set('customName', v)}
            placeholder="可选，仅展示"
          />
        </FormRow>

        <FormRow label="代理类型" required>
          <CustomDropdown
            value={form.proxyType}
            onChange={v => set('proxyType', v)}
            height={32}
            width={180}
          >
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS5">SOCKS5</option>
          </CustomDropdown>
        </FormRow>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <FormRow label="代理地址" required>
            <TextInput
              mono
              icon="globe"
              value={form.proxyHost}
              onChange={v => set('proxyHost', v)}
              placeholder="192.168.1.1 / 127.0.0.1"
            />
          </FormRow>
          <FormRow label="端口" required>
            <TextInput
              mono
              icon="hash"
              value={String(form.proxyPort)}
              onChange={v => set('proxyPort', v.replace(/\D/g, ''))}
              placeholder="8080"
            />
          </FormRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormRow label="用户名">
            <TextInput
              mono
              icon="user"
              value={form.proxyUsername}
              onChange={v => set('proxyUsername', v)}
              placeholder="留空表示无鉴权"
            />
          </FormRow>
          <FormRow label="密码">
            <TextInput
              mono
              icon="key"
              type="password"
              value={form.proxyPassword}
              onChange={v => set('proxyPassword', v)}
              placeholder="留空表示无鉴权"
            />
          </FormRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormRow label="状态" required>
            <CustomDropdown
              value={String(form.availableStatus)}
              onChange={v => set('availableStatus', +v)}
              height={32}
              width="100%"
            >
              <option value="1">可用</option>
              <option value="0">禁用</option>
            </CustomDropdown>
          </FormRow>
          <FormRow label="强制使用代理" required>
            <CustomDropdown
              value={String(form.forceProxy)}
              onChange={v => set('forceProxy', +v)}
              height={32}
              width="100%"
            >
              <option value="0">非强制</option>
              <option value="1">强制</option>
            </CustomDropdown>
          </FormRow>
        </div>

        {/* 动态盾牌释义 (100% 对齐图4客户端单行极简文字，无浅绿厚重背景) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Icon
            name="shield"
            size={11}
            style={{ color: Number(form.forceProxy) === 1 ? 'var(--orange)' : 'var(--accent)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {Number(form.forceProxy) === 1
              ? '已开启强制：代理不通时拒绝向云厂商发起请求'
              : '非强制：代理不通时可回退直连'}
          </span>
        </div>
      </div>

      {/* ─── 右侧：绑定租户专区 (100% 对齐图4客户端 rightPane) ─── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 14,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="link" size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>绑定租户</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>可多选；空 = 全局共享代理池</div>
          </div>
        </div>

        {/* 当前绑定状态卡 (100% 对齐图4客户端软绿底卡片) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'color-mix(in oklab, var(--accent) 14%, transparent)',
          marginBottom: 10,
        }}>
          <Icon
            name={form.tenantIds.length === 0 ? "globe" : "users"}
            size={16}
            style={{ color: 'var(--accent)', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 1 }}>当前绑定</div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--fg-0)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {form.tenantIds.length === 0 ? '全局共享' : `已绑定 ${form.tenantIds.length} 个租户`}
            </div>
          </div>
        </div>

        {/* 搜索租户输入框 (占位符为纯字「搜索租户」) */}
        <div style={{ marginBottom: 8 }}>
          <TextInput
            icon="search"
            value={tenantSearch}
            onChange={setTenantSearch}
            placeholder="搜索租户"
          />
        </div>

        {/* 租户列表 (首项为全局共享，各项带中文区域名) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '4px',
          display: 'flex', flexDirection: 'column', gap: 2,
          minHeight: 220,
          maxHeight: 280,
        }}>
          {/* 首项：全局共享 (fallback pool) */}
          <div
            onClick={() => selectTenant(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
              background: form.tenantIds.length === 0 ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
              transition: 'all 80ms',
            }}
          >
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              border: form.tenantIds.length === 0 ? 'none' : '1.5px solid var(--border-strong)',
              background: form.tenantIds.length === 0 ? 'var(--accent)' : 'transparent',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-0)' }}>全局共享</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>fallback pool</div>
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>
              无匹配租户
            </div>
          ) : (
            filteredTenants.map(t => {
              const checked = form.tenantIds.includes(String(t.id));
              const regionMeta = (window.REGION_MAP && (window.REGION_MAP[t.region]?.simpleName || window.REGION_MAP[t.region]?.cn)) || t.region || `#${t.id}`;
              return (
                <div
                  key={t.id}
                  onClick={() => selectTenant(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 6,
                    cursor: 'pointer',
                    background: checked ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
                    transition: 'all 80ms',
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    border: checked ? 'none' : '1.5px solid var(--border-strong)',
                    background: checked ? 'var(--accent)' : 'transparent',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: checked ? 600 : 400,
                      color: 'var(--fg-0)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.name || t.tenancyName}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>
                      {regionMeta}
                    </div>
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

function SysVpnProxyPage() {
  const { t: tr } = useT();
  const shell = useShell();

  const [proxies, setProxies] = React.useState([]);
  const [totalElements, setTotalElements] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [parentTenants, setParentTenants] = React.useState([]);
  const [testingId, setTestingId] = React.useState(null);
  const [testingAll, setTestingAll] = React.useState(false);
  const bodyRef = React.useRef(null);

  const loadList = React.useCallback(async (p, ps) => {
    setLoading(true);
    try {
      const res = await window.ociServices.proxy.pageList({ pageNum: p, pageSize: ps });
      if (res && res.success === false) throw new Error(res.message || tr('pageMisc.866b79'));
      const data = (res && res.data) || {};
      setProxies(data.content || []);
      setTotalElements(Number(data.totalElements) || 0);
    } catch (e) {
      setProxies([]);
      setTotalElements(0);
      shell.showToast(e.message || tr('pageMisc.be71f1'), { kind: 'error' });
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await window.ociServices.tenant.listParentTenants();
        const list = Array.isArray(data) ? data : (data && data.data ? data.data : []);
        setParentTenants((list || []).map(t => ({
          id: t.id != null ? String(t.id) : '',
          name: t.tenancyName || t.userName || ('#' + t.id),
          region: t.region || t.homeRegion || '',
        })));
      } catch (_) {
        setParentTenants([]);
      }
    })();
  }, []);

  React.useEffect(() => { loadList(page, perPage); }, [page, perPage]);

  const testOne = async (p) => {
    setTestingId(p.id);
    try {
      const res = await window.ociServices.proxy.testConnection({ id: p.id });
      if (!res || !res.success) throw new Error((res && res.message) || tr('pageMisc.9710d9'));
      const payload = (res && res.data) || {};
      const connected = !!payload.connected;
      const status = payload.availableStatus != null ? Number(payload.availableStatus) : (connected ? 1 : 0);
      setProxies(prev => prev.map(x => x.id === p.id ? { ...x, availableStatus: status } : x));
      shell.showToast(connected ? tr('pageMisc.d2b3fc') : tr('pageMisc.645aa5'), { kind: connected ? 'success' : 'error' });
    } catch (e) {
      shell.showToast(e.message || tr('pageMisc.9710d9'), { kind: 'error' });
    } finally {
      setTestingId(null);
    }
  };

  const testAll = async () => {
    setTestingAll(true);
    try {
      const res = await window.ociServices.proxy.testAll();
      if (!res || !res.success) throw new Error((res && res.message) || tr('pageMisc.9710d9'));
      const data = (res && res.data) || {};
      shell.showToast(tr('pageMisc.75fd76').replace('{0}',data.total || 0).replace('{1}',data.successCount || 0).replace('{2}',data.failCount || 0), { kind: 'success' });
      loadList(page, perPage);
    } catch (e) {
      shell.showToast(e.message || tr('pageMisc.90200c'), { kind: 'error' });
    } finally {
      setTestingAll(false);
    }
  };

  const openProxyModal = (existing) => {
    bodyRef.current = null;
    const isEdit = !!existing;
    shell.openModal({
      title: isEdit ? '编辑代理配置' : '新增代理配置',
      icon: 'arrow-left-right',
      iconColor: 'var(--accent)',
      width: 760,
      body: <ProxyFormBody existing={existing || null} parentTenants={parentTenants} bodyRef={bodyRef}
        onSave={({ success, error, message }) => {
          if (success) { shell.closeModal(); loadList(page, perPage); shell.showToast('✓ ' + message, { kind: 'success' }); }
          else if (error) { shell.showToast(message, { kind: 'warn' }); }
        }} />,
      footer: (
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="md" onClick={shell.closeModal}>取消</Button>
          <Button variant="primary" size="md" icon="download" onClick={() => bodyRef.current && bodyRef.current.save()}>
            保存
          </Button>
        </>
      ),
    });
  };

  const deleteProxy = (p) => {
    shell.openConfirm({
      title: tr('pageMisc.033e14').replace('{0}',p.customName || p.proxyHost),
      body: <div>{tr('pageMisc.2142a4')}</div>,
      danger: true, confirmLabel: tr('pageMisc.2f4aad'),
      onConfirm: async () => {
        try {
          const res = await window.ociServices.proxy.remove({ id: p.id });
          if (!res || !res.success) throw new Error((res && res.message) || tr('pageMisc.acf066'));
          shell.showToast(tr('pageMisc.0a61f9'), { kind: 'warn' });
          loadList(page, perPage);
        } catch (e) {
          shell.showToast(e.message || tr('pageMisc.acf066'), { kind: 'error' });
        }
      },
    });
  };

  const toggleForce = async (p) => {
    const next = (p.forceProxy === 1 || p.forceProxy === true || p.forceProxy === '1') ? 0 : 1;
    const tIds = Array.isArray(p.tenantIds) && p.tenantIds.length ? p.tenantIds
      : (p.tenantId != null && p.tenantId !== '' ? [p.tenantId] : []);
    const body = {
      id: p.id,
      proxyType: p.proxyType,
      proxyHost: p.proxyHost,
      proxyPort: p.proxyPort,
      proxyUsername: p.proxyUsername,
      proxyPassword: p.proxyPassword,
      availableStatus: p.availableStatus,
      forceProxy: next,
      customName: p.customName,
      tenantIds: tIds,
      tenantId: tIds.length ? tIds[0] : null,
    };
    try {
      const res = await window.ociServices.proxy.saveOrUpdate(body);
      if (!res || !res.success) throw new Error((res && res.message) || tr('pageMisc.2d5fba'));
      setProxies(prev => prev.map(x => x.id === p.id ? { ...x, forceProxy: next } : x));
      shell.showToast(next === 1 ? tr('pageMisc.754fde') : tr('pageMisc.788a8c'), { kind: 'success' });
    } catch (e) {
      shell.showToast(e.message || tr('pageMisc.2d5fba'), { kind: 'error' });
    }
  };

  const statusCfg = (record) => {
    if (testingAll || testingId === record.id) {
      return { label: tr('pageMisc.2ff33d'), color: 'var(--info)', bg: 'var(--info-soft)', icon: 'refresh-cw' };
    }
    if (record.availableStatus === 1) return { label: tr('pageMisc.c5ea9c'), color: 'var(--accent)', bg: 'var(--accent-soft)', icon: 'check-circle' };
    return { label: tr('pageMisc.d1e4a7'), color: 'var(--danger)', bg: 'var(--danger-soft)', icon: 'x-circle' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={tr('nav.sysVpnProxy')}
        subtitle={tr('pageMisc.c17f05')}
        icon="shuffle"
        iconColor="var(--cyan)"
        actions={
          <>
            <Button variant="outline" size="md" icon="zap" loading={testingAll} onClick={testAll}>{tr('pageMisc.570b66')}</Button>
            <Button variant="primary" size="md" icon="plus" onClick={() => openProxyModal(null)}>{tr('pageMisc.dc0572')}</Button>
          </>
        }
      />
      <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
          fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="list" size={13} style={{ color: 'var(--fg-2)' }} />
          {tr('pageMisc.54a278')}
          <span className="num" style={{ color: 'var(--fg-3)', fontWeight: 400 }}>({totalElements})</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-2)' }}>{tr('pageMisc.c6c150')}</div>
          ) : (
            <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { h: tr('pageMisc.664795'), w: 140 },
                    { h: tr('pageMisc.226b09'), w: 80, align: 'center' },
                    { h: 'URL', w: 160 },
                    { h: tr('pageMisc.c76cfe'), w: 70, align: 'center' },
                    { h: tr('pageMisc.819767'), w: 110 },
                    { h: tr('pageMisc.a81052'), w: 90 },
                    { h: tr('pageMisc.4787d6'), w: 160 },
                    { h: tr('pageMisc.4def0b'), w: 70, align: 'center' },
                    { h: tr('pageMisc.791261'), w: 120, align: 'center' },
                    { h: tr('pageMisc.2b6bc0'), w: 120, align: 'center' },
                  ].map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'center', padding: '9px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ opacity: (loading && proxies.length > 0) ? 0.6 : 1, transition: 'opacity 120ms' }}>
                {(loading || !hasLoadedOnce) && proxies.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 13 }}>加载中…</span>
                    </div>
                  </td></tr>
                ) : proxies.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 0 }}>
                    <EmptyState
                      icon="shield"
                      title="暂无代理配置"
                      subtitle="点击「新增代理」配置 HTTP/HTTPS 出口代理"
                      actionLabel="新增代理"
                      onAction={() => openProxyModal(null)}
                    />
                  </td></tr>
                ) : proxies.map((p, i) => {
                  const st = statusCfg(p);
                  const tenantIds = Array.isArray(p.tenantIds) && p.tenantIds.length ? p.tenantIds
                    : (p.tenantId != null && p.tenantId !== '' ? [p.tenantId] : []);
                  const tenantLabel = tenantIds.length ? (p.tenantName || tenantIds.map(id => '#' + id).join(', ')) : tr('pageMisc.32a721');
                  const forced = p.forceProxy === 1 || p.forceProxy === true || p.forceProxy === '1';
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 500 }}>{p.customName || '—'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{
                          padding: '2px 8px', borderRadius: 3,
                          background: p.proxyType === 'HTTPS' ? 'var(--accent-soft)' : 'var(--info-soft)',
                          color: p.proxyType === 'HTTPS' ? 'var(--accent)' : 'var(--info)',
                          fontSize: 10.5, fontWeight: 700,
                        }}>{p.proxyType}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{p.proxyHost}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="num mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{p.proxyPort}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{p.proxyUsername || '—'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.proxyPassword ? '••••••' : '—'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11.5, color: tenantIds.length ? 'var(--fg-1)' : 'var(--fg-3)' }}>{tenantLabel}</span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {forced ? (
                          <span style={{ padding: '1px 6px', background: 'var(--orange-soft)', color: 'var(--orange)', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>{tr('pageMisc.4def0b')}</span>
                        ) : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('pageMisc.781c06')}</span>}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 3,
                          background: st.bg, color: st.color,
                          fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap',
                        }}>
                          <Icon name={st.icon} size={9} />
                          <span>{st.label}</span>
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button title={tr('pageMisc.db06c7')} onClick={() => testOne(p)}
                            disabled={testingId === p.id || testingAll}
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="zap" size={11} />
                          </button>
                          <button title={tr('pageMisc.ffdf01')} onClick={() => toggleForce(p)}
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--orange)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="shield" size={11} />
                          </button>
                          <button title={tr('pageMisc.95b351')} onClick={() => openProxyModal(p)}
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--info)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="edit" size={11} />
                          </button>
                          <button title={tr('pageMisc.2f4aad')} onClick={() => deleteProxy(p)}
                            style={{ width: 26, height: 26, background: 'var(--bg-2)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="trash-2" size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
          <Pagination total={totalElements} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1); }} t={tr} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MailPage, ObjectPage, AIPage, LinkPage,
  ProxyPoolPage, ResListPage, ResCloudInitPage,
  NotifyPage,
  // 系统管理 4 页
  SysIpQualityPage, SysLogsPage, SysSettingPage, SysVpnProxyPage,
  openChatDrawerFor,
  // 全屏 AI 对话工作台（对齐 macOS 客户端 AiChatView）
  AiChatPage,
});
