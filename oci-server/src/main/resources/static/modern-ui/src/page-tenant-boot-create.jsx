// ─── 开机规格归一化与实时美元费用估算纯函数 (无 DOM / React 依赖) ─────────────
function normalizeBootShapeSpec(input) {
  const cfg = input || {};
  const shape = String(cfg.shape || 'VM.Standard.A1.Flex');
  const rawOcpu = Number(cfg.ocpu);
  const rawMem = Number(cfg.memoryGb);
  const rawVol = (cfg.bootVolumeGb === undefined || cfg.bootVolumeGb === null || cfg.bootVolumeGb === '')
    ? 50
    : Number(cfg.bootVolumeGb);

  const volIsInt = Number.isInteger(rawVol);
  const volInBounds = volIsInt && rawVol >= 47 && rawVol <= 32768;
  const normalizedVol = Number.isFinite(rawVol)
    ? Math.min(32768, Math.max(47, Math.round(rawVol)))
    : 50;

  if (shape === 'VM.Standard.E2.1.Micro') {
    const microErrors = [];
    if (!volIsInt) microErrors.push('引导卷大小必须为整数');
    else if (!volInBounds) microErrors.push('引导卷大小需在 47 ~ 32768 GB 之间');
    return {
      shape: 'VM.Standard.E2.1.Micro',
      ocpu: 1,
      memoryGb: 1,
      bootVolumeGb: normalizedVol,
      locked: true,
      isFreeFixed: true,
      isFlex: false,
      isIntegerValid: volIsInt,
      isRatioValid: true,
      valid: microErrors.length === 0,
      errors: microErrors,
    };
  }

  const flexShapes = {
    'VM.Standard.A1.Flex': true,
    'VM.Standard.A2.Flex': true,
    'VM.Standard.E4.Flex': true,
    'VM.Standard.E5.Flex': true,
    'VM.Standard3.Flex': true,
    'VM.Optimized3.Flex': true,
  };
  const isFlex = Boolean(flexShapes[shape] || shape.slice(-5) === '.Flex');
  const ocpuIsInt = Number.isInteger(rawOcpu);
  const memIsInt = Number.isInteger(rawMem);
  const ocpuInBounds = ocpuIsInt && rawOcpu >= 1 && rawOcpu <= 80;
  const memInBounds = memIsInt && rawMem >= 1 && rawMem <= 512;

  const clampedOcpu = Number.isFinite(rawOcpu)
    ? Math.min(80, Math.max(1, Math.round(rawOcpu)))
    : 1;
  const minMem = clampedOcpu;
  const maxMem = Math.min(512, clampedOcpu * 64);
  const defaultMem = shape === 'VM.Standard.A1.Flex'
    ? Math.min(512, clampedOcpu * 6)
    : Math.min(512, clampedOcpu * 4);
  const clampedMem = Number.isFinite(rawMem)
    ? Math.min(maxMem, Math.max(minMem, Math.round(rawMem)))
    : defaultMem;

  const ratio = (rawOcpu > 0 && Number.isFinite(rawMem)) ? (rawMem / rawOcpu) : 0;
  const ratioInBounds = rawOcpu > 0 && ratio >= 1 && ratio <= 64;

  const errors = [];
  if (!ocpuIsInt) errors.push('OCPU 核心数必须为整数');
  else if (!ocpuInBounds) errors.push('OCPU 核心数范围需在 1 ~ 80 之间');

  if (!memIsInt) errors.push('内存容量必须为整数');
  else if (!memInBounds) errors.push('内存容量范围需在 1 ~ 512 GB 之间');
  else if (!ratioInBounds) errors.push('单核内存比需在 1 ~ 64 GB/OCPU 之间');

  if (!volIsInt) errors.push('引导卷大小必须为整数');
  else if (!volInBounds) errors.push('引导卷大小需在 47 ~ 32768 GB 之间');

  return {
    shape,
    ocpu: clampedOcpu,
    memoryGb: clampedMem,
    bootVolumeGb: normalizedVol,
    locked: false,
    isFreeFixed: false,
    isFlex,
    isIntegerValid: ocpuIsInt && memIsInt && volIsInt,
    isRatioValid: ratioInBounds,
    valid: errors.length === 0,
    errors,
  };
}

