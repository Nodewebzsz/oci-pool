package com.nodewebzsz.ociserver.controller;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.nodewebzsz.dao.entity.DbConfig;
import com.nodewebzsz.dao.entity.EmailBody;
import com.nodewebzsz.dao.entity.InstallApp;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.dao.entity.TenantEmailConfig;
import com.nodewebzsz.dao.entity.TenantSocial;
import com.nodewebzsz.dao.repository.BootInstanceRepository;
import com.nodewebzsz.dao.repository.EmailBodyRepository;
import com.nodewebzsz.dao.repository.OracleInstanceDetailRepository;
import com.nodewebzsz.dao.repository.TenantEmailConfigRepository;
import com.nodewebzsz.dao.repository.TenantRepository;
import com.nodewebzsz.dao.repository.TenantSocialRepository;
import com.nodewebzsz.ociai.utils.OciAiChatUtils;
import com.nodewebzsz.ocicommon.enums.CloudTypeEnum;
import com.nodewebzsz.ocicommon.enums.oci.OciSocialType;
import com.nodewebzsz.ocicommon.param.OpenInstanceNotify;
import com.nodewebzsz.ociserver.config.task.DynamicDailyTask;
import com.nodewebzsz.ociserver.config.task.VersionCheckTask;
import com.nodewebzsz.ociserver.pojo.dto.OciPageResult;
import com.nodewebzsz.ociserver.pojo.enums.ArchitectureEnum;
import com.nodewebzsz.ociserver.pojo.response.ImageInfoRes;
import com.nodewebzsz.ociserver.service.IpQualityCheckService;
import com.nodewebzsz.ociserver.config.task.InstanceTrafficTask;
import com.nodewebzsz.ociserver.config.task.StartBootInstanceTask;
import com.nodewebzsz.ociserver.service.OpenApiService;
import com.nodewebzsz.ociserver.service.SocialTypeService;
import com.nodewebzsz.ociserver.service.TenantService;
import com.nodewebzsz.ociserver.service.factory.CloudCostServiceFactory;
import com.nodewebzsz.ociserver.third.dns.CloudflareService;
import com.nodewebzsz.ociserver.third.dns.TencentEdgeOneService;
import com.nodewebzsz.ociserver.utils.oracle.AuditLogUtils;
import com.nodewebzsz.ociserver.utils.oracle.MFAUtils;
import com.nodewebzsz.ociserver.utils.oracle.OciEmailUtils;
import com.nodewebzsz.ociserver.utils.oracle.OciImageUtils;
import com.nodewebzsz.ociserver.utils.oracle.OciLimitsUtils;
import com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils;
import com.nodewebzsz.ociserver.utils.oracle.db.OciDbUtils;
import com.oracle.bmc.audit.model.AuditEvent;
import com.oracle.bmc.generativeai.model.ModelSummary;
import com.oracle.bmc.identity.model.AvailabilityDomain;
import com.oracle.bmc.identitydomains.model.Group;
import com.oracle.bmc.mysql.model.ShapeSummary;
import com.oracle.bmc.usageapi.model.UsageSummary;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.nodewebzsz.ociserver.utils.oracle.MFAUtils.enableEmailMFA;
import static com.nodewebzsz.ociserver.utils.oracle.MFAUtils.getMFAAuthenticationFactors;
import static com.nodewebzsz.ociserver.utils.oracle.MFAUtils.getUserMFADevices;
import static com.nodewebzsz.ociserver.utils.oracle.MFAUtils.updateMFASettings;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.DEFAULT_SIGN_ON_POLICY_ID;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.OCI_CONSOLE_POLICY_ID;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.RULE_CONSOLE_ADMIN_ID;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.addGroupsToSignOnRule;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.getGroups;
import static com.nodewebzsz.ociserver.utils.oracle.SignOnPolicyUtils.getSignOnRuleDetail;
import static com.nodewebzsz.ociserver.utils.oracle.notify.NotificationUtils.getCurrentNotificationSettings;

/**
 * @version 1.0.0
 * @ClassName TestController
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2024-12-29 15:08
 */
@Controller
@RequestMapping("/test")
@Slf4j
public class TestController  extends BaseController{

    @Resource
    StartBootInstanceTask startBootInstanceTask;

    @Resource
    IpQualityCheckService ipQualityCheckService;

    @Resource
    InstanceTrafficTask instanceTrafficTask;

    @Resource
    BootInstanceRepository bootInstanceRepository;

    @Resource
    OracleInstanceDetailRepository oracleInstanceDetailRepository;

    @Resource
    TenantService tenantService;

    @Resource
    CloudflareService cloudflareService;

    @Resource
    TencentEdgeOneService tencentEdgeOneService;


    @Resource
    private TenantRepository tenantRepository;


    @Resource
    OciAiChatUtils ociAiChatUtils;

    @Resource
    TenantEmailConfigRepository tenantEmailConfigRepository;

    @Resource
    OciEmailUtils ociEmailUtils;

    @Resource
    EmailBodyRepository emailBodyRepository;

    @Resource
    private AuditLogUtils auditLogUtils;

    @Resource
    DynamicDailyTask dynamicDailyTask;

    @Resource
    private CloudCostServiceFactory costFactory;

    @Resource
    private VersionCheckTask versionCheckTask;

    @Resource
    private TenantSocialRepository tenantSocialRepository;

