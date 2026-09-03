// 开机区域监控 — Grab Region Monitor
// Tracks which OCI regions have released ARM capacity and historical grab statistics.
const { useState: useStateR, useMemo: useMemoR, useEffect: useEffectR } = React;

const CONTINENTS = [
  { id: 'all', key: 'regions.continent.all' },
  { id: 'asia', key: 'regions.continent.asia' },
  { id: 'europe', key: 'regions.continent.europe' },
  { id: 'americas', key: 'regions.continent.americas' },
  { id: 'africa', key: 'regions.continent.africa' },
];

function getRegionContinent(code = '') {
  if (code.startsWith('ap-')) return 'asia';
  if (/^(eu-|uk-|il-)/.test(code)) return 'europe';
  if (/^(us-|ca-|mx-|sa-)/.test(code)) return 'americas';
  if (/^(me-|af-)/.test(code)) return 'africa';
  return 'all';
}

function isRegionOpenToday(region) {
  if (!region.openTime) return false;
  const date = new Date(region.openTime);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function RegionsPage({ density }) {
  const { t: tr, lang } = useT();
  const showRegionDetail = useRegionDetailDrawer();
  const [tab, setTab] = useStateR('released'); // released | mine | map
  const [continent, setContinent] = useStateR('all');
  const [statusFilter, setStatusFilter] = useStateR('all');
  const [search, setSearch] = useStateR('');
  const [page, setPage] = useStateR(1);
  const [perPage, setPerPage] = useStateR(10);
  const [regions, setRegions] = useStateR([]);
  const [loading, setLoading] = useStateR(true);
  const [loadError, setLoadError] = useStateR('');

  // 对齐 mobile/arm_regions.ftl：区域目录、放货记录和“我的区域”均来自原后端。
  useEffectR(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const [armResponse, mineResponse] = await Promise.all([
          window.ociApi.request('/resource/arm-data'),
          window.ociApi.request('/resource/my-regions'),
        ]);
        if (!armResponse?.success) throw new Error(armResponse?.message || tr('regions.err.arm'));
        if (!mineResponse?.success) throw new Error(mineResponse?.message || tr('regions.err.mine'));

        const armRecords = armResponse.data?.armRecords || [];
        const regionMap = armResponse.data?.regionMap || {};
        const mine = new Set((mineResponse.data?.hasRecords || []).map(item => item.region || item.regionKey || item));
        const records = new Map(armRecords.map(record => [record.region, record]));
        const allCodes = new Set([...Object.keys(regionMap), ...records.keys(), ...mine]);
        const next = [...allCodes].filter(Boolean).map(code => {
          const record = records.get(code) || {};
          const openCount = Number(record.openCount || 0);
          const name = regionMap[code] || code;
          return {
            ...record,
            code,
            region: code,
            name,
            simpleName: name,
            cn: name,
            en: code,
            flag: '',
            continent: getRegionContinent(code),
            released: openCount > 0,
            mine: mine.has(code),
            arch: 'ARM',
            totalGrabs: openCount,
            monthlyOpenCount: Number(record.monthlyOpenCount || 0),
            todayGrabs: isRegionOpenToday(record) ? openCount : 0,
            firstAt: record.openTime || '—',
            lastAt: record.lastNotifyTime || '—',
          };
        });
        if (alive) setRegions(next);
      } catch (error) {
        if (alive) {
          setRegions([]);
          setLoadError(error.message || tr('regions.err.load'));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const stats = useMemoR(() => {
    const total = regions.length;
    const releasedArm = regions.filter(r => r.released && r.arch === 'ARM').length;
    const todayNew = regions.filter(r => r.todayGrabs > 0).length;
    return { total, releasedArm, todayNew };
  }, [regions]);

  // Filter based on tab + search + filters
  const filtered = useMemoR(() => {
    let list = regions;
    if (tab === 'released') list = list.filter(r => r.released);
    else if (tab === 'mine') {
      list = list.filter(r => r.mine);
    }
    if (continent !== 'all') list = list.filter(r => r.continent === continent);
    if (statusFilter === 'released') list = list.filter(r => r.released);
    else if (statusFilter === 'not-released') list = list.filter(r => !r.released);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.code.toLowerCase().includes(q) ||
        getRegionSimpleName(r).includes(search) ||
        r.en.toLowerCase().includes(q)
      );
    }
    const sortTime = (r) => {
      if (r.lastAt === '—') return -Infinity;
      const t = Date.parse(r.lastAt);
      return Number.isNaN(t) ? -Infinity : t;
    };
    return [...list].sort((a, b) => sortTime(b) - sortTime(a));
  }, [regions, tab, continent, statusFilter, search]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const now = new Date();
  const timeStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const columns = [
    {
      key: 'status', label: tr('regions.col.status'), width: 100,
      render: r => (
        r.released
          ? <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px',
              background: 'var(--accent-soft)', color: 'var(--accent)',
              borderRadius: 4, fontSize: 11, fontWeight: 500,
            }}>
              <StatusDot status="running" size={5} pulse />{tr('regions.col.status.released')}
            </span>
          : <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px',
              background: 'var(--bg-3)', color: 'var(--fg-3)',
              borderRadius: 4, fontSize: 11,
            }}>
              <StatusDot status="idle" size={5} />{tr('regions.col.status.unreleased')}
            </span>
      ),
    },
    {
      key: 'code', label: tr('regions.col.code'),
      render: r => <span className="mono" style={{ color: 'var(--accent)', fontSize: 11.5 }}>{r.code}</span>,
    },
    {
      key: 'name', label: tr('regions.col.name'),
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{r.flag}</span>
          <span style={{ color: 'var(--fg-1)' }}>{lang === 'zh' ? getRegionSimpleName(r) : r.en}</span>
          {r.hot && (
            <span style={{
              fontSize: 9, padding: '0 5px', borderRadius: 3,
              background: 'var(--orange-soft)', color: 'var(--orange)', fontWeight: 700,
              marginLeft: 2,
            }}>HOT</span>
          )}
        </span>
      ),
    },
    {
      key: 'arch', label: tr('regions.col.arch'),
      render: r => (
        r.arch !== '—'
          ? <span style={{
              padding: '1px 6px',
              background: 'var(--info-soft)', color: 'var(--info)',
              borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
            }}>{r.arch}</span>
          : <span style={{ color: 'var(--fg-3)' }}>—</span>
      ),
    },
    {
      key: 'firstAt', label: tr('regions.col.firstAt'),
      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{r.firstAt}</span>,
    },
    {
      key: 'totalGrabs', label: tr('regions.col.totalGrabs'), align: 'right',
      render: r => (
        <span className="num" style={{
          fontWeight: 600,
          color: r.totalGrabs > 100 ? 'var(--accent)' : r.totalGrabs > 20 ? 'var(--fg-0)' : r.totalGrabs > 0 ? 'var(--fg-1)' : 'var(--fg-3)',
        }}>{r.totalGrabs}</span>
      ),
    },
    {
      key: 'monthlyOpenCount', label: tr('regions.col.monthly'), align: 'right',
      render: r => (
        r.monthlyOpenCount > 0
          ? <span className="num" style={{ color: 'var(--orange)', fontWeight: 700 }}>{r.monthlyOpenCount}</span>
          : <span className="num" style={{ color: 'var(--fg-3)' }}>0</span>
      ),
    },
    {
      key: 'lastAt', label: tr('regions.col.lastAt'),
      render: r => (
        r.lastAt === '—'
          ? <span style={{ color: 'var(--fg-3)' }}>—</span>
          : <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{r.lastAt}</span>
      ),
    },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }}>
      <PageHeader
        title={tr('regions.title')}
        icon="globe"
        iconColor="var(--info)"
        actions={
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 11.5,
          }}>
            <StatusDot status="running" size={6} pulse />
            <span className="mono" style={{ color: 'var(--fg-1)' }}>{timeStr}</span>
          </span>
        }
      />

      {loadError && (
        <div role="alert" style={{ marginBottom: 12, color: 'var(--danger)' }}>{loadError}</div>
      )}

      {/* 3 KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 14,
      }}>
        <KPICard
          label={tr('regions.stats.total')}
          value={stats.total}
          icon="map-pin"
          iconColor="var(--info)"
        />
        <KPICard
          label={tr('regions.stats.arm')}
          value={stats.releasedArm}
          icon="check-circle-2"
          iconColor="var(--accent)"
        />
        <KPICard
          label={tr('regions.stats.today')}
          value={stats.todayNew}
          icon="bell-ring"
          iconColor={stats.todayNew > 0 ? 'var(--orange)' : 'var(--fg-3)'}
        />
      </div>

      {/* Tab bar: 数量: X + 三个 view tabs */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--info-soft)', color: 'var(--info)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="globe" size={14} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>
            {tr('regions.tab.count')}<span className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{filtered.length}</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
          {[
            { id: 'released', label: tr('regions.tab.released'), icon: 'check-circle-2' },
            { id: 'mine', label: tr('regions.tab.mine'), icon: 'user-check' },
            { id: 'map', label: tr('regions.tab.map'), icon: 'map' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              style={{
                padding: '6px 12px',
                background: tab === t.id ? 'var(--info)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--fg-1)',
                border: 'none', borderRadius: 4,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'all 120ms',
              }}
            >
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — 占满剩余高度,内部滚动 */}
      {tab === 'map'
        ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <RegionMapView regions={filtered} lang={lang} />
          </div>
        )
        : (
          // 手写 flex column 容器代替 Card,精确控制布局
          <div style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}>
            {/* 筛选栏 — 固定不滚动 */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
              flexShrink: 0,
            }}>
              <SearchInput
                placeholder={tr('regions.search.placeholder')}
                value={search}
                onChange={v => { setSearch(v); setPage(1); }}
                width={280}
              />
              <div style={{ flex: 1 }} />
              <Select
                value={continent}
                onChange={v => { setContinent(v); setPage(1); }}
                width={140}
                options={CONTINENTS.map(c => ({ value: c.id, label: tr(c.key) }))}
              />
              <Select
                value={statusFilter}
                onChange={v => { setStatusFilter(v); setPage(1); }}
                width={130}
                options={[
                  { value: 'all', label: tr('regions.filter.all') },
                  { value: 'released', label: tr('regions.col.status.released') },
                  { value: 'not-released', label: tr('regions.col.status.unreleased') },
                ]}
              />
            </div>

            {/* 表格区 — 占剩余空间 + 内部滚动 */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            }}>
              <Table columns={columns} rows={loading ? [] : paged} density={density} onRowClick={showRegionDetail} />
            </div>

            {/* 分页 — 固定底部 */}
            <div style={{
              flexShrink: 0,
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-1)',
            }}>
              <Pagination
                total={filtered.length}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={n => { setPerPage(n); setPage(1); }}
                t={tr}
              />
            </div>
          </div>
        )
      }
    </div>
  );
}

