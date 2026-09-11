// 审计日志 · 独立整页
// 由租户列表操作菜单跳入，替代原 useAuditDrawer 弹窗方案。
// 严格对齐客户端 TenantAuditLogView.swift：
// - 顶部：图标对齐为带基准线的文档图标 (doc.text)、面包屑导航（租户管理 / 审计日志）、租户名与中文区域
// - 工具栏：仅「返回列表」与「刷新」双按钮
// - 顶部横幅：当后端返回 mock: true 时展示橙色演示数据横幅；查询失败时展示错误重试横幅
// - 筛选栏：快捷区间 Chips（近1天 / 近3天 / 近7天 / 近30天 / 自定义）、开始与结束日期输入框、最多查询近90天提示、查询按钮
// - 表格架构：固定表头（#、用户名、来源 IP、事件、环境、事件时间、响应）+ 独立垂直滚动
// - 环境列：控制台（info 蓝）/ API（violet 紫）徽章，hover 展示完整 UA 与会话 ID
// - 事件列：短名加粗展示，hover 展示完整类型（com.oraclecloud.XxxApi.Yyy）
// - 响应列：语义徽章（成功 / 失败 / 未知）+ 原始状态码
// - 底部栏：游标分页标准形态（已加载 N 条 · 还有更多 + 「加载更多」按钮）

const { useState: useStateAL, useMemo: useMemoAL, useEffect: useEffectAL } = React;