    @Resource
    OpenApiService openApiService;


    //1962075769852219392
    @GetMapping("/query")
    @Transactional
    public void getAllBootVolumes() {
        /*Tenant tenant = tenantRepository.findById(Long.valueOf("1962158606156640256")).get();
        List<ModelSummary> allAvailableModels = ociAiChatUtils.getAllAvailableModels(tenant);
        for (ModelSummary allAvailableModel : allAvailableModels) {
            log.info("当前的模型是:{},id是:{}", allAvailableModel.getDisplayName(), allAvailableModel.getId());
            String result = ociAiChatUtils.chat(tenant, "你好", allAvailableModel.getId());
            log.info("当前模型:{}的回复结果是:{}",allAvailableModel.getDisplayName() ,result);
        }*/

        //发送邮件测试
        /*Optional<TenantEmailConfig> byDomainName = tenantEmailConfigRepository.findByDomainName("objboy.com");
        if (byDomainName.isPresent()){
            TenantEmailConfig tenantEmailConfig = byDomainName.get();
            ociEmailUtils.sendEmail(tenantEmailConfig.getSmtpHost(), Integer.parseInt(tenantEmailConfig.getSmtpPort()), tenantEmailConfig.getSmtpUsername(), tenantEmailConfig.getSmtpPassword(), tenantEmailConfig.getSenderEmail(), tenantEmailConfig.getSenderEmail(), Arrays.asList("lovele.cn@gmail.com"), "测试邮件", "测试邮件内容");
        }*/

        //保存邮件主体和邮件发送记录
        /*EmailBody emailBody = new EmailBody();
        emailBody.setSenderEmail("noreply@objboy.com\n");
        emailBody.setEmailBodyId("123456789");
        emailBody.setTitle("测试");
        emailBody.setContent("测试");
        emailBody.setReceiveTotal(1L);
        emailBody.setReceiveSuccessTotal(0L);
        emailBody.setReceiveFailTotal(0L);
        emailBody.setTenantId(1971916715183939600L);
        emailBody.setTenantName("悉尼测试");
        emailBody.setCreateTime(LocalDateTime.now());
        emailBodyRepository.save(emailBody);*/

        //instanceTrafficTask.updateInstanceTraffic();
        /*Optional<Tenant> byId = tenantRepository.findById(1981237020196864000L);
        final Tenant tenant = byId.get();
        OciPageResult ociPageResult = auditLogUtils.listRecentAuditEvents(tenant, 2, null);
        log.info("查询结果数据:{}", JSON.toJSONString(ociPageResult.getData()));
        log.info("查询结果数据的下一页token是:{}", JSON.toJSONString(ociPageResult.getNextPageToken()));*/

        /*final List<ImageInfoRes> imageInfoRes = OciImageUtils.listImagesByShape(tenant, ArchitectureEnum.ARM_PAID_A2.getType());
        for (ImageInfoRes imageInfo : imageInfoRes) {
            log.info("当前镜像是:{}", JSON.toJSONString(imageInfo));
        }*/
        //dynamicDailyTask.doNotifyOpenBootCount();

        //dynamicDailyTask.checkAndExecuteTask();
        //1994932887386943488
        /*Optional<Tenant> byId = tenantRepository.findById(1994932887386943488L);
        final Tenant tenant = byId.get();
        final List<UsageSummary> usageSummaries = (List<UsageSummary>)costFactory.get(CloudTypeEnum.ORACLE_CLOUD).queryCurrentMonthCostSimple(tenant);
        log.info("查询结果数据:{}", JSON.toJSONString(usageSummaries));*/
        //versionCheckTask.checkVersion();
        //Optional<Tenant> byId = tenantRepository.findById(2013781239647703040L);
        //final Tenant tenant = byId.get();
        /*DbConfig myFirst = OciDbUtils.createMysql(tenant, "myFirst");
        log.info("查询结果数据:{}", JSON.toJSONString(myFirst));*/
       /* String clientId = "xxxxxxx";
        String clientSecret = "xxxxxxx";
        String callBackUrl = SignOnPolicyUtils.enableSocialLogin(tenant, OciSocialType.GOOGLE,clientId, clientSecret);
        log.info("回调地址是:{}", callBackUrl);*/
       /* dynamicDailyTask.doNotifyCostCheck();*/

        //限额测试
        /*Optional<Tenant> byId = tenantRepository.findById(2031962375934935040L);
        final Tenant tenant = byId.get();
        final List<AvailabilityDomain> safeFreeAds = OciLimitsUtils.getSafeFreeAds(tenant, 1);
        log.info("获取的AD列表是:{}", JSON.toJSONString(safeFreeAds));*/

        InstallApp result = new InstallApp();
        result.setUniqueId("123456789");
        result.setIpAddress("192.168.1.1");
        result.setInstallTime(LocalDateTime.now());
        result.setCreateTime(LocalDateTime.now());
        result.setUpdateTime(LocalDateTime.now());

        //openApiService.installApp(result);

        OpenInstanceNotify openInstanceNotify = new OpenInstanceNotify();
        openInstanceNotify.setRegion("ap-singapore-1");
        openInstanceNotify.setArchitecture("ARM");
        openInstanceNotify.setAccountTypeName("个人升级号");
        openInstanceNotify.setCount(1L);
        openApiService.notify(openInstanceNotify);
    }

}
