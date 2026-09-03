package com.doubledimple.ociserver.service.oracle;

import com.doubledimple.dao.entity.InstanceDetails;
import com.doubledimple.dao.entity.Tenant;

import java.util.Map;

public interface OciNetBootService {

    String ROOT_PASSWORD      = "OciStart2025@@";

    /**
     * 全自动 Netboot 救援。
     *
     * @param tftpHost 用户可选自建 TFTP 节点（IP 或 host，多个用逗号/空格分隔）；
     *                 为空则跳过 TFTP，直接走公网 HTTP 下载 netboot.xyz
     */
    boolean executeAutoNetBoot(Tenant tenant, InstanceDetails instanceDetails,
                               Map<String, String> sshConfig, String privateKeyPath,
                               String architecture, String tftpHost);

}
