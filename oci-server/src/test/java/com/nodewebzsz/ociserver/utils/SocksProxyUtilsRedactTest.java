package com.nodewebzsz.ociserver.utils;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SocksProxyUtilsRedactTest {

    @Test
    void removesCredentialsFromErrorMessages() {
        VpnProxyRecord proxy = new VpnProxyRecord();
        proxy.setProxyUsername("alice-zone-de");
        proxy.setProxyPassword("p@ssw0rd!");

        String redacted = SocksProxyUtils.redact(
                "connect to http://alice-zone-de:p@ssw0rd!@1.2.3.4:8080 failed, auth p@ssw0rd! rejected for alice-zone-de",
                proxy);

        assertFalse(redacted.contains("p@ssw0rd!"));
        assertFalse(redacted.contains("alice-zone-de"));
        assertTrue(redacted.contains("1.2.3.4:8080"));
    }
}
