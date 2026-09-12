package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.DbConfig;
import com.nodewebzsz.ocicommon.param.ApiResponse;

import java.util.Map;

public interface DbConfigService {

    void save(DbConfig dbConfig);

    ApiResponse findByTenantId(Long tenantId);

    ApiResponse syncMysqlFromCloud(Long tenantId);

    ApiResponse syncSingleMysqlFromCloud(Long id);

    ApiResponse bindPublicIp(Long id);

    ApiResponse createMysql(Long tenantId);

    ApiResponse handleMysqlAction(Map<String, Object> payload);

    public ApiResponse resetMysqlAuth(Long id, Long tenantId);
}
