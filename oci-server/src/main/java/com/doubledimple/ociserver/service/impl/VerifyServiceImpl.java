package com.doubledimple.ociserver.service.impl;

import cn.hutool.json.JSONUtil;
import com.doubledimple.dao.entity.InstanceDetails;
import com.doubledimple.dao.entity.LoginUser;
import com.doubledimple.dao.entity.Tenant;
import com.doubledimple.dao.repository.LoginUserRepository;
import com.doubledimple.dao.repository.OracleInstanceDetailRepository;
import com.doubledimple.dao.repository.TenantRepository;
import com.doubledimple.ociserver.pojo.enums.MessageEnum;
import com.doubledimple.ociserver.pojo.request.BarkConfig;
import com.doubledimple.ociserver.pojo.request.FeishuConfig;
import com.doubledimple.ociserver.pojo.request.MfaConfig;
import com.doubledimple.ociserver.pojo.request.MfaConfigRequest;
import com.doubledimple.ociserver.service.login.LoginUserService;
import com.doubledimple.ociserver.service.message.factory.MessageFactory;
import com.doubledimple.ociserver.pojo.request.DingTalkConfig;
import com.doubledimple.ociserver.pojo.request.TelegramConfig;
import com.doubledimple.ociserver.service.VerifyService;
import com.doubledimple.ociserver.service.impl.system.SystemConfigService;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.TimeUnit;

import static com.doubledimple.ocicommon.template.MessageTemplate.MESSAGE_CONFIG_STOP_INSTANCE_TEMPLATE;
import static com.doubledimple.ocicommon.template.MessageTemplate.MESSAGE_DATA_EXPORT_CODE_TEMPLATE;
import static com.doubledimple.ocicommon.template.MessageTemplate.MESSAGE_MALICIOUS_LOGIN_TEMPLATE_V_2;
import static com.doubledimple.ocicommon.template.MessageTemplate.MESSAGE_NEW_PASSWORD_TEMPLATE;
import static com.doubledimple.ocicommon.template.MessageTemplate.MESSAGE_PASSWORD_RESET_CODE_TEMPLATE;
import static com.doubledimple.ocicommon.utils.IpUtils.getClientIpAddress;
import static com.doubledimple.ociserver.utils.PingUtil.getCurrentPublicIpAndAddress;


/**
 * @author nodewebzsz
 * @date 2024:12:01日 00:40
 */
@Service
@Slf4j
public class VerifyServiceImpl implements VerifyService {

    private static final String VERIFICATION_CODE_PREFIX = "terminate_verify_";
    private static final String VERIFICATION_CODE_LOGIN_PREFIX = "terminate_verify_login_";

    // 密码重置验证码前缀
    private static final String VERIFICATION_CODE_RESET_PREFIX = "reset_verify_";
    // 重置token前缀
    private static final String RESET_TOKEN_PREFIX = "reset_token_";

    private static final String VERIFICATION_CODE_EXPORT_PREFIX = "export_verify_";

    private static final int CODE_EXPIRE_MINUTES = 5;
    // 重置token过期时间（5分钟）
    private static final int TOKEN_EXPIRE_MINUTES = 3;


    private Cache<String, String> verificationCodeCache;

    // 新增：重置token缓存
    private Cache<String, String> resetTokenCache;


    @Resource
    private TenantRepository tenantRepository;

    @Resource
    private OracleInstanceDetailRepository oracleInstanceDetailRepository;

    @Resource
    private MessageFactory messageFactory;

    @Resource
    private SystemConfigService systemConfigService;

    @Resource
    private LoginUserRepository loginUserRepository;

    @Resource
    private LoginUserService loginUserService;

    @PostConstruct
    public void init() {
        // 初始化Guava Cache，设置5分钟过期时间
        verificationCodeCache = CacheBuilder.newBuilder()
                .expireAfterWrite(CODE_EXPIRE_MINUTES, TimeUnit.MINUTES)
                .build();

        // 新增：初始化重置token缓存，设置10分钟过期时间
        resetTokenCache = CacheBuilder.newBuilder()
                .expireAfterWrite(TOKEN_EXPIRE_MINUTES, TimeUnit.MINUTES)
                .build();
    }


