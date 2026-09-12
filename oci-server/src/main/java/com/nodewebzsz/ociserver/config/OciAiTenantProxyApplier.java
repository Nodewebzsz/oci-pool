package com.nodewebzsz.ociserver.config;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ociai.utils.TenantProxyApplier;
import com.oracle.bmc.http.ClientConfigurator;
import org.springframework.stereotype.Component;

/**
 * 把 server 侧代理（TenantProxyBinder + ProxyContext）直接注入给 oci-ai。
 */
@Component
public class OciAiTenantProxyApplier implements TenantProxyApplier {

    @Override
    public ClientConfigurator apply(Tenant tenant) {
        TenantProxyBinder.applyForTenant(tenant);
        return ProxyContext.get();
    }
}
