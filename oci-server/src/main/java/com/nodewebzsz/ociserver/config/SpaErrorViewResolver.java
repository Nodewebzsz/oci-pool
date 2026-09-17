package com.nodewebzsz.ociserver.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.web.servlet.error.ErrorViewResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.ModelAndView;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * Global SPA Fallback mechanism for HTML5 History routing:
 * Whenever a user navigates directly or refreshes a non-API, non-asset URL
 * that would otherwise yield a 404, forward it internally to the Modern UI index.html.
 */
@Component
public class SpaErrorViewResolver implements ErrorViewResolver {

    @Value("${modern-ui.entry:/modern-ui/index.html}")
    private String entry;

    @Override
    public ModelAndView resolveErrorView(HttpServletRequest request, HttpStatus status, Map<String, Object> model) {
        if (status == HttpStatus.NOT_FOUND && "GET".equalsIgnoreCase(request.getMethod())) {
            String path = request.getRequestURI();
            if (path != null && !path.startsWith("/api/")
                    && !path.startsWith("/oci-pool/open-api/")
                    && !path.startsWith("/swagger-ui/")
                    && !path.startsWith("/v3/api-docs/")
                    && !hasStaticExtension(path)) {
                return new ModelAndView("forward:" + entry);
            }
        }
        return null;
    }

    private boolean hasStaticExtension(String path) {
        int lastSlash = path.lastIndexOf('/');
        int lastDot = path.lastIndexOf('.');
        return lastDot > lastSlash && lastDot < path.length() - 1;
    }
}
