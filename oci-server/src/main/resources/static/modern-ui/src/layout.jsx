// Layout — hierarchical sidebar (like reference screenshots) + topbar

const buildNav = (tr) => [
{
  id: 'service',
  label: tr('nav.service'),
  icon: 'layers',
  color: 'var(--accent)',
  items: [
  { id: 'monitor', label: tr('nav.monitor'), icon: 'activity' },
  { id: 'regions', label: tr('nav.regions'), icon: 'globe' },
  { id: 'tenants', label: tr('nav.tenants'), icon: 'users' },
  { id: 'instances', label: tr('nav.instances'), icon: 'server' },
  { id: 'mail', label: tr('nav.mail'), icon: 'mail' },
  { id: 'object', label: tr('nav.object'), icon: 'database' },
  { id: 'grab', label: tr('nav.grab'), icon: 'zap' },
  { id: 'ai', label: tr('nav.ai'), icon: 'brain-circuit' },
  { id: 'link', label: tr('nav.link'), icon: 'wifi' },
  { id: 'logs', label: tr('nav.logs'), icon: 'terminal' }]

},
{
  id: 'proxy',
  label: tr('nav.proxy'),
  icon: 'shuffle',
  color: 'var(--cyan)',
  items: [
  // 严格对齐原项目"代理管理":秘钥配置 / CF管理 / EO管理
  // (API Token 的"秘钥配置"归属"开发配置"分组,见下方 devConfig)
  { id: 'proxyKeyConfig', label: tr('nav.proxyKeyConfig'), icon: 'key' },
  { id: 'cfManage',       label: tr('nav.cfManage'),       icon: 'cloud' },
  { id: 'eoManage',       label: tr('nav.eoManage'),       icon: 'network' }]

},
{
  id: 'resource',
  label: tr('nav.resource'),
  icon: 'package',
  color: 'var(--violet)',
  // 严格对齐原项目 sidebar.vps.management → 只有一项"资源列表"
  items: [
  { id: 'resList', label: tr('nav.resList'), icon: 'server' }]

},
{
  id: 'system',
  label: tr('nav.system'),
  icon: 'settings',
  color: 'var(--orange)',
  // 严格对齐原项目"系统管理"4 子项
  items: [
  { id: 'sysIpQuality', label: tr('nav.sysIpQuality'), icon: 'shield' },
  { id: 'sysLogs',      label: tr('nav.sysLogs'),      icon: 'file-text' },
  { id: 'sysSetting',   label: tr('nav.sysSetting'),   icon: 'shield-check' },
  { id: 'sysVpnProxy',  label: tr('nav.sysVpnProxy'),  icon: 'shuffle' }]

},
{
  // 严格对齐原项目"我的工具" sidebar.my.tools · 4 子项
  id: 'myTools',
  label: tr('nav.myTools'),
  icon: 'wrench',
  color: 'var(--info)',
  items: [
  { id: 'notifyMgmt', label: tr('nav.notifyMgmt'), icon: 'bell' },
  { id: 'memPage',    label: tr('nav.memPage'),    icon: 'book-open' },
  { id: 'migPage',    label: tr('nav.migPage'),    icon: 'arrow-left-right' },
  { id: 'mfaBackup',  label: tr('nav.mfaBackup'),  icon: 'smartphone' },
  { id: 'aiChat',     label: tr('nav.aiChat'),     icon: 'message-square', highlight: true }]

},
{
  // 严格对齐原项目"开发配置" sidebar.dev.config · 目前仅"秘钥配置"1 子项
  id: 'devConfig',
  label: tr('nav.devConfig'),
  icon: 'code-2',
  color: 'var(--violet)',
  items: [
  { id: 'keyConfig', label: tr('nav.keyConfig'), icon: 'key' }]

}];


