package com.nodewebzsz.ociserver.service.dns;

import com.nodewebzsz.ociserver.third.dns.CloudflareService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CloudflareOfficialIpsTest {

    @Test
    void fallbackOfficialIpRangesBuildValidNginxRealIpConfig() {
        CloudflareService service = new CloudflareService() {
            @Override
            protected Map<String, List<String>> fetchRemoteCloudflareCidrs() {
                throw new RuntimeException("simulated network timeout");
            }
        };
        Map<String, Object> result = service.listOfficialIpRanges();
        assertEquals("fallback", result.get("source"));

        @SuppressWarnings("unchecked")
        List<String> v4 = (List<String>) result.get("ipv4Cidrs");
        @SuppressWarnings("unchecked")
        List<String> v6 = (List<String>) result.get("ipv6Cidrs");
        assertTrue(v4.contains("173.245.48.0/20"));
        assertTrue(v6.contains("2400:cb00::/32"));

        String nginx = String.valueOf(result.get("nginxRealIpSnippet"));
        assertTrue(nginx.contains("set_real_ip_from 173.245.48.0/20;"));
        assertTrue(nginx.contains("real_ip_header CF-Connecting-IP;"));
        assertTrue(nginx.contains("real_ip_recursive on;"));
    }
}
