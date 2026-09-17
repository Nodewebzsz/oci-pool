package com.nodewebzsz.ociserver.config;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.spring.SaTokenContextForSpring;
import cn.dev33.satoken.stp.StpUtil;

import com.nodewebzsz.ociserver.config.filter.RsaDecryptionFilter;
import com.nodewebzsz.ociserver.controller.ModernUiController;
import com.nodewebzsz.ociserver.service.impl.system.SystemConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.annotation.PostConstruct;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Slf4j
@Configuration
public class SaTokenConfig implements WebMvcConfigurer {

    @Autowired
    @Lazy
    private SystemConfigService systemConfigService;

    @Autowired
    private RestTemplate restTemplate;

    @PostConstruct
    public void initSaTokenContext() {
        SaManager.setSaTokenContext(new SaTokenContextForSpring());
    }

    @Bean
    public FilterRegistrationBean<RsaDecryptionFilter> rsaDecryptionFilter() {
        FilterRegistrationBean<RsaDecryptionFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new RsaDecryptionFilter(systemConfigService, restTemplate));
        bean.addUrlPatterns("/perform_login");
        bean.setOrder(10);
        return bean;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
                // Modern UI SPA 页面控制器放行（由前端进行登录态检测并保留原 URL）
                if (handler instanceof HandlerMethod) {
                    HandlerMethod hm = (HandlerMethod) handler;
                    if (ModernUiController.class.equals(hm.getBeanType())) {
                        return true;
                    }
                }

                try {
                    StpUtil.checkLogin();
                    return true;
                } catch (NotLoginException e) {
                    String xRequestedWith = request.getHeader("X-Requested-With");
                    String accept = request.getHeader("Accept");
                    boolean isAjax = "XMLHttpRequest".equals(xRequestedWith)
                            || (accept != null && accept.contains("application/json"));
                    if (isAjax) {
                        response.setStatus(401);
                        response.setContentType("application/json;charset=utf-8");
                        response.getWriter().write("{\"code\":401,\"message\":\"未登录或登录已过期\"}");
                    } else {
                        response.sendRedirect("/login");
                    }
                    return false;
                }
            }
        })
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/login",
                        "/register",
                        "/forgot-password",
                        "/perform_login",
                        "/perform_logout",
                        "/api/version/check",
                        "/api/register-first-user",
                        "/api/disTurnstile",
                        "/api/github/login/url",
                        "/api/github/callback",
                        "/api/github/status",
                        "/api/google/login/url",
                        "/api/google/callback",
                        "/api/send-reset-code",
                        "/api/verify-reset-code",
                        "/api/reset-password",
                        "/api/config/mfa-enabled",
                        "/api/config/turnstile",
                        "/api/config/message-enabled",
                        "/api/metrics/reportMetrics",
                        "/api/send-verification-code",
                        "/api/monitor/download",
                        "/api/monitor/report",
                        "/css/**",
                        "/js/**",
                        "/webfonts/**",
                        "/images/**",
                        "/script/**",
                        "/",                        // Modern UI SPA entry
                        "/modern-ui/**",            // Modern UI static assets
                        "/swagger-ui.html",
                        "/swagger-ui/**",
                        "/v3/api-docs/**",
                        "/swagger-resources/**",
                        "/webjars/**",
                        "/oci-pool/open-api/**",
                        "/favicon.ico",
                        "/favicon.svg",
                        "/error"
                );
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