function TenantAuditPage({ density, ctx, navigate }) {
  const { t: tr, lang } = useT();
  const shell = useShell();

  const [tenant, setTenant] = useStateAL(null);
  const [loading, setLoading] = useStateAL(false);
  const [loadingMore, setLoadingMore] = useStateAL(false);
  const [queried, setQueried] = useStateAL(false);
  const [error, setError] = useStateAL(null);
  const [nextToken, setNextToken] = useStateAL(null);
  const [logs, setLogs] = useStateAL([]);

  const ROW_LIMIT = 2000;
  const MAX_RANGE_DAYS = 90;

  // 本地日期串（对齐客户端：按本地时区切日）
  const localDate = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  };
  const rangeFor = (days) => ({
    start: localDate(new Date(Date.now() - (days - 1) * 24 * 3600 * 1000)),
    end: localDate(new Date()),
  });

  const [startDate, setStartDate] = useStateAL(() => rangeFor(1).start);
  const [endDate, setEndDate] = useStateAL(() => rangeFor(1).end);

  // 1. 加载当前租户基础信息
  useEffectAL(() => {
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
      })
      .catch(() => {});

    return () => { active = false; };
  }, [ctx?.tenantId]);

  const isQuickActive = (days) => {
    const r = rangeFor(days);
    return startDate === r.start && endDate === r.end;
  };
  const isCustomActive = [1, 3, 7, 30].every(d => !isQuickActive(d));

  const selectQuick = (days) => {
    const r = rangeFor(days);
    setStartDate(r.start);
    setEndDate(r.end);
    loadLogsWithRange(r.start, r.end, false);
  };

  const validateRange = (sDate, eDate) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(sDate) || !re.test(eDate)) {
      shell.showToast(tr('audit.dateFormatErr'), { kind: 'error' });
      return false;
    }
    const s = new Date(`${sDate}T00:00:00`);
    const e = new Date(`${eDate}T00:00:00`);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      shell.showToast(tr('audit.dateFormatErr'), { kind: 'error' });
      return false;
    }
    if (s > e) {
      shell.showToast(tr('audit.rangeOrderErr'), { kind: 'error' });
      return false;
    }
    const days = Math.round((e - s) / 86400000) + 1;
    if (days > MAX_RANGE_DAYS) {
      shell.showToast(tr('audit.rangeTooLongN').replace('{n}', days), { kind: 'error' });
      return false;
    }
    return true;
  };

  const loadLogsWithRange = async (sDate, eDate, append = false) => {
    if (!ctx?.tenantId) return;
    if (append) {
      if (!nextToken || loading || loadingMore) return;
      if (logs.length >= ROW_LIMIT) return;
      setLoadingMore(true);
    } else {
      if (!validateRange(sDate, eDate)) return;
      setLoading(true);
      setQueried(false);
      setError(null);
      setNextToken(null);
    }

    try {
      const body = {
        tenantId: ctx.tenantId,
        startDate: sDate,
        endDate: eDate,
      };
      if (append && nextToken) body.pageToken = nextToken;

      const j = await window.ociApi.request('/tenants/audit/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = j && j.data;
      const list = (payload && Array.isArray(payload.data))
        ? payload.data
        : (Array.isArray(payload) ? payload : []);
      setNextToken((payload && payload.nextPageToken) || null);

      const rows = list.map((it) => {
        const raw = String(it.responseStatus == null ? '' : it.responseStatus).trim();
        const unknown = raw === '' || raw === '-';
        const ok = !unknown && (raw.charAt(0) === '2' || raw.toUpperCase() === 'OK');
        const consoleSession = !!(it.consoleSessionId && String(it.consoleSessionId).trim());
        const hasEnvSignal = consoleSession || !!it.userType || !!it.clientEnv;
        const envKind = consoleSession ? 'console' : (hasEnvSignal ? 'api' : 'none');
        return {
          user: it.userName || '-',
          ip: it.ipAddress || '-',
          event: it.eventType || '-',
          eventDetail: it.eventFullType || it.eventType || '-',
          env: envKind === 'console' ? tr('audit.envConsole') : (envKind === 'api' ? tr('audit.envApi') : '—'),
          envKind,
          envDetail: [
            it.userType ? `authType=${it.userType}` : '',
            it.clientEnv ? `UA=${it.clientEnv}` : '',
            consoleSession ? `consoleSessionId=${it.consoleSessionId}` : '',
          ].filter(Boolean).join('\n') || '无环境信息',
          time: it.eventTime || '-',
          code: raw,
          status: ok ? 'success' : (unknown ? 'unknown' : 'failed'),
          detail: raw || '—',
        };
      });

      setLogs(prev => append ? prev.concat(rows).slice(0, ROW_LIMIT) : rows);
      setQueried(true);
      setError(null);
    } catch (err) {
      if (!append) setLogs([]);
      setQueried(true);
      const errMsg = (err && err.message) || String(err);
      setError(errMsg);
      shell.showToast(tr('tenant.ac12c7') + errMsg, { kind: 'error' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const search = () => loadLogsWithRange(startDate, endDate, false);

  // 初始加载近 1 天审计
  useEffectAL(() => {
    if (ctx?.tenantId) {
      search();
    }
  }, [ctx?.tenantId]);

  const regionShortName = (code) => {
    const r = REGIONS.find(x => x.code === code);
    if (!r) return code;
    const m = getRegionSimpleName(r).match(/\(([^)]+)\)$/);
    return m ? m[1] : getRegionSimpleName(r);
  };

  const tenantSubtitle = useMemoAL(() => {
    if (!tenant) return '';
    const name = getTenantName(tenant) || '';
    const regCode = getTenantRegion(tenant) || '';
    const regCn = regionShortName(regCode) || regCode || '—';
    return `${name} · ${regCn}`;
  }, [tenant]);

  const reachedLimit = logs.length >= ROW_LIMIT;
  const hasMore = !!nextToken && !reachedLimit;

  const footerText = reachedLimit
    ? `${tr('audit.loadedCount')} ${logs.length} ${tr('audit.rowsUnit')} ${tr('audit.reachedLimit')}`
    : `${tr('audit.loadedCount')} ${logs.length} ${tr('audit.rowsUnit')}${hasMore ? ' ' + tr('audit.hasMore') : ''}`;

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
          {/* 对齐客户端图标：文档图标 (doc.text) */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="file-text" size={16} />
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
                审计日志
              </span>
            </div>
            {/* 副标题：完整租户名 · 中文区域名 */}
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              {tenantSubtitle}
            </div>
          </div>
        </div>

        {/* 顶部工具栏操作：仅保留「返回列表」与「刷新」，两端一致 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('tenants')}>
            返回列表
          </Button>
          <Button variant="secondary" size="sm" icon="refresh-cw" loading={loading} onClick={search}>
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
              <span style={{ fontWeight: 600 }}>查询审计日志失败：</span>
              <span style={{ opacity: 0.9 }}>{error}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button size="xs" variant="outline" onClick={() => loadLogsWithRange(startDate, endDate, false)}>重试</Button>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', padding: 2 }}
              title={tr('common.close')}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── 3. 筛选控制器（Filter Bar · 快捷 Chips + 日期选择） ─────── */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* 快捷区间 Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { days: 1, label: '近1天' },
              { days: 3, label: '近3天' },
              { days: 7, label: '近7天' },
              { days: 30, label: '近30天' },
            ].map(r => {
              const active = isQuickActive(r.days);
              return (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => selectQuick(r.days)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 13,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                    background: active ? 'var(--accent)' : 'var(--bg-2)',
                    color: active ? '#ffffff' : 'var(--fg-2)',
                    cursor: 'pointer',
                    transition: 'all 100ms',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
            <span style={{
              padding: '4px 12px',
              borderRadius: 13,
              fontSize: 12,
              fontWeight: isCustomActive ? 600 : 400,
              border: '1px solid ' + (isCustomActive ? 'var(--accent)' : 'var(--border)'),
              background: isCustomActive ? 'var(--accent)' : 'var(--bg-2)',
              color: isCustomActive ? '#ffffff' : 'var(--fg-3)',
              userSelect: 'none',
            }}>
              自定义
            </span>
          </div>

          {/* 开始/结束日期起止 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-2)' }}>
            <span>开始</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            />
            <span>结束</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>最多查询近 90 天</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon="search"
          loading={loading}
          onClick={search}
        >
          查询
        </Button>
      </div>

      {/* ── 4. 审计事件大表 · 表头固定 + 数据独立滚动 ───────────────── */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 380, overflow: 'hidden',
      }}>
        {/* 固定表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 130px 180px 1fr 76px 160px 118px',
          padding: '10px 14px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 600, color: 'var(--fg-3)',
          textTransform: 'uppercase', letterSpacing: 0.5,
          flexShrink: 0,
        }}>
          <div>#</div>
          <div>用户名</div>
          <div>来源 IP</div>
          <div>事件</div>
          <div style={{ textAlign: 'center' }}>环境</div>
          <div>事件时间</div>
          <div style={{ textAlign: 'center' }}>响应</div>
        </div>

        {/* 表格内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading && logs.length === 0 ? (
            <div style={{
              height: 300,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: 'var(--fg-3)',
            }}>
              <Icon name="refresh-cw" size={24} className="spin" />
              <span style={{ fontSize: 12.5 }}>加载审计日志…</span>
            </div>
          ) : logs.length === 0 ? (
            <div style={{
              height: 300,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: 'var(--fg-3)',
            }}>
              <Icon name="file-text" size={32} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>该时间范围内没有审计事件</span>
              <span style={{ fontSize: 11.5 }}>当前区间 {startDate} ~ {endDate}，可放宽时间范围后重试</span>
              <Button size="xs" variant="outline" style={{ marginTop: 6 }} onClick={() => selectQuick(7)}>
                放宽到近 7 天
              </Button>
            </div>
          ) : (
            logs.map((log, idx) => {
              const isErr = log.status === 'failed';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 130px 180px 1fr 76px 160px 118px',
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12,
                    background: isErr
                      ? 'color-mix(in oklab, var(--danger) 8%, transparent)'
                      : (idx % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 35%, transparent)' : 'transparent'),
                    alignItems: 'center',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={e => { if (!isErr) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => {
                    if (!isErr) {
                      e.currentTarget.style.background = idx % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 35%, transparent)' : 'transparent';
                    }
                  }}
                >
                  <div className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{idx + 1}</div>
                  <div className="mono" style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.user}>
                    {log.user}
                  </div>
                  <div className="mono" style={{ color: 'var(--fg-2)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.ip}>
                    {log.ip}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.eventDetail}>
                    {log.event}
                  </div>
                  {/* 环境徽章：控制台（info蓝）/ API（violet紫）*/}
                  <div style={{ textAlign: 'center' }} title={log.envDetail}>
                    {log.envKind !== 'none' ? (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10.5,
                        fontWeight: 600,
                        background: log.envKind === 'console' ? 'var(--info-soft)' : 'color-mix(in oklab, var(--violet) 15%, transparent)',
                        color: log.envKind === 'console' ? 'var(--info)' : 'var(--violet)',
                      }}>
                        {log.env}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--fg-3)' }}>—</span>
                    )}
                  </div>
                  <div className="mono" style={{ color: 'var(--fg-2)', fontSize: 11 }}>{log.time}</div>
                  {/* 响应状态：语义徽章 + 状态码 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: log.status === 'success' ? 'var(--accent-soft)' : (log.status === 'unknown' ? 'var(--orange-soft)' : 'var(--danger-soft)'),
                      color: log.status === 'success' ? 'var(--accent)' : (log.status === 'unknown' ? 'var(--orange)' : 'var(--danger)'),
                    }}>
                      {log.status === 'success' ? '成功' : (log.status === 'unknown' ? '未知' : '失败')}
                    </span>
                    <span className="mono" style={{ fontSize: 10.5, color: isErr ? 'var(--danger)' : 'var(--fg-3)' }}>
                      {log.code || '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── 5. 游标分页底部栏（对齐 UI_STANDARD.md 4.4 标准） ───────── */}
        {logs.length > 0 && (
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: reachedLimit ? 'var(--orange)' : 'var(--fg-2)',
            flexShrink: 0,
          }}>
            <span>{footerText}</span>
            {hasMore && (
              <Button
                size="xs"
                variant="secondary"
                icon="chevron-down"
                loading={loadingMore}
                disabled={loading}
                onClick={() => loadLogsWithRange(startDate, endDate, true)}
              >
                加载更多
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 暴露到全局，让 app.jsx 挂载
window.TenantAuditPage = TenantAuditPage;
