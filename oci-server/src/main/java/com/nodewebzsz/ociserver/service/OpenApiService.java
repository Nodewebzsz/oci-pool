package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.InstallApp;
import com.nodewebzsz.ocicommon.param.InstallAppNotify;
import com.nodewebzsz.ocicommon.param.InstanceHelpNotify;
import com.nodewebzsz.ocicommon.param.OpenInstanceNotify;
import com.nodewebzsz.ocicommon.param.OpenRegionNotify;

import java.util.List;

public interface OpenApiService {


    /**
    * @Description: notify
    *
    */
    public void notify(OpenInstanceNotify openInstanceNotify);
    public void help(InstanceHelpNotify instanceHelpNotify);

    public List<OpenRegionNotify> armRecords(OpenRegionNotify openRegionNotify);

    public List<OpenRegionNotify> armRecordsLocal(OpenRegionNotify openRegionNotify);

    public InstallAppNotify installApp(InstallApp installApp);
}
