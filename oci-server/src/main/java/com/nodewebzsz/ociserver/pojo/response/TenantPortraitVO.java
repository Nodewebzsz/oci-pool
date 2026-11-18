package com.nodewebzsz.ociserver.pojo.response;

import lombok.Data;

import java.util.Map;

@Data
public class TenantPortraitVO {
    private long totalMainTenants;
    private long upgradedCount;
    private long freeCount;
    private long corporateCount;
    private long personalCount;
    private long unknownEntityCount;
    private long overHalfYearCount;
    private long overOneYearCount;
    private long multiRegionCount;
    private Map<String, Long> ageBuckets;
    private Map<String, Long> regionCountBuckets;
}
