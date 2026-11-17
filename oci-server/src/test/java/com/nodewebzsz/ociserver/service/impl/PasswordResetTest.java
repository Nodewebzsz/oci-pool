package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.LoginUser;
import com.nodewebzsz.dao.repository.LoginUserRepository;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ociserver.controller.login.PasswordResetController;
import com.nodewebzsz.ociserver.pojo.enums.MessageEnum;
import com.nodewebzsz.ociserver.pojo.request.BarkConfig;
import com.nodewebzsz.ociserver.pojo.request.MfaConfig;
import com.nodewebzsz.ociserver.service.VerifyService;
import com.nodewebzsz.ociserver.service.impl.system.SystemConfigService;
import com.nodewebzsz.ociserver.service.login.AuthSecurityService;
import com.nodewebzsz.ociserver.service.login.LoginUserService;
import com.nodewebzsz.ociserver.service.message.MessageService;
import com.nodewebzsz.ociserver.service.message.factory.MessageFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetTest {

    @Mock
    private VerifyService verifyService;

    @Mock
    private AuthSecurityService authSecurityService;

    @InjectMocks
    private PasswordResetController controller;

    @Test
    void sendResetCodeReportsChannelDisabledWhenNoNotifierConfigured() {
        when(verifyService.isMessageEnabled()).thenReturn(false);
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("127.0.0.1");

        ApiResponse resp = controller.sendResetCode(Collections.singletonMap("username", "admin"), req);

        assertTrue(resp.isSuccess());
        assertEquals(200, resp.getCode());
        assertTrue(resp.getMessage().contains("日志"));
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) resp.getData();
        assertEquals(Boolean.FALSE, data.get("channelEnabled"));
    }

    @Test
    void resetPasswordBroadcastsToBarkAndCompletesWhenTelegramUnconfigured() {
        VerifyServiceImpl service = new VerifyServiceImpl();
        service.init();

        LoginUserRepository userRepo = mock(LoginUserRepository.class);
        LoginUserService userService = mock(LoginUserService.class);
        SystemConfigService configService = mock(SystemConfigService.class);
        MessageFactory messageFactory = mock(MessageFactory.class);
        MessageService barkService = mock(MessageService.class);
        AuthSecurityService security = new AuthSecurityService();
        security.init();

        ReflectionTestUtils.setField(service, "loginUserRepository", userRepo);
        ReflectionTestUtils.setField(service, "loginUserService", userService);
        ReflectionTestUtils.setField(service, "systemConfigService", configService);
        ReflectionTestUtils.setField(service, "messageFactory", messageFactory);
        ReflectionTestUtils.setField(service, "authSecurityService", security);

        LoginUser admin = new LoginUser();
        admin.setUsername("admin");
        when(userRepo.findByUsername("admin")).thenReturn(Optional.of(admin));

        BarkConfig bark = new BarkConfig();
        bark.setEnabled(true);
        bark.setDeviceKey("bark-key-123");
        when(configService.getBarkConfig()).thenReturn(bark);
        when(messageFactory.getType(MessageEnum.BARK)).thenReturn(barkService);

        MfaConfig mfa = new MfaConfig();
        mfa.setEnabled(false);
        when(configService.getMfaConfig()).thenReturn(mfa);

        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("127.0.0.1");
        for (int i = 0; i < 5; i++) {
            security.recordLoginFailure("198.51.100.9", "admin");
        }
        assertThrows(IllegalStateException.class, () -> security.checkLoginLock("198.51.100.9", "admin"));

        service.sendVerificationCodeForPasswordReset("admin", req);

        @SuppressWarnings("unchecked")
        com.google.common.cache.Cache<String, String> codeCache =
                (com.google.common.cache.Cache<String, String>) ReflectionTestUtils.getField(service, "verificationCodeCache");
        String code = codeCache.getIfPresent("reset_verify_admin");
        assertNotNull(code);

        String resetToken = service.verifyCodeForPasswordReset("admin", code, req);
        service.resetPassword("admin", resetToken);

        verify(userService).updateUser(eq("admin"), eq("admin"), anyString());
        verify(barkService).sendMessageTemplate(contains("密码重置验证码"));
        verify(barkService).sendMessageTemplate(contains("密码重置成功"));
        verify(messageFactory, never()).getType(MessageEnum.TELEGRAM);
        assertNull(codeCache.getIfPresent("reset_rate_limit_admin"));
        assertDoesNotThrow(() -> security.checkLoginLock("198.51.100.9", "admin"));
    }
}
