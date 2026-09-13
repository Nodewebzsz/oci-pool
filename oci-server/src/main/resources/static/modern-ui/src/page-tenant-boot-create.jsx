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

    // 基础租户与区域状态
    const [tenant, setTenant] = useState(null);
    const [loadingTenant, setLoadingTenant] = useState(true);
    const [regionOptions, setRegionOptions] = useState([]);
    const [selectedRegionTenantId, setSelectedRegionTenantId] = useState(tenantDbId ? String(tenantDbId) : '');

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
    const [customImageId, setCustomImageId] = useState('');

    // 访问凭据状态
    const [rootPassword, setRootPassword] = useState(() => randomPassword());
    const [showPassword, setShowPassword] = useState(false);

    // 提交锁定状态
    const [saving, setSaving] = useState(false);

    // 1. 初始化拉取租户详情与已订阅多区域列表
    useEffect(() => {
      let active = true;
      if (!tenantDbId) return;

      (async () => {
        setLoadingTenant(true);
        try {
          // 拉取租户基本信息
          const res = await window.ociApi.request(`/tenants/getTenant/${tenantDbId}`, { method: 'POST' });
          const t = res?.data || res;
          if (active && t) {
            setTenant(t);
            setRemark(`${t.tenancyName || t.name || 'tenant'}-arm-high`);
          }

          // 动态拉取多区域选项
          const regsRes = await window.ociServices.tenant.listRegions({ parentId: tenantDbId });
          const regs = regsRes?.data || regsRes || [];
          if (active) {
            if (Array.isArray(regs) && regs.length > 0) {
              setRegionOptions(regs);
              setSelectedRegionTenantId(String(regs[0].id || tenantDbId));
            } else if (t) {
              setRegionOptions([{ id: tenantDbId, tenancyName: t.tenancyName || t.name, region: t.region }]);
            }
          }
        } catch (e) {
          console.warn('拉取租户/区域信息失败:', e);
        } finally {
          if (active) setLoadingTenant(false);
        }
      })();

      return () => { active = false; };
    }, [tenantDbId]);

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

              // 自动提取对应版本
              const versions = list.filter(x => x.operatingSystem === prefOS);
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

    // 操作系统切换联动
    const handleOSChange = (os) => {
      setSelectedOS(os);
      const versions = images.filter(x => x.operatingSystem === os);
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
      return images.filter(x => x.operatingSystem === selectedOS);
    }, [images, selectedOS]);

    const pwScore = scorePassword(rootPassword);
    const pwLabels = ['极弱', '弱', '中等', '安全', '非常强'];
    const pwColors = ['var(--danger)', 'var(--danger)', 'var(--orange)', 'var(--accent)', 'var(--accent)'];

    // 提交保存开机任务 (严格带 API 风控二次确认)
    const handleSubmit = () => {
      const finalImageId = customImageId.trim() || imageId;
      if (!finalImageId) {
        shell.showToast('请选择有效的系统镜像或填写镜像 OCID', { kind: 'warn' });
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
              imageId: finalImageId,
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

    const tenantTitle = tenant?.tenancyName || tenant?.name || `租户 #${tenantDbId}`;
    const regionName = (tenant?.region && window.REGION_MAP?.[tenant.region]?.simpleName) || tenant?.region || '主区域';

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
          subtitle={`${tenantTitle} · ${regionName}`}
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

                {/* 目标租户展示 */}
                <FormRow label="目标租户">
                  <div style={{
                    padding: '8px 12px', background: 'var(--bg-2)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  }}>
                    <Icon name="user" size={13} style={{ color: 'var(--fg-3)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{tenantTitle}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>#{tenantDbId}</span>
                  </div>
                </FormRow>

                {/* 目标区域选择 (多区域动态拉取联动) */}
                <FormRow label="部署目标区域" required hint="支持在主区域及已订阅的所有子区域中开机">
                  <CustomDropdown
                    value={selectedRegionTenantId}
                    onChange={v => setSelectedRegionTenantId(v)}
                    height={34}
                    width="100%"
                  >
                    {regionOptions.map(r => {
                      const cName = (window.REGION_MAP?.[r.region]?.simpleName) || r.region;
                      return (
                        <option key={r.id} value={String(r.id)}>
                          {cName} ({r.region}) · {r.tenancyName || tenantTitle}
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
                      onChange={v => setOcpu(Math.max(1, v))}
                      min={1} max={128}
                    />
                  </FormRow>
                  <FormRow label="内存容量 (GB)" required>
                    <NumberInput
                      value={memory}
                      onChange={v => setMemory(Math.max(1, v))}
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
                    onChange={v => setDisk(Math.max(47, v))}
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

                {/* 开机实例数 + 跨天间隔 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormRow label="开机实例数量" required>
                    <NumberInput
                      value={instanceCount}
                      onChange={v => setInstanceCount(Math.max(1, v))}
                      min={1} max={10}
                    />
                  </FormRow>
                  <FormRow label="抢机时间范围 (可选)" hint="如: 1-8 (表示凌晨1点至8点)">
                    <TextInput
                      mono
                      value={dayGap}
                      onChange={setDayGap}
                      placeholder="留空表示全天不限"
                    />
                  </FormRow>
                </div>
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

                {/* 系统版本选择 */}
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
                        {v.operatingSystemVersion} ({v.displayName || v.imageId?.slice(-8)})
                      </option>
                    ))}
                  </CustomDropdown>
                </FormRow>

                {/* 镜像 OCID (自动绑定，支持展开覆盖) */}
                <FormRow label="镜像 OCID" hint="由系统根据选择自动匹配，高级用户可手动指定覆盖">
                  <TextInput
                    mono
                    value={customImageId || imageId}
                    onChange={setCustomImageId}
                    placeholder="ocid1.image.oc1..."
                  />
                </FormRow>

                {/* Root 密码 (带随机生成与强度条) */}
                <FormRow label="实例 Root 初始密码" required>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      mono
                      icon="key"
                      type={showPassword ? 'text' : 'password'}
                      value={rootPassword}
                      onChange={setRootPassword}
                      placeholder="初始密码 (至少8位)"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? '隐藏密码' : '显示密码'}
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
