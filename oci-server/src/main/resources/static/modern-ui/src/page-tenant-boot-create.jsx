// ─── 创建开机任务 · 独立工作台整页 (TenantBootCreatePage) ─────────────
// 替代原局促 Modal 弹窗，严格对齐客户端 TenantBootCreateView 与 UI_STANDARD.md 标准：
// - 顶部页头：带面包屑导航 (租户管理 / 创建开机任务)、返回按钮、保存按钮
// - 顶部警告：API 开机风控警示横幅 (Oracle 封号风险强提醒)
// - 双排四卡片：
//   · 上排：架构与区域卡 (多区域联动) | 规格模板卡 (一键预设与免费/付费标识)
//   · 下排：部署配置卡 (ARM 1:6 比校验 + 免费额度告警) | 系统镜像与访问卡 (真实动态探测镜像 + 密码强度评分)

(function(global) {
  'use strict';

  const { useState, useMemo, useEffect, useCallback } = React;

  const BOOT_TEMPLATES_ARM = [
    { id: 'arm-base',  label: 'ARM Base',     ocpu: 1, memory: 6,  disk: 50,  tag: '免费', paid: false },
    { id: 'arm-std',   label: 'ARM Standard', ocpu: 2, memory: 12, disk: 50,  tag: '免费', paid: false },
    { id: 'arm-high',  label: 'ARM High',     ocpu: 4, memory: 24, disk: 50,  tag: '免费', paid: false },
    { id: 'arm-a2',    label: 'ARM A2',       ocpu: 4, memory: 24, disk: 200, tag: '付费', paid: true  },
  ];

  const BOOT_TEMPLATES_AMD = [
    { id: 'amd-base',  label: 'AMD Base',     ocpu: 1, memory: 1,  disk: 50,  tag: '免费', paid: false },
    { id: 'amd-e3',    label: 'AMD E3',       ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
    { id: 'amd-e4',    label: 'AMD E4',       ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
    { id: 'amd-e5',    label: 'AMD E5',       ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
  ];

  const LOOP_TIME_PRESETS = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: '200s', value: 200 },
    { label: '500s', value: 500 },
  ];

  function randomPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  }

  function scorePassword(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }

  function TenantBootCreatePage({ density, ctx, navigate }) {
    const { t: tr, lang } = useT();
    const shell = useShell();

    const tenantDbId = ctx?.tenantId;
    const initialRegionCode = ctx?.regionCode || ctx?.region || '';

    // 基础租户与区域状态 (第一帧立即兜底，确保区域下拉框绝不空白)
    const [tenant, setTenant] = useState(null);
    const [loadingTenant, setLoadingTenant] = useState(true);
    const [regionOptions, setRegionOptions] = useState(() => {
      if (tenantDbId) {
        return [{ id: String(tenantDbId), region: initialRegionCode, isHomeRegion: true }];
      }
      return [];
    });
    const [selectedRegionTenantId, setSelectedRegionTenantId] = useState(() => String(tenantDbId || ''));

    // 配置参数状态
    const [architecture, setArchitecture] = useState('ARM'); // ARM | AMD
    const [selectedTemplateId, setSelectedTemplateId] = useState('arm-high');
    const [ocpu, setOcpu] = useState(4);
    const [memory, setMemory] = useState(24);
    const [disk, setDisk] = useState(50);
    const [instanceCount, setInstanceCount] = useState(1);
    const [loopTime, setLoopTime] = useState(60);
    const [dayGap, setDayGap] = useState('');
    const [remark, setRemark] = useState('');

    // 动态镜像状态 (真实探测)
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [selectedOS, setSelectedOS] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('');
    const [imageId, setImageId] = useState('');

    // 访问凭据状态
    const [rootPassword, setRootPassword] = useState(() => randomPassword());

    // 提交锁定状态
    const [saving, setSaving] = useState(false);

    // 1. 初始化拉取租户真实多区域列表 (严格调取标准的 /tenants/listRegions 接口)
    useEffect(() => {
      let active = true;
      if (!tenantDbId) return;

      (async () => {
        setLoadingTenant(true);
        try {
          const raw = await window.ociApi.request(`/tenants/listRegions?parentId=${encodeURIComponent(tenantDbId)}`);
          const list = Array.isArray(raw) ? raw : (raw && raw.data ? raw.data : []);
          if (active && Array.isArray(list) && list.length > 0) {
            setRegionOptions(list);
            const root = list.find(r => String(r.id) === String(tenantDbId))
                      || list.find(r => r.isHomeRegion)
                      || list[0];
            setTenant(root);

            // 优先选中路由携带的目标区域，否则默认选中 root 区域
            const targetRegion = list.find(r => r.region === initialRegionCode) || root;
            if (targetRegion) {
              setSelectedRegionTenantId(String(targetRegion.id));
            }

            const tName = root.defName || root.tenancyName || root.userName || 'tenant';
            setRemark(`${tName}-arm-high`);
          }
        } catch (e) {
          console.warn('拉取租户/多区域信息失败:', e);
        } finally {
          if (active) setLoadingTenant(false);
        }
      })();

      return () => { active = false; };
    }, [tenantDbId, initialRegionCode]);

    // 语义化版本倒序排序 (如 24.04 > 22.04 > 20.04，确保较新官方版本优先排在前面并默认选中)
    const sortVersions = (arr) => {
      return [...arr].sort((a, b) => {
        const parse = s => (String(s).match(/\d+/g) || []).map(Number);
        const pa = parse(a.operatingSystemVersion), pb = parse(b.operatingSystemVersion);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
          const va = pa[i] || 0, vb = pb[i] || 0;
          if (va !== vb) return vb - va; // 倒序
        }
        return String(b.operatingSystemVersion || '').localeCompare(String(a.operatingSystemVersion || ''));
      });
    };

    // 2. 真实探测系统镜像 (当租户/区域/架构切换时自动拉取真实可用镜像)
    const activeTenantId = selectedRegionTenantId || tenantDbId;
    useEffect(() => {
      let active = true;
      if (!activeTenantId) return;

      (async () => {
        setLoadingImages(true);
        try {
          const res = await window.ociApi.request('/tenants/querySystemImages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: String(activeTenantId), shapeType: architecture }),
          });
          const rawImgs = res?.data || res || [];
          const list = Array.isArray(rawImgs) ? rawImgs : [];
          if (active) {
            setImages(list);
            // 自动提取 OS 列表
            const osSet = Array.from(new Set(list.map(x => x.operatingSystem).filter(Boolean)));
            if (osSet.length > 0) {
              // 优先选 Ubuntu，否则选首项
              const prefOS = osSet.find(o => o.toLowerCase().includes('ubuntu')) || osSet[0];
              setSelectedOS(prefOS);

              // 自动提取对应版本，按语义化版本倒序排列，优先默认选中较新版本
              const versions = sortVersions(list.filter(x => x.operatingSystem === prefOS));
              if (versions.length > 0) {
                setSelectedVersion(versions[0].operatingSystemVersion || '');
                setImageId(versions[0].imageId || '');
              }
            } else {
              setSelectedOS('');
              setSelectedVersion('');
              setImageId('');
            }
          }
        } catch (e) {
          console.warn('拉取镜像失败:', e);
          if (active) setImages([]);
        } finally {
          if (active) setLoadingImages(false);
        }
      })();

      return () => { active = false; };
    }, [activeTenantId, architecture]);

    // 操作系统切换联动 (自动按倒序排列并默认选中首项新版本)
    const handleOSChange = (os) => {
      setSelectedOS(os);
      const versions = sortVersions(images.filter(x => x.operatingSystem === os));
      if (versions.length > 0) {
        setSelectedVersion(versions[0].operatingSystemVersion || '');
        setImageId(versions[0].imageId || '');
      } else {
        setSelectedVersion('');
        setImageId('');
      }
    };

    // 系统版本切换联动
    const handleVersionChange = (ver) => {
      setSelectedVersion(ver);
      const hit = images.find(x => x.operatingSystem === selectedOS && x.operatingSystemVersion === ver);
      if (hit) {
        setImageId(hit.imageId || '');
      }
    };

    // 应用规格模板
    const applyTemplate = (tpl) => {
      setSelectedTemplateId(tpl.id);
      setOcpu(tpl.ocpu);
      setMemory(tpl.memory);
      setDisk(tpl.disk);
      const tname = tenant?.tenancyName || tenant?.name || 'tenant';
      setRemark(`${tname}-${tpl.id}`);
    };

    // 架构切换联动
    const handleArchChange = (newArch) => {
      setArchitecture(newArch);
      if (newArch === 'ARM') {
        applyTemplate(BOOT_TEMPLATES_ARM[2]); // 默认 ARM High
      } else {
        applyTemplate(BOOT_TEMPLATES_AMD[0]); // 默认 AMD Base
      }
    };

    // 防呆与校验
    const isArm = architecture === 'ARM';
    const armRatioOk = !isArm || (ocpu > 0 && Math.round((memory / ocpu) * 10) / 10 === 6);
    const armExceedsFree = isArm && (ocpu > 4 || memory > 24 || disk > 200);

    const activeTemplates = isArm ? BOOT_TEMPLATES_ARM : BOOT_TEMPLATES_AMD;
    const availableOSList = useMemo(() => {
      return Array.from(new Set(images.map(x => x.operatingSystem).filter(Boolean))).sort();
    }, [images]);
    const availableVersions = useMemo(() => {
      return sortVersions(images.filter(x => x.operatingSystem === selectedOS));
    }, [images, selectedOS]);

    const pwScore = scorePassword(rootPassword);
    const pwLabels = ['极弱', '弱', '中等', '安全', '非常强'];
    const pwColors = ['var(--danger)', 'var(--danger)', 'var(--orange)', 'var(--accent)', 'var(--accent)'];

    // 每日抢机时段快捷场景预设
    const TIME_PRESETS = [
      { label: '全天执行', value: '' },
      { label: '凌晨 (1-8点)', value: '1-8' },
      { label: '白天 (9-18点)', value: '9-18' },
      { label: '夜间 (18-24点)', value: '18-24' },
    ];

    // 时段大白话解析与防呆判定
    const parsedRange = useMemo(() => {
      if (!dayGap || !dayGap.trim()) {
        return { allDay: true, start: 0, end: 24, text: '全天 24 小时持续轮询抢机' };
      }
      const parts = dayGap.split('-').map(x => parseInt(x.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] >= 0 && parts[1] <= 24 && parts[0] < parts[1]) {
        const sStr = String(parts[0]).padStart(2, '0') + ':00';
        const eStr = String(parts[1]).padStart(2, '0') + ':00';
        return {
          allDay: false, start: parts[0], end: parts[1],
          text: `仅在每日 ${sStr} ~ ${eStr} 期间尝试抢机，其余时间自动静默挂起`,
        };
      }
      return { allDay: false, invalid: true, text: '时段格式有误（需为 起始小时-结束小时，如 1-8，且不支持跨天）' };
    }, [dayGap]);

    // 提交保存开机任务 (严格带 API 风控二次确认)
    const handleSubmit = () => {
      if (!imageId) {
        shell.showToast('请选择有效的系统镜像', { kind: 'warn' });
        return;
      }
      if (!rootPassword || rootPassword.length < 8) {
        shell.showToast('Root 密码长度不能少于 8 位', { kind: 'warn' });
        return;
      }
      if (!ocpu || !memory || !disk) {
        shell.showToast('请完整填写 OCPU、内存与磁盘配置', { kind: 'warn' });
        return;
      }

      // 触发强风控二次确认对话框 (对齐客户端 confirmOracleApiBootRisk)
      shell.openConfirm({
        title: '⚠️ 确认下发 API 开机任务？',
        message: `您即将向目标区域下发抢机任务：${ocpu}C ${memory}G · ${disk}GB · ${selectedOS} ${selectedVersion}。\n\nOracle 近期已全面收紧对 API 频繁抢机的风控检测，过度频繁的轮询可能触发封号风险。\n是否已知悉风险并确认启动该任务？`,
        confirmText: '已知晓风险，确认下发',
        danger: true,
        onConfirm: async () => {
          setSaving(true);
          try {
            const body = {
              tenantId: activeTenantId,
              architecture,
              ocpu,
              memory,
              disk,
              instanceCount: Number(instanceCount) || 1,
              loopTime: Number(loopTime) || 60,
              operatingSystem: selectedOS,
              operatingSystemVersion: selectedVersion,
              imageId,
              rootPassword,
              remark: remark.trim() || `${tenant?.tenancyName || 'tenant'}-${architecture}`,
              dayGap: dayGap ? String(dayGap) : '',
              notifyFlag: 'NO',
              cloudType: 1,
            };

            const res = await window.ociServices.tenant.bootSave(body);
            if (!res || res.success !== true) throw new Error(res?.message || '开机任务保存失败');

            shell.showToast('✓ 开机任务创建成功，已加入后台抢机队列', { kind: 'success' });
            // 跳转到开机任务管理页
            navigate('tenant-grab', { tenantDbId: ctx?.tenantId, bootId: res.data?.id });
          } catch (e) {
            shell.showToast(e.message || '下发任务失败', { kind: 'error' });
          } finally {
            setSaving(false);
          }
        },
      });
    };

    // 严格遵循红字批注标准：真实租户名优先 (tenancyName)，去除别名
    const realTenantName = (tenant?.tenancyName && !tenant.tenancyName.startsWith('ocid1.'))
      ? tenant.tenancyName
      : (tenant?.defName || tenant?.userName || (tenantDbId ? `租户 #${tenantDbId}` : ''));

    // 区域规范化展示为单一中文城市名，去除重复括号
    const activeRegRaw = (regionOptions.find(r => String(r.id) === String(selectedRegionTenantId))?.region) || tenant?.region || initialRegionCode || '';
    const activeCityCn = (window.REGION_MAP && (window.REGION_MAP[activeRegRaw]?.simpleName || window.REGION_MAP[activeRegRaw]?.cn)) || activeRegRaw || '主区域';
    const subtitleText = realTenantName ? `${realTenantName} · ${activeCityCn}` : '创建开机任务';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* ─── 顶部 PageHeader ─── */}
        <PageHeader
          icon="zap"
          iconColor="var(--orange)"
          title={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                onClick={() => navigate('tenants')}
                style={{ cursor: 'pointer', color: 'var(--fg-2)', transition: 'color 120ms' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
              >
                租户管理
              </span>
              <span style={{ color: 'var(--fg-3)' }}>/</span>
              <span style={{ color: 'var(--fg-0)', fontWeight: 600 }}>创建开机任务</span>
            </div>
          }
          subtitle={subtitleText}
          actions={
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                icon="arrow-left"
                onClick={() => navigate('tenants')}
              >
                返回租户列表
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="zap"
                loading={saving}
                onClick={handleSubmit}
              >
                保存开机任务
              </Button>
            </div>
          }
        />

        {/* ─── 页面主体：滚动卡片网格 ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 32px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ─── 1. API 开机风控警示横幅 (对齐客户端 apiRiskBanner) ─── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 16px', borderRadius: 8,
              background: 'var(--danger-soft)', border: '1px solid oklch(from var(--danger) l c h / 0.3)',
            }}>
              <Icon name="alert-triangle" size={16} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>
                  Oracle API 开机风控警告
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.55 }}>
                  Oracle 近期已严厉收紧对通过 API 频繁下发创建实例任务的风控策略。高频（如 10s）自动轮询开机可能触发账号异常或限制。建议合理设置循环时间（推荐 60s 以上），保存前请仔细核对配额与配置。
                </div>
              </div>
            </div>

            {/* ─── 2. 上排双卡片：架构与区域 | 规格模板 ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* 卡片 1：架构与区域 (archCard) */}
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="cpu" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>计算架构与目标区域</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>选择处理器架构与部署可用区</div>
                  </div>
                </div>

                {/* 架构选择大按钮 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleArchChange('ARM')}
                    style={{
                      padding: '10px', borderRadius: 8, cursor: 'pointer',
                      background: isArm ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'var(--bg-2)',
                      border: '1.5px solid ' + (isArm ? 'var(--accent)' : 'var(--border)'),
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isArm ? 'var(--accent)' : 'var(--fg-0)' }}>Ampere ARM</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>推荐</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>最高可享 4C 24G 免费额度</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArchChange('AMD')}
                    style={{
                      padding: '10px', borderRadius: 8, cursor: 'pointer',
                      background: !isArm ? 'color-mix(in oklab, var(--info) 12%, transparent)' : 'var(--bg-2)',
                      border: '1.5px solid ' + (!isArm ? 'var(--info)' : 'var(--border)'),
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: !isArm ? 'var(--info)' : 'var(--fg-0)' }}>AMD / x86</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>标准 1C 1G 微型或付费实例</span>
                  </button>
                </div>

                {/* 部署区域选择 (对齐客户端 archCard，首帧即兜底绝不空白，支持多区域联动) */}
                <FormRow label="部署目标区域" required hint="支持在主区域及已订阅的所有子区域中开机">
                  <CustomDropdown
                    value={selectedRegionTenantId}
                    onChange={v => setSelectedRegionTenantId(v)}
                    height={34}
                    width="100%"
                  >
                    {regionOptions.map(r => {
                      const optTenant = r.tenancyName || tenant?.tenancyName || r.userName || realTenantName;
                      const rCode = r.region || initialRegionCode;
                      const cName = (window.REGION_MAP && (window.REGION_MAP[rCode]?.simpleName || window.REGION_MAP[rCode]?.cn)) || rCode;
                      const isHome = r.isHomeRegion ? ' (主区域)' : '';
                      return (
                        <option key={r.id} value={String(r.id)}>
                          {optTenant} · {cName}{isHome}
                        </option>
                      );
                    })}
                  </CustomDropdown>
                </FormRow>
              </div>

              {/* 卡片 2：规格模板 (templateCard) */}
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--cyan-soft)', color: 'var(--cyan)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="layers" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>规格预设模板</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>一键填充最佳核心数、内存与磁盘配置</div>
                  </div>
                </div>

                {/* 模板列表 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
                  {activeTemplates.map(tpl => {
                    const active = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => applyTemplate(tpl)}
                        style={{
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: active ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'var(--bg-2)',
                          border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                          display: 'flex', flexDirection: 'column', gap: 4,
                          transition: 'all 100ms',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--fg-0)' }}>
                            {tpl.label}
                          </span>
                          <span style={{
                            fontSize: 9.5, padding: '1px 5px', borderRadius: 3,
                            background: tpl.paid ? 'var(--orange-soft)' : 'var(--accent-soft)',
                            color: tpl.paid ? 'var(--orange)' : 'var(--accent)',
                            fontWeight: 600,
                          }}>
                            {tpl.tag}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)', fontWeight: 500 }}>
                          {tpl.ocpu}C {tpl.memory}G · {tpl.disk}GB
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                  💡 提示：点击预设模板将自动联动下方参数并生成任务备注，后续亦可在下方卡片中进行微调。
                </div>
              </div>
            </div>

            {/* ─── 3. 下排双卡片：部署配置 | 镜像与密码 ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* 卡片 3：部署配置 (configCard) */}
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--info-soft)', color: 'var(--info)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="sliders" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>计算与部署参数</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>核心、内存、磁盘与轮询周期</div>
                  </div>
                </div>

                {/* OCPU + 内存 (并排双列) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormRow label="OCPU (核心数)" required>
                    <NumberInput
                      value={ocpu}
                      onChange={v => { setOcpu(Math.max(1, v)); setSelectedTemplateId(''); }}
                      min={1} max={128}
                    />
                  </FormRow>
                  <FormRow label="内存容量 (GB)" required>
                    <NumberInput
                      value={memory}
                      onChange={v => { setMemory(Math.max(1, v)); setSelectedTemplateId(''); }}
                      min={1} max={1024}
                    />
                  </FormRow>
                </div>

                {/* 核心防呆：ARM 1:6 核心内存比动态校验指示条 */}
                {isArm && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 6,
                    background: armRatioOk ? 'var(--accent-soft)' : 'var(--orange-soft)',
                    border: '1px solid ' + (armRatioOk ? 'oklch(from var(--accent) l c h / 0.25)' : 'oklch(from var(--orange) l c h / 0.25)'),
                    fontSize: 11, color: armRatioOk ? 'var(--accent)' : 'var(--orange)',
                  }}>
                    <Icon name={armRatioOk ? 'check-circle' : 'alert-circle'} size={12} style={{ flexShrink: 0 }} />
                    <span>
                      {armRatioOk
                        ? `ARM 内存核心比守卫：当前 ${ocpu}C : ${memory}G (1:6) 完美符合 Oracle 官方推荐规则`
                        : `注意：当前比例为 1:${(memory / ocpu).toFixed(1)}，Oracle ARM 官方严格推荐 1C:6G 比例`}
                    </span>
                  </div>
                )}

                {/* 免费额度超额告警 */}
                {armExceedsFree && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 6,
                    background: 'var(--orange-soft)',
                    border: '1px solid oklch(from var(--orange) l c h / 0.25)',
                    fontSize: 11, color: 'var(--orange)',
                  }}>
                    <Icon name="alert-triangle" size={12} style={{ flexShrink: 0 }} />
                    <span>当前规格已超过 Oracle ARM 永久免费上限 (4C 24G 200GB)，可能产生计费</span>
                  </div>
                )}

                {/* 引导卷磁盘大小 */}
                <FormRow label="引导卷大小 (GB)" required hint="免费账户总块存储配额上限为 200GB">
                  <NumberInput
                    value={disk}
                    onChange={v => { setDisk(Math.max(47, v)); setSelectedTemplateId(''); }}
                    min={47} max={32768}
                  />
                </FormRow>

                {/* 循环时间快选 */}
                <FormRow label="轮询抢机周期 (秒)" required hint="下发任务后后台执行定时重试的间隔频率">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {LOOP_TIME_PRESETS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setLoopTime(p.value)}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11.5,
                          cursor: 'pointer', border: '1px solid ' + (loopTime === p.value ? 'var(--accent)' : 'var(--border)'),
                          background: loopTime === p.value ? 'var(--accent-soft)' : 'var(--bg-2)',
                          color: loopTime === p.value ? 'var(--accent)' : 'var(--fg-1)',
                          fontWeight: loopTime === p.value ? 700 : 400,
                          transition: 'all 80ms',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </FormRow>

                {/* 开机实例数量 */}
                <FormRow label="开机实例数量" required hint="成功开机达到该数量后，后台抢机任务将自动完成并停止">
                  <NumberInput
                    value={instanceCount}
                    onChange={v => setInstanceCount(Math.max(1, v))}
                    min={1} max={10}
                  />
                </FormRow>

                {/* 每日抢机时段 (场景胶囊 + 起止联动 + 实时大白话反馈) */}
                <FormRow label="每日抢机时段 (可选)" hint="按需限制抢机时间窗口，避免占用白天 API 额度，支持凌晨放货精准抢机">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* 场景快捷胶囊 */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {TIME_PRESETS.map(p => {
                        const active = (dayGap || '') === p.value;
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setDayGap(p.value)}
                            style={{
                              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11,
                              cursor: 'pointer', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                              background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
                              color: active ? 'var(--accent)' : 'var(--fg-1)',
                              fontWeight: active ? 700 : 400,
                              transition: 'all 80ms',
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* 自定义起止时间下拉选择 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>从</span>
                        <CustomDropdown
                          value={String(parsedRange.allDay ? 0 : (parsedRange.start ?? 0))}
                          onChange={v => {
                            const newStart = parseInt(v, 10);
                            const curEnd = parsedRange.allDay ? 24 : (parsedRange.end ?? 24);
                            const nextEnd = newStart >= curEnd ? Math.min(24, newStart + 1) : curEnd;
                            setDayGap(`${newStart}-${nextEnd}`);
                          }}
                          height={30}
                          width="100%"
                        >
                          {Array.from({ length: 24 }).map((_, i) => (
                            <option key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</option>
                          ))}
                        </CustomDropdown>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 }}>至</span>
                        <CustomDropdown
                          value={String(parsedRange.allDay ? 24 : (parsedRange.end ?? 24))}
                          onChange={v => {
                            const newEnd = parseInt(v, 10);
                            const curStart = parsedRange.allDay ? 0 : (parsedRange.start ?? 0);
                            const nextStart = newEnd <= curStart ? Math.max(0, newEnd - 1) : curStart;
                            setDayGap(`${nextStart}-${newEnd}`);
                          }}
                          height={30}
                          width="100%"
                        >
                          {Array.from({ length: 24 }).map((_, i) => {
                            const val = i + 1;
                            const curStart = parsedRange.allDay ? 0 : (parsedRange.start ?? 0);
                            return (
                              <option key={val} value={String(val)} disabled={val <= curStart}>
                                {String(val).padStart(2, '0')}:00
                              </option>
                            );
                          })}
                        </CustomDropdown>
                      </div>
                    </div>

                    {/* 实时大白话反馈提示条 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 6,
                      background: parsedRange.invalid ? 'var(--danger-soft)' : 'color-mix(in oklab, var(--accent) 10%, transparent)',
                      border: '1px solid ' + (parsedRange.invalid ? 'var(--danger)' : 'oklch(from var(--accent) l c h / 0.2)'),
                      fontSize: 11,
                      color: parsedRange.invalid ? 'var(--danger)' : 'var(--accent)',
                    }}>
                      <Icon name={parsedRange.invalid ? 'alert-triangle' : 'clock'} size={12} style={{ flexShrink: 0 }} />
                      <span>{parsedRange.text}</span>
                    </div>
                  </div>
                </FormRow>
              </div>

              {/* 卡片 4：镜像与访问 (imageCard) */}
              <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--orange-soft)', color: 'var(--orange)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name="shield-check" size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>系统镜像与安全凭据</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>动态探测官方镜像与初始化 Root 密码</div>
                  </div>
                </div>

                {/* 操作系统选择 (动态探测) */}
                <FormRow label="操作系统镜像" required hint={loadingImages ? '正在实时探测该区域镜像…' : `该区域已探测到 ${images.length} 个可用镜像`}>
                  <CustomDropdown
                    value={selectedOS}
                    onChange={handleOSChange}
                    height={34}
                    width="100%"
                    disabled={loadingImages || availableOSList.length === 0}
                  >
                    {availableOSList.length === 0 ? (
                      <option value="">{loadingImages ? '探测中…' : '暂无可用镜像'}</option>
                    ) : (
                      availableOSList.map(os => <option key={os} value={os}>{os}</option>)
                    )}
                  </CustomDropdown>
                </FormRow>

                {/* 系统版本选择 (纯净展示版本号，去除乱码哈希后缀) */}
                <FormRow label="镜像版本" required>
                  <CustomDropdown
                    value={selectedVersion}
                    onChange={handleVersionChange}
                    height={34}
                    width="100%"
                    disabled={loadingImages || availableVersions.length === 0}
                  >
                    {availableVersions.map(v => (
                      <option key={v.imageId} value={v.operatingSystemVersion}>
                        {v.operatingSystemVersion}
                      </option>
                    ))}
                  </CustomDropdown>
                </FormRow>

                {/* 镜像 OCID (只读展示，不可编辑，仅供查看与一键复制) */}
                <FormRow label="镜像 OCID" hint="由系统根据上方操作系统与版本自动匹配绑定，仅供查看">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      mono
                      readOnly
                      allowClear={false}
                      value={imageId || (loadingImages ? '探测匹配中…' : '—')}
                      style={{ background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'default' }}
                    />
                    {imageId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon="copy"
                        onClick={() => {
                          navigator.clipboard?.writeText(imageId)
                            .then(() => shell.showToast('已复制镜像 OCID 到剪贴板', { kind: 'success' }))
                            .catch(() => shell.showToast('复制失败', { kind: 'error' }));
                        }}
                        title="复制镜像 OCID"
                      >
                        复制
                      </Button>
                    )}
                  </div>
                </FormRow>

                {/* Root 密码 (默认明文显示，内嵌眼睛可自由切换隐藏) */}
                <FormRow label="实例 Root 初始密码" required>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      mono
                      icon="key"
                      type="password"
                      defaultReveal={true}
                      value={rootPassword}
                      onChange={setRootPassword}
                      placeholder="初始密码 (至少8位)"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon="refresh-cw"
                      onClick={() => setRootPassword(randomPassword())}
                      title="随机生成高强密码"
                    >
                      随机
                    </Button>
                  </div>
                  {/* 密码强度指示条 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 3, flex: 1, height: 4 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          style={{
                            flex: 1, borderRadius: 2,
                            background: i < pwScore ? pwColors[pwScore] : 'var(--bg-3)',
                            transition: 'background 120ms',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 10.5, color: pwColors[pwScore], fontWeight: 600 }}>
                      {pwLabels[pwScore]}
                    </span>
                  </div>
                </FormRow>

                {/* 任务备注 */}
                <FormRow label="任务自定义备注">
                  <TextInput
                    value={remark}
                    onChange={setRemark}
                    placeholder="如：新加坡-ARM-满血"
                  />
                </FormRow>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  global.TenantBootCreatePage = TenantBootCreatePage;
})(typeof window !== 'undefined' ? window : globalThis);
