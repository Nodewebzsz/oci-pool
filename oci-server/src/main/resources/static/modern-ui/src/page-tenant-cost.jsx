// 费用统计 · 独立整页
// 由租户列表操作菜单跳入，替代原 useCostDrawer 弹窗方案。
// 严格对齐客户端 TenantCostView.swift：
// - 顶部：图标对齐为信用卡图标 (creditcard)、面包屑导航（租户管理 / 费用统计）、副标题「租户名 · 中文区域」
// - 工具栏：仅保留「返回列表」与「刷新」双按钮
// - 筛选栏：时间快捷预设（今天 / 本月 / 自定义）、开始与结束日期输入框、查询按钮
// - 5 张核心费用统计卡片：总费用、计算、存储、网络、其他（带底部高亮色条）
// - 每日费用趋势图：包含折线图、图例与分类切换（全部 / 计算 / 存储 / 网络 / 其他）
// - 费用明细大表：表格顶部「仅显示 > 0 / 显示全部」切换按钮、5 列明细（日期、资源类型、SKU 名称、资源 OCID、费用）、客户端分页

const { useState: useStateCost, useMemo: useMemoCost, useEffect: useEffectCost } = React;

function TenantCostPage({ density, ctx, navigate }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [tenant, setTenant] = useStateCost(null);
  const [loading, setLoading] = useStateCost(false);
  const [error, setError] = useStateCost(null);
  const [rows, setRows] = useStateCost([]);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const [preset, setPreset] = useStateCost('month');
  const [startDate, setStartDate] = useStateCost(monthStart);
  const [endDate, setEndDate] = useStateCost(today);

  // 趋势图分类切换：all | compute | storage | network | other
  const [chartType, setChartType] = useStateCost('all');

  // 明细过滤与分页
  const [positiveOnly, setPositiveOnly] = useStateCost(false);
  const [page, setPage] = useStateCost(1);
  const [pageSize, setPageSize] = useStateCost(20);

  const CAT_OF = {
    COMPUTE: 'compute',
    BLOCK_STORAGE: 'storage',
    OBJECT_STORAGE: 'storage',
    NETWORK: 'network',
    OTHER: 'other'
  };

  const computeColor = '#4a73ff';
  const storageColor = '#ff9f40';
  const networkColor = 'var(--accent)';
  const otherColor   = '#6b7280';

  // 1. 获取当前租户基础信息
  useEffectCost(() => {
    let active = true;
    if (!ctx?.tenantId) return;

    window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx.tenantId)}`)
      .then(rList => {
        if (!active) return;
        const normalized = (Array.isArray(rList) ? rList : []).map(row => window.ociTenantRow.normalize(row, REGIONS));
        const root = normalized.find(row => String(row.id) === String(ctx.tenantId))
          || normalized.find(row => row.isHomeRegion)
          || normalized[0];
        setTenant(root);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [ctx?.tenantId]);

  const loadRows = async (s, e) => {
    if (!ctx?.tenantId) return;
    setLoading(true);
    setError(null);

    try {
      const j = await window.ociApi.request('/cost/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: ctx.tenantId, startDate: s, endDate: e }),
      });
      const list = (j && Array.isArray(j.data)) ? j.data : [];
      setRows(list.map(r => ({
        day: r.day,
        resourceType: r.resourceType,
        skuName: r.skuName,
        resourceId: r.resourceId,
        cost: Number(r.cost || 0),
      })));
      setPage(1);
    } catch (err) {
      setRows([]);
      const errMsg = (err && err.message) || String(err);
      setError(errMsg);
      shell.showToast(tr('tenant.1c6c6a') + errMsg, { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const runQuery = () => {
    let s, e;
    if (preset === 'today') { s = today; e = today; }
    else if (preset === 'month') { s = monthStart; e = today; }
    else { s = startDate; e = endDate; }
    if (new Date(s) > new Date(e)) {
      shell.showToast(tr('tenant.f3e0fa'), { kind: 'error' });
      return;
    }
    loadRows(s, e);
  };

  // 初始加载本月费用
  useEffectCost(() => {
    if (ctx?.tenantId) {
      loadRows(monthStart, today);
    }
  }, [ctx?.tenantId]);

  // 5 张统计卡计算
  const stats = useMemoCost(() => {
    const s = { total: 0, compute: 0, storage: 0, network: 0, other: 0 };
    rows.forEach(r => {
      s.total += r.cost;
      s[CAT_OF[r.resourceType] || 'other'] += r.cost;
    });
    return s;
  }, [rows]);

  // 每日趋势按日期分桶
  const trendData = useMemoCost(() => {
    const byDay = new Map();
    rows.forEach(r => {
      if (!byDay.has(r.day)) {
        byDay.set(r.day, { compute: 0, storage: 0, network: 0, other: 0, total: 0 });
      }
      const item = byDay.get(r.day);
      const cat = CAT_OF[r.resourceType] || 'other';
      item[cat] += r.cost;
      item.total += r.cost;
    });
    const days = Array.from(byDay.keys()).sort();
    return {
      days,
      compute: days.map(d => byDay.get(d).compute),
      storage: days.map(d => byDay.get(d).storage),
      network: days.map(d => byDay.get(d).network),
      other:   days.map(d => byDay.get(d).other),
      total:   days.map(d => byDay.get(d).total),
    };
  }, [rows]);

  // 过滤后的明细
  const filteredRows = useMemoCost(() => {
    return positiveOnly ? rows.filter(r => r.cost > 0) : rows;
  }, [rows, positiveOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemoCost(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const regionShortName = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  const tenantSubtitle = useMemoCost(() => {
    if (!tenant) return '';
    const name = getTenantName(tenant) || '';
    const regCode = getTenantRegion(tenant) || '';
    const regCn = regionShortName(regCode) || regCode || '—';
    return `${name} · ${regCn}`;
  }, [tenant]);

  const money = (v) => `$${Number(v || 0).toFixed(4)}`;
  const money6 = (v) => `$${Number(v || 0).toFixed(6)}`;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 16, minHeight: '100%', flexShrink: 0,
    }}>
      {/* ── 1. 顶部页头 · 严格对齐客户端 PageScaffold ─────────────── */}
      <div style={{
        padding: '14px 20px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="credit-card" size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            {/* 面包屑导航：字号严格统一为 16px，通过颜色与字重清晰区分层级 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.25 }}>
              <span
                onClick={() => navigate('tenants')}
                style={{
                  color: 'var(--fg-2)',
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
              >
                {tr('app.f0f7e8')}
              </span>
              <span style={{ color: 'var(--fg-3)', fontSize: 13, fontWeight: 400, opacity: 0.7 }}>/</span>
              <span style={{
                color: 'var(--fg-0)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0,
              }}>
                费用统计
              </span>
            </div>
            {/* 副标题：完整租户名 · 中文区域名 */}
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              {tenantSubtitle}
            </div>
          </div>
        </div>

        {/* 顶部工具栏操作：仅保留「返回列表」与「刷新」双按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('tenants')}>
            返回列表
          </Button>
          <Button variant="secondary" size="sm" icon="refresh-cw" loading={loading} onClick={runQuery}>
            刷新
          </Button>
        </div>
      </div>

      {/* ── 2. 错误横幅 ───────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'color-mix(in oklab, var(--danger) 12%, transparent)',
          border: '1px solid var(--danger)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: 'var(--danger)', fontSize: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="alert-triangle" size={15} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600 }}>查询费用统计失败：</span>
              <span style={{ opacity: 0.9 }}>{error}</span>
            </div>
          </div>
          <Button size="xs" variant="outline" onClick={runQuery}>重试</Button>
        </div>
      )}

      {/* ── 3. 筛选控制器（Filter Bar） ───────────────────────── */}
      <div style={{
        padding: 14,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>时间范围：</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {[
              { id: 'today', label: '今天' },
              { id: 'month', label: '本月' },
              { id: 'custom', label: '自定义' },
            ].map((p, i, arr) => {
              const on = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  style={{
                    padding: '6px 14px',
                    background: on ? 'var(--accent)' : 'var(--bg-2)',
                    color: on ? '#ffffff' : 'var(--fg-1)',
                    border: 'none',
                    borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    fontSize: 12, fontWeight: on ? 600 : 500,
                    transition: 'all 100ms',
                  }}
                >{p.label}</button>
              );
            })}
          </div>
        </div>

        {preset === 'custom' ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            />
            <span style={{ color: 'var(--fg-3)' }}>至</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            />
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {preset === 'today' ? today : `${monthStart} ~ ${today}`}
          </span>
        )}

        <Button
          size="sm"
          variant="primary"
          icon="search"
          loading={loading}
          onClick={runQuery}
        >
          查询
        </Button>
      </div>

      {/* ── 4. 5 张统计卡片 ───────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0,
      }}>
        <CostStatCard title="总费用" value={money(stats.total)} color="var(--accent)" />
        <CostStatCard title="计算" value={money(stats.compute)} color={computeColor} />
        <CostStatCard title="存储" value={money(stats.storage)} color={storageColor} />
        <CostStatCard title="网络" value={money(stats.network)} color={networkColor} />
        <CostStatCard title="其他" value={money(stats.other)} color={otherColor} />
      </div>

      {/* ── 5. 每日费用趋势折线图 ─────────────────────────────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>每日费用趋势</span>
          {/* 分类切换器 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all', label: '全部' },
              { id: 'compute', label: '计算' },
              { id: 'storage', label: '存储' },
              { id: 'network', label: '网络' },
              { id: 'other', label: '其他' },
            ].map(b => {
              const on = chartType === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setChartType(b.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 11, fontWeight: on ? 600 : 500,
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
                    background: on ? 'var(--accent)' : 'var(--bg-2)',
                    color: on ? '#ffffff' : 'var(--fg-1)',
                    cursor: 'pointer',
                  }}
                >{b.label}</button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* 图例 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 11, color: 'var(--fg-2)' }}>
            {chartType === 'all' ? (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: computeColor }} />计算
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: storageColor }} />存储
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: networkColor }} />网络
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: otherColor }} />其他
                </span>
              </>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: chartType === 'compute' ? computeColor : (chartType === 'storage' ? storageColor : (chartType === 'network' ? networkColor : otherColor)) }} />
                {chartType === 'compute' ? '计算' : (chartType === 'storage' ? '存储' : (chartType === 'network' ? '网络' : '其他'))}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ color: 'var(--fg-3)' }}>USD</span>
          </div>

          {trendData.days.length === 0 ? (
            <div style={{
              height: 240,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: 'var(--fg-3)',
            }}>
              <Icon name="chart-bar" size={32} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: 13 }}>暂无费用趋势数据</span>
            </div>
          ) : (
            <CostTrendSvg
              days={trendData.days}
              series={chartType === 'all' ? [
                { data: trendData.compute, color: computeColor },
                { data: trendData.storage, color: storageColor },
                { data: trendData.network, color: networkColor },
                { data: trendData.other,   color: otherColor },
              ] : [
                { data: trendData[chartType] || trendData.total, color: chartType === 'compute' ? computeColor : (chartType === 'storage' ? storageColor : (chartType === 'network' ? networkColor : otherColor)) }
              ]}
            />
          )}
        </div>
      </div>

      {/* ── 6. 费用明细大表 ───────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {/* 明细表头操作栏 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>费用明细</span>
          <Button
            size="xs"
            variant={positiveOnly ? 'primary' : 'outline'}
            icon="filter"
            onClick={() => setPositiveOnly(!positiveOnly)}
          >
            {positiveOnly ? '显示全部' : '仅显示 > 0'}
          </Button>
        </div>

        {/* 5 列大表 */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 140px 1fr 220px 120px',
            padding: '10px 16px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--fg-3)',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <div>日期</div>
            <div>资源类型</div>
            <div>SKU 名称</div>
            <div>资源 ID</div>
            <div style={{ textAlign: 'right' }}>费用 (USD)</div>
          </div>

          <div>
            {pagedRows.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                暂无费用明细数据
              </div>
            ) : (
              pagedRows.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 140px 1fr 220px 120px',
                    padding: '9px 16px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12,
                    alignItems: 'center',
                    background: idx % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 35%, transparent)' : 'transparent',
                  }}
                >
                  <div className="mono" style={{ color: 'var(--fg-2)' }}>{r.day}</div>
                  <div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600,
                      background: 'var(--bg-3)', color: 'var(--fg-1)',
                    }}>{r.resourceType}</span>
                  </div>
                  <div style={{ color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.skuName}>
                    {r.skuName}
                  </div>
                  <div className="mono" style={{ color: 'var(--fg-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.resourceId}>
                    {r.resourceId || '—'}
                  </div>
                  <div className="mono num" style={{ textAlign: 'right', fontWeight: 600, color: r.cost > 0 ? 'var(--accent)' : 'var(--fg-2)' }}>
                    {money6(r.cost)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 分页条 */}
        {filteredRows.length > 0 && (
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--fg-2)',
          }}>
            <span>共 {filteredRows.length} 条记录</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Button size="xs" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                上一页
              </Button>
              <span className="mono" style={{ padding: '0 4px' }}>{page} / {totalPages}</span>
              <Button size="xs" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 辅助卡片组件
function CostStatCard({ title, value, color }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{title}</span>
      <span className="num mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.2 }}>
        {value}
      </span>
      <div style={{ height: 3, background: color, borderRadius: 2, marginTop: 4 }} />
    </div>
  );
}

// 辅助折线组件
function CostTrendSvg({ days, series }) {
  const H = 220, W = 800;
  const padL = 50, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allVals = series.flatMap(s => s.data);
  const maxVal = Math.max(...allVals, 0.001) * 1.15;

  const scaleX = (i) => padL + (i * innerW) / Math.max(days.length - 1, 1);
  const scaleY = (v) => padT + innerH - (v / maxVal) * innerH;

  const buildPath = (data) => {
    if (!data || data.length === 0) return '';
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ');
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
        const y = padT + innerH - frac * innerH;
        const val = maxVal * frac;
        return (
          <g key={idx}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity="0.5" />
            <text x={padL - 8} y={y + 3} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="var(--font-mono)">
              ${val.toFixed(2)}
            </text>
          </g>
        );
      })}

      {days.map((d, idx) => {
        if (days.length > 8 && idx % Math.ceil(days.length / 8) !== 0) return null;
        const x = scaleX(idx);
        return (
          <text key={idx} x={x} y={H - 8} fontSize="10" fill="var(--fg-3)" textAnchor="middle">
            {d.slice(5)}
          </text>
        );
      })}

      {series.map((s, idx) => (
        <path key={idx} d={buildPath(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// 暴露到全局供 app.jsx 加载挂载
window.TenantCostPage = TenantCostPage;
