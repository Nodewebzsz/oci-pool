package com.nodewebzsz.ociserver.service.cloud.gcp;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ocicommon.enums.CloudTypeEnum;
import com.nodewebzsz.ociserver.service.cloud.credential.CloudCredential;
import com.nodewebzsz.ociserver.service.cloud.credential.CloudCredentialResolver;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

@Component
public class GcpCredentialResolver implements CloudCredentialResolver {

    @Override
    public CloudTypeEnum getCloudType() {
        return CloudTypeEnum.GOOGLE_CLOUD;
    }

    @Override
    public CloudCredential resolve(Tenant tenant) {
        if (tenant == null) {
            throw new IllegalArgumentException("租户不能为空");
        }
        // tenancy = projectId, keyFile = SA JSON path, tenantId = client_email
        if (StringUtils.isBlank(tenant.getTenancy()) || StringUtils.isBlank(tenant.getKeyFile())) {
            throw new IllegalArgumentException("GCP 凭证不完整: projectId(tenancy)/keyFile 必填");
        }
        return new CloudCredential(
                CloudTypeEnum.GOOGLE_CLOUD,
                tenant.getTenancy(),
                tenant.getKeyFile(),
                tenant.getTenantId(),
                tenant.getRegion(),
                tenant.getFingerprint()
        );
    }
}
