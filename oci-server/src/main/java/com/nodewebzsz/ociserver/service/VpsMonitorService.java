package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.VpsMonitor;

import java.util.List;

public interface VpsMonitorService {


    public List<VpsMonitor> pageList(int pageNum, int pageSize);
}
