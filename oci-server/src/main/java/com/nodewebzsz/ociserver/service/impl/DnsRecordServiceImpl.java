package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.DnsRecord;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.dao.repository.DnsRecordRepository;
import com.nodewebzsz.ocicommon.enums.ProviderType;
import com.nodewebzsz.ocicommon.template.MessageTemplate;
import com.nodewebzsz.ociserver.pojo.enums.MessageEnum;
import com.nodewebzsz.ociserver.service.DnsRecordService;
import com.nodewebzsz.ociserver.third.dns.CloudflareService;
import com.nodewebzsz.ociserver.third.dns.TencentEdgeOneService;
import com.nodewebzsz.ociserver.service.message.factory.MessageFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import javax.annotation.Resource;
import java.util.List;

import static com.nodewebzsz.ocicommon.enums.ProviderType.CLOUDFLARE;
import static com.nodewebzsz.ocicommon.enums.ProviderType.TENCENT;

/**
 * @version 1.0.0
 * @ClassName DnsRecordServiceImpl
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-07-27 12:24
 */
@Service
@Slf4j
public class DnsRecordServiceImpl implements DnsRecordService {

    @Resource
    DnsRecordRepository dnsRecordRepository;

    @Resource
    CloudflareService cloudflareService;

    @Resource
    TencentEdgeOneService tencentEdgeOneService;

    @Resource
    MessageFactory messageFactory;

    @Override
    public void queryDnsRecordAndRefreshAndChange(Tenant tenant, String instanceId, String oldIp, String ipAddress, List<ProviderType> providerTypes) {
        for (ProviderType providerType : providerTypes) {
            switch (providerType) {
                case CLOUDFLARE:
                    refreshAndChangeForCloudFlare(tenant, instanceId, oldIp, ipAddress);
                    break;
                case TENCENT:
                    log.info("暂时不处理Edge One");
                    //refreshAndChangeForTencent(tenant, instanceId, oldIp, ipAddress);
                    break;
            }
        }

    }

    /**
    * @Description: refreshAndChangeForCloudFlare
    * @Param: [com.nodewebzsz.ociserver.pojo.domain.Tenant, java.lang.String, java.lang.String, java.lang.String]
    * @return: void
    * @Author: dounleDimple
    * @Date: 7/27/25 5:23 PM
    */
    private void refreshAndChangeForCloudFlare(Tenant tenant, String instanceId, String oldIp, String ipAddress) {
        List<DnsRecord> list;
        try {
            list = dnsRecordRepository.findARecordsByIpAndProvider(oldIp, CLOUDFLARE);
            if (CollectionUtils.isEmpty(list)){
                //需要同步一次
                cloudflareService.syncAllDomainsRecords();
                list = dnsRecordRepository.findARecordsByIpAndProvider(oldIp, CLOUDFLARE);
            }
            if (!CollectionUtils.isEmpty(list)){
                list.forEach(record -> {
                    cloudflareService.updateDnsRecordIp(record.getProviderRecordId(),ipAddress);
                });
                DnsRecord dnsRecord = list.get(0);
                messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MessageTemplate.MESSAGE_CONFIG_DNS_AUTO_UPDATE_TEMPLATE,
                        tenant.getUserName(),
                        instanceId,
                        dnsRecord.getProviderType().getDisplayName(),
                        oldIp,
                        ipAddress));
            }else{
                messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MessageTemplate.MESSAGE_CONFIG_IP_SWITCH_TEMPLATE,tenant.getUserName(),instanceId,oldIp,ipAddress));
            }
        } catch (Exception e) {
            log.warn("出现异常,原因为:{}",e.getMessage());
        }
    }


    /**
    * @Description: refreshAndChangeForTencent
    * @Param: [com.nodewebzsz.ociserver.pojo.domain.Tenant, java.lang.String, java.lang.String, java.lang.String]
    * @return: void
    * @Author: dounleDimple
    * @Date: 7/27/25 5:24 PM
    */
    private void refreshAndChangeForTencent(Tenant tenant, String instanceId, String oldIp, String ipAddress) {
        List<DnsRecord> list;
        try {
            list = dnsRecordRepository.findARecordsByIpAndProvider(oldIp, TENCENT);
            if (CollectionUtils.isEmpty(list)){
                //需要同步一次
                tencentEdgeOneService.syncAllDomainsRecords();
                list = dnsRecordRepository.findARecordsByIpAndProvider(oldIp, TENCENT);
            }
            if (!CollectionUtils.isEmpty(list)){
                list.forEach(record -> {
                    tencentEdgeOneService.updateDnsRecordIp(record.getProviderRecordId(),ipAddress);
                });
                DnsRecord dnsRecord = list.get(0);
                messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MessageTemplate.MESSAGE_CONFIG_DNS_AUTO_UPDATE_TEMPLATE,
                        tenant.getUserName(),
                        instanceId,
                        dnsRecord.getProviderType().getDisplayName(),
                        oldIp,
                        ipAddress));
            }else{
                messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MessageTemplate.MESSAGE_CONFIG_IP_SWITCH_TEMPLATE,tenant.getUserName(),instanceId,oldIp,ipAddress));
            }
        } catch (Exception e) {
            log.warn("出现异常,原因为:{}",e.getMessage());
        }
    }
}
