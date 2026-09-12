package com.nodewebzsz.ociserver.service.cloud.credential;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ocicommon.enums.CloudTypeEnum;

/**
 * 将 Tenant 字段解析为中立 CloudCredential。
 */
public interface CloudCredentialResolver {

    CloudTypeEnum getCloudType();

    CloudCredential resolve(Tenant tenant);
}
