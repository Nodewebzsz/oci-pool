(function (global) {
  'use strict';

  function toStringId(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function findRegionCode(regionValue, regions) {
    const raw = regionValue === null || regionValue === undefined ? '' : String(regionValue);
    if (!raw || /^[a-z]{2}-[a-z0-9-]+$/.test(raw)) return raw;
    const hit = (Array.isArray(regions) ? regions : []).find(function (region) {
      return region
        && (region.simpleName === raw || region.cn === raw || region.name === raw || region.code === raw);
    });
    return hit ? hit.code : raw;
  }

  function normalize(tenant, regions) {
    const source = tenant || {};
    const isActive = typeof source.isActive === 'boolean'
      ? source.isActive
      : (typeof source.active === 'boolean' ? source.active : null);
    const activeDays = source.activeDays;
    const accountCost = Number(source.accountCost ?? 0);
    // 后端 Tenant 同时返回 id(Long) 与可选 idStr(String)。idStr 可能是空串，
    // 不能因为空串存在就覆盖真实数据库 id，否则实例筛选无法回显租户。
    const exactId = [source.idStr, source.id, source.tenantDbId, source.tenant_id, source.tenantId]
      .find(function (value) { return value !== null && value !== undefined && String(value) !== ''; });
    const rawAlias = source.defName ?? '';
    const fallbackAliases = [source.userName, source.idStr, source.tenantId]
      .filter(value => value !== null && value !== undefined && value !== '');
    const alias = fallbackAliases.includes(rawAlias) ? '' : rawAlias;

    return {
      ...source,
      _ui: {
        id: toStringId(exactId),
        name: source.tenancyName ?? source.userName ?? source.name ?? '',
        alias: alias,
        accountCost: Number.isFinite(accountCost) ? accountCost : 0,
        activeDays: (activeDays === null || activeDays === undefined || activeDays === '')
          ? '0'
          : String(activeDays),
        hasBootTask: source.openBootFlag === true,
        hasChildren: source.hasChildren === true,
        regionCode: findRegionCode(source.region ?? source.mainRegion, regions),
        isActive: isActive,
        status: isActive === true ? 'active' : (isActive === false ? 'inactive' : 'unknown'),
        createdAt: source.createdAtStr ?? source.createdAt ?? '',
      },
    };
  }

  global.ociTenantRow = Object.freeze({ normalize: normalize });
})(typeof window !== 'undefined' ? window : globalThis);
