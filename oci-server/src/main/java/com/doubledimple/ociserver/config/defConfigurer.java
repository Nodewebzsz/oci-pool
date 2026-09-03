package com.doubledimple.ociserver.config;

import com.doubledimple.ociserver.config.interceptor.RequestContextInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.MimeMappings;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.CookieLocaleResolver;
import org.springframework.web.servlet.i18n.LocaleChangeInterceptor;

import javax.annotation.Resource;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * @version 1.0.0
 * @ClassName I18nConfig
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-08-09 20:41
 */
@Configuration
public class defConfigurer implements WebMvcConfigurer {

    @Resource
    private RequestContextInterceptor interceptor;

    @Bean
    public CookieLocaleResolver localeResolver() {
        CookieLocaleResolver resolver = new CookieLocaleResolver();
        resolver.setDefaultLocale(Locale.SIMPLIFIED_CHINESE);
        resolver.setCookieName("language");
        resolver.setCookieMaxAge(3600 * 24 * 30);
        resolver.setCookieSecure(false);
        resolver.setCookieHttpOnly(true);
        resolver.setCookiePath("/");
        resolver.setCookieDomain(null);
        return resolver;
    }

    /**
     * 为嵌入容器(内嵌 Tomcat)显式注册 .mjs 的 MIME type = text/javascript。
     * noVNC 以原生 ES module(<script type="module">)加载,Chrome 要求模块脚本的
     * Content-Type 必须是 JavaScript(否则报 "Failed to load module script: Expected a
     * JavaScript module script ... MIME type")。Spring Boot 2.7 默认 MimeMappings 已含
     * mjs,这里显式补强以保证任何环境都稳定。
     */
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> mjsMimeCustomizer() {
        return factory -> {
            MimeMappings mappings = factory.getMimeMappings();
            if (mappings == null) {
                mappings = new MimeMappings();
            }
            mappings.add("mjs", "text/javascript");
            mappings.add("js", "text/javascript");
            factory.setMimeMappings(mappings);
        };
    }

    @Bean
    public LocaleChangeInterceptor localeChangeInterceptor() {
        LocaleChangeInterceptor interceptor = new LocaleChangeInterceptor();
        interceptor.setParamName("lang");
        return interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor).addPathPatterns("/**");
        registry.addInterceptor(localeChangeInterceptor());
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/images/**")
                .addResourceLocations("classpath:/static/images/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic());
        // webfonts: long cache so FA icons don't re-fetch on every page load
        registry.addResourceHandler("/webfonts/**")
                .addResourceLocations("classpath:/static/webfonts/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic());
        // css/js static assets: 7-day cache
        registry.addResourceHandler("/css/**")
                .addResourceLocations("classpath:/static/css/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
        registry.addResourceHandler("/js/**")
                .addResourceLocations("classpath:/static/js/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
        // 暴露 script 目录,让前端 install 指南能直接 wget/curl 下载脚本
        registry.addResourceHandler("/script/**")
                .addResourceLocations("classpath:/script/")
                .setCacheControl(CacheControl.maxAge(0, TimeUnit.SECONDS));
        // Modern UI SPA: index.html 与众多可编辑 .jsx 直接作为静态资源加载。
        // 不加缓存头会被浏览器启发式缓存,导致改版后仍加载旧 JSX(典型症状: 退出登录不跳转)。
        // 这里强制 no-cache(每次重新校验最新),保证浏览器始终拿到当前版本。
        registry.addResourceHandler("/modern-ui/**")
                .addResourceLocations("classpath:/static/modern-ui/")
                .setCacheControl(CacheControl.noCache());
    }
}
