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
  { id: 'mfaBackup',  label: tr('nav.mfaBackup'),  icon: 'smartphone' }]

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

function Sidebar({ activePage, onNavigate, collapsed = false }) {
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

  const toggleSection = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const width = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)';

  return (
    <aside style={{
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
          <MenuSearch nav={NAV} onNavigate={onNavigate} placeholder={tr('top.search')} />
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
                onClick={(e) => {
                  if (collapsed) return;
                  if (!expanded[sec.id]) {
                    // 点击折叠的父菜单:展开并自动高亮/跳转到第一个子菜单
                    toggleSection(sec.id);
                    const first = sec.items[0];
                    if (first) onNavigate(first.id);
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
                     onClick={(e) => { e.preventDefault(); onNavigate(item.id); }}
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
      {!collapsed &&
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--fg-3)'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status="running" size={6} pulse />
            <span style={{ color: 'var(--fg-1)' }}>{tr('tw.sidebar.running')}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>v2.14.0 · commit 3f2c8b</div>
        </div>
      }
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
  const openHistory = useNotifyHistoryModal();
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState(null);
  const btnRef = React.useRef(null);

  // 通知数据 · 与原 modal 版一致
  const notifs = [
    { level: 'success', time: tr('layout.dc7a65'),  title: tr('layout.2a2c26'), desc: tr('layout.28663f') },
    { level: 'warning', time: tr('layout.fa9631'), title: tr('layout.f5ec53'), desc: tr('layout.db3f97') },
    { level: 'error',   time: tr('layout.75aa52'),  title: tr('layout.5ef2d0'), desc: tr('layout.0193b6') },
    { level: 'info',    time: tr('layout.61e704'),  title: tr('layout.d545a9'), desc: tr('layout.2e120f') },
    { level: 'success', time: tr('layout.2f8d6f'),      title: tr('layout.2a2c26'), desc: tr('layout.7d898e') },
    { level: 'info',    time: tr('layout.369d41'),    title: tr('layout.348d77'),  desc: tr('layout.118274') },
  ];

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
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('layout.3a955e')}</span>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--fg-2)',
          padding: '1px 6px', borderRadius: 3,
          background: 'var(--bg-3)',
        }}>{notifs.length} {tr('layout.cc1bac')}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => { shell.showToast(tr('layout.2746f9'), { kind: 'success' }); setOpen(false); }}
          style={{
            fontSize: 10.5, color: 'var(--info)',
            background: 'transparent', border: 'none',
            padding: '2px 4px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >{tr('layout.1d1a68')}</button>
      </div>

      {/* 通知列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifs.map((n, i) => {
          const s = styleFor(n.level);
          return (
            <div key={i} style={{
              padding: '10px 14px',
              borderBottom: i < notifs.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'background 100ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { setOpen(false); shell.showToast(tr('layout.c81363').replace('{0}',n.title), { kind: 'info' }); }}
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
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)' }}>{n.title}</span>
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
        })}
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
          {tr('layout.0467cc')}
          <Icon name="chevron-right" size={11} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button ref={btnRef}
        onClick={toggle}
        title={tr('layout.5660bc')}
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
        <span style={{
          position: 'absolute', top: 4, right: 5,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--orange)',
          boxShadow: '0 0 0 2px var(--bg-1)',
        }} />
      </button>
      {popover && ReactDOM.createPortal(popover, document.body)}
    </>
  );
}


// ─── 账号菜单 popover(topbar 内嵌 · 锚定头像下方) ─────────────
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
    shell.openModal({
      title: tr('layout.81d9f5'),
      icon: 'info',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.14 0.02 155)', fontWeight: 800, fontSize: 18 }}>OCI</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)' }}>OCI-POOL Manager</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>{tr('layout.8183de')}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-1)' }}>{tr('layout.9b601b')} <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>v2.14.0</span></div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { href: 'https://github.com/doubleDimple/oci-start', label: tr('layout.072ab5') },
              { href: 'https://t.me/+M7XhteVCMMU5ZDhh', label: 'Telegram' },
              { href: 'https://github.com/doubleDimple/oci-start/releases', label: tr('layout.23093b') },
            ].map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>{l.label}</a>
            ))}
          </div>
        </div>
      ),
      footer: (
        <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('layout.b15d91')}</Button>
      ),
    });
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
      <Icon name={icon} size={13} />
      <span style={{ flex: 1 }}>{label}</span>
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
