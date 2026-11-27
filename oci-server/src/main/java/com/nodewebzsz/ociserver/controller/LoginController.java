package com.nodewebzsz.ociserver.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.nodewebzsz.ocicommon.utils.IpUtils;
import com.nodewebzsz.ocicommon.utils.RsaUtils;
import com.nodewebzsz.ociserver.config.AuthSessionHelper;
import com.nodewebzsz.ociserver.config.exception.IpBannedException;
import com.nodewebzsz.ociserver.controller.BaseController.MessageResolver;
import com.nodewebzsz.ociserver.pojo.request.MfaConfig;
import com.nodewebzsz.ociserver.pojo.request.TurnstileConfig;
import com.nodewebzsz.ociserver.service.VerifyService;
import com.nodewebzsz.ociserver.service.impl.system.SystemConfigService;
import com.nodewebzsz.ociserver.service.login.AuthSecurityService;
import com.nodewebzsz.ociserver.service.login.LoginFailureGuard;
import com.nodewebzsz.ociserver.service.login.LoginUserService;
import com.nodewebzsz.ociserver.service.mfa.OTPService;
import com.nodewebzsz.ociserver.service.security.ExportVerificationGuard;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Locale;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;

import static com.nodewebzsz.ocicommon.constant.Constants.RSA_PRIVATE_KEY;
import static com.nodewebzsz.ocicommon.constant.Constants.RSA_PUBLIC_KEY;
import static com.nodewebzsz.ociserver.utils.DesktopUtils.isMobileRequest;

@Controller
@CrossOrigin
@Slf4j
public class LoginController {

    @Resource
    private LoginUserService loginUserService;

    @Resource
    private AuthSecurityService authSecurityService;

    @Resource
    private LoginFailureGuard loginFailureGuard;

    @Resource
    private ExportVerificationGuard exportVerificationGuard;

    @Resource
    private SystemConfigService systemConfigService;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Resource
    private VerifyService verifyService;

    @Resource
    private OTPService otpService;

    @Resource
    private MessageSource messageSource;


    @RequestMapping(value = "/perform_login", method = RequestMethod.POST)
    public void performLogin(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String username = request.getParameter("username");
        String password = request.getParameter("password");
        String rememberMeParam = request.getParameter("remember-me");
        boolean rememberMe = "on".equals(rememberMeParam) || "true".equals(rememberMeParam) || "1".equals(rememberMeParam);

        String xRequestedWith = request.getHeader("X-Requested-With");
        String accept = request.getHeader("Accept");
        boolean isAjax = "XMLHttpRequest".equals(xRequestedWith) || (accept != null && accept.contains("application/json"));
        boolean mobile = isMobileRequest(request);

        String clientIp = IpUtils.getClientIpAddress(request);

        try {
            clientIp = loginFailureGuard.assertAllowed(request);

            // 检查 IP / 用户名 是否处于锁定状态
            authSecurityService.checkLoginLock(clientIp, username);

            if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
                redirectError(response, request, isAjax, mobile, "用户名或密码不能为空");
                return;
            }

            // 验证用户名密码
            LoginUserService.CredentialCheckResult credentialResult = loginUserService.checkCredentials(username, password);
            if (credentialResult.getStatus() == LoginUserService.CredentialCheckStatus.UNKNOWN_USERNAME) {
                loginFailureGuard.failed(clientIp, username, true);
                String failMsg = authSecurityService.recordLoginFailure(clientIp, username);
                log.warn("用户 [{}] IP [{}] 登录失败（未知用户名）：{}", username, clientIp, failMsg);
                redirectError(response, request, isAjax, mobile, "用户名或密码错误");
                return;
            }
            if (credentialResult.getStatus() == LoginUserService.CredentialCheckStatus.WRONG_PASSWORD) {
                try {
                    exportVerificationGuard.recordPasswordFailure(username);
                } catch (Exception ex) {
                    log.warn("记录用户 [{}] 密码失败计数到导出校验守卫时发生异常：{}", username, ex.getMessage());
                }
                loginFailureGuard.failed(clientIp, username, false);
                String failMsg = authSecurityService.recordLoginFailure(clientIp, username);
                log.warn("用户 [{}] IP [{}] 登录失败（密码错误）：{}", username, clientIp, failMsg);
                redirectError(response, request, isAjax, mobile, failMsg);
                return;
            }
            com.nodewebzsz.dao.entity.LoginUser user = credentialResult.getUser();

            // 验证额外因子（MFA / 消息验证码）
            String factorError = validateAdditionalFactors(request, username);
            if (factorError != null) {
                redirectError(response, request, isAjax, mobile, factorError);
                return;
            }

            final String resolvedIp = clientIp;
            loginFailureGuard.withLoginLock(resolvedIp, () -> {
                loginFailureGuard.loginSucceeded(resolvedIp);
                authSecurityService.clearLoginFailure(resolvedIp, username);
                AuthSessionHelper.login(user.getUsername(), rememberMe);
            });
            log.info("用户 [{}] 登录成功，rememberMe={}", username, rememberMe);

            // 登录成功后清除 RSA 密钥，防止重复使用
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.removeAttribute(RSA_PRIVATE_KEY);
                session.removeAttribute(RSA_PUBLIC_KEY);
            }