    /**
     * 生成验证码
     * @return
     */
    @Override
    public String generateVerificationCode() {
        Random random = new Random();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }

    @Override
    public void sendVerifyCodeForInstance(String instanceId) {
        String verificationCode = generateVerificationCode();
        String cacheKey = VERIFICATION_CODE_PREFIX + instanceId;
        verificationCodeCache.put(cacheKey, verificationCode);
        InstanceDetails instanceDetails = oracleInstanceDetailRepository.findById(Long.valueOf(instanceId)).get();
        long tenantId = instanceDetails.getTenantId();
        Tenant tenant = tenantRepository.findById(tenantId).get();

        try {
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MESSAGE_CONFIG_STOP_INSTANCE_TEMPLATE,tenant.getUserName(),instanceDetails.getDisplayName(),verificationCode));
        } catch (Exception e) {
            log.error("消息发送失败,{}", e.getMessage(),e);
        }
    }

    @Override
    public void checkCodeForInstance(String instanceId, String verificationCode) {
        // 从Guava Cache中获取验证码
        String cacheKey = VERIFICATION_CODE_PREFIX + instanceId;
        String savedCode = verificationCodeCache.getIfPresent(cacheKey);

        if (savedCode == null) {
            throw new IllegalStateException("验证码已过期，请重新获取");
        }

        if (!savedCode.equals(verificationCode)) {
            throw new IllegalStateException("验证码错误");
        }

        // 验证通过后立即删除验证码
        verificationCodeCache.invalidate(cacheKey);

    }

    @Override
    public boolean isMessageEnabled() {
        TelegramConfig telegramConfig = systemConfigService.getTelegramConfig();
        DingTalkConfig dingTalkConfig = systemConfigService.getDingTalkConfig();
        BarkConfig barkConfig = systemConfigService.getBarkConfig();
        FeishuConfig feishuConfig = systemConfigService.getFeishuConfig();

        // 仅当通道处于启用状态且必要连接凭证完整时，才判定为可用验证码通道（防止未配置导致登录死锁）
        boolean tgValid = telegramConfig != null && telegramConfig.isEnabled()
                && org.apache.commons.lang3.StringUtils.isNotBlank(telegramConfig.getBotToken())
                && org.apache.commons.lang3.StringUtils.isNotBlank(telegramConfig.getChatId());

        boolean barkValid = barkConfig != null && barkConfig.isEnabled()
                && org.apache.commons.lang3.StringUtils.isNotBlank(barkConfig.getDeviceKey());

        boolean dingValid = dingTalkConfig != null && dingTalkConfig.isEnabled()
                && org.apache.commons.lang3.StringUtils.isNotBlank(dingTalkConfig.getWebhook());

        boolean feishuValid = feishuConfig != null && feishuConfig.isEnabled()
                && org.apache.commons.lang3.StringUtils.isNotBlank(feishuConfig.getWebhook());

        return tgValid || barkValid || dingValid || feishuValid;
    }

    @Override
    public void sendVerificationCodeForLogin(String username, HttpServletRequest request) {
        Optional<LoginUser> loginUserOptional = loginUserRepository.findByUsername(username);
        if (!loginUserOptional.isPresent()) {
            final String clientIpAddress = getClientIpAddress(request).replace('.', '_');
            sendToActiveChannels(String.format(MESSAGE_MALICIOUS_LOGIN_TEMPLATE_V_2,
                    getCurrentPublicIpAndAddress(request), username, clientIpAddress, clientIpAddress));
            throw new IllegalStateException("用户名或密码错误");
        }
        LoginUser loginUser = loginUserOptional.get();
        log.debug("当前的用户信息是:{}", JSONUtil.toJsonStr(loginUser));
        // 生成6位随机验证码
        String verificationCode = generateVerificationCode();
        log.info("当前用户:{} 登录的验证码是:{}", username, verificationCode);
        // 将验证码存入Guava Cache
        String cacheKey = VERIFICATION_CODE_LOGIN_PREFIX + username;
        verificationCodeCache.put(cacheKey, verificationCode);

        // 广播发送到所有已启用并配置完整的通道（TG、Bark、钉钉、飞书）
        broadcastVerificationCode(username, verificationCode);
    }

    /**
     * 将验证码广播到所有已配置并启用的通道
     */
    private void broadcastVerificationCode(String username, String verificationCode) {
        TelegramConfig tg = systemConfigService.getTelegramConfig();
        BarkConfig bark = systemConfigService.getBarkConfig();
        DingTalkConfig ding = systemConfigService.getDingTalkConfig();
        FeishuConfig feishu = systemConfigService.getFeishuConfig();

        boolean sent = false;

        if (tg != null && tg.isEnabled()
                && org.apache.commons.lang3.StringUtils.isNotBlank(tg.getBotToken())
                && org.apache.commons.lang3.StringUtils.isNotBlank(tg.getChatId())) {
            try {
                messageFactory.getType(MessageEnum.TELEGRAM).sendVerificationCodeMessage(username, verificationCode);
                sent = true;
                log.info("Telegram 验证码已发送给用户: {}", username);
            } catch (Exception e) {
                log.error("Telegram 验证码发送失败: {}", e.getMessage());
            }
        }

        if (bark != null && bark.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(bark.getDeviceKey())) {
            try {
                messageFactory.getType(MessageEnum.BARK).sendVerificationCodeMessage(username, verificationCode);
                sent = true;
                log.info("Bark 验证码已发送给用户: {}", username);
            } catch (Exception e) {
                log.error("Bark 验证码发送失败: {}", e.getMessage());
            }
        }

        if (ding != null && ding.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(ding.getWebhook())) {
            try {
                messageFactory.getType(MessageEnum.DING_DING).sendVerificationCodeMessage(username, verificationCode);
                sent = true;
                log.info("钉钉验证码已发送给用户: {}", username);
            } catch (Exception e) {
                log.error("钉钉验证码发送失败: {}", e.getMessage());
            }
        }

        if (feishu != null && feishu.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(feishu.getWebhook())) {
            try {
                messageFactory.getType(MessageEnum.FEISHU).sendVerificationCodeMessage(username, verificationCode);
                sent = true;
                log.info("飞书验证码已发送给用户: {}", username);
            } catch (Exception e) {
                log.error("飞书验证码发送失败: {}", e.getMessage());
            }
        }

        if (!sent) {
            log.warn("用户 [{}] 触发了验证码，但未检测到任何已启用且配置完整的通道！", username);
        }
    }

    /**
     * 将普通模板消息发送到所有已启用的通道
     */
    private void sendToActiveChannels(String message) {
        TelegramConfig tg = systemConfigService.getTelegramConfig();
        BarkConfig bark = systemConfigService.getBarkConfig();
        DingTalkConfig ding = systemConfigService.getDingTalkConfig();
        FeishuConfig feishu = systemConfigService.getFeishuConfig();

        if (tg != null && tg.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(tg.getBotToken())) {
            try { messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplateText(message); } catch (Exception ignored) {}
        }
        if (bark != null && bark.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(bark.getDeviceKey())) {
            try { messageFactory.getType(MessageEnum.BARK).sendMessageTemplate(message); } catch (Exception ignored) {}
        }
        if (ding != null && ding.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(ding.getWebhook())) {
            try { messageFactory.getType(MessageEnum.DING_DING).sendMessageTemplate(message); } catch (Exception ignored) {}
        }
        if (feishu != null && feishu.isEnabled() && org.apache.commons.lang3.StringUtils.isNotBlank(feishu.getWebhook())) {
            try { messageFactory.getType(MessageEnum.FEISHU).sendMessageTemplate(message); } catch (Exception ignored) {}
        }
    }

    @Override
    public void checkCodeForLogin(String userName, String verificationCode) {
        // 从Guava Cache中获取验证码
        String cacheKey = VERIFICATION_CODE_LOGIN_PREFIX + userName;
        String savedCode = verificationCodeCache.getIfPresent(cacheKey);

        if (savedCode == null) {
            throw new IllegalStateException("验证码已过期，请重新获取");
        }

        if (!savedCode.equals(verificationCode)) {
            throw new IllegalStateException("验证码错误");
        }
        // 验证通过后立即删除验证码
        verificationCodeCache.invalidate(cacheKey);
    }

    /**
     * 发送密码重置验证码
     */
    @Override
    public void sendVerificationCodeForPasswordReset(String username,HttpServletRequest request) {
        // 1. 检查用户是否存在
        Optional<LoginUser> loginUserOptional = loginUserRepository.findByUsername(username);
        if (!loginUserOptional.isPresent()) {
            final String clientIpAddress = getClientIpAddress(request).replace('.', '_');
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplateText(String.format(MESSAGE_MALICIOUS_LOGIN_TEMPLATE_V_2,
                    getCurrentPublicIpAndAddress(request), username,clientIpAddress,clientIpAddress));
            throw new IllegalStateException("用户名或密码错误");
        }

        LoginUser loginUser = loginUserOptional.get();
        log.info("用户:{} 请求密码重置验证码", username);

        // 2. 检查发送频率限制（可选，防止频繁发送）
        String rateLimitKey = "reset_rate_limit_" + username;
        String lastSendTime = verificationCodeCache.getIfPresent(rateLimitKey);
        if (lastSendTime != null) {
            throw new IllegalStateException("请稍后再试，不要频繁发送验证码");
        }

        // 3. 生成6位随机验证码
        String verificationCode = generateVerificationCode();
        log.info("用户:{} 的密码重置验证码是:{}", username, verificationCode);

        // 4. 将验证码存入缓存
        String cacheKey = VERIFICATION_CODE_RESET_PREFIX + username;
        verificationCodeCache.put(cacheKey, verificationCode);

        // 5. 设置发送频率限制（1分钟）
        verificationCodeCache.put(rateLimitKey, String.valueOf(System.currentTimeMillis()));

        // 6. 发送验证码到消息通知（广播到所有已配置并启用的通道）
        try {
            String resetMsg = String.format(MESSAGE_PASSWORD_RESET_CODE_TEMPLATE, username, verificationCode);
            sendToActiveChannels(resetMsg);
        } catch (Exception e) {
            log.error("密码重置验证码发送失败，用户:{}, 错误:{}", username, e.getMessage(), e);
            verificationCodeCache.invalidate(cacheKey);
            throw new IllegalStateException("验证码发送失败，请稍后重试");
        }
    }

    /**
     * 验证密码重置验证码
     */
    @Override
    public String verifyCodeForPasswordReset(String username, String verificationCode,HttpServletRequest request) {
        // 1. 检查用户是否存在
        Optional<LoginUser> loginUserOptional = loginUserRepository.findByUsername(username);
        if (!loginUserOptional.isPresent()) {
            final String clientIpAddress = getClientIpAddress(request).replace('.', '_');
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplateText(String.format(MESSAGE_MALICIOUS_LOGIN_TEMPLATE_V_2,
                    getCurrentPublicIpAndAddress(request), username,clientIpAddress,clientIpAddress));
            throw new IllegalStateException("用户名或密码错误");
        }

        // 2. 从缓存中获取验证码
        String cacheKey = VERIFICATION_CODE_RESET_PREFIX + username;
        String savedCode = verificationCodeCache.getIfPresent(cacheKey);

        if (savedCode == null) {
            throw new IllegalStateException("验证码已过期或不存在");
        }

        if (!savedCode.equals(verificationCode)) {
            throw new IllegalStateException("验证码错误");
        }

        // 3. 验证成功，删除验证码，生成重置token
        verificationCodeCache.invalidate(cacheKey);

        String resetToken = generateResetToken();
        String tokenKey = RESET_TOKEN_PREFIX + resetToken;
        resetTokenCache.put(tokenKey, username);

        log.info("用户:{} 验证码验证成功，生成重置token", username);
        return resetToken;
    }

    /**
     * 执行密码重置
     */
    @Override
    public String resetPassword(String username, String resetToken) {
        // 1. 验证重置token
        String tokenKey = RESET_TOKEN_PREFIX + resetToken;
        String tokenUsername = resetTokenCache.getIfPresent(tokenKey);

        if (tokenUsername == null || !tokenUsername.equals(username)) {
            throw new IllegalStateException("重置凭证无效或已过期");
        }
        final String newPassword = generateSecurePassword();
        loginUserService.updateUser(username, username, newPassword);

        // 5. 删除重置token
        resetTokenCache.invalidate(tokenKey);

        //如果开启了mfa,禁用
        MfaConfig mfaConfig = systemConfigService.getMfaConfig();
        if (null != mfaConfig && mfaConfig.isEnabled()){
            MfaConfigRequest mfaConfigRequest = new MfaConfigRequest();
            mfaConfigRequest.setEnabled(Boolean.FALSE);
            mfaConfigRequest.setIssuer(mfaConfig.getIssuer());
            systemConfigService.updateMfaConfig(mfaConfigRequest);
        }

        // 6. 发送新密码到通知终端
        try {
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplate(String.format(MESSAGE_NEW_PASSWORD_TEMPLATE,username, newPassword));
            log.info("用户:{} 密码:{}重置成功", username, newPassword);
        } catch (Exception e) {
            log.error("新密码通知发送失败，用户:{}, 错误:{}", username, e.getMessage(), e);
        }

        return "";
    }

    @Override
    public MfaConfig getMfaConfig() {
        return systemConfigService.getMfaConfig();
    }

    @Override
    public void sendVerifyCodeForExport(String username, HttpServletRequest request) {
        // 1. 检查用户是否存在（安全性检查）
        Optional<LoginUser> loginUserOptional = loginUserRepository.findByUsername(username);
        if (!loginUserOptional.isPresent()) {
            final String clientIpAddress = getClientIpAddress(request).replace('.', '_');
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplateText(String.format(MESSAGE_MALICIOUS_LOGIN_TEMPLATE_V_2,
                    getCurrentPublicIpAndAddress(request), username, clientIpAddress, clientIpAddress));
            throw new IllegalStateException("用户不存在，非法导出操作");
        }

        log.info("用户:{} 请求导出数据验证码", username);

        // 2. 生成6位随机验证码
        String verificationCode = generateVerificationCode();

        // 3. 将验证码存入 Guava Cache (复用已有的 5分钟过期配置)
        String cacheKey = VERIFICATION_CODE_EXPORT_PREFIX + username;
        verificationCodeCache.put(cacheKey, verificationCode);

        // 4. 发送通知
        try {
            // 你可以在 MessageTemplate 中定义专门的导出模板，或者复用类似的逻辑
            String message = String.format(MESSAGE_DATA_EXPORT_CODE_TEMPLATE, username, verificationCode);
            messageFactory.getType(MessageEnum.TELEGRAM).sendMessageTemplateText(message,Boolean.FALSE);

            log.info("用户:{} 导出验证码已发送: {}", username, verificationCode);
        } catch (Exception e) {
            log.error("导出验证码发送失败: {}", e.getMessage(), e);
            throw new IllegalStateException("验证码发送失败，请稍后重试");
        }
    }

    @Override
    public void checkCodeForExport(String username, String verificationCode) {
        // 1. 从缓存获取
        String cacheKey = VERIFICATION_CODE_EXPORT_PREFIX + username;
        String savedCode = verificationCodeCache.getIfPresent(cacheKey);

        if (savedCode == null) {
            throw new IllegalStateException("验证码已过期，请重新获取");
        }

        // 2. 校验
        if (!savedCode.equals(verificationCode)) {
            throw new IllegalStateException("验证码错误");
        }

        // 3. 验证成功后立即作废，防止验证码被二次使用
        verificationCodeCache.invalidate(cacheKey);
        log.info("用户:{} 导出验证码校验通过", username);
    }

    /**
     * 生成重置token
     */
    private String generateResetToken() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * 生成安全的随机密码
     */
    private String generateSecurePassword() {
        String chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        Random random = new Random();
        StringBuilder password = new StringBuilder();

        for (int i = 0; i < 12; i++) {
            password.append(chars.charAt(random.nextInt(chars.length())));
        }

        return password.toString();
    }
}
