package com.nodewebzsz.ocimonitor.service;

import com.nodewebzsz.dao.entity.CloudSshConn;
import com.nodewebzsz.dao.entity.InstanceDetails;
import com.nodewebzsz.dao.repository.CloudSshConnRepository;
import com.nodewebzsz.dao.repository.OracleInstanceDetailRepository;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ocicommon.param.ScriptResult;
import com.nodewebzsz.ocicommon.utils.JschUtils;
import com.nodewebzsz.ocimonitor.service.quality.AgentCredentialReceipt;
import com.nodewebzsz.ocimonitor.service.quality.NetworkQualityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.Date;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * @version 1.0.0
 * @ClassName MonitorDeployService
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2026-02-05 14:26
 */
@Service
@Slf4j
public class MonitorDeployService {

    @Resource
    CloudSshConnRepository cloudSshConnRepository;

    @Resource
    private OracleInstanceDetailRepository oracleInstanceDetailRepository;

    @Resource
    private Environment environment;

    @Resource
    private MonitorCoreService monitorCoreService;

    @Resource
    private NetworkQualityService networkQualityService;

    private final Set<String> activeDeployments = ConcurrentHashMap.newKeySet();

    /**
     * 远程一键安装监控探针
     *
     * @param vpsId 目标 VPS 的数据库 ID
     * @return 安装结果描述
     */
    public ApiResponse installAgent(String vpsId) {
        if (vpsId == null || !activeDeployments.add(vpsId)) {
            return ApiResponse.error("该实例正在执行探针部署或卸载操作，请稍后再试");
        }
        try {
        InstanceDetails instanceDetails = oracleInstanceDetailRepository.findById(Long.valueOf(vpsId))
                .orElseThrow(() -> new RuntimeException("VPS实例不存在: " + vpsId));
        Optional<CloudSshConn> sshConnOpt = cloudSshConnRepository.findByInstanceId(instanceDetails.getInstanceId());
            if (!sshConnOpt.isPresent()) {
                log.warn("未找到实例 [{}] 的SSH连接信息", instanceDetails.getDisplayName());
                return ApiResponse.error("未找到实例的SSH连接信息");
            }
            CloudSshConn cloudSshConn = sshConnOpt.get();
            String token = String.valueOf(instanceDetails.getInstanceId());
            AgentCredentialReceipt receipt = networkQualityService.issueAgentCredential(String.valueOf(instanceDetails.getId()));
            String installScript = monitorCoreService.generateNetworkInstallScript(token, receipt.getCredential(), 5);

            log.info("开始对 VPS [ID: {}, Host: {}] 执行资源与网络质量探针安装...", instanceDetails.getId(), instanceDetails.getPublicIps());
            int sshPort = cloudSshConn.getPort() != null ? cloudSshConn.getPort() : 22;
            ScriptResult result = JschUtils.executeScriptJsch(
                    instanceDetails.getPublicIps(),
                    cloudSshConn.getUsername(),
                    cloudSshConn.getPassword(),
                    sshPort,
                    installScript,
                    true
            );
            if (result.isSuccess()) {
                instanceDetails.setMonitorInstalled(true);
                instanceDetails.setLastHeartbeat(new Date());
                oracleInstanceDetailRepository.save(instanceDetails);
                log.info("VPS [ID: {}, Host: {}] 资源与网络探针安装成功", instanceDetails.getId(), instanceDetails.getPublicIps());
                return ApiResponse.success("资源与网络质量探针安装成功，正在启动上报...");
            } else {
                log.error("VPS [ID: {}, Host: {}] 探针安装失败: {}", instanceDetails.getId(), instanceDetails.getPublicIps(), result.getError());
                String detail = result.getError() != null && !result.getError().trim().isEmpty()
                        ? result.getError().trim()
                        : "SSH 远程安装失败";
                return ApiResponse.error("安装失败: " + detail);
            }
        } finally {
            activeDeployments.remove(vpsId);
        }
    }

    /**
     * 远程卸载监控
     */
    public String uninstallAgent(String vpsId) {
        if (vpsId == null || !activeDeployments.add(vpsId)) {
            throw new RuntimeException("该实例正在执行探针部署或卸载操作，请稍后再试");
        }
        try {
            InstanceDetails instanceDetails = oracleInstanceDetailRepository.findById(Long.valueOf(vpsId))
                    .orElseThrow(() -> new RuntimeException("VPS实例不存在"));

            CloudSshConn cloudSshConn = cloudSshConnRepository.findByInstanceId(instanceDetails.getInstanceId())
                    .orElseThrow(() -> new RuntimeException("SSH信息未找到"));
            String command =
                    "sudo systemctl stop vps-network-agent.service || true; " +
                            "sudo systemctl disable vps-network-agent.service || true; " +
                            "sudo rm -rf /etc/systemd/system/vps-network-agent.service /usr/local/bin/vps-network-agent.py /etc/vps-network-agent; " +
                            "if [ -f /usr/local/bin/vps-agent.sh ]; then " +
                            "   sudo bash /usr/local/bin/vps-agent.sh uninstall; " +
                            "else " +
                            "   sudo systemctl stop vps-agent || true; " +
                            "   sudo systemctl disable vps-agent || true; " +
                            "   sudo rm -f /etc/systemd/system/vps-agent.service /usr/local/bin/vps-agent.sh; " +
                            "fi; " +
                            "sudo systemctl daemon-reload";

            int sshPort = cloudSshConn.getPort() != null ? cloudSshConn.getPort() : 22;

            ScriptResult result = JschUtils.executeScriptJsch(
                    instanceDetails.getPublicIps(),
                    cloudSshConn.getUsername(),
                    cloudSshConn.getPassword(),
                    sshPort,
                    command
            );

            if (result.isSuccess()) {
                networkQualityService.revokeAgentCredential(String.valueOf(instanceDetails.getId()));
                instanceDetails.setMonitorInstalled(false);
                instanceDetails.setLastHeartbeat(null);
                oracleInstanceDetailRepository.save(instanceDetails);
                return "资源与网络探针卸载指令已发送";
            } else {
                throw new RuntimeException("卸载失败: " + result.getError());
            }
        } finally {
            activeDeployments.remove(vpsId);
        }
    }
}