            String targetUrl = "/";
            if (isAjax) {
                response.setContentType("application/json;charset=utf-8");
                response.getWriter().write("{\"success\":true,\"redirectUrl\":\"" + targetUrl + "\"}");
            } else {
                response.sendRedirect(targetUrl);
            }
        } catch (IpBannedException e) {
            log.warn("用户 [{}] IP [{}] 触发 IP 封禁拦截：{}", username, clientIp, e.getMessage());
            redirectBanned(response, isAjax, mobile, e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("用户 [{}] IP [{}] 登录被安全拦截：{}", username, clientIp, e.getMessage());
            redirectError(response, request, isAjax, mobile, e.getMessage());
        } catch (Exception e) {
            log.warn("用户 [{}] 登录失败：{}", username, e.getMessage());
            redirectError(response, request, isAjax, mobile, e.getMessage());
        }
    }

    private String validateAdditionalFactors(HttpServletRequest request, String username) {
        boolean messageEnabled = isMessageEnabled();
        MfaConfig mfaConfig = systemConfigService.getMfaConfig();
        boolean mfaEnabled = mfaConfig != null && mfaConfig.isEnabled();

        if (!messageEnabled && !mfaEnabled) {
            return null;
        }

        String verificationCode = request.getParameter("verificationCode");
        String mfaCode = request.getParameter("mfaCode");

        if (messageEnabled && StringUtils.hasText(verificationCode)) {
            try {
                verifyService.checkCodeForLogin(username, verificationCode);
                return null;
            } catch (Exception e) {
                log.warn("消息验证码验证失败：{}", e.getMessage());
            }
        }

        if (mfaEnabled && StringUtils.hasText(mfaCode)) {
            try {
                if (otpService.verifyMfaCode(mfaCode)) {
                    return null;
                }
            } catch (Exception e) {
                log.warn("MFA验证码验证失败：{}", e.getMessage());
            }
        }

        if (messageEnabled && mfaEnabled) {
            if (!StringUtils.hasText(verificationCode) && !StringUtils.hasText(mfaCode)) {
                return "请提供消息验证码或MFA验证码";
            }
            return "验证码错误，请检查消息验证码或MFA验证码";
        } else if (messageEnabled) {
            return StringUtils.hasText(verificationCode) ? "消息验证码错误" : "请提供消息验证码";
        } else {
            return StringUtils.hasText(mfaCode) ? "MFA验证码错误" : "请提供MFA验证码";
        }
    }

    private boolean isMessageEnabled() {
        try {
            return verifyService.isMessageEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    @RequestMapping(value = "/perform_logout", method = {RequestMethod.POST, RequestMethod.GET})
    @ResponseBody
    public void performLogout(HttpServletRequest request, HttpServletResponse response) throws IOException {
        StpUtil.logout();
        boolean mobile = isMobileRequest(request);
        String accept = request.getHeader("Accept");
        String xRequestedWith = request.getHeader("X-Requested-With");
        boolean isAjax = "XMLHttpRequest".equals(xRequestedWith) || (accept != null && accept.contains("application/json"));
        if (isAjax) {
            response.setContentType("application/json;charset=utf-8");
            response.getWriter().write("{\"success\":true}");
        } else {
            response.sendRedirect("/login");
        }
    }

    private void redirectError(HttpServletResponse response, HttpServletRequest request,
                               boolean isAjax, boolean mobile, String message) throws IOException {
        if (isAjax) {
            response.setContentType("application/json;charset=utf-8");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            String escaped = message == null ? "" : message.replace("\"", "\\\"");
            response.getWriter().write("{\"success\":false,\"message\":\"" + escaped + "\"}");
        } else {
            String loginUrl = mobile ? "/m/login" : "/login";
            String encoded = URLEncoder.encode(message == null ? "" : message, StandardCharsets.UTF_8.name());
            response.sendRedirect(loginUrl + "?error=" + encoded);
        }
    }

    private void redirectBanned(HttpServletResponse response,
                                boolean isAjax, boolean mobile, String message) throws IOException {
        String safeMessage = StringUtils.hasText(message) ? message : "IP 已被封禁，请联系管理员解封。";
        if (isAjax) {
            response.setContentType("application/json;charset=utf-8");
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            String escaped = safeMessage.replace("\\", "\\\\").replace("\"", "\\\"");
            response.getWriter().write("{\"success\":false,\"code\":403,\"banned\":true,\"message\":\"" + escaped + "\"}");
        } else {
            String loginUrl = mobile ? "/m/login" : "/login";
            String encoded = URLEncoder.encode(safeMessage, StandardCharsets.UTF_8.name());
            response.sendRedirect(loginUrl + "?error=" + encoded);
        }
    }
}
