package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.VpsMonitor;
import com.nodewebzsz.ociserver.service.VpsMonitorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @version 1.0.0
 * @ClassName VpsMonitorServiceImpl
 * @Description TODO
 * @Author renyx
 * @Date 2025-09-14 16:35
 */
@Service
@Slf4j
public class VpsMonitorServiceImpl implements VpsMonitorService {
    @Override
    public List<VpsMonitor> pageList(int pageNum, int pageSize) {
        return null;
    }
}
