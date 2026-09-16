package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.ociserver.config.exception.RateLimitException;
import com.nodewebzsz.ociserver.service.login.AuthSecurityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class AuthSecurityServiceTest {

    private AuthSecurityService securityService;

    @BeforeEach
    public void setup() {
        securityService = new AuthSecurityService();
        securityService.init();
    }

    @Test
    public void testLoginFailureAndLockout() {
        String testIp = "192.168.1.100";
        String testUser = "victim_admin";

        // 前 4 次失败不锁定
        for (int i = 1; i <= 4; i++) {
            String msg = securityService.recordLoginFailure(testIp, testUser);
            assertTrue(msg.contains("还可尝试"));
            // 此时 checkLoginLock 不应抛出异常
            assertDoesNotThrow(() -> securityService.checkLoginLock(testIp, testUser));
        }

        // 第 5 次失败，触发锁定
        String lockMsg = securityService.recordLoginFailure(testIp, testUser);
        assertTrue(lockMsg.contains("系统已临时锁定"));

        // 再次检查应抛出锁定异常
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                securityService.checkLoginLock(testIp, testUser));
        assertTrue(ex.getMessage().contains("锁定"));

        // 登录成功清除锁定
        securityService.clearLoginFailure(testIp, testUser);
        assertDoesNotThrow(() -> securityService.checkLoginLock(testIp, testUser));
    }

    @Test
    public void testWhitelistIpNotLocked() {
        String localhost = "127.0.0.1";
        String user = "local_user";

        for (int i = 1; i <= 10; i++) {
            securityService.recordLoginFailure(localhost, user);
        }

        // 白名单 IP 享有终极豁免，即使目标账号被标记锁定，从白名单 IP 访问也不会被死锁
        assertDoesNotThrow(() -> securityService.checkLoginLock(localhost, user));

        // 但如果是外网非白名单 IP 尝试登录该被锁定的账号，依然会被严格阻断抛出异常
        assertThrows(IllegalStateException.class, () -> securityService.checkLoginLock("198.51.100.1", user));
    }

    @Test
    public void testVerifyCodeMeltdown() {
        String user = "test_verify_user";

        // 前 4 次输错验证码不熔断
        for (int i = 1; i <= 4; i++) {
            boolean melted = securityService.recordVerifyCodeFailure("login", user);
            assertFalse(melted);
            assertEquals(5 - i, securityService.getVerifyCodeRemainingAttempts("login", user));
        }

        // 第 5 次输错，触发熔断
        boolean melted = securityService.recordVerifyCodeFailure("login", user);
        assertTrue(melted);

        // 成功或重置后清除
        securityService.clearVerifyCodeFailure("login", user);
        assertEquals(5, securityService.getVerifyCodeRemainingAttempts("login", user));
    }

    @Test
    public void testSendRateLimit() {
        String testIp = "10.0.0.5";

        // 第一次请求通过
        assertDoesNotThrow(() -> securityService.checkAndRecordSendRateLimit(testIp));

        // 立即发第二次请求，应被 60 秒限流阻断抛出 RateLimitException
        RateLimitException ex = assertThrows(RateLimitException.class, () ->
                securityService.checkAndRecordSendRateLimit(testIp));
        assertTrue(ex.getMessage().contains("过于频繁"));

        // 白名单 IP 不限流
        assertDoesNotThrow(() -> securityService.checkAndRecordSendRateLimit("127.0.0.1"));
        assertDoesNotThrow(() -> securityService.checkAndRecordSendRateLimit("127.0.0.1"));
    }

    @Test
    public void testAlertThrottling() {
        String alertType = "malicious_login";

        // 第一次触发告警：允许推送
        assertTrue(securityService.shouldSendAlert(alertType));

        // 紧接着再次触发：处于 10 分钟冷却期，禁止推送
        assertFalse(securityService.shouldSendAlert(alertType));
        assertFalse(securityService.shouldSendAlert(alertType));

        // 检查抑制计数
        assertEquals(2, securityService.getSuppressedAlertCount(alertType));
    }
}
