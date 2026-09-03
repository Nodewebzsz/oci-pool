// Shell — Toast / Modal / Confirm / Drawer / DropdownMenu
// A single global context so any page can dispatch UI without prop-drilling.

const ShellContext = React.createContext(null);

function ShellProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const [modal, setModal] = React.useState(null);   // { title, size, body, footer, onClose }
  const [drawer, setDrawer] = React.useState(null); // { title, subtitle, statusDot, body, width, onClose }
  const [confirm, setConfirm] = React.useState(null); // { title, body, danger, requireText, confirmLabel, onConfirm }

  const nextId = React.useRef(1);

  const showToast = React.useCallback((msg, opts = {}) => {
    const id = nextId.current++;
    const kind = opts.kind || 'success'; // success | info | warn | error
    setToasts(prev => [...prev, { id, msg, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), opts.duration || 3000);
  }, []);

  const openModal = React.useCallback((cfg) => setModal(cfg), []);
  const closeModal = React.useCallback(() => setModal(null), []);
  const openDrawer = React.useCallback((cfg) => setDrawer(cfg), []);
  const closeDrawer = React.useCallback(() => setDrawer(null), []);
  const openConfirm = React.useCallback((cfg) => setConfirm(cfg), []);
  const closeConfirm = React.useCallback(() => setConfirm(null), []);
  // 一键关闭所有浮层 — 页面切换时调用以防止前一页面的 modal/drawer/confirm 残留
  const closeAll = React.useCallback(() => {
    setModal(null); setDrawer(null); setConfirm(null);
  }, []);

  const value = React.useMemo(() => ({
    showToast, openModal, closeModal, openDrawer, closeDrawer, openConfirm, closeConfirm, closeAll,
  }), [showToast, openModal, closeModal, openDrawer, closeDrawer, openConfirm, closeConfirm, closeAll]);

  // \u66b4\u9732\u5230 window,\u65b9\u4fbf\u975e-hook \u4f4d\u7f6e\u8c03\u7528\uff08\u5982 app.jsx \u7684 navigate\uff09
  React.useEffect(() => {
    window.__ocipShell = value;
    return () => { if (window.__ocipShell === value) window.__ocipShell = null; };
  }, [value]);

  return (
    <ShellContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} />
      {modal && <ModalShell {...modal} onClose={() => { modal.onClose && modal.onClose(); closeModal(); }} />}
      {drawer && <DrawerShell {...drawer} onClose={() => { drawer.onClose && drawer.onClose(); closeDrawer(); }} />}
      {confirm && <ConfirmShell {...confirm} onClose={() => { confirm.onClose && confirm.onClose(); closeConfirm(); }} />}
    </ShellContext.Provider>
  );
}

function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside ShellProvider');
  return ctx;
}

