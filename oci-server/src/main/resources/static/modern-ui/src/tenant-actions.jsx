// All action implementations for the tenant "..." menu (14 items) + top toolbar buttons.
// Each returns a `(shell, tenant?) => void` — call it after menu closes.

// ─── Region label helper ─────────────────────────────────────────
// Produces "亚太-新加坡" style labels: continent prefix + city name.
// City is extracted from parenthesized suffix if present (e.g. "新加坡" or "东京" from "日本东部(东京)").
const CONTINENT_CN = {
  asia:     tr('tenant.61910a'),
  europe:   tr('tenant.3e1f4d'),
  americas: tr('tenant.f26eed'),
  africa:   tr('tenant.ca0760'),
};
const tenantLabel = tenant => getTenantName(tenant) || tenant?.userName || '';
// 区域别名：code → simpleName / cn，未知则回退 code（对齐租户详情页显示）
const regionSimpleName = (code) => {
  const r = REGIONS.find(x => x.code === code);
  return r ? (r.simpleName || r.cn || code) : code;
};
function formatRegionLabel(r) {
  if (!r || !getRegionSimpleName(r)) return '';
  const parenMatch = getRegionSimpleName(r).match(/(.+?)[\(（]([^)）]+)[\)）]$/);
  const city = parenMatch ? parenMatch[2].trim() : getRegionSimpleName(r);
  const prefix = CONTINENT_CN[r.continent] || '';
  return prefix ? `${prefix}-${city}` : city;
}

// 将当前已从后端查询到的数据导出为文件；导出动作不再仅显示成功 toast。
function downloadCsv(filename, columns, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(tr('tenant.b0a9d3'));
  }
  const esc = value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns, ...rows.map(row => columns.map(column => esc(row[column])))]
    .map(line => line.join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── 租户代理护盾：快速绑定/解绑或新建代理 ───────────────────────
// 对齐原 tenant_list.ftl 的 openTenantProxyQuick/saveTenantProxyQuick，所有数据来自 /vpnProxy/*。
function useTenantProxyQuickModal() {
  const shell = useShell();
  return React.useCallback((tenant) => {
    const tenantId = getTenantDbId(tenant);
    const state = {
      mode: 'bind', selectedId: '', proxies: [], loading: true, saving: false,
      customName: '', proxyType: 'HTTP', proxyHost: '', proxyPort: 8080,
      proxyUsername: '', proxyPassword: '', forceProxy: 0,
    };
    const unwrap = payload => payload && payload.data !== undefined ? payload.data : payload;
    const load = async () => {
      try {
        const [allRes, boundRes] = await Promise.all([
          window.ociServices.system.vpnPageList({ pageNum: 1, pageSize: 500 }),
          window.ociServices.system.vpnFindByTenant({ tenantId }),
        ]);
        const allData = unwrap(allRes) || {};
        state.proxies = Array.isArray(allData.content) ? allData.content : [];
        const bound = unwrap(boundRes);
        const fallback = state.proxies.find(p => Array.isArray(p.tenantIds) && p.tenantIds.map(String).includes(String(tenantId)));
        state.selectedId = bound?.id != null ? String(bound.id) : (fallback?.id != null ? String(fallback.id) : '');
      } catch (e) {
        state.proxies = [];
        shell.showToast(e.message || tr('tenant.be71f1'), { kind: 'error' });
      } finally {
        state.loading = false;
        render();
      }
    };
    const save = async () => {
      if (state.saving) return;
      state.saving = true;
      try {
        if (state.mode === 'bind') {
          const result = await window.ociServices.system.vpnBindTenant({ tenantId, id: state.selectedId || null });
          if (!result?.success) throw new Error(result?.message || tr('tenant.d1299e'));
        } else {
          if (!state.proxyHost.trim() || !state.proxyPort) throw new Error(tr('tenant.e31434'));
          const result = await window.ociServices.system.vpnSaveOrUpdate({
            proxyType: state.proxyType, proxyHost: state.proxyHost.trim(), proxyPort: Number(state.proxyPort),
            proxyUsername: state.proxyUsername || '', proxyPassword: state.proxyPassword || '',
            availableStatus: 1, forceProxy: Number(state.forceProxy) === 1 ? 1 : 0,
            customName: state.customName.trim(), tenantId, tenantIds: [tenantId],
          });
          if (!result?.success) throw new Error(result?.message || tr('tenant.c0249d'));
        }
        shell.closeModal();
        shell.showToast(tr('tenant.67a77a'), { kind: 'success' });
        window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
      } catch (e) {
        shell.showToast(e.message || e, { kind: 'error' });
      } finally {
        state.saving = false;
      }
    };
    const render = () => {
      const isCreate = state.mode === 'create';
      const tenantDisplayName = tenant?.name || tenant?.tenancyName || tenant?.defName || `租户 #${tenantId}`;
      shell.openModal({
        title: `快速配置代理 · ${tenantDisplayName}`,
        icon: 'shield', iconColor: 'var(--accent)',
        width: 540,
        body: (
          <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>
              选择已有代理，或直接新建并绑定到该租户（其它租户也可共用）。
            </div>

            {/* 模式切换两个等宽平分撑满的大胶囊 (100% 对齐客户端截图) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => { state.mode = 'bind'; render(); }}
                style={{
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: !isCreate ? 'var(--accent)' : 'var(--bg-2)',
                  color: !isCreate ? '#ffffff' : 'var(--fg-1)',
                  border: '1px solid ' + (!isCreate ? 'var(--accent)' : 'var(--border)'),
                  cursor: 'pointer', transition: 'all 120ms',
                }}
              >
                选择已有
              </button>
              <button
                type="button"
                onClick={() => { state.mode = 'create'; render(); }}
                style={{
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: isCreate ? 'var(--accent)' : 'var(--bg-2)',
                  color: isCreate ? '#ffffff' : 'var(--fg-1)',
                  border: '1px solid ' + (isCreate ? 'var(--accent)' : 'var(--border)'),
                  cursor: 'pointer', transition: 'all 120ms',
                }}
              >
                新建并绑定
              </button>
            </div>

            {!isCreate ? (
              state.loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                  <Icon name="loader-2" size={18} className="spin" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.6 }} />
                  加载中…
                </div>
              ) : (
                /* 中间大圆角卡片容器 (对齐客户端 panelBg + cornerRadius 10) */
                <div style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '8px',
                  minHeight: 220,
                  maxHeight: 340,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {/* 首项：不使用专属代理 (走全局池) */}
                  <div
                    onClick={() => { state.selectedId = ''; render(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      cursor: 'pointer',
                      background: !state.selectedId ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
                      transition: 'all 100ms',
                    }}
                  >
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: !state.selectedId ? 'var(--accent)' : 'transparent',
                      border: !state.selectedId ? 'none' : '1.5px solid var(--border-strong)',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>
                        不使用专属代理（走全局池）
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                        全局共享
                      </div>
                    </div>
                  </div>

                  {/* 代理项列表 */}
                  {state.proxies.map(p => {
                    const isSelected = String(p.id) === state.selectedId;
                    const meta = [
                      `${p.proxyType || 'HTTP'} · ${p.proxyHost}:${p.proxyPort}`,
                      p.forceProxy === 1 ? '强制' : '非强制',
                      p.availableStatus === 1 ? '通畅' : '不通',
                    ].join(' · ');
                    return (
                      <div
                        key={p.id}
                        onClick={() => { state.selectedId = String(p.id); render(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
                          transition: 'all 100ms',
                        }}
                      >
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          border: isSelected ? 'none' : '1.5px solid var(--border-strong)',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.customName || `代理 #${p.id}`}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                            {meta}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!state.proxies.length && (
                    <div style={{
                      padding: '24px 16px', textAlign: 'center', color: 'var(--fg-3)',
                      fontSize: 12,
                    }}>
                      暂无代理，可切换到「新建并绑定」
                    </div>
                  )}
                </div>
              )
            ) : (
              /* 新建并绑定表单 (100% 对齐客户端 proxyQuickCreateForm 双列排版) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormRow label="自定义名称">
                  <TextInput
                    value={state.customName}
                    onChange={v => { state.customName = v; render(); }}
                    placeholder="可选，仅展示"
                  />
                </FormRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormRow label="代理类型" required>
                    <CustomDropdown
                      value={state.proxyType}
                      onChange={v => { state.proxyType = v; render(); }}
                      height={32}
                      width="100%"
                    >
                      <option value="HTTP">HTTP</option>
                      <option value="HTTPS">HTTPS</option>
                      <option value="SOCKS5">SOCKS5</option>
                    </CustomDropdown>
                  </FormRow>
                  <FormRow label="强制代理">
                    <CustomDropdown
                      value={String(state.forceProxy)}
                      onChange={v => { state.forceProxy = v; render(); }}
                      height={32}
                      width="100%"
                    >
                      <option value="0">非强制</option>
                      <option value="1">强制</option>
                    </CustomDropdown>
                  </FormRow>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <FormRow label="代理地址" required>
                    <TextInput
                      mono
                      value={state.proxyHost}
                      onChange={v => { state.proxyHost = v; render(); }}
                      placeholder="127.0.0.1"
                    />
                  </FormRow>
                  <FormRow label="端口" required>
                    <NumberInput
                      value={state.proxyPort}
                      onChange={v => { state.proxyPort = v; render(); }}
                      min={1}
                      max={65535}
                    />
                  </FormRow>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormRow label="用户名">
                    <TextInput
                      mono
                      value={state.proxyUsername}
                      onChange={v => { state.proxyUsername = v; render(); }}
                      placeholder="可选"
                    />
                  </FormRow>
                  <FormRow label="密码">
                    <TextInput
                      mono
                      type="password"
                      value={state.proxyPassword}
                      onChange={v => { state.proxyPassword = v; render(); }}
                      placeholder="可选"
                    />
                  </FormRow>
                </div>

                {/* 动态盾牌释义横幅 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 6,
                  background: Number(state.forceProxy) === 1 ? 'var(--orange-soft)' : 'var(--accent-soft)',
                  border: '1px solid ' + (Number(state.forceProxy) === 1 ? 'oklch(from var(--orange) l c h / 0.25)' : 'oklch(from var(--accent) l c h / 0.25)'),
                  fontSize: 11, color: Number(state.forceProxy) === 1 ? 'var(--orange)' : 'var(--accent)',
                }}>
                  <Icon name={Number(state.forceProxy) === 1 ? 'alert-triangle' : 'shield'} size={13} style={{ flexShrink: 0 }} />
                  <span>
                    {Number(state.forceProxy) === 1
                      ? '已开启强制：代理不通时不回退，拒绝向云厂商发起请求'
                      : '非强制：代理不通时允许系统自动平滑回退直连'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ),
        footer: (
          <>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="md" onClick={shell.closeModal}>取消</Button>
            <Button
              variant="primary" size="md" icon="download"
              disabled={state.loading || state.saving || (isCreate && (!state.proxyHost.trim() || !state.proxyPort))}
              onClick={save}
            >
              {isCreate ? '新建并绑定' : '保存绑定'}
            </Button>
          </>
        ),
      });
    };
    render();
    load();
  }, [shell]);
}

// ─── 添加开机(add-boot) ─────────────────────────────────────────
// 对齐原项目 BootInstance 实体的单页表单:
//   tenantId · architecture · ocpu · memory · disk · instanceCount ·
//   loopTime · operatingSystem · operatingSystemVersion · imageId ·
//   rootPassword · remark
// 现代化优化(保留):
//   - 密码强度实时提示
//   - ARM 架构 1:6 内存比例警告
//   - 免费额度上限即时提示
function useAddBootModal() {
  const shell = useShell();
  const { lang } = useT();

  return React.useCallback((preselectedTenant) => {
    const state = {
      mode: 'quick',           // 'quick' | 'custom' — 对齐原项目模式划分
      quickPreset: 'arm-max',  // 快速模式的预设方案
      customTemplate: 'arm-high', // 自定义模式的配置模板
      tenantId: preselectedTenant ? getTenantDbId(preselectedTenant) : '',
      tenantOptions: [],       // 真实租户列表(未预选时供下拉选择),不再用 mock TENANTS
      tenantLoading: false,
      architecture: 'ARM',    // ARM | AMD (由 template 联动)
      ocpu: 4,
      memory: 24,
      disk: 50,
      instanceCount: 1,
      loopTime: 60,            // 循环时间(秒),默认 60s
      timeRange: '',           // 时间范围: "1-8" 格式,留空=不限制
      operatingSystem: 'Ubuntu',
      operatingSystemVersion: '22.04',
      imageId: '',             // 可选,自定义镜像 OCID
      rootPassword: '',
      remark: preselectedTenant ? `${getTenantName(preselectedTenant)}-arm-high` : '',
      saving: false,
    };

    // 当前弹窗生效的租户行:预选时直接用传入的真实行;否则从真实租户列表里按 tenantId 查。
    // 这样「创建实例」从租户列表点开时锁定真实租户,不再错误地落到 mock TENANTS。
    const effTenant = () => (preselectedTenant || state.tenantOptions.find(t => getTenantDbId(t) === state.tenantId) || null);
    const regionLabel = (t) => (t && (t.regionName || getTenantRegion(t))) || '';

    // 未预选租户时,打开弹窗从后端拉取真实租户列表供下拉选择。
    const loadTenantOptions = async () => {
      if (preselectedTenant) return;
      state.tenantLoading = true;
      try {
        const p = await window.ociApi.getPage('/tenants/list/json', { page: 0, size: 500, cloudType: 1 });
        state.tenantOptions = (p.content || []).map(t => window.ociTenantRow.normalize(t, REGIONS));
      } catch (_) {
        state.tenantOptions = [];
      } finally {
        state.tenantLoading = false;
        render();
      }
    };

    // ─── 自定义模式的配置模板(对齐原项目的 8 个模板) ────────────
    const CUSTOM_TEMPLATES_ARM = [
      { id: 'arm-basic',    label: tr('tenant.33a6c2'),    ocpu: 1, memory: 6,  disk: 50,  maxCount: 100, badge: 'ARM',        badgeColor: 'var(--accent)', paid: false },
      { id: 'arm-standard', label: tr('tenant.dfaa07'),    ocpu: 2, memory: 12, disk: 50,  maxCount: 100, badge: 'ARM',        badgeColor: 'var(--accent)', paid: false },
      { id: 'arm-high',     label: tr('tenant.4b4249'),  ocpu: 4, memory: 24, disk: 50,  maxCount: 100, badge: 'ARM',        badgeColor: 'var(--accent)', paid: false },
      { id: 'arm-a2',       label: tr('tenant.f27638'),  ocpu: 4, memory: 24, disk: 200, maxCount: 100, badge: 'ARM',        badgeColor: 'var(--accent)', paid: true  },
    ];
    const CUSTOM_TEMPLATES_AMD = [
      { id: 'amd-basic',    label: tr('tenant.ee2527'), ocpu: 1, memory: 1,  disk: 50, maxCount: 100, badge: 'AMD',        badgeColor: 'var(--info)',   paid: false },
      { id: 'amd-e3',       label: tr('tenant.4c0f3f'),   ocpu: 4, memory: 24, disk: 50, maxCount: 100, badge: 'AMD_PAID_E3', badgeColor: 'var(--info)',   paid: true  },
      { id: 'amd-e4',       label: tr('tenant.446bb3'),   ocpu: 4, memory: 24, disk: 50, maxCount: 100, badge: 'AMD_PAID_E4', badgeColor: 'var(--info)',   paid: true  },
      { id: 'amd-e5',       label: tr('tenant.af0dd3'),   ocpu: 4, memory: 24, disk: 50, maxCount: 100, badge: 'AMD_PAID_E5', badgeColor: 'var(--info)',   paid: true  },
    ];

    const applyTemplate = (tpl) => {
      state.customTemplate = tpl.id;
      state.architecture = tpl.id.startsWith('arm') ? 'ARM' : 'AMD';
      state.ocpu = tpl.ocpu;
      state.memory = tpl.memory;
      state.disk = tpl.disk;
      const t = effTenant();
      if (t) state.remark = `${getTenantName(t)}-${tpl.id}`;
      render();
    };

    // 循环时间快选值(秒)
    const LOOP_TIME_PRESETS = [10, 30, 60, 200, 500];

    // 租户字段 —— 从租户菜单点开时锁定当前租户,否则显示下拉选择器
    const renderTenantField = () => {
      const t = effTenant();
      if (preselectedTenant && t) {
        // 锁定态:只读卡片
        return (
          <FormRow label={tr('tenant.4787d6')} required>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name="user" size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mono" style={{
                    fontSize: 11, padding: '1px 5px',
                    background: 'var(--bg-3)', borderRadius: 3, color: 'var(--fg-1)',
                  }}>{t._ui?.name ?? getTenantName(t) ?? ''}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 500 }}>{getTenantName(t)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>
                  {tr('tenant.1da678')} <span className="mono">{regionLabel(t)}</span> {tr('tenant.5f646a')} {getTenantDays(t)} {tr('tenant.249aba')}
                </div>
              </div>
              <span style={{
                fontSize: 10, color: 'var(--fg-3)',
                padding: '2px 6px',
                background: 'var(--bg-3)',
                borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <Icon name="lock" size={10} />
                {tr('tenant.e81c64')}
              </span>
            </div>
          </FormRow>
        );
      }
      // 未锁定态:下拉选择器
      return (
        <FormRow label={tr('tenant.7b1c25')} required hint={state.tenantLoading ? tr('tenant.06ab0e') : tr('tenant.c989c4').replace('{0}',state.tenantOptions.filter(t => getTenantActive(t) !== false).length)}>
          <CustomDropdown
            value={state.tenantId}
            onChange={e => {
              const tid = e;
              const picked = state.tenantOptions.find(t => getTenantDbId(t) === tid);
              state.tenantId = tid;
              if (picked) {
                const suffix = state.mode === 'quick'
                  ? (QUICK_PRESETS.find(p => p.id === state.quickPreset)?.id || 'arm-max')
                  : state.customTemplate;
                const nm = window.getTenantAlias(picked) || getTenantName(picked);
                state.remark = `${nm}-${suffix}`;
              }
              render();
            }} height={32} width="100%">
            <option value="" disabled>{tr('tenant.6c7d53')}</option>
            {state.tenantOptions.filter(t => getTenantActive(t) !== false).map(t => (
              <option key={getTenantDbId(t)} value={getTenantDbId(t)}>
                {getTenantLabel(t, lang)}
              </option>
            ))}
          </CustomDropdown>
        </FormRow>
      );
    };

    // 快速开机预设 —— 一键覆盖所有实例参数
    const QUICK_PRESETS = [
      {
        id: 'arm-max',
        label: tr('tenant.818439'), tag: tr('tenant.3f9810'),
        desc: tr('tenant.049b34'),
        color: 'var(--accent)',
        icon: 'zap',
        spec: '4C 24G · 200GB',
        params: { architecture: 'ARM', ocpu: 4, memory: 24, disk: 200 },
      },
      {
        id: 'arm-half',
        label: tr('tenant.3932a5'), tag: '',
        desc: tr('tenant.a561dd'),
        color: 'var(--info)',
        icon: 'cpu',
        spec: '2C 12G · 100GB',
        params: { architecture: 'ARM', ocpu: 2, memory: 12, disk: 100 },
      },
      {
        id: 'arm-quarter',
        label: tr('tenant.939948'), tag: '',
        desc: tr('tenant.ff1944'),
        color: 'var(--cyan)',
        icon: 'circle',
        spec: '1C 6G · 50GB',
        params: { architecture: 'ARM', ocpu: 1, memory: 6, disk: 50 },
      },
      {
        id: 'amd-micro',
        label: tr('tenant.e3dd6a'), tag: '',
        desc: tr('tenant.10e9f7'),
        color: 'var(--orange)',
        icon: 'server',
        spec: '1C 1G · 47GB',
        params: { architecture: 'AMD', ocpu: 1, memory: 1, disk: 47 },
      },
    ];

    const applyPreset = (preset) => {
      state.quickPreset = preset.id;
      Object.assign(state, preset.params);
      const t = effTenant();
      if (t) {
        state.remark = `${getTenantName(t)}-${preset.id}`;
      }
      render();
    };

    // Preset image list per OS
    const OS_VERSIONS = {
      'Ubuntu':        ['22.04', '24.04', '20.04'],
      'Oracle Linux':  ['9', '8'],
      'Debian':        ['12', '11'],
      'CentOS Stream': ['9', '8'],
      'Rocky Linux':   ['9', '8'],
      'AlmaLinux':     ['9', '8'],
    };

    // Password strength scorer (0-4)
    const passwordScore = (pw) => {
      if (!pw) return 0;
      let s = 0;
      if (pw.length >= 8) s++;
      if (pw.length >= 12) s++;
      if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
      if (/[0-9]/.test(pw)) s++;
      if (/[^A-Za-z0-9]/.test(pw)) s++;
      return Math.min(4, s);
    };

    const genPassword = () => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      let pw = '';
      for (let i = 0; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
      state.rootPassword = pw;
      render();
    };

    const update = (patch) => { Object.assign(state, patch); render(); };

    const render = () => {
      const t = effTenant();
      const isArm = state.architecture === 'ARM';
      const armExceedsFree = isArm && (state.ocpu > 4 || state.memory > 24 || state.disk > 200);
      const armRatioOk = state.memory / state.ocpu === 6;
      const pwScore = passwordScore(state.rootPassword);
      const pwLabels = [tr('tenant.4fd2fe'), tr('tenant.549077'), tr('tenant.2ab01e'), tr('tenant.7d0096'), tr('tenant.aecf02')];
      const pwColors = ['var(--danger)', 'var(--danger)', 'var(--orange)', 'var(--accent)', 'var(--accent)'];
      const missingRequired = !state.tenantId || !state.rootPassword || state.rootPassword.length < 8;

      shell.openModal({
        title: tr('tenant.c8f5a1'),
        subtitle: state.mode === 'quick' ? tr('tenant.be9c3e') : tr('tenant.cf0e21'),
        icon: 'zap',
        iconColor: 'var(--orange)',
        size: 'lg',
        body: (
          <div>
            {/* ─── Mode Tabs ─────────────────── */}
            <div style={{
              display: 'flex',
              padding: '0 22px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-1)',
            }}>
              {[
                { id: 'quick',  label: tr('tenant.bbca5f'), icon: 'zap',      hint: tr('tenant.e5cd68') },
                { id: 'custom', label: tr('tenant.ce2834'), icon: 'sliders', hint: tr('tenant.4c979f') },
              ].map(tab => {
                const active = state.mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { state.mode = tab.id; render(); }}
                    style={{
                      padding: '12px 18px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${active ? 'var(--orange)' : 'transparent'}`,
                      color: active ? 'var(--fg-0)' : 'var(--fg-2)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      marginBottom: -1,
                      transition: 'all 120ms',
                    }}
                  >
                    <Icon name={tab.icon} size={13} />
                    {tab.label}
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>
                      · {tab.hint}
                    </span>
                  </button>
                );
              })}
            </div>

          {state.mode === 'quick' ? (
            /* ═══════════════ 快速开机模式 ═══════════════ */
            <div style={{ padding: 22 }}>
              {/* 租户 (预选锁定 / 下拉选择) */}
              {renderTenantField()}

              {/* 预设方案卡片 */}
              <FormRow label={tr('tenant.05b8ce')} required hint={tr('tenant.74e53d')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {QUICK_PRESETS.map(p => {
                    const active = state.quickPreset === p.id;
                    return (
                      <label
                        key={p.id}
                        style={{
                          padding: 14, cursor: 'pointer',
                          background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
                          border: `1.5px solid ${active ? p.color : 'var(--border)'}`,
                          borderRadius: 8,
                          position: 'relative',
                        }}
                      >
                        <input
                          type="radio" checked={active}
                          onChange={() => applyPreset(p)}
                          style={{ display: 'none' }}
                        />
                        {p.tag && (
                          <span style={{
                            position: 'absolute', top: 8, right: 8,
                            padding: '1px 6px',
                            background: p.color, color: 'var(--accent-fg)',
                            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                            borderRadius: 3, textTransform: 'uppercase',
                          }}>{p.tag}</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: active ? p.color : 'var(--bg-3)',
                            color: active ? 'var(--accent-fg)' : 'var(--fg-2)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon name={p.icon} size={14} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? p.color : 'var(--fg-0)' }}>
                            {p.label}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 6 }}>{p.desc}</div>
                        <div className="mono" style={{
                          fontSize: 11.5, fontWeight: 600,
                          color: active ? p.color : 'var(--fg-1)',
                          padding: '3px 8px',
                          background: active ? 'var(--bg-1)' : 'var(--bg-3)',
                          borderRadius: 3, display: 'inline-block',
                        }}>{p.spec}</div>
                      </label>
                    );
                  })}
                </div>
              </FormRow>

              {/* root 密码 */}
              <FormRow
                label={tr('tenant.95d214')}
                required
                hint={tr('tenant.a78ead')}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  <TextInput
                    mono
                    value={state.rootPassword}
                    onChange={v => update({ rootPassword: v })}
                    placeholder={tr('tenant.ea259e')}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" variant="outline" icon="refresh-cw" onClick={genPassword}>{tr('tenant.6709f4')}</Button>
                </div>
                {state.rootPassword && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: i < pwScore ? pwColors[pwScore] : 'var(--bg-3)',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10.5, color: pwColors[pwScore], fontWeight: 600, minWidth: 32 }}>
                      {pwLabels[pwScore]}
                    </span>
                  </div>
                )}
              </FormRow>

              {/* 备注(可选) */}
              <FormRow label={tr('tenant.a0b316')} hint={tr('tenant.373c72')}>
                <TextInput
                  value={state.remark}
                  onChange={v => update({ remark: v })}
                  placeholder={tr('tenant.9c6f41')}
                  mono
                />
              </FormRow>

              {/* 快速模式说明 */}
              <div style={{
                padding: 12,
                background: 'var(--info-soft)',
                border: '1px solid var(--info)',
                borderRadius: 6,
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontSize: 11.5, color: 'var(--fg-1)',
              }}>
                <Icon name="info" size={14} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ marginBottom: 4 }}>
                    {tr('tenant.d2c375')}<b>{tr('tenant.4a3d77')}</b>:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, fontSize: 10.5, color: 'var(--fg-2)' }}>
                    <span>{tr('tenant.64bc0d')} <span className="mono" style={{ color: 'var(--fg-1)' }}>Ubuntu 22.04 LTS</span></span>
                    <span>{tr('tenant.e514d3')} <span className="mono" style={{ color: 'var(--fg-1)' }}>{tr('tenant.a153b1')}</span></span>
                    <span>{tr('tenant.96207a')} <span className="mono" style={{ color: 'var(--fg-1)' }}>{tr('tenant.e6dba4')}</span></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ═══════════════ 自定义配置模式 ═══════════════ */
          <div style={{ padding: 22 }}>
            {/* 租户 (预选锁定 / 下拉选择) */}
            {renderTenantField()}

            {/* ═══════ 配置模板 (对齐原项目 8 个模板卡片) ═══════ */}
            <div style={{
              padding: 14,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 12,
                fontSize: 13, fontWeight: 600, color: 'var(--fg-0)',
              }}>
                <Icon name="layers" size={14} style={{ color: 'var(--accent)' }} />
                <span>{tr('tenant.ceb8a6')}</span>
              </div>

              {/* ARM 架构分组 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 8,
                fontSize: 11.5, color: 'var(--accent)', fontWeight: 500,
              }}>
                <Icon name="cpu" size={11} />
                <span>{tr('tenant.637b1e')}</span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                marginBottom: 14,
              }}>
                {CUSTOM_TEMPLATES_ARM.map(tpl => {
                  const active = state.customTemplate === tpl.id;
                  return (
                    <label
                      key={tpl.id}
                      style={{
                        padding: 10, cursor: 'pointer',
                        background: active ? 'var(--accent-soft)' : 'var(--bg-1)',
                        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 6,
                        display: 'block',
                      }}
                    >
                      <input
                        type="radio" checked={active}
                        onChange={() => applyTemplate(tpl)}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: active ? 'var(--accent)' : 'var(--fg-0)',
                        marginBottom: 6,
                      }}>
                        {tpl.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 6 }}>
                        <div className="mono">· {tpl.ocpu} OCPU | {tpl.memory} GB MEM | {tpl.disk} GB DISK</div>
                        <div>{tr('tenant.ec7b46')} {tpl.maxCount}</div>
                      </div>
                      <span className="mono" style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        background: active ? 'var(--accent)' : 'oklch(0.30 0.10 155)',
                        color: 'var(--accent-fg)',
                        fontSize: 9, fontWeight: 700,
                        borderRadius: 3,
                      }}>{tpl.badge}</span>
                    </label>
                  );
                })}
              </div>

              {/* AMD 架构分组 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 8,
                fontSize: 11.5, color: 'var(--info)', fontWeight: 500,
              }}>
                <Icon name="cpu" size={11} />
                <span>{tr('tenant.4984ef')}</span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              }}>
                {CUSTOM_TEMPLATES_AMD.map(tpl => {
                  const active = state.customTemplate === tpl.id;
                  return (
                    <label
                      key={tpl.id}
                      style={{
                        padding: 10, cursor: 'pointer',
                        background: active ? 'oklch(0.20 0.05 240 / 0.4)' : 'var(--bg-1)',
                        border: `1.5px solid ${active ? 'var(--info)' : 'var(--border)'}`,
                        borderRadius: 6,
                        display: 'block',
                      }}
                    >
                      <input
                        type="radio" checked={active}
                        onChange={() => applyTemplate(tpl)}
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: active ? 'var(--info)' : 'var(--fg-0)',
                        marginBottom: 6,
                      }}>
                        {tpl.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 6 }}>
                        <div className="mono">· {tpl.ocpu} OCPU | {tpl.memory} GB MEM | {tpl.disk} GB DISK</div>
                        <div>{tr('tenant.ec7b46')} {tpl.maxCount}</div>
                      </div>
                      <span className="mono" style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        background: active ? 'var(--info)' : 'oklch(0.30 0.06 240)',
                        color: 'var(--info-fg, #fff)',
                        fontSize: 9, fontWeight: 700,
                        borderRadius: 3,
                      }}>{tpl.badge}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ═══════ 部署配置 ═══════ */}
            <div style={{
              padding: 14,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 12,
                fontSize: 13, fontWeight: 600, color: 'var(--fg-0)',
              }}>
                <Icon name="settings" size={14} style={{ color: 'var(--info)' }} />
                <span>{tr('tenant.48ce84')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
                {/* 实例数量 */}
                <FormRow label={tr('tenant.f525db')} required hint={tr('tenant.22d303')}>
                  <NumberInput
                    value={state.instanceCount}
                    onChange={v => update({ instanceCount: v })}
                    min={1} max={100}
                  />
                </FormRow>

                {/* 循环时间快选 */}
                <FormRow label={tr('tenant.ffe0ac')}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {LOOP_TIME_PRESETS.map(s => {
                      const active = state.loopTime === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => update({ loopTime: s })}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 999,
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent)' : 'var(--bg-1)',
                            color: active ? 'var(--accent-fg)' : 'var(--fg-1)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11.5,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >{s}s</button>
                      );
                    })}
                    {/* 自定义间隔输入框 */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 4px 2px 10px',
                      borderRadius: 999,
                      border: `1px solid ${LOOP_TIME_PRESETS.includes(state.loopTime) ? 'var(--border)' : 'var(--accent)'}`,
                      background: LOOP_TIME_PRESETS.includes(state.loopTime) ? 'var(--bg-1)' : 'var(--accent-soft)',
                    }}>
                      <span style={{
                        fontSize: 11, color: 'var(--fg-3)',
                        whiteSpace: 'nowrap',
                      }}>{tr('tenant.f1d4ff')}</span>
                      <input
                        type="number"
                        value={LOOP_TIME_PRESETS.includes(state.loopTime) ? '' : state.loopTime}
                        onChange={e => {
                          const n = +e.target.value;
                          if (!isNaN(n) && n > 0) update({ loopTime: n });
                          else if (e.target.value === '') update({ loopTime: 60 });
                        }}
                        placeholder={tr('tenant.0c1fec')}
                        min={1}
                        style={{
                          width: 60,
                          padding: '3px 4px',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--fg-0)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11.5,
                          textAlign: 'center',
                        }}
                      />
                      <span style={{
                        fontSize: 10, color: 'var(--fg-3)',
                        paddingRight: 8,
                      }}>{tr('tenant.0c1fec')}</span>
                    </div>
                  </div>
                </FormRow>
              </div>

              {/* 时间范围(可选) —— 用户红框标出的重点 */}
              <FormRow
                label={tr('tenant.f521d4')}
                hint={<>{tr('tenant.57ca55')}<span className="mono" style={{ color: 'var(--fg-1)' }}>1-8</span>{tr('tenant.407664')}</>}
              >
                <TextInput
                  mono
                  value={state.timeRange}
                  onChange={v => update({ timeRange: v })}
                  placeholder={tr('tenant.a077b0')}
                />
              </FormRow>

              {/* 付费提示 */}
              {armExceedsFree && (
                <div style={{
                  padding: '8px 10px',
                  background: 'var(--danger-soft)', border: '1px solid var(--danger)',
                  borderRadius: 5, fontSize: 11, color: 'var(--fg-1)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 8,
                }}>
                  <Icon name="alert-circle" size={12} style={{ color: 'var(--danger)' }} />
                  <span>{tr('tenant.b83ccb')}<b>{tr('tenant.4f3c64')}</b></span>
                </div>
              )}
            </div>

            {/* ─── 操作系统 ─────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormRow label={tr('tenant.30d23e')} required>
                <CustomDropdown
                  value={state.operatingSystem}
                  onChange={e => {
                    const os = e;
                    update({ operatingSystem: os, operatingSystemVersion: OS_VERSIONS[os][0] });
                  }} height={32} width="100%">
                  {Object.keys(OS_VERSIONS).map(os => <option key={os} value={os}>{os}</option>)}
                </CustomDropdown>
              </FormRow>
              <FormRow label={tr('tenant.fe2df0')} required>
                <CustomDropdown
                  value={state.operatingSystemVersion}
                  onChange={e => update({ operatingSystemVersion: e })} height={32} width="100%">
                  {OS_VERSIONS[state.operatingSystem].map(v => <option key={v} value={v}>{v}</option>)}
                </CustomDropdown>
              </FormRow>
            </div>

            {/* ─── 镜像 ID (可选) ────────────── */}
            <FormRow label={tr('tenant.5d6873')} hint={tr('tenant.c2d6b2')}>
              <TextInput
                mono
                value={state.imageId}
                onChange={v => update({ imageId: v })}
                placeholder="ocid1.image.oc1.ap-tokyo-1.aaaaaaaa..."
              />
            </FormRow>

            {/* ─── root 密码 ────────────────── */}
            <FormRow
              label={tr('tenant.95d214')}
              required
              hint={tr('tenant.cc1b09')}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <TextInput
                  mono
                  value={state.rootPassword}
                  onChange={v => update({ rootPassword: v })}
                  placeholder={tr('tenant.ea259e')}
                  style={{ flex: 1 }}
                />
                <Button size="sm" variant="outline" icon="refresh-cw" onClick={genPassword}>{tr('tenant.6709f4')}</Button>
              </div>
              {state.rootPassword && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i < pwScore ? pwColors[pwScore] : 'var(--bg-3)',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 10.5, color: pwColors[pwScore], fontWeight: 600, minWidth: 32 }}>
                    {pwLabels[pwScore]}
                  </span>
                </div>
              )}
            </FormRow>

            {/* ─── 备注 ─────────────────────── */}
            <FormRow label={tr('tenant.a0b316')} hint={tr('tenant.fc4f1f')}>
              <TextInput
                value={state.remark}
                onChange={v => update({ remark: v })}
                placeholder={tr('tenant.c95a71')}
                mono
              />
            </FormRow>

            {/* ─── 提示信息 ─────────────────── */}
            <div style={{
              padding: 10,
              background: 'var(--info-soft)',
              border: '1px solid var(--info)',
              borderRadius: 6,
              display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 11.5, color: 'var(--fg-1)',
            }}>
              <Icon name="info" size={13} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
              <div>
                {tr('tenant.9a32ab')} <b>{getTenantName(t) || tr('tenant.1fc33f')}</b> {tr('tenant.22b59c')} <b className="mono">{regionLabel(t) || tr('tenant.1fc33f')}</b> {tr('tenant.2b6005')}
                <b> {state.ocpu}C{state.memory}G · {state.disk}GB · {state.operatingSystem} {state.operatingSystemVersion}</b>{tr('tenant.65f683')} <b>{state.loopTime}s</b> {tr('tenant.d1104c')}{state.timeRange && <>{tr('tenant.4ebf53')} <b className="mono">{state.timeRange}</b> {tr('tenant.6de97e')}</>}{tr('tenant.09aaa6')} <b>{state.instanceCount}</b> {tr('tenant.05a24e')}
              </div>
            </div>
          </div>
          )}
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
            <Button
              variant="orange" size="md" icon="zap"
              loading={state.saving}
              disabled={missingRequired || state.saving}
              onClick={async () => {
                state.saving = true;
                render();
                try {
                  const j = await window.ociServices.tenant.bootSave({
                    tenantId: state.tenantId,
                    architecture: state.architecture,
                    ocpu: state.ocpu,
                    memory: state.memory,
                    disk: state.disk,
                    instanceCount: state.instanceCount,
                    loopTime: state.loopTime,
                    operatingSystem: state.operatingSystem,
                    operatingSystemVersion: state.operatingSystemVersion,
                    imageId: state.imageId || '',
                    rootPassword: state.rootPassword,
                    remark: state.remark,
                    cloudType: 1,
                  });
                  if (!j || j.success !== true) throw new Error((j && j.message) || tr('tenant.a88928'));
                  shell.closeModal();
                  shell.showToast(tr('tenant.6120fe').replace('{0}',state.remark || tr('tenant.unnamed')).replace('{1}',getTenantName(t) || '?').replace('{2}',state.instanceCount).replace('{3}',state.loopTime), { kind: 'success' });
                  window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
                } catch (e) {
                  state.saving = false;
                  render();
                  shell.showToast(tr('tenant.5b6e01').replace('{0}',e.message || e), { kind: 'error' });
                }
              }}
            >{tr('tenant.d8931c')}</Button>
          </>
        ),
      });
    };
    render();
    loadTenantOptions();
  }, [shell, lang]);
}

