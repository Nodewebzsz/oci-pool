package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.InstallApp;
import com.nodewebzsz.ocicommon.param.InstallAppNotify;

public interface InstallAppService {


    //新增
    public InstallAppNotify addOrUpdateInstallApp();


    //查询
    public InstallApp getInstallApp();
}
