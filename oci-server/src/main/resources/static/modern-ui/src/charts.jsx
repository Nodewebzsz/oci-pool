// Charts — SVG hand-drawn, no libs
const { useState: useStateC, useMemo: useMemoC } = React;

// Circular gauge — the big centerpiece for CPU/MEM/UPTIME
function CircularGauge({
  value, max = 100, size = 180, thickness = 14,
  color = 'var(--accent)', track = 'var(--bg-3)',
  label, unit = '%', valueSize = 36, showTicks = false,
}) {
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const safeVal = Number(value);
  const pct = Number.isFinite(safeVal) ? Math.min(1, Math.max(0, safeVal / max)) : 0;
  const dash = C * pct;
  const displayVal = Number.isFinite(safeVal) ? safeVal : '—';
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        {showTicks && Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * 2 * Math.PI;
          const x1 = cx + Math.cos(a) * (r + thickness / 2 + 4);
          const y1 = cy + Math.sin(a) * (r + thickness / 2 + 4);
          const x2 = cx + Math.cos(a) * (r + thickness / 2 + 8);
          const y2 = cy + Math.sin(a) * (r + thickness / 2 + 8);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fg-3)" strokeWidth="0.5" opacity="0.4" />;
        })}
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: size, height: size,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div className="num" style={{ fontSize: valueSize, fontWeight: 700, color, letterSpacing: -1.5, lineHeight: 1 }}>
          {displayVal}{unit && <span style={{ fontSize: valueSize * 0.45, marginLeft: 2 }}>{unit}</span>}
        </div>
        {label && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>{label}</div>}
      </div>
    </div>
  );
}

// Area line chart
function AreaChart({ series, width = 600, height = 180, padding = { top: 16, right: 12, bottom: 24, left: 40 }, xLabels }) {
  const { t: tr } = useT();
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const safeSeries = (series || []).map((s) => ({
    ...s,
    data: (s.data || []).map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }),
  }));
  const allValues = safeSeries.flatMap(s => s.data);
  let max = allValues.length ? Math.max(...allValues) * 1.15 : 1;
  if (!Number.isFinite(max) || max <= 0) max = 1;
  const min = 0;
  const range = max - min || 1;
  const len = safeSeries[0]?.data?.length || 0;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => (max / gridLines) * i);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
      <defs>
        {safeSeries.map((s, i) => (
          <linearGradient key={i} id={`grad-area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {yTicks.map((tv, i) => {
        const y = padding.top + h - (tv / range) * h;
        return (
          <g key={i}>
            <line x1={padding.left} x2={padding.left + w} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
            <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">
              {tv >= 1000 ? (tv / 1000).toFixed(1) + 'k' : tv.toFixed(0)}
            </text>
          </g>
        );
      })}
      {xLabels && xLabels.map((label, i) => {
        const x = padding.left + (i / (xLabels.length - 1)) * w;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">{label}</text>
        );
      })}
      {safeSeries.map((s, si) => {
        if (!len) return null;
        const pts = s.data.map((v, i) => {
          const x = padding.left + (i / (len - 1)) * w;
          const y = padding.top + h - ((v - min) / range) * h;
          return [x, y];
        });
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
        const areaD = pathD + ` L${pts[pts.length - 1][0]},${padding.top + h} L${pts[0][0]},${padding.top + h} Z`;
        return (
          <g key={s.id}>
            <path d={areaD} fill={`url(#grad-area-${s.id})`} />
            <path d={pathD} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

// Vertical bar chart with success dots.
// `maxY` pins the vertical scale (e.g. 120 => ticks 120/90/60/30/0); without it the top is auto-scaled.
function BarChart({ data, successAt = [], width = 600, height = 180, padding = { top: 16, right: 12, bottom: 24, left: 40 }, xLabels, maxY }) {
  const { t: tr } = useT();
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const safeData = (data || []).map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });
  const dataMax = safeData.length ? Math.max(...safeData) : 0;
  let max = maxY != null ? Number(maxY) : dataMax * 1.15;
  if (!Number.isFinite(max) || max <= 0) max = 1;
  if (maxY != null && dataMax > max) max = dataMax * 1.15;
  // 横向刻度槽位数：优先用 xLabels 数量（如 24h/18h/.../now 共 6 槽），
  // 这样即使数据点还不足 6 个，柱和刻度也能按 6 个槽均匀分布。
  const slots = xLabels && xLabels.length ? xLabels.length : (safeData.length || 1);
  const barWidth = safeData.length ? (w / slots) * 0.55 : 0;
  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => (max / gridLines) * i);
  const hasData = safeData.some((v) => v > 0);

  if (!safeData.length || !hasData) {
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
        {yTicks.map((tv, i) => {
          const y = padding.top + h - (tv / max) * h;
          return (
            <g key={i}>
              <line x1={padding.left} x2={padding.left + w} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i === 0 ? '0' : '2 4'} />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">
                {max >= 1000 ? (tv / 1000).toFixed(1) + 'k' : tv.toFixed(0)}
              </text>
            </g>
          );
        })}
        <text x={padding.left + w / 2} y={padding.top + h / 2} textAnchor="middle" fontSize="11" fill="var(--fg-3)">{tr('common.noDataChart')}</text>
        {/* 暂无数据时也渲染横轴刻度,对齐 24h ~ now 间隔 */}
        {xLabels && xLabels.map((label, i) => {
          const x = padding.left + (i / (xLabels.length || 1)) * w + (w / (xLabels.length || 1)) / 2;
          return (
            <text key={'x' + i} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">{label}</text>
          );
        })}
      </svg>
    );
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
      {yTicks.map((tv, i) => {
        const y = padding.top + h - (tv / max) * h;
        return (
          <g key={i}>
            <line x1={padding.left} x2={padding.left + w} y1={y} y2={y} stroke="var(--border)" strokeDasharray={i === 0 ? '0' : '2 4'} />
            <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">
              {max >= 1000 ? (tv / 1000).toFixed(1) + 'k' : tv.toFixed(0)}
            </text>
          </g>
        );
      })}
      {safeData.map((v, i) => {
        const x = padding.left + (i / slots) * w + (w / slots - barWidth) / 2;
        const barH = (v / max) * h;
        const y = padding.top + h - barH;
        const success = successAt[i];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill="var(--cyan)" opacity="0.7" rx="1" />
            {success ? (
              <circle cx={x + barWidth / 2} cy={y - 6} r="3" fill="var(--accent)">
                <animate attributeName="r" values="3;4.5;3" dur="1.6s" repeatCount="indefinite" />
              </circle>
            ) : null}
          </g>
        );
      })}
      {xLabels && xLabels.map((label, i) => {
        if (i % Math.ceil(xLabels.length / 8) !== 0) return null;
        const x = padding.left + (i / slots) * w + (w / slots) / 2;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-mono)">{label}</text>
        );
      })}
    </svg>
  );
}

Object.assign(window, { CircularGauge, AreaChart, BarChart });
