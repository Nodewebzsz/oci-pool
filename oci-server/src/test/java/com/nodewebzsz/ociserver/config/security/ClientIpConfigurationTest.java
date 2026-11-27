package com.nodewebzsz.ociserver.config.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.web.ServerProperties;

import static org.junit.jupiter.api.Assertions.*;

class ClientIpConfigurationTest {

    private final ClientIpConfiguration configuration = new ClientIpConfiguration();

    @Test
    void succeedsWhenForwardHeadersStrategyIsNone() {
        ServerProperties properties = new ServerProperties();
        properties.setForwardHeadersStrategy(ServerProperties.ForwardHeadersStrategy.NONE);

        ClientIpResolver resolver = configuration.clientIpResolver("127.0.0.1,10.0.0.0/8", properties);
        assertNotNull(resolver);
    }

    @Test
    void failsWhenForwardHeadersStrategyIsNative() {
        ServerProperties properties = new ServerProperties();
        properties.setForwardHeadersStrategy(ServerProperties.ForwardHeadersStrategy.NATIVE);

        assertThrows(IllegalStateException.class,
                () -> configuration.clientIpResolver("127.0.0.1", properties));
    }

    @Test
    void failsWhenTomcatRemoteIpHeaderConfigured() {
        ServerProperties properties = new ServerProperties();
        properties.setForwardHeadersStrategy(ServerProperties.ForwardHeadersStrategy.NONE);
        properties.getTomcat().getRemoteip().setRemoteIpHeader("X-Forwarded-For");

        assertThrows(IllegalStateException.class,
                () -> configuration.clientIpResolver("127.0.0.1", properties));
    }
}
