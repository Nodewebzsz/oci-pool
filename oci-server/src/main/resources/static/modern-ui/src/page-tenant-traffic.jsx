// 实例流量监控 · 独立整页
// 严格对齐客户端 TenantTrafficView.swift 的视觉布局与交互规范：
// - 顶部：图标对齐为带水平基准线的图表图标、面包屑导航（租户管理 / 实例流量监控）、租户全名与中文区域、仅保留「返回列表」与「刷新数据」双按钮
// - 筛选栏：多区域复选悬浮下拉菜单（默认不选中任何区域）、时间快捷选项、自定义日期起止、查询按钮
// - 统计卡片：总流量、入站流量、出站流量均格式化为标准两位小数（如 0.00 GB），预警阈值格式化为 10.00 TB
// - 占比环图：圆环内部正中显示粗体百分比（如 0.0%），下方展示「已用 X.XX GB」与「剩余 Y.YY GB」双图例
// - 总体流量趋势：未查询或无数据时展示 280px 高度的「暂无趋势数据，请选择区域后查询」居中占位，有数据时展示平滑折线图
// - 实例流量趋势：各实例卡片或暂无实例占位展示

const { useState: useStateTF, useMemo: useMemoTF, useEffect: useEffectTF, useRef: useRefTF } = React;

