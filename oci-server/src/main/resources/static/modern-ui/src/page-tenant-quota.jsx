// 账号配额 · 独立整页
// 由租户列表操作菜单跳入，替代原 useQuotaDrawer 弹窗方案。
// 严格对齐客户端 TenantQuotaView.swift 与 UI_STANDARD.md 第一章标准：
// - 顶部页头：图标对齐为柱状图图标 (bar-chart-3)、标准面包屑导航（租户管理 / 账号配额，统一 16px）、副标题「租户名 · 中文区域」
// - 工具栏：仅保留「返回列表」与「刷新」双按钮
// - 筛选栏：租户下拉、服务类型下拉（计算/块存储/对象存储/MySQL/DBCS/ADB/NoSQL）、查询按钮
// - 数据列表大卡片：表头置顶固定、限额名称（带状态圆点与作用域）、实例类型徽章、总量、已用、可用、进度条、占比
// - 底部分页：左侧状态信息、右侧上一页/下一页/每页条数选择

const { useState: useStateQuota, useMemo: useMemoQuota, useEffect: useEffectQuota, useCallback: useCallbackQuota } = React;

function TenantQuotaPage({ density, ctx, navigate }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [tenant, setTenant] = useStateQuota(null);
  const [tenantOptions, setTenantOptions] = useStateQuota([]);
  const [selectedTenantId, setSelectedTenantId] = useStateQuota(ctx?.tenantId || '');
  const [service, setService] = useStateQuota('compute');

  const [loading, setLoading] = useStateQuota(false);
  const [error, setError] = useStateQuota(null);
  const [items, setItems] = useStateQuota([]);
  const [regionLabel, setRegionLabel] = useStateQuota('');
  const [page, setPage] = useStateQuota(0);
  const [pageSize, setPageSize] = useStateQuota(20);
  const [hasNextPage, setHasNextPage] = useStateQuota(false);
  const [hoveredRowId, setHoveredRowId] = useStateQuota(null);

  const serviceOptions = useMemoQuota(() => [
    { id: 'compute', title: '计算 (Compute)' },
    { id: 'block-storage', title: '块存储 (Block Storage)' },
    { id: 'object-storage', title: '对象存储 (Object Storage)' },
    { id: 'mysql', title: 'MySQL HeatWave' },
    { id: 'database', title: 'Oracle Database (DBCS)' },
    { id: 'autonomous-database', title: '自治数据库 (ADB)' },
    { id: 'nosql', title: 'NoSQL Database' },
  ], []);

  const serviceTitle = useMemoQuota(() => {
    return serviceOptions.find(s => s.id === service)?.title || service;
  }, [serviceOptions, service]);

  // 推断实例类型（对齐客户端 inferType）
  const inferType = useCallbackQuota((limitName) => {
    if (!limitName) return '';
    const n = limitName.toLowerCase();
    const bm = n.startsWith('bm-') || n.includes('-bm-');
    let arch = null;
    if (n.includes('-a1-') || n.includes('-a2-')) arch = 'Ampere';
    else if (n.includes('-e5-')) arch = 'AMD E5';
    else if (n.includes('-e4-')) arch = 'AMD E4';
    else if (n.includes('-e3-')) arch = 'AMD E3';
    else if (n.includes('-e2-') || n.includes('e2-1-micro')) arch = 'AMD E2';
    else if (n.includes('gpu')) arch = 'GPU';
    else if (n.includes('hpc')) arch = 'HPC';
    else if (n.includes('optimized3')) arch = 'Intel 高频';
    else if (n.includes('-x9-') || n.startsWith('x9-') || n.includes('x9-')) arch = 'Intel X9';
    else if (n.includes('-x8-')) arch = 'Intel X8';
    else if (n.includes('-x7-')) arch = 'Intel X7';
    else if (n.includes('standard3')) arch = 'Intel';
    else if (n.includes('standard2')) arch = 'Intel 旧款';
    else if (n.includes('dense-a4-ax')) arch = 'DenseIO A4 AX';
    else if (n.includes('dense-io') || n.includes('denseio')) arch = 'DenseIO';
    else if (n.includes('autonomous-') || n.includes('-adb-') || n.startsWith('adb-')) arch = 'ADB';
    else if (n.includes('mysql')) arch = 'MySQL';
    else if (n.includes('nosql')) arch = 'NoSQL';
    else if (n.includes('exadata')) arch = 'Exadata';
    else if (n.includes('db-system') || n.includes('db-vcpu') || n.includes('db-node')) arch = 'DBCS';

    if (!arch) return bm ? '裸金属' : '';
    return bm ? `裸金属·${arch}` : arch;
  }, []);

  // 1. 获取当前租户基础信息与区域子租户下拉
  useEffectQuota(() => {
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

    // 加载租户与区域下拉选项
    window.ociApi.request(`/tenants/listRegions?parentId=${encodeURIComponent(ctx.tenantId)}`)
      .then(j => {
        if (!active) return;
        const list = Array.isArray(j) ? j : [];
        if (list.length === 0) {
          setTenantOptions([{ id: String(ctx.tenantId), label: '主账号' }]);
          setSelectedTenantId(String(ctx.tenantId));
        } else {
          const opts = list.map(t => {
            const regName = (typeof regionSimpleName === 'function') ? regionSimpleName(t.region) : t.region;
            const regDisplay = regName ? ` · ${regName}` : '';
            return {
              id: String(t.id),
              label: `${t.tenancyName || t.userName || t.tenantId || t.id}${regDisplay}`,
            };
          });
          setTenantOptions(opts);
          if (!opts.some(o => o.id === String(selectedTenantId))) {
            setSelectedTenantId(opts[0]?.id || String(ctx.tenantId));
          }
        }
      })
      .catch(() => {
        if (active) {
          setTenantOptions([{ id: String(ctx.tenantId), label: '主账号' }]);
          setSelectedTenantId(String(ctx.tenantId));
        }
      });

    return () => { active = false; };
  }, [ctx?.tenantId]);

  // 2. 查询配额数据
  const queryQuota = useCallbackQuota(async (targetPage = 0, targetSize = pageSize) => {
    const tid = selectedTenantId || ctx?.tenantId;
    if (!tid) return;

    setLoading(true);
    setItems([]); // 查询与翻页时立即清空旧数据，杜绝旧数据与 loading 共存！
    setError(null);
    try {
      const res = await window.ociApi.request(
        `/tenants/quota?tenantId=${encodeURIComponent(tid)}&serviceName=${encodeURIComponent(service)}&page=${targetPage}&pageSize=${targetSize}`
      );
      if (res && res.error) {
        throw new Error(res.error);
      }
      const rawItems = Array.isArray(res?.items) ? res.items : [];
      const parsedItems = rawItems.map((it, idx) => {
        const name = String(it.name || it.limitName || it.resourceName || '—');
        const scope = String(it.scope || it.availabilityDomain || '');
        const totalV = Number(it.total || it.limit || it.value || 0);
        const usedV = Number(it.used || it.usedQuota || 0);
        const availV = Number(it.available || it.availableQuota || it.remaining || 0);
        const pct = totalV > 0 ? Math.min(100, Math.round((usedV / totalV) * 100)) : 0;
        const typeStr = inferType(name);
        return {
          id: `${name}-${scope}-${idx}`,
          name,
          scope,
          total: String(it.total || it.limit || it.value || totalV),
          used: String(it.used || it.usedQuota || usedV),
          available: String(it.available || it.availableQuota || it.remaining || availV),
          totalValue: totalV,
          usedValue: usedV,
          availableValue: availV,
          percent: pct,
          instanceType: typeStr,
        };
      });

      setItems(parsedItems);
      setPage(Number(res?.page ?? targetPage));
      setHasNextPage(Boolean(res?.hasNextPage));
      setRegionLabel(String(res?.region || res?.regionEn || ''));
    } catch (err) {
      setItems([]);
      const msg = err?.message || String(err);
      setError(msg);
      shell.showToast(`查询配额失败：${msg}`, { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, ctx?.tenantId, service, pageSize, inferType, shell]);

  // 切换每页条数
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    queryQuota(0, newSize);
  };

  const hasTypeColumn = useMemoQuota(() => {
    return items.some(it => Boolean(it.instanceType));
  }, [items]);

  // 格式化副标题
  const tenantSubtitle = useMemoQuota(() => {
    if (!tenant) return '';
    const tName = getTenantName(tenant) || tenant.userName || tenant.id || '';
    const reg = getTenantRegion(tenant) || '';
    const regName = (typeof regionSimpleName === 'function') ? regionSimpleName(reg) : reg;
    return regName ? `${tName} · ${regName}` : tName;
  }, [tenant]);

  // 状态点与进度条颜色
  const getUsageColor = (pct) => {
    if (pct >= 90) return 'var(--danger)';
    if (pct >= 60) return 'var(--orange)';
    return 'var(--accent)';
  };

  const getAvailColor = (item) => {
    if (item.availableValue <= 0) return 'var(--danger)';
    if (item.totalValue > 0 && item.availableValue < item.totalValue * 0.2) return 'var(--orange)';
    return 'var(--accent)';
  };

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
            <Icon name="bar-chart-3" size={16} />
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
                账号配额
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
          <Button variant="secondary" size="sm" icon="refresh-cw" loading={loading} onClick={() => queryQuota(page)}>
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
              <span style={{ fontWeight: 600 }}>查询配额失败：</span>
              <span style={{ opacity: 0.9 }}>{error}</span>
            </div>
          </div>
          <Button size="xs" variant="outline" onClick={() => queryQuota(page)}>重试</Button>
        </div>
      )}

      {/* ── 3. 筛选栏（Filter Bar） ───────────────────────────── */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {tenantOptions.length > 0 && (
            <div style={{ width: 240 }}>
              <CustomDropdown
                value={selectedTenantId}
                onChange={val => setSelectedTenantId(val)}
                height={32}
                width="100%"
              >
                {tenantOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </CustomDropdown>
            </div>
          )}

          <div style={{ width: 220 }}>
            <CustomDropdown
              value={service}
              onChange={val => setService(val)}
              height={32}
              width="100%"
            >
              {serviceOptions.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </CustomDropdown>
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon="search"
          loading={loading}
          onClick={() => queryQuota(0)}
        >
          查询
        </Button>
      </div>

      {/* ── 4. 配额数据列表大卡片（UI_STANDARD.md 第一章） ──────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'center', padding: '9px 14px', minWidth: 220,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  限额名称
                </th>
                {hasTypeColumn && (
                  <th style={{
                    textAlign: 'center', padding: '9px 14px', width: 96,
                    background: 'var(--bg-2)', color: 'var(--fg-2)',
                    fontSize: 11, fontWeight: 600,
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    实例类型
                  </th>
                )}
                <th style={{
                  textAlign: 'center', padding: '9px 14px', width: 64,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  总量
                </th>
                <th style={{
                  textAlign: 'center', padding: '9px 14px', width: 64,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  已用
                </th>
                <th style={{
                  textAlign: 'center', padding: '9px 14px', width: 64,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  可用
                </th>
                <th style={{
                  textAlign: 'center', padding: '9px 14px', width: 130,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  进度条
                </th>
                <th style={{
                  textAlign: 'center', padding: '9px 14px', width: 56,
                  background: 'var(--bg-2)', color: 'var(--fg-2)',
                  fontSize: 11, fontWeight: 600,
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  占比
                </th>
              </tr>
            </thead>
            <tbody style={{ opacity: (loading && items.length > 0) ? 0.6 : 1, transition: 'opacity 120ms' }}>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={hasTypeColumn ? 7 : 6} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="loader-2" size={18} className="spin" style={{ opacity: 0.6 }} />
                      <span style={{ fontSize: 13 }}>加载配额数据…</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={hasTypeColumn ? 7 : 6} style={{ padding: 0 }}>
                    <EmptyState
                      icon="bar-chart-2"
                      title={error ? '查询失败' : (regionLabel ? '该服务暂无配额数据' : '请先查询配额')}
                      subtitle={error ? error : (regionLabel ? '未查询到当前服务的配额指标，可尝试切换其他服务' : '选择租户和服务类型后点击「查询」')}
                      actionLabel={error ? '重试' : '立即查询'}
                      onAction={() => queryQuota(0)}
                    />
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => {
                  const isHovered = hoveredRowId === row.id;
                  const usageColor = getUsageColor(row.percent);
                  const availColor = getAvailColor(row);
                  return (
                    <tr
                      key={row.id}
                      onMouseEnter={() => setHoveredRowId(row.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      style={{
                        background: isHovered
                          ? 'color-mix(in oklab, var(--accent) 8%, transparent)'
                          : (idx % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 35%, transparent)' : 'transparent'),
                        transition: 'background 120ms ease-in-out',
                      }}
                    >
                      {/* 限额名称 */}
                      <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: usageColor, flexShrink: 0,
                          }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 500, color: 'var(--fg-0)', fontSize: 12,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }} title={row.name}>
                              {row.name}
                            </div>
                            {row.scope && (
                              <div style={{
                                fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }} title={row.scope}>
                                {row.scope}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 实例类型 */}
                      {hasTypeColumn && (
                        <td style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          {row.instanceType ? (
                            <span style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
                              border: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)',
                              color: 'var(--accent)',
                            }}>
                              {row.instanceType}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fg-3)' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* 总量 */}
                      <td style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
                        {row.total || '—'}
                      </td>

                      {/* 已用 */}
                      <td style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
                        {row.used || '—'}
                      </td>

                      {/* 可用 */}
                      <td style={{
                        padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)',
                        color: availColor, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      }}>
                        {row.available || '—'}
                      </td>

                      {/* 进度条 */}
                      <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                          height: 6, background: 'var(--bg-3)', borderRadius: 3,
                          overflow: 'hidden', border: '1px solid var(--border)',
                        }}>
                          <div style={{
                            width: `${row.percent}%`, height: '100%',
                            background: usageColor, borderRadius: 3,
                            transition: 'width 240ms ease-out',
                          }} />
                        </div>
                      </td>

                      {/* 占比 */}
                      <td style={{
                        padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)',
                        fontWeight: 600, fontSize: 12, color: usageColor, fontFamily: 'var(--font-mono)',
                      }}>
                        {row.percent}%
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

        {/* ── 5. 底部固定分页条（UI_STANDARD.md 第一章） ──────────── */}
        {items.length > 0 && (
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-1)',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
              {regionLabel ? `${regionLabel} · ` : ''}{serviceTitle} · 第 {page + 1} 页，共 {items.length} 条
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                size="sm"
                variant="secondary"
                icon="chevron-left"
                disabled={page <= 0 || loading}
                onClick={() => queryQuota(page - 1)}
              >
                上一页
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>第 {page + 1} 页</span>
                <span style={{ color: 'var(--border)' }}>|</span>
                <span style={{ color: 'var(--fg-3)' }}>每页</span>
                <select
                  value={pageSize}
                  onChange={e => handlePageSizeChange(Number(e.target.value))}
                  style={{
                    padding: '3px 8px', borderRadius: 4,
                    background: 'var(--bg-2)', border: '1px solid var(--border)',
                    color: 'var(--fg-0)', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span style={{ color: 'var(--fg-3)' }}>条</span>
              </div>

              <Button
                size="sm"
                variant="secondary"
                icon="chevron-right"
                disabled={!hasNextPage || loading}
                onClick={() => queryQuota(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 暴露到全局，供 app.jsx 挂载到 PAGES 路由表
if (typeof window !== 'undefined') {
  window.TenantQuotaPage = TenantQuotaPage;
}