// Simple world-map visualization for regions
// —— 真实地理数据版:d3-geo 投影 + world-atlas 110m topojson
// —— OCI 区域经纬度对齐 Oracle 官方数据中心坐标
function RegionMapView({ regions, lang }) {
  // OCI 45 商业区域 · 真实数据中心经纬度 [lng, lat]
  // 数据源:Oracle Cloud Infrastructure 官方文档
  const LNGLAT = {
    // ── Asia Pacific ───────────────────────────────────
    'ap-tokyo-1':        [139.6917,  35.6895],  // Tokyo
    'ap-osaka-1':        [135.5023,  34.6937],  // Osaka
    'ap-chuncheon-1':    [127.7300,  37.8813],  // Chuncheon
    'ap-seoul-1':        [126.9780,  37.5665],  // Seoul
    'ap-singapore-1':    [103.8198,   1.3521],
    'ap-singapore-2':    [103.8500,   1.3600],
    'ap-kulai-2':        [103.6081,   1.6598],  // Kulai, Malaysia
    'ap-batam-1':        [104.0300,   1.1200],  // Batam
    'ap-mumbai-1':       [ 72.8777,  19.0760],
    'ap-hyderabad-1':    [ 78.4867,  17.3850],
    'ap-melbourne-1':    [144.9631, -37.8136],
    'ap-sydney-1':       [151.2093, -33.8688],
    // ── Europe / UK ────────────────────────────────────
    'uk-london-1':       [ -0.1276,  51.5074],
    'uk-cardiff-1':      [ -3.1791,  51.4816],
    'eu-frankfurt-1':    [  8.6821,  50.1109],
    'eu-amsterdam-1':    [  4.9041,  52.3676],
    'eu-paris-1':        [  2.3522,  48.8566],
    'eu-marseille-1':    [  5.3698,  43.2965],
    'eu-milan-1':        [  9.1900,  45.4642],
    'eu-turin-1':        [  7.6869,  45.0703],
    'eu-madrid-1':       [ -3.7038,  40.4168],
    'eu-madrid-3':       [ -3.6900,  40.4200],
    'eu-zurich-1':       [  8.5417,  47.3769],
    'eu-stockholm-1':    [ 18.0686,  59.3293],
    'eu-jovanovac-1':    [ 20.9700,  43.9200],  // Serbia
    'il-jerusalem-1':    [ 35.2137,  31.7683],
    // ── Middle East / Africa ───────────────────────────
    'me-jeddah-1':       [ 39.1925,  21.4858],
    'me-riyadh-1':       [ 46.6753,  24.7136],
    'me-dubai-1':        [ 55.2708,  25.2048],
    'me-abudhabi-1':     [ 54.3773,  24.4539],
    'af-casablanca-1':   [ -7.5898,  33.5731],
    'af-johannesburg-1': [ 28.0473, -26.2041],
    // ── Americas ───────────────────────────────────────
    'us-ashburn-1':      [-77.4874,  39.0438],
    'us-phoenix-1':      [-112.0740, 33.4484],
    'us-sanjose-1':      [-121.8863, 37.3382],
    'us-chicago-1':      [-87.6298,  41.8781],
    'ca-toronto-1':      [-79.3832,  43.6532],
    'ca-montreal-1':     [-73.5673,  45.5017],
    'mx-queretaro-1':    [-100.3899, 20.5888],
    'mx-monterrey-1':    [-100.3161, 25.6866],
    'sa-saopaulo-1':     [-46.6333, -23.5505],
    'sa-vinhedo-1':      [-46.9750, -23.0300],
    'sa-santiago-1':     [-70.6693, -33.4489],
    'sa-valparaiso-1':   [-71.6127, -33.0472],
    'sa-bogota-1':       [-74.0721,   4.7110],
  };

  const mapW = 1000, mapH = 500;

  // ── 投影 + 大陆路径 ── d3-geo naturalEarth1(视觉上最平衡的世界投影)
  const projection = React.useMemo(() => {
    if (!window.d3) return null;
    return window.d3.geoNaturalEarth1()
      .scale(180)
      .translate([mapW / 2, mapH / 2 + 20]);
  }, []);

  // ── 加载 topojson 并转 geojson features ──
  const [countries, setCountries] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/modern-ui/vendor/countries-110m.json');
        const topo = await res.json();
        if (cancelled) return;
        // topojson.feature 把 topology 转为 geojson FeatureCollection
        const geo = window.topojson.feature(topo, topo.objects.countries);
        setCountries(geo.features);
      } catch (e) {
        console.warn('world map load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 用投影 + d3.geoPath 生成每个国家的 SVG path
  const pathGen = React.useMemo(() => {
    if (!projection || !window.d3) return null;
    return window.d3.geoPath().projection(projection);
  }, [projection]);

  // 把 region 经纬度投到 SVG 像素
  const projectRegion = React.useCallback((code) => {
    if (!projection) return null;
    const ll = LNGLAT[code];
    if (!ll) return null;
    const p = projection(ll);
    if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return null;
    return p;
  }, [projection]);

  // hover 状态
  const [hover, setHover] = React.useState(null); // { r, x, y }

  return (
    <Card padding={0} title={tr('regions.map.title')} subtitle={tr('regions.map.subtitle')} headerIcon="map" headerIconColor="var(--info)">
      <div style={{
        padding: 20, position: 'relative',
        background: 'var(--bg-0)',
        backgroundImage: 'radial-gradient(circle at 30% 40%, color-mix(in oklab, var(--info-soft) 60%, transparent), transparent 50%), radial-gradient(circle at 70% 60%, color-mix(in oklab, var(--violet-soft) 40%, transparent), transparent 55%)',
      }}>
        <svg width="100%" viewBox={`0 0 ${mapW} ${mapH}`} style={{ display: 'block' }}>
          <defs>
            {/* 节点辉光 */}
            <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── 真实大陆(d3-geo + world-atlas 110m)── */}
          {countries && pathGen && (
            <g>
              {/* 大陆填充 */}
              <g fill="var(--bg-2)" stroke="var(--border-strong)" strokeWidth="0.5" strokeLinejoin="round">
                {countries.map((f, i) => {
                  const d = pathGen(f);
                  return d ? <path key={i} d={d} /> : null;
                })}
              </g>
            </g>
          )}

          {/* 加载态骨架 */}
          {!countries && (
            <text x={mapW / 2} y={mapH / 2} textAnchor="middle"
              fill="var(--fg-3)" fontSize="11" fontFamily="var(--font-mono)">
              Loading world map...
            </text>
          )}

          {/* ── 经纬网格(极淡 · 用 d3 graticule 会更好但简化)── */}
          <g stroke="color-mix(in oklab, var(--fg-3) 30%, transparent)" strokeWidth="0.5" fill="none">
            {projection && (() => {
              // 用 d3-geo 的 graticule 生成经纬网(每 30 度一条)
              const graticule = window.d3?.geoGraticule?.().step([30, 30])();
              if (graticule && pathGen) {
                return <path d={pathGen(graticule)} />;
              }
              return null;
            })()}
          </g>

          {/* ── 区域节点 ── */}
          {regions.map(r => {
            const loc = projectRegion(r.code);
            if (!loc) return null;
            const [x, y] = loc;
            const size = r.released
              ? Math.max(2.5, Math.min(5.5, 2 + Math.sqrt(r.totalGrabs || 0) * 0.3))
              : 2;
            const isToday = r.todayGrabs > 0;
            const isReleased = r.released;
            const color = !isReleased ? 'var(--fg-3)' : isToday ? 'var(--orange)' : 'var(--accent)';
            const isHover = hover?.r.code === r.code;

            return (
              <g key={r.code}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover({ r, x, y })}
                onMouseLeave={() => setHover(null)}
              >
                {/* 外层脉冲光晕(仅活跃节点)*/}
                {isReleased && (
                  <>
                    <circle cx={x} cy={y} r={size + 5} fill={color} opacity="0.08">
                      {isToday && <animate attributeName="r" values={`${size + 3};${size + 9};${size + 3}`} dur="2.4s" repeatCount="indefinite" />}
                      {isToday && <animate attributeName="opacity" values="0.22;0;0.22" dur="2.4s" repeatCount="indefinite" />}
                    </circle>
                    <circle cx={x} cy={y} r={size + 2} fill={color} opacity="0.22" />
                  </>
                )}
                {/* 主节点 */}
                <circle cx={x} cy={y} r={size} fill={color} filter={isReleased ? 'url(#dot-glow)' : undefined}>
                  {isToday && <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />}
                </circle>
                {/* hover 大 hitbox(保持可点区不小于 14px)*/}
                <circle cx={x} cy={y} r={10} fill="transparent" />
                {/* hover 时 highlight ring */}
                {isHover && (
                  <circle cx={x} cy={y} r={size + 4} fill="none" stroke="var(--fg-0)" strokeWidth="1" opacity="0.7" />
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Tooltip ── */}
        {hover && (() => {
          const t = hover;
          const px = (t.x / mapW) * 100;   // 百分比定位
          const py = (t.y / mapH) * 100;
          const label = lang === 'zh' ? getRegionSimpleName(t.r) : t.r.en;
          // 侧位:靠右显示在左,靠左显示在右
          const showRight = px < 70;
          return (
            <div style={{
              position: 'absolute',
              left: `calc(${px}% + 20px + ${showRight ? '10px' : '-260px'})`,
              top: `calc(${py}% + 20px - 40px)`,
              minWidth: 220,
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              boxShadow: 'var(--shadow-md)',
              fontSize: 11.5, color: 'var(--fg-1)',
              pointerEvents: 'none',
              zIndex: 5,
              animation: 'fade-in 120ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 15 }}>{t.r.flag}</span>
                <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{label}</span>
                {t.r.hot && (
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: 'var(--orange-soft)', color: 'var(--orange)',
                    fontWeight: 600, letterSpacing: 0.3,
                  }}>HOT</span>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 8 }}>
                {t.r.code} · {t.r.arch || 'ARM'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10.5 }}>
                <div>
                  <div style={{ color: 'var(--fg-3)' }}>{tr('regions.map.history')}</div>
                  <div className="mono num" style={{ color: 'var(--fg-0)', fontWeight: 600, fontSize: 13 }}>
                    {(t.r.totalGrabs || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--fg-3)' }}>{tr('regions.map.today')}</div>
                  <div className="mono num" style={{
                    color: t.r.todayGrabs > 0 ? 'var(--orange)' : 'var(--fg-2)',
                    fontWeight: 600, fontSize: 13,
                  }}>
                    {t.r.todayGrabs > 0 ? `+${t.r.todayGrabs}` : '0'}
                  </div>
                </div>
              </div>
              {t.r.released ? (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                  {tr('regions.map.first')}{t.r.firstAt || '—'}
                </div>
              ) : (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--fg-3)' }}>
                  {tr('regions.map.notReleased')}
                </div>
              )}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 20, marginTop: 14,
          paddingTop: 14, borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--fg-2)', alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent)',
            }} />{tr('regions.map.legend.released')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              position: 'relative', width: 10, height: 10, borderRadius: '50%',
              background: 'var(--orange)',
              boxShadow: '0 0 0 4px oklch(0.72 0.16 55 / 0.25)',
            }} />{tr('regions.map.legend.today')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-3)' }} />{tr('regions.map.legend.unreleased')}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontSize: 10.5 }}>
            <Icon name="mouse-pointer-2" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            {tr('regions.map.hint')}
          </span>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { RegionsPage });
