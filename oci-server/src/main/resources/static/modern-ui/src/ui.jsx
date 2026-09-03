// UI primitives — dense, tool-feel
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Lucide Icon component
function Icon({ name, size = 15, style = {}, className = '', color, strokeWidth = 1.75 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const iconDef = window.lucide.icons[toPascal(name)] || window.lucide.icons.Circle;
      const svg = window.lucide.createElement(iconDef);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('stroke-width', strokeWidth);
      if (color) svg.setAttribute('stroke', color);
      ref.current.appendChild(svg);
    }
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} className={`icon ${className}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, ...style }} />;
}

function toPascal(kebab) {
  return kebab.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// Status dot
function StatusDot({ status, size = 8, pulse = false }) {
  const colorMap = {
    running: 'var(--accent)',
    healthy: 'var(--accent)',
    active: 'var(--accent)',
    enabled: 'var(--accent)',
    success: 'var(--accent)',

    stopped: 'var(--fg-3)',
    idle: 'var(--fg-3)',
    disabled: 'var(--fg-3)',

    paused: 'var(--orange)',
    warning: 'var(--orange)',
    provisioning: 'var(--orange)',

    failed: 'var(--danger)',
    error: 'var(--danger)',
    invalid: 'var(--danger)',
    suspended: 'var(--danger)',
    danger: 'var(--danger)'
  };
  const color = colorMap[status] || 'var(--fg-3)';
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size, borderRadius: '50%',
      background: color,
      boxShadow: pulse ? `0 0 0 3px ${color}30` : 'none',
      animation: pulse ? 'pulse-dot 1.8s ease-in-out infinite' : 'none',
      flexShrink: 0
    }} />);

}

// Status pill
function StatusPill({ status, label, size = 'md' }) {
  const bgMap = {
    running: 'var(--accent-soft)', healthy: 'var(--accent-soft)', active: 'var(--accent-soft)', enabled: 'var(--accent-soft)', success: 'var(--accent-soft)',
    stopped: 'var(--bg-3)', idle: 'var(--bg-3)', disabled: 'var(--bg-3)',
    paused: 'var(--orange-soft)', warning: 'var(--orange-soft)', provisioning: 'var(--orange-soft)',
    failed: 'var(--danger-soft)', error: 'var(--danger-soft)', invalid: 'var(--danger-soft)', suspended: 'var(--danger-soft)', danger: 'var(--danger-soft)'
  };
  const fgMap = {
    running: 'var(--accent)', healthy: 'var(--accent)', active: 'var(--accent)', enabled: 'var(--accent)', success: 'var(--accent)',
    stopped: 'var(--fg-2)', idle: 'var(--fg-2)', disabled: 'var(--fg-2)',
    paused: 'var(--orange)', warning: 'var(--orange)', provisioning: 'var(--orange)',
    failed: 'var(--danger)', error: 'var(--danger)', invalid: 'var(--danger)', suspended: 'var(--danger)', danger: 'var(--danger)'
  };
  const sizes = {
    sm: { padding: '1px 6px', fontSize: 10 },
    md: { padding: '2px 8px', fontSize: 11 }
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      ...sizes[size],
      borderRadius: 999,
      background: bgMap[status] || 'var(--bg-3)',
      color: fgMap[status] || 'var(--fg-2)',
      fontWeight: 500,
      whiteSpace: 'nowrap'
    }}>
      <StatusDot status={status} size={size === 'sm' ? 5 : 6} pulse={status === 'running'} />
      {label || status}
    </span>);

}

// Card
function Card({ children, style = {}, className = '', title, subtitle, action, padding = 16, headerIcon, headerIconColor = 'var(--accent)' }) {
  return (
    <div className={className} style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      ...style
    }}>
      {(title || action) &&
      <div style={{
        padding: `12px ${padding}px`,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12, margin: "10px"
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {headerIcon &&
          <span style={{ color: headerIconColor, display: 'inline-flex' }}>
                <Icon name={headerIcon} size={16} />
              </span>
          }
            <div style={{ minWidth: 0 }}>
              {title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', letterSpacing: 0.2 }}>{title}</div>}
              {subtitle && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{subtitle}</div>}
            </div>
          </div>
          {action}
        </div>
      }
      <div style={{ padding }}>
        {children}
      </div>
    </div>);

}

// Button
function Button({ children, variant = 'ghost', size = 'md', onClick, style = {}, icon, iconRight, disabled, loading = false }) {
  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--accent-fg)', border: '1px solid var(--accent)' },
    secondary: { background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--border-strong)' },
    ghost: { background: 'transparent', color: 'var(--fg-1)', border: '1px solid transparent' },
    outline: { background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--border-strong)' },
    danger: { background: 'var(--danger)', color: 'white', border: '1px solid var(--danger)' },
    danger_soft: { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid transparent' },
    orange: { background: 'var(--orange)', color: 'oklch(0.16 0.02 55)', border: '1px solid var(--orange)' },
    cyan: { background: 'var(--cyan)', color: 'oklch(0.14 0.02 200)', border: '1px solid var(--cyan)' },
    info: { background: 'var(--info)', color: 'white', border: '1px solid var(--info)' }
  };
  const sizes = {
    xs: { padding: '2px 8px', fontSize: 11, height: 22, gap: 4 },
    sm: { padding: '3px 10px', fontSize: 12, height: 26, gap: 5 },
    md: { padding: '5px 12px', fontSize: 12.5, height: 30, gap: 6 },
    lg: { padding: '7px 16px', fontSize: 13, height: 36, gap: 6 }
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        ...sizes[size],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.5 : 1,
        transition: 'all 120ms',
        whiteSpace: 'nowrap',
        ...style
      }}
      onMouseEnter={(e) => !(disabled || loading) && (e.currentTarget.style.filter = 'brightness(1.15)')}
      onMouseLeave={(e) => !(disabled || loading) && (e.currentTarget.style.filter = 'brightness(1)')}>
      
      {loading
        ? <Icon name="loader" size={size === 'xs' || size === 'sm' ? 12 : 14} style={{ animation: 'button-spin 800ms linear infinite' }} />
        : icon && <Icon name={icon} size={size === 'xs' || size === 'sm' ? 12 : 14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'xs' || size === 'sm' ? 12 : 14} />}
    </button>);

}

// KPI Card (compact, tool-style)
function KPICard({ label, value, icon, iconColor = 'var(--accent)', delta, subtitle, big = false }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }}>
      {icon &&
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `color-mix(in oklab, ${iconColor} 18%, transparent)`,
        color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
          <Icon name={icon} size={18} />
        </div>
      }
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500, marginBottom: 2, letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div className="num" style={{
          fontSize: big ? 24 : 22,
          fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.5, lineHeight: 1.1
        }}>{value}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>);

}

// Sparkline
function Sparkline({ data, color = 'var(--accent)', width = 80, height = 24, filled = true, strokeWidth = 1.5 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = i / (data.length - 1) * width;
    const y = height - (v - min) / range * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const areaPts = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {filled && <polyline points={areaPts} fill={color} opacity="0.18" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>);

}

// Table — dense, tool-style, hoverable rows
function Table({ columns, rows, onRowClick, density = 'compact', empty, striped = true }) {
  const py = density === 'comfortable' ? 12 : density === 'compact' ? 9 : 6;
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontSize: 12.5,
      minWidth: 800,
    }}>
        <thead>
          <tr>
            {columns.map((c, ci) =>
            <th key={c.key || ci} style={{
              textAlign: c.align || 'left',
              padding: `9px 12px`,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--fg-3)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-2)',
              position: 'sticky', top: 0,
              whiteSpace: 'nowrap',
              width: c.width,
              zIndex: 1
            }}>{c.label}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty &&
          <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{empty}</td></tr>
          }
          {rows.map((r, i) =>
          <tr
            key={r.id || r.seq || i}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            style={{
              borderBottom: '1px solid var(--border)',
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 100ms',
              background: striped && i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 40%, transparent)' : 'transparent'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = striped && i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 40%, transparent)' : 'transparent'}>
            
              {columns.map((c, ci) =>
            <td key={c.key || ci} style={{
              padding: `${py}px 12px`,
              textAlign: c.align || 'left',
              color: 'var(--fg-1)',
              verticalAlign: 'middle',
              whiteSpace: c.wrap ? 'normal' : 'nowrap'
            }}>
                  {c.render ? c.render(r, i) : r[c.key]}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>);

}

// Pagination footer
function Pagination({ total, page = 1, perPage = 10, onPageChange, onPerPageChange, t }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div style={{
      padding: '10px 16px',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 14, fontSize: 12, color: 'var(--fg-2)', flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{t('common.perPage')}</span>
        <CustomDropdown
          value={perPage}
          onChange={v => onPerPageChange && onPerPageChange(+v)}
          options={[10, 20, 50, 100].map(n => ({ value: n, label: String(n) }))}
          width={64}
          height={26}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={pagBtn(page <= 1)}>
          
          <Icon name="chevron-left" size={13} /> {t('common.prev')}
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) =>
        <button
          key={p}
          onClick={() => onPageChange && onPageChange(p)}
          style={{
            ...pagBtn(false),
            background: p === page ? 'var(--accent)' : 'var(--bg-2)',
            color: p === page ? 'var(--accent-fg)' : 'var(--fg-1)',
            fontWeight: p === page ? 600 : 500,
            minWidth: 28
          }}>
          {p}</button>
        )}
        <button
          onClick={() => onPageChange && onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={pagBtn(page >= totalPages)}>
          
          {t('common.next')} <Icon name="chevron-right" size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{t('common.jumpTo')}</span>
        <input
          type="number"
          value={page}
          onChange={(e) => {
            const p = Math.min(totalPages, Math.max(1, +e.target.value || 1));
            onPageChange && onPageChange(p);
          }}
          style={{
            width: 42, padding: '3px 6px', height: 26,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 12,
            textAlign: 'center'
          }} />
        
        <span>{t('common.page')}</span>
        <span style={{ marginLeft: 6 }}>
          {t('common.total')} <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{total}</span> {t('common.records')}
          <span style={{ marginLeft: 8, color: 'var(--fg-3)' }}>{page} / {totalPages}</span>
        </span>
      </div>
    </div>);

}
function pagBtn(disabled) {
  return {
    padding: '4px 10px', height: 26,
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 4, color: disabled ? 'var(--fg-3)' : 'var(--fg-1)',
    fontFamily: 'inherit', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
    opacity: disabled ? 0.5 : 1
  };
}

// Search input
function SearchInput({ placeholder = 'Search...', value, onChange, width = 260, size = 'md' }) {
  const heights = { sm: 26, md: 30, lg: 34 };
  // 支持受控 (value+onChange) 与非受控 (未传) 两种模式
  const controlled = value !== undefined && typeof onChange === 'function';
  const [internal, setInternal] = React.useState('');
  const curValue = controlled ? value : internal;
  const handleChange = (e) => {
    const v = e.target.value;
    if (controlled) onChange(v);
    else setInternal(v);
  };
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
      height: heights[size] || 30,
      width,
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)'
    }}>
      <Icon name="search" size={13} style={{ color: 'var(--fg-3)' }} />
      <input
        value={curValue || ''}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 12.5,
          color: 'var(--fg-0)'
        }} />
      
    </div>);

}

// Select
function Select({ value, onChange, options, placeholder, width, size = 'md', style = {}, disabled = false, searchable = false }) {
  const heights = { sm: 26, md: 30, lg: 34 };
  return <CustomDropdown
    value={value} onChange={onChange}
    options={options} placeholder={placeholder}
    width={width} height={heights[size] || 30}
    disabled={disabled}
    searchable={searchable}
    triggerStyle={style}
  />;
}

// ═══════════════════════════════════════════════════════════════════════
// CustomDropdown · 完全脱离原生 <select> 的自定义下拉
//   · 弹出层用 fixed portal · 严格遵守 CSS 变量主题
//   · 支持普通 options + optgroup(groups prop)
//   · 键盘 ↑↓ 导航 · Enter 选中 · Esc 关闭
// ═══════════════════════════════════════════════════════════════════════
function CustomDropdown({
  value, onChange, options, groups, placeholder,
  width, height = 30, triggerStyle = {}, disabled = false, searchable = false,
  children,
}) {
  const { t: tr } = useT();
  // 从 <option>/<optgroup> children 推断 options/groups(兼容原生 select 写法)
  const derived = React.useMemo(() => {
    if (!children) return null;
    const kids = React.Children.toArray(children).filter(c => c && typeof c === 'object');
    if (!kids.length) return null;
    const hasGroup = kids.some(c => c.type === 'optgroup');
    if (hasGroup) {
      const gs = [];
      kids.forEach(c => {
        if (c.type === 'optgroup') {
          const items = React.Children.toArray(c.props.children).filter(x => x && x.type === 'option').map(o => ({
            value: o.props.value,
            label: React.Children.toArray(o.props.children).join(''),
          }));
          gs.push({ group: c.props.label, items });
        } else if (c.type === 'option') {
          // 单独的 option 归到一个 'default' 组末尾
          gs.push({ group: '', items: [{ value: c.props.value, label: React.Children.toArray(c.props.children).join('') }] });
        }
      });
      return { groups: gs };
    }
    const opts = kids.filter(c => c.type === 'option').map(o => ({
      value: o.props.value,
      label: React.Children.toArray(o.props.children).join(''),
    }));
    // placeholder option(空 value)不进 options,而是作为 placeholder 显示
    const phOpt = opts.find(o => o.value === '' || o.value == null);
    const cleanOpts = opts.filter(o => o !== phOpt);
    return { options: cleanOpts, ph: phOpt?.label };
  }, [children]);
  if (derived) {
    if (derived.groups) groups = groups || derived.groups;
    else {
      options = options || derived.options;
      if (!placeholder && derived.ph) placeholder = derived.ph;
    }
  }

  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(-1);
  const [rect, setRect] = React.useState(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);

  // 扁平化 items(把 groups 转成带 header 的 flat 数组,方便键盘导航)
  const allFlatItems = React.useMemo(() => {
    if (groups && groups.length) {
      const out = [];
      groups.forEach(g => {
        out.push({ type: 'header', label: g.group });
        g.items.forEach(it => {
          // it 可以是 string 或 {value, label}
          if (typeof it === 'string') out.push({ type: 'item', value: it, label: it });
          else out.push({ type: 'item', value: it.value, label: it.label });
        });
      });
      return out;
    }
    return (options || []).map(o => ({ type: 'item', value: o.value, label: o.label }));
  }, [options, groups]);

  // 原项目 data-searchable 下拉框按显示文本过滤，区域较多时可快速定位。
  const flatItems = React.useMemo(() => {
    const keyword = String(searchTerm || '').trim().toLowerCase();
    if (!keyword) return allFlatItems;
    const result = [];
    let pendingHeader = null;
    allFlatItems.forEach((item) => {
      if (item.type === 'header') {
        pendingHeader = item;
        return;
      }
      if (String(item.label ?? '').toLowerCase().includes(keyword)) {
        if (pendingHeader) result.push(pendingHeader);
        result.push(item);
        pendingHeader = null;
      }
    });
    return result;
  }, [allFlatItems, searchTerm]);

  const selectedLabel = React.useMemo(() => {
    const found = allFlatItems.find(it => it.type === 'item' && it.value === value);
    return found?.label;
  }, [allFlatItems, value]);

  const updateRect = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  React.useEffect(() => {
    if (!open) return;
    updateRect();
    const onScroll = () => updateRect();
    const onResize = () => updateRect();
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const itemIdxs = flatItems.map((it, i) => it.type === 'item' ? i : -1).filter(i => i >= 0);
        if (!itemIdxs.length) return;
        const curPos = itemIdxs.indexOf(hover);
        const nextPos = e.key === 'ArrowDown'
          ? (curPos + 1) % itemIdxs.length
          : (curPos - 1 + itemIdxs.length) % itemIdxs.length;
        setHover(itemIdxs[nextPos]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = flatItems[hover];
        if (it?.type === 'item') { onChange?.(it.value); setOpen(false); }
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, flatItems, hover, onChange]);

  // 打开时把 hover 定位到当前 value
  React.useEffect(() => {
    if (open) {
      const idx = flatItems.findIndex(it => it.type === 'item' && it.value === value);
      setHover(idx >= 0 ? idx : flatItems.findIndex(it => it.type === 'item'));
    }
  }, [open, flatItems, value]);

  React.useEffect(() => {
    if (!open) setSearchTerm('');
  }, [open]);

  // 弹出位置:下拉宽度 = trigger 宽度 · 优先向下,不够放向上
  const menuStyle = rect ? (() => {
    const vh = window.innerHeight;
    const menuMaxH = 320;
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const goUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    return {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(menuMaxH, goUp ? spaceAbove : spaceBelow),
      ...(goUp
        ? { bottom: vh - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  })() : { display: 'none' };

  return (
    <div style={{ position: 'relative', width, display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '0 30px 0 12px',
          height,
          background: 'var(--bg-2)',
          border: '1px solid ' + (open ? 'var(--accent)' : 'var(--border)'),
          borderRadius: 'var(--radius-sm)',
          color: value ? 'var(--fg-0)' : 'var(--fg-3)',
          fontFamily: 'inherit', fontSize: 12.5,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex', alignItems: 'center',
          transition: 'border-color 120ms',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          position: 'relative',
          ...triggerStyle,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder || ''}
        </span>
        <Icon name="chevron-down" size={13} style={{
          position: 'absolute', right: 10, top: '50%',
          transform: `translateY(-50%) ${open ? 'rotate(180deg)' : ''}`,
          color: 'var(--fg-3)', pointerEvents: 'none',
          transition: 'transform 150ms',
        }} />
      </button>
      {open && rect && ReactDOM.createPortal(
        <div ref={menuRef} style={{
          ...menuStyle,
          zIndex: 200,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          overflowY: 'auto',
          padding: 4,
          animation: 'fade-in 120ms',
        }}>
          {searchable && (
            <div style={{ padding: '4px 4px 6px', position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-1)' }}>
              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  type="search"
                  value={searchTerm}
                  placeholder={tr('common.searchPh')}
                  aria-label={tr('common.searchOptions')}
                  onChange={e => setSearchTerm(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  style={{
                    width: '100%', boxSizing: 'border-box', height: 28,
                    padding: '0 8px 0 28px', borderRadius: 4,
                    border: '1px solid var(--border)', background: 'var(--bg-2)',
                    color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 12,
                    outline: 'none',
                  }}
                />
                <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--fg-3)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}
          {placeholder && value === '' && (
            <div style={{ padding: '6px 10px', fontSize: 11.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>
              {placeholder}
            </div>
          )}
          {searchable && searchTerm && !flatItems.some(it => it.type === 'item') && (
            <div style={{ padding: '10px', fontSize: 11.5, color: 'var(--fg-3)', textAlign: 'center' }}>{tr('common.noMatch')}</div>
          )}
          {flatItems.map((it, i) => {
            if (it.type === 'header') {
              return (
                <div key={'g-' + i} style={{
                  padding: '6px 10px 2px', fontSize: 10, fontWeight: 600,
                  color: 'var(--fg-3)', letterSpacing: 0.6, textTransform: 'uppercase',
                }}>{it.label}</div>
              );
            }
            const selected = it.value === value;
            const hovered = i === hover;
            return (
              <div
                key={String(it.value) + '-' + i}
                onMouseEnter={() => setHover(i)}
                onClick={() => { onChange?.(it.value); setOpen(false); }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12.5,
                  borderRadius: 4,
                  color: selected ? 'var(--accent)' : 'var(--fg-1)',
                  background: hovered ? 'var(--bg-2)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontWeight: selected ? 500 : 400,
                }}
              >
                {selected && <Icon name="check" size={12} />}
                {!selected && <span style={{ width: 12 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.label}
                </span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// Icon action button (small square)
function IconButton({ icon, onClick, tooltip, color = 'var(--fg-2)', style = {}, size = 26 }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: size, height: size,
        padding: 0,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        color,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 100ms',
        ...style
      }}
      onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--bg-3)';e.currentTarget.style.color = 'var(--fg-0)';}}
      onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';e.currentTarget.style.color = color;}}>
      
      <Icon name={icon} size={14} />
    </button>);

}

// Round action button (dark blue like reference "..."  button)
function ActionButton({ icon = 'more-horizontal', onClick, variant = 'default' }) {
  const colors = {
    default: { bg: 'var(--info)', fg: 'white' },
    accent: { bg: 'var(--accent)', fg: 'var(--accent-fg)' },
    orange: { bg: 'var(--orange)', fg: 'oklch(0.16 0.02 55)' }
  };
  const c = colors[variant] || colors.default;
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26,
        padding: 0,
        background: c.bg, color: c.fg,
        border: 'none', borderRadius: 6,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)'
      }}>
      
      <Icon name={icon} size={13} strokeWidth={2} />
    </button>);

}

// PageHeader
function PageHeader({ title, subtitle, icon, iconColor = 'var(--accent)', actions, children }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 20px',
      marginBottom: 14,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {icon &&
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `color-mix(in oklab, ${iconColor} 18%, transparent)`,
          color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
            <Icon name={icon} size={17} />
          </div>
        }
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: 'var(--fg-0)', letterSpacing: -0.2 }}>{title}</h1>
          {subtitle && <div style={{ marginTop: 2, fontSize: 12, color: 'var(--fg-3)' }}>{subtitle}</div>}
        </div>
      </div>
      {children}
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>);

}

// Region badge (flag + code)
function RegionBadge({ code, showFlag = true, lang, style = {} }) {
  const r = REGION_MAP[code];
  if (!r) return <span className="mono">{code}</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      ...style
    }}>
      {showFlag && <span style={{ fontSize: 13, lineHeight: 1 }}>{r.flag}</span>}
      <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{lang === 'en' ? r.en : getRegionSimpleName(r)}</span>
    </span>);

}

// Tabs — underline style
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      borderBottom: '1px solid var(--border)'
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              color: isActive ? 'var(--fg-0)' : 'var(--fg-2)',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginBottom: -1,
              transition: 'color 120ms'
            }}>
            
            {t.icon && <Icon name={t.icon} size={13} />}
            {t.label}
            {t.count !== undefined &&
            <span style={{
              fontSize: 10, fontWeight: 500,
              padding: '0 5px', borderRadius: 999,
              background: isActive ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: isActive ? 'var(--accent)' : 'var(--fg-2)',
              minWidth: 16, textAlign: 'center'
            }}>{t.count}</span>
            }
          </button>);

      })}
    </div>);

}

// Progress bar
function ProgressBar({ value, max = 100, color, height = 6, status }) {
  const pct = Math.min(100, value / max * 100);
  let barColor = color;
  if (!barColor && status) {
    barColor = status === 'danger' ? 'var(--danger)' : status === 'warning' ? 'var(--orange)' : 'var(--accent)';
  }
  barColor = barColor || 'var(--accent)';
  return (
    <div style={{ width: '100%', height, background: 'var(--bg-3)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: barColor,
        borderRadius: height / 2,
        transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)'
      }} />
    </div>);

}

// Modal / drawer overlay
function Overlay({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 50,
          animation: 'fade-in 150ms',
          backdropFilter: 'blur(2px)'
        }} />
      
      {children}
    </>);

}

Object.assign(window, {
  Icon, StatusDot, StatusPill, Card, Button, KPICard, Sparkline,
  Table, Pagination, SearchInput, Select, CustomDropdown, IconButton, ActionButton,
  PageHeader, RegionBadge, Tabs, ProgressBar, Overlay
});
