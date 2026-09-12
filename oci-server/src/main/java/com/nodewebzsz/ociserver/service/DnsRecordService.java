package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ocicommon.enums.ProviderType;

import java.util.List;

public interface DnsRecordService {



    void queryDnsRecordAndRefreshAndChange(Tenant tenant, String instanceId, String oldIp, String ipAddress, List<ProviderType> types);
}