function estimateBootMonthlyCost(input) {
  const normalized = normalizeBootShapeSpec(input);
  const shape = normalized.shape;
  const ocpu = normalized.ocpu;
  const memoryGb = normalized.memoryGb;
  const bootVolumeGb = normalized.bootVolumeGb;

  const HOURS_PER_MONTH = 720;
  const FREE_VOLUME_POOL_GB = 200;
  const VOLUME_RATE_PER_GB_MONTH = 0.0255;

  let computeHourlyRaw = 0;
  if (shape === 'VM.Standard.E2.1.Micro') {
    computeHourlyRaw = 0;
  } else if (shape === 'VM.Standard.A1.Flex') {
    const billableOcpu = Math.max(0, ocpu - 4);
    const billableMemGb = Math.max(0, memoryGb - 24);
    computeHourlyRaw = billableOcpu * 0.01 + billableMemGb * 0.0015;
  } else if (shape === 'VM.Standard.A2.Flex') {
    computeHourlyRaw = ocpu * 0.02 + memoryGb * 0.0015;
  } else if (shape === 'VM.Standard.E4.Flex') {
    computeHourlyRaw = ocpu * 0.025 + memoryGb * 0.0015;
  } else if (shape === 'VM.Standard.E5.Flex') {
    computeHourlyRaw = ocpu * 0.03 + memoryGb * 0.002;
  } else if (shape === 'VM.Standard3.Flex') {
    computeHourlyRaw = ocpu * 0.04 + memoryGb * 0.0015;
  } else if (shape === 'VM.Optimized3.Flex') {
    computeHourlyRaw = ocpu * 0.054 + memoryGb * 0.0015;
  } else {
    computeHourlyRaw = ocpu * 0.03 + memoryGb * 0.0015;
  }

  const billableVolumeGb = Math.max(0, bootVolumeGb - FREE_VOLUME_POOL_GB);
  const storageMonthlyRaw = billableVolumeGb * VOLUME_RATE_PER_GB_MONTH;
  const computeMonthlyRaw = computeHourlyRaw * HOURS_PER_MONTH;
  const totalMonthlyRaw = computeMonthlyRaw + storageMonthlyRaw;
  const totalHourlyRaw = computeHourlyRaw + (storageMonthlyRaw / HOURS_PER_MONTH);

  const round2 = function(n) { return Math.round(n * 100) / 100; };
  const round4 = function(n) { return Math.round(n * 10000) / 10000; };

  const hourlyUsd = round4(totalHourlyRaw);
  const computeHourlyUsd = round4(computeHourlyRaw);
  const computeMonthlyUsd = round2(computeMonthlyRaw);
  const storageMonthlyUsd = round2(storageMonthlyRaw);
  const volumeMonthlyUsd = storageMonthlyUsd;
  const totalMonthlyUsd = round2(totalMonthlyRaw);
  const isAlwaysFree = totalMonthlyUsd === 0;
  const tierBadge = isAlwaysFree
    ? 'Always Free'
    : ('$' + hourlyUsd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00') + '/h · ~$' + totalMonthlyUsd.toFixed(2) + '/mo');

  return {
    shape,
    ocpu,
    memoryGb,
    bootVolumeGb,
    billableVolumeGb,
    hourlyUsd,
    computeHourlyUsd,
    computeMonthlyUsd,
    storageMonthlyUsd,
    volumeMonthlyUsd,
    totalMonthlyUsd,
    isAlwaysFree,
    tierBadge,
  };
}
// --- END BOOT PRICING HELPERS ---

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

  function bootTx(tr, lang, key, zh, en) {
    const v = tr ? tr(key) : key;
    return (v && v !== key) ? v : (lang === 'en' ? en : zh);
  }

  const BOOT_TEMPLATES_ARM = [
    { id: 'arm-base',  label: 'ARM Base',     shape: 'VM.Standard.A1.Flex', archCode: 'ARM',         ocpu: 1, memory: 6,  disk: 50,  tag: '免费', paid: false },
    { id: 'arm-std',   label: 'ARM Standard', shape: 'VM.Standard.A1.Flex', archCode: 'ARM',         ocpu: 2, memory: 12, disk: 50,  tag: '免费', paid: false },
    { id: 'arm-high',  label: 'ARM High',     shape: 'VM.Standard.A1.Flex', archCode: 'ARM',         ocpu: 4, memory: 24, disk: 50,  tag: '免费', paid: false },
    { id: 'arm-a2',    label: 'ARM A2',       shape: 'VM.Standard.A2.Flex', archCode: 'ARM_PAID_A2', ocpu: 4, memory: 24, disk: 200, tag: '付费', paid: true  },
  ];

  const BOOT_TEMPLATES_AMD = [
    { id: 'amd-base',  label: 'AMD Base',     shape: 'VM.Standard.E2.1.Micro', archCode: 'AMD',         ocpu: 1, memory: 1,  disk: 50,  tag: '免费', paid: false },
    { id: 'amd-e3',    label: 'AMD E3',       shape: 'VM.Standard3.Flex',      archCode: 'AMD_PAID_E3', ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
    { id: 'amd-e4',    label: 'AMD E4',       shape: 'VM.Standard.E4.Flex',    archCode: 'AMD_PAID_E4', ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
    { id: 'amd-e5',    label: 'AMD E5',       shape: 'VM.Standard.E5.Flex',    archCode: 'AMD_PAID_E5', ocpu: 4, memory: 24, disk: 50,  tag: '付费', paid: true  },
  ];

  const SHAPE_OPTIONS_BY_ARCH = {
    ARM: [
      { value: 'VM.Standard.A1.Flex', label: 'VM.Standard.A1.Flex (Ampere Always Free 弹性)', archCode: 'ARM' },
      { value: 'VM.Standard.A2.Flex', label: 'VM.Standard.A2.Flex (Ampere 付费弹性)', archCode: 'ARM_PAID_A2' },
    ],
    AMD: [
      { value: 'VM.Standard.E2.1.Micro', label: 'VM.Standard.E2.1.Micro (Always Free 固定 1C 1G)', archCode: 'AMD' },
      { value: 'VM.Standard.E4.Flex',    label: 'VM.Standard.E4.Flex (AMD EPYC E4 弹性)', archCode: 'AMD_PAID_E4' },
      { value: 'VM.Standard.E5.Flex',    label: 'VM.Standard.E5.Flex (AMD EPYC E5 弹性)', archCode: 'AMD_PAID_E5' },
      { value: 'VM.Standard3.Flex',      label: 'VM.Standard3.Flex (Intel Xeon 弹性)', archCode: 'AMD_PAID_E3' },
      { value: 'VM.Optimized3.Flex',     label: 'VM.Optimized3.Flex (高频计算优化弹性)', archCode: 'AMD_PAID_E3' },
    ],
  };

  function BootSpecIntInput({ value, onChange, min, max, disabled = false }) {
    return (
      <input
        type="number"
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        step={1}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '7px 10px',
          background: disabled ? 'var(--bg-3)' : 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: disabled ? 'var(--fg-3)' : 'var(--fg-0)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.8 : 1,
        }}
      />
    );
  }

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
    const [shape, setShape] = useState('VM.Standard.A1.Flex');
    const [lastTemplate, setLastTemplate] = useState(() => BOOT_TEMPLATES_ARM[2]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('arm-high');
    const [ocpu, setOcpu] = useState(4);
    const [memory, setMemory] = useState(24);
    const [disk, setDisk] = useState(50);
    const [ocpuRaw, setOcpuRaw] = useState('4');
    const [memoryRaw, setMemoryRaw] = useState('24');
    const [diskRaw, setDiskRaw] = useState('50');
    const [billingRiskOpen, setBillingRiskOpen] = useState(false);
    const [instanceCount, setInstanceCount] = useState(1);
    const [loopTime, setLoopTime] = useState(60);
    const [dayGap, setDayGap] = useState('');
    const [remark, setRemark] = useState('');

    // 动态镜像状态 (真实探测)
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [imageError, setImageError] = useState('');
    const [imageReloadKey, setImageReloadKey] = useState(0);
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
        // 数字相同时完整版优先于 Minimal 等变体，保证默认选中完整版
        const sa = String(a.operatingSystemVersion || '').trim(), sb = String(b.operatingSystemVersion || '').trim();
        if (sa.length !== sb.length) return sa.length - sb.length;
        return sa.localeCompare(sb);
      });
    };

    // 2. 真实探测系统镜像 (当租户/区域/架构切换时自动拉取真实可用镜像)
    const activeTenantId = selectedRegionTenantId || tenantDbId;
    useEffect(() => {
      let active = true;
      if (!activeTenantId) return;

      (async () => {
        setLoadingImages(true);
        setImageError('');
        try {
          const res = await window.ociApi.request('/tenants/querySystemImages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: String(activeTenantId), shapeType: architecture }),
          });
          if (res && res.success === false) throw new Error(res.message || '获取镜像失败');
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
          if (active) {
            setImages([]);
            setSelectedOS('');
            setSelectedVersion('');
            setImageId('');
            setImageError(e?.message || '获取镜像失败，请稍后重试');
          }
        } finally {
          if (active) setLoadingImages(false);
        }
      })();

      return () => { active = false; };
    }, [activeTenantId, architecture, imageReloadKey]);

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
      const norm = normalizeBootShapeSpec({
        shape: tpl.shape,
        ocpu: tpl.ocpu,
        memoryGb: tpl.memory,
        bootVolumeGb: tpl.disk,
      });
      setLastTemplate(tpl);
      setSelectedTemplateId(tpl.id);
      setShape(norm.shape);
      setOcpu(norm.ocpu);
      setMemory(norm.memoryGb);
      setDisk(norm.bootVolumeGb);
      setOcpuRaw(String(norm.ocpu));
      setMemoryRaw(String(norm.memoryGb));
      setDiskRaw(String(norm.bootVolumeGb));
      const tname = tenant?.tenancyName || tenant?.name || 'tenant';
      setRemark(`${tname}-${tpl.id}`);
    };

    // 恢复当前预设模板默认规格
    const resetToTemplateDefault = () => {
      if (!lastTemplate) return;
      const norm = normalizeBootShapeSpec({
        shape: lastTemplate.shape,
        ocpu: lastTemplate.ocpu,
        memoryGb: lastTemplate.memory,
        bootVolumeGb: lastTemplate.disk,
      });
      setSelectedTemplateId(lastTemplate.id);
      setShape(norm.shape);
      setOcpu(norm.ocpu);
      setMemory(norm.memoryGb);
      setDisk(norm.bootVolumeGb);
      setOcpuRaw(String(norm.ocpu));
      setMemoryRaw(String(norm.memoryGb));
      setDiskRaw(String(norm.bootVolumeGb));
      shell.showToast(
        bootTx(tr, lang, 'boot.spec.resetDone', `已恢复「${lastTemplate.label}」默认规格`, `Restored ${lastTemplate.label} defaults`),
        { kind: 'info', duration: 1500 }
      );
    };

    // Shape 切换联动 (VM.Standard.E2.1.Micro 自动锁定 1 OCPU / 1 GB)
    const handleShapeChange = (nextShape) => {
      setShape(nextShape);
      setSelectedTemplateId('');
      if (nextShape === 'VM.Standard.E2.1.Micro') {
        setOcpu(1);
        setMemory(1);
        setOcpuRaw('1');
        setMemoryRaw('1');
      } else {
        const norm = normalizeBootShapeSpec({
          shape: nextShape,
          ocpu: Number(ocpuRaw) || ocpu,
          memoryGb: Number(memoryRaw) || memory,
          bootVolumeGb: Number(diskRaw) || disk,
        });
        setOcpu(norm.ocpu);
        setMemory(norm.memoryGb);
        setOcpuRaw(String(norm.ocpu));
        setMemoryRaw(String(norm.memoryGb));
      }
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
    const parsedOcpuNum = ocpuRaw.trim() === '' ? NaN : Number(ocpuRaw);
    const parsedMemNum = memoryRaw.trim() === '' ? NaN : Number(memoryRaw);
    const parsedDiskNum = diskRaw.trim() === '' ? NaN : Number(diskRaw);
    const specValidation = useMemo(() => normalizeBootShapeSpec({
      shape,
      ocpu: parsedOcpuNum,
      memoryGb: parsedMemNum,
      bootVolumeGb: parsedDiskNum,
    }), [shape, parsedOcpuNum, parsedMemNum, parsedDiskNum]);
    const costEstimate = useMemo(() => estimateBootMonthlyCost({
      shape,
      ocpu: specValidation.ocpu,
      memoryGb: specValidation.memoryGb,
      bootVolumeGb: specValidation.bootVolumeGb,
    }), [shape, specValidation.ocpu, specValidation.memoryGb, specValidation.bootVolumeGb]);
    const isDeviatedFromTemplate = Boolean(
      lastTemplate && (
        shape !== lastTemplate.shape ||
        parsedOcpuNum !== lastTemplate.ocpu ||
        parsedMemNum !== lastTemplate.memory ||
        parsedDiskNum !== lastTemplate.disk
      )
    );
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
      if (!specValidation.valid) {
        shell.showToast(specValidation.errors[0] || '计算规格参数不合法，请检查整数与配比范围', { kind: 'warn' });
        return;
      }

      const shapeOpts = SHAPE_OPTIONS_BY_ARCH[architecture] || [];
      const matchedShapeOpt = shapeOpts.find(opt => opt.value === shape);
      const submitArchCode = matchedShapeOpt ? matchedShapeOpt.archCode : architecture;
      const finalOcpu = specValidation.ocpu;
      const finalMemory = specValidation.memoryGb;
      const finalDisk = specValidation.bootVolumeGb;

      // 触发强风控二次确认对话框 (对齐客户端 confirmOracleApiBootRisk)
      shell.openConfirm({
        title: '⚠️ 确认下发 API 开机任务？',
        message: `您即将向目标区域下发抢机任务：${shape} (${finalOcpu}C ${finalMemory}G · ${finalDisk}GB) · ${selectedOS} ${selectedVersion}。\n\nOracle 近期已全面收紧对 API 频繁抢机的风控检测，过度频繁的轮询可能触发封号风险。\n是否已知悉风险并确认启动该任务？`,
        confirmText: '已知晓风险，确认下发',
        danger: true,
        onConfirm: async () => {
          setSaving(true);
          try {
            const body = {
              tenantId: activeTenantId,
              architecture: submitArchCode,
              ocpu: finalOcpu,
              memory: finalMemory,
              disk: finalDisk,
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
      <div style={{
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        padding: '16px 22px 36px',
        gap: 14,
      }}>
        {/* ─── 顶部 PageHeader (与下方内容严格同轴垂直左对齐) ─── */}
        <PageHeader
          icon="zap"
          iconColor="var(--orange)"
          title={
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, lineHeight: 1.15 }}>
              <span
                onClick={() => navigate('tenants')}
                style={{ cursor: 'pointer', color: 'var(--fg-2)', fontWeight: 400, transition: 'color 120ms' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-2)'}
              >
                租户管理
              </span>
              <span style={{ color: 'var(--fg-3)', fontSize: '0.78em', fontWeight: 300, opacity: 0.65 }}>/</span>
              <span style={{ color: 'var(--fg-0)', fontWeight: 'var(--page-title-weight)' }}>创建开机任务</span>
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

        {/* ─── 1. API 开机风控警示横幅 (对齐客户端 apiRiskBanner) ─── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 16px', borderRadius: 'var(--radius)',
          background: 'var(--danger-soft)', border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))',
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
                      padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
                      background: isArm ? 'var(--accent-soft)' : 'var(--bg-2)',
                      border: '1.5px solid ' + (isArm ? 'var(--accent)' : 'var(--border)'),
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isArm ? 'var(--accent)' : 'var(--fg-0)' }}>Ampere ARM</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)', border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))', color: 'var(--accent)', fontWeight: 600 }}>推荐</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>最高可享 4C 24G 免费额度</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArchChange('AMD')}
                    style={{
                      padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
                      background: !isArm ? 'var(--info-soft)' : 'var(--bg-2)',
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
                          padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                          background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
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
                            fontSize: 9.5, padding: '1px 5px', borderRadius: 'var(--radius-sm)',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
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
                      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>实例 Shape、整数核心内存校验与轮询周期</div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isDeviatedFromTemplate ? 'outline' : 'ghost'}
                    size="sm"
                    icon="rotate-ccw"
                    disabled={!isDeviatedFromTemplate}
                    onClick={resetToTemplateDefault}
                    style={isDeviatedFromTemplate ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : {}}
                  >
                    {bootTx(tr, lang, 'boot.spec.resetBtn', '恢复模板默认规格', 'Reset to Template')}
                  </Button>
                </div>

                {/* 实例 Shape 选择 */}
                <FormRow label={bootTx(tr, lang, 'boot.spec.shapeLabel', '实例规格 (Shape)', 'Instance Shape')} required>
                  <CustomDropdown
                    value={shape}
                    onChange={handleShapeChange}
                    height={34}
                    width="100%"
                  >
                    {(SHAPE_OPTIONS_BY_ARCH[architecture] || []).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </CustomDropdown>
                </FormRow>

                {/* VM.Standard.E2.1.Micro 固定锁定提示 */}
                {specValidation.locked && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--info-soft)', border: '1px solid color-mix(in srgb, var(--info) 40%, var(--border))',
                    fontSize: 11, color: 'var(--info)',
                  }}>
                    <Icon name="lock" size={12} style={{ flexShrink: 0 }} />
                    <span>
                      {bootTx(
                        tr,
                        lang,
                        'boot.spec.microLocked',
                        'VM.Standard.E2.1.Micro 为固定微型规格，已自动锁定为 1 OCPU / 1 GB 内存（Always Free 最多 2 台）',
                        'VM.Standard.E2.1.Micro is fixed at 1 OCPU / 1 GB RAM (Always Free up to 2 instances)'
                      )}
                    </span>
                  </div>
                )}

                {/* OCPU + 内存 (并排双列) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormRow label={specValidation.locked ? 'OCPU (已锁定 1C)' : 'OCPU (核心数 · 1~80 整数)'} required>
                    <BootSpecIntInput
                      value={specValidation.locked ? '1' : ocpuRaw}
                      disabled={specValidation.locked}
                      onChange={raw => {
                        setOcpuRaw(raw);
                        const n = Number(raw);
                        if (Number.isFinite(n) && n >= 1) setOcpu(Math.min(80, Math.round(n)));
                        setSelectedTemplateId('');
                      }}
                      min={1}
                      max={80}
                    />
                  </FormRow>
                  <FormRow label={specValidation.locked ? '内存容量 (已锁定 1GB)' : '内存容量 (GB · 1~512 整数)'} required>
                    <BootSpecIntInput
                      value={specValidation.locked ? '1' : memoryRaw}
                      disabled={specValidation.locked}
                      onChange={raw => {
                        setMemoryRaw(raw);
                        const n = Number(raw);
                        if (Number.isFinite(n) && n >= 1) setMemory(Math.min(512, Math.round(n)));
                        setSelectedTemplateId('');
                      }}
                      min={1}
                      max={512}
                    />
                  </FormRow>
                </div>

                {/* 整数与范围即时校验提示 */}
                {!specValidation.valid && specValidation.errors.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--danger-soft)', border: '1px solid color-mix(in srgb, var(--danger) 45%, var(--border))',
                    fontSize: 11, color: 'var(--danger)', lineHeight: 1.5,
                  }}>
                    <Icon name="alert-circle" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>{specValidation.errors.join('；')}</div>
                  </div>
                )}

                {/* 核心防呆：ARM 1:6 核心内存比动态校验指示条 */}
                {isArm && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: armRatioOk ? 'var(--accent-soft)' : 'var(--orange-soft)',
                    border: '1px solid ' + (armRatioOk ? 'color-mix(in srgb, var(--accent) 35%, var(--border))' : 'color-mix(in srgb, var(--orange) 35%, var(--border))'),
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
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--orange-soft)',
                    border: '1px solid color-mix(in srgb, var(--orange) 35%, var(--border))',
                    fontSize: 11, color: 'var(--orange)',
                  }}>
                    <Icon name="alert-triangle" size={12} style={{ flexShrink: 0 }} />
                    <span>当前规格已超过 Oracle ARM 永久免费上限 (4C 24G 200GB)，可能产生计费</span>
                  </div>
                )}

                {/* 引导卷磁盘大小 */}
                <FormRow label="引导卷大小 (GB)" required hint="免费账户总块存储配额上限为 200GB">
                  <BootSpecIntInput
                    value={diskRaw}
                    onChange={raw => {
                      setDiskRaw(raw);
                      const n = Number(raw);
                      if (Number.isFinite(n) && n >= 47) setDisk(Math.min(32768, Math.round(n)));
                      setSelectedTemplateId('');
                    }}
                    min={47}
                    max={32768}
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
                          flex: 1, padding: '6px 0', borderRadius: 'var(--button-radius)', fontSize: 11.5, fontFamily: 'inherit',
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
                              flex: 1, padding: '5px 0', borderRadius: 'var(--button-radius)', fontSize: 11, fontFamily: 'inherit',
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
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: parsedRange.invalid ? 'var(--danger-soft)' : 'var(--accent-soft)',
                      border: '1px solid ' + (parsedRange.invalid ? 'color-mix(in srgb, var(--danger) 45%, var(--border))' : 'color-mix(in srgb, var(--accent) 35%, var(--border))'),
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
                <FormRow label="操作系统镜像" required hint={loadingImages ? '正在实时探测该区域镜像…' : imageError ? '镜像探测失败' : `该区域已探测到 ${images.length} 个可用镜像`}>
                  <CustomDropdown
                    value={selectedOS}
                    onChange={handleOSChange}
                    height={34}
                    width="100%"
                    disabled={loadingImages || availableOSList.length === 0}
                  >
                    {availableOSList.length === 0 ? (
                      <option value="">{loadingImages ? '探测中…' : imageError ? '探测失败' : '暂无可用镜像'}</option>
                    ) : (
                      availableOSList.map(os => <option key={os} value={os}>{os}</option>)
                    )}
                  </CustomDropdown>
                  {!loadingImages && imageError && (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 8,
                      background: 'var(--danger-soft)', color: 'var(--danger)',
                      fontSize: 12, lineHeight: 1.5,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{imageError}</span>
                      <Button type="button" variant="outline" size="sm" icon="rotate-cw" onClick={() => setImageReloadKey(k => k + 1)}>
                        重试
                      </Button>
                    </div>
                  )}
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

            {/* ─── 4. 创建规格与实时美元费用预估摘要栏 (含折叠风险说明) ─── */}
            <div style={{
              background: 'var(--bg-1)',
              border: '1px solid ' + (costEstimate.isAlwaysFree ? 'var(--border)' : 'color-mix(in srgb, var(--orange) 55%, var(--border))'),
              borderRadius: 'var(--radius)',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                    background: costEstimate.isAlwaysFree ? 'var(--success-soft)' : 'var(--orange-soft)',
                    color: costEstimate.isAlwaysFree ? 'var(--success)' : 'var(--orange)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name={costEstimate.isAlwaysFree ? 'check-circle-2' : 'dollar-sign'} size={15} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
                        {bootTx(tr, lang, 'boot.cost.title', '实时规格与月度费用预估', 'Live Spec & Monthly USD Estimate')}
                      </span>
                      <span className="mono" style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: costEstimate.isAlwaysFree ? 'var(--success-soft)' : 'var(--orange-soft)',
                        color: costEstimate.isAlwaysFree ? 'var(--success)' : 'var(--orange)',
                        border: '1px solid ' + (costEstimate.isAlwaysFree ? 'color-mix(in srgb, var(--success) 45%, var(--border))' : 'color-mix(in srgb, var(--orange) 45%, var(--border))'),
                      }}>
                        {costEstimate.isAlwaysFree
                          ? bootTx(tr, lang, 'boot.cost.alwaysFreeBadge', 'Always Free 额度内 · $0.00/月', 'Always Free · $0.00/mo')
                          : `$${costEstimate.hourlyUsd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00')} / h · ~$${costEstimate.totalMonthlyUsd.toFixed(2)} / mo`}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 3 }}>
                      {shape} · {specValidation.ocpu} OCPU · {specValidation.memoryGb} GB RAM · {specValidation.bootVolumeGb} GB Boot
                      {Number(instanceCount) > 1 ? ` × ${Number(instanceCount)} 台` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--fg-2)' }}>
                    <div>
                      {bootTx(tr, lang, 'boot.cost.compute', '计算预估', 'Compute')}:{' '}
                      <span className="mono num" style={{ fontWeight: 600, color: 'var(--fg-0)' }}>
                        ${costEstimate.computeMonthlyUsd.toFixed(2)}/mo
                      </span>
                    </div>
                    <div>
                      {bootTx(tr, lang, 'boot.cost.storage', '超额存储 (>200GB)', 'Storage (>200GB)')}:{' '}
                      <span className="mono num" style={{ fontWeight: 600, color: 'var(--fg-0)' }}>
                        ${costEstimate.storageMonthlyUsd.toFixed(2)}/mo
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={billingRiskOpen}
                    onClick={() => setBillingRiskOpen(v => !v)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 10px', borderRadius: 'var(--button-radius)',
                      background: 'var(--bg-2)', color: 'var(--fg-1)',
                      border: '1px solid ' + (billingRiskOpen ? 'var(--border-strong)' : 'var(--border)'),
                      fontSize: 11.5, fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'background 120ms, border-color 120ms',
                    }}
                  >
                    <Icon name="help-circle" size={13} style={{ color: 'var(--info)' }} />
                    {bootTx(tr, lang, 'boot.cost.riskToggle', '计费与超额风险说明', 'Billing & Overage Risk')}
                    <Icon name={billingRiskOpen ? 'chevron-up' : 'chevron-down'} size={13} style={{ color: 'var(--fg-3)' }} />
                  </button>
                </div>
              </div>

              {billingRiskOpen && (
                <div style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.65,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div>• <strong style={{ color: 'var(--fg-0)' }}>VM.Standard.E2.1.Micro</strong>：固定 1 OCPU / 1 GB，每个主区域账号最多享有 2 台 Always Free 微型实例。</div>
                  <div>• <strong style={{ color: 'var(--fg-0)' }}>VM.Standard.A1.Flex (ARM)</strong>：整个租户每月共享前 <strong style={{ color: 'var(--fg-0)' }}>4 OCPU (3,000 OCPU·h) + 24 GB (18,000 GB·h)</strong> 免费池；若账号内已有运行中的 ARM 实例，新增实例超出共享池部分按 <span className="mono" style={{ color: 'var(--fg-1)' }}>$0.01/OCPU·h + $0.0015/GB·h</span> 计费。</div>
                  <div>• <strong style={{ color: 'var(--fg-0)' }}>引导卷与块存储池</strong>：免费账户全租户共享 <strong style={{ color: 'var(--fg-0)' }}>200 GB</strong> 块存储额度（含所有实例引导卷与备份），超出部分按约 <span className="mono" style={{ color: 'var(--fg-1)' }}>$0.0255/GB·月</span> 估算。</div>
                  <div>• <strong style={{ color: 'var(--fg-0)' }}>付费 Flex 规格 (E4 / E5 / Standard3 / Optimized3)</strong>：无免费额度抵扣，开机后按实际运行小时计费（预估按 <span className="mono" style={{ color: 'var(--fg-1)' }}>720 小时/月</span> 折算，不含公网出站超额流量）。</div>
                </div>
              )}
            </div>

      </div>
    );
  }

  Object.assign(global, {
    TenantBootCreatePage,
    normalizeBootShapeSpec,
    estimateBootMonthlyCost,
  });
})(typeof window !== 'undefined' ? window : globalThis);
