package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.ServerMetrics;
import com.nodewebzsz.ociserver.pojo.request.ServerMetricsDTO;

import java.util.List;

public interface MetricsService {

    public ServerMetrics saveMetrics(ServerMetrics metrics);

    public List<ServerMetrics> getAllServerStatus();

    public ServerMetrics getServerStatus(String serverId);

    List<ServerMetricsDTO> getAllServerMetrics();

    void deleteMetrics(String serverId);
}
