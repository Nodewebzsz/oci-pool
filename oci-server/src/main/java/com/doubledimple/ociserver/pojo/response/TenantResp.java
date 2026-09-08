package com.doubledimple.ociserver.pojo.response;

/**
 * @version 1.0.0
 * @ClassName TenantDTO
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-03-09 12:37
 */

import com.doubledimple.dao.entity.Tenant;
import lombok.Data;
import org.apache.commons.lang3.StringUtils;

@Data
public class TenantResp {
    private String id;          // 将Long转为String
    private String tenantId;
    private String userName;
    private String tenancyName;
    private String defName;     // 自定义/显示名（对齐 Web getTenantAlias：自定义名优先）
    private String region;
    private Boolean hasChildren;
    private Boolean isHomeRegion;

    // 从Tenant实体构造DTO
    public static TenantResp fromTenant(Tenant tenant) {
        TenantResp dto = new TenantResp();
        String newUserName = "";
        if (StringUtils.isNotBlank(tenant.getTenancyName())){
            newUserName = tenant.getTenancyName();
        }else {
            newUserName = tenant.getUserName();
        }
        // 关键点：将Long型ID转为字符串
        dto.setId(tenant.getId() != null ? tenant.getId().toString() : null);
        dto.setTenantId(tenant.getTenantId());
        dto.setUserName(newUserName);
        dto.setTenancyName(StringUtils.isNotBlank(tenant.getTenancyName()) ? tenant.getTenancyName() : newUserName);
        // 自定义/显示名：优先使用已设置的自定义名，否则回落到租户名（对齐 Web getTenantAlias）
        dto.setDefName(StringUtils.isNotBlank(tenant.getDefName()) ? tenant.getDefName()
                : (StringUtils.isNotBlank(tenant.getTenancyName()) ? tenant.getTenancyName() : newUserName));
        dto.setRegion(tenant.getRegion());
        dto.setHasChildren(tenant.getHasChildren());
        dto.setIsHomeRegion(tenant.getIsHomeRegion());
        return dto;
    }
}