// ─── Toast stack ─────────────────────────────────────────────────
function ToastStack({ toasts }) {
  const kindStyles = {
    success: { bg: 'var(--bg-1)', border: 'var(--accent)', icon: 'check-circle-2', iconColor: 'var(--accent)' },
    info:    { bg: 'var(--bg-1)', border: 'var(--info)',   icon: 'info', iconColor: 'var(--info)' },
    warn:    { bg: 'var(--bg-1)', border: 'var(--orange)', icon: 'alert-triangle', iconColor: 'var(--orange)' },
    error:   { bg: 'var(--bg-1)', border: 'var(--danger)', icon: 'x-octagon', iconColor: 'var(--danger)' },
  };
  return (
    <div style={{
      position: 'fixed',
      bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      zIndex: 100,
      pointerEvents: 'none',
      maxWidth: '90vw',
    }}>
      {toasts.map(t => {
        const s = kindStyles[t.kind] || kindStyles.success;
        return (
          <div key={t.id} style={{
            padding: '10px 16px',
            background: s.bg,
            border: `1px solid ${s.border}`,
            borderRadius: 8,
            boxShadow: 'var(--shadow-md)',
            fontSize: 12.5,
            color: 'var(--fg-0)',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'fade-in 200ms',
            pointerEvents: 'auto',
          }}>
            <Icon name={s.icon} size={15} style={{ color: s.iconColor }} />
            <span>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────
function ModalShell({ title, subtitle, icon, iconColor = 'var(--accent)', size = 'md', body, footer, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const widths = { sm: 420, md: 560, lg: 720, xl: 900 };
  const w = widths[size] || 560;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        zIndex: 80, animation: 'fade-in 150ms',
      }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: w, maxWidth: '92vw',
        maxHeight: '90vh',
        background: 'var(--bg-1)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        zIndex: 81,
        display: 'flex', flexDirection: 'column',
        animation: 'fade-in 180ms',
      }}>
        {(title || icon) && (
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {icon && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `color-mix(in oklab, ${iconColor} 18%, transparent)`,
                  color: iconColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={icon} size={17} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{subtitle}</div>}
              </div>
            </div>
            <IconButton icon="x" onClick={onClose} size={28} style={{ border: '1px solid var(--border)' }} />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {body}
        </div>
        {footer && (
          <div style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Drawer (right side) ────────────────────────────────────────
function DrawerShell({ title, subtitle, statusDot, icon, iconColor = 'var(--accent)', width = 640, body, actions, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        zIndex: 60, animation: 'fade-in 150ms',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width, maxWidth: '92vw',
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border)',
        zIndex: 61, overflowY: 'auto',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.4)',
        animation: 'slide-in-right 220ms cubic-bezier(0.2, 0, 0, 1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {icon && (
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `color-mix(in oklab, ${iconColor} 18%, transparent)`,
                color: iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name={icon} size={17} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {statusDot && <StatusDot status={statusDot} size={7} pulse={statusDot === 'running' || statusDot === 'active'} />}
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>{title}</div>
              </div>
              {subtitle && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{subtitle}</div>}
            </div>
          </div>
          <IconButton icon="x" onClick={onClose} size={28} style={{ border: '1px solid var(--border)' }} />
        </div>
        {actions && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
        <div style={{ flex: 1, padding: 22 }}>
          {body}
        </div>
      </div>
    </>
  );
}

// ─── Confirm dialog ─────────────────────────────────────────────
function ConfirmShell({ title, body, danger, requireText, confirmLabel = tr('shell.e83a25'), cancelLabel = tr('shell.625fb2'), onConfirm, onClose }) {
  const [typed, setTyped] = React.useState('');
  const canConfirm = !requireText || typed === requireText;

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 90, animation: 'fade-in 150ms',
      }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxWidth: '92vw',
        background: 'var(--bg-1)',
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        zIndex: 91,
        overflow: 'hidden',
        animation: 'fade-in 180ms',
      }}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: danger ? 'var(--danger-soft)' : 'var(--orange-soft)',
              color: danger ? 'var(--danger)' : 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name={danger ? 'alert-octagon' : 'alert-triangle'} size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>{body}</div>
            </div>
          </div>
          {requireText && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginBottom: 6 }}>
                {tr('shell.02cc4f')} <span className="mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>{requireText}</span> {tr('shell.3b7e1f')}
              </div>
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                autoFocus
                placeholder={requireText}
                style={{
                  width: '100%', padding: '7px 10px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
                }}
              />
            </div>
          )}
        </div>
        <div style={{
          padding: '12px 22px',
          background: 'var(--bg-2)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button variant="outline" size="md" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="md"
            disabled={!canConfirm}
            onClick={() => { onConfirm && onConfirm(); onClose(); }}
          >{confirmLabel}</Button>
        </div>
      </div>
    </>
  );
}

// ─── DropdownMenu — positioned menu for row action buttons ──────
function DropdownMenu({ anchor, onClose, sections, width = 240 }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const menuW = ref.current.offsetWidth;
    const menuH = ref.current.offsetHeight;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.x - menuW;
    let top = anchor.y + 6;
    if (left + menuW > vw - pad) left = vw - menuW - pad;
    if (left < pad) left = pad;
    if (top + menuH > vh - pad) top = Math.max(pad, anchor.y - menuH - 32);
    setPos({ left, top });
  }, [anchor]);

  React.useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos ? pos.left : anchor.x - width,
        top: pos ? pos.top : anchor.y + 6,
        width,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        zIndex: 70,
        overflow: 'hidden',
        opacity: pos ? 1 : 0,
        transition: 'opacity 100ms',
      }}
    >
      {sections.map((sec, si) => (
        <div key={si} style={{
          padding: 4,
          borderBottom: si < sections.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          {sec.header && (
            <div style={{
              padding: '6px 10px 4px',
              fontSize: 10, fontWeight: 600,
              color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{sec.header}</div>
          )}
          {sec.items.map(item => (
            <button
              key={item.id}
              onClick={() => { if (!item.disabled) { onClose(); item.onClick && item.onClick(); } }}
              disabled={item.disabled}
              style={{
                width: '100%',
                padding: '7px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 5,
                color: item.color || 'var(--fg-1)',
                fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 500,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 100ms',
              }}
              onMouseEnter={e => !item.disabled && (e.currentTarget.style.background = item.color === 'var(--danger)' ? 'var(--danger-soft)' : 'var(--bg-2)')}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Icon name={item.icon} size={14} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.shortcut && <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{item.shortcut}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// <RowActionMenu>  ·  行级操作菜单 · 项目统一规范
// ═══════════════════════════════════════════════════════════════════════
// 用于表格行末 ⋯ 按钮弹出的操作菜单(实例操作 · 租户操作 · 未来的其它行操作)。
//
// 视觉规范(以后所有类似菜单都用这套,一处调所有生效):
//   · 宽 280 · 圆角 8 · padding 4 · 内部 grid gap 1
//   · 按钮 fontSize 11.5 · padding 6×9 · icon 12 · gap 7 · borderRadius 5
//   · header padding 6-8 × 4-6 · fontSize 11
//   · 危险动作 → color: 'var(--danger)' + hover 变红底
//   · info/accent 等主题动作 → 直接传 color
//
// 定位规范:
//   · portal 到 document.body(脱离 Modal transform 上下文陷阱)
//   · useEffect 挂载后测量真实高度 → 精确定位, opacity 0→1 无闪现
//   · 菜单右边缘对齐按钮右边缘, 顶部紧贴按钮下方 +6px
//   · 下方空间不足自动翻到按钮上方
//   · 小三角箭头指向按钮(方向随翻转自动切换)
//
// 交互规范:
//   · mousedown 检测: 点击菜单外 → 关闭; 但排除 anchorEl (让 ⋯ 按钮自身
//     onClick 独立处理 open/close 切换, 避免"先关又开"陷阱)
//   · Esc 关闭
//   · 点击某项 → 先关菜单再执行 onAction
//
// Props:
//   anchorEl    — ⋯ 按钮的 DOM 引用(必需 · 用于测量位置 + 排除外部关闭)
//   items       — [{id, label, icon, color?, onClick?}] 数组
//   header      — 可选 React 节点(如实例名 + "16 项")
//   columns     — 1 或 2 (default 2)
//   width       — 菜单宽度 (default 280)
//   onClose     — 关闭回调
//   onAction    — 点击某项时 (id, item) => void; 若 item.onClick 已定义则优先它
//
// 使用示例(参见 InstanceRowActionMenu / TenantActionMenu):
//   const [menuFor, setMenuFor] = useState(null);
//   ...
//   <button onClick={e => setMenuFor({ row, anchorEl: e.currentTarget })}>⋯</button>
//   {menuFor && (
//     <RowActionMenu
//       anchorEl={menuFor.anchorEl}
//       header={<span>{menuFor.row.name}</span>}
//       items={[
//         { id: 'edit', label: '编辑', icon: 'edit-3' },
//         { id: 'delete', label: '删除', icon: 'trash-2', color: 'var(--danger)' },
//       ]}
//       onClose={() => setMenuFor(null)}
//       onAction={id => handleAction(id, menuFor.row)}
//     />
//   )}
function RowActionMenu({ anchorEl, items, header, columns = 2, width = 280, onClose, onAction }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);

  // 从 anchorEl 读一次 rect(挂载时);之后 pos 由 setPos 精确定位
  const anchorRect = React.useMemo(() => {
    if (!anchorEl) return null;
    const r = anchorEl.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, [anchorEl]);

  React.useEffect(() => {
    if (!ref.current || !anchorRect) return;
    const realW = ref.current.offsetWidth;
    const realH = ref.current.offsetHeight;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnCenterX = (anchorRect.left + anchorRect.right) / 2;
    // 水平:菜单右边缘对齐按钮右边缘
    let left = anchorRect.right - realW;
    // 垂直:紧贴按钮下方 + 6px 缝隙
    let top = anchorRect.bottom + 6;
    // clamp:右侧溢出 → 顶到 vw-pad;左侧溢出 → 退到按钮中心
    if (left + realW > vw - pad) left = vw - realW - pad;
    if (left < pad) left = Math.min(btnCenterX - 20, vw - realW - pad);
    if (left < pad) left = pad;
    // clamp:下方溢出 → 翻到按钮上方(6px 缝隙)
    if (top + realH > vh - pad) top = Math.max(pad, anchorRect.top - realH - 6);
    setPos({ left, top });
  }, [anchorRect]);

  // 关闭监听(mousedown 排除 anchorEl · Esc)
  React.useEffect(() => {
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorEl]);

  if (!anchorRect) return null;

  // 判断菜单是否翻到按钮上方(用于箭头方向)
  const openUp = pos ? pos.top < anchorRect.top : false;
  const btnCenterX = (anchorRect.left + anchorRect.right) / 2;

  const menu = (
    <div ref={ref} style={{
      position: 'fixed',
      left: pos ? pos.left : anchorRect.right - width,
      top: pos ? pos.top : anchorRect.bottom + 6,
      width,
      background: 'var(--bg-1)',
      border: '1px solid var(--border-strong)',
      borderRadius: 8,
      padding: 4,
      boxShadow: '0 16px 40px oklch(0 0 0 / 0.55)',
      zIndex: 1000,
      display: 'grid',
      gridTemplateColumns: columns === 1 ? '1fr' : '1fr 1fr',
      gap: 1,
      opacity: pos ? 1 : 0,
      transition: 'opacity 100ms',
    }}>
      {/* 小三角箭头(仅定位完成后显示) */}
      {pos && (() => {
        const arrowX = Math.max(10, Math.min(btnCenterX - pos.left - 5, width - 22));
        return (
          <div style={{
            position: 'absolute',
            left: arrowX,
            [openUp ? 'bottom' : 'top']: -6,
            width: 10, height: 10,
            background: 'var(--bg-1)',
            borderTop:    openUp ? 'none' : '1px solid var(--border-strong)',
            borderLeft:   openUp ? 'none' : '1px solid var(--border-strong)',
            borderBottom: openUp ? '1px solid var(--border-strong)' : 'none',
            borderRight:  openUp ? '1px solid var(--border-strong)' : 'none',
            transform: 'rotate(45deg)',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
        );
      })()}

      {/* 头部(可选) */}
      {header && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '6px 8px 4px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 2,
          fontSize: 11, color: 'var(--fg-0)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>{header}</div>
      )}

      {/* 操作项 */}
      {items.map(a => {
        const isDanger = a.color === 'var(--danger)' || a.danger;
        return (
          <button
            key={a.id}
            type="button"
            disabled={a.disabled}
            onClick={() => {
              onClose();
              if (typeof a.onClick === 'function') a.onClick(a);
              else if (typeof onAction === 'function') onAction(a.id, a);
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 9px',
              background: 'transparent', border: 'none',
              borderRadius: 5,
              color: a.color || 'var(--fg-1)',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500,
              cursor: a.disabled ? 'not-allowed' : 'pointer',
              opacity: a.disabled ? 0.5 : 1,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              transition: 'background 80ms',
            }}
            onMouseEnter={e => {
              if (a.disabled) return;
              e.currentTarget.style.background = isDanger ? 'var(--danger-soft)' : 'var(--bg-2)';
            }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Icon name={a.icon} size={12} style={{ color: a.color, flexShrink: 0 }} />
            <span>{a.label}</span>
          </button>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

// ─── Form primitives (used inside modals) ───────────────────────
function FormRow({ label, hint, required, children, style = {} }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{ fontSize: 11.5, color: 'var(--fg-1)', fontWeight: 500, marginBottom: 6, display: 'flex', gap: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        {hint && <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── 通用密码输入框(带眼睛) ─────────────
// 用于替换项目中裸的 <input type="password"> · 保持外层容器/表单布局不变
function PasswordInput({ value, onChange, placeholder, style = {}, mono = true, ...rest }) {
  const [reveal, setReveal] = React.useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={reveal ? 'text' : 'password'}
        value={value ?? ''}
        onChange={e => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '7px 36px 7px 10px',
          background: 'var(--bg-2)', color: 'var(--fg-0)',
          border: '1px solid var(--border)', borderRadius: 4,
          fontSize: 12, fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          outline: 'none',
          ...style,
        }}
        {...rest}
      />
      <button type="button"
        onClick={() => setReveal(!reveal)}
        tabIndex={-1}
        title={reveal ? tr('shell.dce537') : tr('shell.4d775d')}
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

function TextInput({ value, onChange, placeholder, mono, type = 'text', style = {}, autoComplete, maxLength }) {
  const [reveal, setReveal] = React.useState(false);
  const isPass = type === 'password';
  const effType = isPass && reveal ? 'text' : type;
  const inputStyle = {
    width: '100%',
    padding: isPass ? '7px 36px 7px 10px' : '7px 10px',
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--fg-0)',
    fontFamily: mono || isPass ? 'var(--font-mono)' : 'inherit',
    fontSize: 12, outline: 'none',
    ...style,
  };
  if (!isPass) {
    return (
      <input
        type={effType}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={inputStyle}
      />
    );
  }
  // 密码输入框:内嵌眼睛按钮
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={effType}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete || 'off'}
        maxLength={maxLength}
        style={inputStyle}
      />
      <button type="button"
        onClick={() => setReveal(!reveal)}
        tabIndex={-1}
        title={reveal ? tr('shell.dce537') : tr('shell.4d775d')}
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

function TextArea({ value, onChange, placeholder, rows = 4, mono, style = {} }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '8px 10px',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--fg-0)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: 12,
        resize: 'vertical',
        lineHeight: 1.5,
        ...style,
      }}
    />
  );
}

function NumberInput({ value, onChange, min, max, step = 1, style = {} }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(+e.target.value)}
      min={min} max={max} step={step}
      style={{
        width: '100%', padding: '7px 10px',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
        ...style,
      }}
    />
  );
}

function ToggleSwitch({ value, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: value ? 'var(--accent)' : 'var(--bg-3)',
        borderRadius: 999,
        transition: '150ms',
      }}>
        <span style={{
          position: 'absolute', height: 14, width: 14,
          left: value ? 19 : 3, top: 3,
          background: 'white', borderRadius: '50%',
          transition: '150ms',
        }} />
      </span>
    </label>
  );
}

function RadioGroup({ value, onChange, options, direction = 'horizontal' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: direction === 'vertical' ? 'column' : 'row',
      gap: direction === 'vertical' ? 6 : 8,
      flexWrap: 'wrap',
    }}>
      {options.map(o => (
        <label key={o.value} style={{
          padding: '6px 12px',
          background: value === o.value ? 'var(--accent-soft)' : 'var(--bg-2)',
          border: `1px solid ${value === o.value ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: value === o.value ? 'var(--accent)' : 'var(--fg-1)',
          fontSize: 12,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          transition: 'all 100ms',
        }}>
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            style={{ margin: 0 }}
          />
          {o.icon && <Icon name={o.icon} size={12} />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ value = [], onChange, options, columns = 2 }) {
  const toggle = (v) => {
    const set = new Set(value);
    if (set.has(v)) set.delete(v); else set.add(v);
    onChange(Array.from(set));
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 6,
    }}>
      {options.map(o => {
        const checked = value.includes(o.value);
        return (
          <label key={o.value} style={{
            padding: '7px 10px',
            background: checked ? 'var(--accent-soft)' : 'var(--bg-2)',
            border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: checked ? 'var(--accent)' : 'var(--fg-1)',
            fontSize: 12,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all 100ms',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(o.value)}
              style={{ margin: 0 }}
            />
            {o.icon && <Icon name={o.icon} size={12} />}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            {o.hint && <span style={{ fontSize: 10, color: checked ? 'var(--accent)' : 'var(--fg-3)' }}>{o.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}

// A styled key-value list used in drawer bodies
function KVList({ items, columns = 1 }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 14,
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      rowGap: 10, columnGap: 20,
      fontSize: 12,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--fg-3)' }}>{it.label}</span>
          <span style={{ color: 'var(--fg-0)', textAlign: 'right' }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

// Section header inside modal/drawer bodies
function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
      ...style,
    }}>{children}</div>
  );
}

// Wizard stepper header (used inside modal body)
function Stepper({ steps, current }) {
  return (
    <div style={{
      padding: '10px 22px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-2)',
      display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const isActive = n === current;
        const isDone = n < current;
        return (
          <React.Fragment key={n}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', borderRadius: 6,
              background: isActive ? 'var(--accent-soft)' : 'transparent',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: (isDone || isActive) ? 'var(--accent)' : 'var(--bg-3)',
                color: (isDone || isActive) ? 'var(--accent-fg)' : 'var(--fg-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>{isDone ? <Icon name="check" size={11} /> : n}</span>
              <span style={{
                fontSize: 12,
                color: isActive ? 'var(--accent)' : isDone ? 'var(--fg-1)' : 'var(--fg-3)',
                fontWeight: isActive ? 600 : 500,
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, minWidth: 12, height: 1, background: 'var(--border)' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  ShellProvider, ShellContext, useShell,
  DropdownMenu, RowActionMenu,
  KVList, SectionLabel, Stepper,
  FormRow, TextInput, PasswordInput, TextArea, NumberInput,
  ToggleSwitch, RadioGroup, CheckboxGroup,
});
