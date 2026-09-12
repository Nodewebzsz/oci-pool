package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.InstanceDetails;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.dao.repository.OracleInstanceDetailRepository;
import com.nodewebzsz.dao.repository.TenantRepository;
import com.nodewebzsz.ocicommon.enums.RegionEnum;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ocicommon.param.monitor.MonitorAlert;
import com.nodewebzsz.ocicommon.param.monitor.MonitorReportDTO;
import com.nodewebzsz.ocimonitor.service.MonitorCoreService;
import com.nodewebzsz.ociserver.pojo.enums.MessageEnum;
import com.nodewebzsz.ociserver.service.AlertService;
import com.nodewebzsz.ociserver.service.message.factory.MessageFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.Optional;

import static com.nodewebzsz.ocicommon.template.MessageTemplate.MESSAGE_RESOURCE_ALARM_TEMPLATE;

/**
 * @version 1.0.0
 * @ClassName AlertServiceImpl
 * @Description 告警异步通知
 * @Author nodewebzsz
 * @Date 2026-02-06 17:29
 */
@Service
@Slf4j
public class AlertServiceImpl implements AlertService {

    @Resource
    private OracleInstanceDetailRepository instanceRepository;

    @Resource
    TenantRepository tenantRepository;

    @Resource
    @Lazy
    private MonitorCoreService monitorCoreService;

    @Resource
    MessageFactory messageFactory;


    @Async("taskExecutor")
    @Override
    public void sendAlertAsync(MonitorReportDTO reportDto) {
        ApiResponse apiResponse = monitorCoreService.processReportData(reportDto);
        MonitorAlert alert = (MonitorAlert)apiResponse.getData();
        if (alert == null) return;
        try {
            log.info("开始异步处理告警: {}", alert.getType());
            InstanceDetails instance = instanceRepository.findByInstanceId(alert.getInstanceId());
            if (instance == null) return;
            Optional<Tenant> optional = tenantRepository.findById(instance.getTenantId());
            if (!optional.isPresent()) return;
            Tenant tenant = optional.get();
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MESSAGE_RESOURCE_ALARM_TEMPLATE,tenant.getDefName(), RegionEnum.getNameSimple(tenant.getRegion()),instance.getPublicIps(),alert.getMessage()));
        } catch (Exception e) {
            log.error("告警发送失败", e);
        }
    }
}