// ─── Simpler modals for the other tenant actions ────────────────

function useApiImportModal() {
  const shell = useShell();
  return React.useCallback(() => {
    const state = {
      tenancy: '', user: '', fingerprint: '', region: '',
      privateKey: '', alias: '',
      pasteBuffer: '',
      lastParsed: null, // { count, fields }
      keyFileName: '', // when user uploads .pem file
      keyMode: 'upload', // 'upload' | 'paste' — how to input private key
    };

    // 重置除 pasteBuffer 外的全部表单字段
    const resetForm = () => {
      state.tenancy = '';
      state.user = '';
      state.fingerprint = '';
      state.region = '';
      state.privateKey = '';
      state.alias = '';
      state.lastParsed = null;
      state.keyFileName = '';
      state.keyMode = 'upload';
    };

    // Parse OCI config text and merge into state
    const parseAndFill = (silent = false) => {
      const text = state.pasteBuffer;
      if (!text || !text.trim()) {
        resetForm();
        if (!silent) shell.showToast(tr('tenant.8045df'), { kind: 'warn' });
        render();
        return;
      }

      const filled = {};

      // 逐行解析 key=value 或 key: value，彻底免疫 \r\n、等号/冒号、引号差异
      const map = {};
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const s = line.trim();
        if (!s || s.startsWith('#') || s.startsWith(';')) continue;
        const sepIdx = s.indexOf('=') !== -1 ? s.indexOf('=') : s.indexOf(':');
        if (sepIdx !== -1) {
          const k = s.slice(0, sepIdx).trim().toLowerCase().replace(/[\s_-]/g, '');
          let v = s.slice(sepIdx + 1).trim();
          v = v.replace(/^["']|["']$/g, '');
          if (k && v) map[k] = v;
        }
      }

      const user = map.user || map.username || map.userocid || map.apiuser;
      const fingerprint = map.fingerprint || map.apifingerprint;
      const tenancy = map.tenancy || map.tenancyocid || map.rootcompartment;
      const region = map.region || map.homeregion;

      // Profile 别名提取 (如 [DEFAULT] 或 [sanjose-free])
      const profileMatch = text.match(/\[([^\]]+)\]/);
      const profileName = profileMatch ? profileMatch[1].trim() : null;

      // OCID 正则智能兜底识别
      let finalUser = user;
      let finalTenancy = tenancy;
      const ocidMatches = text.match(/ocid1\.[a-z0-9]+\.oc1\.[^\s"',}]+/gi) || [];
      for (const ocid of ocidMatches) {
        if (ocid.includes('.user.') && !finalUser) finalUser = ocid;
        if (ocid.includes('.tenancy.') && !finalTenancy) finalTenancy = ocid;
      }

      // 指纹正则智能兜底识别
      let finalFp = fingerprint;
      if (!finalFp) {
        const fpMatch = text.match(/([0-9a-fA-F]{2}:){15}[0-9a-fA-F]{2}/);
        if (fpMatch) finalFp = fpMatch[0];
      }

      if (finalUser) { state.user = finalUser; filled.user = finalUser; }
      if (finalFp) { state.fingerprint = finalFp; filled.fingerprint = finalFp; }
      if (finalTenancy) { state.tenancy = finalTenancy; filled.tenancy = finalTenancy; }

      // 区域匹配
      let regionMatched = null;
      if (region) {
        const known = REGIONS.find(r => r.code === region || r.code.toLowerCase() === region.toLowerCase());
        if (known) {
          state.region = known.code;
          filled.region = known.code;
          regionMatched = true;
        } else {
          regionMatched = false;
        }
      }

      // PEM 私钥块提取
      const pemMatch = text.match(/-----BEGIN[^-]+-----[\s\S]+?-----END[^-]+-----/);
      if (pemMatch) {
        state.privateKey = pemMatch[0].trim();
        state.keyMode = 'paste';
        state.keyFileName = '';
        filled.privateKey = 'PEM block';
      }

      // 自动生成别名
      if (profileName && !['DEFAULT', 'default'].includes(profileName)) {
        state.alias = profileName;
        filled.alias = profileName;
      } else if (finalTenancy && !state.alias) {
        state.alias = `oci-${finalTenancy.slice(-6)}`;
        filled.alias = state.alias;
      }

      const count = Object.keys(filled).length;
      state.lastParsed = { count, fields: Object.keys(filled) };

      // Report result
      if (count === 0) {
        if (!silent) shell.showToast(tr('tenant.c34aa7'), { kind: 'error' });
      } else if (regionMatched === false) {
        shell.showToast(tr('tenant.572a5f').replace('{0}',region), { kind: 'warn', duration: 5000 });
        shell.showToast(tr('tenant.04c377').replace('{0}',count), { kind: 'success' });
      } else {
        if (!silent) shell.showToast(tr('tenant.aee103').replace('{0}',count).replace('{1}',Object.keys(filled).join(', ')), { kind: 'success' });
      }
      render();
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.bcfef1'),
        subtitle: tr('tenant.86816b'),
        icon: 'zap',
        iconColor: 'var(--accent)',
        size: 'lg',
        body: (
          <div style={{ padding: 22 }}>
            {/* ─── API 配置快速导入 ─────────────────────────────── */}
            <div style={{
              padding: 14,
              background: 'linear-gradient(135deg, var(--accent-soft), color-mix(in oklab, var(--accent-soft) 40%, transparent))',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              marginBottom: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: 'var(--accent)', color: 'var(--accent-fg)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="zap" size={13} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('tenant.4ff539')}</span>
                  {state.lastParsed && state.lastParsed.count > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 3,
                      background: 'var(--accent)', color: 'var(--accent-fg)',
                      fontSize: 10, fontWeight: 700,
                    }}>{tr('tenant.58196b')} {state.lastParsed.count} {tr('tenant.29645b')}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    size="xs"
                    variant="outline"
                    icon="clipboard"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        state.pasteBuffer = text;
                        parseAndFill(false);
                      } catch {
                        shell.showToast(tr('tenant.14f8c4'), { kind: 'warn' });
                      }
                    }}
                  >{tr('tenant.251c62')}</Button>
                  <Button
                    size="xs"
                    variant="primary"
                    icon="wand-2"
                    onClick={() => parseAndFill(false)}
                    disabled={!state.pasteBuffer.trim()}
                  >{tr('tenant.e25aef')}</Button>
                </div>
              </div>

              <TextArea
                mono
                rows={6}
                value={state.pasteBuffer}
                onChange={v => {
                  state.pasteBuffer = v;
                  if (!v || !v.trim()) {
                    // 当清空配置输入框时，整个弹窗表单彻底重置
                    resetForm();
                    render();
                  } else {
                    parseAndFill(true);
                  }
                }}
                placeholder={tr('tenant.96e1cb')}
                style={{
                  background: 'oklch(0.10 0.008 240 / 0.4)',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              />

              <div style={{
                marginTop: 8,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 10.5, color: 'var(--fg-2)',
              }}>
                <Icon name="info" size={11} style={{ color: 'var(--fg-3)' }} />
                <span>{tr('tenant.1294c1')}<span className="mono" style={{ color: 'var(--fg-1)' }}>{tr('tenant.61875b')}</span> {tr('tenant.8f7b9f')}</span>
              </div>
            </div>

            {/* ─── 表单字段(会被自动填充) ───────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormRow label={tr('tenant.664795')} required>
                <TextInput value={state.alias} onChange={v => { state.alias = v; render(); }} placeholder={tr('tenant.bd1448')} />
              </FormRow>
              <FormRow label="Region" required>
                <CustomDropdown
                  key={`region-${state.region}`}
                  value={state.region}
                  onChange={e => { state.region = e; render(); }} height={32} width="100%">
                  <option value="" disabled>{tr('tenant.f26489')}</option>
                  {REGIONS.map(r => (
                    <option key={r.code} value={r.code}>
                      {r.flag} {formatRegionLabel(r)}
                    </option>
                  ))}
                </CustomDropdown>
              </FormRow>
            </div>
            <FormRow label="Tenancy OCID" required>
              <TextInput mono value={state.tenancy} onChange={v => { state.tenancy = v; render(); }} placeholder="ocid1.tenancy.oc1..aaaaaaaa..." />
            </FormRow>
            <FormRow label="User OCID" required>
              <TextInput mono value={state.user} onChange={v => { state.user = v; render(); }} placeholder="ocid1.user.oc1..aaaaaaaa..." />
            </FormRow>
            <FormRow label="Fingerprint" required>
              <TextInput mono value={state.fingerprint} onChange={v => { state.fingerprint = v; render(); }} placeholder="a1:b2:c3:d4:e5:f6:g7:h8:i9:j0:k1:l2:m3:n4:o5:p6" />
            </FormRow>
            <FormRow
              label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <span>Private Key (PEM) <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <span style={{ flex: 1 }} />
                  {/* Segmented toggle: upload .pem file OR paste PEM text */}
                  <span style={{
                    display: 'inline-flex', background: 'var(--bg-2)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: 2, gap: 2,
                  }}>
                    {[
                      { id: 'upload', label: tr('tenant.95406a'), icon: 'upload' },
                      { id: 'paste', label: tr('tenant.28db28'), icon: 'clipboard' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { state.keyMode = opt.id; render(); }}
                        style={{
                          padding: '3px 10px',
                          background: state.keyMode === opt.id ? 'var(--bg-3)' : 'transparent',
                          border: 'none', borderRadius: 3,
                          color: state.keyMode === opt.id ? 'var(--fg-0)' : 'var(--fg-2)',
                          fontFamily: 'inherit',
                          fontSize: 11, fontWeight: state.keyMode === opt.id ? 600 : 400,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Icon name={opt.icon} size={11} />
                        {opt.label}
                      </button>
                    ))}
                  </span>
                </span>
              }
              hint={state.keyMode === 'upload' ? tr('tenant.08d306') : tr('tenant.533c9e')}
            >
              {state.keyMode === 'upload' ? (
                <label
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    padding: state.keyFileName ? '14px 18px' : '20px 18px',
                    background: state.keyFileName ? 'var(--accent-soft)' : 'var(--bg-2)',
                    border: `1.5px dashed ${state.keyFileName ? 'var(--accent)' : 'var(--border-strong)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 100ms',
                  }}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (!f) return;
                    // Read file content (mock)
                    const reader = new FileReader();
                    reader.onload = () => {
                      state.privateKey = String(reader.result || '');
                      state.keyFileName = f.name;
                      render();
                      shell.showToast(tr('tenant.8254e6').replace('{0}',f.name).replace('{1}',(f.size / 1024).toFixed(1)), { kind: 'success' });
                    };
                    reader.readAsText(f);
                  }}
                >
                  {state.keyFileName ? (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px',
                        background: 'var(--bg-1)', border: '1px solid var(--accent)',
                        borderRadius: 5,
                      }}>
                        <Icon name="file-key" size={16} style={{ color: 'var(--accent)' }} />
                        <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600 }}>{state.keyFileName}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('tenant.bec33d')}</span>
                        <button
                          type="button"
                          onClick={e => {
                            e.preventDefault(); e.stopPropagation();
                            state.privateKey = ''; state.keyFileName = ''; render();
                          }}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--fg-3)',
                            cursor: 'pointer', padding: 2, display: 'inline-flex',
                          }}
                          title={tr('tenant.86048b')}
                        ><Icon name="x" size={12} /></button>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{tr('tenant.8c91b9')}</div>
                    </>
                  ) : (
                    <>
                      <Icon name="upload-cloud" size={26} style={{ color: 'var(--fg-3)' }} />
                      <div style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 500 }}>
                        {tr('tenant.2d2ebc')} <span className="mono" style={{ color: 'var(--accent)' }}>oci_api_key.pem</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('tenant.573670')}</div>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pem,.key,.txt"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        state.privateKey = String(reader.result || '');
                        state.keyFileName = f.name;
                        render();
                        shell.showToast(tr('tenant.8254e6').replace('{0}',f.name).replace('{1}',(f.size / 1024).toFixed(1)), { kind: 'success' });
                      };
                      reader.readAsText(f);
                    }}
                  />
                </label>
              ) : (
                <TextArea
                  mono rows={5}
                  value={state.privateKey}
                  onChange={v => { state.privateKey = v; state.keyFileName = ''; render(); }}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBgk..."
                />
              )}
            </FormRow>
            <div style={{ padding: 10, background: 'var(--info-soft)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--fg-1)' }}>
              <Icon name="info" size={13} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
              <div>
                {tr('tenant.72a8a7')}<b>{tr('tenant.420409')}</b>、<b>{tr('tenant.f652dc')}</b>、<b>{tr('tenant.cca8d0')}</b>{tr('tenant.fa3359')}
              </div>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
            <Button variant="outline" size="md" icon="upload">{tr('tenant.832307')}</Button>
            <Button
              variant="primary" size="md" icon="check"
              disabled={!state.alias || !state.region || !state.tenancy || !state.user || !state.fingerprint || !state.privateKey}
              onClick={async () => {
                // 真实后端导入:POST /tenants/import → tenantService.importData(List<Map>)
                // 后端 createTenantFromRecord 读取: id/tenant_id/user_name/fingerprint/tenancy/region/cloud_type/key_file_content/tenancy_name
                // · user_name 必须保留完整 user OCID(OCI API 认证依赖,不能改成可读名)。
                // · 显示名放 tenancy_name(alias / profile 名),前端 getTenantName 优先取 tenancyName。
                // · 缺 id 会被跳过;id 用 tenancy OCID 的稳定哈希生成,使同租户重复导入幂等(后端 findById 命中即跳过)。
                const customName = state.alias.trim();
                const hashed = state.tenancy.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
                const id = (hashed % 900000000) + 100000000;
                const payload = [{
                  id,
                  tenant_id: state.tenancy,
                  user_name: state.user,
                  fingerprint: state.fingerprint,
                  tenancy: state.tenancy,
                  region: state.region,
                  cloud_type: 1,
                  tenancy_name: customName || state.region || 'oci-tenant',
                  custom_name: customName || null,
                  key_file_content: state.privateKey,
                }];
                try {
                  // 先调用真实后端校验名称。列表是分页数据，不能在前端自行判断；
                  // 重复时不发送 /tenants/import，也不关闭弹窗或显示成功提示。
                  if (customName) {
                    const checkBody = await window.ociServices.tenant.checkCustomName({
                      name: customName,
                      cloudType: 1,
                      excludeTenantId: id,
                      excludeTenancy: state.tenancy,
                    });
                    if (checkBody.exists === true) {
                      shell.showToast(tr('tenant.8ec0af').replace('{0}',customName), { kind: 'error' });
                      return;
                    }
                  }

                  shell.showToast(tr('tenant.d5d297').replace('{0}',customName).replace('{1}',state.region), { kind: 'info' });
                  const res = await fetch('/tenants/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                  });
                  const txt = await res.text();
                  if (res.ok) {
                    shell.closeModal();
                    shell.showToast(tr('tenant.f7572c').replace('{0}',txt || tr('tenant.importOk')), { kind: 'success' });
                    // 原地刷新租户数据(不整页 reload)
                    window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
                  } else {
                    shell.showToast(tr('tenant.8f118f').replace('{0}',txt || res.status), { kind: 'error' });
                  }
                } catch (e) {
                  shell.showToast(tr('tenant.8f118f').replace('{0}',e.message || e), { kind: 'error' });
                }
              }}
            >{tr('tenant.e1471c')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

function useImportTenantsModal() {
  const shell = useShell();
  return React.useCallback(() => {
    let dragOver = false;
    let file = null;
    const render = () => {
      shell.openModal({
        title: tr('tenant.5f7644'),
        subtitle: tr('tenant.62df17'),
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
                transition: 'all 100ms',
              }}
            >
              <Icon name="upload-cloud" size={32} style={{ color: dragOver ? 'var(--accent)' : 'var(--fg-3)' }} />
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>
                {file ? file.name : tr('tenant.18af4d')}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-3)' }}>{tr('tenant.cf19ec')}</div>
              <input type="file" style={{ display: 'none' }} accept=".json,.zip" onChange={e => { if (e.target.files[0]) { file = e.target.files[0]; render(); } }} />
            </label>
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)' }}>
              {tr('tenant.2866e8')}<br/>
              <span className="mono" style={{ color: 'var(--fg-1)' }}>[{'{'} "alias": "sg-01", "tenancy": "ocid1...", "user": "ocid1...", "fingerprint": "...", "region": "ap-singapore-1", "privateKey": "..." {'}'}, ...]</span>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
            <Button variant="primary" size="md" icon="upload" disabled={!file} onClick={async () => {
              // 真实解析上传文件(.json 数组,或含 tenants.json 的 .zip),并映射到后端字段键。
              try {
                const raw = await file.text();
                let records;
                try { records = JSON.parse(raw); }
                catch (e) { shell.showToast(tr('tenant.1813c3').replace('{0}',e.message), { kind: 'error' }); return; }
                if (!Array.isArray(records)) { shell.showToast(tr('tenant.4830cf'), { kind: 'error' }); return; }
                // 映射到后端 createTenantFromRecord 需要的字段;缺 id 的用 tenancy OCID 稳定哈希补,
                // 避免 Date.now() 导致的重复导入不幂等。
                const payload = records.map((r, i) => {
                  const tenancyOcid = r.tenant_id || r.tenancy || r.tenancyOcid || '';
                  const hashed = String(tenancyOcid || (r.id || i)).split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
                  const stableId = r.id || ((hashed % 900000000) + 100000000);
                  return {
                    id: stableId,
                    tenant_id: tenancyOcid,
                    user_name: r.user_name || r.user || '',
                    fingerprint: r.fingerprint || '',
                    tenancy: tenancyOcid,
                    region: r.region || '',
                    cloud_type: r.cloud_type || r.cloudType || 1,
                    tenancy_name: r.tenancy_name || r.alias || r.name || (tenancyOcid ? `oci-${tenancyOcid.slice(-6)}` : ''),
                    key_file_content: r.key_file_content || r.privateKey || r.private_key || '',
                  };
                });
                const res = await fetch('/tenants/import', { method: 'POST', headers: { 'Content-Type':'application/json','Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify(payload) });
                const txt = await res.text();
                if (res.ok) { shell.closeModal(); shell.showToast(tr('tenant.4bca36').replace('{0}',payload.length).replace('{1}',txt || tr('tenant.success')), { kind: 'success' }); window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' })); }
                else { shell.showToast(tr('tenant.8f118f').replace('{0}',txt || res.status), { kind: 'error' }); }
              } catch (e) { shell.showToast(tr('tenant.8f118f').replace('{0}',e.message || e), { kind: 'error' }); }
            }}>{tr('tenant.7d2ff4')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

// ─── Drawer-based views ──────────────────────────────────────────

// ─── 租户详情 · Modal(对齐原项目 tenant detail 页面) ───────────────
// 原项目是独立表格页,含租户信息 + 每行右侧 7 项操作菜单:
// 实例同步 · 添加开机 · 查看开机 · 硬盘信息 · 安全规则 · 资源列表 · 存储案例
function useTenantDetailDrawer() {
  const shell = useShell();
  const { lang } = useT();
  const addBoot = useAddBootModal();
  return React.useCallback((tenant) => {
    const state = { stats: { instances: 0, running: 0, tasks: 0, cost: Number(tenant._ui?.accountCost ?? tenant.accountCost ?? 0) }, menuFor: null };

    // 构造租户行数据:主区域行 + 若多区域,子区域行
    const buildRows = () => {
      const mainRow = {
        seq: 1,
        name: getTenantName(tenant),
        custom: getTenantAlias(tenant),
        tasks: state.stats.tasks || 0,
        region: getTenantRegion(tenant),
        isHomeRegion: true,
        syncStatus: 'synced',
        createdAt: tenant._ui?.createdAt ?? tenant.createdAt ?? '',
      };
      // 子区域仅使用后端 children，不能凭空添加固定区域或同步状态。
      const subRows = Array.isArray(tenant.children) ? tenant.children.map((child, index) => ({
        seq: index + 2,
        name: getTenantName(tenant),
        custom: getTenantAlias(tenant),
        tasks: null,
        region: getTenantRegion(child),
        isHomeRegion: false,
        syncStatus: 'unknown',
        createdAt: child.createdAtStr ?? child.createdAt ?? tenant._ui?.createdAt ?? tenant.createdAt ?? '',
      })) : [];
      return [mainRow, ...subRows];
    };
    state.rows = buildRows();

    // 真实统计:实例总数 / 运行中 / 开机任务
    const loadStats = async (tenantId) => {
      try {
        const [instPage, bootPage] = await Promise.all([
          window.ociApi.getPage('/oci/list/json', { page: 0, size: 500, tenantId }),
          window.ociApi.getPage('/boot/fullBootList/json', { page: 0, size: 500, tenantId }),
        ]);
        const insts = instPage.content || [];
        state.stats = {
          instances: insts.length,
          running: insts.filter(i => String(i.state || '').toLowerCase() === 'running').length,
          tasks: (bootPage.content || []).length,
          cost: Number(tenant._ui?.accountCost ?? tenant.accountCost ?? 0),
        };
      } catch (e) {
        state.stats = { instances: 0, running: 0, tasks: 0, cost: Number(tenant._ui?.accountCost ?? tenant.accountCost ?? 0) };
      }
      state.rows = buildRows();
      render();
    };

    // 7 项操作定义
    const ROW_ACTIONS = [
      { id: 'sync-instance', label: tr('tenant.0f19a0'),   icon: 'refresh-cw',    color: 'var(--accent)' },
      { id: 'add-boot',      label: tr('tenant.c77c1f'),   icon: 'plus',          color: 'var(--fg-1)' },
      { id: 'view-boot',     label: tr('tenant.465f9a'),   icon: 'eye',           color: 'var(--fg-1)' },
      { id: 'disk-info',     label: tr('tenant.a74b62'),   icon: 'hard-drive',    color: 'var(--fg-1)' },
      { id: 'security-rules',label: tr('tenant.d77eaa'),   icon: 'shield',        color: 'var(--fg-1)' },
      { id: 'resource-list', label: tr('tenant.6a50dc'),   icon: 'list',          color: 'var(--fg-1)' },
      { id: 'database-case', label: tr('tenant.9ff7a2'),   icon: 'database',      color: 'var(--fg-1)' },
    ];

    const runAction = (actionId, row) => {
      state.menuFor = null;
      render();
      const regionLabel = REGIONS.find(r => r.code === row.region)?.cn || row.region;
      switch (actionId) {
        case 'sync-instance':
          (async () => {
            try {
              shell.showToast(tr('tenant.0115ba').replace('{0}',row.name).replace('{1}',regionLabel), { kind: 'info' });
              const result = await window.ociApi.request(`/tenants/syncOci?tenantId=${encodeURIComponent(getTenantDbId(tenant))}`);
              if (typeof result === 'object' && result?.status !== 'success') throw new Error(result?.message || tr('tenant.d61036'));
              await loadStats(getTenantDbId(tenant));
              shell.showToast(tr('tenant.532320').replace('{0}',state.stats.instances), { kind: 'success' });
            } catch (error) {
              shell.showToast(tr('tenant.712e03').replace('{0}',error.message || error), { kind: 'error' });
            }
          })();
          return;
        case 'add-boot':
          // 复用现有的 add-boot modal,预填此租户
          shell.closeModal();
          setTimeout(() => addBoot(tenant), 200);
          return;
        case 'view-boot':
          shell.showToast(tr('tenant.b7fb34').replace('{0}',row.name), { kind: 'info' });
          shell.closeModal();
          setTimeout(() => { window.__ocipNavigate?.('grab'); }, 400);
          return;
        case 'disk-info':
          showDiskModal(shell, tenant, row);
          return;
        case 'security-rules':
          showSecurityModal(shell, tenant, row);
          return;
        case 'resource-list':
          showResourceModal(shell, tenant, row);
          return;
        case 'database-case':
          showMysqlModal(shell, tenant, row);
          return;
      }
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.631592'),
        subtitle: <span><span className="mono">{getTenantName(tenant)}</span> · {getTenantAlias(tenant) || '-'} · {tenant._ui?.hasChildren ? tr('tenant.054252') : tr('tenant.1df5c2')}</span>,
        icon: 'diamond',
        iconColor: 'var(--accent)',
        size: 'xl',
        body: (
          <div style={{ padding: 20 }}>
            {/* 顶部操作栏 (对齐原项目) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 14,
              paddingBottom: 12, borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                fontSize: 11, color: 'var(--accent)', fontWeight: 600,
              }}>
                <Icon name="diamond" size={12} />
                <span>{tr('tenant.631592')}</span>
              </div>
              <div style={{ flex: 1 }} />
              <IconButton
                icon="eye"
                size={28}
                tooltip={tr('tenant.0a2087')}
                style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}
              />
              <Button size="sm" variant="primary" icon="zap">{tr('tenant.bec559')}</Button>
            </div>

            {/* 表格 */}
            <div style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'auto',
              maxHeight: 460,
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 12,
              }}>
                <thead>
                  <tr>
                    {[tr('tenant.faaadc'), tr('tenant.c46779'), tr('tenant.d7ec2d'), tr('tenant.254f06'), tr('tenant.d3ce40'), tr('tenant.d2ccf9'), tr('tenant.0f19a0'), tr('tenant.eca37c'), tr('tenant.2b6bc0')].map((h, i) => (
                      <th key={i} style={{
                        textAlign: 'center',
                        padding: '10px 12px',
                        background: 'var(--bg-2)',
                        color: 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                        position: 'sticky', top: 0, zIndex: 1,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, i) => (
                    <tr key={i} style={{
                      background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                    }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-2)', borderBottom: '1px solid var(--border)' }}>
                        <span className="num">{row.seq}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{
                          padding: '2px 6px', background: 'var(--bg-3)',
                          borderRadius: 3, fontSize: 11, color: 'var(--fg-1)',
                        }}>{row.name}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)' }}>
                        {getTenantName(row)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {row.tasks > 0
                          ? <span style={{
                              padding: '1px 8px', background: 'var(--info-soft)', color: 'var(--info)',
                              borderRadius: 3, fontSize: 11, fontWeight: 500,
                            }}>{row.tasks} {tr('tenant.98d820')}</span>
                          : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('tenant.71c10f')}</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <RegionBadge code={row.region} lang={lang} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {row.isHomeRegion
                          ? <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '1px 8px', background: 'var(--accent-soft)', color: 'var(--accent)',
                              borderRadius: 3, fontSize: 11, fontWeight: 500,
                            }}><Icon name="check" size={10} strokeWidth={3} />{tr('tenant.0a60ac')}</span>
                          : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('tenant.c9744f')}</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {row.syncStatus === 'synced' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', background: 'var(--accent-soft)', color: 'var(--accent)',
                            borderRadius: 3, fontSize: 11, fontWeight: 500,
                          }}>
                            <StatusDot status="running" size={5} />{tr('tenant.8bf97a')}
                          </span>
                        ) : row.syncStatus === 'syncing' ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', background: 'var(--info-soft)', color: 'var(--info)',
                            borderRadius: 3, fontSize: 11, fontWeight: 500,
                          }}>
                            <Icon name="loader" size={10} />{tr('tenant.2b7697')}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', background: 'var(--bg-3)', color: 'var(--fg-3)',
                            borderRadius: 3, fontSize: 11,
                          }}>{tr('tenant.e2c177')}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{row.createdAt}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          onClick={e => {
                            if (state.menuFor?.i === i) {
                              state.menuFor = null;
                              render();
                              return;
                            }
                            // 立刻读取按钮位置(render 会重建 DOM,不能存 el 引用)
                            const rect = e.currentTarget.getBoundingClientRect();
                            state.menuFor = {
                              i,
                              anchorRect: {
                                top: rect.top, bottom: rect.bottom,
                                left: rect.left, right: rect.right,
                              },
                            };
                            render();
                          }}
                          style={{
                            width: 28, height: 28, borderRadius: 4,
                            background: state.menuFor?.i === i ? 'var(--accent)' : 'var(--bg-2)',
                            border: '1px solid var(--border)',
                            color: state.menuFor?.i === i ? 'var(--accent-fg)' : 'var(--fg-1)',
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title={tr('tenant.fff96e')}
                        >
                          <Icon name="more-horizontal" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 快速指标 */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
              marginTop: 14,
            }}>
              <MiniMetric label={tr('tenant.1bdd6e')} value={state.stats.instances} color="var(--cyan)" />
              <MiniMetric label={tr('tenant.d679ae')} value={state.stats.running} color="var(--accent)" />
              <MiniMetric label={tr('tenant.254f06')} value={state.stats.tasks} color="var(--info)" />
              <MiniMetric label={tr('tenant.98cc84')} value={`$${state.stats.cost}`} color="var(--orange)" />
            </div>

            {/* ─── 浮动菜单(fixed 定位不受父容器遮挡) ─── */}
            {state.menuFor && (() => {
              const rect = state.menuFor.anchorRect;
              // 菜单实际尺寸：宽 280,高 ~ header(30) + 4 行 × 34 + padding(12) ≈ 178,但为
              // 稳妥起见按 200 估算,避免下方空间紧张时错误判定"能装下"
              const menuW = 280, menuH = 180, gap = 6, margin = 12;
              const btnCenterX = (rect.left + rect.right) / 2;
              const btnCenterY = (rect.top + rect.bottom) / 2;

              // 垂直方向:优先在按钮下方紧贴,空间不够再上方
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              const openUp = spaceBelow < menuH + gap + margin && spaceAbove > menuH + gap + margin;
              let top = openUp ? rect.top - menuH - gap : rect.bottom + gap;

              // 水平方向:锚定到按钮附近。默认让菜单**右边缘对齐按钮右边缘**(向左伸展),
              // 因为 ⋯ 位于表格最后一列。若按此定位后菜单左边缘超出视口(极窄视口),
              // 就退回让菜单**左边缘对齐按钮中心**,始终保证菜单可见且靠近按钮。
              let left = rect.right - menuW;
              if (left < margin) {
                left = Math.min(btnCenterX - 20, window.innerWidth - menuW - margin);
              }

              // 最终 clamp 到视口内(保底,不应触发)
              left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
              top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin));
              const menuPos = { left, top, openUp, anchorX: btnCenterX };
              // ★ 关键:用 portal 把菜单 render 到 document.body,脱离 Modal 的
              // transform 上下文(shell.jsx 的 translate(-50%,-50%) 会让子孙的
              // position:fixed 相对 Modal 而不是视口 —— 这是 CSS 规范的坑)
              const menuUI = (
              <>
                {/* 点击外部关闭 */}
                <div
                  onClick={() => { state.menuFor = null; render(); }}
                  style={{
                    position: 'fixed', inset: 0,
                    zIndex: 999,
                  }}
                />
                <div style={{
                  position: 'fixed',
                  left: menuPos.left,
                  top: menuPos.top,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  padding: 4,
                  boxShadow: '0 16px 40px oklch(0 0 0 / 0.55)',
                  zIndex: 1000,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  width: 280,
                  animation: 'fade-in 100ms ease-out',
                }}>
                  {/* 指向锚点的箭头 */}
                  <div style={{
                    position: 'absolute',
                    // 箭头水平对齐按钮中心
                    left: Math.max(10, Math.min(menuPos.anchorX - menuPos.left - 5, 280 - 22)),
                    [menuPos.openUp ? 'bottom' : 'top']: -6,
                    width: 10, height: 10,
                    background: 'var(--bg-1)',
                    borderTop: menuPos.openUp ? 'none' : '1px solid var(--border-strong)',
                    borderLeft: menuPos.openUp ? 'none' : '1px solid var(--border-strong)',
                    borderBottom: menuPos.openUp ? '1px solid var(--border-strong)' : 'none',
                    borderRight: menuPos.openUp ? '1px solid var(--border-strong)' : 'none',
                    transform: 'rotate(45deg)',
                    pointerEvents: 'none',
                  }} />

                  {/* 操作头部标签 */}
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '5px 8px 3px',
                    fontSize: 9.5, fontWeight: 600,
                    color: 'var(--fg-3)',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 2,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name="settings-2" size={10} />
                    <span>{tr('tenant.621c42')} {ROW_ACTIONS.length} {tr('tenant.29645b')}</span>
                  </div>

                  {ROW_ACTIONS.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => runAction(a.id, state.rows[state.menuFor.i])}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '6px 9px',
                        background: 'transparent', border: 'none',
                        borderRadius: 5,
                        color: 'var(--fg-1)',
                        fontFamily: 'inherit', fontSize: 11.5,
                        cursor: 'pointer',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Icon name={a.icon} size={12} style={{ color: a.color, flexShrink: 0 }} />
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </>
              );
              return ReactDOM.createPortal(menuUI, document.body);
            })()}
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>
            <Button size="md" variant="outline" icon="edit">{tr('tenant.4a0e3d')}</Button>
            <Button size="md" variant="primary" icon="refresh-cw">{tr('tenant.a63d66')}</Button>
          </>
        ),
      });
    };
    render();
    loadStats(getTenantDbId(tenant));
  }, [shell, lang, addBoot]);
}

// ─── 7 项操作对应的子 modal(硬盘信息 / 安全规则 / 资源列表 / 存储实例) ───

function showDiskModal(shell, tenant, row) {
  // IOPS 估算:与 OCI 官方近似 · VPU 0-120 影响倍率
  const calcIops = (size, vpu) => Math.round(size * (vpu * 12 + 60));

  const state = { disks: [], loading: true };

  // 真实后端 GET /tenants/boot-volumes → BootVolumeRes
  const normDisk = (r) => ({
    id: r.id,
    name: r.displayName || r.instanceName,
    instanceName: r.instanceName || '',
    size: r.sizeInGBs,
    type: 'Boot',
    vpu: r.vpusPerGB,
    attached: !!r.instanceName,
    instanceDetailId: r.instanceDetailsId,
  });

  const loadDisks = async () => {
    state.loading = true; renderList();
    try {
      const list = await window.ociApi.request('/tenants/boot-volumes?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
      state.disks = (Array.isArray(list) ? list : []).map(normDisk);
    } catch (e) {
      state.disks = [];
    }
    state.loading = false; renderList();
  };

  // 二级 modal:修改引导卷 (VPU 滑块)
  const openEditModal = (disk) => {
    const editState = { name: disk.name, vpu: disk.vpu };
    const renderEdit = () => {
      shell.openModal({
        title: tr('tenant.8b7a5b'),
        icon: 'hard-drive',
        iconColor: 'var(--cyan)',
        size: 'md',
        body: (
          <div style={{ padding: 20 }}>
            <FormRow label={tr('tenant.e4f684')}>
              <TextInput
                value={editState.name}
                onChange={v => { editState.name = v; renderEdit(); }}
                mono
              />
            </FormRow>

            <FormRow
              label={tr('tenant.39ee54').replace('{0}',editState.vpu)}
              hint={tr('tenant.4d2f08')}
            >
              <input
                type="range"
                min={10} max={120} step={10}
                value={editState.vpu}
                onChange={e => { editState.vpu = +e.target.value; renderEdit(); }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: 'var(--fg-3)', marginTop: 4,
                fontFamily: 'var(--font-mono)',
              }}>
                {(() => {
                  const nearest = Math.round(editState.vpu / 10) * 10;
                  return [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(n => (
                    <span key={n} style={{ color: n === nearest ? 'var(--accent)' : undefined, fontWeight: n === nearest ? 600 : undefined }}>{n}</span>
                  ));
                })()}
              </div>
            </FormRow>

            {/* 性能预估 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5,
              marginBottom: 12,
            }}>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>{tr('tenant.95cbd0')} </span>
                <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{calcIops(disk.size, editState.vpu).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>{tr('tenant.581e84')} </span>
                <span className="num" style={{ color: 'var(--cyan)', fontWeight: 600 }}>{(editState.vpu * 1.75 / 10).toFixed(2)} MB/s/GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" size="md" onClick={() => renderList()}>{tr('tenant.625fb2')}</Button>
              <Button variant="primary" size="md" icon="check" onClick={async () => {
                try {
                  await window.ociApi.request('/tenants/update-volumes/' + encodeURIComponent(disk.id), {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vpusPerGB: editState.vpu, tenantId: getTenantDbId(tenant), displayName: editState.name, instanceDetailId: disk.instanceDetailId }),
                  });
                  shell.showToast(tr('tenant.8d6331').replace('{0}',editState.name).replace('{1}',editState.vpu), { kind: 'success' });
                  loadDisks();
                } catch (e) {
                  shell.showToast(tr('tenant.860225') + (e.message || e), { kind: 'error' });
                }
              }}>{tr('tenant.e83a25')}</Button>
            </div>
          </div>
        ),
      });
    };
    renderEdit();
  };

  // 主 modal:硬盘信息表格
  const renderList = () => {
    shell.openModal({
      title: tr('tenant.6042c1').replace('{0}',getTenantName(tenant)),
      subtitle: tr('tenant.54a9a3').replace('{0}',row.region).replace('{1}',state.disks.length),
      icon: 'hard-drive',
      iconColor: 'var(--info)',
      size: 'lg',
      body: (
        <div style={{ padding: 18 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowY: 'auto', maxHeight: 400 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                {[
                  { h: '引导卷名称', w: 180 },
                  { h: '实例名称', w: 130 },
                  { h: '类型', w: 60 },
                  { h: '容量', w: 80 },
                  { h: '性能 (VPU)', w: 120 },
                  { h: '状态', w: 80 },
                  { h: '操作', w: 80, align: 'center' },
                ].map((c, i) =>
                  <th key={i} style={{
                    textAlign: c.align || 'center', padding: '9px 10px', width: c.w,
                    background: 'var(--bg-2)', color: 'var(--fg-3)',
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>{c.h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('tenant.26b5bd')}</td>
                </tr>
              ) : state.disks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('tenant.e004d5')}</td>
                </tr>
              ) : state.disks.map((d, i) => (
                <tr key={d.id || i} style={{
                  background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                }}>
                  <td style={{ padding: '10px', textAlign: 'center', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <span className="mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{d.name}</span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {d.instanceName ? <span style={{ fontSize: 11.5 }}>{d.instanceName}</span> : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>未关联实例</span>}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      padding: '1px 6px',
                      background: d.type === 'Boot' ? 'var(--info-soft)' : 'var(--accent-soft)',
                      color: d.type === 'Boot' ? 'var(--info)' : 'var(--accent)',
                      borderRadius: 3, fontSize: 10, fontWeight: 600,
                    }}>{d.type}</span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)' }} className="num">
                    {d.size} GB
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ position: 'relative', width: 28, height: 28 }}>
                        <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx={14} cy={14} r={11} fill="none" stroke="var(--bg-3)" strokeWidth={3} />
                          <circle
                            cx={14} cy={14} r={11} fill="none" stroke="var(--cyan)" strokeWidth={3}
                            strokeDasharray={2 * Math.PI * 11}
                            strokeDashoffset={2 * Math.PI * 11 * (1 - Math.min(1, Math.max(0, d.vpu / 120)))}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--cyan)',
                        }}>
                          {d.vpu}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500 }}>VPU</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {d.attached
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          <StatusDot status="running" size={5} pulse />{tr('tenant.9817da')}
                        </span>
                      : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('tenant.f64a38')}</span>
                    }
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <Button size="sm" variant="primary" icon="edit-3" onClick={() => openEditModal(d)}>{tr('tenant.8347a9')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" size="md" icon="refresh-cw" loading={state.loading} onClick={loadDisks}>刷新</Button>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>
        </div>
      ),
    });
  };
  renderList();
  loadDisks();
}
function showSecurityModal(shell, tenant, row) {
  // ═══════════════════════════════════════════════════════════════════════
  // 安全规则管理 · UI 升级版
  // ═══════════════════════════════════════════════════════════════════════
  // 信息字段严格对齐原项目 doubleDimple/oci-start,交互体验做了系统升级:
  //   · 分段控件切换协议(替代下拉,直观可见)
  //   · 地址快选按钮:任何地址/仅 IPv6/内网 A|B|C 类
  //   · 常用端口 chips:SSH/HTTP/HTTPS/MySQL/PostgreSQL/... + 自定义
  //   · 双端口输入(起始-结束)支持端口范围
  //   · 风险等级徽章(高/中/低)自动计算并在每行末尾展示
  //   · 一键导入模板:Web / DB / K8s / Docker 常见预设
  //   · 危险规则(0.0.0.0/0 + 所有端口/22/3389)加橙色 shield 警告
  //   · 空状态友好提示 + 一键从模板初始化
  //   · 每行 ⋯ 菜单(复用统一的 <RowActionMenu>):编辑/复制/删除

  const PROTOCOLS = [
    { id: 'ALL',    label: '全部',      icon: 'shield',    color: 'var(--fg-1)' },
    { id: 'TCP',    label: 'TCP',      icon: 'arrow-right-left', color: 'var(--info)' },
    { id: 'UDP',    label: 'UDP',      icon: 'zap',       color: 'var(--cyan)' },
    { id: 'ICMP',   label: 'ICMP',     icon: 'radio',     color: 'var(--violet)' },
  ];

  // 快选 CIDR
  const CIDR_PRESETS = [
    { label: tr('tenant.c3e76a'),   value: '0.0.0.0/0',  icon: 'globe',  hint: tr('tenant.08a7d1'),    danger: true },
    { label: tr('tenant.5b327a'),    value: '::/0',       icon: 'globe',  hint: tr('tenant.a3db47') },
    { label: tr('tenant.ea9be4'),   value: '10.0.0.0/8', icon: 'shield', hint: tr('tenant.4c71ab'),        safe: true },
    { label: tr('tenant.a34986'),   value: '172.16.0.0/12', icon: 'shield', hint: tr('tenant.e0c54a'),           safe: true },
    { label: tr('tenant.a70d63'),   value: '192.168.0.0/16', icon: 'shield', hint: tr('tenant.85e92d'),     safe: true },
  ];

  // 常用端口
  const PORT_PRESETS = [
    { label: 'SSH',        value: '22'   },
    { label: 'HTTP',       value: '80'   },
    { label: 'HTTPS',      value: '443'  },
    { label: 'RDP',        value: '3389' },
    { label: 'MySQL',      value: '3306' },
    { label: 'PostgreSQL', value: '5432' },
    { label: 'Redis',      value: '6379' },
    { label: 'MongoDB',    value: '27017' },
    { label: tr('tenant.06804e'),   value: '8000-8100' },
  ];

  // 一键模板
  const TEMPLATES = [
    { id: 'web',    icon: 'globe',   name: tr('tenant.2880f1'),   desc: 'SSH + HTTP + HTTPS',
      rules: [
        { proto: 'TCP', addr: '0.0.0.0/0', ports: '22' },
        { proto: 'TCP', addr: '0.0.0.0/0', ports: '80' },
        { proto: 'TCP', addr: '0.0.0.0/0', ports: '443' },
      ] },
    { id: 'db',     icon: 'database', name: tr('tenant.68051b'),      desc: tr('tenant.e898ad'),
      rules: [
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '3306' },
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '5432' },
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '6379' },
      ] },
    { id: 'k8s',    icon: 'layers',   name: 'Kubernetes', desc: 'API/etcd/Kubelet/NodePort',
      rules: [
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '6443' },
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '2379-2380' },
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '10250' },
        { proto: 'TCP', addr: '0.0.0.0/0',  ports: '30000-32767' },
      ] },
    { id: 'docker', icon: 'container', name: 'Docker',    desc: tr('tenant.b32722'),
      rules: [
        { proto: 'TCP', addr: '0.0.0.0/0',  ports: '22' },
        { proto: 'TCP', addr: '10.0.0.0/8', ports: '2375-2376' },
      ] },
    { id: 'minimal', icon: 'lock',    name: tr('tenant.4782f9'),    desc: tr('tenant.dc45fe'),
      rules: [
        { proto: 'TCP', addr: '0.0.0.0/0', ports: '22' },
      ] },
    { id: 'icmp',   icon: 'radio',    name: tr('tenant.d46326'),   desc: tr('tenant.d64a59'),
      rules: [
        { proto: 'ICMP', addr: '0.0.0.0/0', ports: '' },
        { proto: 'ICMP', addr: '::/0',      ports: '' },
      ] },
  ];

  const state = {
    tab: 'ingress',
    ingress: [],
    egress: [],
    loading: true,
    formMode: 'closed',              // closed | add | edit | template
    editingId: null,
    // 表单字段
    form: { proto: 'TCP', addr: '0.0.0.0/0', portStart: '', portEnd: '' },
  };

  const genId = (arr) => (arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1);
  const resetForm = () => {
    state.form = { proto: 'TCP', addr: '0.0.0.0/0', portStart: '', portEnd: '' };
    state.formMode = 'closed';
    state.editingId = null;
  };

  const normRule = (r) => ({
    id: r.id,
    proto: ['ALL','TCP','UDP','ICMP','ICMPv6'].includes(r.protocol) ? r.protocol : 'ALL',
    addr: r.source || '0.0.0.0/0',
    ports: r.ports || '',
  });
  const apiType = () => state.tab === 'ingress' ? 'ingress' : 'egress';
  const loadRules = async () => {
    state.loading = true; render();
    try {
      const ingress = await window.ociApi.request('/tenants/security-rules?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) + '&type=ingress');
      const egress = await window.ociApi.request('/tenants/security-rules?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) + '&type=egress');
      state.ingress = (Array.isArray(ingress) ? ingress : []).map(normRule);
      state.egress = (Array.isArray(egress) ? egress : []).map(normRule);
    } catch (e) {
      state.ingress = []; state.egress = [];
    }
    state.loading = false; render();
  };
  const persistRule = async (payload) => {
    return await window.ociApi.request('/tenants/security-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  };
  // 后端兜底：检测到高危规则时响应带 warning 字段 → 提示用户
  const warnIfBackendRisk = (resp) => {
    if (resp && resp.warning) {
      shell.showToast(tr('tenant.risk.backendWarn') + resp.warning, { kind: 'warn', duration: 6000 });
    }
  };
  const deleteRule = async (id) => {
    await window.ociApi.request('/tenants/security-rules/' + encodeURIComponent(id), { method: 'DELETE' });
  };

  // 判断风险等级
  const riskLevel = (r) => {
    const openAll = r.addr === '0.0.0.0/0' || r.addr === '::/0';
    const dangerPorts = /(^|,|-|\b)(22|3389|3306|5432|6379|27017)(\b|,|-|$)/;
    if (openAll && r.proto === 'ALL') return 'critical';
    if (openAll && r.ports && dangerPorts.test(r.ports)) return 'high';
    if (openAll) return 'medium';
    return 'low';
  };
  const riskCfg = {
    critical: { label: tr('tenant.e2e27a'), color: 'var(--danger)', bg: 'var(--danger-soft)' },
    high:     { label: tr('tenant.4296d7'),   color: 'var(--danger)', bg: 'var(--danger-soft)' },
    medium:   { label: tr('tenant.aed1df'),   color: 'var(--orange)', bg: 'var(--orange-soft)' },
    low:      { label: tr('tenant.19ac67'),   color: 'var(--accent)', bg: 'var(--accent-soft)' },
  };

  // 是否为高危规则（开放全地址 + 全协议 / 高危端口），保存前需二次确认
  const isDangerForm = (proto, addr, ports) => {
    const openAll = addr === '0.0.0.0/0' || addr === '::/0';
    const dangerPorts = /(^|,|-|\b)(22|3389|3306|5432|6379|27017)(\b|,|-|$)/;
    if (!openAll) return false;
    if (proto === 'ALL') return true;
    if (ports && dangerPorts.test(ports)) return true;
    return false;
  };

  // 端口输入转字符串
  const portsToStr = (start, end) => {
    if (!start) return '';
    if (!end || end === start) return start;
    return `${start}-${end}`;
  };
  const strToPorts = (s) => {
    if (!s) return { start: '', end: '' };
    const m = s.match(/^(\d+)-(\d+)$/);
    if (m) return { start: m[1], end: m[2] };
    return { start: s, end: '' };
  };

  const render = () => {
    const list = state.tab === 'ingress' ? state.ingress : state.egress;
    const addrLabel = state.tab === 'ingress' ? tr('tenant.4926ed') : tr('tenant.2e694b');
    const isAllProto = state.form.proto === 'ALL';
    const isICMP = state.form.proto === 'ICMP' || state.form.proto === 'ICMPv6';
    const portsDisabled = isAllProto || isICMP;
    const currentRules = list;

    // 风险统计
    const riskCount = { critical: 0, high: 0, medium: 0, low: 0 };
    currentRules.forEach(r => { riskCount[riskLevel(r)]++; });

    shell.openModal({
      title: tr('tenant.a50569'),
      subtitle: <span><span className="mono">{tenantLabel(tenant)}</span> · <span className="mono">{regionSimpleName(row.region)}</span> · <span style={{ color: 'var(--fg-2)' }}>{currentRules.length} {tr('tenant.6c2cfb')}</span></span>,
      icon: 'shield',
      iconColor: 'var(--accent)',
      size: 'xl',
      body: (
        <div style={{ padding: 18 }}>
          {/* ── 顶部 Tab + 风险汇总 ────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 14,
          }}>
            <div style={{
              display: 'flex',
              width: '100%',
              padding: 4,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}>
              {['ingress', 'egress'].map(k => {
                const isActive = state.tab === k;
                const accent = k === 'ingress' ? 'var(--info)' : 'var(--orange)';
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { state.tab = k; resetForm(); render(); }}
                    style={{
                      flex: 1,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 12px',
                      background: isActive ? accent : 'transparent',
                      border: isActive ? '1px solid ' + accent : '1px solid transparent',
                      borderRadius: 8,
                      color: isActive ? '#fff' : 'var(--fg-2)',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 100ms',
                    }}
                  >
                    <Icon name={k === 'ingress' ? 'arrow-down-to-line' : 'arrow-up-from-line'} size={13} />
                    {k === 'ingress' ? tr('tenant.3331c8') : tr('tenant.0d0772')}
                    <span style={{
                      padding: '0 6px', minWidth: 18,
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-3)',
                      color: isActive ? '#fff' : 'var(--fg-3)',
                      borderRadius: 4, fontSize: 10, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}>{(k === 'ingress' ? state.ingress : state.egress).length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 风险汇总徽章（独立行，3 档对齐客户端：高=严重+高合并）─ */}
          {currentRules.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600 }}>风险</span>
              {[
                { key: 'high', label: riskCfg['high'].label, color: riskCfg['high'].color, bg: riskCfg['high'].bg, count: riskCount.critical + riskCount.high, alert: true },
                { key: 'medium', label: riskCfg['medium'].label, color: riskCfg['medium'].color, bg: riskCfg['medium'].bg, count: riskCount.medium, alert: false },
                { key: 'low', label: riskCfg['low'].label, color: riskCfg['low'].color, bg: riskCfg['low'].bg, count: riskCount.low, alert: false },
              ].filter(x => x.count > 0).map(x => (
                <span key={x.key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 7px',
                  background: x.bg,
                  color: x.color,
                  borderRadius: 3, fontSize: 10.5, fontWeight: 600,
                }}>
                  {x.alert && <Icon name="alert-triangle" size={10} />}
                  {x.label}
                  <span className="num" style={{ opacity: 0.85 }}>{x.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── 关闭时的操作栏 ─────────────────────────── */}
          {state.formMode === 'closed' && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              marginBottom: 12,
            }}>
              <Button size="sm" variant="primary" icon="plus"
                onClick={() => { state.formMode = 'add'; state.editingId = null; state.form = { proto: 'TCP', addr: '0.0.0.0/0', portStart: '', portEnd: '' }; render(); }}
              >{tr('tenant.49818f')}</Button>
              <Button size="sm" variant="outline" icon="wand-2"
                onClick={() => { state.formMode = 'template'; render(); }}
              >{tr('tenant.47a160')}</Button>
              <div style={{ flex: 1 }} />
            </div>
          )}

          {/* ── 一键模板选择器 ─────────────────────────── */}
          {state.formMode === 'template' && (
            <div style={{
              padding: 14,
              marginBottom: 14,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="wand-2" size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }}>{tr('tenant.cc3cf8')}</span>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => { state.formMode = 'closed'; render(); }} style={{
                  padding: '3px 8px', background: 'transparent', border: 'none',
                  color: 'var(--fg-3)', fontSize: 11, cursor: 'pointer',
                }}>{tr('tenant.625fb2')}</button>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              }}>
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={async () => {
                      const type = apiType();
                      try {
                        for (const r of t.rules) {
                          await persistRule({ tenantId: getTenantDbId(tenant), type, protocol: r.proto, source: r.addr, ports: r.ports || null });
                        }
                        state.formMode = 'closed';
                        shell.showToast(tr('tenant.243db8').replace('{0}',t.name).replace('{1}',t.rules.length), { kind: 'success' });
                        loadRules();
                      } catch (e) {
                        shell.showToast(tr('tenant.0d8d58') + (e.message || e), { kind: 'error' });
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 100ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-1)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name={t.icon} size={13} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600 }}>{t.name}</span>
                      <span style={{
                        marginLeft: 'auto', padding: '0 5px',
                        background: 'var(--bg-3)', color: 'var(--fg-3)',
                        borderRadius: 3, fontSize: 10, fontFamily: 'var(--font-mono)',
                      }}>{t.rules.length}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 添加/编辑表单 ──────────────────────────── */}
          {(state.formMode === 'add' || state.formMode === 'edit') && (
            <div style={{
              padding: 14,
              marginBottom: 14,
              background: 'var(--bg-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon name={state.formMode === 'add' ? 'plus-circle' : 'edit-3'} size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }}>
                  {state.formMode === 'add' ? tr('tenant.b58c75') : tr('tenant.95b351')}{state.tab === 'ingress' ? tr('tenant.0768a8') : tr('tenant.5148cf')}{tr('tenant.b0fae0')}
                </span>
              </div>

              {/* 协议:分段控件 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 6 }}>{tr('tenant.faa1ad')}</div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
                  padding: 3,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}>
                  {PROTOCOLS.map(p => {
                    const isActive = state.form.proto === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          state.form.proto = p.id;
                          if (p.id === 'ALL' || p.id === 'ICMP' || p.id === 'ICMPv6') {
                            state.form.portStart = '';
                            state.form.portEnd = '';
                          }
                          render();
                        }}
                        style={{
                          padding: '7px 6px',
                          background: isActive ? 'var(--bg-2)' : 'transparent',
                          border: isActive ? '1px solid ' + p.color : '1px solid transparent',
                          borderRadius: 5,
                          color: isActive ? p.color : 'var(--fg-2)',
                          fontFamily: 'inherit', fontSize: 11.5, fontWeight: isActive ? 600 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          transition: 'all 100ms',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Icon name={p.icon} size={11} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 地址 · 快选 + 输入 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--fg-1)', fontWeight: 500 }}>{addrLabel}</span>
                  <span style={{ color: 'var(--danger)' }}>*</span>
                </div>
                {/* CIDR 快选 chips */}
                <div style={{
                  display: 'flex', gap: 4, flexWrap: 'wrap',
                  marginBottom: 6,
                }}>
                  {CIDR_PRESETS.map(p => {
                    const isActive = state.form.addr === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => { state.form.addr = p.value; render(); }}
                        title={p.hint}
                        style={{
                          padding: '4px 9px',
                          background: isActive ? (p.danger ? 'var(--orange-soft)' : p.safe ? 'var(--accent-soft)' : 'var(--info-soft)') : 'var(--bg-1)',
                          border: '1px solid ' + (isActive ? (p.danger ? 'var(--orange)' : p.safe ? 'var(--accent)' : 'var(--info)') : 'var(--border)'),
                          borderRadius: 12,
                          color: isActive ? (p.danger ? 'var(--orange)' : p.safe ? 'var(--accent)' : 'var(--info)') : 'var(--fg-2)',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          transition: 'all 100ms',
                        }}
                      >
                        <Icon name={p.icon} size={10} />
                        <span>{p.label}</span>
                        <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{p.value}</span>
                      </button>
                    );
                  })}
                </div>
                {/* CIDR 输入框 */}
                <input
                  type="text"
                  value={state.form.addr}
                  onChange={e => { state.form.addr = e.target.value; render(); }}
                  placeholder={tr('tenant.7531fe')}
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: 'var(--bg-1)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--fg-0)',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                  }}
                />
              </div>

              {/* 端口:双输入 + chips */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, color: portsDisabled ? 'var(--fg-3)' : 'var(--fg-1)', fontWeight: 500 }}>{tr('tenant.75384b')}</span>
                  {portsDisabled && (
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                      · {isAllProto ? tr('tenant.d454bb') : tr('tenant.a06b49')}
                    </span>
                  )}
                </div>
                {!portsDisabled && (
                  <>
                    {/* 常用端口 chips */}
                    <div style={{
                      display: 'flex', gap: 4, flexWrap: 'wrap',
                      marginBottom: 6,
                    }}>
                      {PORT_PRESETS.map(p => {
                        const range = strToPorts(p.value);
                        const isActive = state.form.portStart === range.start && (state.form.portEnd || '') === (range.end || '');
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              state.form.portStart = range.start;
                              state.form.portEnd = range.end;
                              render();
                            }}
                            style={{
                              padding: '4px 9px',
                              background: isActive ? 'var(--cyan-soft)' : 'var(--bg-1)',
                              border: '1px solid ' + (isActive ? 'var(--cyan)' : 'var(--border)'),
                              borderRadius: 12,
                              color: isActive ? 'var(--cyan)' : 'var(--fg-2)',
                              fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              transition: 'all 100ms',
                            }}
                          >
                            <span>{p.label}</span>
                            <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{p.value}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 双端口输入 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={state.form.portStart}
                        onChange={e => { state.form.portStart = e.target.value.replace(/[^0-9]/g, ''); render(); }}
                        placeholder={tr('tenant.175f99')}
                        style={{
                          flex: 1, padding: '8px 10px',
                          background: 'var(--bg-1)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--fg-0)',
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>—</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={state.form.portEnd}
                        onChange={e => { state.form.portEnd = e.target.value.replace(/[^0-9]/g, ''); render(); }}
                        placeholder={tr('tenant.47c824')}
                        style={{
                          flex: 1, padding: '8px 10px',
                          background: 'var(--bg-1)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--fg-0)',
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  </>
                )}
                {portsDisabled && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-1)',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--fg-3)',
                    fontSize: 11.5,
                    fontStyle: 'italic',
                  }}>
                    {isAllProto ? tr('tenant.310751') : tr('tenant.69f62a')}
                  </div>
                )}
              </div>

              {/* 保存/取消 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button size="sm" variant="ghost"
                  onClick={() => { resetForm(); render(); }}
                >{tr('tenant.625fb2')}</Button>
                <Button size="sm" variant="primary" icon="check"
                  onClick={async () => {
                    if (!state.form.addr.trim()) { shell.showToast(tr('tenant.df7c9e') + addrLabel, { kind: 'warn' }); return; }
                    const cidrOk = /^([0-9a-fA-F:.]+)\/\d+$/.test(state.form.addr.trim());
                    if (!cidrOk) { shell.showToast(tr('tenant.c622cf'), { kind: 'warn' }); return; }
                    const ports = portsDisabled ? '' : portsToStr(state.form.portStart, state.form.portEnd);
                    const payload = { tenantId: getTenantDbId(tenant), type: apiType(), protocol: state.form.proto, source: state.form.addr, ports: ports || null };
                    const doSave = async () => {
                      try {
                        const resp = await persistRule(payload);
                        warnIfBackendRisk(resp);
                        shell.showToast(tr('tenant.ed2386').replace('{0}',state.tab === 'ingress' ? tr('tenant.ingress') : tr('tenant.egress')), { kind: 'success' });
                        resetForm();
                        loadRules();
                      } catch (e) {
                        shell.showToast(tr('tenant.40f902') + (e.message || e), { kind: 'error' });
                      }
                    };
                    if (isDangerForm(state.form.proto, state.form.addr, ports)) {
                      shell.openConfirm({
                        title: tr('tenant.risk.confirmTitle'),
                        body: <div style={{ lineHeight: 1.6 }}>
                          {tr('tenant.risk.confirmBody')}
                          <b>{PROTOCOLS.find(p => p.id === state.form.proto)?.label || state.form.proto}</b> · {addrLabel}:<span className="mono">{state.form.addr}</span>
                          {ports && <> {tr('tenant.03cfd0')}<span className="mono">{ports}</span></>}
                        </div>,
                        danger: true, confirmLabel: tr('tenant.risk.confirmBtn'),
                        onConfirm: doSave,
                      });
                    } else {
                      await doSave();
                    }
                  }}
                >{tr('tenant.be5fbb')}</Button>
              </div>
            </div>
          )}

          {/* ── 规则表格 ────────────────────────────────── */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflowY: 'auto',
            maxHeight: 380,
            background: 'var(--bg-1)',
          }}>
            {state.loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                <style>{'@keyframes ociSpin{to{transform:rotate(360deg)}}'}</style>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'ociSpin 0.8s linear infinite' }} />
                </div>
                加载中…
              </div>
            ) : currentRules.length === 0 ? (
              /* 空状态 */
              <div style={{
                padding: '48px 20px',
                textAlign: 'center',
              }}>
                <Icon name="shield-off" size={36} style={{ color: 'var(--fg-3)', marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4 }}>
                  {tr('tenant.f61f4c')}{state.tab === 'ingress' ? tr('tenant.0768a8') : tr('tenant.5148cf')}{tr('tenant.b0fae0')}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  fontSize: 11.5, color: state.tab === 'ingress' ? 'var(--danger)' : 'var(--orange)',
                  marginBottom: 20,
                }}>
                  <Icon name="alert-triangle" size={11} />
                  {state.tab === 'ingress' ? tr('tenant.72dc77') : tr('tenant.027ade')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <Button size="sm" variant="primary" icon="plus"
                    onClick={() => { state.formMode = 'add'; render(); }}
                  >{tr('tenant.63edd6')}</Button>
                  <Button size="sm" variant="outline" icon="wand-2"
                    onClick={() => { state.formMode = 'template'; render(); }}
                  >{tr('tenant.53acf1')}</Button>
                </div>
              </div>
            ) : (
              <table style={{
                width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12,
              }}>
                <thead>
                  <tr>
                    {[
                      { h: 'id', w: 44 },
                      { h: tr('tenant.365825'), w: 76 },
                      { h: tr('tenant.faa1ad'), w: 100 },
                      { h: addrLabel },
                      { h: tr('tenant.75384b'), w: 130 },
                      { h: tr('tenant.57846f'), w: 70, align: 'center' },
                      { h: tr('tenant.2b6bc0'), w: 190, align: 'center' },
                    ].map((c, i) => (
                      <th key={i} style={{
                        textAlign: c.align || 'center', padding: '10px 12px', width: c.w,
                        background: 'var(--bg-2)', color: 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid var(--border)',
                        position: 'sticky', top: 0, zIndex: 1,
                      }}>{c.h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentRules.map((r, i) => {
                    const risk = riskLevel(r);
                    const cfg = riskCfg[risk];
                    const proto = PROTOCOLS.find(p => p.id === r.proto) || PROTOCOLS[0];
                    return (
                      <tr key={r.id} style={{
                        background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                      }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-2)', borderBottom: '1px solid var(--border)' }}>
                          <span className="num">{r.id}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '1px 8px',
                            background: state.tab === 'ingress' ? 'var(--info-soft)' : 'var(--orange-soft)',
                            color: state.tab === 'ingress' ? 'var(--info)' : 'var(--orange)',
                            borderRadius: 3, fontSize: 11, fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}>
                            <Icon name={state.tab === 'ingress' ? 'arrow-down-to-line' : 'arrow-up-from-line'} size={10} />
                            {state.tab === 'ingress' ? tr('tenant.0768a8') : tr('tenant.5148cf')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span className="mono" style={{ fontSize: 11, color: proto.color, fontWeight: 600 }}>{proto.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{r.addr}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          {r.ports
                            ? <span className="mono" style={{
                                padding: '1px 6px',
                                background: 'var(--cyan-soft)', color: 'var(--cyan)',
                                borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                              }}>{r.ports}</span>
                            : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>全部</span>
                          }
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <span title={risk === 'critical' ? tr('tenant.062244') : risk === 'high' ? tr('tenant.e4b0df') : risk === 'medium' ? tr('tenant.7230f2') : tr('tenant.9b772f')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '1px 7px',
                            background: cfg.bg, color: cfg.color,
                            borderRadius: 3, fontSize: 10.5, fontWeight: 600,
                            cursor: 'help',
                            whiteSpace: 'nowrap',
                          }}>
                            {(risk === 'critical' || risk === 'high') && <Icon name="alert-triangle" size={10} />}
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <Button size="sm" variant="secondary" onClick={() => {
                              const sp = strToPorts(r.ports);
                              state.form = { proto: r.proto, addr: r.addr, portStart: sp.start, portEnd: sp.end };
                              state.editingId = r.id;
                              state.formMode = 'edit';
                              render();
                            }}>编辑</Button>
                            <Button size="sm" variant="secondary" onClick={() => {
                              const sp = strToPorts(r.ports);
                              const payload = { tenantId: getTenantDbId(tenant), type: apiType(), protocol: r.proto, source: r.addr, ports: r.ports || null };
                              const doCopy = () => {
                                persistRule(payload).then(resp => {
                                  warnIfBackendRisk(resp);
                                  shell.showToast(tr('tenant.0f1c3d'), { kind: 'success' });
                                  loadRules();
                                }).catch(e => shell.showToast(tr('tenant.abdfe2') + (e.message || e), { kind: 'error' }));
                              };
                              if (isDangerForm(r.proto, r.addr, r.ports)) {
                                shell.openConfirm({
                                  title: tr('tenant.risk.confirmTitle'),
                                  body: <div style={{ lineHeight: 1.6 }}>
                                    {tr('tenant.risk.confirmBody')}
                                    <b>{PROTOCOLS.find(p => p.id === r.proto)?.label || r.proto}</b> · {addrLabel}:<span className="mono">{r.addr}</span>
                                    {r.ports && <> {tr('tenant.03cfd0')}<span className="mono">{r.ports}</span></>}
                                  </div>,
                                  danger: true, confirmLabel: tr('tenant.risk.confirmBtn'),
                                  onConfirm: doCopy,
                                });
                              } else {
                                doCopy();
                              }
                            }}>复制</Button>
                            <Button size="sm" variant="danger" onClick={() => {
                              shell.openConfirm({
                                title: tr('tenant.0d4c41').replace('{0}',r.id || '?'),
                                body: <div>{tr('tenant.6217c8')}<b>{PROTOCOLS.find(p => p.id === r.proto)?.label || r.proto}</b> · {addrLabel}:<span className="mono">{r.addr}</span>{r.ports && <> {tr('tenant.03cfd0')}<span className="mono">{r.ports}</span></>}</div>,
                                danger: true, confirmLabel: tr('tenant.2f4aad'),
                                onConfirm: async () => {
                                  if (!r.id) { shell.showToast(tr('tenant.2be61d'), { kind: 'warn' }); return; }
                                  try {
                                    await deleteRule(r.id);
                                    shell.showToast(tr('tenant.d9984b').replace('{0}',r.id), { kind: 'warn' });
                                    loadRules();
                                  } catch (e) {
                                    shell.showToast(tr('tenant.ad23f0') + (e.message || e), { kind: 'error' });
                                  }
                                },
                              });
                            }}>删除</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>
          <Button variant="primary" size="md" icon="refresh-cw" onClick={() => loadRules()}>{tr('tenant.9fa8cc')}</Button>
        </>
      ),
    });
  };
  render();
  loadRules();
}

// ─── OCI 实例管理 modal (对齐原项目 "资源列表" 截图) ────────────
function showResourceModal(shell, tenant, row) {
  const state = {
    tenantSel: tenantLabel(tenant).replace(/\*/g, ''),
    regionSel: row.region,
    page: 1,
    perPage: 10,
    masked: true,
    instances: [],
    loading: true,
  };

  const regionLabel = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  // 真实后端 /oci/list/json → InstanceDetailsRes → 表格字段
  const normInstance = (r) => ({
    id: r.id,
    tenantName: r.tenancyName || r.userName,
    region: r.regionEn || getTenantRegion(tenant) || row.region,
    name: r.displayName,
    status: r.state,
    ocpu: r.ocpus,
    memory: r.memoryInGBs,
    arch: /^.*(A1|ARM)/i.test(r.shape || '') ? 'ARM' : 'AMD',
    disk: r.bootVolumeSizeInGBs,
    vpu: r.vpusPerGB,
    ip: r.publicIps || r.privateIps,
    ipv6: r.ipv6Addresses ? 'enabled' : 'disabled',
    createdAt: r.timeCreated || r.createTime,
  });

  const loadInstances = async () => {
    state.loading = true; render();
    try {
      const pageData = await window.ociApi.getPage('/oci/list/json', { page: 0, size: 500, tenantId: getTenantDbId(tenant) });
      state.instances = (pageData && Array.isArray(pageData.content) ? pageData.content : []).map(normInstance);
    } catch (e) {
      state.instances = [];
    }
    state.loading = false; render();
  };

  const render = () => {
    const filtered = state.instances;
    const paged = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));

    shell.openModal({
      title: tr('tenant.73b3dc'),
      subtitle: tr('tenant.6cf44c').replace('{0}',getTenantName(tenant)).replace('{1}',filtered.length),
      icon: 'cloud',
      iconColor: 'var(--cyan)',
      size: 'xl',
      body: (
        <div style={{ padding: 20 }}>
          {/* ─── 顶部筛选栏 ─── */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tr('tenant.708c9d')}</span>
            <CustomDropdown
              value={state.tenantSel}
              onChange={e => { state.tenantSel = e; render(); }} height={32} width="100%">
              <option>{tenantLabel(tenant).replace(/\*/g, '')}</option>
            </CustomDropdown>
            <CustomDropdown
              value={state.regionSel}
              onChange={e => { state.regionSel = e; render(); }} height={32} width="100%">
              <option value={row.region}>{regionLabel(row.region)}</option>
            </CustomDropdown>
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="primary" icon="search"
              onClick={() => { loadInstances(); }}
            >{tr('tenant.345c52')}</Button>
            <Button size="sm" variant="ghost" icon="x"
              onClick={() => { state.page = 1; render(); }}
            >{tr('tenant.4b9c32')}</Button>
            <Button size="sm" variant="outline" icon="download"
              onClick={() => shell.showToast(tr('tenant.39c2d4').replace('{0}',filtered.length), { kind: 'success' })}
            >{tr('tenant.58b7bd')}</Button>
            <Button size="sm" variant="ghost" icon="arrow-left"
              onClick={shell.closeModal}
            >{tr('tenant.5f4112')}</Button>
          </div>

          {/* ─── 表格 ─── */}
          <div style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflowY: 'auto',
            maxHeight: 420,
          }}>
            <table style={{
              width: '100%', borderCollapse: 'separate', borderSpacing: 0,
              fontSize: 12,
            }}>
              <thead>
                <tr>
                  {[
                    { h: '#', w: 40 },
                    { h: <span>{tr('tenant.c46779')} <Icon name={state.masked ? 'eye-off' : 'eye'} size={10} style={{ marginLeft: 4, verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => { state.masked = !state.masked; render(); }} /></span>, w: 110 },
                    { h: tr('tenant.536469'), w: 100 },
                    { h: tr('tenant.352de2') },
                    { h: 'CPU/MEM', w: 90 },
                    { h: tr('tenant.0eaa6a'), w: 70 },
                    { h: tr('tenant.f71082'), w: 100 },
                    { h: tr('tenant.02b29e'), w: 140 },
                    { h: 'IPV6', w: 80 },
                    { h: tr('tenant.eca37c'), w: 110 },
                    { h: tr('tenant.2b6bc0'), w: 70, align: 'center' },
                  ].map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'center',
                      padding: '10px 12px',
                      width: c.w,
                      background: 'var(--bg-2)',
                      color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('tenant.26b5bd')}</td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                      {tr('tenant.b48ea0')}
                    </td>
                  </tr>
                ) : paged.map((inst, i) => (
                  <tr key={inst.id} style={{
                    background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                  }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}>
                      <span className="num">{(state.page - 1) * state.perPage + i + 1}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }} title={inst.tenantName || ''}>
                      <span title={inst.tenantName || ''} className="mono" style={{
                        padding: '2px 6px', background: 'var(--bg-3)',
                        borderRadius: 3, fontSize: 11, color: 'var(--fg-1)',
                        cursor: 'pointer',
                      }}>{state.masked ? window.maskName(inst.tenantName) : (inst.tenantName || '')}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-0)', borderBottom: '1px solid var(--border)' }}>
                      {regionLabel(inst.region)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot status={inst.status} size={5} pulse={inst.status === 'running'} />
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>{inst.name || inst.id}</span>
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                      {inst.ocpu != null ? inst.ocpu : '-'}C{inst.memory != null ? inst.memory : '-'}G
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        padding: '1px 6px',
                        background: 'var(--info-soft)', color: 'var(--info)',
                        borderRadius: 3, fontSize: 10, fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}>{inst.arch || 'AMD'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                      {inst.disk != null ? inst.disk : '-'}GB/{inst.vpu != null ? inst.vpu : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)' }} className="mono">
                      {inst.ip || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      {inst.ipv6 === 'enabled'
                        ? <span style={{
                            padding: '1px 6px', background: 'var(--accent-soft)', color: 'var(--accent)',
                            borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                          }}>{tr('tenant.53ace4')}</span>
                        : <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{tr('tenant.463776')}</span>
                      }
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{inst.createdAt || '-'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => shell.showToast(tr('tenant.6bb206').replace('{0}',inst.name || inst.id), { kind: 'info' })}
                        style={{
                          width: 28, height: 28, borderRadius: 4,
                          background: 'var(--accent)',
                          border: 'none',
                          color: 'var(--accent-fg)',
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title={tr('tenant.2b6bc0')}
                      >
                        <Icon name="more-horizontal" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分页栏 */}
            <div style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 11.5, color: 'var(--fg-2)',
              flexWrap: 'wrap',
            }}>
              <span>{tr('tenant.7cf1f5')}</span>
              <CustomDropdown
                value={state.perPage}
                onChange={e => { state.perPage = +e; state.page = 1; render(); }} height={32} width="100%">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </CustomDropdown>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                disabled={state.page <= 1}
                onClick={() => { state.page--; render(); }}
                style={{
                  padding: '4px 10px', background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: state.page <= 1 ? 'var(--fg-3)' : 'var(--fg-1)',
                  cursor: state.page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                }}
              >{tr('tenant.5ad8a1')}</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { state.page = p; render(); }}
                  style={{
                    minWidth: 28, padding: '4px 8px',
                    background: state.page === p ? 'var(--accent)' : 'var(--bg-2)',
                    color: state.page === p ? 'var(--accent-fg)' : 'var(--fg-1)',
                    border: '1px solid ' + (state.page === p ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 4,
                    cursor: 'pointer', fontSize: 11, fontWeight: state.page === p ? 600 : 400,
                    fontFamily: 'var(--font-mono)',
                  }}
                >{p}</button>
              ))}
              <button
                type="button"
                disabled={state.page >= totalPages}
                onClick={() => { state.page++; render(); }}
                style={{
                  padding: '4px 10px', background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: state.page >= totalPages ? 'var(--fg-3)' : 'var(--fg-1)',
                  cursor: state.page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                }}
              >{tr('tenant.62f533')}</button>
              <div style={{ flex: 1 }} />
              <span>{tr('tenant.abce65')}</span>
              <input
                type="number" min={1} max={totalPages} defaultValue={state.page}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const n = +e.target.value;
                    if (n >= 1 && n <= totalPages) { state.page = n; render(); }
                  }
                }}
                style={{
                  width: 46, padding: '3px 6px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--fg-0)',
                  fontFamily: 'var(--font-mono)', fontSize: 11.5, textAlign: 'center',
                }}
              />
              <span>{tr('tenant.5fccd0')}</span>
              <span>{tr('tenant.fbd2b1')} <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> {tr('tenant.b576e1')} <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 600 }}>{state.page}</span> / {totalPages} {tr('tenant.5fccd0')}</span>
            </div>
          </div>
        </div>
      ),
    });
  };
  render();
  loadInstances();
}
function showMysqlModal(shell, tenant, row) {
  // ═══════════════════════════════════════════════════════════════════════
  // 数据库管理 (MySQL HeatWave) · 对齐原项目 doubleDimple/oci-start
  // ═══════════════════════════════════════════════════════════════════════
  // 布局:单面板表格
  //   · 顶部: + 创建 MySQL  |  ⟳ 从云同步  → 右侧关闭
  //   · 表格:名称(点击复制 OCID)/版本/状态/公网·端口/账密(可切换显隐)/规格/存储(GB)/操作(⋯)
  //   · 行内 ⋯ 菜单(复用 <RowActionMenu>):同步此实例 / 绑定公网IP / 重置账密 / 终止实例(红)
  //   · 空态:暂无数据;加载态:loader

  const state = {
    instances: [],
    loading: true,
    revealing: null,        // 正在显示密码的行 id
    openMenu: null,         // { rowId, anchorEl }
  };

  const unwrap = payload => payload && payload.data !== undefined ? payload.data : payload;

  const load = async () => {
    state.loading = true; render();
    try {
      const r = await window.ociApi.request('/tenants/mysql-info?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
      const list = (r && r.success && Array.isArray(r.data)) ? r.data : (Array.isArray(r) ? r : []);
      state.instances = list;
      state.revealing = null;
    } catch (e) {
      state.instances = [];
    }
    state.loading = false; render();
  };

  const tenantId = getTenantDbId(tenant);

  // 行内操作:同步此实例
  const syncSingle = async (inst) => {
    try {
      await window.ociApi.request('/tenants/sync-single-mysql?id=' + encodeURIComponent(inst.id));
      shell.showToast(tr('td.mysql.toast.sync'), { kind: 'success' });
      load();
    } catch (e) {
      shell.showToast(tr('td.mysql.toast.err') + (e.message || e), { kind: 'error' });
    }
  };

  // 行内操作:绑定公网 IP
  const bindPublicIp = (inst) => {
    shell.openConfirm({
      title: tr('td.mysql.confirm.bindIp'),
      body: <div>{tr('td.mysql.confirm.bindIpBody').replace('{0}', inst.displayName || inst.dbName || '?')}</div>,
      confirmLabel: tr('td.mysql.confirm'),
      onConfirm: async () => {
        try {
          await window.ociApi.request('/tenants/bind-public-ip?id=' + encodeURIComponent(inst.id));
          shell.showToast(tr('td.mysql.toast.bindIp'), { kind: 'success' });
          load();
        } catch (e) {
          shell.showToast(tr('td.mysql.toast.err') + (e.message || e), { kind: 'error' });
        }
      },
    });
  };

  // 行内操作:重置账密
  const resetAuth = (inst) => {
    shell.openConfirm({
      title: tr('td.mysql.confirm.resetAuth'),
      body: <div style={{ lineHeight: 1.6 }}>{tr('td.mysql.confirm.resetAuthBody')}<b>{inst.displayName || inst.dbName || '?'}</b></div>,
      confirmLabel: tr('td.mysql.confirm'),
      onConfirm: async () => {
        try {
          await window.ociApi.request('/tenants/mysql-reset-auth?id=' + encodeURIComponent(inst.id) + '&tenantId=' + encodeURIComponent(tenantId));
          shell.showToast(tr('td.mysql.toast.resetAuth'), { kind: 'success' });
          load();
        } catch (e) {
          shell.showToast(tr('td.mysql.toast.err') + (e.message || e), { kind: 'error' });
        }
      },
    });
  };

  // 行内操作:终止实例(删除)
  const terminate = (inst) => {
    shell.openConfirm({
      title: tr('td.mysql.confirm.delete'),
      body: <div style={{ lineHeight: 1.6 }}>{tr('td.mysql.confirm.deleteBody')}<b>{inst.displayName || inst.dbName || '?'}</b></div>,
      danger: true,
      confirmLabel: tr('td.mysql.confirm.delete'),
      onConfirm: async () => {
        try {
          await window.ociApi.request('/tenants/mysql-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, id: String(inst.id), action: 'delete' }),
          });
          shell.showToast(tr('td.mysql.toast.delete'), { kind: 'warn' });
          load();
        } catch (e) {
          shell.showToast(tr('td.mysql.toast.err') + (e.message || e), { kind: 'error' });
        }
      },
    });
  };

  // 创建 MySQL · 对齐原项目:确认 → loading 弹窗 → 成功/失败结果弹窗
  const doCreate = () => {
    shell.openConfirm({
      title: tr('td.mysql.confirm.create'),
      body: <div style={{ lineHeight: 1.6 }}>{tr('td.mysql.confirm.createBody')}<b>{getTenantName(tenant)}</b></div>,
      confirmLabel: tr('td.mysql.confirm'),
      onConfirm: async () => {
        // step1: 先展示阻塞式 loading 弹窗（旋转 loader）
        shell.openModal({
          title: tr('td.mysql.loadingCreate'),
          icon: 'loader',
          iconColor: 'var(--accent)',
          size: 'sm',
          onClose: () => {},   // 创建过程中不响应关闭；接口结束后会覆盖为结果弹窗
          body: (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <Icon name="loader" size={28} style={{ color: 'var(--accent)', animation: 'button-spin 800ms linear infinite' }} />
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-2)' }}>{tr('td.mysql.loadingCreateBody')}</div>
            </div>
          ),
        });
        try {
          const r = await window.ociApi.request('/tenants/mysql-create?tenantId=' + encodeURIComponent(tenantId), { method: 'POST' });
          const ok = r && (r.success || r.code === 200);
          const msg = (r && r.message) || tr('td.mysql.toast.create');
          // step2: 覆盖为成功/失败结果弹窗
          shell.openModal({
            title: ok ? tr('td.mysql.result.success') : tr('td.mysql.result.fail'),
            icon: ok ? 'check-circle' : 'alert-triangle',
            iconColor: ok ? 'var(--accent)' : 'var(--danger)',
            size: 'md',
            body: (
              <div style={{ padding: '20px 22px 6px', fontSize: 12.5, color: 'var(--fg-1)', lineHeight: 1.7 }}>{ok ? tr('td.mysql.result.createBody') : msg}</div>
            ),
            footer: (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant={ok ? 'primary' : 'danger'} size="md" onClick={shell.closeModal}>{tr('td.mysql.confirm')}</Button>
              </div>
            ),
          });
          if (ok) load();
        } catch (e) {
          const msg = tr('td.mysql.toast.err') + (e.message || e);
          shell.openModal({
            title: tr('td.mysql.result.fail'),
            icon: 'alert-triangle',
            iconColor: 'var(--danger)',
            size: 'md',
            body: (
              <div style={{ padding: '20px 22px 6px' }}>
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--danger-soft)',
                  border: '1px solid color-mix(in oklab, var(--danger) 40%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.7,
                }}>{msg}</div>
              </div>
            ),
            footer: (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant="danger" size="md" onClick={shell.closeModal}>{tr('td.mysql.confirm')}</Button>
              </div>
            ),
          });
        }
      },
    });
  };

  // 行内菜单项
  const menuItemsFor = (inst) => [
    { id: 'sync',    label: tr('td.mysql.menu.sync'),    icon: 'sync',      color: 'var(--info)' },
    { id: 'bindIp',  label: tr('td.mysql.menu.bindIp'),  icon: 'globe',     color: 'var(--cyan)' },
    { id: 'reset',   label: tr('td.mysql.menu.reset'),   icon: 'key-round', color: 'var(--orange)' },
    { id: 'delete',  label: tr('td.mysql.menu.delete'),  icon: 'trash-2',   color: 'var(--danger)' },
  ];

  const copyOcid = (inst) => {
    if (!inst.dbId) return;
    navigator.clipboard.writeText(inst.dbId).then(() => {
      shell.showToast(tr('td.mysql.toast.copy'), { kind: 'success' });
    }).catch(() => shell.showToast(tr('td.mysql.toast.err'), { kind: 'error' }));
  };

  const render = () => {
    const cols = [
      { h: tr('td.mysql.col.name'),    w: 150 },
      { h: tr('td.mysql.col.version'), w: 80 },
      { h: tr('td.mysql.col.status'),  w: 90 },
      { h: tr('td.mysql.col.public'),  w: 150 },
      { h: tr('td.mysql.col.cred'),    w: 200 },
      { h: tr('td.mysql.col.shape'),   w: 120 },
      { h: tr('td.mysql.col.storage'), w: 80, align: 'center' },
      { h: tr('td.mysql.col.ops'),     w: 56, align: 'center' },
    ];

    shell.openModal({
      title: tr('td.mysql.title').replace('{0}', getTenantName(tenant)),
      subtitle: <span><span className="mono">{getTenantName(tenant)}</span> · {row.region} · <span style={{ color: 'var(--fg-2)' }}>{state.instances.length} {tr('td.mysql.subtitle.count')}</span></span>,
      icon: 'database',
      iconColor: 'var(--info)',
      size: 'xl',
      body: (
        <div style={{ padding: 18 }}>
          {/* ── 顶部操作栏 ─────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <Button size="sm" variant="primary" icon="plus" onClick={doCreate}>{tr('td.mysql.create')}</Button>
            <Button size="sm" variant="outline" icon="refresh-cw" onClick={async () => {
              try {
                const r = await window.ociApi.request('/tenants/sync-mysql?tenantId=' + encodeURIComponent(tenantId), { method: 'POST' });
                const msg = (r && r.message) || tr('td.mysql.toast.syncAll');
                shell.showToast(msg, { kind: 'success' });
                load();
              } catch (e) {
                shell.showToast(tr('td.mysql.toast.err') + (e.message || e), { kind: 'error' });
              }
            }}>{tr('td.mysql.sync')}</Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="ghost" icon="refresh-cw" onClick={load}>{tr('td.mysql.refresh')}</Button>
          </div>

          {/* ── 表格（表头恒定 + 数据区独立加载/空态）────── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowY: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <th key={i} style={{
                      textAlign: c.align || 'center', padding: '10px 12px', width: c.w,
                      background: 'var(--bg-2)', color: 'var(--fg-3)',
                      fontSize: 10.5, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading ? (
                  <tr>
                    <td colSpan={cols.length} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11.5 }}>
                      <Icon name="loader" size={24} style={{ color: 'var(--info)', marginBottom: 8, animation: 'button-spin 800ms linear infinite' }} />
                      <div>{tr('td.mysql.loading')}</div>
                    </td>
                  </tr>
                ) : state.instances.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                      <Icon name="database" size={28} style={{ color: 'var(--bg-3)', marginBottom: 8 }} />
                      <div>{tr('td.mysql.empty')}</div>
                    </td>
                  </tr>
                ) : state.instances.map((inst, i) => {
                  const revealed = state.revealing === inst.id;
                  const name = inst.displayName || inst.dbName || tr('td.mysql.unnamed');
                  const isOpen = state.openMenu?.rowId === inst.id;
                  return (
                    <tr key={inst.id} style={{
                      background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                    }}>
                      {/* 名称 · 点击复制 OCID */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <strong
                          title={inst.dbId ? tr('td.mysql.copyOcid') : ''}
                          onClick={() => copyOcid(inst)}
                          style={{ cursor: inst.dbId ? 'pointer' : 'default', color: 'var(--info)' }}
                        >{name}</strong>
                      </td>
                      {/* 版本 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{inst.dbVersion || '-'}</span>
                      </td>
                      {/* 状态 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '1px 8px', borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                          background: inst.dbStatus === 'ACTIVE' ? 'var(--accent-soft)' : 'var(--bg-3)',
                          color: inst.dbStatus === 'ACTIVE' ? 'var(--accent)' : 'var(--fg-2)',
                          whiteSpace: 'nowrap',
                        }}>{inst.dbStatus || '-'}</span>
                      </td>
                      {/* 公网/端口 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11, color: inst.dbPublicUrl ? 'var(--info)' : 'var(--fg-3)' }}>
                          {inst.dbPublicUrl || tr('td.mysql.noPublic')} : {inst.dbPort || '3306'}
                        </span>
                      </td>
                      {/* 账密 · 可切换显隐 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{inst.dbName || tr('td.mysql.noUser')}</span>
                          <span style={{ color: 'var(--fg-3)' }}>/</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>
                            {revealed ? (inst.dbPassword || tr('td.mysql.noPassword')) : '•••••••'}
                          </span>
                          {inst.dbPassword && (
                            <button
                              type="button"
                              onClick={() => { state.revealing = revealed ? null : inst.id; render(); }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                              title={revealed ? tr('td.mysql.hide') : tr('td.mysql.show')}
                            >
                              <Icon name={revealed ? 'eye-off' : 'eye'} size={12} />
                            </button>
                          )}
                        </span>
                      </td>
                      {/* 规格 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--fg-1)' }}>{inst.shapeName || '-'}</span>
                      </td>
                      {/* 存储 GB */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span className="num" style={{ color: 'var(--fg-1)' }}>{inst.dataStorageSizeInGBs != null ? inst.dataStorageSizeInGBs : '-'}</span>
                      </td>
                      {/* 操作 ⋯ */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (isOpen) { state.openMenu = null; render(); return; }
                            state.openMenu = { rowId: inst.id, anchorEl: e.currentTarget };
                            render();
                          }}
                          style={{
                            width: 28, height: 28, borderRadius: 4,
                            background: isOpen ? 'var(--accent)' : 'var(--bg-2)',
                            border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--border)'),
                            color: isOpen ? 'var(--accent-fg)' : 'var(--fg-1)',
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          title={tr('td.mysql.col.ops')}
                        >
                          <Icon name="more-horizontal" size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── 行操作 · 复用统一的 <RowActionMenu>(portal 到 body,不被弹窗裁剪) ─────── */}
          {state.openMenu && (() => {
            const inst = state.instances.find(x => x.id === state.openMenu.rowId);
            if (!inst) return null;
            return (
              <RowActionMenu
                anchorEl={state.openMenu.anchorEl}
                width={220}
                columns={1}
                header={
                  <>
                    <Icon name="database" size={11} style={{ color: 'var(--info)' }} />
                    <span style={{ color: 'var(--fg-0)' }}>{inst.displayName || inst.dbName || tr('td.mysql.unnamed')}</span>
                  </>
                }
                items={menuItemsFor(inst)}
                onClose={() => { state.openMenu = null; render(); }}
                onAction={(id) => {
                  const it = inst;
                  state.openMenu = null;
                  if (id === 'sync') syncSingle(it);
                  else if (id === 'bindIp') bindPublicIp(it);
                  else if (id === 'reset') resetAuth(it);
                  else if (id === 'delete') terminate(it);
                }}
              />
            );
          })()}
        </div>
      ),
      footer: (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
        </div>
      ),
    });
  };

  render();
  load();
}
function showStorageModal(shell, tenant, row) {
  // ═══════════════════════════════════════════════════════════════════════
  // 存储实例 (OCI Object Storage) · 对齐原项目 doubleDimple/oci-start
  // ═══════════════════════════════════════════════════════════════════════
  // 布局:双面板
  //   · 左侧:存储桶列表(顶部搜索 + [+ 创建存储桶] · 支持选中)
  //   · 右侧:对象列表(顶部 [上传文件] + [刷新] · 4 列表格)
  //   · 空态左侧:选中租户前显示"暂无存储桶"
  //   · 空态右侧:未选桶前显示"请选择左侧存储桶"

  const state = {
    buckets: [],               // 真实存储桶 BucketVO[]
    activeBucket: null,        // 选中的 bucket name(null = 未选)
    bucketSearch: '',
    objects: {},               // { bucketName: ObjectVO[] }
    objectSearch: '',
    loadingBuckets: false,
    loadingObjects: false,
    errorBuckets: '',
    errorObjects: '',
    namespace: '',             // 真实命名空间
  };

  const normBucket = (b) => ({
    name: b.name,
    namespace: b.namespace || state.namespace,
    access: b.publicAccess || 'NoPublicAccess',
    created: b.timeCreated || '',
    // BucketVO 不提供对象数量/容量,列表展示创建时间
    objects: null,
    size: null,
  });

  const normObject = (o) => ({
    name: o.name,
    size: o.size,                  // bytes (Number|null)
    modified: o.timeModified || '',
  });

  const formatSize = (bytes) => {
    if (bytes == null) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B','KB','MB','GB','TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  };

  const formatDate = (str) => {
    if (!str) return '';
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return str; }
  };

  const loadBuckets = async () => {
    state.loadingBuckets = true; state.errorBuckets = '';
    renderList();
    try {
      const r = await window.ociApi.request('/oci/storage/buckets?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) + '&limit=100');
      if (!(r && r.success)) { state.errorBuckets = (r && r.message) || tr('tenant.5e7c71'); }
      const items = (r && r.data && Array.isArray(r.data.items)) ? r.data.items : [];
      state.buckets = items.map(normBucket);
    } catch (e) {
      state.buckets = [];
      state.errorBuckets = (e && e.message) || tr('tenant.5e7c71');
    }
    state.loadingBuckets = false;
    renderList();
  };

  const ensureNamespace = async () => {
    if (state.namespace) return state.namespace;
    try {
      const r = await window.ociApi.request('/oci/storage/namespace?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
      if (r && r.success && r.data && r.data.namespace) state.namespace = r.data.namespace;
    } catch (e) { /* 忽略,后续请求会带上真实 bucket.namespace */ }
    return state.namespace;
  };

  const loadObjects = async (bucketName, ns) => {
    if (!bucketName) return;
    state.loadingObjects = true; state.errorObjects = '';
    renderList();
    try {
      const r = await window.ociApi.request('/oci/storage/objects?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) +
        '&namespace=' + encodeURIComponent(ns || state.namespace) +
        '&bucketName=' + encodeURIComponent(bucketName) + '&limit=100');
      if (!(r && r.success)) { state.errorObjects = (r && r.message) || tr('tenant.d18216'); }
      const items = (r && r.data && Array.isArray(r.data.items)) ? r.data.items : [];
      state.objects[bucketName] = items.map(normObject);
    } catch (e) {
      state.objects[bucketName] = state.objects[bucketName] || [];
      state.errorObjects = (e && e.message) || tr('tenant.d18216');
    }
    state.loadingObjects = false;
    renderList();
  };

  // 文件类型 → icon + color
  const objTypeInfo = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return { icon: 'image',       color: 'var(--cyan)',   preview: true };
    if (['mp4','mov','webm','mkv','avi'].includes(ext))                return { icon: 'video',       color: 'var(--violet)', preview: true };
    if (['pdf'].includes(ext))                                          return { icon: 'file-text',   color: 'var(--danger)', preview: true };
    if (['json','yaml','yml','toml','xml','html'].includes(ext))       return { icon: 'file-code',   color: 'var(--info)',   preview: true };
    if (['js','ts','jsx','tsx','py','go','rs','java'].includes(ext))   return { icon: 'file-code',   color: 'var(--orange)', preview: true };
    if (['zip','tar','gz','bz2','7z','rar'].includes(ext))             return { icon: 'archive',     color: 'var(--fg-2)',   preview: false };
    if (['log','txt','md'].includes(ext))                              return { icon: 'file-text',   color: 'var(--fg-1)',   preview: true };
    if (['xlsx','xls','csv'].includes(ext))                            return { icon: 'sheet',       color: 'var(--accent)', preview: false };
    return { icon: 'file', color: 'var(--fg-2)', preview: false };
  };

  const accessCfg = {
    NoPublicAccess:       { label: tr('tenant.3dc518'),         color: 'var(--fg-2)',   bg: 'var(--bg-3)',      icon: 'lock' },
    ObjectRead:           { label: tr('tenant.968d75'),       color: 'var(--info)',   bg: 'var(--info-soft)', icon: 'globe' },
    ObjectReadWithoutList:{ label: tr('tenant.c9dcf9'), color: 'var(--orange)', bg: 'var(--orange-soft)', icon: 'eye-off' },
  };

  // 二级 modal:创建存储桶
  const openCreateBucket = () => {
    const form = { name: '', access: 'NoPublicAccess' };
    const renderCreate = () => {
      shell.openModal({
        title: tr('tenant.c42eb9'),
        subtitle: <span><span className="mono">{tenantLabel(tenant)}</span> · Namespace <span className="mono" style={{ color: 'var(--fg-2)' }}>{state.namespace || tr('tenant.4a8d5c')}</span></span>,
        icon: 'plus-circle',
        iconColor: 'var(--accent)',
        size: 'md',
        body: (
          <div style={{ padding: 20 }}>
            <FormRow label={tr('tenant.93577f')} required>
              <TextInput
                value={form.name}
                onChange={v => { form.name = v.replace(/[^a-zA-Z0-9._-]/g, ''); renderCreate(); }}
                placeholder={tr('tenant.e95f69')}
                mono
              />
            </FormRow>
            <FormRow label={tr('tenant.2ab655')}>
              <CustomDropdown
                value={form.access}
                onChange={e => { form.access = e; renderCreate(); }} height={32} width="100%">
                <option value="NoPublicAccess">{tr('tenant.77fbfa')}</option>
                <option value="ObjectRead">{tr('tenant.022b45')}</option>
                <option value="ObjectReadWithoutList">{tr('tenant.364d4b')}</option>
              </CustomDropdown>
            </FormRow>

            {/* 访问类型说明 */}
            <div style={{
              padding: '10px 12px',
              background: form.access === 'NoPublicAccess' ? 'var(--bg-2)' :
                          form.access === 'ObjectRead' ? 'var(--info-soft)' : 'var(--orange-soft)',
              border: '1px solid ' + (form.access === 'NoPublicAccess' ? 'var(--border)' :
                                      form.access === 'ObjectRead' ? 'var(--info)' : 'var(--orange)'),
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5,
              color: form.access === 'NoPublicAccess' ? 'var(--fg-2)' :
                     form.access === 'ObjectRead' ? 'var(--info)' : 'var(--orange)',
              marginBottom: 14,
            }}>
              <Icon name={form.access === 'NoPublicAccess' ? 'lock' : 'info'} size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {form.access === 'NoPublicAccess' && tr('tenant.1800a5')}
              {form.access === 'ObjectRead' && tr('tenant.554a83')}
              {form.access === 'ObjectReadWithoutList' && tr('tenant.b81282')}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button size="md" variant="ghost" onClick={renderList}>{tr('tenant.625fb2')}</Button>
              <Button size="md" variant="primary" icon="check" onClick={async () => {
                if (!form.name.trim()) { shell.showToast(tr('tenant.e95f69'), { kind: 'warn' }); return; }
                try {
                  const r = await window.ociApi.request('/oci/storage/bucket/create', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: getTenantDbId(tenant), bucketName: form.name.trim(), publicAccessType: form.access }),
                  });
                  if (!(r && r.success)) { shell.showToast(tr('tenant.b07dd6') + ((r && r.message) || ''), { kind: 'error' }); return; }
                  shell.showToast(tr('tenant.57ba05').replace('{0}',form.name), { kind: 'success' });
                  renderList();
                  loadBuckets();
                } catch (e) {
                  shell.showToast(tr('tenant.b07dd6') + (e.message || e), { kind: 'error' });
                }
              }}>{tr('tenant.d9ac92')}</Button>
            </div>
          </div>
        ),
      });
    };
    renderCreate();
  };

  // 二级 modal:预签名链接
  const openPresignModal = async (bucketName, objName, ns) => {
    try {
      const r = await window.ociApi.request('/oci/storage/object/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: getTenantDbId(tenant), namespace: ns || state.namespace, bucketName, objectName: objName, validitySeconds: 3600 }),
      });
      const url = (r && r.success && r.data && r.data.url) ? r.data.url : '';
      if (!url) { shell.showToast(tr('tenant.7e8dbd') + ((r && r.message) || ''), { kind: 'error' }); return; }
      shell.openModal({
        title: tr('tenant.ff084c'),
        subtitle: <span className="mono">{objName}</span>,
        icon: 'link',
        iconColor: 'var(--info)',
        size: 'md',
        body: (
          <div style={{ padding: 20 }}>
            <div style={{
              padding: '10px 12px',
              background: 'var(--info-soft)',
              border: '1px solid var(--info)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5, color: 'var(--info)',
              marginBottom: 12,
            }}>
              <Icon name="info" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {tr('tenant.0522fe')} <b>{tr('tenant.253269')}</b>{tr('tenant.783747')}
            </div>
            <FormRow label={tr('tenant.bfe68d')} hint={tr('tenant.ac1f49')}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={url}
                  onFocus={e => e.target.select()}
                  style={{
                    flex: 1, padding: '7px 10px',
                    background: 'var(--bg-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 10.5,
                  }}
                />
                <Button size="md" variant="primary" icon="copy" onClick={() => {
                  try {
                    navigator.clipboard.writeText(url);
                    shell.showToast(tr('tenant.2560af'), { kind: 'success' });
                  } catch { shell.showToast(tr('tenant.91ea09'), { kind: 'warn' }); }
                }}>{tr('tenant.79d3ab')}</Button>
              </div>
            </FormRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button size="md" variant="ghost" onClick={renderList}>{tr('tenant.b15d91')}</Button>
            </div>
          </div>
        ),
      });
    } catch (e) {
      shell.showToast(tr('tenant.7e8dbd') + (e.message || e), { kind: 'error' });
    }
  };

  const renderList = () => {
    const filteredBuckets = state.buckets.filter(b =>
      !state.bucketSearch || b.name.toLowerCase().includes(state.bucketSearch.toLowerCase())
    );
    const currentBucket = state.buckets.find(b => b.name === state.activeBucket);
    const currentObjs = currentBucket ? (state.objects[currentBucket.name] || []) : [];
    const filteredObjs = currentObjs.filter(o =>
      !state.objectSearch || o.name.toLowerCase().includes(state.objectSearch.toLowerCase())
    );

    shell.openModal({
      title: tr('tenant.9ff7a2'),
      subtitle: <span><span className="mono">{tenantLabel(tenant)}</span> · Object Storage · <span className="mono">{row.region}</span> · Namespace <span className="mono" style={{ color: 'var(--fg-3)' }}>{state.namespace || '-'}</span></span>,
      icon: 'database',
      iconColor: 'var(--violet)',
      size: 'xl',
      body: (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 12,
          padding: 14,
          height: 480,
        }}>
          {/* ── 左侧:存储桶列表 ────────────────────── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="database" size={12} style={{ color: 'var(--violet)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 600 }}>{tr('tenant.bd5fcf')}</span>
              <span style={{
                padding: '0 6px',
                background: 'var(--bg-3)', color: 'var(--fg-3)',
                borderRadius: 3, fontSize: 10, fontFamily: 'var(--font-mono)',
              }}>{state.buckets.length}</span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={openCreateBucket}
                title={tr('tenant.c42eb9')}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: 'var(--accent)', border: 'none',
                  color: 'var(--accent-fg)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon name="plus" size={12} /></button>
              <button
                type="button"
                onClick={() => { shell.showToast(tr('tenant.74b293'), { kind: 'info' }); renderList(); }}
                title={tr('tenant.694fc5')}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  color: 'var(--fg-1)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon name="refresh-cw" size={11} /></button>
            </div>

            {/* 搜索框 */}
            <div style={{
              padding: 8,
              borderBottom: '1px solid var(--border)',
            }}>
              <input
                type="text"
                value={state.bucketSearch}
                onChange={e => { state.bucketSearch = e.target.value; renderList(); }}
                placeholder={tr('tenant.e45d9b')}
                style={{
                  width: '100%', padding: '5px 8px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--fg-0)',
                  fontSize: 11, fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Bucket 列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
              {filteredBuckets.length === 0 ? (
                <div style={{ padding: '30px 12px', textAlign: 'center' }}>
                  <Icon name="cloud" size={24} style={{ color: 'var(--fg-3)', marginBottom: 6 }} />
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {state.bucketSearch ? tr('tenant.2bb7b2') : (state.loadingBuckets ? tr('tenant.961473') : tr('tenant.175f59'))}
                  </div>
                  {!state.bucketSearch && (
                    <button
                      type="button"
                      onClick={openCreateBucket}
                      style={{
                        marginTop: 10, padding: '5px 12px',
                        background: 'var(--accent)', border: 'none',
                        borderRadius: 4, color: 'var(--accent-fg)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      }}
                    >{tr('tenant.d33d05')}</button>
                  )}
                </div>
              ) : (
                filteredBuckets.map(b => {
                  const isActive = state.activeBucket === b.name;
                  const accessInfo = accessCfg[b.access];
                  return (
                    <div
                      key={b.name}
                      onClick={() => {
                        state.activeBucket = b.name;
                        loadObjects(b.name, b.namespace);
                      }}
                      style={{
                        display: 'block', width: '100%',
                        padding: '8px 10px',
                        margin: '2px 0',
                        background: isActive ? 'var(--violet-soft)' : 'transparent',
                        border: isActive ? '1px solid var(--violet)' : '1px solid transparent',
                        borderRadius: 5,
                        color: isActive ? 'var(--violet)' : 'var(--fg-1)',
                        fontFamily: 'inherit', fontSize: 11.5,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 100ms',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <Icon name="database" size={11} style={{ color: isActive ? 'var(--violet)' : 'var(--fg-2)', flexShrink: 0 }} />
                        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: isActive ? 600 : 500 }}>{b.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--fg-3)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 2,
                          padding: '0 5px',
                          background: accessInfo.bg, color: accessInfo.color,
                          borderRadius: 2, fontSize: 9.5, fontWeight: 500,
                        }}>
                          <Icon name={accessInfo.icon} size={8} />
                          {accessInfo.label}
                        </span>
                        <span className="num">·</span>
                        <span className="num" style={{ color: 'var(--fg-2)' }}>{formatDate(b.created) || '-'}</span>
                        <span style={{ flex: 1 }} />
                        <button
                          type="button"
                          title={tr('tenant.4b9c82')}
                          onClick={async (e) => {
                            e.stopPropagation();
                            shell.openConfirm({
                              title: tr('tenant.650eb0'),
                              body: <div>{tr('tenant.a606a6')} <span className="mono" style={{ color: 'var(--fg-0)' }}>{b.name}</span> {tr('tenant.c0498b')}</div>,
                              danger: true, confirmLabel: tr('tenant.2f4aad'),
                              onConfirm: async () => {
                                try {
                                  const r = await window.ociApi.request('/oci/storage/bucket/delete', {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ tenantId: getTenantDbId(tenant), namespace: b.namespace || state.namespace, bucketName: b.name }),
                                  });
                                  if (!(r && r.success)) { shell.showToast(tr('tenant.99adab') + ((r && r.message) || ''), { kind: 'error' }); return; }
                                  shell.showToast(tr('tenant.777b0d').replace('{0}',b.name), { kind: 'success' });
                                  if (state.activeBucket === b.name) { state.activeBucket = null; state.objects[b.name] = []; }
                                  loadBuckets();
                                } catch (err) {
                                  shell.showToast(tr('tenant.99adab') + (err.message || err), { kind: 'error' });
                                }
                              },
                            });
                          }}
                          style={{
                            width: 18, height: 18, borderRadius: 4,
                            background: 'transparent', border: 'none',
                            color: 'var(--fg-3)', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><Icon name="trash-2" size={10} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── 右侧:对象列表 ─────────────────────── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="folder" size={12} style={{ color: 'var(--cyan)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--fg-0)', fontWeight: 600 }}>{tr('tenant.a7958d')}</span>
              {currentBucket && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>·</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{currentBucket.name}</span>
                  <span style={{
                    padding: '0 6px',
                    background: 'var(--bg-3)', color: 'var(--fg-3)',
                    borderRadius: 3, fontSize: 10, fontFamily: 'var(--font-mono)',
                  }}>{currentObjs.length}</span>
                </>
              )}
              <div style={{ flex: 1 }} />
              {currentBucket && (
                <>
                  <input
                    type="text"
                    value={state.objectSearch}
                    onChange={e => { state.objectSearch = e.target.value; renderList(); }}
                    placeholder={tr('tenant.54d521')}
                    style={{
                      width: 140, padding: '4px 8px',
                      background: 'var(--bg-1)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--fg-0)',
                      fontSize: 11, fontFamily: 'inherit',
                    }}
                  />
                  <Button size="sm" variant="primary" icon="upload-cloud"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.onchange = async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append('tenantId', getTenantDbId(tenant));
                          fd.append('namespace', currentBucket.namespace || state.namespace);
                          fd.append('bucketName', currentBucket.name);
                          fd.append('objectName', file.name);
                          fd.append('file', file);
                          const r = await fetch('/oci/storage/object/upload', {
                            method: 'POST',
                            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                            credentials: 'include',
                            body: fd,
                          });
                          const j = await r.json();
                          if (j && j.success) {
                            shell.showToast(tr('tenant.b48bf0').replace('{0}',currentBucket.name), { kind: 'success' });
                            loadObjects(currentBucket.name, currentBucket.namespace || state.namespace);
                          } else {
                            shell.showToast(tr('tenant.706254') + ((j && j.message) || ''), { kind: 'error' });
                          }
                        } catch (err) {
                          shell.showToast(tr('tenant.706254') + (err.message || err), { kind: 'error' });
                        }
                      };
                      input.click();
                    }}
                  >{tr('tenant.a6fc9e')}</Button>
                  <button
                    type="button"
                    onClick={() => { shell.showToast(tr('tenant.f0af70'), { kind: 'info' }); renderList(); }}
                    title={tr('tenant.694fc5')}
                    style={{
                      width: 26, height: 26, borderRadius: 4,
                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                      color: 'var(--fg-1)', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  ><Icon name="refresh-cw" size={12} /></button>
                </>
              )}
            </div>

            {/* 主体:空态/加载/表格 */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {!currentBucket ? (
                <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                  <Icon name="mouse-pointer-2" size={32} style={{ color: 'var(--fg-3)', marginBottom: 10, transform: 'scaleX(-1)' }} />
                  <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 4 }}>{tr('tenant.2ffe16')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{tr('tenant.fe4ce2')}</div>
                </div>
              ) : state.loadingObjects ? (
                <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                  <Icon name="loader" size={24} style={{ color: 'var(--cyan)', marginBottom: 8 }} />
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{tr('tenant.0be20d')}</div>
                </div>
              ) : filteredObjs.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Icon name="folder-open" size={28} style={{ color: 'var(--fg-3)', marginBottom: 8 }} />
                  <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                    {state.objectSearch ? tr('tenant.0bd177') : tr('tenant.039b76')}
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                  <thead>
                    <tr>
                      {[
                        { h: tr('tenant.d7ec2d') },
                        { h: tr('tenant.58f966'), w: 100 },
                        { h: tr('tenant.1303e6'), w: 150 },
                        { h: tr('tenant.2b6bc0'), w: 130, align: 'center' },
                      ].map((c, i) => (
                        <th key={i} style={{
                          textAlign: c.align || 'center', padding: '8px 12px', width: c.w,
                          position: 'sticky', top: 0, zIndex: 1,
                          background: 'var(--bg-2)', color: 'var(--fg-3)',
                          fontSize: 10, fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: 0.5,
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}>{c.h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObjs.map((obj, i) => {
                      const info = objTypeInfo(obj.name);
                      return (
                        <tr key={obj.name} style={{
                          background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                        }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Icon name={info.icon} size={12} style={{ color: info.color, flexShrink: 0 }} />
                              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{obj.name}</span>
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--fg-1)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} className="num">
                            {formatSize(obj.size)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{formatDate(obj.modified) || '-'}</span>
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 3 }}>
                              {info.preview && (
                                <button type="button" title={tr('tenant.645dbc')}
                                  onClick={() => window.open('/oci/storage/object/preview?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) + '&namespace=' + encodeURIComponent(currentBucket.namespace || state.namespace) + '&bucketName=' + encodeURIComponent(currentBucket.name) + '&objectName=' + encodeURIComponent(obj.name), '_blank')}
                                  style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                ><Icon name="eye" size={11} /></button>
                              )}
                              <button type="button" title={tr('tenant.f26ef9')}
                                onClick={() => window.open('/oci/storage/object/download?tenantId=' + encodeURIComponent(getTenantDbId(tenant)) + '&namespace=' + encodeURIComponent(currentBucket.namespace || state.namespace) + '&bucketName=' + encodeURIComponent(currentBucket.name) + '&objectName=' + encodeURIComponent(obj.name), '_blank')}
                                style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name="download" size={11} /></button>
                              <button type="button" title={tr('tenant.ff084c')}
                                onClick={() => openPresignModal(currentBucket.name, obj.name, currentBucket.namespace || state.namespace)}
                                style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--info)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name="link" size={11} /></button>
                              <button type="button" title={tr('tenant.2f4aad')}
                                onClick={() => shell.openConfirm({
                                  title: tr('tenant.631cd2'),
                                  body: <div>{tr('tenant.2e29e3')} <span className="mono" style={{ color: 'var(--fg-0)' }}>{obj.name}</span> {tr('tenant.c0498b')}</div>,
                                  danger: true, confirmLabel: tr('tenant.2f4aad'),
                                  onConfirm: async () => {
                                    try {
                                      const r = await window.ociApi.request('/oci/storage/object/delete', {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ tenantId: getTenantDbId(tenant), namespace: currentBucket.namespace || state.namespace, bucketName: currentBucket.name, objectName: obj.name }),
                                      });
                                      if (!(r && r.success)) { shell.showToast(tr('tenant.ad23f0') + ((r && r.message) || ''), { kind: 'error' }); return; }
                                      shell.showToast(tr('tenant.1e5301').replace('{0}',obj.name), { kind: 'success' });
                                      loadObjects(currentBucket.name, currentBucket.namespace || state.namespace);
                                    } catch (err) {
                                      shell.showToast(tr('tenant.ad23f0') + (err.message || err), { kind: 'error' });
                                    }
                                  },
                                })}
                                style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--danger)', border: 'none', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name="trash-2" size={11} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ),
      footer: <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>,
    });
  };
  renderList();
  ensureNamespace();
  loadBuckets();
}

function MiniMetric({ label, value, color }) {
  return (
    <div style={{ padding: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}

// 查看配额已全面升级为独立整页（见 page-tenant-quota.jsx，对齐客户端 TenantQuotaView.swift），不再使用弹窗。

function useUserManageModal() {
  // ═══════════════════════════════════════════════════════════════════════
  // 用户管理 · 严格对齐原项目 doubleDimple/oci-start tenant_list.ftl
  //   #userManagementModal · 3 tabs: users / notifications / mfa
  //   全部走真实后端接口,字段取自 TenantController / service
  // ═══════════════════════════════════════════════════════════════════════
  const shell = useShell();
  return React.useCallback((tenant, defaultTab = 'users') => {
    const region = getTenantRegion(tenant);
    const regName = regionSimpleName(region);
    const regionText = regName && regName !== region ? `${regName} (${region})` : (region || '—');

    const state = {
      tab: defaultTab || 'users',                // users | notifications | mfa
      users: [],
      notifyEmails: [],
      addEmailFormOpen: false,
      newNotifyEmail: '',
      mfaEnabled: false,                         // 邮箱 MFA 是否开启
      mfaStatus: null,                           // { emailEnabled, smsEnabled, totpEnabled, pushEnabled }
      passwordPolicy: {
        active: false,                           // enablePasswordExpiry
        expireDays: 120,
      },
      showPasswordPolicyModal: false,
      ppDraft: null,
      savingPP: false,
      userGroups: [],
      loading: true,
      formMode: 'closed',                        // closed | add (真实后端仅支持新增)
      editingId: null,
      form: { username: '', email: '', password: '', groupId: '' },
    };

    const fmtDate = (v) => {
      if (!v) return '-';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const resetForm = () => {
      state.form = { username: '', email: '', password: '', groupId: '' };
      state.formMode = 'closed';
      state.editingId = null;
    };

    const normUser = (u) => {
      const st = String(u.lifecycleState || '').toLowerCase();
      let status = 'inactive';
      if (st === 'active') status = 'active';
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        status,
        createdAt: fmtDate(u.timeCreated),
        lastLogin: u.lastSuccessfulLoginTime ? fmtDate(u.lastSuccessfulLoginTime) : '-',
        domain: u.domain,
      };
    };

    const loadUsers = async () => {
      state.loading = true; render();
      try {
        const list = await window.ociApi.request('/tenants/oracle-users?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
        state.users = (Array.isArray(list) ? list.map(normUser) : []);
      } catch (e) {
        state.users = [];
      }
      state.loading = false; render();
    };

    const loadGroups = async () => {
      try {
        const groups = await window.ociApi.request('/tenants/groups', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        state.userGroups = Array.isArray(groups) ? groups : [];
      } catch (e) {
        state.userGroups = [];
      }
    };

    const loadNotifications = async () => {
      try {
        const r = await window.ociApi.request('/tenants/notification/recipients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        state.notifyEmails = (r && r.success && Array.isArray(r.recipients))
          ? r.recipients.map(e => String(e)).filter(Boolean) : [];
      } catch (e) {
        state.notifyEmails = [];
      }
    };

    const loadMfaStatus = async () => {
      try {
        const r = await window.ociApi.request('/tenants/mfa/status?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
        if (r && r.success && r.data) {
          state.mfaStatus = r.data;
          state.mfaEnabled = !!r.data.emailEnabled;
        }
      } catch (e) {
        state.mfaStatus = null;
        state.mfaEnabled = false;
      }
    };

    const loadPasswordPolicy = async () => {
      try {
        const r = await window.ociApi.request('/tenants/oracle-users/getPasspolicy', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        const list = (r && r.success && Array.isArray(r.data)) ? r.data : [];
        const enabled = list.filter(p => p.enablePasswordExpiry);
        const withDays = list.filter(p => p.expiryDays != null).map(p => (p.expiryDays == null ? 120 : Number(p.expiryDays)));
        let min = 120;
        if (withDays.length) min = Math.min(...withDays);
        state.passwordPolicy = { active: enabled.length > 0, expireDays: min };
      } catch (e) {
        state.passwordPolicy = { active: false, expireDays: 120 };
      }
    };

    const statusCfg = {
      active:   { label: tr('tenant.c6cc39'),   color: 'var(--accent)', bg: 'var(--accent-soft)' },
      inactive: { label: tr('tenant.1c1ed9'), color: 'var(--fg-2)',   bg: 'var(--bg-3)' },
      locked:   { label: tr('tenant.e81c64'), color: 'var(--danger)', bg: 'var(--danger-soft)' },
    };

    // ── 密码策略浮层弹窗（层级高于用户管理） ─────────
    const openPasswordPolicy = async () => {
      await loadPasswordPolicy();
      const draft = { ...state.passwordPolicy };
      if (!draft.expireDays || draft.expireDays === 0) {
        draft.expireDays = 120;
      }
      state.ppDraft = draft;
      state.showPasswordPolicyModal = true;
      render();
    };

    const addEmail = async () => {
      const v = state.newNotifyEmail.trim();
      if (!v) { shell.showToast(tr('tenant.dbf6d0'), { kind: 'warn' }); return; }
      if (!/@/.test(v)) { shell.showToast(tr('tenant.f02628'), { kind: 'warn' }); return; }
      if (state.notifyEmails.some(e => e.toLowerCase() === v.toLowerCase())) { shell.showToast(tr('tenant.9aea6c'), { kind: 'warn' }); return; }
      const updated = [...state.notifyEmails, v.toLowerCase()];
      try {
        await window.ociApi.request('/tenants/notification/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: getTenantDbId(tenant), emails: updated }),
        });
        state.notifyEmails = updated;
        state.addEmailFormOpen = false; state.newNotifyEmail = '';
        shell.showToast(tr('tenant.b973e4').replace('{0}',v), { kind: 'success' });
        render();
      } catch (e) {
        shell.showToast(tr('tenant.93e2fd') + (e.message || e), { kind: 'error' });
      }
    };

    const removeEmail = async (email) => {
      if (state.notifyEmails.length <= 1) { shell.showToast(tr('tenant.3159e6'), { kind: 'warn' }); return; }
      const updated = state.notifyEmails.filter(x => x !== email);
      try {
        await window.ociApi.request('/tenants/notification/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: getTenantDbId(tenant), emails: updated }),
        });
        state.notifyEmails = updated;
        shell.showToast(tr('tenant.16edb1'), { kind: 'info' });
        render();
      } catch (e) {
        shell.showToast(tr('tenant.7d7c97') + (e.message || e), { kind: 'error' });
      }
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.7d94de'),
        subtitle: <span><span className="mono">{tenantLabel(tenant)}</span><span style={{ margin: '0 6px', color: 'var(--fg-3)' }}>·</span><span>{regionText}</span></span>,
        icon: 'users',
        iconColor: 'var(--accent)',
        size: 'xl',
        height: 660,
        body: (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* ── Tab 导航 · 3 个(对齐原项目) ─────────── */}
            <div style={{
              display: 'flex', gap: 4, flexShrink: 0,
              padding: 3,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 14,
            }}>
              {[
                { id: 'users',         label: tr('tenant.6b045a'), icon: 'users',        count: state.users.length },
                { id: 'notifications', label: tr('tenant.2ba611'), icon: 'mail',         count: state.notifyEmails.length },
                { id: 'mfa',           label: tr('tenant.3a62d1'), icon: 'shield-check', count: null },
              ].map(t => {
                const isActive = state.tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { state.tab = t.id; resetForm(); state.addEmailFormOpen = false; render(); }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: isActive ? 'var(--bg-1)' : 'transparent',
                      border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                      borderRadius: 6,
                      color: isActive ? 'var(--accent)' : 'var(--fg-2)',
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 100ms',
                    }}
                  >
                    <Icon name={t.icon} size={13} />
                    {t.label}
                    {t.count !== null && (
                      <span style={{
                        padding: '0 6px', minWidth: 18,
                        background: isActive ? 'var(--accent-soft)' : 'var(--bg-3)',
                        color: isActive ? 'var(--accent)' : 'var(--fg-3)',
                        borderRadius: 4, fontSize: 10, fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}>{t.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ══════ 用户列表 tab ══════════════════════ */}
            {state.tab === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                  <SearchInput placeholder={tr('tenant.4843f0')} width={260} />
                  <div style={{ flex: 1 }} />
                  <Button size="sm" variant="primary" icon="user-plus"
                    onClick={() => { state.formMode = 'add'; state.editingId = null; render(); }}
                  >{tr('tenant.49a51f')}</Button>
                  <Button size="sm" variant="cyan" icon="refresh-cw"
                    onClick={() => { loadUsers(); }}
                  >{tr('tenant.93bc1f')}</Button>
                  <Button size="sm" variant="orange" icon="key" onClick={openPasswordPolicy}>{tr('tenant.e081de')}</Button>
                </div>

                {/* 添加用户表单 · 3 个字段(对齐原项目 createUser) */}
                {(state.formMode === 'add') && (
                  <div style={{
                    padding: 14,
                    marginBottom: 14,
                    flexShrink: 0,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Icon name="user-plus" size={14} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }}>{tr('tenant.49a51f')}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                      <FormRow label={tr('tenant.819767')} required style={{ marginBottom: 0 }}>
                        <TextInput
                          value={state.form.username}
                          onChange={v => { state.form.username = v; render(); }}
                          placeholder={tr('tenant.08b1fa')}
                          mono
                        />
                      </FormRow>
                      <FormRow label={tr('tenant.6ab78f')} required style={{ marginBottom: 0 }}>
                        <TextInput
                          value={state.form.email}
                          onChange={v => { state.form.email = v; render(); }}
                          placeholder={tr('tenant.2ba4c8')}
                          mono
                        />
                      </FormRow>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                      <FormRow label={tr('tenant.e72a0b')} required style={{ marginBottom: 0 }}>
                        <CustomDropdown value={state.form.groupId}
                          onChange={e => { state.form.groupId = e; render(); }} height={32} width="100%">
                          {state.userGroups.map(g => <option key={g.groupId} value={g.groupId}>{g.groupName}</option>)}
                        </CustomDropdown>
                      </FormRow>
                      <FormRow label={tr('tenant.763ffe')} style={{ marginBottom: 0 }}>
                        <div style={{
                          padding: '8px 10px',
                          background: 'var(--bg-1)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--fg-2)', fontSize: 11.5,
                        }}>{tr('tenant.ecf834')}</div>
                      </FormRow>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <Button size="sm" variant="ghost" onClick={() => { resetForm(); render(); }}>{tr('tenant.625fb2')}</Button>
                      <Button size="sm" variant="primary" icon="check" onClick={async () => {
                        if (!state.form.username.trim()) { shell.showToast(tr('tenant.08b1fa'), { kind: 'warn' }); return; }
                        if (!state.form.email.trim()) { shell.showToast(tr('tenant.2ba4c8'), { kind: 'warn' }); return; }
                        if (!state.form.groupId) { shell.showToast(tr('tenant.68d79d'), { kind: 'warn' }); return; }
                        try {
                          const res = await window.ociApi.request('/tenants/oracle-users', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId: getTenantDbId(tenant), username: state.form.username, email: state.form.email, groupId: state.form.groupId }),
                          });
                          shell.showToast(tr('tenant.c22ce5').replace('{0}',res.username).replace('{1}',res.password), { kind: 'success' });
                          resetForm();
                          loadUsers();
                        } catch (e) {
                          shell.showToast(tr('tenant.636fca').replace('{0}',(e && (e.message || e)) || tr('tenant.netError')), { kind: 'error' });
                        }
                      }}>{tr('tenant.b58c75')}</Button>
                    </div>
                  </div>
                )}

                {/* 用户表格 */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  background: 'var(--bg-1)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[
                          { h: tr('tenant.af6cc1'), w: 100, align: 'center' },
                          { h: tr('tenant.819767'), w: 120, align: 'center' },
                          { h: tr('tenant.6ab78f'), align: 'center' },
                          { h: tr('tenant.d05d90'), w: 80, align: 'center' },
                          { h: tr('tenant.eca37c'), w: 135, align: 'center' },
                          { h: tr('tenant.39b4f2'), w: 135, align: 'center' },
                          { h: tr('tenant.2b6bc0'), w: 70, align: 'center' },
                        ].map((c, i) => (
                          <th key={i} style={{
                            textAlign: c.align || 'center', padding: '10px 12px', width: c.w,
                            background: 'var(--bg-2)', color: 'var(--fg-3)',
                            fontSize: 10.5, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            position: 'sticky', top: 0, zIndex: 1,
                          }}>{c.h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.loading ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)' }}>
                            <span style={{ fontSize: 12 }}>{tr('tenant.26b5bd')}</span>
                          </td>
                        </tr>
                      ) : state.users.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)' }}>
                            <Icon name="users" size={28} style={{ marginBottom: 8, color: 'var(--fg-3)' }} />
                            <div style={{ fontSize: 12 }}>{tr('tenant.284034')}</div>
                          </td>
                        </tr>
                      ) : state.users.map((u, i) => {
                        const sc = statusCfg[u.status] || statusCfg.active;
                        return (
                          <tr key={u.id} style={{
                            background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                          }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={u.domain || 'Default'}>
                              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{u.domain || 'Default'}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={u.username}>
                              <span className="mono" style={{ color: 'var(--fg-0)', fontWeight: 500, fontSize: 12 }}>{u.username}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }} title={u.email}>
                              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{u.email || '—'}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                              <span style={{
                                padding: '1px 8px',
                                background: sc.bg, color: sc.color,
                                borderRadius: 3, fontSize: 11, fontWeight: 500,
                              }}>{sc.label}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={u.createdAt}>
                              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{u.createdAt}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} title={u.lastLogin}>
                              <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{u.lastLogin}</span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              {(() => {
                                const isOpen = state.menuFor === u.id;
                                return (
                                  <button type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (isOpen) { state.menuFor = null; render(); return; }
                                      state.menuFor = u.id;
                                      state.menuAnchor = e.currentTarget;
                                      render();
                                    }}
                                    style={{
                                      width: 28, height: 28, borderRadius: 4,
                                      background: isOpen ? 'var(--accent)' : 'var(--bg-2)',
                                      border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--border)'),
                                      color: isOpen ? 'var(--accent-fg)' : 'var(--fg-1)',
                                      cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    title={tr('tenant.2b6bc0')}
                                  ><Icon name="more-horizontal" size={13} /></button>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 行操作菜单 · 对齐原项目仅 重置密码 / 删除用户 */}
                {state.menuFor && state.menuAnchor && (() => {
                  const u = state.users.find(x => x.id === state.menuFor);
                  if (!u) return null;
                  return (
                    <RowActionMenu
                      anchorEl={state.menuAnchor}
                      width={200} columns={1}
                      header={
                        <>
                          <div style={{
                            width: 18, height: 18, borderRadius: 9,
                            background: 'var(--accent-soft)', color: 'var(--accent)',
                            fontSize: 9, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            textTransform: 'uppercase',
                          }}>{(u.username || '?').slice(0, 2)}</div>
                          <span className="mono" style={{ color: 'var(--fg-0)', flex: 1 }}>{u.username}</span>
                        </>
                      }
                      items={[
                        { id: 'reset',  label: tr('tenant.0719aa'), icon: 'key',           color: 'var(--info)' },
                        { id: 'delete', label: tr('tenant.10991c'), icon: 'trash-2',        color: 'var(--danger)' },
                      ]}
                      onClose={() => { state.menuFor = null; state.menuAnchor = null; render(); }}
                      onAction={(id) => {
                        if (id === 'reset') {
                          shell.openConfirm({
                            title: tr('tenant.f602f5').replace('{0}',u.username),
                            body: <div>{tr('tenant.8bb392')}</div>,
                            danger: true, confirmLabel: tr('tenant.0719aa'),
                            onConfirm: async () => {
                              try {
                                const r = await window.ociApi.request('/tenants/oracle-users/resetPassword', {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ tenantId: getTenantDbId(tenant), userId: u.id, userName: u.username }),
                                });
                                shell.showToast(tr('tenant.5fc3e4').replace('{0}',u.username).replace('{1}',r && r.message ? ' · ' + r.message : ''), { kind: 'success' });
                              } catch (e) {
                                shell.showToast(tr('tenant.40b937').replace('{0}',(e && (e.message || e)) || tr('tenant.netError')), { kind: 'error' });
                              }
                            },
                          });
                        } else if (id === 'delete') {
                          shell.openConfirm({
                            title: tr('tenant.518497').replace('{0}',u.username),
                            body: <div>{tr('tenant.9adca9')} <b style={{ color: 'var(--danger)' }}>{tr('tenant.96d2b7')}</b>{tr('tenant.895411')}</div>,
                            danger: true, requireText: u.username, confirmLabel: tr('tenant.96d2b7'),
                            onConfirm: async () => {
                              try {
                                await window.ociApi.request('/tenants/oracle-users/deleteUser', {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ tenantId: getTenantDbId(tenant), userId: u.id }),
                                });
                                shell.showToast(tr('tenant.1e5301').replace('{0}',u.username), { kind: 'warn' });
                                loadUsers();
                              } catch (e) {
                                shell.showToast(tr('tenant.661ba6').replace('{0}',(e && (e.message || e)) || tr('tenant.netError')), { kind: 'error' });
                              }
                            },
                          });
                        }
                      }}
                    />
                  );
                })()}
              </div>
            )}

            {/* ══════ 通知邮箱 tab ══════════════════════ */}
            {state.tab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                  <div style={{ flex: 1 }} />
                  <Button size="sm" variant="primary" icon="plus"
                    onClick={() => { state.addEmailFormOpen = true; state.newNotifyEmail = ''; render(); }}
                  >{tr('tenant.7ddcf5')}</Button>
                  <Button size="sm" variant="cyan" icon="refresh-cw"
                    onClick={() => { loadNotifications(); }}
                  >{tr('tenant.93bc1f')}</Button>
                </div>

                {/* 添加邮箱表单 */}
                {state.addEmailFormOpen && (
                  <div style={{
                    padding: 14,
                    marginBottom: 12,
                    flexShrink: 0,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 8,
                  }}>
                    <FormRow label={<span>{tr('tenant.6ab78f')} <span style={{ color: 'var(--danger)' }}>*</span></span>}>
                      <TextInput
                        value={state.newNotifyEmail}
                        onChange={v => { state.newNotifyEmail = v; render(); }} placeholder={tr('tenant.2ba4c8')} />
                    </FormRow>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button size="sm" variant="primary" onClick={addEmail}>{tr('tenant.b58c75')}</Button>
                      <Button size="sm" variant="danger" onClick={() => { state.addEmailFormOpen = false; state.newNotifyEmail = ''; render(); }}>{tr('tenant.625fb2')}</Button>
                    </div>
                  </div>
                )}

                {/* 通知邮箱列表(表格 · 4 列对齐原项目) */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  background: 'var(--bg-1)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[
                          { h: tr('tenant.faaadc'), w: 60 },
                          { h: tr('tenant.6ab78f') },
                          { h: tr('tenant.3fea7c'), w: 120 },
                          { h: tr('tenant.2b6bc0'), w: 140, align: 'center' },
                        ].map((c, i) => (
                          <th key={i} style={{
                            textAlign: c.align || 'center', padding: '10px 12px', width: c.w,
                            background: 'var(--bg-2)', color: 'var(--fg-3)',
                            fontSize: 10.5, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                            borderBottom: '1px solid var(--border)',
                            position: 'sticky', top: 0, zIndex: 1,
                          }}>{c.h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.notifyEmails.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)' }}>
                            <Icon name="mail" size={28} style={{ marginBottom: 8, color: 'var(--fg-3)' }} />
                            <div style={{ fontSize: 12 }}>{tr('tenant.28931b')}</div>
                          </td>
                        </tr>
                      ) : state.notifyEmails.map((email, i) => (
                        <tr key={email} style={{
                          background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span className="num" style={{ color: 'var(--fg-2)' }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="mail" size={12} style={{ color: 'var(--info)' }} />
                              <span className="mono" style={{ color: 'var(--fg-0)' }}>{email}</span>
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{
                              padding: '1px 8px',
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              borderRadius: 3, fontSize: 11, fontWeight: 500,
                            }}>{tr('tenant.876caf')}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <button type="button" title={tr('tenant.86048b')}
                              onClick={() => removeEmail(email)}
                              style={{
                                width: 26, height: 26, borderRadius: 4,
                                background: 'var(--danger)', border: 'none',
                                color: 'white', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            ><Icon name="trash-2" size={11} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 底部统计 */}
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  flexShrink: 0,
                  background: 'var(--bg-2)',
                  borderRadius: 4,
                  fontSize: 12, color: 'var(--fg-2)',
                }}>
                  <span className="num" style={{ color: 'var(--fg-0)', fontWeight: 600 }}>{state.notifyEmails.length}</span>
                  <span> {tr('tenant.d7f30c')}</span>
                </div>
              </div>
            )}

            {/* ══════ MFA 管理 tab · 严格对齐原项目 ══════ */}
            {state.tab === 'mfa' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
                  <Button size="sm" variant="orange" icon="key"
                    onClick={() => shell.openConfirm({
                      title: tr('tenant.36e97c'),
                      body: <div>{tr('tenant.891e9c')}</div>,
                      danger: true, confirmLabel: tr('tenant.d55d55'),
                      onConfirm: async () => {
                        try {
                          await window.ociApi.request('/tenants/resetAccountFactor?tenantId=' + encodeURIComponent(getTenantDbId(tenant)), { method: 'POST' });
                          shell.showToast(tr('tenant.c78f20'), { kind: 'warn' });
                          loadMfaStatus();
                        } catch (e) {
                          shell.showToast(tr('tenant.9601d5') + (e.message || e), { kind: 'error' });
                        }
                      },
                    })}
                  >{tr('tenant.607cd8')}</Button>
                  <Button size="sm" variant="primary" icon="mail" disabled={state.mfaEnabled}
                    onClick={async () => {
                      try {
                        const r = await window.ociApi.request('/tenants/mfa/email', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tenantId: getTenantDbId(tenant), enableEmail: true }),
                        });
                        if (r && r.success) { shell.showToast(tr('tenant.ddda1d'), { kind: 'success' }); loadMfaStatus(); }
                        else shell.showToast((r && r.message) || tr('tenant.c76b09'), { kind: 'error' });
                      } catch (e) {
                        shell.showToast(tr('tenant.845bb2') + (e.message || e), { kind: 'error' });
                      }
                    }}
                  >{tr('tenant.7ab2ca')}</Button>
                  <Button size="sm" variant="danger" icon="mail" disabled={!state.mfaEnabled}
                    onClick={() => shell.openConfirm({
                      title: tr('tenant.14dbb8'),
                      body: <div>{tr('tenant.97568d')}</div>,
                      danger: true, confirmLabel: tr('tenant.b15d91'),
                      onConfirm: async () => {
                        try {
                          const r = await window.ociApi.request('/tenants/mfa/email', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tenantId: getTenantDbId(tenant), enableEmail: false }),
                          });
                          if (r && r.success) { shell.showToast(tr('tenant.df25d5'), { kind: 'warn' }); loadMfaStatus(); }
                          else shell.showToast((r && r.message) || tr('tenant.1fb275'), { kind: 'error' });
                        } catch (e) {
                          shell.showToast(tr('tenant.fc01e6') + (e.message || e), { kind: 'error' });
                        }
                      },
                    })}
                  >{tr('tenant.7c2e77')}</Button>
                  <Button size="sm" variant="cyan" icon="refresh-cw"
                    onClick={() => { loadMfaStatus(); }}
                  >{tr('tenant.4f8d48')}</Button>
                </div>

                {/* MFA 状态显示区 */}
                <div style={{
                  padding: 16,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    paddingBottom: 10, borderBottom: '1px solid var(--border)',
                  }}>
                    <Icon name="info" size={13} style={{ color: 'var(--info)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('tenant.94bbb8')}</span>
                  </div>

                  {[
                    { key: 'emailEnabled', label: tr('tenant.9b99e2'), icon: 'mail' },
                    { key: 'smsEnabled',   label: tr('tenant.9bbe38'), icon: 'message-square' },
                    { key: 'totpEnabled',  label: tr('tenant.0fc010'), icon: 'shield-check' },
                  ].map((item, idx, arr) => {
                    const on = !!(state.mfaStatus && state.mfaStatus[item.key]);
                    return (
                      <div key={item.key} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        background: on ? 'var(--accent-soft)' : 'var(--bg-3)',
                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
                        borderRadius: 6,
                        marginBottom: idx < arr.length - 1 ? 6 : 0,
                      }}>
                        <Icon name={item.icon} size={14} style={{ color: on ? 'var(--accent)' : 'var(--fg-3)' }} />
                        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: on ? 'var(--accent)' : 'var(--fg-1)' }}>{item.label}</span>
                        <span style={{
                          padding: '1px 8px',
                          background: on ? 'var(--accent)' : 'var(--bg-2)',
                          color: on ? 'var(--accent-fg)' : 'var(--fg-3)',
                          borderRadius: 10, fontSize: 10, fontWeight: 600,
                        }}>{on ? 'ON' : 'OFF'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 密码策略浮层模态框 (层级高于用户管理弹窗，对齐图2) */}
            {state.showPasswordPolicyModal && (
              <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(2px)',
                zIndex: 120, animation: 'fade-in 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} onClick={() => { state.showPasswordPolicyModal = false; render(); }}>
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: 560, maxWidth: '92vw',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column',
                    animation: 'fade-in 180ms',
                  }}
                >
                  {/* Header (对齐图2) */}
                  <div style={{
                    padding: '16px 22px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
                        color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon name="key" size={17} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>租户密码策略设置</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                          <span className="mono">{tenantLabel(tenant)}</span>
                          <span style={{ margin: '0 6px' }}>·</span>
                          <span>{regionText}</span>
                        </div>
                      </div>
                    </div>
                    <IconButton icon="x" onClick={() => { state.showPasswordPolicyModal = false; render(); }} size={28} style={{ border: '1px solid var(--border)' }} />
                  </div>

                  {/* Body (对齐图2) */}
                  <div style={{ padding: 20 }}>
                    {/* 状态提示横幅 */}
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--info-soft)',
                      border: '1px solid var(--info)',
                      borderRadius: 6,
                      fontSize: 12, color: 'var(--info)',
                      marginBottom: 16,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Icon name="info" size={14} style={{ flexShrink: 0 }} />
                      <div>
                        当前密码策略状态: <b>{state.ppDraft?.active ? `已启用 (${state.ppDraft.expireDays}天)` : '未启用'}</b>
                      </div>
                    </div>

                    {/* 启用强制修改密码勾选框 */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)', marginBottom: 8 }}>启用强制修改密码</div>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        cursor: 'pointer', padding: '10px 14px',
                        background: state.ppDraft?.active ? 'var(--accent-soft)' : 'var(--bg-2)',
                        border: '1px solid ' + (state.ppDraft?.active ? 'var(--accent)' : 'var(--border)'),
                        borderRadius: 6,
                      }}>
                        <input
                          type="checkbox"
                          checked={!!state.ppDraft?.active}
                          onChange={e => {
                            state.ppDraft.active = e.target.checked;
                            if (state.ppDraft.active && (!state.ppDraft.expireDays || state.ppDraft.expireDays === 0)) {
                              state.ppDraft.expireDays = 120;
                            }
                            render();
                          }}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 }}
                        />
                        <span style={{ fontSize: 12, color: state.ppDraft?.active ? 'var(--accent)' : 'var(--fg-1)' }}>
                          启用后,该租户下所有用户将在指定天数后被强制修改密码
                        </span>
                      </label>
                    </div>

                    {/* 密码过期天数 (始终显示，对齐图2) */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)', marginBottom: 6 }}>
                        密码过期天数 <span style={{ color: 'var(--danger)' }}>*</span>
                      </div>
                      <TextInput
                        type="number"
                        value={state.ppDraft?.expireDays ?? 120}
                        onChange={v => {
                          state.ppDraft.expireDays = v === '' ? '' : Math.max(0, Math.min(365, parseInt(v) || 0));
                          render();
                        }}
                        placeholder="120"
                        mono
                      />
                    </div>
                  </div>

                  {/* Footer (对齐图2) */}
                  <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                  }}>
                    <Button variant="ghost" size="md" onClick={() => { state.showPasswordPolicyModal = false; render(); }}>
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      icon="save"
                      loading={state.savingPP}
                      onClick={async () => {
                        state.savingPP = true; render();
                        const clean = { ...state.ppDraft };
                        if (!clean.expireDays || clean.expireDays === 0) clean.active = false;
                        try {
                          const res = await fetch('/tenants/oracle-users/password-policy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                            credentials: 'include',
                            body: JSON.stringify({
                              tenantId: getTenantDbId(tenant),
                              enablePasswordExpiry: !!clean.active,
                              expiryDays: clean.active ? (parseInt(clean.expireDays) || 120) : 0,
                            }),
                          });
                          const j = await res.json();
                          if (res.ok && j && j.success === true) {
                            state.passwordPolicy = clean;
                            state.showPasswordPolicyModal = false;
                            shell.showToast(clean.active ? `✓ 密码过期策略已启用: ${clean.expireDays} 天` : '✓ 密码策略已更新: 从不强制过期', { kind: 'success' });
                          } else {
                            shell.showToast(tr('tenant.40f902') + ((j && j.message) || `HTTP ${res.status}`), { kind: 'error' });
                          }
                        } catch (e) {
                          shell.showToast(tr('tenant.40f902') + (e.message || e), { kind: 'error' });
                        } finally {
                          state.savingPP = false;
                          render();
                        }
                      }}
                    >
                      保存策略
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ),
        footer: <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>,
      });
    };
    render();
    loadUsers();
    loadGroups();
    loadNotifications();
    loadMfaStatus();
  }, [shell]);
}
function useRegionSubscribeModal() {
  const shell = useShell();
  const { lang } = React.useContext(LangContext);
  return React.useCallback((tenant) => {
    const state = {
      tab: 'subscribed',
      subscribedList: [],
      unsubscribedList: [],
      selectedKeys: new Set(),
      pendingKey: null,
      subscribingBatch: false,
      loading: true,
    };

    const mainRegion = getTenantRegion(tenant);

    const loadRegions = async () => {
      state.loading = true;
      render();
      try {
        const [subList, unsubList] = await Promise.all([
          window.ociApi.request('/tenants/subscribed-regions-data?tenantId=' + encodeURIComponent(getTenantDbId(tenant))).catch(() => []),
          window.ociApi.request('/tenants/unsubscribed-regions?tenantId=' + encodeURIComponent(getTenantDbId(tenant))).catch(() => []),
        ]);

        let subs = Array.isArray(subList) ? subList : [];
        let unsubs = Array.isArray(unsubList) ? unsubList : [];

        // 确保主区域存在于已订阅列表中
        if (mainRegion && !subs.some(s => (s.regionKey || s.regionName) === mainRegion)) {
          subs.unshift({
            regionKey: mainRegion,
            regionName: mainRegion,
            status: 'READY',
            isHomeRegion: true,
          });
        }

        state.subscribedList = subs;
        state.unsubscribedList = unsubs;
      } catch (e) {
        shell.showToast(tr('tenant.afefaa') + (e.message || e), { kind: 'error' });
      } finally {
        state.loading = false;
        render();
      }
    };

    const render = () => {
      const subCount = state.subscribedList.length;
      const unsubCount = state.unsubscribedList.length;
      const totalCount = subCount + unsubCount;

      const mainRegionObj = REGIONS.find(r => r.code === mainRegion);
      const mainRegionName = mainRegionObj ? (mainRegionObj.simpleName || mainRegionObj.cn || mainRegion) : (mainRegion || '—');

      const allUnsubSelected = unsubCount > 0 && state.selectedKeys.size === unsubCount;

      const toggleSelectAll = () => {
        if (allUnsubSelected) {
          state.selectedKeys.clear();
        } else {
          state.selectedKeys = new Set(state.unsubscribedList.map(r => r.key));
        }
        render();
      };

      const toggleSelectOne = (key) => {
        if (state.selectedKeys.has(key)) {
          state.selectedKeys.delete(key);
        } else {
          state.selectedKeys.add(key);
        }
        render();
      };

      const handleSubscribe = async (keys) => {
        if (!keys || keys.length === 0) return;
        const isSingle = keys.length === 1;
        if (isSingle) {
          state.pendingKey = keys[0];
        } else {
          state.subscribingBatch = true;
        }
        render();

        try {
          const res = await fetch('/tenants/subscribe-regions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',
            body: JSON.stringify({
              tenantId: getTenantDbId(tenant),
              regionKeys: keys,
            }),
          });
          const j = await res.json();
          if (res.ok && j && j.success === true) {
            keys.forEach(k => state.selectedKeys.delete(k));
            const msg = isSingle
              ? tr('tenant.cf297f').replace('{0}', regionSimpleName(keys[0]))
              : `✓ 已提交订阅 ${keys.length} 个区域`;
            shell.showToast(msg, { kind: 'success' });
            window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
            await loadRegions();
          } else {
            shell.showToast(tr('tenant.79d27a').replace('{0}', (j && (j.error || j.message)) || `HTTP ${res.status}`), { kind: 'error' });
          }
        } catch (e) {
          shell.showToast(tr('tenant.79d27a').replace('{0}', e.message || e), { kind: 'error' });
        } finally {
          state.pendingKey = null;
          state.subscribingBatch = false;
          render();
        }
      };

      shell.openModal({
        title: tr('tenant.5e286d'),
        subtitle: (
          <span>
            <span className="mono">{tenantLabel(tenant)}</span>
            <span style={{ margin: '0 6px', color: 'var(--fg-3)' }}>·</span>
            <span>已订阅 <b>{state.loading ? '—' : subCount}</b> / {state.loading ? '—' : totalCount}</span>
          </span>
        ),
        icon: 'globe',
        iconColor: 'var(--cyan)',
        size: 'lg',
        body: (
          <div style={{ padding: 16 }}>
            {/* 顶部三项统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)' }}>{state.loading ? '—' : totalCount}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>全部区域</div>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--accent-soft)', borderRadius: 6, border: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{state.loading ? '—' : subCount}</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>已订阅</div>
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)' }}>{state.loading ? '—' : unsubCount}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>未订阅</div>
              </div>
            </div>

            {/* 规则说明横幅 */}
            <div style={{
              padding: '9px 12px', background: 'var(--info-soft)',
              border: '1px solid var(--info)', borderRadius: 6, fontSize: 11.5,
              color: 'var(--info)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="info" size={13} style={{ flexShrink: 0 }} />
              <div>
                {tr('tenant.9525fb')} <b>{mainRegionName}</b>{tr('tenant.4acb94')}
              </div>
            </div>

            {/* 标签页切换 */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              {[
                { id: 'subscribed', label: '已订阅', count: subCount },
                { id: 'unsubscribed', label: '未订阅', count: unsubCount },
              ].map(t => {
                const active = state.tab === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => { state.tab = t.id; render(); }} style={{
                    padding: '8px 16px', background: 'transparent', border: 'none',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    color: active ? 'var(--accent)' : 'var(--fg-2)',
                    fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: -1,
                  }}>
                    <span>{t.label}</span>
                    <span style={{
                      fontSize: 10.5, padding: '1px 6px', borderRadius: 10,
                      background: active ? 'var(--accent-soft)' : 'var(--bg-3)',
                      color: active ? 'var(--accent)' : 'var(--fg-3)',
                    }}>{state.loading ? '—' : t.count}</span>
                  </button>
                );
              })}
            </div>

            {/* 标签页内容 */}
            {state.tab === 'subscribed' ? (
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 6, maxHeight: 360, overflowY: 'auto', minHeight: 220,
              }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['区域名称', '区域标识', '主区域', '状态'].map((h, i) => (
                        <th key={i} style={{
                          position: 'sticky', top: 0, zIndex: 1,
                          textAlign: 'center',
                          padding: '9px 12px', background: 'var(--bg-2)',
                          color: 'var(--fg-3)', fontSize: 10.5, fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: 0.5,
                          borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                          width: i === 2 ? 90 : i === 3 ? 100 : undefined,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.loading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                          <Icon name="loader" size={24} style={{ color: 'var(--info)', marginBottom: 8, animation: 'button-spin 800ms linear infinite' }} />
                          <div>{tr('tenant.regionSub.loading')}</div>
                        </td>
                      </tr>
                    ) : state.subscribedList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--fg-3)' }}>
                          <Icon name="globe" size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
                          <div style={{ fontSize: 13, fontWeight: 500 }}>暂无已订阅区域</div>
                          <button type="button" onClick={() => { state.tab = 'unsubscribed'; render(); }} style={{
                            marginTop: 10, padding: '4px 12px', background: 'var(--accent)', color: 'var(--accent-fg)',
                            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                          }}>去订阅</button>
                        </td>
                      </tr>
                    ) : (
                      state.subscribedList.map((r, i) => {
                        const code = r.regionKey || r.regionName;
                        const isHome = r.isHomeRegion || code === mainRegion;
                        const rawStatus = (typeof r.status === 'object' && r.status ? r.status.value : r.status) || 'READY';
                        const st = String(rawStatus).toUpperCase();
                        return (
                          <tr key={code || i} style={{
                            background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                          }}>
                            <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              <RegionBadge code={code} lang={lang} />
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              <span className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{code}</span>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              {isHome ? (
                                <span style={{
                                  padding: '2px 8px', background: 'var(--accent-soft)',
                                  color: 'var(--accent)', borderRadius: 10, fontSize: 10.5, fontWeight: 600,
                                }}>{tr('tenant.d2ccf9') || '主区域'}</span>
                              ) : (
                                <span style={{ color: 'var(--fg-3)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                                background: st === 'READY' ? 'var(--accent-soft)' : st === 'PENDING' ? 'var(--orange-soft)' : 'var(--danger-soft)',
                                color: st === 'READY' ? 'var(--accent)' : st === 'PENDING' ? 'var(--orange)' : 'var(--danger)',
                              }}>{st === 'READY' ? '已就绪' : st === 'PENDING' ? '订阅中' : st}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              state.unsubscribedList.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
                  <Icon name="check-circle" size={32} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-0)' }}>已订阅全部区域</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 4 }}>当前租户已订阅所有可用区域</div>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6,
                    border: '1px solid var(--border)', marginBottom: 8,
                  }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={allUnsubSelected}
                        onChange={toggleSelectAll}
                        disabled={state.loading || unsubCount === 0}
                        style={{ cursor: state.loading || unsubCount === 0 ? 'not-allowed' : 'pointer', margin: 0 }}
                      />
                      <span style={{ fontWeight: 500 }}>全选{state.loading ? '' : `（共 ${unsubCount} 个区域）`}</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {state.selectedKeys.size > 0 && (
                        <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
                          已选 <b style={{ color: 'var(--accent)' }}>{state.selectedKeys.size}</b> 项
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={state.selectedKeys.size === 0 || state.subscribingBatch || state.loading}
                        onClick={() => handleSubscribe(Array.from(state.selectedKeys))}
                        style={{
                          padding: '4px 14px', background: 'var(--accent)', border: 'none',
                          borderRadius: 4, color: 'var(--accent-fg)', fontSize: 12, fontWeight: 500,
                          cursor: state.selectedKeys.size === 0 || state.subscribingBatch || state.loading ? 'not-allowed' : 'pointer',
                          opacity: state.selectedKeys.size === 0 || state.subscribingBatch || state.loading ? 0.5 : 1,
                        }}
                      >
                        {state.subscribingBatch ? '正在提交...' : (state.selectedKeys.size > 0 ? `订阅所选 (${state.selectedKeys.size})` : '订阅所选')}
                      </button>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg-1)', border: '1px solid var(--border)',
                    borderRadius: 6, maxHeight: 320, overflowY: 'auto', minHeight: 200,
                  }}>
                    {state.loading ? (
                      <div style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                        <Icon name="loader" size={24} style={{ color: 'var(--info)', marginBottom: 8, animation: 'button-spin 800ms linear infinite' }} />
                        <div>{tr('tenant.regionSub.loadingUnsub')}</div>
                      </div>
                    ) : state.unsubscribedList.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
                        <Icon name="check-circle" size={32} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-0)' }}>已订阅全部区域</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 4 }}>当前租户已订阅所有可用区域</div>
                      </div>
                    ) : (
                      state.unsubscribedList.map((r, i) => {
                      const isSelected = state.selectedKeys.has(r.key);
                      const isPending = state.pendingKey === r.key;
                      return (
                        <div
                          key={r.key}
                          onClick={(e) => {
                            if (e.target.tagName === 'BUTTON') return;
                            toggleSelectOne(r.key);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '9px 12px',
                            background: isSelected ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : (i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent'),
                            borderBottom: i < state.unsubscribedList.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer', transition: 'background 100ms',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(r.key)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', margin: 0 }}
                          />
                          <RegionBadge code={r.key} lang={lang} />
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{r.key}</span>
                          <div style={{ flex: 1 }} />
                          <button
                            type="button"
                            disabled={isPending || state.subscribingBatch}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubscribe([r.key]);
                            }}
                            style={{
                              padding: '2px 10px', background: 'var(--accent)', border: 'none',
                              borderRadius: 3, color: 'var(--accent-fg)', fontSize: 11,
                              fontWeight: 500, cursor: isPending ? 'wait' : 'pointer',
                              opacity: isPending ? 0.6 : 1,
                            }}
                          >
                            {isPending ? '订阅中...' : '+ 订阅'}
                          </button>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              )
            )}
          </div>
        ),
        footer: (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="md"
              onClick={loadRegions}
              disabled={state.loading || state.subscribingBatch}
            >
              <Icon name="refresh-cw" size={13} style={{ marginRight: 6 }} />
              刷新
            </Button>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>
              {tr('tenant.b15d91')}
            </Button>
          </div>
        ),
      });
    };

    render();
    loadRegions();
  }, [shell, lang]);
}

function useTrafficAlertModal() {
  const shell = useShell();
  const userManageModal = useUserManageModal();
  return React.useCallback((tenant) => {
    const region = getTenantRegion(tenant);
    const regName = regionSimpleName(region);
    const regionText = regName || region || '—';

    const initial = /pro|prod/i.test(getTenantName(tenant) || '');
    const state = {
      enableStats: true,
      threshold: initial ? 8000 : 5000,     // GB (原项目单位)
      autoShutdown: initial,
      notifyEmails: [],
      newEmail: '',
      loading: true,
      saving: false,
    };

    const loadConfig = async () => {
      state.loading = true;
      render();
      try {
        const j = await window.ociApi.request('/tenants/traffic-alert/' + encodeURIComponent(getTenantDbId(tenant)));
        const data = j && j.data ? j.data : null;
        if (data) {
          state.enableStats = data.statisticsEnabled !== false;
          state.threshold = Number(data.threshold || state.threshold);
          state.autoShutdown = !!data.autoShutdown;
        }
      } catch (e) {
        // 无配置时可忽略,使用默认值
      }
      try {
        const r = await window.ociApi.request('/tenants/notification/recipients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        const emails = (r && Array.isArray(r.emails)) ? r.emails : ((r && r.data && Array.isArray(r.data)) ? r.data : (r && Array.isArray(r) ? r : []));
        state.notifyEmails = emails.map(e => (typeof e === 'string' ? e : (e.email || e.address || '')).filter(Boolean)).filter(Boolean);
      } catch (e) {
        state.notifyEmails = [];
      }
      state.loading = false;
      render();
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.3746e6'),
        subtitle: <span><span className="mono">{tenantLabel(tenant)}</span><span style={{ margin: '0 6px', color: 'var(--fg-3)' }}>·</span><span>{regionText}</span></span>,
        icon: 'bell',
        iconColor: 'var(--orange)',
        size: 'md',
        body: (
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* 1. 启用流量统计 · 拟物白勾卡片 */}
            <div
              onClick={() => { state.enableStats = !state.enableStats; render(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '12px 14px',
                background: state.enableStats ? 'var(--accent-soft)' : 'var(--bg-2)',
                border: '1px solid ' + (state.enableStats ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 8,
                transition: 'all 120ms',
                userSelect: 'none',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                background: state.enableStats ? 'var(--accent)' : 'var(--bg-3)',
                border: '1px solid ' + (state.enableStats ? 'var(--accent)' : 'var(--border-strong)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 120ms',
              }}>
                {state.enableStats && <Icon name="check" size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: state.enableStats ? 'var(--accent)' : 'var(--fg-0)' }}>
                  {state.enableStats ? '流量监控与预警已启用' : '流量监控与预警未启用'}
                </div>
                <div style={{ fontSize: 11.5, color: state.enableStats ? 'var(--fg-1)' : 'var(--fg-2)', marginTop: 3, opacity: 0.9 }}>
                  开启后按月统计公网出方向流量，并在达到阈值时触发通知告警
                </div>
              </div>
            </div>

            {/* 2. 预警阈值与快捷药丸按钮 */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              opacity: state.enableStats ? 1 : 0.6,
              pointerEvents: state.enableStats ? 'auto' : 'none',
              transition: 'opacity 120ms',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>预警阈值 (GB)</span>
                <span style={{ color: 'var(--danger)' }}>*</span>
                <span style={{ color: 'var(--fg-2)', fontWeight: 400, marginLeft: 4, opacity: 0.85 }}>· 每月流量达到该值时预警</span>
              </div>
              
              <div style={{ position: 'relative', width: '100%' }}>
                <NumberInput
                  value={state.threshold}
                  onChange={v => { state.threshold = v; render(); }}
                  min={0} max={100000}
                  style={{ paddingRight: 40 }}
                />
                <span style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, fontWeight: 600, color: 'var(--fg-3)',
                  pointerEvents: 'none',
                }}>GB</span>
              </div>

              {/* 快捷 Pill 胶囊按钮组 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {[
                  { v: 1000, label: '1 TB' },
                  { v: 5000, label: '5 TB (推荐)' },
                  { v: 10000, label: '10 TB' },
                  { v: 20000, label: '20 TB' },
                ].map(p => {
                  const isSel = Number(state.threshold) === p.v;
                  return (
                    <button
                      key={p.v}
                      type="button"
                      onClick={() => { state.threshold = p.v; render(); }}
                      style={{
                        padding: '5px 12px',
                        background: isSel ? 'var(--accent)' : 'var(--bg-2)',
                        border: '1px solid ' + (isSel ? 'var(--accent)' : 'var(--border)'),
                        borderRadius: 6,
                        color: isSel ? '#ffffff' : 'var(--fg-1)',
                        fontSize: 11.5, fontWeight: isSel ? 600 : 500,
                        cursor: 'pointer',
                        boxShadow: isSel ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 120ms',
                      }}
                    >{p.label}</button>
                  );
                })}
              </div>
            </div>

            {/* 3. 高级防护 · 流量超限自动关机 */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              opacity: state.enableStats ? 1 : 0.6,
              pointerEvents: state.enableStats ? 'auto' : 'none',
              transition: 'opacity 120ms',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>
                高级保护动作
              </div>
              <div
                onClick={() => { state.autoShutdown = !state.autoShutdown; render(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  padding: '10px 14px',
                  background: state.autoShutdown ? 'var(--danger-soft)' : 'var(--bg-2)',
                  border: '1px solid ' + (state.autoShutdown ? 'var(--danger)' : 'var(--border)'),
                  borderRadius: 8,
                  transition: 'all 120ms',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: state.autoShutdown ? 'var(--danger)' : 'var(--bg-3)',
                  border: '1px solid ' + (state.autoShutdown ? 'var(--danger)' : 'var(--border-strong)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 120ms',
                }}>
                  {state.autoShutdown && <Icon name="check" size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: state.autoShutdown ? 'var(--danger)' : 'var(--fg-0)' }}>
                    流量超限自动关机
                  </div>
                  <div style={{ fontSize: 11.5, color: state.autoShutdown ? 'var(--fg-1)' : 'var(--fg-2)', marginTop: 3, opacity: 0.9 }}>
                    当月流量达到阈值后自动停止该区域的所有实例，防止产生巨额账单
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 预警通知渠道 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>
                  预警通知渠道
                </div>
                <button
                  type="button"
                  onClick={() => {
                    shell.closeModal();
                    userManageModal(tenant, 'notifications');
                  }}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: 'var(--accent)', fontSize: 11, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="settings" size={11} />
                  管理通知邮箱
                </button>
              </div>

              {state.notifyEmails.length === 0 ? (
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-2)',
                  border: '1px dashed var(--orange)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="alert-triangle" size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
                      暂未配置通知邮箱 — 流量触发预警时将无法接收提醒
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      shell.closeModal();
                      userManageModal(tenant, 'notifications');
                    }}
                  >
                    前往配置
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {state.notifyEmails.map(e => (
                    <div key={e} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px',
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}>
                      <Icon name="mail" size={12} style={{ color: 'var(--info)' }} />
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{e}</span>
                      <span style={{
                        padding: '1px 5px',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        borderRadius: 3,
                        fontSize: 9.5, fontWeight: 600,
                      }}>有效</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
            <Button variant="primary" size="md" icon="save" loading={state.saving}
              onClick={async () => {
                if (!state.threshold || state.threshold <= 0) { shell.showToast(tr('tenant.e0016d'), { kind: 'warn' }); return; }
                state.saving = true; render();
                try {
                  await window.ociApi.request('/tenants/traffic-alert', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: getTenantDbId(tenant), threshold: Number(state.threshold), autoShutdown: state.autoShutdown, enabled: state.enableStats, statisticsEnabled: state.enableStats }),
                  });
                  shell.showToast(tr('tenant.7abb7d').replace('{0}',state.threshold >= 1000 ? (state.threshold/1000).toFixed(1) + ' TB' : state.threshold + ' GB').replace('{1}',state.autoShutdown ? tr('tenant.autoShutdown') : ''), { kind: 'success' });
                  shell.closeModal();
                } catch (e) {
                  shell.showToast(tr('tenant.40f902') + (e.message || e), { kind: 'error' });
                } finally {
                  state.saving = false;
                  if (typeof render === 'function') render();
                }
              }}
            >{tr('tenant.be5fbb')}</Button>
          </>
        ),
      });
    };
    render();
    loadConfig();
  }, [shell]);
}

function useMailModal() {
  // ═══════════════════════════════════════════════════════════════════════
  // 租户菜单 · 邮箱服务 · 严格对齐原项目 tenant_list.ftl → #emailServiceModal
  //   + tenant_list.js → enableEmailService(tenantId, isViewOnly)
  //
  //   两种模式:
  //   ① isViewOnly=false (未启用):
  //      · 输入框可编辑 · placeholder 'example.com'
  //      · 按钮:[启用邮件服务] + [取消]  ("重置"按钮隐藏)
  //   ② isViewOnly=true  (已启用):
  //      · 输入框 disabled · 显示当前配置的域名
  //      · 按钮:[重置] + [取消]  ("启用"按钮隐藏,点重置切回可编辑态)
  //
  //   info 图标:
  //   · 默认蓝色(#3085d6),点击展开说明面板并变绿(#28a745)
  // ═══════════════════════════════════════════════════════════════════════
  const shell = useShell();
  return React.useCallback((tenant) => {
    // 从租户属性判定是否已启用(emailEnable 0/1,来自 /tenants/list/json)
    const emailEnable = Number(tenant.emailEnable || 0) === 1 ? 1 : 0;
    const savedDomain = '';

    const state = {
      viewOnly: emailEnable === 1,  // 打开即根据 emailEnable 决定视图
      value: savedDomain,           // 输入框当前值(viewOnly 时展示 savedDomain,编辑态时可修改)
      savedDomain,                  // 服务端已保存的域名(用于 viewOnly 展示)
      showHelp: false,              // 说明面板是否展开
      loading: false,
      saving: false,
    };

    const loadDomain = async () => {
      if (!state.viewOnly) return;
      state.loading = true;
      render();
      try {
        const j = await window.ociApi.request('/email/tenant/get', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        const list = (j && j.data && Array.isArray(j.data)) ? j.data : [];
        state.savedDomain = (list[0] && list[0].domainName) || '';
        state.value = state.savedDomain;
      } catch (e) {
        state.savedDomain = '';
        state.value = '';
      } finally {
        state.loading = false;
        render();
      }
    };

    // 点击"重置"按钮 → 切到可编辑态
    const resetToEdit = () => {
      state.viewOnly = false;
      state.value = '';
      render();
      shell.showToast(tr('tenant.ecdc7a'), { kind: 'info', duration: 2500 });
    };

    // 点击"启用邮件服务"
    const confirmEnable = async () => {
      const d = state.value.trim();
      if (!d) {
        shell.showToast(tr('tenant.1b129e'), { kind: 'error' });
        return;
      }
      // 原项目正则(去掉两端锚点后)
      const pat = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!pat.test(d)) {
        shell.showToast(tr('tenant.c6300a'), { kind: 'error' });
        return;
      }
      state.saving = true;
      render();
      try {
        const result = await window.ociApi.request('/tenants/email/enable', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant), emailDomain: d }),
        });
        if (!result || result.success !== true) throw new Error(result?.message || tr('tenant.af316b'));
        shell.showToast(tr('tenant.f6e99f').replace('{0}',d), { kind: 'success' });
        shell.closeModal();
        window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
      } catch (e) {
        shell.showToast(tr('tenant.b8cce0') + (e.message || e), { kind: 'error' });
      } finally {
        state.saving = false;
        if (typeof render === 'function') render();
      }
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.fd823d'),
        icon: 'mail',
        iconColor: 'var(--accent)',
        size: 'sm',
        body: (
          <div style={{ padding: 20 }}>
            {/* 域名字段 · label 行 */}
            <div style={{
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--fg-1)',
            }}>
              <span>{tr('tenant.99c0d9')}</span>
              <span style={{ color: 'var(--danger)' }}>*</span>
              <button type="button"
                onClick={() => { state.showHelp = !state.showHelp; render(); }}
                title={state.showHelp ? tr('tenant.ebab0e') : tr('tenant.8237b2')}
                style={{
                  width: 16, height: 16, padding: 0,
                  background: 'transparent',
                  color: state.showHelp ? 'var(--accent)' : 'var(--info)',
                  border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'color 120ms',
                }}>
                <Icon name="info" size={13} />
              </button>
            </div>

            {/* 输入框 */}
            <div style={{ position: 'relative' }}>
              <input type="text"
                value={state.value}
                disabled={state.viewOnly}
                onChange={e => {
                  state.value = e.target.value.replace(/^https?:\/\//, '');
                  render();
                }}
                placeholder="example.com"
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 12px',
                  background: state.viewOnly ? 'var(--bg-3)' : 'var(--bg-2)',
                  color: state.viewOnly ? 'var(--fg-1)' : 'var(--fg-0)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  cursor: state.viewOnly ? 'not-allowed' : 'text',
                  transition: 'border-color 120ms',
                }}
                onFocus={e => { if (!state.viewOnly) e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
              />
              <Icon name="shield" size={14}
                style={{
                  position: 'absolute',
                  right: 10, top: '50%', transform: 'translateY(-50%)',
                  color: state.viewOnly ? 'var(--accent)' : 'var(--info)',
                  pointerEvents: 'none',
                }} />
            </div>

            {/* 说明面板 · 对齐原项目 #emailInfoPanel */}
            {state.showHelp && (
              <div style={{
                marginTop: 12, padding: '12px 14px',
                background: 'var(--bg-2)',
                borderLeft: '3px solid var(--info)',
                borderRadius: 4,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="check" size={12} style={{ color: 'var(--accent)', marginTop: 3, flexShrink: 0 }} />
                    <span>{tr('tenant.4d661b')} <b>Oracle Cloud Email Delivery</b> {tr('tenant.997c7a')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="check" size={12} style={{ color: 'var(--accent)', marginTop: 3, flexShrink: 0 }} />
                    <span>{tr('tenant.a2f6ad')}<b>{tr('tenant.9bbcfc')}</b>{tr('tenant.3b0459')} <b>{tr('tenant.5ad4b7')}</b></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="check" size={12} style={{ color: 'var(--accent)', marginTop: 3, flexShrink: 0 }} />
                    <span>{tr('tenant.445694')}<b>{tr('tenant.d19ba9')}</b>{tr('tenant.ab3662')} <span className="mono">mail.example.com</span>)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ),
        footer: (
          <>
            {state.viewOnly ? (
              // ═══ isViewOnly=true:已启用状态,只显示"重置" + "取消" ═══
              <Button variant="orange" size="md" icon="edit-3" onClick={resetToEdit}>{tr('tenant.4b9c32')}</Button>
            ) : (
              // ═══ isViewOnly=false:编辑态,显示"启用邮件服务" + "取消" ═══
              <Button variant="primary" size="md" icon="mail" loading={state.saving} onClick={confirmEnable}>{tr('tenant.fd823d')}</Button>
            )}
            <Button variant="ghost" size="md" icon="x" onClick={shell.closeModal}>{tr('tenant.625fb2')}</Button>
          </>
        ),
      });
    };
    render();
    loadDomain();
  }, [shell]);
}

function useSocialConfigModal() {
  const shell = useShell();
  return React.useCallback((tenant) => {
    const state = {
      view: 'list',                  // list | edit
      editingId: null,
      configs: [],
      form: { type: 'Google', clientId: '', clientSecret: '', redirect: '' },
      loading: false,
      saving: false,
      types: ['Google'],
    };
    const socialTypes = state.types;
    const typeIconMap = { Google: 'chrome', GitHub: 'github', Microsoft: 'square', WeChat: 'message-circle', Facebook: 'facebook', 'X (Twitter)': 'twitter', GitLab: 'gitlab' };
    const typeColorMap = { Google: '#4285F4', GitHub: 'var(--fg-0)', Microsoft: '#00A4EF', WeChat: 'var(--accent)', Facebook: '#1877F2', 'X (Twitter)': 'var(--fg-0)', GitLab: '#FC6D26' };

    const genId = () => (state.configs.length ? Math.max(...state.configs.map(c => c.id)) + 1 : 1);
    const resetForm = () => { state.form = { type: 'Google', clientId: '', clientSecret: '', redirect: '' }; };

    const loadSocial = async () => {
      state.loading = true;
      render();
      try {
        const j = await window.ociApi.request('/social/list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant) }),
        });
        const list = (j && Array.isArray(j.data)) ? j.data : [];
        state.configs = list.map((c, i) => ({
          id: c.id || (i + 1),
          type: c.socialTypeStr || 'Google',
          clientId: c.clientId || '',
          redirect: c.redirectUrl || '',
          enabled: c.socialStatus !== 'disabled',
        }));
      } catch (e) {
        state.configs = [];
        shell.showToast(tr('tenant.e1681d') + (e.message || e), { kind: 'error' });
      } finally {
        state.loading = false;
        render();
      }
    };

    const loadTypes = async () => {
      try {
        const j = await window.ociApi.request('/social/availableLoginTypes', { method: 'POST' });
        const list = (j && Array.isArray(j.data)) ? j.data : [];
        if (list.length) state.types = list;
      } catch (e) { /* 保留默认 */ }
    };

    const saveConfig = async () => {
      const type = state.form.type;
      const redirect = state.form.redirect || `https://${tenantLabel(tenant).replace(/\*/g,'')}.oci.cloud/auth/${String(type).toLowerCase().split(' ')[0]}`;
      const payload = {
        tenantId: getTenantDbId(tenant),
        clientId: state.form.clientId.trim(),
        clientSecret: state.form.clientSecret,
        socialTypeStr: type,
        redirectUrl: redirect,
        tenancy: tenant.tenancy || '',
        cloudType: 1,
        socialStatus: 'active',
      };
      if (state.editingId) payload.id = state.editingId;
      state.saving = true;
      render();
      try {
        const result = await window.ociApi.request(state.editingId ? '/social/update' : '/social/add', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!result || result.success !== true) throw new Error(result?.message || tr('tenant.fc571c'));
        shell.showToast(state.editingId ? tr('tenant.52d8d7').replace('{0}',type) : tr('tenant.861090').replace('{0}',type), { kind: 'success' });
        state.view = 'list';
        resetForm();
        await loadSocial();
      } catch (e) {
        shell.showToast(tr('tenant.40f902') + (e.message || e), { kind: 'error' });
      } finally {
        state.saving = false;
        if (typeof render === 'function') render();
      }
    };

    const toggleConfig = async (c) => {
      const act = c.enabled ? '/social/disable' : '/social/enable';
      try {
        const result = await window.ociApi.request(act, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant), id: c.id, socialStatus: c.enabled ? 'disabled' : 'active' }),
        });
        if (!result || result.success !== true) throw new Error(result?.message || tr('tenant.a79e3f'));
        c.enabled = !c.enabled;
        shell.showToast(tr('tenant.a495a5').replace('{0}',c.type).replace('{1}',c.enabled ? tr('tenant.enable') : tr('tenant.disable')), { kind: 'info' });
        render();
      } catch (e) {
        shell.showToast(tr('tenant.be4a60') + (e.message || e), { kind: 'error' });
      }
    };

    const configRemove = async (c) => {
      try {
        const result = await window.ociApi.request('/social/disable', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: getTenantDbId(tenant), id: c.id }),
        });
        if (!result || result.success !== true) throw new Error(result?.message || tr('tenant.31385f'));
      } catch (e) {
        shell.showToast(tr('tenant.ad23f0') + (e.message || e), { kind: 'error' });
        return;
      }
      const idx = state.configs.findIndex(x => x.id === c.id);
      if (idx >= 0) state.configs.splice(idx, 1);
      shell.showToast(tr('tenant.1e5301').replace('{0}',c.type), { kind: 'warn' });
      render();
    };

    const render = () => {
      shell.openModal({
        title: tr('tenant.946278'),
        subtitle: <span><span className="mono">{tenantLabel(tenant)}</span> {tr('tenant.569dbc')} <b>{state.configs.length}</b> {tr('tenant.61e795')}</span>,
        icon: 'share-2',
        iconColor: 'var(--violet)',
        size: 'lg',
        body: (
          <div style={{ padding: 16 }}>
            {state.view === 'list' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }} />
                  <Button size="sm" variant="primary" icon="plus"
                    onClick={() => { state.view = 'edit'; state.editingId = null; resetForm(); render(); }}
                  >{tr('tenant.80e2ca')}</Button>
                  <Button size="sm" variant="cyan" icon="refresh-cw"
                    loading={state.loading}
                    onClick={() => loadSocial()}
                  >{tr('tenant.a4793f')}</Button>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowY: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[
                          { h: tr('tenant.226b09'),      w: 120 },
                          { h: 'Client ID' },
                          { h: tr('tenant.0b7741') },
                          { h: tr('tenant.3fea7c'),      w: 90,  align: 'center' },
                          { h: tr('tenant.2b6bc0'),      w: 100, align: 'center' },
                        ].map((c, i) => (
                          <th key={i} style={{
                            textAlign: c.align || 'center', padding: '10px 12px', width: c.w,
                            background: 'var(--bg-2)', color: 'var(--fg-3)',
                            fontSize: 10.5, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                            borderBottom: '1px solid var(--border)',
                            position: 'sticky', top: 0, zIndex: 1,
                          }}>{c.h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.configs.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 50, textAlign: 'center', color: 'var(--fg-3)' }}>
                            <Icon name="share-2" size={28} style={{ marginBottom: 8, color: 'var(--fg-3)' }} />
                            <div style={{ fontSize: 12 }}>{tr('tenant.978e5c')}</div>
                            <button type="button"
                              onClick={() => { state.view = 'edit'; state.editingId = null; resetForm(); render(); }}
                              style={{ marginTop: 12, padding: '5px 14px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: 'var(--accent-fg)', fontSize: 11, cursor: 'pointer' }}
                            >{tr('tenant.c11746')}</button>
                          </td>
                        </tr>
                      ) : state.configs.map((c, i) => (
                        <tr key={c.id} style={{ background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Icon name={typeIconMap[c.type] || 'share-2'} size={13} style={{ color: typeColorMap[c.type] || 'var(--fg-1)' }} />
                              <span style={{ fontWeight: 500, color: 'var(--fg-0)' }}>{c.type}</span>
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{c.clientId}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-1)' }}>{c.redirect}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <span style={{
                              padding: '1px 8px', borderRadius: 3, fontSize: 10.5, fontWeight: 500,
                              background: c.enabled ? 'var(--accent-soft)' : 'var(--bg-3)',
                              color: c.enabled ? 'var(--accent)' : 'var(--fg-3)',
                            }}>{c.enabled ? tr('tenant.53ace4') : tr('tenant.463776')}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button type="button" title={tr('tenant.95b351')}
                                onClick={() => { state.view = 'edit'; state.editingId = c.id; state.form = { type: c.type, clientId: c.clientId, clientSecret: '', redirect: c.redirect }; render(); }}
                                style={{ width: 24, height: 24, borderRadius: 3, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name="edit-3" size={11} /></button>
                              <button type="button" title={c.enabled ? tr('tenant.710ad0') : tr('tenant.7854b5')}
                                onClick={() => toggleConfig(c)}
                                style={{ width: 24, height: 24, borderRadius: 3, background: c.enabled ? 'var(--bg-2)' : 'var(--accent-soft)', border: '1px solid ' + (c.enabled ? 'var(--border)' : 'var(--accent)'), color: c.enabled ? 'var(--fg-1)' : 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name={c.enabled ? 'pause' : 'play'} size={11} /></button>
                              <button type="button" title={tr('tenant.2f4aad')}
                                onClick={() => shell.openConfirm({
                                  title: tr('tenant.261c6f').replace('{0}',c.type),
                                  body: <div>{tr('tenant.0f5863')}</div>,
                                  danger: true, confirmLabel: tr('tenant.2f4aad'),
                                  onConfirm: () => configRemove(c),
                                })}
                                style={{ width: 24, height: 24, borderRadius: 3, background: 'var(--danger)', border: 'none', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              ><Icon name="trash-2" size={11} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* Edit / Add view */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <button type="button"
                    onClick={() => { state.view = 'list'; resetForm(); render(); }}
                    style={{
                      padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                      borderRadius: 4, color: 'var(--fg-1)', cursor: 'pointer', fontSize: 11,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  ><Icon name="arrow-left" size={11} />{tr('tenant.adcd1d')}</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
                    {state.editingId ? tr('tenant.e9e8c2') : tr('tenant.abfca5')}
                  </span>
                </div>

                <div style={{
                  padding: 16, background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <FormRow label={tr('tenant.226b09')} required>
                    <CustomDropdown value={state.form.type}
                      onChange={e => { state.form.type = e; render(); }} height={32} width="100%">
                      {socialTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </CustomDropdown>
                  </FormRow>

                  <FormRow label="Client ID" required>
                    <TextInput value={state.form.clientId}
                      onChange={v => { state.form.clientId = v; render(); }}
                      placeholder={tr('tenant.9ceb27')}
                      mono
                    />
                  </FormRow>

                  <FormRow label="Client Secret" required hint={tr('tenant.dbc540')}>
                    <PasswordInput value={state.form.clientSecret} onChange={v => { state.form.clientSecret = v; render(); }} placeholder="Client Secret" />
                  </FormRow>

                  <FormRow label={tr('tenant.0b7741')} required hint={tr('tenant.de9cca')}>
                    <TextInput value={state.form.redirect || `https://${tenantLabel(tenant).replace(/\*/g,'')}.oci.cloud/auth/${state.form.type.toLowerCase().split(' ')[0]}`}
                      onChange={v => { state.form.redirect = v; render(); }}
                      placeholder={`https://your-domain.com/auth/${state.form.type.toLowerCase()}`}
                      mono
                    />
                  </FormRow>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <Button size="md" variant="ghost" onClick={() => { state.view = 'list'; resetForm(); render(); }}>{tr('tenant.625fb2')}</Button>
                  <Button size="md" variant="primary" icon="save"
                    loading={state.saving}
                    onClick={() => {
                      if (!state.form.clientId.trim()) { shell.showToast(tr('tenant.ef65c7'), { kind: 'warn' }); return; }
                      if (!state.form.clientSecret.trim() && !state.editingId) { shell.showToast(tr('tenant.913865'), { kind: 'warn' }); return; }
                      if (state.editingId && !state.form.clientSecret.trim()) {
                        const idx = state.configs.findIndex(c => c.id === state.editingId);
                        if (idx >= 0) state.form.clientSecret = state.configs[idx].__secret || '';
                      }
                      saveConfig();
                    }}
                  >{tr('tenant.be5fbb')}</Button>
                </div>
              </>
            )}
          </div>
        ),
        footer: state.view === 'list' ? <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button> : null,
      });
    };
    render();
    loadTypes();
    loadSocial();
  }, [shell]);
}

// ─── 账号更新(update-account) ──────────────────────────────────
// 对齐原项目:updateTenancyDetail + regionSub + getPasspolicy + fetchCost
// 分阶段拉取元数据,每步显示进度和结果
function useUpdateAccountModal() {
  // ═══════════════════════════════════════════════════════════════════════
  // 账号更新 · 严格对齐原项目 handleUpdateAccountDetail
  //   /tenants/updateTenant 走 EventSource · progress 事件流
  //   UI 是一个终端风格的日志窗口,消息一行行追加,底部自动滚动
  // ═══════════════════════════════════════════════════════════════════════
  const shell = useShell();
  return React.useCallback((tenant) => {
    // 先弹二次确认(对齐原项目的 Swal 确认)
    shell.openConfirm({
      title: tr('tenant.993f1b').replace('{0}',getTenantName(tenant)),
      body: <div>{tr('tenant.72e05f')} <span className="mono">/tenants/updateTenant</span> {tr('tenant.9e334c')}</div>,
      confirmLabel: tr('tenant.6f80db'),
      onConfirm: () => runUpdate(tenant),
    });

    function runUpdate(tenant) {
      // 真实 SSE:/tenants/updateTenant?tenantId=xxx · progress/success/error 事件流
      let es = null;
      const state = {
        lines: ['[System] connecting to /tenants/updateTenant ...'],
        running: true,
        startedAt: Date.now(),
      };
      const scrollRef = { el: null };

      const render = () => {
        shell.openModal({
          title: tr('tenant.da428c').replace('{0}',getTenantName(tenant)),
          subtitle: <span>SSE stream · <span className="mono" style={{ color: 'var(--fg-3)' }}>/tenants/updateTenant?tenantId={getTenantDbId(tenant)}</span></span>,
          icon: 'refresh-cw',
          iconColor: 'var(--accent)',
          size: 'lg',
          dismissable: !state.running,
          body: (
            <div style={{ padding: 20 }}>
              {/* 状态条 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', marginBottom: 12,
                background: state.running ? 'var(--info-soft)' : 'var(--accent-soft)',
                border: '1px solid ' + (state.running ? 'var(--info)' : 'var(--accent)'),
                borderRadius: 6,
              }}>
                <Icon name={state.running ? 'loader' : 'check-circle'} size={14}
                  style={{ color: state.running ? 'var(--info)' : 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: state.running ? 'var(--info)' : 'var(--accent)' }}>
                  {state.running ? 'streaming ...' : 'connection closed · success'}
                </span>
                <span style={{ flex: 1 }} />
                <span className="num mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  {((Date.now() - state.startedAt) / 1000).toFixed(1)}s · {state.lines.length} lines
                </span>
              </div>

              {/* 终端日志窗口(对齐原项目 #sse-messages) */}
              <div
                ref={el => {
                  scrollRef.el = el;
                  if (el) el.scrollTop = el.scrollHeight;
                }}
                style={{
                  height: 340, overflowY: 'auto',
                  padding: 14,
                  background: '#0a0f14',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  lineHeight: 1.7,
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {state.lines.map((line, i) => {
                  let color = '#c9d1d9';
                  if (line.startsWith('[System]')) color = '#7ee787';
                  else if (line.startsWith('→')) color = '#79c0ff';
                  else if (line.trim().startsWith('✓')) color = '#7ee787';
                  else if (line.trim().startsWith('·')) color = '#8b949e';
                  else if (line.trim().startsWith('✗')) color = '#ff7b72';
                  return (
                    <div key={i} style={{ color }}>
                      {i === state.lines.length - 1 && state.running && line ? (
                        <>{line}<span style={{
                          display: 'inline-block', width: 7, height: 12,
                          background: '#7ee787', marginLeft: 4,
                          verticalAlign: 'middle',
                          animation: 'pulse-dot 1s infinite',
                        }} /></>
                      ) : line || '\u00a0'}
                    </div>
                  );
                })}
                {state.lines.length === 0 && (
                  <span style={{ color: '#8b949e' }}>connecting ...</span>
                )}
              </div>
            </div>
          ),
          footer: state.running ? (
            <Button variant="ghost" size="md"
              onClick={() => { if (es) es.close(); state.running = false; state.lines.push('[System] aborted by user'); render(); shell.showToast(tr('tenant.c12968'), { kind: 'warn' }); }}
            >{tr('tenant.625fb2')}</Button>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>
              <Button variant="outline" size="md" icon="clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(state.lines.join('\n'));
                  shell.showToast(tr('tenant.6a523f'), { kind: 'success' });
                }}
              >{tr('tenant.3615f7')}</Button>
            </>
          ),
        });
      };

      const openSse = () => {
        es = new EventSource('/tenants/updateTenant?tenantId=' + encodeURIComponent(getTenantDbId(tenant)));
        es.addEventListener('progress', (e) => {
          if (e.data) state.lines.push(e.data);
          render();
        });
        es.addEventListener('success', () => {
          state.lines.push('[System] event: success · SSE connection closed');
          state.running = false;
          try { es.close(); } catch (e) {}
          render();
          shell.showToast(tr('tenant.3996cc').replace('{0}',getTenantName(tenant)), { kind: 'success' });
        });
        es.addEventListener('error', (e) => {
          state.lines.push(e.data ? '[error] ' + e.data : '[System] event: error · SSE failed');
          state.running = false;
          try { es.close(); } catch (err) {}
          render();
          // 后端前置健康探测失败(账号封禁/网络故障)会通过 error 事件推送真实原因
          shell.showToast(e.data || tr('tenant.930442'), { kind: 'error' });
          window.dispatchEvent(new CustomEvent('ocip-refresh-page', { detail: 'tenants' }));
        });
        es.onerror = () => {
          if (es && es.readyState === EventSource.CLOSED) {
            state.running = false;
            render();
          }
        };
      };

      render();
      openSse();
    }
  }, [shell]);
}

// ═══════════════════════════════════════════════════════════════════════
// 导出租户 · 严格对齐原项目 doubleDimple/oci-start
//   exportDataByTenant(id) → handleSecureExport('/tenants/exportByTenant?id=...')
//
//   原项目流程:
//     1. POST /tenants/verify/sendExportCode  —— 向管理员邮箱发送 6 位验证码
//     2. Swal 弹输入框让用户填码
//     3. GET  /tenants/exportByTenant?id=xxx  · header X-Verify-Code
//     4. 通过则返回 JSON payload
//     5. Blob 下载 tenant_{id}_data.json
//
//   本 modal 用 3 步向导呈现:
//     [1] 确认导出 · 展示内容清单 + 敏感提示 → 点击"发送验证码"
//     [2] 输入 6 位验证码 · 60s 倒计时 · 重发按钮 · 6 格 OTP 输入
//     [3] 完成 · 展示文件预览(JSON) + 下载按钮 + 校验和
// ═══════════════════════════════════════════════════════════════════════
function useExportTenantModal() {
  const shell = useShell();
  return React.useCallback((tenant) => {
    const adminEmail = tenant.emailAddress || tr('tenant.3ce58a');

    const state = {
      step: 1,               // 1: 确认  2: 验证码  3: 完成
      codeInput: ['', '', '', '', '', ''],
      codeError: '',
      codeSentAt: 0,
      remaining: 0,
      sending: false,
      payload: null,
      downloadedAt: null,
      size: 0,
      sha: '',
    };

    let countdownTimer = null;
    const clearTimer = () => { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } };
    const startCountdown = () => {
      clearTimer();
      state.codeSentAt = Date.now();
      state.remaining = 60;
      countdownTimer = setInterval(() => {
        state.remaining -= 1;
        if (state.remaining <= 0) { clearTimer(); }
        render();
      }, 1000);
    };

    const sendCode = () => {
      state.sending = true;
      state.codeError = '';
      render();
      window.ociApi.request('/tenants/verify/sendExportCode', { method: 'POST' })
      .then(() => {
        state.sending = false;
        startCountdown();
        state.step = 2;
        render();
        shell.showToast(tr('tenant.c2d5de').replace('{0}',adminEmail), { kind: 'info', duration: 4000 });
      })
      .catch((e) => {
        state.sending = false;
        render();
        shell.showToast(tr('tenant.8a4a23') + (e.message || e), { kind: 'error' });
      });
    };

    // 真实后端返回的是 tenant 列表(数组),含子租户与 key_file_content
    const redact = (obj) => {
      if (Array.isArray(obj)) return obj.map(redact);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'key_file_content') out[k] = v ? tr('tenant.a0cf4b') : v;
          else out[k] = redact(v);
        }
        return out;
      }
      return obj;
    };

    const recomputeStats = async () => {
      if (!state.payload) return;
      const text = JSON.stringify(state.payload, null, 2);
      state.size = new TextEncoder().encode(text).length;
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        state.sha = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        state.sha = '';
      }
      render();
    };

    const computeStats = () => ({ size: state.size, sha: state.sha });

    const verifyAndBuild = async () => {
      const code = state.codeInput.join('');
      if (code.length !== 6) { state.codeError = tr('tenant.558bd4'); render(); return; }
      if (!/^\d{6}$/.test(code)) { state.codeError = tr('tenant.1d7257'); render(); return; }
      state.codeError = '';
      render();
      try {
        const payload = await window.ociApi.request('/tenants/exportByTenant?id=' + encodeURIComponent(getTenantDbId(tenant)), {
          headers: { 'X-Verify-Code': code },
        });
        clearTimer();
        state.payload = payload;
        state.step = 3;
        render();
        recomputeStats();
      } catch (e) {
        state.codeError = (e.status === 403 ? tr('tenant.ef0f97') : (tr('tenant.2e0d8c') + (e.message || e)));
        render();
      }
    };

    // 6 格 OTP 输入
    const OtpInput = () => (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        {state.codeInput.map((d, i) => (
          <input key={i}
            id={`otp-${i}`}
            type="text" inputMode="numeric" maxLength={1}
            value={d}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(-1);
              state.codeInput[i] = v;
              state.codeError = '';
              if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
              render();
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace' && !state.codeInput[i] && i > 0) {
                document.getElementById(`otp-${i - 1}`)?.focus();
              }
              if (e.key === 'Enter' && state.codeInput.every(x => x)) verifyAndBuild();
            }}
            onPaste={e => {
              const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (paste) {
                e.preventDefault();
                paste.split('').forEach((c, j) => { state.codeInput[j] = c; });
                render();
                document.getElementById(`otp-${Math.min(5, paste.length - 1)}`)?.focus();
              }
            }}
            style={{
              width: 42, height: 50,
              textAlign: 'center', fontSize: 20, fontWeight: 600,
              background: 'var(--bg-2)',
              color: 'var(--fg-0)',
              border: `1.5px solid ${state.codeError ? 'var(--danger)' : d ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              transition: 'border-color 120ms',
            }}
          />
        ))}
      </div>
    );

    const doDownload = () => {
      const payload = JSON.stringify(state.payload, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant_${getTenantDbId(tenant)}_data.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      state.downloadedAt = new Date();
      render();
      shell.showToast(tr('tenant.845127').replace('{0}',getTenantDbId(tenant)), { kind: 'success' });
    };

    const render = () => {
      const stats = computeStats();
      const tenantList = Array.isArray(state.payload) ? state.payload : [];
      const childCount = tenantList.reduce((acc, t) => acc + (Array.isArray(t.children) ? t.children.length : 0), 0);
      const keyCount = tenantList.reduce((acc, t) => acc + (t.key_file_content ? 1 : 0) + (Array.isArray(t.children) ? t.children.filter(c => c.key_file_content).length : 0), 0);

      const previewJson = state.payload ? JSON.stringify(redact(state.payload), null, 2) : '';

      shell.openModal({
        title: tr('tenant.b63d12').replace('{0}',getTenantName(tenant)),
        subtitle: <span><span className="mono">{tenantLabel(tenant)}</span> · Secure Export · <span className="mono" style={{ color: 'var(--fg-3)' }}>/tenants/exportByTenant?id={getTenantDbId(tenant)}</span></span>,
        icon: 'download',
        iconColor: 'var(--cyan)',
        size: 'lg',
        dismissable: state.step !== 3 || !!state.downloadedAt,
        body: (
          <div style={{ padding: 20 }}>
            {/* ─── 步骤指示器 ─── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginBottom: 20, padding: '4px 0',
            }}>
              {[
                { n: 1, label: tr('tenant.3ca522') },
                { n: 2, label: tr('tenant.9b99e2') },
                { n: 3, label: tr('tenant.5dfd5a') },
              ].map((s, i) => {
                const active = state.step === s.n;
                const done = state.step > s.n;
                return (
                  <React.Fragment key={s.n}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: done ? 'var(--accent)' : active ? 'var(--info)' : 'var(--bg-3)',
                        color: done || active ? 'var(--accent-fg)' : 'var(--fg-3)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                      }} className="num">
                        {done ? <Icon name="check" size={12} strokeWidth={3} /> : s.n}
                      </div>
                      <span style={{
                        fontSize: 12,
                        color: active ? 'var(--fg-0)' : done ? 'var(--accent)' : 'var(--fg-3)',
                        fontWeight: active ? 600 : 400,
                      }}>{s.label}</span>
                    </div>
                    {i < 2 && <div style={{
                      flex: 1, height: 2,
                      background: state.step > s.n ? 'var(--accent)' : 'var(--border)',
                      transition: 'background 200ms',
                    }} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ══════ STEP 1: 确认导出内容 ══════ */}
            {state.step === 1 && (
              <>
                <div style={{
                  padding: '10px 12px', marginBottom: 14,
                  background: 'var(--danger-soft)',
                  border: '1px solid var(--danger)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <Icon name="alert-triangle" size={14} style={{ color: 'var(--danger)', marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>{tr('tenant.2eaf64')}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 3, lineHeight: 1.6 }}>
                      {tr('tenant.11a9c5')} <b>{tr('tenant.871ffd')}</b>{tr('tenant.df4fba')}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {tr('tenant.6094d1')}
                </div>
                <div style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, overflow: 'hidden',
                  marginBottom: 14,
                }}>
                  {[
                    { icon: 'server',      label: tr('tenant.de7491'),  detail: tr('tenant.c3d1be'),   count: `${tenantList.length || 1}`, danger: false },
                    { icon: 'layers',      label: tr('tenant.65cefc'),      detail: tr('tenant.4b737b'),          count: `${childCount}`, danger: false },
                    { icon: 'file-key',    label: tr('tenant.482c92'),    detail: tr('tenant.54c93d'),      count: `${keyCount}`, danger: true },
                  ].map((it, i, arr) => (
                    <div key={it.label} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 5,
                        background: it.danger ? 'var(--danger-soft)' : 'var(--bg-2)',
                        color: it.danger ? 'var(--danger)' : 'var(--fg-1)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon name={it.icon} size={13} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {it.label}
                          {it.danger && <span style={{ padding: '0 5px', background: 'var(--danger)', color: 'white', borderRadius: 2, fontSize: 9, fontWeight: 700 }}>{tr('tenant.1ff879')}</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{it.detail}</div>
                      </div>
                      <span className="num mono" style={{
                        padding: '2px 8px',
                        background: 'var(--bg-3)', color: 'var(--fg-1)',
                        borderRadius: 3, fontSize: 11, fontWeight: 500,
                      }}>{it.count}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  padding: '10px 12px',
                  background: 'var(--info-soft)',
                  border: '1px solid var(--info)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="mail" size={14} style={{ color: 'var(--info)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--info)', fontWeight: 600 }}>{tr('tenant.238811')}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--fg-0)', marginTop: 2 }}>{adminEmail}</div>
                  </div>
                </div>
              </>
            )}

            {/* ══════ STEP 2: 邮箱验证码 ══════ */}
            {state.step === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, margin: '0 auto 12px',
                    borderRadius: '50%',
                    background: 'var(--info-soft)',
                    color: 'var(--info)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="mail" size={20} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 4 }}>
                    {tr('tenant.558bd4')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>
                    {tr('tenant.493384')} <span className="mono" style={{ color: 'var(--fg-0)' }}>{adminEmail}</span>
                  </div>
                </div>

                <OtpInput />

                {state.codeError && (
                  <div style={{
                    padding: '6px 10px', margin: '4px auto 8px',
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    borderRadius: 4,
                    fontSize: 11.5, textAlign: 'center',
                    maxWidth: 320,
                  }}>
                    <Icon name="alert-circle" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {state.codeError}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 12, fontSize: 11.5, color: 'var(--fg-2)',
                }}>
                  <span>{tr('tenant.99816a')}</span>
                  {state.remaining > 0 ? (
                    <span className="num mono" style={{ color: 'var(--fg-3)' }}>{state.remaining}{tr('tenant.d71f09')}</span>
                  ) : (
                    <button onClick={sendCode}
                      style={{
                        padding: '2px 10px', background: 'transparent',
                        color: 'var(--info)', border: 'none', cursor: 'pointer',
                        fontSize: 11.5, fontWeight: 500, fontFamily: 'inherit',
                        textDecoration: 'underline',
                      }}>{tr('tenant.8e1f29')}</button>
                  )}
                </div>
              </>
            )}

            {/* ══════ STEP 3: 下载文件 ══════ */}
            {state.step === 3 && (
              <>
                <div style={{
                  padding: '12px 14px', marginBottom: 14,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="shield-check" size={16} style={{ color: 'var(--accent)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{tr('tenant.3f5077')}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 2 }}>
                      {tr('tenant.0c5196')}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: 14, marginBottom: 14,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 6,
                      background: 'var(--bg-2)',
                      color: 'var(--cyan)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="file-down" size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mono" style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>tenant_{getTenantDbId(tenant)}_data.json</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 3, display: 'flex', gap: 10 }}>
                        <span className="num">{(stats.size / 1024).toFixed(2)} KB</span>
                        <span>·</span>
                        <span>application/json</span>
                        <span>·</span>
                        <span>{tenantList.length} tenant · {childCount} child</span>
                      </div>
                    </div>
                    <button onClick={doDownload}
                      style={{
                        padding: '8px 16px',
                        background: state.downloadedAt ? 'var(--bg-2)' : 'var(--accent)',
                        color: state.downloadedAt ? 'var(--fg-1)' : 'var(--accent-fg)',
                        border: state.downloadedAt ? '1px solid var(--border)' : 'none',
                        borderRadius: 5, cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      <Icon name={state.downloadedAt ? 'refresh-cw' : 'download'} size={12} />
                      {state.downloadedAt ? tr('tenant.754569') : tr('tenant.5dfd5a')}
                    </button>
                  </div>

                  {/* SHA-256 校验和 */}
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: '1px dashed var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 10.5, color: 'var(--fg-3)',
                  }}>
                    <span>SHA-256</span>
                    <span className="mono" style={{ color: 'var(--fg-1)', flex: 1 }}>{stats.sha || tr('tenant.0d6676')}</span>
                    <button onClick={() => { navigator.clipboard.writeText(stats.sha); shell.showToast(tr('tenant.5779cb'), { kind: 'info' }); }}
                      style={{
                        padding: '2px 6px', background: 'var(--bg-2)',
                        color: 'var(--fg-2)', border: '1px solid var(--border)',
                        borderRadius: 3, cursor: 'pointer',
                        fontSize: 10, fontFamily: 'inherit',
                      }}>{tr('tenant.79d3ab')}</button>
                  </div>
                  {state.downloadedAt && (
                    <div style={{
                      marginTop: 8, fontSize: 10.5, color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Icon name="check-circle" size={11} />
                      {tr('tenant.8c5e35')} {state.downloadedAt.toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="eye" size={11} />
                  {tr('tenant.1d9324')}
                </div>
                <pre style={{
                  margin: 0,
                  padding: 12,
                  background: '#0a0f14',
                  color: '#c9d1d9',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  lineHeight: 1.5,
                  maxHeight: 200,
                  overflow: 'auto',
                }}>{previewJson || '\u00a0'}</pre>
              </>
            )}
          </div>
        ),
        footer: (
          <>
            {state.step === 1 && (
              <Button variant="primary" size="md" icon="mail" loading={state.sending} onClick={sendCode}>{tr('tenant.c5c358')}</Button>
            )}
            {state.step === 2 && (
              <Button variant="primary" size="md" icon="shield-check"
                onClick={verifyAndBuild} disabled={!state.codeInput.every(x => x)}
              >{tr('tenant.ec988e')}</Button>
            )}
            {state.step === 3 && (
              <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('tenant.b15d91')}</Button>
            )}
          </>
        ),
      });
    };
    render();
  }, [shell]);
}
Object.assign(window, {
  useAddBootModal,
  useTenantProxyQuickModal,
  useApiImportModal, useImportTenantsModal,
  useTenantDetailDrawer,
  useUserManageModal,
  useRegionSubscribeModal, useTrafficAlertModal,
  useMailModal, useSocialConfigModal,
  useUpdateAccountModal, useExportTenantModal,
  // 供独立的租户详情页调用
  showDiskModal, showSecurityModal, showResourceModal, showStorageModal, showMysqlModal,
  MiniMetric,
});
