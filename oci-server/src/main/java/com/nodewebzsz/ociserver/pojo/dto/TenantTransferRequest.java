package com.nodewebzsz.ociserver.pojo.dto;

import lombok.Data;

@Data
public class TenantTransferRequest {
    private Long tenantId;
    private String transferAmount;
}
