package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.RegisterDetail;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ociserver.pojo.response.TenantPortraitVO;
import com.nodewebzsz.ociserver.service.impl.TenantServiceImpl;
import com.oracle.bmc.ospgateway.model.Subscription;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TenantPortraitServiceTest {

    @Test
    void includesLegacyZeroParentsAndExcludesChildMappings() {
        java.util.List<Tenant> tenants = new java.util.ArrayList<>();
        for (long id = 1; id <= 9; id++) {
            Tenant main = new Tenant();
            main.setId(id);
            main.setParenId(0L);
            main.setIsHomeRegion(true);
            tenants.add(main);
        }
        for (long id = 10; id <= 12; id++) {
            Tenant child = new Tenant();
            child.setId(id);
            child.setParenId(1L);
            child.setIsHomeRegion(false);
            tenants.add(child);
        }
        TenantPortraitVO portrait = TenantServiceImpl.computeTenantPortrait(tenants);
        assertEquals(9L, portrait.getTotalMainTenants());
        assertEquals(1L, portrait.getMultiRegionCount());
        assertEquals(8L, portrait.getRegionCountBuckets().get("r1"));
        assertEquals(1L, portrait.getRegionCountBuckets().get("r3Plus"));
        assertEquals(0L, TenantServiceImpl.computeTenantPortrait(java.util.Collections.emptyList()).getTotalMainTenants());
    }

    @Test
    void buildPortraitAggregatesHomeTenantsUpgradeEntityAgeAndRegionCount() {
        Tenant main1 = new Tenant();
        main1.setId(1L);
        main1.setIsHomeRegion(true);
        main1.setAccountType("PAID");
        main1.setActiveDays("400");
        RegisterDetail rd1 = new RegisterDetail();
        rd1.setAccountType(Subscription.AccountType.Corporate);
        main1.setRegisterDetail(rd1);

        Tenant sub1 = new Tenant();
        sub1.setId(2L);
        sub1.setIsHomeRegion(false);
        sub1.setParenId(1L);

        Tenant main2 = new Tenant();
        main2.setId(3L);
        main2.setIsHomeRegion(true);
        main2.setAccountType("FREE");
        main2.setActiveDays("45");
        main2.setCreatedAt(LocalDateTime.now().minusDays(45));
        RegisterDetail rd2 = new RegisterDetail();
        rd2.setAccountType(Subscription.AccountType.Personal);
        main2.setRegisterDetail(rd2);

        TenantPortraitVO vo = TenantServiceImpl.computeTenantPortrait(Arrays.asList(main1, sub1, main2));
        assertEquals(2L, vo.getTotalMainTenants());
        assertEquals(1L, vo.getUpgradedCount());
        assertEquals(1L, vo.getFreeCount());
        assertEquals(1L, vo.getCorporateCount());
        assertEquals(1L, vo.getPersonalCount());
        assertEquals(1L, vo.getOverHalfYearCount());
        assertEquals(1L, vo.getOverOneYearCount());
        assertEquals(1L, vo.getMultiRegionCount());
        assertEquals(1L, vo.getRegionCountBuckets().get("r2"));
        assertEquals(1L, vo.getAgeBuckets().get("gt365d"));
    }

    @Test
    void handlesUpgradeEnumFallbackTimestampsAndMultiRegions() {
        Tenant main = new Tenant();
        main.setId(10L);
        main.setIsHomeRegion(true);
        main.setAccountType("UPGRADE_ACCOUNT");
        main.setCreatedAt(LocalDateTime.now().minusDays(200));

        Tenant subA = new Tenant();
        subA.setId(11L);
        subA.setIsHomeRegion(false);
        subA.setParenId(10L);

        Tenant subB = new Tenant();
        subB.setId(12L);
        subB.setIsHomeRegion(false);
        subB.setParenId(10L);

        TenantPortraitVO vo = TenantServiceImpl.computeTenantPortrait(Arrays.asList(main, subA, subB));
        assertEquals(1L, vo.getTotalMainTenants());
        assertEquals(1L, vo.getUpgradedCount());
        assertEquals(1L, vo.getUnknownEntityCount());
        assertEquals(1L, vo.getOverHalfYearCount());
        assertEquals(0L, vo.getOverOneYearCount());
        assertEquals(1L, vo.getAgeBuckets().get("d180To365"));
        assertEquals(1L, vo.getRegionCountBuckets().get("r3Plus"));
    }
}
