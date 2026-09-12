package com.nodewebzsz.ociserver.service.oracle;

import com.nodewebzsz.dao.entity.InstanceCloudNetWork;
import com.nodewebzsz.ociserver.pojo.domain.dto.User;
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;

import java.util.List;
import java.util.Optional;

public interface OracleCloudNetworkService {

    /**
    * @Description: 保存
    *
    */
    public InstanceCloudNetWork save(InstanceCloudNetWork network);

    public void saveBatch(List<InstanceCloudNetWork> networks);

    /**
    * 根据租户和区域查找
    */
    public InstanceCloudNetWork findByMultipleConditions(String tenantId, String region);


    /**
    * 根据tenantId(provider的tenantId)和区域查询最新的一条网络信息
    */
    InstanceCloudNetWork findFirstByTenantIdAndRegionOrderByCreatedAtDesc(
            String tenantId,
            String region
    );

    /**
    * 加载网络管理器相关
    */
    InstanceCloudNetWork loadNetWork(User user, SimpleAuthenticationDetailsProvider authenticationDetailsProvider);
}