// ─── 菜单搜索(侧边栏内嵌) ─────────────
// 模糊匹配 nav item.label / section.label / item.id · 键盘导航 · 高亮命中片段
function MenuSearch({ nav, onNavigate, placeholder }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const wrapRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // 打平 nav → 候选池 · 附带所属 section 便于展示面包屑
  const pool = React.useMemo(() => {
    const list = [];
    nav.forEach(sec => {
      sec.items.forEach(it => {
        list.push({
          id: it.id, label: it.label, icon: it.icon, highlight: it.highlight,
          section: { id: sec.id, label: sec.label, icon: sec.icon, color: sec.color },
        });
      });
    });
    return list;
  }, [nav]);

  // 模糊匹配 · 大小写不敏感 · 支持中英文子串
  // 命中优先级:label 开头 > label 包含 > section 包含 > id 包含
  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const scored = [];
    for (const c of pool) {
      const lab = c.label.toLowerCase();
      const sec = c.section.label.toLowerCase();
      const id  = c.id.toLowerCase();
      let score = 0;
      if (lab.startsWith(query)) score = 100;
      else if (lab.includes(query)) score = 70;
      else if (sec.includes(query)) score = 40;
      else if (id.includes(query)) score = 30;
      if (score > 0) scored.push({ ...c, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 12);
  }, [q, pool]);

  // q 变化重置光标 · 保证光标不越界
  React.useEffect(() => { setCursor(0); }, [q]);

  // 外部点击关闭
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (item) => {
    if (!item) return;
    onNavigate && onNavigate(item.id);
    setQ('');
    setOpen(false);
    inputRef.current && inputRef.current.blur();
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(results[cursor]);
    } else if (e.key === 'Escape') {
      if (q) { setQ(''); }
      else { setOpen(false); inputRef.current && inputRef.current.blur(); }
    }
  };

  // 高亮命中片段
  const highlight = (text, query) => {
    if (!query) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'transparent', color: 'var(--accent)', fontWeight: 600, padding: 0 }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // 光标进入可视区域
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[cursor];
    if (el && typeof el.scrollIntoView === 'function') {
      // 用 nearest 避免破坏父容器 · MIGRATION 里有说不要用 scrollIntoView
      // 但这是列表内部滚动,不会牵连外壳 · 用手动 offsetTop 更保险
      const parent = listRef.current;
      const top = el.offsetTop;
      const bot = top + el.offsetHeight;
      if (bot > parent.scrollTop + parent.clientHeight) parent.scrollTop = bot - parent.clientHeight;
      else if (top < parent.scrollTop) parent.scrollTop = top;
    }
  }, [cursor, open]);

  const showDropdown = open && q.trim().length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 28,
        width: '100%',
        background: 'var(--bg-2)',
        border: '1px solid ' + (open ? 'var(--accent)' : 'var(--border)'),
        borderRadius: 'var(--radius-sm)',
        transition: 'border-color 120ms',
      }}>
        <Icon name="search" size={12} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'inherit', fontSize: 12, color: 'var(--fg-0)',
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); inputRef.current && inputRef.current.focus(); }}
            title={tr('layout.288f0c')}
            style={{
              width: 16, height: 16, padding: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={11} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 50,
          overflow: 'hidden',
          animation: 'fade-in 120ms ease',
        }}>
          {results.length === 0 ? (
            <div style={{
              padding: '18px 14px',
              fontSize: 11.5, color: 'var(--fg-3)',
              textAlign: 'center',
            }}>
              <Icon name="search" size={16} style={{ display: 'block', margin: '0 auto 6px', color: 'var(--fg-3)', opacity: 0.5 }} />
              {tr('layout.a4d5b4')}
            </div>
          ) : (
            <>
              <div ref={listRef} style={{ maxHeight: 320, overflowY: 'auto', padding: 4 }}>
                {results.map((r, i) => {
                  const active = i === cursor;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => commit(r)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 8px',
                        background: active ? 'var(--bg-2)' : 'transparent',
                        border: 'none', borderRadius: 5,
                        color: 'var(--fg-1)', fontFamily: 'inherit',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 80ms',
                      }}
                    >
                      {/* section 主题色左侧竖条 */}
                      <span style={{
                        width: 3, alignSelf: 'stretch', borderRadius: 999,
                        background: r.section.color, flexShrink: 0,
                      }} />
                      <span style={{ color: r.section.color, display: 'inline-flex', flexShrink: 0 }}>
                        <Icon name={r.icon} size={13} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{
                          fontSize: 12, fontWeight: active ? 600 : 500,
                          color: 'var(--fg-0)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {highlight(r.label, q)}
                        </span>
                        <span style={{
                          fontSize: 10, color: 'var(--fg-3)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.section.label}
                        </span>
                      </span>
                      {r.highlight && (
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: 'var(--orange)', flexShrink: 0,
                          boxShadow: '0 0 0 2px ' + (active ? 'var(--bg-2)' : 'var(--bg-1)'),
                        }} />
                      )}
                      {active && (
                        <span className="mono" style={{
                          fontSize: 9, color: 'var(--fg-3)',
                          padding: '1px 5px', borderRadius: 3,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-1)',
                          flexShrink: 0,
                        }}>
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* footer 提示 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 10px',
                borderTop: '1px solid var(--border)',
                fontSize: 9.5, color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span>{results.length} {tr('layout.29645b')}</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span>{tr('layout.e8c28d')}</span>
                  <span>{tr('layout.fc5f86')}</span>
                  <span>{tr('tw.accent.esc')}</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


function PoolBrandMark({ size = 30 }) {
  const nodeXs = [13, 18, 23];
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={tr('layout.2e9579')}>
      <defs>
        <linearGradient id="pool-brand-gradient" x1="4" y1="3" x2="31" y2="33">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="34" height="34" rx="10" fill="url(#pool-brand-gradient)" />
      <path
        d="M10 20.4a4.2 4.2 0 0 1 2.6-7.5 6.1 6.1 0 0 1 11.6 1.2 3.7 3.7 0 0 1 .7 7.3H11.2"
        fill="none"
        stroke="oklch(0.14 0.02 155)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {nodeXs.map((x) => <circle key={'node-' + x} cx={x} cy="25.5" r="1.6" fill="oklch(0.14 0.02 155)" />)}
      {nodeXs.map((x) => <path key={'link-' + x} d={'M' + x + ' 23.9v-2.5'} stroke="oklch(0.14 0.02 155)" strokeWidth="1.4" />)}
    </svg>
  );
}

function getUserAvatarLabel(userName) {
  const normalized = String(userName || '').trim();
  if (!normalized) return '';
  const parts = normalized.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
}

function UserAvatar({ userName, size = 26 }) {
  const label = getUserAvatarLabel(userName);
  return (
    <div aria-label={label ? tr('layout.30fccd') + label : tr('layout.18dc83')} style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'oklch(0.14 0.02 155)',
      fontSize: size >= 32 ? 12 : 10.5, fontWeight: 700, letterSpacing: -0.2,
      flexShrink: 0,
    }}>
      {label || <Icon name="user" size={Math.round(size * 0.48)} />}
    </div>
  );
}

// ─── 关于与版本信息弹窗组件 (100% 对齐客户端图 1 与原版规范) ───────────
function AboutVersionPanel() {
  const { t: tr } = useT();
  const shell = useShell();
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [zoomImg, setZoomImg] = React.useState(null);
  const [copiedUsdt, setCopiedUsdt] = React.useState(false);
  const qrTimestamp = React.useMemo(() => Date.now(), []);

  React.useEffect(() => {
    let alive = true;
    window.ociApi.request('/api/version/check')
      .then((d) => { if (alive) setInfo(d); })
      .catch((e) => { if (alive) console.warn('version check failed', e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const fmt = (v) => (v && !/^v/i.test(v) ? `v${v}` : (v || tr('layout.7042f5')));
  const cur = fmt(info && info.currentVersion);
  const latest = fmt(info && info.latestVersion);
  const needUpdate = !!(info && info.needUpdate);

  const BSC_USDT_ADDR = '0x9d724717a27975521974b5eafd244c07f36fcf78';
  const copyUsdt = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(BSC_USDT_ADDR).then(() => {
      setCopiedUsdt(true);
      shell.showToast('BSC 充值收款地址已复制到剪贴板', { kind: 'success' });
      setTimeout(() => setCopiedUsdt(false), 2000);
    });
  };

  return (
    <div style={{ padding: '24px 28px 24px' }}>
      {/* 1. 顶部品牌与版本状态左右并排 (100% 对齐客户端图 1) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 20 }}>
        {/* 左侧品牌 Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0ea5e9',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.25)',
            flexShrink: 0
          }}>
            <Icon name="send" size={26} color="#0ea5e9" strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg-0)', letterSpacing: -0.3, lineHeight: 1.2 }}>
              OCI-POOL
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              Created by nodewebzsz
            </div>
          </div>
        </div>

        {/* 右侧版本对比卡 + 升级按钮 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 18px'
          }}>
            {/* 当前版本 */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>
                当前版本
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-0)' }}>
                  {loading ? '...' : cur}
                </span>
                {!loading && (
                  needUpdate ? (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: '#b45309',
                      background: '#fef3c7',
                      borderRadius: 4,
                      padding: '1px 5px',
                      lineHeight: '14px'
                    }}>
                      可更新
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: '#15803d',
                      background: '#dcfce7',
                      borderRadius: 4,
                      padding: '1px 5px',
                      lineHeight: '14px'
                    }}>
                      最新
                    </span>
                  )
                )}
              </div>
            </div>

            {/* 竖向分割线 */}
            <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 16px' }} />

            {/* 最新版本 */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>
                最新版本
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: needUpdate ? '#dc2626' : 'var(--fg-0)' }}>
                {loading ? '...' : latest}
              </div>
            </div>
          </div>

          {/* 发现新版本时的升级按钮 (对齐客户端红色大按钮) */}
          {!loading && needUpdate && (
            <a
              href={info?.downloadUrl || 'https://github.com/Nodewebzsz/oci-pool/releases'}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: '#dc2626',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                transition: 'opacity 150ms'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <Icon name="arrow-down-circle" size={13} color="#ffffff" />
              <span>升级指引与发布页</span>
            </a>
          )}
        </div>
      </div>

      {/* 2. 官方通道三列按钮 (100% 对齐客户端图 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { href: 'https://github.com/Nodewebzsz/oci-pool', label: '开源仓库', icon: 'code' },
          { href: 'https://t.me/+M7XhteVCMMU5ZDhh', label: 'Telegram', icon: 'send' },
          { href: 'https://github.com/Nodewebzsz/oci-pool/releases', label: '更新日志', icon: 'file-text' },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 0',
              borderRadius: 8,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              color: 'var(--fg-1)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 150ms'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--bg-3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-2)';
            }}
          >
            <Icon name={item.icon} size={14} color="var(--fg-2)" />
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* 3. 请作者喝杯咖啡 (100% 对齐客户端图 1 与原版模板) */}
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)' }}>
            <span>请作者喝杯咖啡</span>
            <span style={{ color: '#f43f5e' }}>❤️</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            点击二维码可放大预览
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {/* 微信支付卡片 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 10
          }}>
            <img
              src={`/images/weixin.JPG?t=${qrTimestamp}`}
              alt="微信支付"
              onClick={() => setZoomImg(`/images/weixin.JPG?t=${qrTimestamp}`)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                objectFit: 'cover',
                cursor: 'zoom-in',
                border: '1px solid var(--border)'
              }}
              title="点击放大预览"
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>
                <span style={{ color: '#07C160', display: 'inline-flex' }}>
                  <Icon name="message-circle" size={15} color="#07C160" />
                </span>
                <span>微信支付</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 6 }}>
                扫码赞赏支持
              </div>
            </div>
          </div>

          {/* 币安/USDT 卡片 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 10
          }}>
            <img
              src={`/images/binance_qr.jpg?t=${qrTimestamp}`}
              alt="币安打赏"
              onClick={() => setZoomImg(`/images/binance_qr.jpg?t=${qrTimestamp}`)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                objectFit: 'cover',
                cursor: 'zoom-in',
                border: '1px solid var(--border)'
              }}
              title="点击放大预览"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>
                <span style={{ color: '#F3BA2F', display: 'inline-flex' }}>
                  <Icon name="dollar-sign" size={15} color="#F3BA2F" />
                </span>
                <span>币安/USDT</span>
              </div>
              <div
                onClick={copyUsdt}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 6,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  color: copiedUsdt ? 'var(--accent)' : 'var(--fg-2)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 120ms'
                }}
                title="点击复制 BSC 收款地址: 0x9d724717a27975521974b5eafd244c07f36fcf78"
              >
                <Icon name={copiedUsdt ? "check" : "copy"} size={11} color={copiedUsdt ? "var(--accent)" : "var(--fg-3)"} />
                <span>{copiedUsdt ? '已复制' : 'BSC 复制地址'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 二维码放大灯箱 (Lightbox) */}
      {zoomImg && (
        <div
          onClick={() => setZoomImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomImg}
            alt="放大预览"
            style={{
              maxWidth: '85vw',
              maxHeight: '80vh',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          />
        </div>
      )}
    </div>
  );
}

function openAboutModal(shell, tr) {
  shell.openModal({
    title: tr('layout.81d9f5') || '关于',
    subtitle: 'OCI-POOL',
    icon: 'info',
    iconColor: 'var(--accent)',
    width: 680,
    body: <AboutVersionPanel />,
    footer: (
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('layout.b15d91') || '关闭'}</Button>
      </div>
    ),
  });
}

function Sidebar({ activePage, onNavigate, collapsed = false, tabletOverlay = false, onNavigateComplete }) {
  const shell = useShell();
  const { t: tr } = useT();
  const NAV = buildNav(tr);

  // Determine which section is active based on activePage
  const activeSectionId = React.useMemo(() => {
    for (const sec of NAV) {
      if (sec.items.some((i) => i.id === activePage)) return sec.id;
    }
    return 'service';
  }, [activePage, NAV]);

  // Expanded state per section
  const [expanded, setExpanded] = React.useState(() => {
    const initial = {};
    NAV.forEach((sec) => {initial[sec.id] = sec.id === activeSectionId;});
    return initial;
  });

  // 手风琴模式:activePage 变化时,只展开活跃 section,其他自动折叠
  // (用户手动点击 section header 仍可自由切换,不受此约束)
  React.useEffect(() => {
    setExpanded(() => {
      const next = {};
      NAV.forEach((sec) => { next[sec.id] = sec.id === activeSectionId; });
      return next;
    });
  }, [activeSectionId]);

  // 侧边栏底部展示后端真实运行版本（支持本地缓存秒出 + 异步静默校准 + 更新微徽章）
  const [versionInfo, setVersionInfo] = React.useState(null);
  const [appVersion, setAppVersion] = React.useState(() => {
    try {
      return localStorage.getItem('oci_cached_app_version') || '';
    } catch (_) {
      return '';
    }
  });

  React.useEffect(() => {
    window.ociApi.request('/api/version/check').then((info) => {
      if (info) {
        setVersionInfo(info);
        if (info.currentVersion) {
          setAppVersion(info.currentVersion);
          try {
            localStorage.setItem('oci_cached_app_version', info.currentVersion);
          } catch (_) {}
        }
      }
    }).catch(() => {});
  }, []);

  const toggleSection = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const selectPage = (page) => {
    onNavigate(page);
    if (onNavigateComplete) onNavigateComplete();
  };

  const width = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)';

  return (
    <aside className={tabletOverlay ? 'sidebar sidebar--tablet-overlay' : 'sidebar'} style={{
      width,
      flexShrink: 0,
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      transition: 'width 200ms',
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{
        height: 'var(--topbar-h)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--border)'
      }}>
        <PoolBrandMark size={30} />
        {!collapsed &&
        <div style={{ minWidth: 0, marginLeft: 1 }}>
            <div style={{ fontSize: 13, lineHeight: 1.1, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.1 }}>{tr('brand.name')}</div>
            <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.2, color: 'var(--fg-3)', letterSpacing: 0.4 }}>{tr('brand.tagline')}</div>
          </div>
        }
      </div>

      {/* Search — 模糊匹配所有子菜单项,支持键盘导航 + 点击跳转 */}
      {!collapsed &&
      <div style={{ padding: '10px 10px 4px' }}>
          <MenuSearch nav={NAV} onNavigate={selectPage} placeholder={tr('top.search')} />
        </div>
      }

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {NAV.map((sec) => {
          const isExpanded = collapsed ? true : expanded[sec.id];
          return (
            <div key={sec.id} style={{ marginBottom: 4 }}>
              {/* Section header */}
              <button
                className={collapsed ? '' : 'sidebar-section-hoverable'}
                title={collapsed ? sec.label : undefined}
                onClick={(e) => {
                  if (collapsed) return;
                  if (!expanded[sec.id]) {
                    // 点击折叠的父菜单:展开并自动高亮/跳转到第一个子菜单
                    toggleSection(sec.id);
                    const first = sec.items[0];
                    if (first) selectPage(first.id);
                  } else {
                    // 已展开的父菜单:保持原有折叠行为
                    toggleSection(sec.id);
                  }
                }}
                style={{
                  width: '100%',
                  padding: collapsed ? '10px 0' : '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'space-between',
                  gap: 8,
                  color: 'var(--fg-0)',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: collapsed ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 100ms'
                }}
                >
                
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: sec.color, display: 'inline-flex' }}>
                    <Icon name={sec.icon} size={15} />
                  </span>
                  {!collapsed && sec.label}
                </span>
                {!collapsed &&
                <Icon name="chevron-down" size={12} style={{
                  color: 'var(--fg-3)',
                  transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)',
                  transition: 'transform 150ms'
                }} />
                }
              </button>

              {/* Section items · grid-template-rows 动画过渡(现代标准做法) */}
              <div style={{
                display: 'grid',
                gridTemplateRows: isExpanded ? '1fr' : '0fr',
                opacity: isExpanded ? 1 : 0,
                transition: 'grid-template-rows 240ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease',
                marginLeft: collapsed ? 0 : 6,
                marginTop: isExpanded ? 2 : 0,
              }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>
                  {sec.items.map((item) => {
                  const isActive = item.id === activePage;
                  return (
                  <a
                    key={item.id}
                    className={'sidebar-item' + (isActive ? ' sidebar-item-active' : '')}
                    title={collapsed ? item.label : undefined}
                     href={(window.ociRouter ? "\#" + window.ociRouter.href(item.id) : "\#" + item.id)}
                     onClick={(e) => { e.preventDefault(); selectPage(item.id); }}
                      style={{
                        width: '100%',
                        padding: collapsed ? '8px 0' : '6px 10px 6px 20px', background: "transparent",

                        border: 'none', textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: 10,
                        color: isActive ? 'var(--accent)' : 'var(--fg-1)',
                        fontFamily: 'inherit',
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 1,
                        position: 'relative',
                        transition: 'all 120ms'
                      }}
                      >
                      
                        {isActive && !collapsed &&
                      <span style={{
                        position: 'absolute', left: 8, top: 8, bottom: 8, width: 3,
                        background: 'var(--accent)', borderRadius: 999
                      }} />
                      }
                        <Icon name={item.icon} size={14} />
                        {!collapsed && <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                        {!collapsed && isActive &&
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--orange)',
                        animation: 'pulse-dot 1.8s infinite'
                      }} />
                      }
                      </a>);

                })}
                </div>
              </div>
            </div>);

        })}
      </nav>

      {/* Status footer */}
      {!collapsed && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--fg-3)',
          boxSizing: 'border-box',
          minHeight: 54,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 16 }}>
            <StatusDot status="running" size={6} pulse />
            <span style={{ color: 'var(--fg-1)', lineHeight: '16px' }}>{tr('tw.sidebar.running')}</span>
          </div>

          <div
            style={{
              height: 16,
              minHeight: 16,
              lineHeight: '16px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              visibility: appVersion ? 'visible' : 'hidden'
            }}
          >
            <span
              onClick={() => openAboutModal(shell, tr)}
              style={{
                color: 'var(--fg-3)',
                cursor: 'pointer',
                transition: 'color 150ms'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; }}
              title={tr('layout.81d9f5')}
            >
              {appVersion ? `v${appVersion.replace(/^[vV]-?/, '')}` : '\u00A0'}
            </span>

            {versionInfo && versionInfo.needUpdate && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openAboutModal(shell, tr);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: '#d97706',
                  background: 'rgba(217, 119, 6, 0.12)',
                  border: '1px solid rgba(217, 119, 6, 0.28)',
                  borderRadius: 4,
                  padding: '0 5px',
                  height: 16,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  lineHeight: '14px',
                  userSelect: 'none',
                  transition: 'all 150ms'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(217, 119, 6, 0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(217, 119, 6, 0.12)';
                }}
                title={
                  versionInfo.latestVersion
                    ? `${tr('layout.7042f6')} v${versionInfo.latestVersion.replace(/^[vV]-?/, '')} · 点击查看更新详情`
                    : `${tr('layout.7042f6')} · 点击查看更新详情`
                }
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#d97706'
                  }}
                />
                <span>↑ 新版{versionInfo.latestVersion ? ` v${versionInfo.latestVersion.replace(/^[vV]-?/, '')}` : ''}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </aside>);

}

