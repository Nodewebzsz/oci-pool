package com.doubledimple.ociserver.pojo.request;

import lombok.Data;

@Data
public class MfaConfig {
    private boolean enabled;
    private String issuer = "OCI-Pool Verify";
    private String secretKey;
    private String qrCode;
}
