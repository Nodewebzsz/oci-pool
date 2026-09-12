package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.InstanceDetails;
import com.nodewebzsz.ociserver.pojo.domain.dto.OracleInstanceDetail;
import com.nodewebzsz.ociserver.pojo.domain.dto.User;
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;

public interface InstanceDetailsService {

    public void doSyncInstance(User user, OracleInstanceDetail instanceData, SimpleAuthenticationDetailsProvider provider);

    public void doBootVolumeBackUp(InstanceDetails instanceDetails, User user, String bootVolumeId);

    public void doBootVolumeBackUpNoAuth(InstanceDetails instanceDetails, User user, String bootVolumeId);

    /**
    * 覆盖原来的
    */
    public void doBootVolumeBackUpNoAuthReplace(InstanceDetails instanceDetails, User user, String bootVolumeId);
}
