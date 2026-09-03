package com.doubledimple.ociserver.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Serves the React-based Modern UI (single-page app) at the root path.
 *
 * <p>Activated by default. Disable and fall back to the original Freemarker
 * dashboard by setting {@code modern-ui.enabled=false} in application.yml.
 *
 * <p>The SPA files live at {@code classpath:/static/modern-ui/index.html}.
 * All /modern-ui/** requests are served automatically as static assets by
 * Spring Boot's default resource handler — no controller work needed.
 *
 * <p><b>sa-token whitelist</b>: {@link com.doubledimple.ociserver.config.SaTokenConfig}
 * has been patched to include {@code /} and {@code /modern-ui/**} in the
 * excludePathPatterns list, so the SPA can be reached without a login.
 */
@Controller
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(name = "modern-ui.enabled", havingValue = "true", matchIfMissing = true)
public class ModernUiController {

    @Value("${modern-ui.entry:/modern-ui/index.html}")
    private String entry;

    @GetMapping("/")
    public String spaRoot() { return "forward:" + entry; }

    @RequestMapping({"/app", "/app/**"})
    public String spaAppRoot() { return "forward:" + entry; }
}