function TenantTrafficPage({ density, ctx, navigate }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [tenant, setTenant] = useStateTF(null);
  const [availableRegions, setAvailableRegions] = useStateTF([]);
  // 默认不选中任何区域，严格对齐客户端默认行为
  const [selectedRegions, setSelectedRegions] = useStateTF([]);
  const [regionMenuOpen, setRegionMenuOpen] = useStateTF(false);

  const [timePreset, setTimePreset] = useStateTF('month');
  const [startDate, setStartDate] = useStateTF(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useStateTF(() => new Date().toISOString().slice(0, 10));

  const [thresholdGB, setThresholdGB] = useStateTF(10240); // GB (10 TB)
  const [instanceData, setInstanceData] = useStateTF([]);
  const [trendSeries, setTrendSeries] = useStateTF({ times: [], ingress: [], egress: [], total: [] });
  const [loading, setLoading] = useStateTF(false);
  const [queried, setQueried] = useStateTF(false);
  const [masked, setMasked] = useStateTF(false); // 默认完整显示真实租户名

  const regionMenuRef = useRefTF(null);

  // 1. 加载当前租户基础信息与区域列表，获取预警阈值
  useEffectTF(() => {
    let active = true;
    if (!ctx?.tenantId) return;

    window.ociApi.request(`/tenants/regionList/json?tenantId=${encodeURIComponent(ctx.tenantId)}`)
      .then(rows => {
        if (!active) return;
        const normalized = (Array.isArray(rows) ? rows : []).map(row => window.ociTenantRow.normalize(row, REGIONS));
        const root = normalized.find(row => String(row.id) === String(ctx.tenantId))
          || normalized.find(row => row.isHomeRegion)
          || normalized[0];
        setTenant(root);

        const regions = [
          getTenantRegion(root),
          ...normalized.map(getTenantRegion),
        ].filter(Boolean).filter((code, idx, list) => list.indexOf(code) === idx);

        setAvailableRegions(regions);
        // 遵循客户端规则：初始不选中任何区域，等待用户主动选择
        setSelectedRegions([]);
      })
      .catch(err => {
        if (active) {
          shell.showToast(tr('tenant.d920e8') + (err.message || err), { kind: 'error' });
        }
      });

    // 读取该租户设置的真实流量预警阈值
    window.ociApi.request(`/monitor/api/traffic/alert?tenantId=${encodeURIComponent(ctx.tenantId)}`)
      .then(r => {
        if (!active) return;
        const th = (r && r.data && r.data.threshold) ? Number(r.data.threshold) : (r && r.threshold ? Number(r.threshold) : 10240);
        if (th > 0) setThresholdGB(th);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [ctx?.tenantId]);

  // 点击外部收起多选下拉菜单
  useEffectTF(() => {
    if (!regionMenuOpen) return;
    const handleClickOutside = (e) => {
      if (regionMenuRef.current && !regionMenuRef.current.contains(e.target)) {
        setRegionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [regionMenuOpen]);

  const resolvedRange = () => {
    const now = new Date();
    if (timePreset === 'today') {
      const d = now.toISOString().slice(0, 10);
      return { start: d, end: d };
    }
    if (timePreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end: now.toISOString().slice(0, 10) };
    }
    return { start: startDate, end: endDate };
  };

  const loadTraffic = async () => {
    if (!ctx?.tenantId) return;
    if (selectedRegions.length === 0) {
      shell.showToast('请选择区域', { kind: 'warn' });
      return;
    }
    const { start, end } = resolvedRange();
    if (timePreset === 'custom') {
      if (new Date(start) > new Date(end)) {
        shell.showToast('开始时间不能晚于结束时间', { kind: 'warn' });
        return;
      }
      const diff = (new Date(end) - new Date(start)) / (24 * 3600 * 1000);
      if (diff > 92) {
        shell.showToast('自定义查询区间不能超过92天', { kind: 'warn' });
        return;
      }
    }

    setLoading(true);
    try {
      const j = await window.ociApi.request('/monitor/api/instances/traffic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIds: [ctx.tenantId], startDate: start, endDate: end, period: '1d' }),
      });
      const list = Array.isArray(j) ? j : [];
      
      // 实例流量明细
      const rows = list.map(v => ({
        id: v.instanceId || v.id || v.instanceName || v.displayName,
        name: v.displayName || v.instanceName || v.instanceId || tr('tenant.480c21'),
        ip: v.publicIp || v.publicIps || '',
        ingressBytes: Number(v.ingressBytes || 0),
        egressBytes: Number(v.egressBytes || 0),
        timePoint: v.timePoint || '',
      }));
      setInstanceData(rows);

      // 时序趋势分桶（按 timePoint 分组，对齐客户端 trendSeries）
      const bucket = {};
      rows.forEach(r => {
        const key = r.timePoint ? r.timePoint.replace('T', ' ').slice(0, 10) : '';
        if (!key) return;
        if (!bucket[key]) bucket[key] = { inB: 0, outB: 0 };
        bucket[key].inB += r.ingressBytes;
        bucket[key].outB += r.egressBytes;
      });
      const times = Object.keys(bucket).sort();
      const ingress = times.map(t => bucket[t].inB / 1073741824.0);
      const egress = times.map(t => bucket[t].outB / 1073741824.0);
      const total = ingress.map((v, i) => v + egress[i]);
      setTrendSeries({ times, ingress, egress, total });

      setQueried(true);
    } catch (err) {
      setInstanceData([]);
      setTrendSeries({ times: [], ingress: [], egress: [], total: [] });
      shell.showToast(tr('tenant.d920e8') + (err.message || err), { kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 4 核心统计指标计算（精确保留两位小数，对齐客户端 0.00 GB）
  const totalIngressBytes = useMemoTF(() => instanceData.reduce((a, r) => a + r.ingressBytes, 0), [instanceData]);
  const totalEgressBytes = useMemoTF(() => instanceData.reduce((a, r) => a + r.egressBytes, 0), [instanceData]);
  const totalAllBytes = totalIngressBytes + totalEgressBytes;

  const totalAllGB = totalAllBytes / 1073741824.0;
  const totalIngressGB = totalIngressBytes / 1073741824.0;
  const totalEgressGB = totalEgressBytes / 1073741824.0;

  const formatGBText = (bytes) => `${(bytes / 1073741824.0).toFixed(2)} GB`;
  const formatTBorGBText = (valueGB) => {
    if (valueGB >= 1024) return `${(valueGB / 1024.0).toFixed(2)} TB`;
    return `${valueGB.toFixed(2)} GB`;
  };

  const regionShortName = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  // 租户副标题（纯净对齐：租户名 · 区域中文名，无多余灰色别名小方块）
  const tenantSubtitle = useMemoTF(() => {
    if (!tenant) return '';
    const name = getTenantName(tenant) || '';
    const regCode = getTenantRegion(tenant) || '';
    const regCn = regionShortName(regCode) || regCode || '—';
    return `${name} · ${regCn}`;
  }, [tenant]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 16, minHeight: '100%',
      // 关键：禁止父级 flex 列收缩本页各卡片（否则无固有高度的图表卡会被压成细条）
      flexShrink: 0,
    }}>
      {/* ── 1. 顶部页头 · 严格对齐客户端 PageScaffold ─────────────── */}
      <div style={{
        padding: '14px 20px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {/* 对齐客户端图标：带基准线的柱线图 (chart.bar.xaxis) */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="activity" size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            {/* 面包屑导航：字号严格统一为 16px，通过颜色与字重清晰区分层级 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, lineHeight: 1.25 }}>
              <span
                onClick={() => navigate('tenants')}
                style={{
                  color: 'var(--fg-2)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
              >
                {tr('app.f0f7e8')}
              </span>
              <span style={{ color: 'var(--fg-3)', fontSize: 14, fontWeight: 400, opacity: 0.8 }}>/</span>
              <span style={{
                color: 'var(--fg-0)',
                fontWeight: 600,
                letterSpacing: -0.2,
              }}>
                实例流量监控
              </span>
            </div>
            {/* 副标题：完整显示真实名称 · 中文区域名 */}
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              {tenantSubtitle}
            </div>
          </div>
        </div>

        {/* 顶部工具栏操作：仅保留「返回列表」与「刷新数据」，严格对齐客户端 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('tenants')}>
            返回列表
          </Button>
          <Button variant="secondary" size="sm" icon="refresh-cw" loading={loading} onClick={loadTraffic}>
            刷新数据
          </Button>
        </div>
      </div>

      {/* ── 2. 筛选控制器（Filter Bar · 遵循第三章零高度抖动标准） ── */}
      <div style={{
        padding: 14,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', zIndex: 50,
        flexShrink: 0,
      }}>
        {/* 多区域复选下拉菜单：默认不选中任何区域 */}
        <div ref={regionMenuRef} style={{ position: 'relative', width: 240 }}>
          <button
            type="button"
            onClick={() => setRegionMenuOpen(!regionMenuOpen)}
            style={{
              width: '100%',
              padding: '7px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: selectedRegions.length === 0 ? 'var(--fg-3)' : 'var(--fg-0)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedRegions.length === 0
                ? '请选择区域'
                : selectedRegions.length === 1
                  ? regionShortName(selectedRegions[0])
                  : `已选 ${selectedRegions.length} 个区域`}
            </span>
            <Icon name={regionMenuOpen ? 'chevron-up' : 'chevron-down'} size={12} style={{ color: 'var(--fg-3)', flexShrink: 0, marginLeft: 8 }} />
          </button>

          {/* 绝对定位悬浮面板 */}
          {regionMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0,
              width: 240,
              background: 'var(--bg-1)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
              padding: 4,
              zIndex: 100,
            }}>
              {/* 全选 / 取消全选 */}
              <div
                onClick={() => {
                  if (selectedRegions.length === availableRegions.length && availableRegions.length > 0) {
                    setSelectedRegions([]);
                  } else {
                    setSelectedRegions([...availableRegions]);
                  }
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: 4,
                  fontSize: 12.5, fontWeight: 500,
                  color: 'var(--fg-0)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>{selectedRegions.length === availableRegions.length && availableRegions.length > 0 ? '✓ 取消全选' : '全选所有区域'}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {availableRegions.map(code => {
                  const isSel = selectedRegions.includes(code);
                  return (
                    <div
                      key={code}
                      onClick={() => {
                        if (isSel) setSelectedRegions(selectedRegions.filter(x => x !== code));
                        else setSelectedRegions([...selectedRegions, code]);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: 12.5,
                        color: isSel ? 'var(--accent)' : 'var(--fg-1)',
                        background: isSel ? 'var(--accent-soft)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-2)'; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: '1px solid ' + (isSel ? 'var(--accent)' : 'var(--border-strong)'),
                        background: isSel ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {isSel && <Icon name="check" size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                      </div>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {regionShortName(code)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 时间范围快捷预设 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>时间范围：</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {[
              { id: 'today', label: '今天' },
              { id: 'month', label: '本月' },
              { id: 'custom', label: '自定义' },
            ].map((p, i, arr) => {
              const on = timePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTimePreset(p.id)}
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

        {/* 自定义日期起止输入 */}
        {timePreset === 'custom' && (
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
        )}

        <Button
          size="sm"
          variant="primary"
          icon="search"
          loading={loading}
          onClick={loadTraffic}
        >
          查询
        </Button>
      </div>

      {/* ── 3. 四张核心指标卡片（严格对齐客户端格式与两位小数 0.00 GB） ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
      }}>
        <ClientStatCard title="总流量" value={formatGBText(totalAllBytes)} icon="activity" color="var(--accent)" />
        <ClientStatCard title="入站流量" value={formatGBText(totalIngressBytes)} icon="arrow-down" color="var(--accent)" />
        <ClientStatCard title="出站流量" value={formatGBText(totalEgressBytes)} icon="arrow-up" color="var(--accent)" />
        <ClientStatCard title="预警阈值" value={formatTBorGBText(thresholdGB)} icon="bell" color="var(--danger)" isFilledIcon />
      </div>

      {/* ── 4. 三张环形占比进度卡片（完全对齐客户端大环形与正中大字） ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
      }}>
        <ClientDonutCard
          title="总流量占比"
          usedGB={totalAllGB}
          thresholdGB={thresholdGB}
          usedColor="var(--info)"
        />
        <ClientDonutCard
          title="入站流量占比"
          usedGB={totalIngressGB}
          thresholdGB={thresholdGB}
          usedColor="#34d399"
        />
        <ClientDonutCard
          title="出站流量占比"
          usedGB={totalEgressGB}
          thresholdGB={thresholdGB}
          usedColor="#f87171"
        />
      </div>

      {/* ── 5. 总体流量趋势折线图（对齐客户端空态 280px 居中占位） ── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: 15, fontWeight: 600, color: 'var(--fg-0)',
        }}>
          总体流量趋势
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 11, color: 'var(--fg-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#34d399' }} />
              入站流量
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#f87171' }} />
              出站流量
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--info)' }} />
              总流量
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ color: 'var(--fg-3)' }}>流量 (GB)</span>
          </div>

          {/* 若无数据：展示 280px 居中占位符，对齐客户端 */}
          {trendSeries.times.length === 0 ? (
            <div style={{
              height: 280,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: 'var(--fg-3)',
            }}>
              <Icon name="activity" size={32} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: 13 }}>暂无趋势数据，请选择区域后查询</span>
            </div>
          ) : (
            <ClientTrafficLineChart
              times={trendSeries.times}
              ingress={trendSeries.ingress}
              egress={trendSeries.egress}
              total={trendSeries.total}
            />
          )}
        </div>
      </div>

      {/* ── 6. 实例流量趋势明细（对齐客户端空态与大盘卡片） ───────── */}
      <div style={{
        padding: 16,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 16 }}>
          实例展示流量趋势
        </div>

        {instanceData.length === 0 ? (
          <div style={{
            height: 140,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--fg-3)',
          }}>
            <Icon name="activity" size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 13 }}>暂无实例流量数据，请选择区域后查询</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: 16,
          }}>
            {instanceData.map((d, i) => (
              <div key={d.id || i} style={{
                padding: 14,
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{d.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{d.ip ? `IP: ${d.ip}` : 'IP: —'}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-2)' }}>
                  <span>入站流量: {(d.ingressBytes / 1073741824.0).toFixed(2)} GB</span>
                  <span>出站流量: {(d.egressBytes / 1073741824.0).toFixed(2)} GB</span>
                </div>
                {/* 双色流量条 */}
                <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(d.ingressBytes / (d.ingressBytes + d.egressBytes || 1)) * 100}%`, background: '#34d399' }} />
                  <div style={{ width: `${(d.egressBytes / (d.ingressBytes + d.egressBytes || 1)) * 100}%`, background: '#f87171' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 辅助组件：客户端同款四大指标卡片 ─────────────────────────────
function ClientStatCard({ title, value, icon, color, isFilledIcon = false }) {
  return (
    <div style={{
      padding: '14px 18px',
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}>{title}</span>
        <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.2 }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── 辅助组件：客户端同款三大环形进度卡片 ─────────────────────────
function ClientDonutCard({ title, usedGB, thresholdGB, usedColor }) {
  const threshold = Math.max(thresholdGB, 0.001);
  const remainGB = Math.max(threshold - usedGB, 0);
  const pct = Math.min(100, (usedGB / threshold) * 100);

  const size = 120, stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  return (
    <div style={{
      padding: '16px 14px',
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>
        {title}
      </div>

      {/* 大圆环并在正中展示粗体百分比 */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={usedColor} strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 400ms' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: 'var(--fg-0)',
        }}>
          {pct.toFixed(1)}%
        </div>
      </div>

      {/* 下方双图例：已用 / 剩余 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--fg-2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: usedColor }} />
          已用 {usedGB.toFixed(2)} GB
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--bg-3)' }} />
          剩余 {remainGB.toFixed(2)} GB
        </span>
      </div>
    </div>
  );
}

// ─── 辅助组件：客户端同款平滑折线图 ───────────────────────────────
function ClientTrafficLineChart({ times, ingress, egress, total }) {
  const H = 280, W = 800;
  const padL = 45, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(...total, 0.01) * 1.15;
  const scaleX = (i) => padL + (i * innerW) / Math.max(times.length - 1, 1);
  const scaleY = (v) => padT + innerH - (v / maxVal) * innerH;

  const buildPath = (data) => {
    if (!data || data.length === 0) return '';
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ');
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {/* 网格虚线与 Y 轴刻度 */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
        const y = padT + innerH - frac * innerH;
        const val = maxVal * frac;
        return (
          <g key={idx}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" opacity="0.5" />
            <text x={padL - 8} y={y + 3} fontSize="10" fill="var(--fg-3)" textAnchor="end" fontFamily="var(--font-mono)">
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X 轴日期刻度 */}
      {times.map((t, idx) => {
        if (times.length > 8 && idx % Math.ceil(times.length / 8) !== 0) return null;
        const x = scaleX(idx);
        return (
          <text key={idx} x={x} y={H - 8} fontSize="10" fill="var(--fg-3)" textAnchor="middle">
            {t.slice(5)}
          </text>
        );
      })}

      {/* 三条平滑数据折线 */}
      <path d={buildPath(ingress)} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
      <path d={buildPath(egress)} fill="none" stroke="#f87171" strokeWidth="2" strokeLinejoin="round" />
      <path d={buildPath(total)} fill="none" stroke="var(--info)" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

// 暴露到全局，让 app.jsx 顺利加载挂载
window.TenantTrafficPage = TenantTrafficPage;
