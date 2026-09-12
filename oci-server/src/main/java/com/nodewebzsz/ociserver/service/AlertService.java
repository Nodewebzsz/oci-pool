package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.ocicommon.param.monitor.MonitorAlert;
import com.nodewebzsz.ocicommon.param.monitor.MonitorReportDTO;

public interface AlertService {


    public void sendAlertAsync(MonitorReportDTO reportDto);
}
