package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.TenantSocial;
import com.nodewebzsz.ocicommon.param.ApiResponse;

import java.util.List;

public interface SocialTypeService {



    ApiResponse getAllSocialType(TenantSocial tenantSocial);

    ApiResponse updateSocial(TenantSocial tenantSocial);

    ApiResponse addSocial(TenantSocial tenantSocial);

    ApiResponse disable(TenantSocial tenantSocial);

    //删除
    ApiResponse delete(TenantSocial tenantSocial);
}