// ─── 强调色切换 popover(topbar 内嵌 · 铃铛左侧) ─────────────
function AccentSwitcher({ value, onChange }) {
  const { t: tr, lang } = useT();
  const presets = window.ACCENT_PRESETS || {};
  const keys = Object.keys(presets);
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState(null);
  const btnRef = React.useRef(null);

  const cur = presets[value] ? value : 'green';
  const curColor = window.getAccentColor ? window.getAccentColor(cur) : 'var(--accent)';

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      // 让 popover 内的点击不被外部关闭捕获(popover 用 stopPropagation)
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // popover 定位:锚右对齐,顶部 gap 8
  const popover = open && rect ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 200,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        padding: 10,
        minWidth: 220,
        animation: 'fade-in 120ms ease',
      }}
    >
      <div style={{
        fontSize: 10, color: 'var(--fg-3)',
        textTransform: 'uppercase', letterSpacing: 0.6,
        padding: '2px 4px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{tr('tw.accent') || tr('layout.b157da')}</span>
        <span className="mono" style={{ color: 'var(--fg-2)', textTransform: 'none', letterSpacing: 0 }}>
          {lang === 'zh' ? presets[cur].name : presets[cur].nameEn}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '2px 4px 4px' }}>
        {keys.map(k => {
          const color = `oklch(0.72 0.16 ${presets[k].hue})`;
          const on = k === cur;
          return (
            <button key={k}
              type="button"
              onClick={() => { onChange && onChange(k); setOpen(false); }}
              title={lang === 'zh' ? presets[k].name : presets[k].nameEn}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: color,
                border: on ? '2px solid var(--fg-0)' : '2px solid transparent',
                boxShadow: on ? '0 0 0 2px ' + color + '55' : 'none',
                padding: 0, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 120ms, box-shadow 120ms',
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {on && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="oklch(0.14 0.02 155)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <div style={{
        fontSize: 9.5, color: 'var(--fg-3)',
        padding: '6px 4px 0',
        borderTop: '1px solid var(--border)',
        marginTop: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>hue {presets[cur].hue}°</span>
        <span>{tr('tw.accent.esc')}</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef}
        onClick={toggle}
        title={tr('tw.accent') || tr('layout.b157da')}
        style={{
          position: 'relative',
          width: 30, height: 30, padding: 0,
          background: open ? 'var(--bg-3)' : 'var(--bg-2)',
          border: '1px solid ' + (open ? curColor : 'var(--border)'),
          borderRadius: 'var(--radius-sm)',
          color: curColor,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 120ms',
        }}
      >
        <Icon name="palette" size={14} color={curColor} />
        {/* 右下角当前色小圆点 */}
        <span style={{
          position: 'absolute', bottom: 3, right: 3,
          width: 7, height: 7, borderRadius: '50%',
          background: curColor,
          boxShadow: '0 0 0 1.5px var(--bg-1)',
        }} />
      </button>
      {popover && ReactDOM.createPortal(popover, document.body)}
    </>
  );
}


// ─── 信息密度切换(topbar 内嵌 · 单击 toggle) ─────────────
function DensityToggle({ value, onToggle }) {
  const { t: tr } = useT();
  const isCompact = value === 'compact';
  // 图标语义:紧凑 → 三行密,舒适 → 两行疏
  const icon = isCompact ? 'rows-3' : 'rows-2';
  const label = tr(isCompact ? 'tw.density.compact' : 'tw.density.comfortable');
  const nextLabel = tr(isCompact ? 'tw.density.comfortable' : 'tw.density.compact');
  return (
    <button
      type="button"
      onClick={onToggle}
      title={tr('layout.fe8225').replace('{0}',tr('tw.density')).replace('{1}',label).replace('{2}',nextLabel)}
      style={{
        position: 'relative',
        width: 30, height: 30, padding: 0,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--fg-1)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-1)'; }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}


// ─── 通知中心 popover(topbar 内嵌 · 锚定铃铛下方) ─────────────
function NotificationsButton() {
  const shell = useShell();
  const { t: tr } = useT();
  const openHistory = useNotifyHistoryModal();
  const openDetail = typeof useMessageDetailModal === 'function'
    ? useMessageDetailModal()
    : (window.useMessageDetailModal ? window.useMessageDetailModal() : null);
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState(null);
  const btnRef = React.useRef(null);

  // 真实通知数据与未读数量
  const [notifs, setNotifs] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  // 刷新未读数量
  const refreshUnread = React.useCallback(async () => {
    try {
      if (!window.ociServices?.notify?.countUnread) return;
      const res = await window.ociServices.notify.countUnread();
      const count = Number(res?.data ?? res ?? 0);
      setUnreadCount(isNaN(count) ? 0 : count);
    } catch {
      // 静默失败
    }
  }, []);

  // 拉取真实通知列表（最多 6 条）
  const loadNotifs = React.useCallback(async () => {
    if (!window.ociServices?.notify?.list) return;
    setLoading(true);
    try {
      const res = await window.ociServices.notify.list({ pageNum: 1, pageSize: 6, sort: 'createTime', order: 'desc' });
      const page = res?.data || res;
      const list = Array.isArray(page?.content) ? page.content : Array.isArray(page) ? page : [];
      const parsed = list.map((item, idx) => {
        const createdAt = item?.createTime || item?.updateTime || '';
        let time = '—';
        if (createdAt) {
          const ts = Date.parse(createdAt);
          if (ts) {
            const age = Math.max(0, Date.now() - ts);
            time = age < 60e3 ? (tr('notify.time.justNow') || '刚刚')
                 : age < 3600e3 ? `${Math.floor(age / 60e3)} 分钟前`
                 : age < 86400e3 ? `${Math.floor(age / 3600e3)} 小时前`
                 : `${Math.floor(age / 86400e3)} 天前`;
          } else {
            time = String(createdAt).replace('T', ' ');
          }
        }
        const type = String(item?.messageType || '').toLowerCase();
        const level = type.includes('error') || type.includes('fail') ? 'error'
                    : type.includes('warn') ? 'warning'
                    : type.includes('success') ? 'success' : 'info';
        return {
          id: item?.businessId || item?.id || `msg-${idx}`,
          businessId: item?.businessId || item?.id,
          level,
          title: item?.subject || tr('notify.system') || '系统通知',
          desc: item?.content || '',
          time,
          read: Number(item?.readStatus) === 1,
        };
      });
      setNotifs(parsed);
    } catch (e) {
      console.warn('加载通知列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  // 组件挂载时获取未读数，每 60 秒轮询
  React.useEffect(() => {
    refreshUnread();
    const timer = setInterval(refreshUnread, 60000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
    loadNotifs();
    refreshUnread();
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 全部标记已读
  const handleMarkAll = async () => {
    try {
      if (window.ociServices?.notify?.readAll) {
        await window.ociServices.notify.readAll();
      }
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      shell.showToast(tr('layout.2746f9') || '已全部标为已读', { kind: 'success' });
    } catch (e) {
      shell.showToast(e.message || '标记已读失败', { kind: 'error' });
    }
  };

  // 点击单条通知：关闭通知下拉并弹出保持当前暗色主题风格的消息详情 Modal
  const handleItemClick = (n) => {
    setOpen(false);
    if (openDetail) {
      openDetail(n, (deletedBid) => {
        setNotifs(prev => prev.filter(item => item.id !== deletedBid && item.businessId !== deletedBid));
      });
      if (!n.read) {
        setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } else if (n.desc) {
      shell.showToast(n.title + '：' + n.desc, { kind: 'info' });
    }
  };

  const styleFor = (level) => {
    if (level === 'success') return { c: 'var(--accent)', soft: 'var(--accent-soft)', icon: 'check-circle-2' };
    if (level === 'warning') return { c: 'var(--orange)', soft: 'var(--orange-soft)', icon: 'alert-triangle' };
    if (level === 'error')   return { c: 'var(--danger)', soft: 'var(--danger-soft)', icon: 'alert-octagon' };
    return { c: 'var(--info)', soft: 'var(--info-soft)', icon: 'info' };
  };

  const popover = open && rect ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        width: 340,
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 200,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'fade-in 120ms ease',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <Icon name="bell" size={13} style={{ color: 'var(--orange)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('layout.3a955e') || '通知中心'}</span>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--fg-2)',
          padding: '1px 6px', borderRadius: 3,
          background: 'var(--bg-3)',
        }}>{notifs.length} {tr('layout.cc1bac') || '条'}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={notifs.length === 0 || unreadCount === 0}
          style={{
            fontSize: 10.5, color: (notifs.length === 0 || unreadCount === 0) ? 'var(--fg-3)' : 'var(--info)',
            background: 'transparent', border: 'none',
            padding: '2px 4px', cursor: (notifs.length === 0 || unreadCount === 0) ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >{tr('layout.1d1a68') || '全部已读'}</button>
      </div>

      {/* 通知列表 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 120 }}>
        {loading && notifs.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
            <Icon name="loader-2" size={18} className="spin" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
            <span>加载通知…</span>
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
            <Icon name="inbox" size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
            <span>暂无系统通知</span>
          </div>
        ) : (
          notifs.map((n, i) => {
            const s = styleFor(n.level);
            return (
              <div key={n.id || i} style={{
                padding: '10px 14px',
                borderBottom: i < notifs.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                cursor: 'pointer',
                background: n.read ? 'transparent' : 'oklch(from var(--info) l c h / 0.05)',
                transition: 'background 100ms',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'oklch(from var(--info) l c h / 0.05)'}
                onClick={() => handleItemClick(n)}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: s.soft, color: s.c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={s.icon} size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: n.read ? 500 : 600, color: n.read ? 'var(--fg-2)' : 'var(--fg-0)' }}>{n.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{n.time}</span>
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--fg-2)',
                    marginTop: 2, lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{n.desc}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center',
        background: 'var(--bg-2)',
      }}>
        <button
          type="button"
          onClick={() => { setOpen(false); openHistory(); }}
          style={{
            fontSize: 11, color: 'var(--fg-1)', fontWeight: 500,
            background: 'transparent', border: 'none',
            padding: '2px 4px', cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          {tr('layout.0467cc') || '查看全部'}
          <Icon name="chevron-right" size={11} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef}
        onClick={toggle}
        title={tr('layout.5660bc') || '通知中心'}
        style={{
          position: 'relative',
          width: 30, height: 30, padding: 0,
          background: open ? 'var(--bg-3)' : 'var(--bg-2)',
          border: '1px solid ' + (open ? 'var(--orange)' : 'var(--border)'),
          borderRadius: 'var(--radius-sm)',
          color: open ? 'var(--orange)' : 'var(--fg-1)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 120ms',
        }}
      >
        <Icon name="bell" size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 5,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--orange)',
            boxShadow: '0 0 0 2px var(--bg-1)',
          }} />
        )}
      </button>
      {popover && ReactDOM.createPortal(popover, document.body)}
    </>
  );
}


// ─── 账号菜单 popover(topbar 内嵌 · 锚定头像下方) ─────────────
// 菜单项对齐原项目(common/header.ftl):资产分析+等级徽章 / 切换云厂商 / 关于 / 退出登录
// 保留现代暗色卡片风格。

function UserMenuButton() {
  const shell = useShell();
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState(null);
  const [provider, setProvider] = React.useState(() => {
    try {
      const raw = localStorage.getItem('selectedCloudProvider');
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.type) return { type: p.type, name: p.name || (p.type === 2 ? 'Google Cloud' : 'Oracle Cloud') };
      }
    } catch (_) {}
    return { type: 1, name: 'Oracle Cloud' };
  });
  const [level, setLevel] = React.useState(1);
  const [levelTitle, setLevelTitle] = React.useState(tr('layout.1cc67a'));
  const [userName, setUserName] = React.useState('');
  const btnRef = React.useRef(null);

  const PROVIDERS = [
    { type: 1, name: 'Oracle Cloud', icon: 'cloud' },
    { type: 2, name: 'Google Cloud', icon: 'globe' },
  ];
  const LEVELS = {
    1: { n: tr('layout.1cc67a'), i: '👤' },
    2: { n: tr('layout.3375d2'), i: '🥉' },
    3: { n: tr('layout.3e256f'), i: '🥈' },
    4: { n: tr('layout.ff2cf7'), i: '🏅' },
    5: { n: tr('layout.22841f'), i: '🎖️' },
    6: { n: tr('layout.58539d'), i: '🔱' },
    7: { n: tr('layout.76d62f'), i: '🔥' },
    8: { n: tr('layout.2108e4'), i: '💎' },
    9: { n: tr('layout.745e2d'), i: '👑' },
  };
  const clampLevel = (n) => Math.min(Math.max(parseInt(n) || 1, 1), 9);

  const loadLevel = React.useCallback(async (type) => {
    try {
      const res = await window.ociApi.request('/tenants/asset/analysis?cloudType=' + (type || 1));
      if (res && res.success && res.data) {
        setLevel(clampLevel(res.data.level || 1));
        if (res.data.levelTitle) setLevelTitle(res.data.levelTitle);
      }
    } catch (_) {}
  }, []);

  React.useEffect(() => { if (open) loadLevel(provider.type); }, [open, provider.type, loadLevel]);

  React.useEffect(() => {
    let active = true;
    window.ociApi.request('/api/userInfo')
      .then((res) => { if (active && res && res.success && res.data) setUserName(res.data.username || ''); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (btnRef.current && btnRef.current.contains(e.target)) return; setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openAssetModal = (d) => {
    const lvl = clampLevel(d.level || 1);
    const c = LEVELS[lvl] || LEVELS[1];
    const stat = (label, value, color) => (
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--fg-0)', marginTop: 6 }}>{value}</div>
      </div>
    );
    shell.openModal({
      title: tr('layout.984c2d'),
      subtitle: tr('layout.dd79bf') + provider.name,
      icon: 'chart-pie',
      iconColor: '#f5c518',
      size: 'lg',
      body: (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ flex: '0 0 200px', background: 'var(--bg-2)', padding: '24px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, whiteSpace: 'nowrap' }}>Account Level</div>
              <div style={{ fontSize: 14, fontWeight: 700, padding: '6px 16px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 8 }}>
                <span style={{ marginRight: 5 }}>{c.i}</span>{d.levelTitle || c.n}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-3)', fontWeight: 600 }}>Scale: Lvl.{lvl}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '20px 10px' }}>
              {stat(tr('layout.9eac57'), d.totalCount)}
              {stat(tr('layout.a109a5'), d.upgradeCount, 'var(--info)')}
              {stat(tr('layout.8ecccf'), d.freeCount)}
              {stat(tr('layout.7e6f1b'), d.totalCost, 'var(--cyan)')}
            </div>
          </div>
        </div>
      ),
      footer: (
        <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('layout.c26911')}</Button>
      ),
    });
  };

  const handleAsset = () => {
    setOpen(false);
    window.ociApi.request('/tenants/asset/analysis?cloudType=' + provider.type).then((res) => {
      if (!res || !res.success) throw new Error(res?.message || tr('layout.5261a2'));
      const d = res.data || {};
      if (d.level) setLevel(clampLevel(d.level));
      if (d.levelTitle) setLevelTitle(d.levelTitle);
      openAssetModal(d);
    }).catch((e) => shell.showToast(tr('layout.8d6499') + (e.message || e), { kind: 'error' }));
  };

  const handleProvider = (type, name) => {
    setOpen(false);
    if (provider.type === type) return;
    setProvider({ type, name });
    try { localStorage.setItem('selectedCloudProvider', JSON.stringify({ type, name })); } catch (_) {}
    window.ociRouter?.go('tenants', { cloudType: type }, { replace: false });
    shell.showToast(tr('layout.1d7ea7') + name, { kind: 'info' });
  };

  const handleAbout = () => {
    setOpen(false);
    openAboutModal(shell, tr);
  };

  const handleLogout = () => {
    setOpen(false);
    shell.openConfirm({
      title: tr('layout.1d8422'),
      body: <div>{tr('layout.d01cc6')}</div>,
      confirmLabel: tr('layout.c39922'),
      danger: true,
      onConfirm: () => {
        const hasHelper = typeof window.__ocipLogout === 'function';
        if (hasHelper) {
          window.__ocipLogout();
          setTimeout(() => {
            if (document.querySelector('aside')) {
              try { localStorage.removeItem('ocip-authed'); } catch (_) {}
              window.location.reload();
            }
          }, 150);
          return;
        }
        try { localStorage.removeItem('ocip-authed'); } catch (_) {}
        window.location.reload();
      },
    });
  };

  const MenuBtn = ({ icon, label, color, right, danger, onClick }) => (
    <button type="button" onClick={onClick} style={{
      width: '100%', padding: '7px 10px', background: 'transparent', border: 'none', borderRadius: 5,
      color: danger ? 'var(--danger)' : (color || 'var(--fg-1)'),
      fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 9, transition: 'background 80ms',
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'var(--danger-soft)' : 'var(--bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {/* 图标与文字不拦截指针，整行（含右侧空白）都是按钮的点击/悬停区域 */}
      <Icon name={icon} size={13} style={{ pointerEvents: 'none' }} />
      <span style={{ flex: 1, pointerEvents: 'none' }}>{label}</span>
      {right}
    </button>
  );

  const Divider = () => <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />;

  const popover = open && rect ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        width: 250,
        zIndex: 200,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        animation: 'fade-in 120ms ease',
      }}
    >
      {/* 用户信息卡 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <UserAvatar userName={userName} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{tr('layout.114f21')}{userName || tr('layout.1fd02a')}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 4,
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            fontSize: 9.5, fontWeight: 600, letterSpacing: 0.3,
          }}>
            <Icon name="shield-check" size={9} />
            {tr('layout.302ff0')}
          </div>
        </div>
      </div>

      {/* 菜单项 · 对齐原项目 */}
      <div style={{ padding: 4 }}>
        <MenuBtn icon="chart-pie" label={tr('layout.57aea5')} onClick={handleAsset} right={
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap',
          }}>L{level}</span>
        } />
        <Divider />
        <div style={{ padding: '6px 10px 3px', fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: 0.3 }}>{tr('layout.6669ad')}</div>
        {PROVIDERS.map((p) => (
          <MenuBtn key={p.type} icon={p.icon} label={p.name} onClick={() => handleProvider(p.type, p.name)} right={provider.type === p.type ? <Icon name="check" size={13} style={{ color: 'var(--accent)' }} /> : null} />
        ))}
        <Divider />
        <MenuBtn icon="info" label={tr('layout.81d9f5')} onClick={handleAbout} />
        <MenuBtn icon="log-out" label={tr('layout.44efd1')} danger onClick={handleLogout} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef}
        onClick={toggle}
        title={tr('layout.87ed25')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 6px 0 4px',
          background: open ? 'var(--bg-2)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--bg-2)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <UserAvatar userName={userName} size={26} />
        <Icon name="chevron-down" size={11} color="var(--fg-3)" style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms',
        }} />
      </button>
      {popover && ReactDOM.createPortal(popover, document.body)}
    </>
  );
}


function ThemeMenuButton({ theme, onChangeTheme }) {
  const { t: tr } = useT();
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState(null);
  const btnRef = React.useRef(null);

  const THEMES = [
    { id: 'light', label: tr('theme.light'), icon: 'sun' },
    { id: 'dark', label: tr('theme.dark'), icon: 'moon' },
    { id: 'system', label: tr('theme.system'), icon: 'monitor' },
  ];
  const current = theme && (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'system';

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id) => {
    onChangeTheme(id);
    setOpen(false);
  };

  const activeIcon = current === 'system'
    ? 'monitor'
    : (current === 'light' ? 'sun' : 'moon');

  return (
    <>
      <button ref={btnRef}
        onClick={toggle}
        title={tr('theme.title')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, padding: 0,
          background: open ? 'var(--bg-3)' : 'var(--bg-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          color: 'var(--fg-1)', cursor: 'pointer', transition: 'background 100ms',
        }}
      >
        <Icon name={activeIcon} size={14} />
      </button>
      {open && rect && ReactDOM.createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: rect.bottom + 8,
            right: Math.max(8, window.innerWidth - rect.right),
            width: 148,
            zIndex: 200,
            background: 'var(--bg-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            animation: 'fade-in 120ms ease',
          }}
        >
          <div style={{ padding: 4 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '6px 10px', background: current === t.id ? 'var(--bg-2)' : 'transparent',
                  border: 'none', borderRadius: 5,
                  color: current === t.id ? 'var(--accent)' : 'var(--fg-1)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: current === t.id ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = current === t.id ? 'var(--bg-2)' : 'transparent'; }}
              >
                <Icon name={t.icon} size={13} />
                <span style={{ flex: 1 }}>{t.label}</span>
                {current === t.id && <Icon name="check" size={13} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Topbar — minimal, with time / theme / lang
function Topbar({ theme, onChangeTheme, lang, onToggleLang, collapsed, onToggleCollapse, currentTime, accent, onChangeAccent, density, onToggleDensity }) {
  const { t: tr } = useT();
  const showEngineStatus = useEngineStatusPopover();
  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 14,
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <IconButton icon={collapsed ? 'panel-left-open' : 'panel-left-close'} onClick={onToggleCollapse} tooltip="Toggle sidebar" size={32} />

      {/* Live status indicator — clickable */}
      <button onClick={showEngineStatus} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 100ms',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <StatusDot status="running" size={7} pulse />
        <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>{tr('top.engine')}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{tr('top.engine.active')}</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* Live time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-2)' }}>
        <Icon name="clock" size={13} />
        <span className="mono" style={{ color: 'var(--fg-1)' }}>{currentTime}</span>
      </div>

      {/* Language toggle */}
      <button onClick={onToggleLang} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px', height: 30,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500,
        cursor: 'pointer'
      }} title={lang === 'zh' ? tr('top.switchToEn') : tr('top.switchToZh')}>
        <Icon name="languages" size={13} />
        <span className="mono" style={{ letterSpacing: 0.3 }}>{lang === 'zh' ? tr('top.lang.zh') : tr('top.lang.en')}</span>
      </button>

      {/* Theme menu: dark / light / system */}
      <ThemeMenuButton theme={theme} onChangeTheme={onChangeTheme} />

      {/* Accent switcher — 强调色 5 色快速切换 */}
      <AccentSwitcher value={accent} onChange={onChangeAccent} />

      {/* Density toggle — 紧凑/舒适一键切换 */}
      <DensityToggle value={density} onToggle={onToggleDensity} />

      {/* Notifications — 锚定 popover(取代原 modal 版) */}
      <NotificationsButton />

      {/* User — 锚定 popover(取代原 modal 版) */}
      <UserMenuButton />
    </header>);

}

Object.assign(window, { Sidebar, Topbar });
