package com.nodewebzsz.ociserver.config.security;

import com.nodewebzsz.ocicommon.utils.IpUtils;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

class ClientIpResolverTest {

    @Test
    void ignoresSpoofedForwardedHeaderFromUntrustedPeer() {
        ClientIpResolver resolver = new ClientIpResolver("127.0.0.1,172.16.0.0/12");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.25");
        request.addHeader("X-Forwarded-For", "1.2.3.4");

        assertEquals("198.51.100.25", resolver.resolve(request));
    }

    @Test
    void walksRightToLeftAcrossTrustedProxies() {
        ClientIpResolver resolver = new ClientIpResolver("127.0.0.1,10.0.0.0/8,172.16.0.0/12");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.5");
        request.addHeader("X-Forwarded-For", "9.9.9.9, 203.0.113.42, 10.1.2.3");

        assertEquals("203.0.113.42", resolver.resolve(request));
    }

    @Test
    void rejectsInvalidForwardedHop() {
        ClientIpResolver resolver = new ClientIpResolver("127.0.0.1");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.1, not-an-ip");

        assertEquals("unknown", resolver.resolve(request));
    }

    @Test
    void rejectsInvalidTrustedProxyCidr() {
        assertThrows(IllegalArgumentException.class, () -> new ClientIpResolver("10.0.0.0/99"));
        assertThrows(IllegalArgumentException.class, () -> new ClientIpResolver("invalid-cidr"));
    }

    @Test
    void ipUtilsPrefersResolvedAttributeOverHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.2");
        request.addHeader("X-Forwarded-For", "8.8.8.8");
        assertEquals("172.18.0.2", IpUtils.getClientIpAddress(request));

        request.setAttribute(IpUtils.RESOLVED_CLIENT_IP_ATTRIBUTE, "203.0.113.7");
        assertEquals("203.0.113.7", IpUtils.getClientIpAddress(request));
    }
}
