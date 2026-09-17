package com.nodewebzsz.ociserver.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Serves the React-based Modern UI (single-page app) with HTML5 History routing.
 *
 * <p>All user-facing page routes (without `#`) are forwarded to the SPA entry point,
 * allowing browser refreshes and direct URL navigation without 404s.
 */
@Controller
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(name = "modern-ui.enabled", havingValue = "true", matchIfMissing = true)
public class ModernUiController {

    @Value("${modern-ui.entry:/modern-ui/index.html}")
    private String entry;

    @GetMapping({
            "/",
            "/index",
            "/login",
            "/register",
            "/forgot-password",
            "/monitor",
            "/tenants",
            "/tenants/{tenantDbId:[0-9]+}",
            "/tenants/{tenantDbId:[0-9]+}/**",
            "/instances",
            "/grab",
            "/regions",
            "/boot-logs",
            "/mail",
            "/object-storage",
            "/ai",
            "/link-test",
            "/proxy",
            "/proxy/**",
            "/developer",
            "/developer/**",
            "/tools",
            "/tools/**",
            "/resources",
            "/resources/**",
            "/system",
            "/system/**"
    })
    public String spaRoot() {
        return "forward:" + entry;
    }

    @RequestMapping({"/app", "/app/**"})
    public String spaAppRoot() {
        return "forward:" + entry;
    }
}
